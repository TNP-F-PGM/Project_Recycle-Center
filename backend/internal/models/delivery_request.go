package models

import "time"

type DeliveryRequest struct {
	RequestID    string    `gorm:"column:request_id;primaryKey"`
	OrderID      string    `gorm:"column:order_id;not null;uniqueIndex"`
	CustomerName string    `gorm:"column:customer_name;not null"`
	Address      string    `gorm:"column:address;not null"`
	PhoneNumber  string    `gorm:"column:phone_number"`
	RequestDate  time.Time `gorm:"column:request_date;type:date"`
	Status       string    `gorm:"column:status;not null"`

	SupervisorID *string `gorm:"column:supervisor_id"`

	// สำหรับ Map
	DestinationLatitude  float64 `gorm:"column:destination_latitude"`
	DestinationLongitude float64 `gorm:"column:destination_longitude"`
	// Distinguishes an explicitly supplied (0,0) from legacy unset coordinates.
	HasCoordinates bool `gorm:"not null;default:false"`

	Supervisor    *TransportSupervisor `gorm:"belongsTo;foreignKey:SupervisorID;references:UserID"`
	PurchaseOrder *PurchaseOrder       `gorm:"belongsTo;foreignKey:OrderID;references:OrderID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`

	Materials []DeliveryRequestMaterial `gorm:"foreignKey:RequestID"`
}

func (DeliveryRequest) TableName() string {
	return "delivery_requests"
}
