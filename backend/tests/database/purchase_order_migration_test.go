package database_test

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/SA-1-69/T20/backend/internal/config"
	"github.com/SA-1-69/T20/backend/internal/migrations"
	"github.com/SA-1-69/T20/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Every test creates its own schema inside a transaction and rolls it back.
// No application tables or records are modified by these integration tests.
func isolatedDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	if err := config.LoadEnv("../../.env"); err != nil {
		t.Fatal(err)
	}
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pool.Close() })
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	t.Cleanup(func() { tx.Rollback() })
	schemaName := fmt.Sprintf("test_purchase_orders_%d", time.Now().UnixNano())
	execSQL(t, tx, "CREATE SCHEMA "+schemaName)
	execSQL(t, tx, "SET LOCAL search_path TO "+schemaName)
	return tx
}

func execSQL(t *testing.T, db *gorm.DB, query string) {
	t.Helper()
	if err := db.Exec(query).Error; err != nil {
		t.Fatal(err)
	}
}

func seedOrderParents(t *testing.T, db *gorm.DB) {
	t.Helper()
	execSQL(t, db, `
		INSERT INTO users (user_id, name, phone, email, password, role)
		VALUES ('u1', 'Sales', '000', 'sales@example.test', 'unused-test-value', 'sales');
		INSERT INTO sales_staff (employee_id, user_id, position, hire_date)
		VALUES ('e1', 'u1', 'sales', CURRENT_DATE);
		INSERT INTO factories (factory_id, company_name, contact_person, phone, address)
		VALUES ('f1', 'Factory One', 'Contact', '000', 'Address'),
		       ('f2', 'Factory Two', 'Contact', '000', 'Address');
		INSERT INTO material_types (type_id, type_name) VALUES (1, 'Metal');
		INSERT INTO materials (material_id, material_name, unit, status, min_stock_level, grade, material_type_id)
		VALUES ('m1', 'Steel', 'kg', 'active', 0, 'A', 1),
		       ('m2', 'Aluminium', 'kg', 'active', 0, 'A', 1);
	`)
}

func expectSQLState(t *testing.T, db *gorm.DB, query, state string) {
	t.Helper()
	err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(query).Error })
	var postgresError interface{ SQLState() string }
	if !errors.As(err, &postgresError) || postgresError.SQLState() != state {
		t.Fatalf("expected PostgreSQL error %s, got %v", state, err)
	}
}

func assertOrder(t *testing.T, db *gorm.DB) {
	t.Helper()
	var order models.PurchaseOrder
	if err := db.Preload("Factory").Preload("SalesStaff").Preload("Materials").
		First(&order, "order_id = ?", "o1").Error; err != nil {
		t.Fatal(err)
	}
	if order.FactoryID != "f1" || order.Factory == nil || order.Factory.FactoryID != "f1" {
		t.Fatalf("order factory was not preserved: %+v", order)
	}
	if order.SalesStaffID != "e1" || order.SalesStaff == nil || order.SalesStaff.EmployeeID != "e1" {
		t.Fatalf("order creator was not preserved: %+v", order)
	}
	if len(order.Materials) != 2 {
		t.Fatalf("expected two material lines, got %d", len(order.Materials))
	}
	quantities := map[string]int{"m1": 10, "m2": 20}
	for _, material := range order.Materials {
		if material.RequestedQuantity != quantities[material.MaterialID] {
			t.Fatalf("material quantity was not preserved: %+v", material)
		}
	}
	if db.Migrator().HasTable("purchase_order_suppliers") {
		t.Fatal("obsolete factory junction table still exists")
	}
}

func TestPurchaseOrderHasOneFactoryAndMultipleMaterials(t *testing.T) {
	db := isolatedDatabase(t)
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	seedOrderParents(t, db)
	execSQL(t, db, `
		INSERT INTO purchase_orders (order_id, sales_staff_id, factory_id, status)
		VALUES ('o1', 'e1', 'f1', 'created'), ('o2', 'e1', 'f1', 'created');
		INSERT INTO purchase_order_materials (order_id, material_id, requested_quantity)
		VALUES ('o1', 'm1', 10), ('o1', 'm2', 20);
	`)
	assertOrder(t, db)
	expectSQLState(t, db, `INSERT INTO purchase_orders (order_id, sales_staff_id, status)
		VALUES ('missing-factory', 'e1', 'created')`, "23502")
	expectSQLState(t, db, `INSERT INTO purchase_orders (order_id, sales_staff_id, factory_id, status)
		VALUES ('unknown-factory', 'e1', 'unknown', 'created')`, "23503")
	expectSQLState(t, db, `DELETE FROM factories WHERE factory_id = 'f1'`, "23503")
	if err := migrations.Run(db); err != nil {
		t.Fatalf("repeated migration failed: %v", err)
	}
	assertOrder(t, db)
}

func legacyOrders(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	seedOrderParents(t, db)
	// Reconstruct the previous order/factory relationship before adding records.
	execSQL(t, db, `
		ALTER TABLE purchase_orders DROP COLUMN factory_id;
		CREATE TABLE purchase_order_suppliers (
			order_id text REFERENCES purchase_orders(order_id),
			factory_id text REFERENCES factories(factory_id),
			PRIMARY KEY (order_id, factory_id)
		);
		INSERT INTO purchase_orders (order_id, sales_staff_id, status)
		VALUES ('o1', 'e1', 'created');
		INSERT INTO purchase_order_materials (order_id, material_id, requested_quantity)
		VALUES ('o1', 'm1', 10), ('o1', 'm2', 20);
	`)
}

func TestMigrateLegacyPurchaseOrderPreservesData(t *testing.T) {
	db := isolatedDatabase(t)
	legacyOrders(t, db)
	execSQL(t, db, "INSERT INTO purchase_order_suppliers VALUES ('o1', 'f1')")
	if err := migrations.Run(db); err != nil {
		t.Fatal(err)
	}
	assertOrder(t, db)
	expectSQLState(t, db, "UPDATE purchase_orders SET factory_id = NULL WHERE order_id = 'o1'", "23502")
	expectSQLState(t, db, "UPDATE purchase_orders SET factory_id = 'unknown' WHERE order_id = 'o1'", "23503")
	if err := migrations.Run(db); err != nil {
		t.Fatalf("repeated migration failed: %v", err)
	}
	assertOrder(t, db)
}

func TestMigrateLegacyPurchaseOrderRejectsAmbiguousFactories(t *testing.T) {
	for _, count := range []int{0, 2} {
		t.Run(fmt.Sprintf("%d_factories", count), func(t *testing.T) {
			db := isolatedDatabase(t)
			legacyOrders(t, db)
			if count == 2 {
				execSQL(t, db, "INSERT INTO purchase_order_suppliers VALUES ('o1', 'f1'), ('o1', 'f2')")
			}
			err := migrations.Run(db)
			if err == nil || !strings.Contains(err.Error(), "resolve missing, multiple or conflicting") {
				t.Fatalf("expected actionable migration error, got %v", err)
			}
			if db.Migrator().HasColumn(&models.PurchaseOrder{}, "factory_id") {
				t.Fatal("failed migration did not roll back the added column")
			}
			var links int64
			if err := db.Table("purchase_order_suppliers").Count(&links).Error; err != nil {
				t.Fatal(err)
			}
			if links != int64(count) {
				t.Fatalf("failed migration changed legacy links: got %d, want %d", links, count)
			}
		})
	}
}
