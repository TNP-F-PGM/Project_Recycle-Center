package models

import "time"

type ComplaintStatus string

const (
	ComplaintStatusPending  ComplaintStatus = "pending"
	ComplaintStatusApproved ComplaintStatus = "approved"
	ComplaintStatusRejected ComplaintStatus = "rejected"
)

// Complaint keeps the order-based API already used by RecycleHub and also
// accepts an optional sale reference for the sales module supplied by Ping.
type Complaint struct {
	ComplaintID        string          `json:"complaint_id" gorm:"type:varchar(50);primaryKey"`
	ComplaintDate      time.Time       `json:"complaint_date" gorm:"not null;index"`
	ProblemDescription string          `json:"problem_description" gorm:"not null"`
	EvidenceFile       string          `json:"evidence_file"`
	EvidenceFiles      []string        `json:"evidence_files,omitempty" gorm:"type:text;serializer:json"`
	Status             ComplaintStatus `json:"status" gorm:"not null;default:pending;index;check:complaint_status_valid,status IN ('pending','approved','rejected')"`
	Result             *string         `json:"result,omitempty"`
	RejectionReason    *string         `json:"rejection_reason,omitempty"`
	ReviewedBy         *string         `json:"reviewed_by,omitempty" gorm:"index"`
	ReviewedAt         *time.Time      `json:"reviewed_at,omitempty"`
	OrderID            string          `json:"order_id" gorm:"index"`
	FactoryID          *string         `json:"factory_id,omitempty" gorm:"index"`
	EmployeeID         *string         `json:"employee_id,omitempty" gorm:"index"`

	PurchaseOrder *PurchaseOrder   `json:"purchase_order,omitempty" gorm:"belongsTo;foreignKey:OrderID;references:OrderID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
	Factory       *Factory         `json:"factory,omitempty" gorm:"belongsTo;foreignKey:FactoryID;references:FactoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
	AuditTrail    []ComplaintAudit `json:"audit_trail,omitempty" gorm:"foreignKey:ComplaintID;references:ComplaintID"`
}

func (Complaint) TableName() string { return "complaints" }
