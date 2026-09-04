package models

type Truck struct {
	TruckID      string  `gorm:"column:truck_id;primaryKey"`
	LicensePlate string  `gorm:"column:license_plate;not null;uniqueIndex"`
	Status       string  `gorm:"column:status;not null"`
	Capacity     float64 `gorm:"column:capacity;not null"`

	RequestID *string `gorm:"column:request_id;uniqueIndex"`
	DriverID  *string `gorm:"column:driver_id;index:idx_trucks_active_driver,unique,where:request_id IS NOT NULL AND driver_id IS NOT NULL"`

	Driver *Driver `gorm:"belongsTo;foreignKey:DriverID;references:EmployeeID"`

	DeliveryRequest *DeliveryRequest `gorm:"belongsTo;foreignKey:RequestID;references:RequestID"`
}

func (Truck) TableName() string {
	return "trucks"
}
