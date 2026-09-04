package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PurchaseOrderController struct{ db *gorm.DB }

func NewPurchaseOrderController(db *gorm.DB) *PurchaseOrderController {
	return &PurchaseOrderController{db: db}
}

func orderDetails(db *gorm.DB, id string) (dto.PurchaseOrderResponse, error) {
	var order models.PurchaseOrder
	if err := db.Preload("Factory").Preload("Materials", func(q *gorm.DB) *gorm.DB {
		return q.Order("material_id")
	}).Preload("Materials.Material").First(&order, "order_id = ?", id).Error; err != nil {
		return dto.PurchaseOrderResponse{}, err
	}
	var delivery models.DeliveryRequest
	if err := db.Select("request_id").First(&delivery, "order_id = ?", id).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return dto.PurchaseOrderResponse{}, err
	}
	result := dto.PurchaseOrderResponse{OrderID: id, RequestID: delivery.RequestID, FactoryID: order.FactoryID,
		SalesStaffID: order.SalesStaffID, OrderDate: order.OrderDate.Format(time.DateOnly),
		Status: order.Status, Factory: factoryResponse(order.Factory), Materials: make([]dto.PurchaseOrderMaterialResponse, 0, len(order.Materials))}
	for _, line := range order.Materials {
		item := dto.PurchaseOrderMaterialResponse{MaterialID: line.MaterialID, Quantity: line.RequestedQuantity}
		if line.Material != nil {
			item.Name, item.Unit = line.Material.MaterialName, line.Material.Unit
		}
		result.Materials = append(result.Materials, item)
	}
	return result, nil
}

func normalizeMaterials(items []dto.PurchaseOrderMaterialInput) error {
	if len(items) == 0 {
		return invalid("materials must contain at least one item")
	}
	seen := make(map[string]bool)
	for i := range items {
		items[i].MaterialID = strings.TrimSpace(items[i].MaterialID)
		if items[i].MaterialID == "" || items[i].Quantity <= 0 {
			return invalid("each material needs a material_id and a positive integer requested_quantity")
		}
		if seen[items[i].MaterialID] {
			return invalid("materials must not contain duplicate material_id values")
		}
		seen[items[i].MaterialID] = true
	}
	return nil
}

func checkCoordinates(latitude, longitude *float64) error {
	if (latitude == nil) != (longitude == nil) {
		return invalid("provide both destination_latitude and destination_longitude")
	}
	if latitude != nil && (*latitude < -90 || *latitude > 90 || *longitude < -180 || *longitude > 180) {
		return invalid("destination coordinates are outside their valid ranges")
	}
	return nil
}

func saveMaterialLines(tx *gorm.DB, orderID, requestID string, items []dto.PurchaseOrderMaterialInput) error {
	orderLines := make([]models.PurchaseOrderMaterial, 0, len(items))
	deliveryLines := make([]models.DeliveryRequestMaterial, 0, len(items))
	for _, item := range items {
		orderLines = append(orderLines, models.PurchaseOrderMaterial{OrderID: orderID, MaterialID: item.MaterialID, RequestedQuantity: item.Quantity})
		deliveryLines = append(deliveryLines, models.DeliveryRequestMaterial{RequestID: requestID, MaterialID: item.MaterialID, DeliveryQuantity: item.Quantity})
	}
	if err := tx.Omit(clause.Associations).Create(&orderLines).Error; err != nil {
		return err
	}
	return tx.Omit(clause.Associations).Create(&deliveryLines).Error
}

