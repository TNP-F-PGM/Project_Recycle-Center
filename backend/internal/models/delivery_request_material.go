package models

type DeliveryRequestMaterial struct {
	RequestID  string `gorm:"column:request_id;primaryKey"`
	MaterialID string `gorm:"column:material_id;primaryKey"`

	DeliveryQuantity float64 `gorm:"type:numeric(14,3);not null;check:delivery_quantity > 0"`

	DeliveryRequest DeliveryRequest `gorm:"belongsTo;foreignKey:RequestID;references:RequestID"`
	Material        Material        `gorm:"belongsTo;foreignKey:MaterialID;references:MaterialID"`
}

func (DeliveryRequestMaterial) TableName() string {
	return "delivery_request_materials"
}
