package models

type PurchaseOrderMaterial struct {
	OrderID    string `gorm:"column:order_id;primaryKey"`
	MaterialID string `gorm:"column:material_id;primaryKey"`

	RequestedQuantity float64 `gorm:"type:numeric(14,3);not null;check:requested_quantity > 0"`

	PurchaseOrder *PurchaseOrder `gorm:"belongsTo;foreignKey:OrderID;references:OrderID"`
	Material      *Material      `gorm:"belongsTo;foreignKey:MaterialID;references:MaterialID"`
}

func (PurchaseOrderMaterial) TableName() string {
	return "purchase_order_materials"
}
