package models

import "time"

// QualityAssessment stores a material quality assessment result.
type QualityAssessment struct {
	AssessmentID      int                `gorm:"column:assessment_id;type:integer;primaryKey;autoIncrement" json:"assessmentID"`
	AssessedGrade     string             `gorm:"column:assessed_grade;type:text;not null" json:"assessedGrade"`
	CleanlinessLevel  string             `gorm:"column:cleanliness_level;type:text;not null" json:"cleanlinessLevel"`
	Result            string             `gorm:"column:result;type:text;not null" json:"result"`
	Detail            *string            `gorm:"column:detail;type:text" json:"detail"`
	AssessedQuantity  float64            `gorm:"column:assessed_quantity;type:double precision;not null" json:"assessedQuantity"`
	AssessedAt        time.Time          `gorm:"column:assessed_at;type:timestamptz;not null" json:"assessedAt"`
	AssessmentBatchID string             `gorm:"column:assessment_batch_id;type:text;not null;index" json:"assessmentBatchID"`
	MaterialID        string             `gorm:"column:material_id;type:varchar;not null;index" json:"materialID"`
	AssessmentBatch   *AssessmentBatch   `gorm:"foreignKey:AssessmentBatchID;references:AssessmentBatchID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"assessmentBatch,omitempty"`
	Material          *Material          `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	ScrapPurchase     *ScrapPurchaseItem `gorm:"foreignKey:AssessmentID;references:AssessmentID" json:"scrapPurchaseItem,omitempty"`
}