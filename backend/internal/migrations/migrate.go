// Package migrations creates and updates the database schema from GORM entities.
package migrations

import (
	"github.com/SA-1-69/T20/backend/internal/models"
	"gorm.io/gorm"
)

// Run applies all schema changes in one transaction. Register new entities in
// AutoMigrate below, placing parent tables before tables that reference them.
func Run(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		legacyFactories := tx.Migrator().HasTable("purchase_order_suppliers")
		if legacyFactories {
			if err := migratePurchaseOrderFactory(tx); err != nil {
				return err
			}
		}
		if err := migrateDeliveryRequestOrder(tx); err != nil {
			return err
		}

		if err := tx.AutoMigrate(
			// บัญชีผู้ใช้และบทบาทพนักงาน
			&models.User{},
			&models.Driver{},
			&models.TransportSupervisor{},
			&models.SalesStaff{},

			// วัสดุและโรงงาน
			&models.MaterialType{},
			&models.Material{},
			&models.Factory{},

			// คำขอซื้อ: สร้างก่อนคำขอจัดส่งที่อ้างอิง OrderID
			&models.PurchaseOrder{},
			&models.PurchaseOrderMaterial{},

			// การจัดส่ง รถ และการยกเลิก
			&models.DeliveryRequest{},
			&models.Truck{},
			&models.DeliveryRequestMaterial{},
			&models.CancelRequest{},
			&models.DeliveryAssignment{},
			&models.DeliveryIncident{},
		); err != nil {
			return err
		}

		if legacyFactories {
			// All links have been transferred and the new foreign key is in place.
			return tx.Exec("DROP TABLE purchase_order_suppliers").Error
		}
		return nil
	})
}
