package dto

type PurchaseOrderMaterialInput struct {
	MaterialID string  `json:"material_id"`
	Quantity   float64 `json:"requested_quantity"`
}

type CreatePurchaseOrderRequest struct {
	OrderID      string                       `json:"order_id"`
	RequestID    string                       `json:"request_id"`
	FactoryID    string                       `json:"factory_id"`
	SalesStaffID string                       `json:"sales_staff_id"`
	OrderDate    string                       `json:"order_date"`
	Materials    []PurchaseOrderMaterialInput `json:"materials"`
	Delivery     DeliveryDetailsInput         `json:"delivery"`
}

type UpdatePurchaseOrderRequest struct {
	FactoryID PatchField[string]                       `json:"factory_id"`
	OrderDate PatchField[string]                       `json:"order_date"`
	Materials PatchField[[]PurchaseOrderMaterialInput] `json:"materials"`
}

type PurchaseOrderMaterialResponse struct {
	MaterialID string  `json:"material_id"`
	Name       string  `json:"material_name"`
	Unit       string  `json:"unit"`
	Quantity   float64 `json:"requested_quantity"`
}

type PurchaseOrderResponse struct {
	OrderID      string                          `json:"order_id"`
	RequestID    string                          `json:"request_id"`
	FactoryID    string                          `json:"factory_id"`
	SalesStaffID string                          `json:"sales_staff_id"`
	OrderDate    string                          `json:"order_date"`
	Status       string                          `json:"status"`
	Factory      *FactoryResponse                `json:"factory"`
	Materials    []PurchaseOrderMaterialResponse `json:"materials"`
}

type PurchaseOrderListItem struct {
	OrderID      string  `json:"order_id"`
	FactoryID    string  `json:"factory_id"`
	SalesStaffID string  `json:"sales_staff_id"`
	OrderDate    string  `json:"order_date"`
	Status       string  `json:"status"`
	RequestID    *string `json:"request_id"`
}
