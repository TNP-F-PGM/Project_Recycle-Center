package models

import "time"

type Driver struct {
	EmployeeID    string     `json:"employee_id" gorm:"primaryKey"`
	UserID        string     `json:"user_id" gorm:"not null;uniqueIndex"`
	Position      string     `json:"position" gorm:"not null"`
	HireDate      time.Time  `json:"hire_date" gorm:"not null"`
	Status        string     `json:"status" gorm:"not null;default:active;check:driver_status_valid,status IN ('active','suspended','resigned')"`
	LicenseNumber *string    `json:"license_number" gorm:"uniqueIndex"`
	LicenseExpiry *time.Time `json:"license_expiry" gorm:"type:date"`
	User          *User      `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (Driver) TableName() string {
	return "drivers"
}
