package dto

import (
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
)

type RegisterSellerRequest struct {
	SellerCode        string   `json:"seller_code"`
	UserID            string   `json:"user_id"`
	RegistrationID    string   `json:"registration_id"`
	NationalID        string   `json:"national_id"`
	PurchasingStaffID string   `json:"purchasing_staff_id"`
	Email             string   `json:"email"`
	Password          string   `json:"password"`
	Address           string   `json:"address"`
	Name              string   `json:"name"`
	Phone             string   `json:"phone"`
	SellerType        string   `json:"seller_type"`
	IdentityDocuments []string `json:"identity_documents"`
}

type UpdateSellerStatusRequest struct {
	Status          models.AccountStatus `json:"status"`
	SuspendedReason string               `json:"suspended_reason"`
}

type SellerListItem struct {
	SellerCode             string               `json:"seller_code"`
	NationalID             string               `json:"national_id"`
	UserID                 string               `json:"user_id"`
	Name                   string               `json:"name"`
	Phone                  string               `json:"phone"`
	Email                  string               `json:"email"`
	Address                string               `json:"address"`
	SellerType             string               `json:"seller_type"`
	AccountStatus          models.AccountStatus `json:"account_status"`
	SuspendedReason        string               `json:"suspended_reason"`
	SuspendedAt            *time.Time           `json:"suspended_at,omitempty"`
	RegistrationDate       time.Time            `json:"registration_date"`
	IdentityDocuments      []string             `json:"identity_documents"`
	PurchasingStaffID      *string              `json:"purchasing_staff_id,omitempty"`
	RegistrationFormStatus string               `json:"registration_form_status,omitempty"`
}

type RegisterSellerResponse struct {
	Seller           *models.Seller           `json:"seller"`
	RegistrationForm *models.RegistrationForm `json:"registration_form"`
}
