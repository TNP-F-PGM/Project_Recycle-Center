package models

import "time"

type SalesStaff struct {
	EmployeeID string    `json:"employee_id" gorm:"primaryKey"`
	UserID     string    `json:"user_id" gorm:"not null;uniqueIndex"`
	Position   string    `json:"position" gorm:"not null"`
	HireDate   time.Time `json:"hire_date" gorm:"not null"`
	User       *User     `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (SalesStaff) TableName() string {
	return "sales_staff"
}
