package models

import "time"

// ContractRevision stores one request to change an active contract.
// Original values remain as a snapshot for the before/after comparison.
type ContractRevision struct {
	RevisionID               string     `gorm:"column:revision_id;type:varchar;primaryKey" json:"revision_id"`
	ContractID               string     `gorm:"column:contract_id;type:varchar;not null;index" json:"contract_id"`
	RequestType              string     `gorm:"column:request_type;type:text;not null;check:contract_revision_type_valid,request_type IN ('renewal','price_change','discount_change','terms_change','mixed')" json:"request_type"`
	Reason                   string     `gorm:"column:reason;type:text;not null" json:"reason"`
	OriginalValidTo          time.Time  `gorm:"column:original_valid_to;type:date;not null" json:"original_valid_to"`
	NewValidTo               *time.Time `gorm:"column:new_valid_to;type:date" json:"new_valid_to"`
	OriginalTerms            string     `gorm:"column:original_terms;type:text;not null" json:"original_terms"`
	NewTerms                 *string    `gorm:"column:new_terms;type:text" json:"new_terms"`
	PriceAdjustmentPercent   *float64   `gorm:"column:price_adjustment_percent;type:numeric(6,2);check:contract_price_adjustment_valid,price_adjustment_percent > -100" json:"price_adjustment_percent"`
	NewVolumeDiscountPercent *float64   `gorm:"column:new_volume_discount_percent;type:numeric(5,2);check:contract_revision_discount_valid,new_volume_discount_percent >= 0 AND new_volume_discount_percent <= 100" json:"new_volume_discount_percent"`
	DraftDocument            *string    `gorm:"column:draft_document;type:text" json:"draft_document"`
	SignedDocument           *string    `gorm:"column:signed_document;type:text" json:"signed_document"`
	RequestStatus            string     `gorm:"column:request_status;type:text;not null;default:pending_review;check:contract_revision_status_valid,request_status IN ('pending_review','pending_signature','completed','rejected')" json:"request_status"`
	RequestedBy              string     `gorm:"column:requested_by;type:varchar;not null;index" json:"requested_by"`
	RequestedAt              time.Time  `gorm:"column:requested_at;type:timestamptz;not null" json:"requested_at"`
	ReviewedBy               *string    `gorm:"column:reviewed_by;type:varchar;index" json:"reviewed_by"`
	ReviewedAt               *time.Time `gorm:"column:reviewed_at;type:timestamptz" json:"reviewed_at"`
	ReviewNote               *string    `gorm:"column:review_note;type:text" json:"review_note"`

	Contract  *SalesContract `gorm:"belongsTo;foreignKey:ContractID;references:ContractID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
	Requester *SalesStaff    `gorm:"belongsTo;foreignKey:RequestedBy;references:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"requester,omitempty"`
	Reviewer  *User          `gorm:"belongsTo;foreignKey:ReviewedBy;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"reviewer,omitempty"`
}

func (ContractRevision) TableName() string { return "contract_revisions" }
