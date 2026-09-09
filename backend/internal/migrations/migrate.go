// Package migrations creates and updates the database schema from GORM entities.
package migrations

import (
	"fmt"

	"github.com/SA-1-69/T20/backend/internal/codes"
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
		if err := migrateLegacySalesContracts(tx); err != nil {
			return err
		}
		// The former scrap_sales_to_factory table duplicated purchase_orders.
		// Remove it only when it has no business records, and keep OrderID as the
		// single complaint reference used throughout the application.
		if tx.Migrator().HasTable("complaints") {
			if err := tx.Exec("ALTER TABLE complaints DROP COLUMN IF EXISTS sale_id").Error; err != nil {
				return fmt.Errorf("remove duplicate complaint sale reference: %w", err)
			}
		}
		if tx.Migrator().HasTable("scrap_sales_to_factory") {
			var count int64
			if err := tx.Table("scrap_sales_to_factory").Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return fmt.Errorf("cannot remove duplicate scrap_sales_to_factory table: it contains %d records", count)
			}
			if err := tx.Migrator().DropTable("scrap_sales_to_factory"); err != nil {
				return fmt.Errorf("remove duplicate scrap sales table: %w", err)
			}
		}
		// Create role and seller parent tables first. GORM may otherwise reorder
		// the larger association graph and try to add a foreign key too early.
		if err := tx.AutoMigrate(&models.User{}); err != nil {
			return fmt.Errorf("auto migrate users: %w", err)
		}
		if err := tx.AutoMigrate(&models.PurchasingStaff{}, &models.CustomerServiceOfficer{}, &models.Manager{}); err != nil {
			return fmt.Errorf("auto migrate staff roles: %w", err)
		}
		if err := tx.AutoMigrate(&models.Seller{}); err != nil {
			return fmt.Errorf("auto migrate sellers: %w", err)
		}

		entities := []any{
			// บัญชีผู้ใช้และบทบาทพนักงาน
			&models.Driver{},
			&models.TransportSupervisor{},
			&models.SalesStaff{},

			// วัสดุและโรงงาน
			&models.MaterialType{},
			&models.Material{},
			&models.Factory{},
			&models.SalesContract{},
			&models.SalesContractMaterial{},
			&models.ContractRevision{},

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

			// ผู้ขาย การประเมิน และคลังวัสดุ
			&models.RegistrationForm{},
			&models.WarehouseStaff{},
			&models.Warehouse{},
			&models.StorageZone{},
			&models.AssessmentBatch{},
			&models.QualityAssessment{},
			&models.ScrapPurchaseItem{},
			&models.PendingWarehouseItem{},
			&models.StockTransaction{},
			&models.ReceiveTransaction{},
			&models.IssueTransaction{},
			&models.StockAdjustmentRequest{},
			&models.AdjustmentApproval{},

			// คำร้องเรียนและการรับคืน
			&models.Complaint{},
			&models.ComplaintAudit{},
			&models.ReturnRecord{},

			// การเงินและราคา
			&models.FinanceOfficer{},
			&models.PaymentMethod{},
			&models.FinancialReport{},
			&models.Invoice{},
			&models.Receipt{},
			&models.Payment{},
			&models.PaymentEvidence{},
			&models.OutstandingDebt{},
			&models.Finance{},
			&models.PurchaseItem{},
			&models.PurchasePrice{},
			&models.PriceNotification{},

			// เลขเอกสารและการป้องกันคำขอซ้ำ
			&codes.DocumentCounter{},
			&codes.DocumentWriteRequest{},
		}
		if err := tx.AutoMigrate(entities...); err != nil {
			return fmt.Errorf("auto migrate schema: %w", err)
		}
		for _, statement := range []string{
			"ALTER TABLE registration_forms DROP CONSTRAINT IF EXISTS fk_registration_forms_seller",
			"ALTER TABLE registration_forms ADD CONSTRAINT fk_registration_forms_seller FOREIGN KEY (seller_code) REFERENCES sellers(seller_code) ON UPDATE CASCADE ON DELETE CASCADE",
			"ALTER TABLE registration_forms DROP CONSTRAINT IF EXISTS fk_registration_forms_purchasing_staff",
			"ALTER TABLE registration_forms ADD CONSTRAINT fk_registration_forms_purchasing_staff FOREIGN KEY (purchasing_staff_id) REFERENCES purchasing_staff(purchasing_staff_id) ON UPDATE CASCADE ON DELETE SET NULL",
		} {
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("migrate registration form relationship: %w", err)
			}
		}
		// AutoMigrate does not replace an existing CHECK constraint when new
		// employee roles are introduced.
		if err := tx.Exec("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role").Error; err != nil {
			return err
		}
		if err := tx.Exec(`ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('sales','transport_supervisor','driver','manager','warehouse_staff','purchasing_staff','customer_service','finance','seller'))`).Error; err != nil {
			return err
		}

		if legacyFactories {
			// All links have been transferred and the new foreign key is in place.
			return tx.Exec("DROP TABLE purchase_order_suppliers").Error
		}
		return nil
	})
}
