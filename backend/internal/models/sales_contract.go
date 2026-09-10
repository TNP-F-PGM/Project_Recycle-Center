package models

import "time"

type SalesContract struct {
	ContractID   string    `gorm:"column:contract_id;type:varchar;primaryKey" json:"contract_id"`
	ContractDate time.Time `gorm:"column:contract_date;type:date;not null" json:"contract_date"`
	ValidFrom    time.Time `gorm:"column:valid_from;type:date;not null" json:"valid_from"`
	ValidTo      time.Time `gorm:"column:valid_to;type:date;not null;check:contract_dates_valid,valid_to >= valid_from" json:"valid_to"`
	Status       string    `gorm:"column:status;type:text;not null;default:draft;check:contract_status_valid,status IN ('draft','pending_approval','pending_signature','active','expired','cancelled')" json:"status"`
	Terms        string    `gorm:"column:terms;type:text;not null" json:"terms"`
	DocumentURL  *string   `gorm:"column:document_url;type:text" json:"document_url"`
	FactoryID    string    `gorm:"column:factory_id;type:varchar;not null;index" json:"factory_id"`
	SalesStaffID string    `gorm:"column:sales_staff_id;type:varchar;not null;index" json:"sales_staff_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Factory    *Factory                `gorm:"belongsTo;foreignKey:FactoryID;references:FactoryID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"factory,omitempty"`
	SalesStaff *SalesStaff             `gorm:"belongsTo;foreignKey:SalesStaffID;references:EmployeeID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"sales_staff,omitempty"`
	Materials  []SalesContractMaterial `gorm:"foreignKey:ContractID;references:ContractID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"materials"`
	Revisions  []ContractRevision      `gorm:"foreignKey:ContractID;references:ContractID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"revisions,omitempty"`
}

func (SalesContract) TableName() string { return "sales_contracts" }
