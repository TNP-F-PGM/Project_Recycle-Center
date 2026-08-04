package entity

import "time"

type Material struct {
	MaterialID   string  `json:"materialId"`
	MaterialName string  `json:"materialName"`
	Quantity     float64 `json:"quantity"`
}

type Supplier struct {
	SupplierID  string `json:"supplierId"`
	CompanyName string `json:"companyName"`
	PhoneNumber string `json:"phoneNumber"`
}

type PurchaseOrder struct {
	OrderID           string     `json:"orderId"`
	RequestedQuantity float64    `json:"requestedQuantity"`
	OrderDate         time.Time  `json:"orderDate"`
	Status            string     `json:"status"`
	SalesStaffID      string     `json:"salesStaffId"`
	Supplier          Supplier   `json:"supplier"`
	Materials         []Material `json:"materials"`
}

// HasSufficientStock verifies the first requested material against the order quantity.
func (order PurchaseOrder) HasSufficientStock() bool {
	if len(order.Materials) == 0 {
		return false
	}
	return order.Materials[0].Quantity >= order.RequestedQuantity
}
