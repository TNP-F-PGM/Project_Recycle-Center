package models

import "time"

type PurchasingStaff struct {
	PurchasingStaffID string    `json:"purchasing_staff_id" gorm:"primaryKey"`
	UserID            string    `json:"user_id" gorm:"not null;uniqueIndex"`
	Position          string    `json:"position" gorm:"not null"`
	HireDate          time.Time `json:"hire_date" gorm:"not null"`
	User              *User     `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (PurchasingStaff) TableName() string { return "purchasing_staff" }

type CustomerServiceOfficer struct {
	EmployeeID string `json:"employee_id" gorm:"primaryKey"`
	UserID     string `json:"user_id" gorm:"not null;uniqueIndex"`
	Position   string `json:"position" gorm:"not null"`
	ShiftTime  string `json:"shift_time" gorm:"not null"`
	User       *User  `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (CustomerServiceOfficer) TableName() string { return "customer_service_officers" }

type Manager struct {
	ManagerID string `json:"manager_id" gorm:"primaryKey"`
	UserID    string `json:"user_id" gorm:"not null;uniqueIndex"`
	Position  string `json:"position" gorm:"not null"`
	User      *User  `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (Manager) TableName() string { return "managers" }
