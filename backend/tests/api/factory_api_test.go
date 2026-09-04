package api_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/routes"
)

func TestFactoryLocationValidationAndEditing(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	base := `"company_name":" New Factory ","contact_person":"Contact","phone":"0123456789","address":"New address"`
	for _, coords := range []string{``, `,"latitude":13`, `,"latitude":null,"longitude":100`, `,"latitude":91,"longitude":100`, `,"latitude":13,"longitude":181`} {
		flowCall(t, handler, "POST", "/factories", "{"+base+coords+"}", 400)
	}
	created := flowCall(t, handler, "POST", "/factories", "{"+base+`,"latitude":0,"longitude":0}`, 201)
	id := created["factory_id"].(string)
	if !strings.HasPrefix(id, "FAC-") || created["company_name"] != "New Factory" || created["latitude"] != float64(0) {
		t.Fatalf("wrong factory: %+v", created)
	}
	flowCall(t, handler, "GET", "/factories/"+id, "", 200)
	flowCall(t, handler, "POST", "/factories", fmt.Sprintf(`{%s,"factory_id":%q,"latitude":1,"longitude":2}`, base, id), 409)
	for _, body := range []string{`{}`, `{"latitude":13}`, `{"latitude":null,"longitude":100}`, `{"latitude":13,"longitude":-181}`, `{"company_name":" "}`, `{"factory_id":"renamed"}`} {
		flowCall(t, handler, "PATCH", "/factories/"+id, body, 400)
	}
	edited := flowCall(t, handler, "PATCH", "/factories/"+id, `{"latitude":13.1,"longitude":100.2,"address":"Updated address"}`, 200)
	if edited["latitude"] != 13.1 || edited["longitude"] != 100.2 || edited["address"] != "Updated address" {
		t.Fatalf("wrong updated factory: %+v", edited)
	}
	flowCall(t, handler, "GET", "/factories/missing", "", 404)
	flowCall(t, handler, "PATCH", "/factories/missing", `{"address":"Another address"}`, 404)

	if err := db.Exec("UPDATE factories SET latitude = NULL, longitude = NULL WHERE factory_id = 'F2'").Error; err != nil {
		t.Fatal(err)
	}
	legacy := flowCall(t, handler, "GET", "/factories/F2", "", 200)
	if legacy["latitude"] != nil || legacy["longitude"] != nil {
		t.Fatal("legacy factory got invented coordinates")
	}
	flowCall(t, handler, "PATCH", "/factories/F2", `{"address":"Updated address"}`, 400)
	flowCall(t, handler, "PATCH", "/factories/F2", `{"latitude":14,"longitude":101}`, 200)
	for _, sql := range []string{"UPDATE factories SET latitude = NULL WHERE factory_id = 'F2'", "UPDATE factories SET latitude = 91 WHERE factory_id = 'F2'"} {
		if err := db.Exec(sql).Error; err == nil {
			t.Fatal("database accepted invalid factory coordinates")
		}
	}
}

func TestFactoryLocationDeliverySnapshots(t *testing.T) {
	db := workflowDatabase(t)
	handler := routes.NewRouter(db)
	createFlowOrder(t, handler, "O1", "R1")
	assertDestination := func(id string, lat, lon float64, address string) {
		t.Helper()
		d := flowCall(t, handler, "GET", "/delivery-requests/"+id, "", 200)
		if d["destination_latitude"] != lat || d["destination_longitude"] != lon || d["has_coordinates"] != true || d["address"] != address {
			t.Fatalf("wrong snapshot: %+v", d)
		}
	}
	assertDestination("R1", 13.7563, 100.5018, "Original Address")
	flowCall(t, handler, "PATCH", "/factories/F1", `{"latitude":14,"longitude":101,"address":"Factory moved"}`, 200)
	assertDestination("R1", 13.7563, 100.5018, "Original Address")
	createFlowOrder(t, handler, "O2", "R2")
	assertDestination("R2", 14, 101, "Factory moved")
	flowCall(t, handler, "PATCH", "/purchase-orders/O1", `{"factory_id":"F2"}`, 200)
	assertDestination("R1", 13.7563, 100.5018, "Second Address")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1", `{"destination_latitude":0,"destination_longitude":0}`, 200)
	flowCall(t, handler, "PATCH", "/purchase-orders/O1", `{"factory_id":"F2"}`, 200)
	assertDestination("R1", 0, 0, "Second Address")
	flowCall(t, handler, "PATCH", "/delivery-requests/R1", `{"clear_coordinates":true,"destination_latitude":0,"destination_longitude":0}`, 400)
	cleared := flowCall(t, handler, "PATCH", "/delivery-requests/R1", `{"clear_coordinates":true}`, 200)
	if cleared["has_coordinates"] != false {
		t.Fatal("cleared location still present")
	}
	if err := db.Exec("UPDATE factories SET latitude = NULL, longitude = NULL WHERE factory_id = 'F1'").Error; err != nil {
		t.Fatal(err)
	}
	flowCall(t, handler, "POST", "/purchase-orders", `{"order_id":"O3","factory_id":"F1","sales_staff_id":"S1","materials":[{"material_id":"M1","requested_quantity":1}]}`, 400)
	var count int64
	if err := db.Model(&models.PurchaseOrder{}).Where("order_id = ?", "O3").Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("rejected order persisted: count=%d error=%v", count, err)
	}
	flowCall(t, handler, "PATCH", "/purchase-orders/O2", `{"factory_id":"F2"}`, 200)
	flowCall(t, handler, "PATCH", "/purchase-orders/O2", `{"factory_id":"F1"}`, 400)
	assertDestination("R2", 13.7563, 100.5018, "Second Address")
}
