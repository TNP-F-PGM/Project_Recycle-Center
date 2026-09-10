package database_test

import (
	"testing"
	"time"

	"github.com/SA-1-69/T20/backend/internal/migrations"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/seed"
	"gorm.io/gorm"
)

func TestDemoSeedPreservesExistingRecords(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	// Reuse the material type even if its generated ID differs between machines.
	execSQL(t, db, `INSERT INTO material_types (type_id, type_name) VALUES (41, 'Demo recyclable materials')`)
	if err := seed.Run(db); err != nil {
		t.Fatal(err)
	}
	execSQL(t, db, `UPDATE trucks SET capacity = 3200, status = 'maintenance' WHERE truck_id = 'DEMO-TR001'`)
	execSQL(t, db, `UPDATE users SET name = 'Edited name' WHERE user_id = 'DEMO-USER-SALES'`)
	execSQL(t, db, `UPDATE factories SET address = 'Edited address' WHERE factory_id = 'DEMO-F001'`)
	execSQL(t, db, `UPDATE sales_staff SET hire_date = '2020-01-02' WHERE employee_id = 'DEMO-S001'`)
	for i := 0; i < 2; i++ {
		if err := seed.Run(db); err != nil {
			t.Fatal(err)
		}
	}
	for table, want := range map[string]int64{
		"users": 9, "sales_staff": 1, "transport_supervisors": 1, "drivers": 1,
		"warehouse_staffs": 1, "purchasing_staff": 1, "customer_service_officers": 1, "managers": 2, "sellers": 1, "registration_forms": 1,
		"factories": 1, "material_types": 1, "materials": 2, "trucks": 1,
		"warehouses": 1, "storage_zones": 2,
		"purchase_orders": 0, "delivery_requests": 0,
	} {
		expectSeedRowCount(t, db, table, want)
	}
	var truck models.Truck
	if err := db.First(&truck, "truck_id = ?", "DEMO-TR001").Error; err != nil {
		t.Fatal(err)
	}
	if truck.Capacity != 3200 || truck.Status != "maintenance" {
		t.Fatalf("seed overwrote edited truck: %+v", truck)
	}
	var staff models.SalesStaff
	if err := db.Preload("User").First(&staff, "employee_id = ?", "DEMO-S001").Error; err != nil {
		t.Fatal(err)
	}
	if staff.User == nil || staff.User.Name != "Edited name" || staff.HireDate.Format(time.DateOnly) != "2020-01-02" {
		t.Fatal("seed overwrote edited employee data or lost the user relationship")
	}
	var factory models.Factory
	if err := db.First(&factory, "factory_id = ?", "DEMO-F001").Error; err != nil {
		t.Fatal(err)
	}
	if factory.Address != "Edited address" {
		t.Fatal("seed overwrote edited factory address")
	}
	var materials []models.Material
	if err := db.Find(&materials).Error; err != nil {
		t.Fatal(err)
	}
	for _, material := range materials {
		if material.MaterialTypeID != 41 {
			t.Fatal("seed failed to reuse the existing material type")
		}
	}
}

func TestDemoSeedRollsBackOnConflictingLicensePlate(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	execSQL(t, db, `INSERT INTO trucks (truck_id, license_plate, status, capacity)
		VALUES ('existing-truck', 'DEMO-TRUCK-001', 'maintenance', 1000)`)
	if err := seed.Run(db); err == nil {
		t.Fatal("expected an error for a license plate owned by another truck")
	}
	for _, table := range []string{"users", "sales_staff", "transport_supervisors", "drivers", "warehouse_staffs", "purchasing_staff", "customer_service_officers", "managers", "sellers", "registration_forms", "factories", "material_types", "materials", "warehouses", "storage_zones"} {
		expectSeedRowCount(t, db, table, 0)
	}
	expectSeedRowCount(t, db, "trucks", 1)
	var truck models.Truck
	if err := db.First(&truck, "truck_id = ?", "existing-truck").Error; err != nil {
		t.Fatal(err)
	}
	if truck.Status != "maintenance" || truck.Capacity != 1000 {
		t.Fatal("seed changed the existing truck after a conflict")
	}
}

func expectSeedRowCount(t *testing.T, db *gorm.DB, table string, want int64) {
	t.Helper()
	var count int64
	if err := db.Table(table).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != want {
		t.Fatalf("%s: expected %d rows, got %d", table, want, count)
	}
}
