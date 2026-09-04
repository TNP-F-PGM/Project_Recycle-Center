package controllers

import (
	"net/http"
	"strings"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type FactoryController struct{ db *gorm.DB }

func NewFactoryController(db *gorm.DB) *FactoryController { return &FactoryController{db: db} }

func factoryCoordinates(latitude, longitude *float64) error {
	if latitude == nil || longitude == nil {
		return invalid("factory latitude and longitude are required")
	}
	return checkCoordinates(latitude, longitude)
}

func (h *FactoryController) Get(c *gin.Context) {
	var factory models.Factory
	if err := h.db.WithContext(c.Request.Context()).First(&factory, "factory_id = ?", c.Param("id")).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, factoryResponse(&factory))
}

func (h *FactoryController) Create(c *gin.Context) {
	var input dto.CreateFactoryRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	for _, field := range []struct {
		name  string
		value *string
	}{
		{"company_name", &input.CompanyName}, {"contact_person", &input.ContactPerson}, {"phone", &input.Phone}, {"address", &input.Address},
	} {
		value, err := requireText(*field.value, field.name)
		if err != nil {
			workflowError(c, err)
			return
		}
		*field.value = value
	}
	if err := factoryCoordinates(input.Latitude, input.Longitude); err != nil {
		workflowError(c, err)
		return
	}
	input.FactoryID = strings.TrimSpace(input.FactoryID)
	if input.FactoryID == "" {
		var err error
		input.FactoryID, err = utils.GenerateID("FAC")
		if err != nil {
			workflowError(c, err)
			return
		}
	}
	factory := models.Factory{FactoryID: input.FactoryID, CompanyName: input.CompanyName, ContactPerson: input.ContactPerson, Phone: input.Phone, Address: input.Address, Latitude: input.Latitude, Longitude: input.Longitude}
	if err := h.db.WithContext(c.Request.Context()).Create(&factory).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusCreated, factoryResponse(&factory))
}

func (h *FactoryController) Update(c *gin.Context) {
	var input dto.UpdateFactoryRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	updates := make(map[string]any)
	for _, field := range []struct {
		name  string
		value dto.PatchField[string]
	}{
		{"company_name", input.CompanyName}, {"contact_person", input.ContactPerson}, {"phone", input.Phone}, {"address", input.Address},
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
	if input.Latitude.Present != input.Longitude.Present {
		workflowError(c, invalid("provide both factory coordinates"))
		return
	}
	if input.Latitude.Present {
		if err := factoryCoordinates(&input.Latitude.Value, &input.Longitude.Value); err != nil {
			workflowError(c, err)
			return
		}
		updates["latitude"], updates["longitude"] = input.Latitude.Value, input.Longitude.Value
	}
	if len(updates) == 0 {
		workflowError(c, invalid("provide at least one factory field"))
		return
	}
	var factory models.Factory
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&factory, "factory_id = ?", c.Param("id")).Error; err != nil {
			return err
		}
		if !input.Latitude.Present && (factory.Latitude == nil || factory.Longitude == nil) {
			return invalid("factory latitude and longitude are required")
		}
		// Existing delivery requests keep their original destination snapshot.
		return tx.Model(&factory).Clauses(clause.Returning{}).Updates(updates).Error
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, factoryResponse(&factory))
}
