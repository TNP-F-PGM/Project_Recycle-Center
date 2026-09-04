package models

type Factory struct {
	FactoryID     string `json:"factory_id" gorm:"primaryKey"`
	CompanyName   string `json:"company_name" gorm:"not null"`
	ContactPerson string `json:"contact_person" gorm:"not null"`
	Phone         string `json:"phone" gorm:"not null"`
	Address       string `json:"address" gorm:"not null"`
	// Nullable for factories created before location capture was introduced.
	Latitude  *float64 `json:"latitude" gorm:"check:factory_coordinates_valid,(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)"`
	Longitude *float64 `json:"longitude"`
}

func (Factory) TableName() string { return "factories" }
