package dto

type SalesContractMaterialInput struct {
	MaterialID            string  `json:"material_id"`
	ContractQuantity      float64 `json:"contract_quantity"`
	UnitPrice             float64 `json:"unit_price"`
	VolumeDiscountPercent float64 `json:"volume_discount_percent"`
}

type CreateSalesContractRequest struct {
	ContractID   string                       `json:"contract_id"`
	FactoryID    string                       `json:"factory_id"`
	SalesStaffID string                       `json:"sales_staff_id"`
	ContractDate string                       `json:"contract_date"`
	ValidFrom    string                       `json:"valid_from"`
	ValidTo      string                       `json:"valid_to"`
	Status       string                       `json:"status"`
	Terms        string                       `json:"terms"`
	DocumentURL  string                       `json:"document_url"`
	Materials    []SalesContractMaterialInput `json:"materials"`
}

type UpdateSalesContractRequest struct {
	FactoryID    PatchField[string]                       `json:"factory_id"`
	SalesStaffID PatchField[string]                       `json:"sales_staff_id"`
	ContractDate PatchField[string]                       `json:"contract_date"`
	ValidFrom    PatchField[string]                       `json:"valid_from"`
	ValidTo      PatchField[string]                       `json:"valid_to"`
	Status       PatchField[string]                       `json:"status"`
	Terms        PatchField[string]                       `json:"terms"`
	DocumentURL  PatchField[string]                       `json:"document_url"`
	Materials    PatchField[[]SalesContractMaterialInput] `json:"materials"`
}

type CreateContractRevisionRequest struct {
	RevisionID               string   `json:"revision_id"`
	RequestType              string   `json:"request_type"`
	Reason                   string   `json:"reason"`
	NewValidTo               *string  `json:"new_valid_to"`
	NewTerms                 *string  `json:"new_terms"`
	PriceAdjustmentPercent   *float64 `json:"price_adjustment_percent"`
	NewVolumeDiscountPercent *float64 `json:"new_volume_discount_percent"`
	DraftDocument            *string  `json:"draft_document"`
	RequestedBy              string   `json:"requested_by"`
}

type ReviewContractRevisionRequest struct {
	Status         string  `json:"status"`
	ReviewedBy     string  `json:"reviewed_by"`
	ReviewNote     *string `json:"review_note"`
	SignedDocument *string `json:"signed_document"`
}
