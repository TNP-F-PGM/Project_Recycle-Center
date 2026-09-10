package models

import "time"

// StockTransaction is the shared transaction record for receiving and issuing stock.
type StockTransaction struct {
	TransactionID      int                 `gorm:"column:transaction_id;type:integer;primaryKey;autoIncrement" json:"transactionID"`
	Quantity           float64             `gorm:"column:quantity;type:double precision;not null" json:"quantity"`
	TransactionDate    time.Time           `gorm:"column:transaction_date;type:timestamptz;not null" json:"transactionDate"`
	EmployeeID         string              `gorm:"column:employee_id;type:text;not null;index" json:"employeeID"`
	ZoneID             string              `gorm:"column:zone_id;type:text;not null;index" json:"zoneID"`
	Employee           *User               `gorm:"foreignKey:EmployeeID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"employee,omitempty"`
	Zone               *StorageZone        `gorm:"foreignKey:ZoneID;references:ZoneID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"zone,omitempty"`
	ReceiveTransaction *ReceiveTransaction `gorm:"foreignKey:TransactionID;references:TransactionID" json:"receiveTransaction,omitempty"`
	IssueTransaction   *IssueTransaction   `gorm:"foreignKey:TransactionID;references:TransactionID" json:"issueTransaction,omitempty"`
}