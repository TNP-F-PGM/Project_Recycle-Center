package models

import "time"

// Warehouse stores the overall stock summary for a warehouse.
type Warehouse struct {
	WarehouseID     string        `gorm:"column:warehouse_id;type:text;primaryKey" json:"warehouseID"`
	CurrentQuantity float64       `gorm:"column:current_quantity;type:double precision;not null;default:0" json:"currentQuantity"`
	TotalCapacity   float64       `gorm:"column:total_capacity;type:double precision;not null" json:"totalCapacity"`
	LastUpdated     time.Time     `gorm:"column:last_updated;type:date;not null" json:"lastUpdated"`
	MinStock        float64       `gorm:"column:min_stock;type:double precision;not null" json:"minStock"`
	Unit            string        `gorm:"column:unit;type:text;not null" json:"unit"`
	StorageZones    []StorageZone `gorm:"foreignKey:WarehouseID;references:WarehouseID" json:"storageZones,omitempty"`
}