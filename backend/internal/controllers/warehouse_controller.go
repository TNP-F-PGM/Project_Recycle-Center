package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const storageZoneStatusAvailable = "available"

type createWarehouseRequest struct {
	WarehouseID   string  `json:"warehouseID"`
	TotalCapacity float64 `json:"totalCapacity"`
	MinStock      float64 `json:"minStock"`
	Unit          string  `json:"unit"`
}

type updateWarehouseRequest struct {
	TotalCapacity *float64 `json:"totalCapacity"`
	MinStock      *float64 `json:"minStock"`
	Unit          *string  `json:"unit"`
}

type createStorageZoneRequest struct {
	ZoneID         string  `json:"zoneID"`
	ZoneName       string  `json:"zoneName"`
	Capacity       float64 `json:"capacity"`
	SupportedGrade string  `json:"supportedGrade"`
	StockStatus    string  `json:"stockStatus"`
	WarehouseID    string  `json:"warehouseID"`
	MaterialTypeID int     `json:"materialTypeID"`
	MaterialID     string  `json:"materialID"`
}

type updateStorageZoneRequest struct {
	ZoneName       *string  `json:"zoneName"`
	Capacity       *float64 `json:"capacity"`
	SupportedGrade *string  `json:"supportedGrade"`
	StockStatus    *string  `json:"stockStatus"`
}

type eligibleStorageZoneResponse struct {
	ZoneID            string  `json:"zoneID"`
	ZoneName          string  `json:"zoneName"`
	Capacity          float64 `json:"capacity"`
	QuantityOnHand    float64 `json:"quantityOnHand"`
	AvailableCapacity float64 `json:"availableCapacity"`
	SupportedGrade    string  `json:"supportedGrade"`
	StockStatus       string  `json:"stockStatus"`
}

type eligibleWarehouseResponse struct {
	WarehouseID     string                        `json:"warehouseID"`
	CurrentQuantity float64                       `json:"currentQuantity"`
	TotalCapacity   float64                       `json:"totalCapacity"`
	Unit            string                        `json:"unit"`
	Zones           []eligibleStorageZoneResponse `json:"zones"`
}

func (h *Handler) CreateWarehouse(c *gin.Context) {
	var request createWarehouseRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)

	if request.TotalCapacity < 0 {
		fields["totalCapacity"] = "ต้องไม่น้อยกว่า 0"
	}
	if request.MinStock < 0 {
		fields["minStock"] = "ต้องไม่น้อยกว่า 0"
	}
	if !nonBlank(request.Unit) {
		fields["unit"] = "กรุณาระบุหน่วย"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.WarehouseID, "warehouse", "") {
		return
	}
	warehouse := models.Warehouse{
		WarehouseID:     strings.TrimSpace(request.WarehouseID),
		CurrentQuantity: 0,
		TotalCapacity:   request.TotalCapacity,
		LastUpdated:     time.Now().UTC(),
		MinStock:        request.MinStock,
		Unit:            strings.TrimSpace(request.Unit),
	}
	if err := h.DB.Create(&warehouse).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, warehouse, "สร้างคลังสำเร็จ")
}

func (h *Handler) ListWarehouses(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var warehouses []models.Warehouse
	if err := h.DB.Order("warehouse_id ASC").Find(&warehouses).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, warehouses, "อ่านรายการคลังสำเร็จ")
}

