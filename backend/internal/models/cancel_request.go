package models

import "time"

type CancelRequest struct {
	CancelID         string    `gorm:"column:cancel_id;primaryKey"`
	TruckID          *string   `gorm:"column:truck_id"`
	CancelDate       time.Time `gorm:"column:cancel_date;type:date"`
	RequestID        string    `gorm:"column:request_id;not null;uniqueIndex"`
	Reason           string
	SupervisorID     *string
	MaterialsSecured bool `gorm:"not null;default:false"`

	Truck *Truck `gorm:"belongsTo;foreignKey:TruckID;references:TruckID"`

	DeliveryRequest *DeliveryRequest `gorm:"belongsTo;foreignKey:RequestID;references:RequestID"`
}

func (CancelRequest) TableName() string {
	return "cancel_requests"
}
