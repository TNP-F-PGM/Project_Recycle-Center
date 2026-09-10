package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
	"gorm.io/gorm"
)

func workflowDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db := truckDatabase(t)
	err := db.Exec(`
		INSERT INTO users (user_id, name, phone, email, password, role) VALUES
		('US', 'Sales', '000', 'sales@workflow.test', 'not-a-login-password', 'sales'),
		('UT', 'Supervisor', '000', 'supervisor@workflow.test', 'not-a-login-password', 'transport_supervisor'),
		('UD1', 'Driver One', '000', 'driver1@workflow.test', 'not-a-login-password', 'driver'),
		('UD2', 'Driver Two', '000', 'driver2@workflow.test', 'not-a-login-password', 'driver');
		INSERT INTO sales_staff VALUES ('S1', 'US', 'sales', CURRENT_DATE);
		INSERT INTO transport_supervisors VALUES ('S2', 'UT', 'supervisor', CURRENT_DATE);
		INSERT INTO drivers (employee_id,user_id,position,hire_date,license_number,license_expiry) VALUES ('D1', 'UD1', 'driver', CURRENT_DATE,'TEST-L1',CURRENT_DATE + INTERVAL '5 years'), ('D2', 'UD2', 'driver', CURRENT_DATE,'TEST-L2',CURRENT_DATE + INTERVAL '5 years');
		INSERT INTO factories (factory_id, company_name, contact_person, phone, address) VALUES
		('F1', 'Factory One', 'Contact', '111', 'Original Address'), ('F2', 'Factory Two', 'Contact', '222', 'Second Address');
		UPDATE factories SET latitude = 13.7563, longitude = 100.5018;
		INSERT INTO material_types (type_id, type_name) VALUES (1, 'Metal');
		INSERT INTO materials (material_id, material_name, unit, status, min_stock_level, grade, material_type_id) VALUES
		('M1', 'Steel', 'kg', 'active', 0, 'A', 1), ('M2', 'Copper', 'kg', 'active', 0, 'A', 1);
		INSERT INTO trucks (truck_id, license_plate, status, capacity) VALUES
		('T1', 'FLOW-001', 'available', 5000), ('T2', 'FLOW-002', 'available', 5000);
	`).Error
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func flowCall(t *testing.T, handler http.Handler, method, path, body string, status int) map[string]any {
	t.Helper()
	return truckResponse(t, callAPIAt(handler, method, path, "application/json", body), status)
}

func createFlowOrder(t *testing.T, handler http.Handler, orderID, requestID string) map[string]any {
	t.Helper()
	body := fmt.Sprintf(`{"order_id":%q,"request_id":%q,"factory_id":"F1","sales_staff_id":"S1","order_date":"2030-01-01","materials":[{"material_id":"M1","requested_quantity":10},{"material_id":"M2","requested_quantity":20}],"delivery":{"request_date":"2030-01-02"}}`, orderID, requestID)
	return flowCall(t, handler, "POST", "/purchase-orders", body, 201)
}

func assignmentBody(truck, driver string) string {
	return fmt.Sprintf(`{"truck_id":%q,"driver_id":%q,"supervisor_id":"UT"}`, truck, driver)
}

