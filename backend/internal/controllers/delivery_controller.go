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

type DeliveryController struct{ db *gorm.DB }

func NewDeliveryController(db *gorm.DB) *DeliveryController { return &DeliveryController{db: db} }

func deliveryDetails(db *gorm.DB, id string) (dto.DeliveryResponse, error) {
	var delivery models.DeliveryRequest
	err := db.Preload("Materials", func(q *gorm.DB) *gorm.DB { return q.Order("material_id") }).
		Preload("Materials.Material").First(&delivery, "request_id = ?", id).Error
	if err != nil {
		return dto.DeliveryResponse{}, err
	}
	result := dto.DeliveryResponse{RequestID: delivery.RequestID, OrderID: delivery.OrderID,
		Customer: delivery.CustomerName, Address: delivery.Address, Phone: delivery.PhoneNumber,
		RequestDate: delivery.RequestDate.Format(time.DateOnly), Status: delivery.Status, SupervisorID: delivery.SupervisorID,
		Latitude: delivery.DestinationLatitude, Longitude: delivery.DestinationLongitude,
		HasCoordinates: delivery.HasCoordinates || delivery.DestinationLatitude != 0 || delivery.DestinationLongitude != 0,
		Materials:      make([]dto.DeliveryMaterialResponse, 0, len(delivery.Materials))}
	result.Incidents = make([]models.DeliveryIncident, 0)
	if err := db.Where("request_id = ?", id).Order("reported_at DESC, incident_id").Find(&result.Incidents).Error; err != nil {
		return result, err
	}
	for _, line := range delivery.Materials {
		result.Materials = append(result.Materials, dto.DeliveryMaterialResponse{MaterialID: line.MaterialID,
			Name: line.Material.MaterialName, Unit: line.Material.Unit, Quantity: line.DeliveryQuantity})
	}
	var assignment models.DeliveryAssignment
	err = db.First(&assignment, "request_id = ?", id).Error
	if err == nil {
		result.Assignment = &dto.DeliveryAssignmentResponse{TruckID: assignment.TruckID, DriverID: assignment.DriverID, AssignedAt: assignment.AssignedAt}
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}
	var cancellation models.CancelRequest
	err = db.First(&cancellation, "request_id = ?", id).Error
	if err == nil {
		result.Cancellation = &dto.DeliveryCancellationResponse{CancelID: cancellation.CancelID, TruckID: cancellation.TruckID, CancelDate: cancellation.CancelDate.Format(time.DateOnly)}
		result.Cancellation.Reason, result.Cancellation.SupervisorID = cancellation.Reason, cancellation.SupervisorID
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}
	return result, nil
}

func lockDelivery(tx *gorm.DB, id string) (models.PurchaseOrder, models.DeliveryRequest, error) {
	var delivery models.DeliveryRequest
	if err := tx.Select("order_id").First(&delivery, "request_id = ?", id).Error; err != nil {
		return models.PurchaseOrder{}, delivery, err
	}
	return lockOrderDelivery(tx, delivery.OrderID)
}

