package entity

import "testing"

func TestPurchaseOrderHasSufficientStock(t *testing.T) {
	order := PurchaseOrder{
		RequestedQuantity: 300,
		Materials: []Material{{
			MaterialID: "P01", MaterialName: "กระดาษขาว-ดำ", Quantity: 620,
		}},
	}
	if !order.HasSufficientStock() {
		t.Fatal("expected stock to be sufficient")
	}

	order.RequestedQuantity = 800
	if order.HasSufficientStock() {
		t.Fatal("expected stock to be insufficient")
	}
}