func TestWorkflowValidatesBeforeWriting(t *testing.T) {
	handler := routes.NewRouter(nil)
	for _, test := range []struct{ method, path, body string }{
		{"POST", "/purchase-orders", `{}`},
		{"POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","materials":[]}`},
		{"POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":0}]}`},
		{"POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":1},{"material_id":" M1 ","requested_quantity":2}]}`},
		{"POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":1}],"delivery":{"destination_latitude":100,"destination_longitude":0}}`},
		{"POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","order_date":"bad-date","materials":[{"material_id":"M1","requested_quantity":1}]}`},
		{"PATCH", "/purchase-orders/O1", `{"sales_staff_id":"another-creator"}`},
		{"PATCH", "/purchase-orders/O1", `{"materials":[{"material_id":"M1","requested_quantity":1,"unexpected":1}]}`},
		{"PATCH", "/purchase-orders/O1", `{"factory_id":null,"materials":[]}`},
		{"PATCH", "/delivery-requests/R1", `{"address":"  "}`},
		{"PATCH", "/delivery-requests/R1", `{"destination_latitude":0}`},
		{"PATCH", "/delivery-requests/R1", `{"order_id":"O2"}`},
		{"PATCH", "/delivery-requests/R1/assignment", `{"truck_id":"T1"}`},
		{"PATCH", "/delivery-requests/R1/status", `{"status":"approved"}`},
	} {
		response := callAPIAt(handler, test.method, test.path, "application/json", test.body)
		expectErrorResponse(t, response, 400)
	}
}

func TestOrderAndDeliveryCreationAndEditsAreAtomic(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	order := createFlowOrder(t, handler, "O1", "R1")
	if order["request_id"] != "R1" || order["sales_staff_id"] != "S1" || len(order["materials"].([]any)) != 2 {
		t.Fatalf("wrong order response: %+v", order)
	}
	delivery := flowCall(t, handler, "GET", "/delivery-requests/R1", "", 200)
	if delivery["order_id"] != "O1" || delivery["status"] != "pending" || delivery["supervisor_id"] != nil || delivery["assignment"] != nil || delivery["customer_name"] != "Factory One" || len(delivery["materials"].([]any)) != 2 {
		t.Fatalf("wrong delivery: %+v", delivery)
	}
	flowCall(t, handler, "PATCH", "/purchase-orders/O1", `{"factory_id":"F2","materials":[{"material_id":"M1","requested_quantity":30}]}`, 200)
	delivery = flowCall(t, handler, "GET", "/delivery-requests/R1", "", 200)
	if delivery["customer_name"] != "Factory Two" || delivery["address"] != "Second Address" || len(delivery["materials"].([]any)) != 1 || delivery["materials"].([]any)[0].(map[string]any)["delivery_quantity"] != float64(30) {
		t.Fatalf("delivery was not synchronized: %+v", delivery)
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R1", `{"address":"Custom address","destination_latitude":0,"destination_longitude":0}`, 200)
	flowCall(t, handler, "PATCH", "/purchase-orders/O1", `{"factory_id":"F1","materials":[{"material_id":"missing","requested_quantity":10}]}`, 400)
	order = flowCall(t, handler, "GET", "/purchase-orders/O1", "", 200)
	delivery = flowCall(t, handler, "GET", "/delivery-requests/R1", "", 200)
	if order["factory_id"] != "F2" || len(order["materials"].([]any)) != 1 || delivery["address"] != "Custom address" {
		t.Fatal("failed edit changed order or delivery")
	}
	flowCall(t, handler, "POST", "/purchase-orders", `{"order_id":"O2","request_id":"R2","factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"missing","requested_quantity":10}]}`, 400)
	flowCall(t, handler, "POST", "/purchase-orders", `{"order_id":"O2","request_id":"R1","factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":10}]}`, 409)
	flowCall(t, handler, "GET", "/purchase-orders/O2", "", 404)
	flowCall(t, handler, "GET", "/delivery-requests/R2", "", 404)
	var count int64
	if err := db.Model(&models.PurchaseOrder{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("partial order was saved: count=%d, err=%v", count, err)
	}
	generated := flowCall(t, handler, "POST", "/purchase-orders", `{"factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":1}]}`, 201)
	if !strings.HasPrefix(generated["order_id"].(string), "PO-") || !strings.HasPrefix(generated["request_id"].(string), "DR-") {
		t.Fatalf("missing generated IDs: %+v", generated)
	}
}

func TestAssignmentDeliveryAndHistory(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	createFlowOrder(t, handler, "O2", "R2")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit","driver_id":"D1"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", `{"truck_id":"T1","driver_id":"D1","supervisor_id":"missing"}`, 400)
	assigned := flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
	if assigned["status"] != "assigned" || assigned["supervisor_id"] != "UT" {
		t.Fatalf("assignment not applied: %+v", assigned)
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R2/assignment", assignmentBody("T1", "D2"), 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R2/assignment", assignmentBody("T2", "D1"), 409)
	flowCall(t, handler, "PATCH", "/trucks/T1", `{"status":"available"}`, 409)
	flowCall(t, handler, "PATCH", "/trucks/T1", `{"capacity":6000}`, 200)
	flowCall(t, handler, "PATCH", "/purchase-orders/O1", `{"materials":[{"material_id":"M1","requested_quantity":3}]}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1", `{"address":"Too late"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit"}`, 400)
	for _, actor := range []string{"S1", "S2", "UT", "D2"} {
		flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", fmt.Sprintf(`{"status":"in_transit","driver_id":%q}`, actor), 403)
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit","driver_id":"D1"}`, 200)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"S2"}`, 403)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D2"}`, 403)
	flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UT","reason":"Test cancellation","materials_secured":true}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T2", "D2"), 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 200)
	truck := flowCall(t, handler, "GET", "/trucks/T1", "", 200)
	if truck["request_id"] != nil || truck["status"] != "available" {
		t.Fatalf("truck was not released: %+v", truck)
	}
	order := flowCall(t, handler, "GET", "/purchase-orders/O1", "", 200)
	if order["status"] != "completed" {
		t.Fatalf("order not completed: %+v", order)
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R2/assignment", assignmentBody("T1", "D1"), 200)
	old := flowCall(t, handler, "GET", "/delivery-requests/R1", "", 200)
	if old["assignment"].(map[string]any)["truck_id"] != "T1" || old["assignment"].(map[string]any)["driver_id"] != "D1" {
		t.Fatalf("history lost: %+v", old)
	}
	// Repeating completion must not release a truck now working on another request.
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D2"}`, 403)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 200)
	truck = flowCall(t, handler, "GET", "/trucks/T1", "", 200)
	if truck["request_id"] != "R2" {
		t.Fatalf("repeated completion released a new job: %+v", truck)
	}
}

