package controllers

import (
	"github.com/SA-1-69/T20/backend/internal/codes"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
	"time"
)

func (h *Handler) assignGeneratedCode(c *gin.Context, value *string, kind, warehouseID string) bool {
	if nonBlank(*value) {
		return true
	}
	code, err := codes.Next(h.DB.WithContext(c.Request.Context()), kind, strings.TrimSpace(warehouseID), time.Now())
	if err != nil {
		writeDatabaseFailure(c, err)
		return false
	}
	*value = code
	return true
}

// Legacy POST and GET both preview the next number without allocating it.
func (h *Handler) ReserveDocumentCode(c *gin.Context) {
	var request struct {
		Kind        string `json:"kind"`
		WarehouseID string `json:"warehouseID"`
	}
	if c.Request.Method == http.MethodGet {
		request.Kind = c.Query("kind")
		request.WarehouseID = c.Query("warehouseID")
	} else if !bindJSON(c, &request) {
		return
	}
	if !codes.ValidKind(request.Kind) {
		validationFailure(c, map[string]string{"kind": "ประเภทเอกสารไม่ถูกต้อง"})
		return
	}
	if request.Kind == "zone" && !nonBlank(request.WarehouseID) {
		validationFailure(c, map[string]string{"warehouseID": "กรุณาเลือกคลังก่อนสร้างรหัสโซน"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if request.Kind == "zone" {
		var count int64
		if err := h.DB.WithContext(c.Request.Context()).Model(&models.Warehouse{}).Where("warehouse_id = ?", strings.TrimSpace(request.WarehouseID)).Count(&count).Error; err != nil {
			readDatabaseFailure(c)
			return
		}
		if count == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบคลังสินค้า", nil)
			return
		}
	}
	code, err := codes.Preview(h.DB.WithContext(c.Request.Context()), request.Kind, strings.TrimSpace(request.WarehouseID), time.Now())
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	c.Header("Cache-Control", "no-store")
	status := http.StatusOK
	if c.Request.Method == http.MethodPost {
		status = http.StatusCreated
	}
	Success(c, status, gin.H{"code": code}, "อ่านรหัสถัดไปสำเร็จ")
}
