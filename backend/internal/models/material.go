package models

// Material is a recyclable material accepted by the system.
type Material struct {
	MaterialID     string  `gorm:"column:material_id;type:varchar;primaryKey" json:"materialID"`
	MaterialName   string  `gorm:"column:material_name;type:varchar;not null" json:"materialName"`
	Unit           string  `gorm:"column:unit;type:varchar;not null" json:"unit"`
	Status         string  `gorm:"column:status;type:varchar;not null" json:"status"`
	MinStockLevel  float64 `gorm:"column:min_stock_level;type:double precision;not null" json:"minStockLevel"`
	Grade          string  `gorm:"column:grade;type:text;not null" json:"grade"`
	MaterialTypeID int     `gorm:"column:material_type_id;type:integer;not null;index" json:"materialTypeID"`

	MaterialType *MaterialType `gorm:"foreignKey:MaterialTypeID;references:TypeID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"materialType,omitempty"`
	StorageZones []StorageZone `gorm:"foreignKey:MaterialID;references:MaterialID" json:"storageZones,omitempty"`
}