func (h *DeliveryController) Get(c *gin.Context) {
	result, err := deliveryDetails(h.db.WithContext(c.Request.Context()), c.Param("id"))
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *DeliveryController) List(c *gin.Context) {
	rows := make([]dto.DeliveryListItem, 0)
	query := h.db.WithContext(c.Request.Context()).Table("delivery_requests AS d").
		Select("d.request_id, d.order_id, d.customer_name, d.address, to_char(d.request_date, 'YYYY-MM-DD') AS request_date, d.status, d.supervisor_id, a.truck_id, a.driver_id, d.destination_latitude, d.destination_longitude, (d.has_coordinates OR d.destination_latitude <> 0 OR d.destination_longitude <> 0) AS has_coordinates").
		Joins("LEFT JOIN delivery_assignments AS a ON a.request_id = d.request_id")
	if status := c.Query("status"); status != "" {
		query = query.Where("d.status = ?", status)
	}
	if err := query.Order("d.request_date DESC, d.request_id").Scan(&rows).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *DeliveryController) Update(c *gin.Context) {
	var input dto.UpdateDeliveryRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	updates := make(map[string]any)
	for _, field := range []struct {
		name  string
		value dto.PatchField[string]
	}{
		{"customer_name", input.Customer}, {"address", input.Address},
	} {
		if field.value.Present {
			value, err := requireText(field.value.Value, field.name)
			if err != nil {
				workflowError(c, err)
				return
			}
			updates[field.name] = value
		}
	}
	if input.Phone.Present {
		updates["phone_number"] = strings.TrimSpace(input.Phone.Value)
	}
	if input.Latitude.Present != input.Longitude.Present {
		workflowError(c, invalid("provide both destination coordinates"))
		return
	}
	if input.Latitude.Present {
		if input.ClearCoordinates {
			workflowError(c, invalid("cannot clear and set coordinates together"))
			return
		}
		if err := checkCoordinates(&input.Latitude.Value, &input.Longitude.Value); err != nil {
			workflowError(c, err)
			return
		}
		updates["destination_latitude"], updates["destination_longitude"] = input.Latitude.Value, input.Longitude.Value
		updates["has_coordinates"] = true
	}
	if input.ClearCoordinates {
		updates["destination_latitude"], updates["destination_longitude"], updates["has_coordinates"] = 0, 0, false
	}
	if len(updates) == 0 && !input.RequestDate.Present {
		workflowError(c, invalid("provide at least one delivery field"))
		return
	}
	var result dto.DeliveryResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		order, delivery, err := lockDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if delivery.Status != "pending" {
			return conflict("delivery details can only be edited while pending")
		}
		if input.RequestDate.Present {
			if strings.TrimSpace(input.RequestDate.Value) == "" {
				return invalid("request_date is required")
			}
			date, err := dateValue(input.RequestDate.Value, delivery.RequestDate)
			if err != nil {
				return err
			}
			if date.Before(order.OrderDate) {
				return invalid("request_date cannot be before order_date")
			}
			updates["request_date"] = date
		}
		if err := tx.Model(&delivery).Updates(updates).Error; err != nil {
			return err
		}
		result, err = deliveryDetails(tx, delivery.RequestID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *DeliveryController) Assign(c *gin.Context) {
	var input dto.AssignDeliveryRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	for _, field := range []struct {
		name  string
		value *string
	}{
		{"truck_id", &input.TruckID}, {"driver_id", &input.DriverID}, {"supervisor_id", &input.SupervisorID},
	} {
		value, err := requireText(*field.value, field.name)
		if err != nil {
			workflowError(c, err)
			return
		}
		*field.value = value
	}
	var result dto.DeliveryResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		_, delivery, err := lockDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if delivery.Status != "pending" && delivery.Status != "assigned" && delivery.Status != "on_hold" {
			return conflict("assignment can only change before departure")
		}
		var incident models.DeliveryIncident
		nextStatus := "assigned"
		if delivery.Status == "on_hold" {
			if strings.TrimSpace(input.ResolutionNote) == "" || len([]rune(input.ResolutionNote)) > 2000 || input.IncidentID == "" {
				return invalid("incident_id and resolution_note are required")
			}
			if err := tx.First(&incident, "incident_id = ? AND request_id = ? AND resolved_at IS NULL", input.IncidentID, delivery.RequestID).Error; err != nil {
				return conflict("incident was already resolved or does not belong to this delivery")
			}
			nextStatus = incident.PreviousStatus
		} else if input.IncidentID != "" {
			return conflict("delivery is no longer on hold")
		}
		if err := requireReference(tx, "transport_supervisors", "user_id", input.SupervisorID); err != nil {
			return err
		}
		var previous models.DeliveryAssignment
		err = tx.First(&previous, "request_id = ?", delivery.RequestID).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// Deterministic resource locking prevents double booking across requests.
		var drivers []models.Driver
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("employee_id IN ?", []string{input.DriverID, previous.DriverID}).Order("employee_id").Find(&drivers).Error; err != nil {
			return err
		}
		found := false
		for _, driver := range drivers {
			if driver.EmployeeID == input.DriverID {
				if !driverEligible(driver) {
					return conflict("driver must be active with a valid license")
				}
				found = true
			}
		}
		if !found {
			return invalid("driver_id does not exist")
		}
		var trucks []models.Truck
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("truck_id IN ?", []string{input.TruckID, previous.TruckID}).Order("truck_id").Find(&trucks).Error; err != nil {
			return err
		}
		var target *models.Truck
		for i := range trucks {
			if trucks[i].TruckID == input.TruckID {
				target = &trucks[i]
			}
		}
		if target == nil {
			return invalid("truck_id does not exist")
		}
		if target.RequestID != nil && *target.RequestID != delivery.RequestID {
			return conflict("truck already has an active delivery")
		}
		if target.RequestID == nil && target.Status != "available" {
			return conflict("truck must be available")
		}
		var busy int64
		if err := tx.Model(&models.Truck{}).Where("driver_id = ? AND request_id IS NOT NULL AND request_id <> ?", input.DriverID, delivery.RequestID).Count(&busy).Error; err != nil {
			return err
		}
		if busy > 0 {
			return conflict("driver already has an active delivery")
		}
		if previous.RequestID == "" {
			if err := tx.Model(&models.Truck{}).Where("request_id = ? AND truck_id <> ?", delivery.RequestID, input.TruckID).Count(&busy).Error; err != nil {
				return err
			}
			if busy > 0 {
				return conflict("delivery is already linked to another truck")
			}
		}
		if previous.TruckID != "" && previous.TruckID != input.TruckID {
			releasedStatus := "available"
			if incident.IncidentID != "" && damagedVehicle(incident.Reason) {
				releasedStatus = "maintenance"
			}
			if err := tx.Model(&models.Truck{}).Where("truck_id = ? AND request_id = ?", previous.TruckID, delivery.RequestID).
				Updates(map[string]any{"request_id": nil, "status": releasedStatus}).Error; err != nil {
				return err
			}
		}
		assignment := models.DeliveryAssignment{RequestID: delivery.RequestID, TruckID: input.TruckID, DriverID: input.DriverID, AssignedAt: time.Now()}
		if previous.TruckID == input.TruckID && previous.DriverID == input.DriverID {
			assignment.AssignedAt = previous.AssignedAt
		}
		if err := tx.Omit(clause.Associations).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "request_id"}}, DoUpdates: clause.AssignmentColumns([]string{"truck_id", "driver_id", "assigned_at"})}).Create(&assignment).Error; err != nil {
			return err
		}
		if err := tx.Model(target).Updates(map[string]any{"driver_id": input.DriverID, "request_id": delivery.RequestID, "status": nextStatus}).Error; err != nil {
			return err
		}
		if err := tx.Model(&delivery).Updates(map[string]any{"supervisor_id": input.SupervisorID, "status": nextStatus}).Error; err != nil {
			return err
		}
		if incident.IncidentID != "" {
			resolution := "resume"
			if incident.TruckID != input.TruckID || incident.DriverID != input.DriverID {
				resolution = "reassign"
			}
			if err := tx.Model(&incident).Updates(map[string]any{"resolved_at": time.Now(), "supervisor_id": input.SupervisorID, "resolution": resolution, "resolution_note": strings.TrimSpace(input.ResolutionNote), "replacement_truck_id": input.TruckID, "replacement_driver_id": input.DriverID}).Error; err != nil {
				return err
			}
		}
		result, err = deliveryDetails(tx, delivery.RequestID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func activeAssignment(tx *gorm.DB, requestID string) (models.DeliveryAssignment, error) {
	var assignment models.DeliveryAssignment
	if err := tx.First(&assignment, "request_id = ?", requestID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return assignment, conflict("delivery has no assignment")
		}
		return assignment, err
	}
	var truck models.Truck
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&truck, "truck_id = ?", assignment.TruckID).Error; err != nil {
		return assignment, err
	}
	if truck.RequestID == nil || *truck.RequestID != requestID {
		return assignment, conflict("truck is no longer assigned to this delivery")
	}
	return assignment, nil
}