func TestReassignmentAndCancellationPreserveHistory(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	createFlowOrder(t, handler, "O2", "R2")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T2", "D2"), 200)
	truck := flowCall(t, handler, "GET", "/trucks/T1", "", 200)
	if truck["request_id"] != nil || truck["status"] != "available" {
		t.Fatal("reassignment did not release previous truck")
	}
	cancelled := flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"cancel_id":"C1","supervisor_id":"UT","reason":"Test cancellation","materials_secured":true}`, 200)
	if cancelled["status"] != "cancelled" || cancelled["cancellation"].(map[string]any)["truck_id"] != "T2" {
		t.Fatalf("wrong cancellation record: %+v", cancelled)
	}
	flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UT","reason":"Test cancellation","materials_secured":true}`, 200)
	flowCall(t, handler, "POST", "/delivery-requests/R2/cancellation", `{"cancel_id":"C1","supervisor_id":"UT","reason":"Test cancellation","materials_secured":true}`, 409)
	unchanged := flowCall(t, handler, "GET", "/delivery-requests/R2", "", 200)
	if unchanged["status"] != "pending" {
		t.Fatal("failed cancellation changed delivery")
	}
	cancelled = flowCall(t, handler, "POST", "/delivery-requests/R2/cancellation", `{"supervisor_id":"UT","reason":"Test cancellation","materials_secured":true}`, 200)
	if cancelled["cancellation"].(map[string]any)["truck_id"] != nil {
		t.Fatal("unassigned cancellation invented a truck")
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R2/assignment", assignmentBody("T1", "D1"), 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit","driver_id":"D1"}`, 409)
}

func TestConcurrentAssignmentsCannotDoubleBook(t *testing.T) {
	for _, resource := range []string{"truck", "driver"} {
		t.Run(resource, func(t *testing.T) {
			db := workflowDatabase(t)
			handler := routes.NewRouter(db)
			createFlowOrder(t, handler, "O1", "R1")
			createFlowOrder(t, handler, "O2", "R2")
			bodies := []string{assignmentBody("T1", "D1"), assignmentBody("T1", "D2")}
			if resource == "driver" {
				bodies[1] = assignmentBody("T2", "D1")
			}
			start := make(chan struct{})
			statuses := make(chan int, 2)
			var workers sync.WaitGroup
			for i := range bodies {
				workers.Add(1)
				go func(i int) {
					defer workers.Done()
					<-start
					response := callAPIAt(handler, "PATCH", fmt.Sprintf("/delivery-requests/R%d/assignment", i+1), "application/json", bodies[i])
					statuses <- response.Code
				}(i)
			}
			close(start)
			workers.Wait()
			codes := []int{<-statuses, <-statuses}
			sort.Ints(codes)
			if codes[0] != 200 || codes[1] != 409 {
				t.Fatalf("double-booking protection failed: %v", codes)
			}
			var assignments int64
			if err := db.Model(&models.DeliveryAssignment{}).Count(&assignments).Error; err != nil || assignments != 1 {
				t.Fatalf("assignments=%d, err=%v", assignments, err)
			}
		})
	}
}

func TestLookupAndWorkflowLists(t *testing.T) {
	db := truckDatabase(t)
	handler := routes.NewRouter(db)
	paths := []string{"/factories", "/materials", "/drivers", "/sales-staff", "/transport-supervisors", "/purchase-orders", "/delivery-requests"}
	for _, path := range paths {
		response := callAPIAt(handler, "GET", path, "", "")
		if response.Code != 200 || strings.TrimSpace(response.Body.String()) != "[]" {
			t.Fatalf("empty list %s: %d %s", path, response.Code, response.Body.String())
		}
	}
	db = workflowDatabase(t)
	handler = routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	for _, path := range paths {
		response := callAPIAt(handler, "GET", path, "", "")
		var rows []map[string]any
		if response.Code != 200 || json.Unmarshal(response.Body.Bytes(), &rows) != nil || len(rows) == 0 {
			t.Fatalf("list %s: %d %s", path, response.Code, response.Body.String())
		}
		for _, row := range rows {
			if _, exists := row["password"]; exists {
				t.Fatalf("lookup exposed password: %s", path)
			}
		}
	}
	for _, path := range []string{"/purchase-orders?status=completed", "/delivery-requests?status=delivered"} {
		response := callAPIAt(handler, "GET", path, "", "")
		if response.Code != 200 || strings.TrimSpace(response.Body.String()) != "[]" {
			t.Fatalf("status filter failed: %s", response.Body.String())
		}
	}
}
