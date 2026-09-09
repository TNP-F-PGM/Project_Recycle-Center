package models

import "time"

type ReturnRecord struct {
	ReturnID       string          `gorm:"column:return_id;type:varchar(50);primaryKey" json:"return_id"`
	ReturnDate     time.Time       `gorm:"column:return_date;not null" json:"return_date"`
	ReturnQuantity float64         `gorm:"column:return_quantity;type:double precision;not null;check:return_quantity > 0" json:"return_quantity"`
	ProcessedBy    string          `gorm:"column:processed_by;type:text;not null;index" json:"processed_by"`
	WarehouseStaff *WarehouseStaff `gorm:"foreignKey:ProcessedBy;references:EmployeeID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"warehouse_staff,omitempty"`
	WarehouseID    string          `gorm:"column:warehouse_id;type:text;not null;index" json:"warehouse_id"`
	Warehouse      *Warehouse      `gorm:"foreignKey:WarehouseID;references:WarehouseID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"warehouse,omitempty"`
	ComplaintID    string          `gorm:"column:complaint_id;type:varchar(50);not null;uniqueIndex" json:"complaint_id"`
	Complaint      *Complaint      `gorm:"foreignKey:ComplaintID;references:ComplaintID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"complaint,omitempty"`
}
