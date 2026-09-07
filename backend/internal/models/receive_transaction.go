package models

// ReceiveTransaction links a stock transaction to one pending warehouse item.
type ReceiveTransaction struct {
	ReceiveNo     string                `gorm:"column:receive_no;type:text;primaryKey" json:"receiveNo"`
	TransactionID int                   `gorm:"column:transaction_id;type:integer;not null;uniqueIndex" json:"transactionID"`
	PendingID     int                   `gorm:"column:pending_id;type:integer;not null;uniqueIndex" json:"pendingID"`
	Transaction   *StockTransaction     `gorm:"foreignKey:TransactionID;references:TransactionID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"transaction,omitempty"`
	PendingItem   *PendingWarehouseItem `gorm:"foreignKey:PendingID;references:PendingID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"pendingWarehouseItem,omitempty"`
}