package models

import "time"

type TransportSupervisor struct {
	EmployeeID string    `json:"employee_id" gorm:"primaryKey"`
	UserID     string    `json:"user_id" gorm:"not null;uniqueIndex"`
	Position   string    `json:"position" gorm:"not null"`
	HireDate   time.Time `json:"hire_date" gorm:"not null"`
	User       *User     `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (TransportSupervisor) TableName() string {
	return "transport_supervisors"
}
