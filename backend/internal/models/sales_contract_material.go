package models

// SalesContractMaterial stores the agreed quantity and price for one material.
type SalesContractMaterial struct {
	ContractID            string  `gorm:"column:contract_id;type:varchar;primaryKey" json:"contract_id"`
	MaterialID            string  `gorm:"column:material_id;type:varchar;primaryKey" json:"material_id"`
	ContractQuantity      float64 `gorm:"column:contract_quantity;type:numeric(14,3);not null;check:contract_quantity_positive,contract_quantity > 0" json:"contract_quantity"`
	UnitPrice             float64 `gorm:"column:unit_price;type:numeric(12,2);not null;check:contract_unit_price_nonnegative,unit_price >= 0" json:"unit_price"`
	VolumeDiscountPercent float64 `gorm:"column:volume_discount_percent;type:numeric(5,2);not null;default:0;check:contract_discount_valid,volume_discount_percent >= 0 AND volume_discount_percent <= 100" json:"volume_discount_percent"`

	Contract *SalesContract `gorm:"belongsTo;foreignKey:ContractID;references:ContractID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
	Material *Material      `gorm:"belongsTo;foreignKey:MaterialID;references:MaterialID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
}

func (SalesContractMaterial) TableName() string { return "sales_contract_materials" }
