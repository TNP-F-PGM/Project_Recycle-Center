package models

import "time"

// One assignment per request retains the truck/driver history after completion.
// Truck.RequestID tracks only the current active job and is cleared on release.
type DeliveryAssignment struct {
	RequestID  string    `gorm:"column:request_id;primaryKey"`
	TruckID    string    `gorm:"column:truck_id;not null;index"`
	DriverID   string    `gorm:"column:driver_id;not null;index"`
	AssignedAt time.Time `gorm:"column:assigned_at;not null"`

	DeliveryRequest *DeliveryRequest `gorm:"belongsTo;foreignKey:RequestID;references:RequestID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
	Truck           *Truck           `gorm:"belongsTo;foreignKey:TruckID;references:TruckID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
	Driver          *Driver          `gorm:"belongsTo;foreignKey:DriverID;references:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
}

func (DeliveryAssignment) TableName() string { return "delivery_assignments" }
