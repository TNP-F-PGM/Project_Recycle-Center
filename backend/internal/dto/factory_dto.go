package dto

type CreateFactoryRequest struct {
	FactoryID     string   `json:"factory_id"`
	CompanyName   string   `json:"company_name"`
	ContactPerson string   `json:"contact_person"`
	Phone         string   `json:"phone"`
	Address       string   `json:"address"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
}

type UpdateFactoryRequest struct {
	CompanyName   PatchField[string]  `json:"company_name"`
	ContactPerson PatchField[string]  `json:"contact_person"`
	Phone         PatchField[string]  `json:"phone"`
	Address       PatchField[string]  `json:"address"`
	Latitude      PatchField[float64] `json:"latitude"`
	Longitude     PatchField[float64] `json:"longitude"`
}
