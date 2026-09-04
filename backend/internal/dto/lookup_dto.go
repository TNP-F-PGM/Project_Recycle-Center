package dto

import "time"

type FactoryResponse struct {
	FactoryID     string   `json:"factory_id"`
	CompanyName   string   `json:"company_name"`
	ContactPerson string   `json:"contact_person"`
	Phone         string   `json:"phone"`
	Address       string   `json:"address"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
}

type MaterialResponse struct {
	MaterialID     string  `json:"material_id"`
	MaterialName   string  `json:"material_name"`
	Unit           string  `json:"unit"`
	Status         string  `json:"status"`
	Grade          string  `json:"grade"`
	MinStockLevel  float64 `json:"min_stock_level"`
	MaterialTypeID int     `json:"material_type_id"`
	TypeName       string  `json:"type_name"`
}

type EmployeeResponse struct {
	EmployeeID string    `json:"employee_id"`
	UserID     string    `json:"user_id"`
	Name       string    `json:"name"`
	Position   string    `json:"position"`
	HireDate   time.Time `json:"hire_date"`
}
