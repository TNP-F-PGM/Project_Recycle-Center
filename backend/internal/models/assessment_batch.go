package models

import "time"

// AssessmentBatch groups one seller's results. Its creator assesses every item.
// SellerCode references the teammate-owned Seller model.
type AssessmentBatch struct {
	AssessmentBatchID string              `gorm:"column:assessment_batch_id;type:text;primaryKey" json:"assessmentBatchID"`
	SellerCode        string              `gorm:"column:seller_code;type:text;not null;index" json:"sellerCode"`
	Seller            *Seller             `gorm:"foreignKey:SellerCode;references:SellerCode;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
	EmployeeID        string              `gorm:"column:employee_id;type:text;not null;index" json:"employeeID"`
	AssessmentDate    time.Time           `gorm:"column:assessment_date;type:timestamptz;not null" json:"assessmentDate"`
	Status            string              `gorm:"column:status;type:text;not null" json:"status"`
	Employee          *User               `gorm:"foreignKey:EmployeeID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"employee,omitempty"`
	Assessments       []QualityAssessment `gorm:"foreignKey:AssessmentBatchID;references:AssessmentBatchID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"assessments"`
}