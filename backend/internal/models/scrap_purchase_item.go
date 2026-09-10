package models

import "time"

// ScrapPurchaseItem records a purchase created from an assessment.
type ScrapPurchaseItem struct {
	PurchaseID   string                `gorm:"column:purchase_id;type:text;primaryKey" json:"purchaseID"`
	PaymentID    *string               `gorm:"column:payment_id;type:varchar" json:"paymentID"`
	PurchaseDate time.Time             `gorm:"column:purchase_date;type:date;not null" json:"purchaseDate"`
	SellerCode   string                `gorm:"column:seller_code;type:text;not null;index" json:"sellerCode"`
	Seller       *Seller               `gorm:"foreignKey:SellerCode;references:SellerCode;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"-"`
	WasteType    string                `gorm:"column:waste_type;type:text;not null" json:"wasteType"`
	Weight       float64               `gorm:"column:weight;type:double precision;not null" json:"weight"`
	PricePerKg   float64               `gorm:"column:price_per_kg;type:double precision;not null" json:"pricePerKg"`
	TotalAmount  float64               `gorm:"column:total_amount;type:double precision;not null" json:"totalAmount"`
	EmployeeID   string                `gorm:"column:employee_id;type:text;not null;index" json:"employeeID"`
	MaterialID   string                `gorm:"column:material_id;type:varchar;not null;index" json:"materialID"`
	AssessmentID int                   `gorm:"column:assessment_id;type:integer;not null;uniqueIndex" json:"assessmentID"`
	Employee     *User                 `gorm:"foreignKey:EmployeeID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"employee,omitempty"`
	Material     *Material             `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	Assessment   *QualityAssessment    `gorm:"foreignKey:AssessmentID;references:AssessmentID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"assessment,omitempty"`
	PendingItem  *PendingWarehouseItem `gorm:"foreignKey:PurchaseID;references:PurchaseID" json:"pendingWarehouseItem,omitempty"`
}