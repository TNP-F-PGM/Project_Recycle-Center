package models

import "time"

// StockAdjustmentRequest records a mismatch found while counting zone stock.
type StockAdjustmentRequest struct {
	RequestNo       int                 `gorm:"column:request_no;type:integer;primaryKey;autoIncrement" json:"requestNo"`
	SystemQuantity  float64             `gorm:"column:system_quantity;type:double precision;not null" json:"systemQuantity"`
	CountedQuantity float64             `gorm:"column:counted_quantity;type:double precision;not null" json:"countedQuantity"`
	Description     string              `gorm:"column:description;type:text;not null" json:"description"`
	AttachmentURL   *string             `gorm:"column:attachment_url;type:varchar" json:"attachmentURL"`
	RequestDate     time.Time           `gorm:"column:request_date;type:timestamptz;not null" json:"requestDate"`
	Status          string              `gorm:"column:status;type:text;not null" json:"status"`
	EmployeeID      string              `gorm:"column:employee_id;type:text;not null;index" json:"employeeID"`
	ZoneID          string              `gorm:"column:zone_id;type:text;not null;index" json:"zoneID"`
	Employee        *User               `gorm:"foreignKey:EmployeeID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"employee,omitempty"`
	Zone            *StorageZone        `gorm:"foreignKey:ZoneID;references:ZoneID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"zone,omitempty"`
	Approval        *AdjustmentApproval `gorm:"foreignKey:RequestNo;references:RequestNo" json:"approval,omitempty"`
}