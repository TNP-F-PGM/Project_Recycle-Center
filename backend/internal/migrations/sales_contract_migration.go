package migrations

import (
	"fmt"

	"gorm.io/gorm"
)

// migrateLegacySalesContracts removes the unused first draft of the contract
// table. Rows are never deleted automatically because its material_type text
// cannot be mapped safely to a material_id without user input.
func migrateLegacySalesContracts(tx *gorm.DB) error {
	if !tx.Migrator().HasTable("sales_contracts") || !tx.Migrator().HasColumn("sales_contracts", "material_type") {
		return nil
	}
	var count int64
	if err := tx.Table("sales_contracts").Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("legacy sales_contracts contains %d row(s); map material_type to material_id before migrating", count)
	}
	return tx.Migrator().DropTable("sales_contracts")
}