func (h *DeliveryController) UpdateStatus(c *gin.Context) {
	var input dto.UpdateDeliveryStatusRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	input.Status = strings.TrimSpace(input.Status)
	if input.Status != "in_transit" && input.Status != "delivered" {
		workflowError(c, invalid("status must be in_transit or delivered"))
		return
	}
	input.DriverID = strings.TrimSpace(input.DriverID)
	if input.DriverID == "" {
		workflowError(c, invalid("driver_id is required to update delivery status"))
		return
	}
	var result dto.DeliveryResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		order, delivery, err := lockDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if delivery.Status == input.Status {
			var assigned models.DeliveryAssignment
			if err := tx.First(&assigned, "request_id = ?", delivery.RequestID).Error; err != nil {
				return err
			}
			if assigned.DriverID != input.DriverID {
				return &requestError{http.StatusForbidden, "only the assigned driver can update delivery status"}
			}
			result, err = deliveryDetails(tx, delivery.RequestID)
			return err
		}
		if !((delivery.Status == "assigned" && input.Status == "in_transit") || (delivery.Status == "in_transit" && input.Status == "delivered")) {
			return conflict("delivery must move from assigned to in_transit to delivered")
		}
		assignment, err := activeAssignment(tx, delivery.RequestID)
		if err != nil {
			return err
		}
		if assignment.DriverID != input.DriverID {
			return &requestError{http.StatusForbidden, "only the assigned driver can update delivery status"}
		}
		truckUpdates := map[string]any{"status": "in_transit"}
		if input.Status == "delivered" {
			truckUpdates = map[string]any{"status": "available", "request_id": nil}
			if err := tx.Model(&order).Update("status", "completed").Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&models.Truck{}).Where("truck_id = ?", assignment.TruckID).Updates(truckUpdates).Error; err != nil {
			return err
		}
		if err := tx.Model(&delivery).Update("status", input.Status).Error; err != nil {
			return err
		}
		result, err = deliveryDetails(tx, delivery.RequestID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *DeliveryController) Cancel(c *gin.Context) {
	var input dto.CancelDeliveryRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	input.SupervisorID, input.Reason = strings.TrimSpace(input.SupervisorID), strings.TrimSpace(input.Reason)
	if input.SupervisorID == "" || input.Reason == "" {
		workflowError(c, invalid("supervisor_id and cancellation reason are required"))
		return
	}
	input.CancelID = strings.TrimSpace(input.CancelID)
	var err error
	if input.CancelID == "" {
		input.CancelID, err = utils.GenerateID("CAN")
	}
	if err != nil {
		workflowError(c, err)
		return
	}
	var result dto.DeliveryResponse
	err = h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		_, delivery, err := lockDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if err := requireReference(tx, "transport_supervisors", "user_id", input.SupervisorID); err != nil {
			return &requestError{http.StatusForbidden, "only a transport supervisor can cancel delivery"}
		}
		if delivery.Status == "cancelled" {
			result, err = deliveryDetails(tx, delivery.RequestID)
			return err
		}
		if delivery.Status != "pending" && delivery.Status != "assigned" && delivery.Status != "on_hold" {
			return conflict("cancellation requires a pending, assigned, or on-hold delivery")
		}
		if delivery.Status == "on_hold" && !input.MaterialsSecured {
			return invalid("confirm material handling before cancelling an interrupted delivery")
		}
		cancellation := models.CancelRequest{CancelID: input.CancelID, RequestID: delivery.RequestID, CancelDate: time.Now(), Reason: input.Reason, SupervisorID: &input.SupervisorID, MaterialsSecured: input.MaterialsSecured}
		if delivery.Status == "assigned" || delivery.Status == "on_hold" {
			assignment, err := activeAssignment(tx, delivery.RequestID)
			if err != nil {
				return err
			}
			cancellation.TruckID = &assignment.TruckID
			var truck models.Truck
			if err := tx.First(&truck, "truck_id = ?", assignment.TruckID).Error; err != nil {
				return err
			}
			releasedStatus := "available"
			if truck.Status == "maintenance" {
				releasedStatus = "maintenance"
			}
			if err := tx.Model(&models.Truck{}).Where("truck_id = ?", assignment.TruckID).Updates(map[string]any{"status": releasedStatus, "request_id": nil}).Error; err != nil {
				return err
			}
		}
		if err := tx.Omit(clause.Associations).Create(&cancellation).Error; err != nil {
			return err
		}
		if err := tx.Model(&delivery).Update("status", "cancelled").Error; err != nil {
			return err
		}
		// Cancellation ends this delivery only; the purchase order stays open.
		if err := tx.Model(&models.DeliveryIncident{}).Where("request_id = ? AND resolved_at IS NULL", delivery.RequestID).Updates(map[string]any{"resolved_at": time.Now(), "supervisor_id": input.SupervisorID, "resolution": "cancelled", "resolution_note": input.Reason}).Error; err != nil {
			return err
		}
		result, err = deliveryDetails(tx, delivery.RequestID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
