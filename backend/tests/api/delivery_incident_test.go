package api_test

import (
	"fmt"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
	"sync"
	"testing"
)

func TestDeliveryIncidentRecoveryAndReplacement(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit","driver_id":"D1"}`, 200)
	flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"breakdown","details":"Engine stopped","driver_id":"D2"}`, 403)
	report := flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"breakdown","details":"Engine stopped","driver_id":"D1"}`, 201)
	if report["status"] != "on_hold" {
		t.Fatal(report)
	}
	incidentID := report["incidents"].([]any)[0].(map[string]any)["incident_id"].(string)
	flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"breakdown","details":"Again","driver_id":"D1"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T2", "D2"), 400)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", fmt.Sprintf(`{"truck_id":"T2","driver_id":"D2","supervisor_id":"US","incident_id":%q,"resolution_note":"Transfer cargo"}`, incidentID), 400)
	createFlowOrder(t, handler, "O2", "R2")
	flowCall(t, handler, "PATCH", "/delivery-requests/R2/assignment", assignmentBody("T2", "D2"), 200)
	resolve := fmt.Sprintf(`{"truck_id":"T2","driver_id":"D2","supervisor_id":"UT","incident_id":%q,"resolution_note":"Transfer cargo at depot"}`, incidentID)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", resolve, 409)
	unchanged := flowCall(t, handler, "GET", "/delivery-requests/R1", "", 200)
	if unchanged["status"] != "on_hold" || unchanged["incidents"].([]any)[0].(map[string]any)["resolved_at"] != nil {
		t.Fatal("failed resolution partially applied")
	}
	flowCall(t, handler, "POST", "/delivery-requests/R2/cancellation", `{"supervisor_id":"UT","reason":"Free replacement vehicle"}`, 200)
	recovered := flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", resolve, 200)
	if recovered["status"] != "in_transit" || recovered["assignment"].(map[string]any)["driver_id"] != "D2" {
		t.Fatal(recovered)
	}
	history := recovered["incidents"].([]any)[0].(map[string]any)
	if history["truck_id"] != "T1" || history["driver_id"] != "D1" || history["replacement_truck_id"] != "T2" || history["resolved_at"] == nil {
		t.Fatal(history)
	}
	oldTruck := flowCall(t, handler, "GET", "/trucks/T1", "", 200)
	if oldTruck["status"] != "maintenance" || oldTruck["request_id"] != nil {
		t.Fatal(oldTruck)
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", resolve, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 403)
	report = flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"destination_unavailable","details":"Gate closed","driver_id":"D2"}`, 201)
	incidentID = report["incidents"].([]any)[0].(map[string]any)["incident_id"].(string)
	recovered = flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", fmt.Sprintf(`{"truck_id":"T2","driver_id":"D2","supervisor_id":"UT","incident_id":%q,"resolution_note":"Gate opened, proceed"}`, incidentID), 200)
	if len(recovered["incidents"].([]any)) != 2 {
		t.Fatal("history was lost")
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D2"}`, 200)
	order := flowCall(t, handler, "GET", "/purchase-orders/O1", "", 200)
	if order["status"] != "completed" {
		t.Fatal(order)
	}
}

func TestIncidentCancellationPreservesOrderAndDamagedTruck(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
	flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"accident","details":"Unable to depart","driver_id":"D1"}`, 201)
	flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UD1","reason":"Driver cancelling","materials_secured":true}`, 403)
	flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UT","reason":"Not yet secured"}`, 400)
	cancelled := flowCall(t, handler, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UT","reason":"Sales contacted and cargo returned","materials_secured":true}`, 200)
	if cancelled["incidents"].([]any)[0].(map[string]any)["resolution"] != "cancelled" {
		t.Fatal(cancelled)
	}
	order := flowCall(t, handler, "GET", "/purchase-orders/O1", "", 200)
	if order["status"] != "created" {
		t.Fatal("cancellation changed the purchase order")
	}
	truck := flowCall(t, handler, "GET", "/trucks/T1", "", 200)
	if truck["status"] != "maintenance" || truck["request_id"] != nil {
		t.Fatal(truck)
	}
	flowCall(t, handler, "POST", "/delivery-requests/R1/incidents", `{"reason":"other","details":"Closed job","driver_id":"D1"}`, 409)
}

func TestConcurrentIncidentReportsAndResumeBeforeDeparture(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
	codes := make(chan int, 2)
	var group sync.WaitGroup
	for i := 0; i < 2; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			codes <- callAPIAt(handler, "POST", "/delivery-requests/R1/incidents", "application/json", `{"driver_id":"D1","reason":"breakdown","details":"Engine issue"}`).Code
		}()
	}
	group.Wait()
	close(codes)
	counts := map[int]int{}
	for code := range codes {
		counts[code]++
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal(counts)
	}
	var incident models.DeliveryIncident
	if err := db.First(&incident, "request_id = ?", "R1").Error; err != nil {
		t.Fatal(err)
	}
	resumed := flowCall(t, handler, "PATCH", "/delivery-requests/R1/assignment", fmt.Sprintf(`{"truck_id":"T1","driver_id":"D1","supervisor_id":"UT","incident_id":%q,"resolution_note":"Repaired and checked"}`, incident.IncidentID), 200)
	if resumed["status"] != "assigned" {
		t.Fatal("resuming before departure must not mark in transit")
	}
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"delivered","driver_id":"D1"}`, 409)
	flowCall(t, handler, "PATCH", "/delivery-requests/R1/status", `{"status":"in_transit","driver_id":"D1"}`, 200)
}
