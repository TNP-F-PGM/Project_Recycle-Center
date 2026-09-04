package database_test

import (
	"strings"
	"testing"

	"github.com/SA-1-69/T20/backend/internal/migrations"
	"github.com/SA-1-69/T20/backend/internal/models"
	"gorm.io/gorm"
)

func seedDeliveryOrder(t *testing.T, db *gorm.DB) {
	t.Helper()
	seedOrderParents(t, db)
	execSQL(t, db, `
		INSERT INTO users (user_id, name, phone, email, password, role)
		VALUES ('supervisor-user', 'Supervisor', '000', 'supervisor@example.test', 'unused', 'transport_supervisor');
		INSERT INTO transport_supervisors (employee_id, user_id, position, hire_date)
		VALUES ('supervisor-employee', 'supervisor-user', 'supervisor', CURRENT_DATE);
		INSERT INTO purchase_orders (order_id, factory_id, sales_staff_id, status)
		VALUES ('o1', 'f1', 'e1', 'created');
	`)
}

func TestDeliveryRequestHasOneUniqueSourceOrder(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	seedDeliveryOrder(t, db)
	execSQL(t, db, `
		INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('r1', 'o1', 'Factory One', 'Address', 'pending', 'supervisor-user');
	`)
	var requests []models.DeliveryRequest
	if err := db.Preload("PurchaseOrder.Factory").Order("request_id").Find(&requests).Error; err != nil {
		t.Fatal(err)
	}
	if len(requests) != 1 {
		t.Fatalf("expected one delivery for one order, got %d", len(requests))
	}
	for _, request := range requests {
		if request.OrderID != "o1" || request.PurchaseOrder == nil || request.PurchaseOrder.Factory == nil || request.PurchaseOrder.Factory.FactoryID != "f1" {
			t.Fatalf("delivery does not resolve its source order and factory: %+v", request)
		}
	}
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = NULL WHERE request_id = 'r1'", "23502")
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = 'missing' WHERE request_id = 'r1'", "23503")
	expectSQLState(t, db, "DELETE FROM purchase_orders WHERE order_id = 'o1'", "23503")
	expectSQLState(t, db, `INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('r2', 'o1', 'Factory One', 'Address', 'pending', 'supervisor-user')`, "23505")
}

func TestMigrateLegacyDeliveryRequiresMappingAndPreservesData(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	seedDeliveryOrder(t, db)
	// Reconstruct the previous schema, including dependent material and truck data.
	execSQL(t, db, `
		ALTER TABLE delivery_requests DROP COLUMN order_id;
		INSERT INTO delivery_requests (request_id, customer_name, address, status, supervisor_id)
		VALUES ('r1', 'Factory One', 'Original Address', 'pending', 'supervisor-user');
		INSERT INTO delivery_request_materials (request_id, material_id, delivery_quantity)
		VALUES ('r1', 'm1', 10);
		INSERT INTO trucks (truck_id, license_plate, status, capacity, request_id)
		VALUES ('t1', 'TEST-DELIVERY', 'assigned', 100, 'r1');
	`)
	err := migrations.Run(db)
	if err == nil || !strings.Contains(err.Error(), "link each existing request to its actual purchase order") {
		t.Fatalf("expected actionable missing order mapping error, got %v", err)
	}
	if db.Migrator().HasColumn(&models.DeliveryRequest{}, "order_id") {
		t.Fatal("failed migration did not roll back the added column")
	}

	// An operator supplies the real mapping, then retries the migration.
	execSQL(t, db, `
		ALTER TABLE delivery_requests ADD COLUMN order_id text;
		UPDATE delivery_requests SET order_id = 'missing' WHERE request_id = 'r1';
	`)
	if err := migrations.Run(db); err == nil {
		t.Fatal("migration accepted a nonexistent source order")
	}
	execSQL(t, db, "UPDATE delivery_requests SET order_id = 'o1' WHERE request_id = 'r1'")
	execSQL(t, db, `INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('r2', 'o1', 'Factory One', 'Address', 'pending', 'supervisor-user')`)
	if err := migrations.Run(db); err == nil {
		t.Fatal("migration accepted two deliveries for the same order")
	}
	var count int64
	if err := db.Table("delivery_requests").Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("failed migration changed existing deliveries: count=%d, error=%v", count, err)
	}
	execSQL(t, db, "DELETE FROM delivery_requests WHERE request_id = 'r2'")
	for i := 0; i < 2; i++ {
		if err := migrations.Run(db); err != nil {
			t.Fatalf("migration run %d: %v", i+1, err)
		}
	}
	var request models.DeliveryRequest
	if err := db.Preload("PurchaseOrder").Preload("Materials").First(&request, "request_id = ?", "r1").Error; err != nil {
		t.Fatal(err)
	}
	if request.OrderID != "o1" || request.PurchaseOrder == nil || request.Address != "Original Address" || request.Status != "pending" || request.SupervisorID == nil || *request.SupervisorID != "supervisor-user" || len(request.Materials) != 1 || request.Materials[0].DeliveryQuantity != 10 {
		t.Fatalf("delivery data or its order link was not preserved: %+v", request)
	}
	var truck models.Truck
	if err := db.First(&truck, "truck_id = ?", "t1").Error; err != nil {
		t.Fatal(err)
	}
	if truck.RequestID == nil || *truck.RequestID != "r1" {
		t.Fatalf("truck lost its delivery reference: %+v", truck)
	}
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = NULL WHERE request_id = 'r1'", "23502")
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = 'missing' WHERE request_id = 'r1'", "23503")
	expectSQLState(t, db, `INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('r2', 'o1', 'Factory One', 'Address', 'pending', 'supervisor-user')`, "23505")
}

func TestMigrateEmptyLegacyDeliveryTable(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	execSQL(t, db, "ALTER TABLE delivery_requests DROP COLUMN order_id")
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	seedDeliveryOrder(t, db)
	execSQL(t, db, `
		INSERT INTO delivery_requests (request_id, order_id, customer_name, address, status, supervisor_id)
		VALUES ('r1', 'o1', 'Factory One', 'Address', 'pending', 'supervisor-user');
	`)
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = NULL WHERE request_id = 'r1'", "23502")
	expectSQLState(t, db, "UPDATE delivery_requests SET order_id = 'missing' WHERE request_id = 'r1'", "23503")
}
