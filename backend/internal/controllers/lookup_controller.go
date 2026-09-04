package controllers

import (
	"net/http"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LookupController struct{ db *gorm.DB }

func NewLookupController(db *gorm.DB) *LookupController { return &LookupController{db: db} }

func (h *LookupController) ListFactories(c *gin.Context) {
	rows := make([]models.Factory, 0)
	if err := h.db.WithContext(c.Request.Context()).Order("factory_id").Find(&rows).Error; err != nil {
		workflowError(c, err)
		return
	}
	result := make([]dto.FactoryResponse, 0, len(rows))
	for i := range rows {
		result = append(result, *factoryResponse(&rows[i]))
	}
	c.JSON(http.StatusOK, result)
}

func factoryResponse(factory *models.Factory) *dto.FactoryResponse {
	if factory == nil {
		return nil
	}
	return &dto.FactoryResponse{
		FactoryID: factory.FactoryID, CompanyName: factory.CompanyName,
		ContactPerson: factory.ContactPerson, Phone: factory.Phone, Address: factory.Address,
		Latitude: factory.Latitude, Longitude: factory.Longitude,
	}
}

func (h *LookupController) ListMaterials(c *gin.Context) {
	rows := make([]dto.MaterialResponse, 0)
	err := h.db.WithContext(c.Request.Context()).Table("materials AS m").
		Select("m.material_id, m.material_name, m.unit, m.status, m.grade, m.min_stock_level, m.material_type_id, t.type_name").
		Joins("LEFT JOIN material_types AS t ON t.type_id = m.material_type_id").Order("m.material_id").Scan(&rows).Error
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *LookupController) employees(c *gin.Context, table, role string) {
	rows := make([]dto.EmployeeResponse, 0)
	err := h.db.WithContext(c.Request.Context()).Table(table+" AS e").
		Select("e.employee_id, e.user_id, u.name, e.position, e.hire_date").
		Joins("JOIN users AS u ON u.user_id = e.user_id").Where("u.role = ?", role).
		Order("e.employee_id").Scan(&rows).Error
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *LookupController) ListSalesStaff(c *gin.Context) {
	h.employees(c, "sales_staff", "sales")
}

func (h *LookupController) ListSupervisors(c *gin.Context) {
	h.employees(c, "transport_supervisors", "transport_supervisor")
}