func (h *Handler) GetWarehouse(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	warehouseID := strings.TrimSpace(c.Param("warehouseID"))
	var warehouse models.Warehouse
	result := h.DB.Preload("StorageZones").First(&warehouse, "warehouse_id = ?", warehouseID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบคลัง", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, warehouse, "อ่านข้อมูลคลังสำเร็จ")
}

func (h *Handler) UpdateWarehouse(c *gin.Context) {
	var request updateWarehouseRequest
	if !bindJSON(c, &request) {
		return
	}
	updates := make(map[string]any)
	fields := make(map[string]string)
	if request.TotalCapacity != nil {
		if *request.TotalCapacity < 0 {
			fields["totalCapacity"] = "ต้องไม่น้อยกว่า 0"
		} else {
			updates["total_capacity"] = *request.TotalCapacity
		}
	}
	if request.MinStock != nil {
		if *request.MinStock < 0 {
			fields["minStock"] = "ต้องไม่น้อยกว่า 0"
		} else {
			updates["min_stock"] = *request.MinStock
		}
	}
	if request.Unit != nil {
		if !nonBlank(*request.Unit) {
			fields["unit"] = "ห้ามเป็นค่าว่าง"
		} else {
			updates["unit"] = strings.TrimSpace(*request.Unit)
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
	updates["last_updated"] = time.Now().UTC()
	if !h.databaseReady(c) {
		return
	}
	warehouseID := strings.TrimSpace(c.Param("warehouseID"))
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		warehouse, err := lockCapacityWarehouse(tx, warehouseID)
		if err != nil {
			return err
		}
		var allocated float64
		if err := tx.Model(&models.StorageZone{}).Where("warehouse_id = ?", warehouseID).Select("COALESCE(SUM(capacity),0)").Scan(&allocated).Error; err != nil {
			return err
		}
		if request.TotalCapacity != nil && (*request.TotalCapacity < allocated || *request.TotalCapacity < warehouse.CurrentQuantity) {
			return capacityFailure("totalCapacity", "ความจุคลังต้องไม่น้อยกว่าความจุรวมของโซนและยอดคงเหลือปัจจุบัน")
		}
		if request.Unit != nil && !strings.EqualFold(strings.TrimSpace(*request.Unit), strings.TrimSpace(warehouse.Unit)) {
			var count int64
			if err := tx.Model(&models.StorageZone{}).Where("warehouse_id = ?", warehouseID).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 || warehouse.CurrentQuantity > 0 {
				return capacityFailure("unit", "ไม่สามารถเปลี่ยนหน่วยคลังที่มีโซนหรือวัสดุคงเหลือ")
			}
		}
		return tx.Model(&models.Warehouse{}).Where("warehouse_id = ?", warehouseID).Updates(updates).Error
	})
	if err != nil {
		if !respondOperationError(c, err) {
			writeDatabaseFailure(c, err)
		}
		return
	}
	var warehouse models.Warehouse
	if err := h.DB.First(&warehouse, "warehouse_id = ?", warehouseID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, warehouse, "แก้ไขคลังสำเร็จ")
}

func (h *Handler) DeleteWarehouse(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	warehouseID := strings.TrimSpace(c.Param("warehouseID"))
	result := h.DB.Delete(&models.Warehouse{}, "warehouse_id = ?", warehouseID)
	if result.Error != nil {
		deleteDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบคลัง", nil)
		return
	}
	Success(c, http.StatusOK, gin.H{"warehouseID": warehouseID}, "ลบคลังสำเร็จ")
}

func (h *Handler) CreateStorageZone(c *gin.Context) {
	var request createStorageZoneRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := validateStorageZoneCreate(request)
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.ZoneID, "zone", request.WarehouseID) {
		return
	}
	zone := models.StorageZone{
		ZoneID:         strings.TrimSpace(request.ZoneID),
		ZoneName:       strings.TrimSpace(request.ZoneName),
		Capacity:       request.Capacity,
		SupportedGrade: strings.TrimSpace(request.SupportedGrade),
		LastUpdated:    time.Now().UTC(),
		StockStatus:    strings.TrimSpace(request.StockStatus),
		QuantityOnHand: 0,
		WarehouseID:    strings.TrimSpace(request.WarehouseID),
		MaterialTypeID: request.MaterialTypeID,
		MaterialID:     strings.TrimSpace(request.MaterialID),
	}
	if err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := checkZoneAllocation(tx, zone); err != nil {
			return err
		}
		return tx.Create(&zone).Error
	}); err != nil {
		if !respondOperationError(c, err) {
			writeDatabaseFailure(c, err)
		}
		return
	}
	if err := h.DB.Preload("Warehouse").Preload("MaterialType").Preload("Material").First(&zone, "zone_id = ?", zone.ZoneID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, zone, "สร้างพื้นที่จัดเก็บสำเร็จ")
}

func validateStorageZoneCreate(request createStorageZoneRequest) map[string]string {
	fields := make(map[string]string)

	if !nonBlank(request.ZoneName) {
		fields["zoneName"] = "กรุณาระบุชื่อพื้นที่จัดเก็บ"
	}
	if request.Capacity < 0 {
		fields["capacity"] = "ต้องไม่น้อยกว่า 0"
	}
	if !nonBlank(request.SupportedGrade) {
		fields["supportedGrade"] = "กรุณาระบุเกรดที่รองรับ"
	}
	if !nonBlank(request.StockStatus) {
		fields["stockStatus"] = "กรุณาระบุสถานะสต๊อก"
	}
	if !nonBlank(request.WarehouseID) {
		fields["warehouseID"] = "กรุณาระบุรหัสคลัง"
	}
	if request.MaterialTypeID <= 0 {
		fields["materialTypeID"] = "ต้องเป็นจำนวนเต็มมากกว่า 0"
	}
	if !nonBlank(request.MaterialID) {
		fields["materialID"] = "กรุณาระบุรหัสวัสดุ"
	}
	return fields
}

func (h *Handler) ListStorageZones(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	materialID := strings.TrimSpace(c.Query("materialID"))
	var zones []models.StorageZone
	query := h.DB.Preload("Warehouse").Preload("MaterialType").Preload("Material").Order("zone_id ASC")
	if materialID != "" {
		query = query.Where("material_id = ?", materialID)
	}
	if err := query.Find(&zones).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, zones, "อ่านรายการพื้นที่จัดเก็บสำเร็จ")
}

func (h *Handler) GetStorageZone(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	zoneID := strings.TrimSpace(c.Param("zoneID"))
	var zone models.StorageZone
	result := h.DB.Preload("Warehouse").Preload("MaterialType").Preload("Material").First(&zone, "zone_id = ?", zoneID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, zone, "อ่านข้อมูลพื้นที่จัดเก็บสำเร็จ")
}

