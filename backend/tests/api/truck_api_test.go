package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/SA-1-69/T20/backend/internal/config"
	"github.com/SA-1-69/T20/backend/internal/migrations"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const validTruckJSON = `{"truck_id":"T001","license_plate":"TEST-001","status":"available","capacity":2500.5}`

func callAPI(handler http.Handler, method, contentType, body string) *httptest.ResponseRecorder {
	return callAPIAt(handler, method, "/trucks", contentType, body)
}

func callAPIAt(handler http.Handler, method, path, contentType, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func expectErrorResponse(t *testing.T, response *httptest.ResponseRecorder, status int) {
	t.Helper()
	if response.Code != status {
		t.Fatalf("expected HTTP %d, got %d: %s", status, response.Code, response.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body["error"] == "" {
		t.Fatalf("expected a JSON error, got %s", response.Body.String())
	}
}

func TestCreateTruckRejectsInvalidInputBeforeWriting(t *testing.T) {
	cases := []struct {
		name, contentType, body string
		status                  int
	}{
		{"missing content type", "", validTruckJSON, 415},
		{"unsupported content type", "text/plain", validTruckJSON, 415},
		{"malformed JSON", "application/json", `{"truck_id":`, 400},
		{"empty body", "application/json", "", 400},
		{"null body", "application/json", "null", 400},
		{"array body", "application/json", "[]", 400},
		{"multiple JSON values", "application/json", validTruckJSON + validTruckJSON, 400},
		{"nested association", "application/json", strings.TrimSuffix(validTruckJSON, "}") + `,"driver":{"employee_id":"new-driver"}}`, 400},
		{"missing truck ID", "application/json", `{"license_plate":"TEST-001","status":"available","capacity":10}`, 400},
		{"blank plate", "application/json", `{"truck_id":"T001","license_plate":"  ","status":"available","capacity":10}`, 400},
		{"blank status", "application/json", `{"truck_id":"T001","license_plate":"TEST-001","status":" ","capacity":10}`, 400},
		{"zero capacity", "application/json; charset=utf-8", strings.Replace(validTruckJSON, "2500.5", "0", 1), 400},
		{"negative capacity", "application/json", strings.Replace(validTruckJSON, "2500.5", "-1", 1), 400},
		{"null capacity", "application/json", strings.Replace(validTruckJSON, "2500.5", "null", 1), 400},
		{"string capacity", "application/json", strings.Replace(validTruckJSON, "2500.5", `"2500"`, 1), 400},
		{"blank driver", "application/json", strings.TrimSuffix(validTruckJSON, "}") + `,"driver_id":"  "}`, 400},
		{"blank request", "application/json", strings.TrimSuffix(validTruckJSON, "}") + `,"request_id":"  "}`, 400},
		{"oversized body", "application/json", `{"truck_id":"` + strings.Repeat("x", 64<<10) + `"}`, 413},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			// A nil database makes any accidental database access fail this test.
			response := callAPI(routes.NewRouter(nil), http.MethodPost, test.contentType, test.body)
			expectErrorResponse(t, response, test.status)
		})
	}
}

func truckDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	if err := config.LoadEnv("../../.env"); err != nil {
		t.Fatal(err)
	}
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	options := &gorm.Config{TranslateError: true, Logger: logger.Default.LogMode(logger.Silent)}
	admin, err := gorm.Open(postgres.Open(dsn), options)
	if err != nil {
		t.Fatal(err)
	}
	adminPool, err := admin.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = adminPool.Close() })
	schemaName := fmt.Sprintf("test_truck_api_%d", time.Now().UnixNano())
	if err := admin.Exec("CREATE SCHEMA " + schemaName).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		// schemaName is generated above, never supplied by a caller.
		if err := admin.Exec("DROP SCHEMA " + schemaName + " CASCADE").Error; err != nil {
			t.Error(err)
		}
	})
	connection, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	// Apply isolation to every pooled connection, including reconnects.
	connection.RuntimeParams["search_path"] = schemaName
	pool := stdlib.OpenDB(*connection)
	t.Cleanup(func() { _ = pool.Close() })
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: pool}), options)
	if err != nil {
		t.Fatal(err)
	}
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestTruckAPIStoresListsAndRejectsDuplicates(t *testing.T) {
	db := truckDatabase(t)
	handler := routes.NewRouter(db)
	response := callAPI(handler, http.MethodGet, "", "")
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("expected an empty JSON array, got %d: %s", response.Code, response.Body.String())
	}

	response = callAPI(handler, http.MethodPost, "application/json", validTruckJSON)
	if response.Code != http.StatusCreated {
		t.Fatalf("create truck: %d: %s", response.Code, response.Body.String())
	}
	var created map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created["truck_id"] != "T001" || created["capacity"] != 2500.5 || created["driver_id"] != nil || created["request_id"] != nil {
		t.Fatalf("unexpected created truck: %+v", created)
	}
	var stored models.Truck
	if err := db.First(&stored, "truck_id = ?", "T001").Error; err != nil {
		t.Fatal(err)
	}
	if stored.LicensePlate != "TEST-001" || stored.Capacity != 2500.5 || stored.Status != "available" {
		t.Fatalf("truck was not persisted correctly: %+v", stored)
	}

	for _, duplicate := range []string{
		strings.Replace(validTruckJSON, "TEST-001", "TEST-OTHER", 1),
		strings.Replace(validTruckJSON, "T001", "T002", 1),
	} {
		expectErrorResponse(t, callAPI(handler, http.MethodPost, "application/json", duplicate), http.StatusConflict)
	}
	response = callAPI(handler, http.MethodGet, "", "")
	var listed []struct {
		TruckID  string  `json:"truck_id"`
		Capacity float64 `json:"capacity"`
	}
	if response.Code != http.StatusOK {
		t.Fatalf("list trucks: %d: %s", response.Code, response.Body.String())
	}
	if err := json.Unmarshal(response.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0].TruckID != "T001" || listed[0].Capacity != 2500.5 {
		t.Fatalf("unexpected truck list after rejected duplicates: %+v", listed)
	}
}

