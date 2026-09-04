package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
)

func truckResponse(t *testing.T, response *httptest.ResponseRecorder, status int) map[string]any {
	t.Helper()
	if response.Code != status {
		t.Fatalf("expected HTTP %d, got %d: %s", status, response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}

func TestUpdateTruckRejectsInvalidInputBeforeWriting(t *testing.T) {
	for _, test := range []struct{ name, body string }{
		{"empty update", `{}`},
		{"null update", `null`},
		{"blank plate", `{"license_plate":"  "}`},
		{"null plate", `{"license_plate":null}`},
		{"numeric plate", `{"license_plate":123}`},
		{"blank status", `{"status":"  "}`},
		{"null status", `{"status":null}`},
		{"invalid status type", `{"status":true}`},
		{"zero capacity", `{"capacity":0}`},
		{"negative capacity", `{"capacity":-5}`},
		{"null capacity", `{"capacity":null}`},
		{"string capacity", `{"capacity":"100"}`},
		{"overflow capacity", `{"capacity":1e999}`},
		{"mixed valid and invalid", `{"status":"available","capacity":0}`},
		{"immutable truck ID", `{"truck_id":"T002","capacity":100}`},
		{"unsupported assignment", `{"driver_id":null}`},
		{"nested association", `{"driver":{"employee_id":"D001"}}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := callAPIAt(routes.NewRouter(nil), http.MethodPatch, "/trucks/T001", "application/json", test.body)
			expectErrorResponse(t, response, http.StatusBadRequest)
		})
	}
}

func TestTruckAPIGetsAndUpdatesOnlyTheSelectedTruck(t *testing.T) {
	db := truckDatabase(t)
	handler := routes.NewRouter(db)
	truckResponse(t, callAPI(handler, http.MethodPost, "application/json", validTruckJSON), http.StatusCreated)
	secondTruck := strings.ReplaceAll(strings.ReplaceAll(validTruckJSON, "T001", "T002"), "TEST-001", "TEST-002")
	truckResponse(t, callAPI(handler, http.MethodPost, "application/json", secondTruck), http.StatusCreated)

	get := func(id string) map[string]any {
		t.Helper()
		return truckResponse(t, callAPIAt(handler, http.MethodGet, "/trucks/"+id, "", ""), http.StatusOK)
	}
	original := get("T001")
	if original["truck_id"] != "T001" || original["license_plate"] != "TEST-001" || original["capacity"] != 2500.5 {
		t.Fatalf("incorrect truck detail: %+v", original)
	}

	// Sending only capacity must preserve the other stored fields.
	updated := truckResponse(t, callAPIAt(handler, http.MethodPatch, "/trucks/T001", "application/json", `{"capacity":3000.5}`), http.StatusOK)
	if updated["truck_id"] != "T001" || updated["capacity"] != 3000.5 || updated["license_plate"] != original["license_plate"] || updated["status"] != original["status"] || updated["driver_id"] != nil || updated["request_id"] != nil {
		t.Fatalf("partial update changed omitted fields or returned the wrong truck: %+v", updated)
	}
	if get("T001")["capacity"] != 3000.5 || get("T002")["capacity"] != 2500.5 {
		t.Fatal("update was not persisted to just the selected truck")
	}

	for i := 0; i < 2; i++ {
		updated = truckResponse(t, callAPIAt(handler, http.MethodPatch, "/trucks/T001", "application/json", `{"license_plate":" TEST-NEW ","status":" maintenance "}`), http.StatusOK)
		if updated["license_plate"] != "TEST-NEW" || updated["status"] != "maintenance" || updated["capacity"] != 3000.5 {
			t.Fatalf("repeated partial update failed: %+v", updated)
		}
	}

	// A conflicting update must not save any of its other fields.
	expectErrorResponse(t, callAPIAt(handler, http.MethodPatch, "/trucks/T001", "application/json", `{"license_plate":"TEST-002","capacity":123}`), http.StatusConflict)
	unchanged := get("T001")
	if unchanged["license_plate"] != "TEST-NEW" || unchanged["capacity"] != 3000.5 || unchanged["status"] != "maintenance" {
		t.Fatalf("conflicting update changed stored values: %+v", unchanged)
	}

	expectErrorResponse(t, callAPIAt(handler, http.MethodGet, "/trucks/missing", "", ""), http.StatusNotFound)
	expectErrorResponse(t, callAPIAt(handler, http.MethodPatch, "/trucks/missing", "application/json", `{"capacity":100}`), http.StatusNotFound)
	var count int64
	if err := db.Model(&models.Truck{}).Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("updating an unknown ID created a truck: count=%d, error=%v", count, err)
	}
}
