package models

type DeliveryRequestMaterial struct {
	RequestID  string `gorm:"column:request_id;primaryKey"`
	MaterialID string `gorm:"column:material_id;primaryKey"`

	DeliveryQuantity int `gorm:"column:delivery_quantity;not null;check:delivery_quantity > 0"`

	DeliveryRequest DeliveryRequest `gorm:"belongsTo;foreignKey:RequestID;references:RequestID"`
	Material        Material        `gorm:"belongsTo;foreignKey:MaterialID;references:MaterialID"`
}

func (DeliveryRequestMaterial) TableName() string {
	return "delivery_request_materials"
}
