package models

import "time"

// StorageZone records where one material is stored inside a warehouse.
type StorageZone struct {
	ZoneID          string                   `gorm:"column:zone_id;type:text;primaryKey" json:"zoneID"`
	ZoneName        string                   `gorm:"column:zone_name;type:text;not null" json:"zoneName"`
	Capacity        float64                  `gorm:"column:capacity;type:double precision;not null" json:"capacity"`
	SupportedGrade  string                   `gorm:"column:supported_grade;type:text;not null;index:idx_storage_zones_material_grade,priority:2" json:"supportedGrade"`
	LastUpdated     time.Time                `gorm:"column:last_updated;type:timestamptz;not null" json:"lastUpdated"`
	StockStatus     string                   `gorm:"column:stock_status;type:text;not null" json:"stockStatus"`
	QuantityOnHand  float64                  `gorm:"column:quantity_on_hand;type:double precision;not null;default:0" json:"quantityOnHand"`
	WarehouseID     string                   `gorm:"column:warehouse_id;type:text;not null;index" json:"warehouseID"`
	MaterialTypeID  int                      `gorm:"column:material_type_id;type:integer;not null;index" json:"materialTypeID"`
	MaterialID      string                   `gorm:"column:material_id;type:varchar;not null;index;index:idx_storage_zones_material_grade,priority:1" json:"materialID"`
	Warehouse       *Warehouse               `gorm:"foreignKey:WarehouseID;references:WarehouseID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"warehouse,omitempty"`
	MaterialType    *MaterialType            `gorm:"foreignKey:MaterialTypeID;references:TypeID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"materialType,omitempty"`
	Material        *Material                `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	Transactions    []StockTransaction       `gorm:"foreignKey:ZoneID;references:ZoneID" json:"transactions,omitempty"`
	AdjustmentItems []StockAdjustmentRequest `gorm:"foreignKey:ZoneID;references:ZoneID" json:"adjustmentRequests,omitempty"`
}