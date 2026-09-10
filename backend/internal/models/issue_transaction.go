package models

// IssueTransaction adds issue-specific data to one stock transaction.
type IssueTransaction struct {
	IssueNo        string            `gorm:"column:issue_no;type:text;primaryKey" json:"issueNo"`
	ReferenceNo    string            `gorm:"column:reference_no;type:text;not null" json:"referenceNo"`
	RequestingUnit string            `gorm:"column:requesting_unit;type:text;not null" json:"requestingUnit"`
	TransactionID  int               `gorm:"column:transaction_id;type:integer;not null;uniqueIndex" json:"transactionID"`
	Transaction    *StockTransaction `gorm:"foreignKey:TransactionID;references:TransactionID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"transaction,omitempty"`
}