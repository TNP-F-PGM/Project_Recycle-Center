package controllers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TruckController handles HTTP requests through Gin and persists entities with GORM.
type TruckController struct {
	db *gorm.DB
}

func NewTruckController(db *gorm.DB) *TruckController {
	return &TruckController{db: db}
}

func dataForTruck(truck models.Truck) dto.TruckResponse {
	return dto.TruckResponse{
		TruckID: truck.TruckID, LicensePlate: truck.LicensePlate,
		Status: truck.Status, Capacity: truck.Capacity,
		DriverID: truck.DriverID, RequestID: truck.RequestID,
	}
}

func (h *TruckController) ListTrucks(c *gin.Context) {
	var trucks []models.Truck
	if err := h.db.WithContext(c.Request.Context()).Order("truck_id ASC").Find(&trucks).Error; err != nil {
		log.Printf("list trucks: %v", err)
		utils.WriteError(c, http.StatusInternalServerError, "could not load trucks")
		return
	}
	result := make([]dto.TruckResponse, len(trucks))
	for i, truck := range trucks {
		result[i] = dataForTruck(truck)
	}
	c.JSON(http.StatusOK, result)
}

func (h *TruckController) GetTruck(c *gin.Context) {
	var truck models.Truck
	err := h.db.WithContext(c.Request.Context()).First(&truck, "truck_id = ?", c.Param("id")).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		utils.WriteError(c, http.StatusNotFound, "truck not found")
	case err != nil:
		log.Printf("get truck: %v", err)
		utils.WriteError(c, http.StatusInternalServerError, "could not load truck")
	default:
		c.JSON(http.StatusOK, dataForTruck(truck))
	}
}

func (h *TruckController) UpdateTruck(c *gin.Context) {
	var input dto.UpdateTruckRequest
	if !utils.ReadJSON(c, &input) {
		return
	}

	updates := make(map[string]any)
	for _, field := range []struct {
		name string
		raw  json.RawMessage
	}{
		{"license_plate", input.LicensePlate},
		{"status", input.Status},
	} {
		if len(field.raw) == 0 {
			continue
		}
		var value string
		if err := json.Unmarshal(field.raw, &value); err != nil || strings.TrimSpace(value) == "" {
			utils.WriteError(c, http.StatusBadRequest, field.name+" must be a non-empty string")
			return
		}
		updates[field.name] = strings.TrimSpace(value)
	}
	if len(input.Capacity) > 0 {
		var capacity float64
		if err := json.Unmarshal(input.Capacity, &capacity); err != nil || capacity <= 0 {
			utils.WriteError(c, http.StatusBadRequest, "capacity must be a number greater than 0")
			return
		}
		updates["capacity"] = capacity
	}
	if len(updates) == 0 {
		utils.WriteError(c, http.StatusBadRequest, "provide at least one field: license_plate, status or capacity")
		return
	}

	// Lock the truck so assignment and manual status edits cannot race.
	var truck models.Truck
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&truck, "truck_id = ?", c.Param("id")).Error; err != nil {
			return err
		}
		if status, present := updates["status"]; present && truck.RequestID != nil && status != truck.Status {
			return conflict("change an assigned truck's status through its delivery request")
		}
		return tx.Model(&truck).Clauses(clause.Returning{}).Updates(updates).Error
	})
	switch {
	case errors.Is(err, gorm.ErrDuplicatedKey):
		utils.WriteError(c, http.StatusConflict, "license_plate already exists")
	case errors.Is(err, gorm.ErrRecordNotFound):
		utils.WriteError(c, http.StatusNotFound, "truck not found")
	case err != nil:
		workflowError(c, err)
	default:
		c.JSON(http.StatusOK, dataForTruck(truck))
	}
}

func (h *TruckController) CreateTruck(c *gin.Context) {
	var input dto.CreateTruckRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	if input.RequestID != nil {
		utils.WriteError(c, http.StatusBadRequest, "assign a delivery through /delivery-requests/:id/assignment")
		return
	}
	input.TruckID = strings.TrimSpace(input.TruckID)
	input.LicensePlate = strings.TrimSpace(input.LicensePlate)
	input.Status = strings.TrimSpace(input.Status)
	for _, field := range []struct{ name, value string }{
		{"truck_id", input.TruckID},
		{"license_plate", input.LicensePlate},
		{"status", input.Status},
	} {
		if field.value == "" {
			utils.WriteError(c, http.StatusBadRequest, field.name+" is required")
			return
		}
	}
	if input.Capacity <= 0 {
		utils.WriteError(c, http.StatusBadRequest, "capacity must be greater than 0")
		return
	}
	for _, field := range []struct {
		name  string
		value *string
	}{
		{"driver_id", input.DriverID},
		{"request_id", input.RequestID},
	} {
		if field.value != nil {
			*field.value = strings.TrimSpace(*field.value)
			if *field.value == "" {
				utils.WriteError(c, http.StatusBadRequest, field.name+" must be a non-empty ID or null")
				return
			}
		}
	}

	truck := models.Truck{
		TruckID: input.TruckID, LicensePlate: input.LicensePlate,
		Status: input.Status, Capacity: input.Capacity,
		DriverID: input.DriverID, RequestID: input.RequestID,
	}
	err := h.db.WithContext(c.Request.Context()).Create(&truck).Error
	switch {
	case errors.Is(err, gorm.ErrDuplicatedKey):
		utils.WriteError(c, http.StatusConflict, "truck_id or license_plate already exists")
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		utils.WriteError(c, http.StatusBadRequest, "driver_id or request_id does not exist")
	case err != nil:
		log.Printf("create truck: %v", err)
		utils.WriteError(c, http.StatusInternalServerError, "could not create truck")
	default:
		c.JSON(http.StatusCreated, dataForTruck(truck))
	}
}
