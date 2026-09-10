package models

import "time"

type RegistrationForm struct {
	RegistrationID    string    `json:"registration_id" gorm:"primaryKey"`
	SellerCode        string    `json:"seller_code" gorm:"not null;uniqueIndex"`
	NationalID        string    `json:"national_id" gorm:"not null;index"`
	RegistrationDate  time.Time `json:"registration_date" gorm:"not null"`
	IdentityDocuments []string  `json:"identity_documents" gorm:"type:text;serializer:json"`
	Status            string    `json:"status" gorm:"not null;default:active;check:status IN ('pending','active','suspended','rejected')"`
	PurchasingStaffID *string   `json:"purchasing_staff_id,omitempty" gorm:"index"`
}

func (RegistrationForm) TableName() string { return "registration_forms" }
