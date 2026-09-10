package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/SA-1-69/T20/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func capacityFailure(field, message string) error {
	return newOperationError(http.StatusUnprocessableEntity, "validation_error", "ข้อมูลไม่ถูกต้อง", map[string]string{field: message})
}

func lockCapacityWarehouse(tx *gorm.DB, id string) (models.Warehouse, error) {
	var warehouse models.Warehouse
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&warehouse, "warehouse_id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = newOperationError(http.StatusNotFound, "not_found", "ไม่พบคลัง", nil)
	}
	return warehouse, err
}

// All capacity writers lock the parent before checking allocations. Updates to
// existing zones lock zone then warehouse, matching stock transaction lock order.
func checkZoneAllocation(tx *gorm.DB, zone models.StorageZone) error {
	warehouse, err := lockCapacityWarehouse(tx, zone.WarehouseID)
	if err != nil {
		return err
	}
	var material models.Material
	if err := tx.First(&material, "material_id = ?", zone.MaterialID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return capacityFailure("materialID", "ไม่พบวัสดุ")
		}
		return err
	}
	if !strings.EqualFold(strings.TrimSpace(material.Unit), strings.TrimSpace(warehouse.Unit)) {
		return capacityFailure("materialID", "หน่วยวัสดุต้องตรงกับหน่วยความจุคลัง")
	}
	var allocated float64
	if err := tx.Model(&models.StorageZone{}).Where("warehouse_id = ? AND zone_id <> ?", zone.WarehouseID, zone.ZoneID).Select("COALESCE(SUM(capacity), 0)").Scan(&allocated).Error; err != nil {
		return err
	}
	if allocated+zone.Capacity > warehouse.TotalCapacity {
		return capacityFailure("capacity", fmt.Sprintf("ความจุโซนต้องไม่เกิน %g %s ที่ยังแบ่งได้", max(0, warehouse.TotalCapacity-allocated), warehouse.Unit))
	}
	return nil
}
