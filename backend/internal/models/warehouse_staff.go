package models

type WarehouseStaff struct {
	EmployeeID       string `gorm:"column:employee_id;type:text;primaryKey" json:"employee_id"`
	WarehouseSection string `gorm:"column:warehouse_section;type:text;not null" json:"warehouse_section"`
	UserID           string `gorm:"column:user_id;type:text;not null;uniqueIndex" json:"user_id"`
	User             *User  `gorm:"foreignKey:UserID;references:UserID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"user,omitempty"`
}
