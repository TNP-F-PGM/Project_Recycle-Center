package api_test

import (
	"fmt"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
	"testing"
)

func TestDriverManagementAndAssignmentEligibility(t *testing.T) {
	db := workflowDatabase(t)
	h := routes.NewRouter(db)
	body := `{"supervisor_id":"UT","name":"New Driver","phone":"0812345678","email":"new@example.test","license_number":"NEW-LICENSE","license_expiry":"2099-12-31"}`
	flowCall(t, h, "POST", "/drivers", `{"supervisor_id":"US"}`, 403)
	flowCall(t, h, "POST", "/drivers", `{"supervisor_id":"UT","name":"Incomplete"}`, 400)
	created := flowCall(t, h, "POST", "/drivers", body, 201)
	id := created["employee_id"].(string)
	path := "/drivers/" + id
	if created["eligible"] != true || created["status"] != "active" {
		t.Fatalf("wrong driver: %+v", created)
	}
	if _, ok := created["password"]; ok {
		t.Fatal("password exposed")
	}
	flowCall(t, h, "POST", "/drivers", body, 409)
	var users int64
	db.Model(&models.User{}).Where("email = ?", "new@example.test").Count(&users)
	if users != 1 {
		t.Fatal("duplicate create left a partial user")
	}
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","phone":"bad"}`, 400)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","email":"bad"}`, 400)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","license_expiry":"2030-02-30"}`, 400)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","license_number":"TEST-L1","name":"Should Roll Back"}`, 409)
	got := flowCall(t, h, "GET", path, "", 200)
	if got["name"] != "New Driver" {
		t.Fatal("duplicate license did not roll back user edit")
	}
	createFlowOrder(t, h, "O1", "R1")
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","status":"suspended"}`, 200)
	flowCall(t, h, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", id), 409)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","status":"active","license_expiry":"2000-01-01"}`, 200)
	flowCall(t, h, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", id), 409)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","license_expiry":"2099-12-31"}`, 200)
	flowCall(t, h, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", id), 200)
	got = flowCall(t, h, "GET", path, "", 200)
	if got["active_request_id"] != "R1" || got["eligible"] != false {
		t.Fatal("busy driver incorrectly available")
	}
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","status":"resigned"}`, 409)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","name":"Updated Driver"}`, 200)
	flowCall(t, h, "PATCH", "/delivery-requests/R1/status", fmt.Sprintf(`{"status":"in_transit","driver_id":%q}`, id), 200)
	flowCall(t, h, "POST", "/delivery-requests/R1/incidents", fmt.Sprintf(`{"driver_id":%q,"reason":"breakdown","details":"Test"}`, id), 201)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","status":"suspended"}`, 409)
	flowCall(t, h, "POST", "/delivery-requests/R1/cancellation", `{"supervisor_id":"UT","reason":"Test","materials_secured":true}`, 200)
	flowCall(t, h, "PATCH", path, `{"supervisor_id":"UT","status":"resigned"}`, 200)
	got = flowCall(t, h, "GET", path, "", 200)
	if got["name"] != "Updated Driver" || got["status"] != "resigned" {
		t.Fatal("driver history lost")
	}
	delivery := flowCall(t, h, "GET", "/delivery-requests/R1", "", 200)
	if delivery["assignment"].(map[string]any)["driver_id"] != id {
		t.Fatal("assignment history lost")
	}
	flowCall(t, h, "DELETE", path, "", 405)
	flowCall(t, h, "GET", "/drivers/missing", "", 404)
}

func TestLegacyDriverMissingLicenseCannotReceiveNewAssignment(t *testing.T) {
	db := workflowDatabase(t)
	h := routes.NewRouter(db)
	db.Model(&models.Driver{}).Where("employee_id = ?", "D1").Updates(map[string]any{"license_number": nil, "license_expiry": nil})
	createFlowOrder(t, h, "O1", "R1")
	flowCall(t, h, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 409)
	// Filling both license fields makes the existing employee eligible; IDs are preserved.
	flowCall(t, h, "PATCH", "/drivers/D1", `{"supervisor_id":"UT","phone":"0812345678","license_number":"RESTORED-L1","license_expiry":"2099-12-31"}`, 200)
	flowCall(t, h, "PATCH", "/delivery-requests/R1/assignment", assignmentBody("T1", "D1"), 200)
}
