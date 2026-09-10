package api_test

import (
	"testing"

	"github.com/SA-1-69/T20/backend/internal/routes"
)

func TestSellerRegistrationUsesSeparateAccountAndStatusFlow(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	created := flowCall(t, handler, "POST", "/sellers", `{
		"seller_code":"SEL-TEST-1","user_id":"USR-SELLER-1","registration_id":"REG-TEST-1",
		"national_id":"1100000000027","name":"Test Seller","phone":"0812345678",
		"email":"seller-one@example.test","password":"password123","address":"Bangkok",
		"seller_type":"บุคคล","identity_documents":["identity.pdf"]
	}`, 201)
	created = created["data"].(map[string]any)
	seller := created["seller"].(map[string]any)
	if seller["seller_code"] != "SEL-TEST-1" || seller["user_id"] != "USR-SELLER-1" || seller["account_status"] != "active" {
		t.Fatalf("wrong seller response: %+v", created)
	}
	flowCall(t, handler, "GET", "/sellers/check-national-id?national_id=1100000000027", "", 200)
	flowCall(t, handler, "POST", "/sellers", `{
		"national_id":"1100000000027","name":"Duplicate","phone":"0800000000",
		"email":"another@example.test","address":"Bangkok","seller_type":"บุคคล"
	}`, 409)
	flowCall(t, handler, "PATCH", "/sellers/SEL-TEST-1/status", `{"status":"suspended"}`, 422)
	suspended := flowCall(t, handler, "PATCH", "/sellers/SEL-TEST-1/status", `{"status":"suspended","suspended_reason":"invalid documents"}`, 200)
	suspended = suspended["data"].(map[string]any)
	if suspended["account_status"] != "suspended" || suspended["suspended_reason"] != "invalid documents" {
		t.Fatalf("seller was not suspended: %+v", suspended)
	}
}

func TestComplaintKeepsFrontendContractAndAuditTrail(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O-COMPLAINT", "R-COMPLAINT")
	created := flowCall(t, handler, "POST", "/complaints", `{
		"complaintID":"CMP-TEST-1","orderID":"O-COMPLAINT",
		"problemDescription":"material grade mismatch","evidenceFile":"evidence.pdf"
	}`, 201)
	created = created["data"].(map[string]any)
	if created["order_id"] != "O-COMPLAINT" || created["factory_id"] != "F1" || created["status"] != "pending" {
		t.Fatalf("wrong complaint response: %+v", created)
	}
	approved := flowCall(t, handler, "PATCH", "/complaints/CMP-TEST-1/review", `{
		"status":"approved","result":"accept return","reviewedBy":"DEMO-COMPLAINT-MANAGER"
	}`, 200)
	approved = approved["data"].(map[string]any)
	if approved["status"] != "approved" || approved["reviewed_at"] == nil {
		t.Fatalf("complaint was not approved: %+v", approved)
	}
	audit := approved["audit_trail"].([]any)
	if len(audit) != 2 {
		t.Fatalf("expected create and review audit records, got %+v", audit)
	}
	flowCall(t, handler, "PATCH", "/complaints/CMP-TEST-1/review", `{"status":"rejected","reviewedBy":"manager","rejectionReason":"late"}`, 409)
}
