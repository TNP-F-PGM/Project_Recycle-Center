package models

import "time"

type AccountStatus string

const (
	AccountStatusActive    AccountStatus = "active"
	AccountStatusSuspended AccountStatus = "suspended"
)

type Seller struct {
	NationalID       string        `json:"national_id" gorm:"uniqueIndex;not null;check:national_id ~ '^[0-9]{13}$'"`
	SellerCode       string        `json:"seller_code" gorm:"primaryKey"`
	SellerType       string        `json:"seller_type" gorm:"not null;default:บุคคล;index"`
	UserID           string        `json:"user_id" gorm:"not null;uniqueIndex"`
	Address          string        `json:"address" gorm:"not null"`
	AccountStatus    AccountStatus `json:"account_status" gorm:"not null;default:active;check:account_status IN ('active','suspended')"`
	SuspendedReason  string        `json:"suspended_reason"`
	SuspendedAt      *time.Time    `json:"suspended_at,omitempty"`
	RegistrationDate time.Time     `json:"registration_date" gorm:"not null"`
	User             *User         `json:"-" gorm:"belongsTo;foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (Seller) TableName() string { return "sellers" }
