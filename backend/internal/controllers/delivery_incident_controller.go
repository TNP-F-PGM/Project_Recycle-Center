package controllers

import (
	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"net/http"
	"strings"
	"time"
)

func damagedVehicle(reason string) bool { return reason == "breakdown" || reason == "accident" }

func (h *DeliveryController) ReportIncident(c *gin.Context) {
	var input struct {
		DriverID string `json:"driver_id"`
		Reason   string `json:"reason"`
		Details  string `json:"details"`
	}
	if !utils.ReadJSON(c, &input) {
		return
	}
	input.DriverID = strings.TrimSpace(input.DriverID)
	input.Details = strings.TrimSpace(input.Details)
	if input.DriverID == "" || input.Details == "" || len([]rune(input.Details)) > 2000 {
		workflowError(c, invalid("driver_id and incident details (1-2000 characters) are required"))
		return
	}
	if input.Reason != "breakdown" && input.Reason != "accident" && input.Reason != "destination_unavailable" && input.Reason != "other" {
		workflowError(c, invalid("invalid incident reason"))
		return
	}
	var result dto.DeliveryResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		_, delivery, err := lockDelivery(tx, c.Param("id"))
		if err != nil {
			return err
		}
		if delivery.Status != "assigned" && delivery.Status != "in_transit" {
			return conflict("incidents can only be reported for assigned or in-transit deliveries")
		}
		assignment, err := activeAssignment(tx, delivery.RequestID)
		if err != nil {
			return err
		}
		if assignment.DriverID != input.DriverID {
			return &requestError{http.StatusForbidden, "only the assigned driver can report an incident"}
		}
		id, err := utils.GenerateID("INC")
		if err != nil {
			return err
		}
		incident := models.DeliveryIncident{IncidentID: id, RequestID: delivery.RequestID, DriverID: assignment.DriverID, TruckID: assignment.TruckID, Reason: input.Reason, Details: input.Details, PreviousStatus: delivery.Status, ReportedAt: time.Now()}
		if err := tx.Omit(clause.Associations).Create(&incident).Error; err != nil {
			return err
		}
		truckStatus := "on_hold"
		if damagedVehicle(input.Reason) {
			truckStatus = "maintenance"
		}
		if err := tx.Model(&models.Truck{}).Where("truck_id = ?", assignment.TruckID).Update("status", truckStatus).Error; err != nil {
			return err
		}
		if err := tx.Model(&delivery).Update("status", "on_hold").Error; err != nil {
			return err
		}
		result, err = deliveryDetails(tx, delivery.RequestID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}
