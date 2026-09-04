package migrations

import (
	"fmt"

	"gorm.io/gorm"
)

// Existing delivery requests need an explicit order mapping. Request IDs and
// customer details are not reliable ways to infer their source purchase order.
// This runs inside Run's transaction, including the schema changes.
func migrateDeliveryRequestOrder(tx *gorm.DB) error {
	if !tx.Migrator().HasTable("delivery_requests") {
		return nil
	}
	if err := tx.Exec("LOCK TABLE delivery_requests IN ACCESS EXCLUSIVE MODE").Error; err != nil {
		return err
	}
	if err := tx.Exec("ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS order_id text").Error; err != nil {
		return err
	}

	var unlinked int64
	if err := tx.Table("delivery_requests").Where("order_id IS NULL OR BTRIM(order_id) = ''").Count(&unlinked).Error; err != nil {
		return err
	}
	if unlinked > 0 {
		return fmt.Errorf("cannot migrate %d delivery requests: add a nullable delivery_requests.order_id column if missing and link each existing request to its actual purchase order before retrying", unlinked)
	}

	// Tighten a manually backfilled nullable column; AutoMigrate adds the FK.
	return tx.Exec("ALTER TABLE delivery_requests ALTER COLUMN order_id SET NOT NULL").Error
}
