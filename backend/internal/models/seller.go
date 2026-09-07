package models

import "time"

// AccountStatus uses the values in the teammate's supplied PostgreSQL CHECK.
type AccountStatus string

// Seller is the teammate-owned model. No Seller controller is implemented here.
type Seller struct {
	SellerCode       string        `json:"seller_code" gorm:"primaryKey"`
	NationalID       string        `json:"national_id" gorm:"uniqueIndex;not null;check:national_id ~ '^[0-9]{13}$'"`
	SellerType       string        `json:"seller_type" gorm:"not null;default:บุคคล;index"`
	UserID           string        `json:"user_id" gorm:"not null;uniqueIndex"`
	Address          string        `json:"address" gorm:"not null"`
	AccountStatus    AccountStatus `json:"account_status" gorm:"not null;default:pending;check:account_status IN ('active','suspended','pending')"`
	RegistrationDate time.Time     `json:"registration_date" gorm:"not null"`
	User             *User         `json:"-" gorm:"foreignKey:UserID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}