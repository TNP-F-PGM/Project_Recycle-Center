package controllers

import (
	"net/http"
	"strings"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type createMaterialTypeRequest struct {
	TypeName string `json:"typeName"`
}

type updateMaterialTypeRequest struct {
	TypeName *string `json:"typeName"`
}

type createMaterialRequest struct {
	MaterialID     string `json:"materialID"`
	MaterialName   string `json:"materialName"`
	Unit           string `json:"unit"`
	Status         string `json:"status"`
	MaterialTypeID int    `json:"materialTypeID"`
}

type updateMaterialRequest struct {
	MaterialName   *string `json:"materialName"`
	Unit           *string `json:"unit"`
	Status         *string `json:"status"`
	MaterialTypeID *int    `json:"materialTypeID"`
}

type updateMaterialMinimumStockRequest struct {
	MinStockLevel *float64 `json:"minStockLevel"`
}

type warehouseStockResponse struct {
	WarehouseID string  `json:"warehouseID"`
	Quantity    float64 `json:"quantity"`
}

type materialStockSummaryResponse struct {
	MaterialID             string                   `json:"materialID"`
	MaterialName           string                   `json:"materialName"`
	Unit                   string                   `json:"unit"`
	Status                 string                   `json:"status"`
	Grade                  string                   `json:"grade"`
	CurrentQuantity        float64                  `json:"currentQuantity"`
	MinStockLevel          float64                  `json:"minStockLevel"`
	MinimumStockConfigured bool                     `json:"minimumStockConfigured"`
	BelowMin               bool                     `json:"belowMin"`
	MaterialTypeID         int                      `json:"materialTypeID"`
	MaterialType           *models.MaterialType     `json:"materialType,omitempty"`
	WarehouseStocks        []warehouseStockResponse `json:"warehouseStocks"`
}

type materialWarehouseStockRow struct {
	MaterialID     string
	MaterialName   string
	Unit           string
	Status         string
	MinStockLevel  float64
	MaterialTypeID int
	TypeName       string
	Grade          string
	WarehouseID    string
	Quantity       float64
}

func (h *Handler) CreateMaterialType(c *gin.Context) {
	var request createMaterialTypeRequest
	if !bindJSON(c, &request) {
		return
	}
	if !nonBlank(request.TypeName) {
		validationFailure(c, map[string]string{"typeName": "กรุณาระบุชื่อประเภทวัสดุ"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	materialType := models.MaterialType{TypeName: strings.TrimSpace(request.TypeName)}
	if err := h.DB.Create(&materialType).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, materialType, "สร้างประเภทวัสดุสำเร็จ")
}

func (h *Handler) ListMaterialTypes(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var materialTypes []models.MaterialType
	if err := h.DB.Order("type_id ASC").Find(&materialTypes).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, materialTypes, "อ่านรายการประเภทวัสดุสำเร็จ")
}

func (h *Handler) GetMaterialType(c *gin.Context) {
	typeID, ok := parsePositiveIntParam(c, "typeID")
	if !ok || !h.databaseReady(c) {
		return
	}
	var materialType models.MaterialType
	result := h.DB.First(&materialType, "type_id = ?", typeID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบประเภทวัสดุ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, materialType, "อ่านข้อมูลประเภทวัสดุสำเร็จ")
}

func (h *Handler) UpdateMaterialType(c *gin.Context) {
	typeID, ok := parsePositiveIntParam(c, "typeID")
	if !ok {
		return
	}
	var request updateMaterialTypeRequest
	if !bindJSON(c, &request) {
		return
	}
	if request.TypeName == nil || !nonBlank(*request.TypeName) {
		validationFailure(c, map[string]string{"typeName": "กรุณาระบุชื่อประเภทวัสดุ"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	result := h.DB.Model(&models.MaterialType{}).Where("type_id = ?", typeID).Update("type_name", strings.TrimSpace(*request.TypeName))
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบประเภทวัสดุ", nil)
		return
	}
	var materialType models.MaterialType
	if err := h.DB.First(&materialType, "type_id = ?", typeID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, materialType, "แก้ไขประเภทวัสดุสำเร็จ")
}

func (h *Handler) DeleteMaterialType(c *gin.Context) {
	typeID, ok := parsePositiveIntParam(c, "typeID")
	if !ok || !h.databaseReady(c) {
		return
	}
	result := h.DB.Delete(&models.MaterialType{}, "type_id = ?", typeID)
	if result.Error != nil {
		deleteDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบประเภทวัสดุ", nil)
		return
	}
	Success(c, http.StatusOK, gin.H{"typeID": typeID}, "ลบประเภทวัสดุสำเร็จ")
}

func (h *Handler) CreateMaterial(c *gin.Context) {
	var request createMaterialRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := validateMaterialCreate(request)
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.MaterialID, "material", "") {
		return
	}
	material := models.Material{
		MaterialID:     strings.TrimSpace(request.MaterialID),
		MaterialName:   strings.TrimSpace(request.MaterialName),
		Unit:           strings.TrimSpace(request.Unit),
		Status:         strings.TrimSpace(request.Status),
		MinStockLevel:  0,
		MaterialTypeID: request.MaterialTypeID,
	}
	if err := h.DB.Create(&material).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	if err := h.DB.Preload("MaterialType").First(&material, "material_id = ?", material.MaterialID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, material, "สร้างวัสดุสำเร็จ")
}

func validateMaterialCreate(request createMaterialRequest) map[string]string {
	fields := make(map[string]string)

	if !nonBlank(request.MaterialName) {
		fields["materialName"] = "กรุณาระบุชื่อวัสดุ"
	}
	if !nonBlank(request.Unit) {
		fields["unit"] = "กรุณาระบุหน่วย"
	}
	if !nonBlank(request.Status) {
		fields["status"] = "กรุณาระบุสถานะ"
	}
	if request.MaterialTypeID <= 0 {
		fields["materialTypeID"] = "ต้องเป็นจำนวนเต็มมากกว่า 0"
	}
	return fields
}

func (h *Handler) ListMaterials(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	include := strings.TrimSpace(c.Query("include"))
	belowMinFilter := strings.TrimSpace(c.Query("belowMin"))
	if include != "" && include != "stock" {
		validationFailure(c, map[string]string{"include": "รองรับเฉพาะค่า stock"})
		return
	}
	if belowMinFilter != "" && belowMinFilter != "true" && belowMinFilter != "false" {
		validationFailure(c, map[string]string{"belowMin": "ต้องเป็น true หรือ false"})
		return
	}
	if belowMinFilter != "" && include != "stock" {
		validationFailure(c, map[string]string{"include": "ต้องใช้ include=stock เมื่อกรอง belowMin"})
		return
	}
	if include == "stock" {
		h.listMaterialStockSummaries(c, belowMinFilter)
		return
	}
	var materials []models.Material
	if err := h.DB.Preload("MaterialType").Order("material_id ASC").Find(&materials).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, materials, "อ่านรายการวัสดุสำเร็จ")
}

func (h *Handler) listMaterialStockSummaries(c *gin.Context, belowMinFilter string) {
	var rows []materialWarehouseStockRow
	err := h.DB.Table("materials AS material").
		Select(`
			material.material_id,
			material.material_name,
			material.unit,
			material.status,
			material.min_stock_level,
			material.material_type_id,
			material_type.type_name,
			zone.supported_grade AS grade,
			zone.warehouse_id,
			SUM(zone.quantity_on_hand) AS quantity
		`).
		Joins("JOIN storage_zones AS zone ON zone.material_id = material.material_id").
		Joins("JOIN material_types AS material_type ON material_type.type_id = material.material_type_id").
		Group(`
			material.material_id,
			material.material_name,
			material.unit,
			material.status,
			material.min_stock_level,
			material.material_type_id,
			material_type.type_name,
			zone.supported_grade,
			zone.warehouse_id
		`).
		Order("material.material_id ASC, zone.supported_grade ASC, zone.warehouse_id ASC").
		Scan(&rows).Error
	if err != nil {
		readDatabaseFailure(c)
		return
	}

	summaries := make([]materialStockSummaryResponse, 0)
	summaryIndexes := make(map[string]int)
	for _, row := range rows {
		key := row.MaterialID + "\x00" + row.Grade
		index, exists := summaryIndexes[key]
		if !exists {
			configured := row.MinStockLevel > 0
			summaries = append(summaries, materialStockSummaryResponse{
				MaterialID:             row.MaterialID,
				MaterialName:           row.MaterialName,
				Unit:                   row.Unit,
				Status:                 row.Status,
				Grade:                  row.Grade,
				MinStockLevel:          row.MinStockLevel,
				MinimumStockConfigured: configured,
				MaterialTypeID:         row.MaterialTypeID,
				MaterialType: &models.MaterialType{
					TypeID:   row.MaterialTypeID,
					TypeName: row.TypeName,
				},
				WarehouseStocks: make([]warehouseStockResponse, 0),
			})
			index = len(summaries) - 1
			summaryIndexes[key] = index
		}
		summaries[index].CurrentQuantity += row.Quantity
		summaries[index].WarehouseStocks = append(summaries[index].WarehouseStocks, warehouseStockResponse{
			WarehouseID: row.WarehouseID,
			Quantity:    row.Quantity,
		})
	}

	filtered := make([]materialStockSummaryResponse, 0, len(summaries))
	for _, summary := range summaries {
		summary.BelowMin = summary.MinimumStockConfigured && summary.CurrentQuantity < summary.MinStockLevel
		if belowMinFilter == "true" && !summary.BelowMin {
			continue
		}
		if belowMinFilter == "false" && summary.BelowMin {
			continue
		}
		filtered = append(filtered, summary)
	}

	Success(c, http.StatusOK, filtered, "อ่านรายการวัสดุพร้อมยอดคงเหลือสำเร็จ")
}

func (h *Handler) GetMaterial(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	materialID := strings.TrimSpace(c.Param("materialID"))
	var material models.Material
	result := h.DB.Preload("MaterialType").First(&material, "material_id = ?", materialID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบวัสดุ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, material, "อ่านข้อมูลวัสดุสำเร็จ")
}

func (h *Handler) UpdateMaterial(c *gin.Context) {
	var request updateMaterialRequest
	if !bindJSON(c, &request) {
		return
	}
	updates := make(map[string]any)
	fields := make(map[string]string)
	addStringUpdate := func(column, jsonName string, value *string) {
		if value == nil {
			return
		}
		if !nonBlank(*value) {
			fields[jsonName] = "ห้ามเป็นค่าว่าง"
			return
		}
		updates[column] = strings.TrimSpace(*value)
	}
	addStringUpdate("material_name", "materialName", request.MaterialName)
	addStringUpdate("unit", "unit", request.Unit)
	addStringUpdate("status", "status", request.Status)
	if request.MaterialTypeID != nil {
		if *request.MaterialTypeID <= 0 {
			fields["materialTypeID"] = "ต้องเป็นจำนวนเต็มมากกว่า 0"
		} else {
			updates["material_type_id"] = *request.MaterialTypeID
		}
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if len(updates) == 0 {
		validationFailure(c, map[string]string{"body": "กรุณาระบุข้อมูลที่ต้องการแก้ไข"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	materialID := strings.TrimSpace(c.Param("materialID"))
	result := h.DB.Model(&models.Material{}).Where("material_id = ?", materialID).Updates(updates)
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบวัสดุ", nil)
		return
	}
	var material models.Material
	if err := h.DB.Preload("MaterialType").First(&material, "material_id = ?", materialID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, material, "แก้ไขวัสดุสำเร็จ")
}

func (h *Handler) UpdateMaterialMinimumStock(c *gin.Context) {
	var request updateMaterialMinimumStockRequest
	if !bindJSON(c, &request) {
		return
	}
	if request.MinStockLevel == nil {
		validationFailure(c, map[string]string{"minStockLevel": "กรุณาระบุเกณฑ์สต็อกขั้นต่ำ"})
		return
	}
	if *request.MinStockLevel <= 0 {
		validationFailure(c, map[string]string{"minStockLevel": "เกณฑ์ขั้นต่ำต้องมากกว่า 0"})
		return
	}
	if !h.databaseReady(c) {
		return
	}

	materialID := strings.TrimSpace(c.Param("materialID"))
	result := h.DB.Model(&models.Material{}).
		Where("material_id = ?", materialID).
		Update("min_stock_level", *request.MinStockLevel)
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบวัสดุ", nil)
		return
	}

	var material models.Material
	if err := h.DB.Preload("MaterialType").First(&material, "material_id = ?", materialID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, material, "กำหนดเกณฑ์สต็อกขั้นต่ำสำเร็จ")
}

func (h *Handler) DeleteMaterial(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	materialID := strings.TrimSpace(c.Param("materialID"))
	result := h.DB.Delete(&models.Material{}, "material_id = ?", materialID)
	if result.Error != nil {
		deleteDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบวัสดุ", nil)
		return
	}
	Success(c, http.StatusOK, gin.H{"materialID": materialID}, "ลบวัสดุสำเร็จ")
}
