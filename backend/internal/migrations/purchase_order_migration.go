package migrations

import (
	"fmt"

	"gorm.io/gorm"
)

// migratePurchaseOrderFactory runs inside Run's transaction. Orders
// with ambiguous factory links stop the migration instead of losing a link.
func migratePurchaseOrderFactory(tx *gorm.DB) error {
	if err := tx.Exec("LOCK TABLE purchase_orders, purchase_order_suppliers IN ACCESS EXCLUSIVE MODE").Error; err != nil {
		return err
	}
	if err := tx.Exec("ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS factory_id text").Error; err != nil {
		return err
	}

	var invalidOrders int64
	if err := tx.Raw(`
		SELECT COUNT(*)
		FROM purchase_orders AS orders
		LEFT JOIN (
			SELECT order_id, MIN(factory_id) AS factory_id, COUNT(*) AS factory_count
			FROM purchase_order_suppliers
			GROUP BY order_id
		) AS links ON links.order_id = orders.order_id
		WHERE (orders.factory_id IS NULL AND COALESCE(links.factory_count, 0) <> 1)
		   OR links.factory_count > 1
		   OR (orders.factory_id IS NOT NULL AND orders.factory_id <> links.factory_id)
	`).Scan(&invalidOrders).Error; err != nil {
		return err
	}
	if invalidOrders > 0 {
		return fmt.Errorf("cannot migrate %d purchase orders: resolve missing, multiple or conflicting factory links in purchase_order_suppliers first", invalidOrders)
	}

	// A manually edited database might contain links without a parent order.
	var orphanLinks int64
	if err := tx.Raw(`
		SELECT COUNT(*) FROM purchase_order_suppliers AS links
		LEFT JOIN purchase_orders AS orders ON orders.order_id = links.order_id
		WHERE orders.order_id IS NULL
	`).Scan(&orphanLinks).Error; err != nil {
		return err
	}
	if orphanLinks > 0 {
		return fmt.Errorf("cannot migrate %d factory links without a purchase order", orphanLinks)
	}

	if err := tx.Exec(`
		UPDATE purchase_orders AS orders
		SET factory_id = links.factory_id
		FROM purchase_order_suppliers AS links
		WHERE orders.order_id = links.order_id AND orders.factory_id IS NULL
	`).Error; err != nil {
		return err
	}
	// AutoMigrate does not reliably tighten an existing nullable column.
	return tx.Exec("ALTER TABLE purchase_orders ALTER COLUMN factory_id SET NOT NULL").Error
}
