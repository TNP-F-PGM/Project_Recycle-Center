package api_test

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/routes"
)

func TestLocationSearchCachesAndValidatesResults(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Query().Get("q") != "นวนคร ปทุมธานี" || r.URL.Query().Get("limit") != "5" || r.URL.Query().Get("bbox") == "" || r.Header.Get("User-Agent") == "" {
			t.Error("incorrect provider request")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"features":[{"geometry":{"type":"Point","coordinates":[100.6,14.1]},"properties":{"name":"นวนคร","city":"ปทุมธานี","state":"ปทุมธานี"}},{"geometry":{"type":"Point","coordinates":[100,999]},"properties":{"name":"bad"}}]}`))
	}))
	defer upstream.Close()
	t.Setenv("GEOCODER_URL", upstream.URL)
	router := routes.NewRouter(nil)
	for _, body := range []string{`{}`, `{"query":"ab"}`, `{"query":"นวนคร","url":"http://other"}`} {
		expectErrorResponse(t, callAPIAt(router, "POST", "/locations/search", "application/json", body), 400)
	}
	for i := 0; i < 2; i++ {
		response := callAPIAt(router, "POST", "/locations/search", "application/json", `{"query":" นวนคร   ปทุมธานี "}`)
		if response.Code != 200 || response.Body.String() != `[{"name":"นวนคร","address":"ปทุมธานี","latitude":14.1,"longitude":100.6}]` {
			t.Fatalf("unexpected result: %d %s", response.Code, response.Body.String())
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("cache missed: %d requests", calls.Load())
	}
	expectErrorResponse(t, callAPIAt(router, "POST", "/locations/search", "application/json", `{"query":"another place"}`), 429)
}

func TestLocationSearchProviderFailures(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
		body   string
		want   int
	}{
		{"unavailable", 503, `{}`, 502}, {"malformed", 200, `<html>`, 502}, {"no matches", 200, `{"features":[]}`, 200},
	} {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer upstream.Close()
			t.Setenv("GEOCODER_URL", upstream.URL)
			response := callAPIAt(routes.NewRouter(nil), "POST", "/locations/search", "application/json", `{"query":"place"}`)
			if response.Code != test.want {
				t.Fatalf("expected %d got %d", test.want, response.Code)
			}
			if test.want == 200 && response.Body.String() != "[]" {
				t.Fatalf("expected empty list: %s", response.Body.String())
			}
		})
	}
}
