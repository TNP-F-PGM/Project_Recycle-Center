package models

import (
	"time"

	"gorm.io/gorm"
)

type FinanceOfficer struct {
	FinanceOfficerID string         `gorm:"column:finance_officer_id;type:varchar(50);primaryKey" json:"finance_officer_id"`
	EmployeeCode     string         `gorm:"column:employee_code;type:varchar(50);not null;uniqueIndex" json:"employee_code"`
	Position         string         `gorm:"column:position;type:varchar(100);not null" json:"position"`
	ApprovalLevel    uint8          `gorm:"column:approval_level;type:smallint;not null;default:0" json:"approval_level"`
	Status           string         `gorm:"column:status;type:varchar(50);not null" json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type PaymentMethod struct {
	MethodID    string         `gorm:"column:method_id;type:varchar(50);primaryKey" json:"method_id"`
	MethodName  string         `gorm:"column:method_name;type:varchar(100);not null" json:"method_name"`
	ReferenceNo string         `gorm:"column:reference_no;type:varchar(100)" json:"reference_no"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type FinancialReport struct {
	ReportID     string         `gorm:"column:report_id;type:varchar(50);primaryKey" json:"report_id"`
	ReportType   string         `gorm:"column:report_type;type:varchar(100);not null" json:"report_type"`
	StartDate    time.Time      `gorm:"column:start_date;type:date;not null" json:"start_date"`
	EndDate      time.Time      `gorm:"column:end_date;type:date;not null" json:"end_date"`
	TotalRevenue float64        `gorm:"column:total_revenue;type:decimal(14,2);not null;default:0" json:"total_revenue"`
	TotalExpense float64        `gorm:"column:total_expense;type:decimal(14,2);not null;default:0" json:"total_expense"`
	NetProfit    float64        `gorm:"column:net_profit;type:decimal(14,2);not null;default:0" json:"net_profit"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Invoice struct {
	InvoiceNo          string          `gorm:"column:invoice_no;type:varchar(50);primaryKey" json:"invoice_no"`
	IssuedDate         time.Time       `gorm:"column:issued_date;type:date;not null" json:"issued_date"`
	DueDate            time.Time       `gorm:"column:due_date;type:date;not null" json:"due_date"`
	OutstandingBalance float64         `gorm:"column:outstanding_balance;type:decimal(14,2);not null;default:0" json:"outstanding_balance"`
	Status             string          `gorm:"column:status;type:varchar(50);not null" json:"status"`
	FinanceOfficerID   string          `gorm:"column:finance_officer_id;type:varchar(50);not null;index" json:"finance_officer_id"`
	FinanceOfficer     *FinanceOfficer `gorm:"foreignKey:FinanceOfficerID;references:FinanceOfficerID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"finance_officer,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
	DeletedAt          gorm.DeletedAt  `gorm:"index" json:"-"`
}

type Receipt struct {
	ReceiptNo        string          `gorm:"column:receipt_no;type:varchar(50);primaryKey" json:"receipt_no"`
	IssuedDate       time.Time       `gorm:"column:issued_date;not null" json:"issued_date"`
	TotalAmount      float64         `gorm:"column:total_amount;type:decimal(14,2);not null" json:"total_amount"`
	FinanceOfficerID string          `gorm:"column:finance_officer_id;type:varchar(50);not null;index" json:"finance_officer_id"`
	FinanceOfficer   *FinanceOfficer `gorm:"foreignKey:FinanceOfficerID;references:FinanceOfficerID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"finance_officer,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        gorm.DeletedAt  `gorm:"index" json:"-"`
}

type Payment struct {
	PaymentID        string           `gorm:"column:payment_id;type:varchar(50);primaryKey" json:"payment_id"`
	TransactionType  string           `gorm:"column:transaction_type;type:varchar(50);not null" json:"transaction_type"`
	TotalAmount      float64          `gorm:"column:total_amount;type:decimal(14,2);not null" json:"total_amount"`
	PaymentDate      time.Time        `gorm:"column:payment_date;not null" json:"payment_date"`
	PaymentStatus    string           `gorm:"column:payment_status;type:varchar(50);not null" json:"payment_status"`
	MethodID         string           `gorm:"column:method_id;type:varchar(50);not null;index" json:"method_id"`
	PaymentMethod    *PaymentMethod   `gorm:"foreignKey:MethodID;references:MethodID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"payment_method,omitempty"`
	InvoiceNo        *string          `gorm:"column:invoice_no;type:varchar(50);index" json:"invoice_no,omitempty"`
	Invoice          *Invoice         `gorm:"foreignKey:InvoiceNo;references:InvoiceNo;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"invoice,omitempty"`
	FinanceOfficerID string           `gorm:"column:finance_officer_id;type:varchar(50);not null;index" json:"finance_officer_id"`
	FinanceOfficer   *FinanceOfficer  `gorm:"foreignKey:FinanceOfficerID;references:FinanceOfficerID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"finance_officer,omitempty"`
	ReportID         *string          `gorm:"column:report_id;type:varchar(50);index" json:"report_id,omitempty"`
	FinancialReport  *FinancialReport `gorm:"foreignKey:ReportID;references:ReportID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"financial_report,omitempty"`
	ReceiptNo        *string          `gorm:"column:receipt_no;type:varchar(50);index" json:"receipt_no,omitempty"`
	Receipt          *Receipt         `gorm:"foreignKey:ReceiptNo;references:ReceiptNo;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"receipt,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
	DeletedAt        gorm.DeletedAt   `gorm:"index" json:"-"`
}

type PaymentEvidence struct {
	EvidenceID uint      `gorm:"column:evidence_id;primaryKey;autoIncrement" json:"evidence_id"`
	FilePath   string    `gorm:"column:file_path;type:text;not null" json:"file_path"`
	UploadDate time.Time `gorm:"column:upload_date;not null" json:"upload_date"`
	PaymentID  string    `gorm:"column:payment_id;type:varchar(50);not null;index" json:"payment_id"`
	Payment    *Payment  `gorm:"foreignKey:PaymentID;references:PaymentID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"payment,omitempty"`
}

type OutstandingDebt struct {
	DebtID           uint      `gorm:"column:debt_id;primaryKey;autoIncrement" json:"debt_id"`
	LastFollowUpDate time.Time `gorm:"column:last_follow_up_date;type:date" json:"last_follow_up_date"`
	FollowUpNote     string    `gorm:"column:follow_up_note;type:text" json:"follow_up_note"`
	InvoiceNo        string    `gorm:"column:invoice_no;type:varchar(50);not null;index" json:"invoice_no"`
	Invoice          *Invoice  `gorm:"foreignKey:InvoiceNo;references:InvoiceNo;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"invoice,omitempty"`
}

type Finance struct {
	ID          uint           `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	TotalAmount float64        `gorm:"column:total_amount;type:decimal(14,2);not null" json:"total_amount"`
	TotalWeight float64        `gorm:"column:total_weight;type:decimal(14,2);not null" json:"total_weight"`
	Type        string         `gorm:"column:type;type:varchar(50);not null" json:"type"`
	Status      string         `gorm:"column:status;type:varchar(50);not null" json:"status"`
	Transaction time.Time      `gorm:"column:transaction_date;not null" json:"transaction_date"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type PurchaseItem struct {
	ID         uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Amount     float64   `gorm:"column:amount;type:decimal(14,2);not null" json:"amount"`
	Weight     float64   `gorm:"column:weight;type:decimal(14,3);not null" json:"weight"`
	UnitPrice  float64   `gorm:"column:unit_price;type:decimal(14,2);not null" json:"unit_price"`
	MaterialID string    `gorm:"column:material_id;type:varchar;not null;index" json:"material_id"`
	Material   *Material `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	FinanceID  uint      `gorm:"column:finance_id;not null;index" json:"finance_id"`
	Finance    *Finance  `gorm:"foreignKey:FinanceID;references:ID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"finance,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
