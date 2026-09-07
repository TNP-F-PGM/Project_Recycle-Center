package models

import "time"

// AdjustmentApproval stores the one-time decision for a stock adjustment request.
type AdjustmentApproval struct {
	ApprovalID       int                     `gorm:"column:approval_id;type:integer;primaryKey;autoIncrement" json:"approvalID"`
	Decision         string                  `gorm:"column:decision;type:text;not null" json:"decision"`
	ApprovedQuantity *float64                `gorm:"column:approved_quantity;type:double precision" json:"approvedQuantity"`
	DecisionReason   *string                 `gorm:"column:decision_reason;type:text" json:"decisionReason"`
	ApprovedAt       time.Time               `gorm:"column:approved_at;type:timestamptz;not null" json:"approvedAt"`
	RequestNo        int                     `gorm:"column:request_no;type:integer;not null;uniqueIndex" json:"requestNo"`
	EmployeeID       string                  `gorm:"column:employee_id;type:text;not null;index" json:"employeeID"`
	Request          *StockAdjustmentRequest `gorm:"foreignKey:RequestNo;references:RequestNo;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"request,omitempty"`
	Employee         *User                   `gorm:"foreignKey:EmployeeID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"employee,omitempty"`
}