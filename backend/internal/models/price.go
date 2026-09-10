package models

import (
	"time"

	"gorm.io/gorm"
)

type PurchasePrice struct {
	ID            uint           `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Price         float64        `gorm:"column:price;type:decimal(14,2);not null;check:price >= 0" json:"price"`
	EffectiveDate time.Time      `gorm:"column:effective_date;type:date;not null" json:"effective_date"`
	IsActive      bool           `gorm:"column:is_active;not null;default:true" json:"is_active"`
	MaterialID    string         `gorm:"column:material_id;type:varchar;not null;index" json:"material_id"`
	Material      *Material      `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type PriceNotification struct {
	ID          uint           `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Message     string         `gorm:"column:message;type:varchar(255);not null" json:"message"`
	CreatedDate time.Time      `gorm:"column:created_date;not null" json:"created_date"`
	IsRead      bool           `gorm:"column:is_read;not null;default:false" json:"is_read"`
	PriceID     uint           `gorm:"column:price_id;not null;index" json:"price_id"`
	Price       *PurchasePrice `gorm:"foreignKey:PriceID;references:ID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"price,omitempty"`
	MaterialID  string         `gorm:"column:material_id;type:varchar;not null;index" json:"material_id"`
	Material    *Material      `gorm:"foreignKey:MaterialID;references:MaterialID;belongsTo;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"material,omitempty"`
}
