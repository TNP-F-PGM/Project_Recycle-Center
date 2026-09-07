package models

import "time"

// PendingWarehouseItem is assessed stock waiting to be received into a zone.
type PendingWarehouseItem struct {
	PendingID          int                 `gorm:"column:pending_id;type:integer;primaryKey;autoIncrement" json:"pendingID"`
	Quantity           float64             `gorm:"column:quantity;type:double precision;not null" json:"quantity"`
	AssessedGrade      string              `gorm:"column:assessed_grade;type:text;not null" json:"assessedGrade"`
	AssessedBy         string              `gorm:"column:assessed_by;type:text;not null" json:"assessedBy"`
	TransferredDate    time.Time           `gorm:"column:transferred_date;type:timestamptz;not null" json:"transferredDate"`
	StockRouteType     string              `gorm:"column:stock_route_type;type:text;not null" json:"stockRouteType"`
	PurchaseID         string              `gorm:"column:purchase_id;type:text;not null;uniqueIndex" json:"purchaseID"`
	ReceivingStatus    string              `gorm:"column:receiving_status;type:text;not null" json:"receivingStatus"`
	MaterialID         string              `gorm:"column:material_id;type:varchar;not null;index" json:"materialID"`
	Purchase           *ScrapPurchaseItem  `gorm:"foreignKey:PurchaseID;references:PurchaseID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"purchase,omitempty"`
	Material           *Material           `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	ReceiveTransaction *ReceiveTransaction `gorm:"foreignKey:PendingID;references:PendingID" json:"receiveTransaction,omitempty"`
}