package api_test

import (
	"net/http"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/routes"
)

func TestSalesContractLifecycle(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)

	contract := flowCall(t, handler, http.MethodPost, "/sales-contracts", `{
		"contract_id":"C-1002",
		"factory_id":"F1",
		"sales_staff_id":"S1",
		"contract_date":"2026-09-07",
		"valid_from":"2026-09-15",
		"valid_to":"2027-09-14",
		"status":"draft",
		"terms":"ราคาขายตามตลาด ส่วนลดตามปริมาณ 2%",
		"materials":[{
			"material_id":"M1",
			"contract_quantity":2500.5,
			"unit_price":12.50,
			"volume_discount_percent":2
		}]
	}`, http.StatusCreated)
	if contract["contract_id"] != "C-1002" || len(contract["materials"].([]any)) != 1 {
		t.Fatalf("wrong contract response: %+v", contract)
	}

	for _, status := range []string{"pending_approval", "pending_signature", "active"} {
		contract = flowCall(t, handler, http.MethodPatch, "/sales-contracts/C-1002", `{"status":"`+status+`"}`, http.StatusOK)
		if contract["status"] != status {
			t.Fatalf("expected contract status %s, got %+v", status, contract)
		}
	}

	revision := flowCall(t, handler, http.MethodPost, "/sales-contracts/C-1002/revisions", `{
		"revision_id":"REV-1002-01",
		"request_type":"mixed",
		"reason":"ต่ออายุและปรับราคาตามตลาด",
		"new_valid_to":"2029-09-14",
		"new_terms":"ปรับราคาขายเพิ่ม 5% และคงส่วนลดตามปริมาณ 2%",
		"price_adjustment_percent":5,
		"new_volume_discount_percent":2,
		"draft_document":"contracts/C-1002-revision-01-draft.pdf",
		"requested_by":"S1"
	}`, http.StatusCreated)
	if revision["request_status"] != "pending_review" {
		t.Fatalf("wrong revision response: %+v", revision)
	}

	revision = flowCall(t, handler, http.MethodPatch, "/sales-contracts/C-1002/revisions/REV-1002-01", `{
		"status":"pending_signature",
		"reviewed_by":"US",
		"review_note":"อนุมัติเงื่อนไข รอลงนาม"
	}`, http.StatusOK)
	if revision["request_status"] != "pending_signature" {
		t.Fatalf("revision was not approved for signature: %+v", revision)
	}

	revision = flowCall(t, handler, http.MethodPatch, "/sales-contracts/C-1002/revisions/REV-1002-01", `{
		"status":"completed",
		"reviewed_by":"US",
		"signed_document":"contracts/C-1002-revision-01-signed.pdf"
	}`, http.StatusOK)
	if revision["request_status"] != "completed" {
		t.Fatalf("revision was not completed: %+v", revision)
	}

	contract = flowCall(t, handler, http.MethodGet, "/sales-contracts/C-1002", "", http.StatusOK)
	if contract["status"] != "active" || contract["terms"] != "ปรับราคาขายเพิ่ม 5% และคงส่วนลดตามปริมาณ 2%" {
		t.Fatalf("approved revision was not applied: %+v", contract)
	}
	line := contract["materials"].([]any)[0].(map[string]any)
	if line["unit_price"] != float64(13.13) || line["volume_discount_percent"] != float64(2) {
		t.Fatalf("approved pricing was not applied: %+v", line)
	}
}