func (h *Handler) ListEligibleStorageZones(c *gin.Context) {
	pendingID, ok := parsePositiveIntParam(c, "pendingID")
	if !ok || !h.databaseReady(c) {
		return
	}

	var pending models.PendingWarehouseItem
	result := h.DB.First(&pending, "pending_id = ?", pendingID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการรอรับเข้าคลัง", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	if pending.ReceivingStatus != pendingStatusWaitingReceipt {
		Failure(c, http.StatusConflict, "workflow_conflict", "รายการนี้ถูกรับเข้าคลังแล้ว", nil)
		return
	}

	var zones []models.StorageZone
	if err := h.DB.Preload("Warehouse").
		Where("material_id = ?", pending.MaterialID).
		Where("supported_grade = ?", pending.AssessedGrade).
		Where("stock_status = ?", storageZoneStatusAvailable).
		Where("quantity_on_hand < capacity").
		Order("warehouse_id ASC, zone_id ASC").
		Find(&zones).Error; err != nil {
		readDatabaseFailure(c)
		return
	}

	warehouses := make([]eligibleWarehouseResponse, 0)
	warehouseIndexes := make(map[string]int)
	for _, zone := range zones {
		index, exists := warehouseIndexes[zone.WarehouseID]
		if !exists {
			warehouse := eligibleWarehouseResponse{
				WarehouseID: zone.WarehouseID,
				Zones:       make([]eligibleStorageZoneResponse, 0),
			}
			if zone.Warehouse != nil {
				warehouse.CurrentQuantity = zone.Warehouse.CurrentQuantity
				warehouse.TotalCapacity = zone.Warehouse.TotalCapacity
				warehouse.Unit = zone.Warehouse.Unit
			}
			warehouses = append(warehouses, warehouse)
			index = len(warehouses) - 1
			warehouseIndexes[zone.WarehouseID] = index
		}
		warehouses[index].Zones = append(warehouses[index].Zones, eligibleStorageZoneResponse{
			ZoneID:            zone.ZoneID,
			ZoneName:          zone.ZoneName,
			Capacity:          zone.Capacity,
			QuantityOnHand:    zone.QuantityOnHand,
			AvailableCapacity: zone.Capacity - zone.QuantityOnHand,
			SupportedGrade:    zone.SupportedGrade,
			StockStatus:       zone.StockStatus,
		})
	}

	Success(c, http.StatusOK, warehouses, "อ่านคลังและพื้นที่จัดเก็บที่รองรับรายการสำเร็จ")
}

func (h *Handler) UpdateStorageZone(c *gin.Context) {
	var request updateStorageZoneRequest
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
	addStringUpdate("zone_name", "zoneName", request.ZoneName)
	addStringUpdate("supported_grade", "supportedGrade", request.SupportedGrade)
	addStringUpdate("stock_status", "stockStatus", request.StockStatus)
	if request.Capacity != nil {
		if *request.Capacity < 0 {
			fields["capacity"] = "ต้องไม่น้อยกว่า 0"
		} else {
			updates["capacity"] = *request.Capacity
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
	zoneID := strings.TrimSpace(c.Param("zoneID"))
	var zone models.StorageZone
	updates["last_updated"] = time.Now().UTC()
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&zone, "zone_id = ?", zoneID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newOperationError(http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
			}
			return err
		}
		if request.Capacity != nil {
			if *request.Capacity < zone.QuantityOnHand {
				return capacityFailure("capacity", "ต้องไม่น้อยกว่าจำนวนคงเหลือปัจจุบัน")
			}
			zone.Capacity = *request.Capacity
			if err := checkZoneAllocation(tx, zone); err != nil {
				return err
			}
		}
		if request.SupportedGrade != nil && strings.TrimSpace(*request.SupportedGrade) != zone.SupportedGrade && zone.QuantityOnHand > 0 {
			return newOperationError(http.StatusConflict, "zone_not_empty", "ไม่สามารถเปลี่ยนเกรดของพื้นที่ที่ยังมีวัสดุคงเหลือ", nil)
		}
		return tx.Model(&models.StorageZone{}).Where("zone_id = ?", zoneID).Updates(updates).Error
	})
	if err != nil {
		if !respondOperationError(c, err) {
			writeDatabaseFailure(c, err)
		}
		return
	}
	if err := h.DB.Preload("Warehouse").Preload("MaterialType").Preload("Material").First(&zone, "zone_id = ?", zoneID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, zone, "แก้ไขพื้นที่จัดเก็บสำเร็จ")
}

func (h *Handler) DeleteStorageZone(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	zoneID := strings.TrimSpace(c.Param("zoneID"))
	result := h.DB.Delete(&models.StorageZone{}, "zone_id = ?", zoneID)
	if result.Error != nil {
		deleteDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
		return
	}
	Success(c, http.StatusOK, gin.H{"zoneID": zoneID}, "ลบพื้นที่จัดเก็บสำเร็จ")
}