func TestTruckAPIChecksDriverAndRequestReferences(t *testing.T) {
	db := truckDatabase(t)
	if err := db.Exec(`
		INSERT INTO users (user_id, name, phone, email, password, role)
		VALUES ('U001', 'Driver', '000', 'driver@example.test', 'unused', 'driver'),
		       ('U002', 'Supervisor', '000', 'supervisor@example.test', 'unused', 'transport_supervisor'),
		       ('U003', 'Sales', '000', 'sales@example.test', 'unused', 'sales');
		INSERT INTO drivers (employee_id, user_id, position, hire_date)
		VALUES ('D001', 'U001', 'driver', CURRENT_DATE);
		INSERT INTO transport_supervisors (employee_id, user_id, position, hire_date)
		VALUES ('S001', 'U002', 'supervisor', CURRENT_DATE);
		INSERT INTO sales_staff (employee_id, user_id, position, hire_date)
		VALUES ('E001', 'U003', 'sales', CURRENT_DATE);
		INSERT INTO factories (factory_id, company_name, contact_person, phone, address)
		VALUES ('F001', 'Factory', 'Contact', '000', 'Address');
		INSERT INTO purchase_orders (order_id, factory_id, sales_staff_id, status)
		VALUES ('O001', 'F001', 'E001', 'created');
		INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('R001', 'O001', 'Customer', 'Address', 'created', 'U002');
	`).Error; err != nil {
		t.Fatal(err)
	}
	handler := routes.NewRouter(db)
	for _, reference := range []string{`,"driver_id":"U001"}`, `,"request_id":"unknown"}`} {
		body := strings.TrimSuffix(validTruckJSON, "}") + reference
		expectErrorResponse(t, callAPI(handler, http.MethodPost, "application/json", body), http.StatusBadRequest)
	}
	body := strings.TrimSuffix(validTruckJSON, "}") + `,"driver_id":" D001 "}`
	response := callAPI(handler, http.MethodPost, "application/json", body)
	if response.Code != http.StatusCreated {
		t.Fatalf("create assigned truck: %d: %s", response.Code, response.Body.String())
	}
	var stored models.Truck
	if err := db.First(&stored, "truck_id = ?", "T001").Error; err != nil {
		t.Fatal(err)
	}
	if stored.DriverID == nil || *stored.DriverID != "D001" || stored.RequestID != nil {
		t.Fatalf("wrong driver/request references: %+v", stored)
	}
	updated := truckResponse(t, callAPIAt(handler, http.MethodPatch, "/trucks/T001", "application/json", `{"capacity":3000}`), http.StatusOK)
	if updated["driver_id"] != "D001" || updated["request_id"] != nil {
		t.Fatalf("truck update lost existing assignments: %+v", updated)
	}
	if err := db.First(&stored, "truck_id = ?", "T001").Error; err != nil {
		t.Fatal(err)
	}
	if stored.Capacity != 3000 || stored.DriverID == nil || *stored.DriverID != "D001" || stored.RequestID != nil {
		t.Fatalf("stored assignment changed after partial update: %+v", stored)
	}
}

func TestTruckAPIReturnsJSONWhenDatabaseUnavailable(t *testing.T) {
	db := truckDatabase(t)
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := pool.Close(); err != nil {
		t.Fatal(err)
	}
	handler := routes.NewRouter(db)
	for _, request := range []struct{ method, path, body string }{
		{http.MethodGet, "/trucks", ""},
		{http.MethodPost, "/trucks", validTruckJSON},
		{http.MethodGet, "/trucks/T001", ""},
		{http.MethodPatch, "/trucks/T001", `{"capacity":3000}`},
	} {
		response := callAPIAt(handler, request.method, request.path, "application/json", request.body)
		expectErrorResponse(t, response, http.StatusInternalServerError)
		if strings.Contains(response.Body.String(), "database is closed") {
			t.Fatal("internal database error leaked into the response")
		}
	}
}