func (h *PurchaseOrderController) Create(c *gin.Context) {
	var input dto.CreatePurchaseOrderRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	var err error
	if input.FactoryID, err = requireText(input.FactoryID, "factory_id"); err != nil {
		workflowError(c, err)
		return
	}
	if input.SalesStaffID, err = requireText(input.SalesStaffID, "sales_staff_id"); err != nil {
		workflowError(c, err)
		return
	}
	if err = normalizeMaterials(input.Materials); err != nil {
		workflowError(c, err)
		return
	}
	if err = checkCoordinates(input.Delivery.Latitude, input.Delivery.Longitude); err != nil {
		workflowError(c, err)
		return
	}
	orderDate, err := dateValue(input.OrderDate, time.Now())
	if err != nil {
		workflowError(c, err)
		return
	}
	deliveryDate, err := dateValue(input.Delivery.RequestDate, orderDate)
	if err != nil {
		workflowError(c, err)
		return
	}
	if deliveryDate.Before(orderDate) {
		workflowError(c, invalid("request_date cannot be before order_date"))
		return
	}
	input.OrderID, input.RequestID = strings.TrimSpace(input.OrderID), strings.TrimSpace(input.RequestID)
	if input.OrderID == "" {
		input.OrderID, err = utils.GenerateID("PO")
	}
	if err == nil && input.RequestID == "" {
		input.RequestID, err = utils.GenerateID("DR")
	}
	if err != nil {
		workflowError(c, err)
		return
	}
	var result dto.PurchaseOrderResponse
	err = h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var factory models.Factory
		if err := tx.First(&factory, "factory_id = ?", input.FactoryID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return invalid("factory_id does not exist")
			}
			return err
		}
		if err := requireReference(tx, "sales_staff", "employee_id", input.SalesStaffID); err != nil {
			return err
		}
		latitude, longitude := input.Delivery.Latitude, input.Delivery.Longitude
		if latitude == nil {
			latitude, longitude = factory.Latitude, factory.Longitude
		}
		if latitude == nil || longitude == nil {
			return invalid("factory has no coordinates; save its location before creating an order")
		}
		order := models.PurchaseOrder{OrderID: input.OrderID, FactoryID: input.FactoryID,
			SalesStaffID: input.SalesStaffID, OrderDate: orderDate, Status: "created"}
		if err := tx.Omit(clause.Associations).Create(&order).Error; err != nil {
			return err
		}
		delivery := models.DeliveryRequest{RequestID: input.RequestID, OrderID: input.OrderID,
			CustomerName: strings.TrimSpace(input.Delivery.Customer), Address: strings.TrimSpace(input.Delivery.Address),
			PhoneNumber: strings.TrimSpace(input.Delivery.Phone), RequestDate: deliveryDate, Status: "pending"}
		if delivery.CustomerName == "" {
			delivery.CustomerName = factory.CompanyName
		}
		if delivery.Address == "" {
			delivery.Address = factory.Address
		}
		if delivery.PhoneNumber == "" {
			delivery.PhoneNumber = factory.Phone
		}
		delivery.DestinationLatitude, delivery.DestinationLongitude = *latitude, *longitude
		delivery.HasCoordinates = true
		if err := tx.Omit(clause.Associations).Create(&delivery).Error; err != nil {
			return err
		}
		if err := saveMaterialLines(tx, order.OrderID, delivery.RequestID, input.Materials); err != nil {
			return err
		}
		var err error
		result, err = orderDetails(tx, order.OrderID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *PurchaseOrderController) List(c *gin.Context) {
	rows := make([]dto.PurchaseOrderListItem, 0)
	query := h.db.WithContext(c.Request.Context()).Table("purchase_orders AS o").
		Select("o.order_id, o.factory_id, o.sales_staff_id, to_char(o.order_date, 'YYYY-MM-DD') AS order_date, o.status, d.request_id").
		Joins("LEFT JOIN delivery_requests AS d ON d.order_id = o.order_id")
	if status := c.Query("status"); status != "" {
		query = query.Where("o.status = ?", status)
	}
	if err := query.Order("o.order_date DESC, o.order_id").Scan(&rows).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *PurchaseOrderController) Get(c *gin.Context) {
	result, err := orderDetails(h.db.WithContext(c.Request.Context()), c.Param("id"))
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// All workflow mutations lock the source order before the delivery request.
func lockOrderDelivery(tx *gorm.DB, orderID string) (models.PurchaseOrder, models.DeliveryRequest, error) {
	var order models.PurchaseOrder
	var delivery models.DeliveryRequest
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, "order_id = ?", orderID).Error; err != nil {
		return order, delivery, err
	}
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&delivery, "order_id = ?", orderID).Error
	return order, delivery, err
}

func (h *PurchaseOrderController) Update(c *gin.Context) {
	var input dto.UpdatePurchaseOrderRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	if !input.FactoryID.Present && !input.OrderDate.Present && !input.Materials.Present {
		workflowError(c, invalid("provide factory_id, order_date or materials"))
		return
	}
	if input.Materials.Present {
		if err := normalizeMaterials(input.Materials.Value); err != nil {
			workflowError(c, err)
			return
		}
	}
	var result dto.PurchaseOrderResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		order, delivery, err := lockOrderDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if order.Status != "created" || delivery.Status != "pending" {
			return conflict("order can only be edited while delivery is pending")
		}
		updates := make(map[string]any)
		if input.FactoryID.Present {
			id, err := requireText(input.FactoryID.Value, "factory_id")
			if err != nil {
				return err
			}
			var factory models.Factory
			if err := tx.First(&factory, "factory_id = ?", id).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return invalid("factory_id does not exist")
				}
				return err
			}
			updates["factory_id"] = id
			if id != order.FactoryID {
				if factory.Latitude == nil || factory.Longitude == nil {
					return invalid("factory has no coordinates; save its location before creating an order")
				}
				if err := tx.Model(&delivery).Updates(map[string]any{"customer_name": factory.CompanyName, "address": factory.Address, "phone_number": factory.Phone, "destination_latitude": *factory.Latitude, "destination_longitude": *factory.Longitude, "has_coordinates": true}).Error; err != nil {
					return err
				}
			}
		}
		if input.OrderDate.Present {
			if strings.TrimSpace(input.OrderDate.Value) == "" {
				return invalid("order_date is required")
			}
			date, err := dateValue(input.OrderDate.Value, order.OrderDate)
			if err != nil {
				return err
			}
			if delivery.RequestDate.Before(date) {
				return invalid("order_date cannot be after request_date")
			}
			updates["order_date"] = date
		}
		if len(updates) > 0 {
			if err := tx.Model(&order).Updates(updates).Error; err != nil {
				return err
			}
		}
		if input.Materials.Present {
			if err := tx.Where("order_id = ?", order.OrderID).Delete(&models.PurchaseOrderMaterial{}).Error; err != nil {
				return err
			}
			if err := tx.Where("request_id = ?", delivery.RequestID).Delete(&models.DeliveryRequestMaterial{}).Error; err != nil {
				return err
			}
			if err := saveMaterialLines(tx, order.OrderID, delivery.RequestID, input.Materials.Value); err != nil {
				return err
			}
		}
		result, err = orderDetails(tx, order.OrderID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
