package models

import "time"

type ComplaintAudit struct {
	ID                uint             `json:"id" gorm:"primaryKey"`
	ComplaintID       string           `json:"complaint_id" gorm:"not null;index"`
	CreatedBy         string           `json:"created_by" gorm:"not null;index"`
	CreatedAction     string           `json:"created_action" gorm:"not null"`
	CreatedAt         time.Time        `json:"created_at" gorm:"not null;index"`
	ReviewedBy        *string          `json:"reviewed_by,omitempty" gorm:"index"`
	ReviewedAt        *time.Time       `json:"reviewed_at,omitempty"`
	ReviewAction      *string          `json:"review_action,omitempty"`
	ReviewFromStatus  *ComplaintStatus `json:"review_from_status,omitempty"`
	ReviewToStatus    *ComplaintStatus `json:"review_to_status,omitempty"`
	ReviewStatusLabel *string          `json:"review_status_label,omitempty"`
	ReviewReason      *string          `json:"review_reason,omitempty"`
}

func (ComplaintAudit) TableName() string { return "complaint_audits" }
