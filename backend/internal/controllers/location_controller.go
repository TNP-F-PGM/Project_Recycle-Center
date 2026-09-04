package controllers

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

type PlaceResult struct {
	Name      string  `json:"name"`
	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
type placeCache struct {
	results []PlaceResult
	expires time.Time
}

// One controller per server: bounded cache and a shared upstream request limit.
type LocationController struct {
	endpoint    string
	client      *http.Client
	mu          sync.Mutex
	cache       map[string]placeCache
	nextRequest time.Time
	pending     bool
}

func NewLocationController() *LocationController {
	endpoint := strings.TrimSpace(os.Getenv("GEOCODER_URL"))
	if endpoint == "" {
		endpoint = "https://photon.komoot.io/api/"
	}
	return &LocationController{endpoint: endpoint, client: &http.Client{Timeout: 8 * time.Second}, cache: make(map[string]placeCache)}
}

func (h *LocationController) Search(c *gin.Context) {
	var input struct {
		Query string `json:"query"`
	}
	if !utils.ReadJSON(c, &input) {
		return
	}
	query := strings.Join(strings.Fields(input.Query), " ")
	if utf8.RuneCountInString(query) < 3 || utf8.RuneCountInString(query) > 200 {
		utils.WriteError(c, 400, "กรุณาพิมพ์ชื่อสถานที่หรือที่อยู่ 3–200 ตัวอักษร")
		return
	}
	key := strings.ToLower(query)
	h.mu.Lock()
	now := time.Now()
	if entry, ok := h.cache[key]; ok && now.Before(entry.expires) {
		h.mu.Unlock()
		c.JSON(200, entry.results)
		return
	}
	if h.pending || now.Before(h.nextRequest) {
		h.mu.Unlock()
		c.Header("Retry-After", "1")
		utils.WriteError(c, 429, "กรุณารอสักครู่แล้วกดค้นหาอีกครั้ง")
		return
	}
	h.pending = true
	h.nextRequest = now.Add(time.Second)
	h.mu.Unlock()
	defer func() { h.mu.Lock(); h.pending = false; h.mu.Unlock() }()
	endpoint, err := url.Parse(h.endpoint)
	if err != nil || (endpoint.Scheme != "https" && endpoint.Scheme != "http") || endpoint.Host == "" {
		utils.WriteError(c, 503, "ยังตั้งค่าบริการค้นหาสถานที่ไม่ถูกต้อง")
		return
	}
	params := endpoint.Query()
	params.Set("q", query)
	params.Set("limit", "5")
	params.Set("bbox", "97,5,106,21")
	endpoint.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, endpoint.String(), nil)
	if err != nil {
		utils.WriteError(c, 503, "เปิดบริการค้นหาสถานที่ไม่ได้")
		return
	}
	req.Header.Set("User-Agent", "T20-RecycleHub/1.0 (factory location search)")
	req.Header.Set("Accept", "application/json")
	response, err := h.client.Do(req)
	if err != nil {
		utils.WriteError(c, 502, "ค้นหาสถานที่ไม่ได้ในขณะนี้ ลองใหม่หรือกรอกพิกัดเอง")
		return
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		utils.WriteError(c, 502, "บริการค้นหาสถานที่ไม่พร้อม ลองใหม่หรือกรอกพิกัดเอง")
		return
	}
	var payload struct {
		Features []struct {
			Geometry struct {
				Type        string    `json:"type"`
				Coordinates []float64 `json:"coordinates"`
			} `json:"geometry"`
			Properties map[string]any `json:"properties"`
		} `json:"features"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		utils.WriteError(c, 502, "อ่านผลค้นหาไม่ได้ กรุณาลองใหม่")
		return
	}
	results := make([]PlaceResult, 0, 5)
	for _, feature := range payload.Features {
		xy := feature.Geometry.Coordinates
		if feature.Geometry.Type != "Point" || len(xy) < 2 || math.IsNaN(xy[0]) || math.IsNaN(xy[1]) || math.Abs(xy[0]) > 180 || math.Abs(xy[1]) > 90 {
			continue
		}
		name, _ := feature.Properties["name"].(string)
		parts := []string{}
		seen := map[string]bool{}
		for _, field := range []string{"housenumber", "street", "district", "city", "county", "state", "postcode", "country"} {
			value, _ := feature.Properties[field].(string)
			value = strings.TrimSpace(value)
			if value != "" && value != name && !seen[value] {
				parts = append(parts, value)
				seen[value] = true
			}
		}
		address := strings.Join(parts, ", ")
		if name == "" {
			name = address
		}
		if name == "" {
			continue
		}
		results = append(results, PlaceResult{Name: name, Address: address, Latitude: xy[1], Longitude: xy[0]})
		if len(results) == 5 {
			break
		}
	}
	h.mu.Lock()
	for k, entry := range h.cache {
		if time.Now().After(entry.expires) {
			delete(h.cache, k)
		}
	}
	if len(h.cache) >= 200 {
		for k := range h.cache {
			delete(h.cache, k)
			break
		}
	}
	h.cache[key] = placeCache{results: results, expires: time.Now().Add(time.Hour)}
	h.mu.Unlock()
	c.JSON(200, results)
}
