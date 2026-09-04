package models

import "time"

type PurchaseOrder struct {
	OrderID   string `gorm:"column:order_id;primaryKey"`
	FactoryID string `gorm:"column:factory_id;not null;index"`
	// SalesStaffID identifies the employee who created the factory's order.
	SalesStaffID string    `gorm:"column:sales_staff_id;not null"`
	OrderDate    time.Time `gorm:"column:order_date;type:date"`
	Status       string    `gorm:"column:status;not null"`

	SalesStaff *SalesStaff `gorm:"belongsTo;foreignKey:SalesStaffID;references:EmployeeID"`
	Factory    *Factory    `gorm:"belongsTo;foreignKey:FactoryID;references:FactoryID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`

	Materials []PurchaseOrderMaterial `gorm:"foreignKey:OrderID"`
}

func (PurchaseOrder) TableName() string {
	return "purchase_orders"
}
