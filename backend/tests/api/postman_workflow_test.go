package api_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/routes"
	"github.com/SA-1-69/T20/backend/internal/seed"
)

type collectionItem struct {
	Name    string           `json:"name"`
	Items   []collectionItem `json:"item"`
	Request struct {
		Method string `json:"method"`
		URL    struct {
			Raw string `json:"raw"`
		} `json:"url"`
		Body struct {
			Raw string `json:"raw"`
		} `json:"body"`
	} `json:"request"`
}

// Exercise shipped Postman payloads against the router in an isolated database.
func TestPostmanCollectionAndDemoData(t *testing.T) {
	db := truckDatabase(t)
	if err := seed.Run(db); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../postman/workflow.postman_collection.json")
	if err != nil {
		t.Fatal(err)
	}
	var collection struct {
		Variables []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"variable"`
		Items []collectionItem `json:"item"`
	}
	if err := json.Unmarshal(data, &collection); err != nil {
		t.Fatal(err)
	}
	variables := make(map[string]string)
	for _, variable := range collection.Variables {
		variables[variable.Key] = variable.Value
	}
	expand := func(value string) string {
		for key, replacement := range variables {
			value = strings.ReplaceAll(value, "{{"+key+"}}", replacement)
		}
		return value
	}
	handler := routes.NewRouter(db)
	count := 0
	var visit func([]collectionItem)
	visit = func(items []collectionItem) {
		for _, item := range items {
			if len(item.Items) > 0 {
				visit(item.Items)
				continue
			}
			url := strings.TrimPrefix(expand(item.Request.URL.Raw), variables["base_url"])
			body := expand(item.Request.Body.Raw)
			if strings.Contains(url+body, "{{") {
				t.Fatalf("unresolved variables in %s", item.Name)
			}
			response := callAPIAt(handler, item.Request.Method, url, "application/json", body)
			want := 200
			if item.Request.Method == "POST" && url == "/purchase-orders" {
				want = 201
			}
			if response.Code != want {
				t.Fatalf("Postman %s: expected %d, got %d: %s", item.Name, want, response.Code, response.Body.String())
			}
			if want == 201 {
				var result map[string]any
				if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				variables["order_id"], variables["request_id"] = result["order_id"].(string), result["request_id"].(string)
			}
			count++
		}
	}
	visit(collection.Items)
	if count == 0 {
		t.Fatal("Postman collection had no requests")
	}
}
