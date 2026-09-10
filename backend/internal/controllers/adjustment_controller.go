package controllers

import (
	"errors"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	adjustmentStatusPending  = "pending"
	adjustmentStatusApproved = "approved"
	adjustmentStatusRejected = "rejected"
)

type createAdjustmentRequest struct {
	CountedQuantity float64 `json:"countedQuantity"`
	Description     string  `json:"description"`
	AttachmentURL   *string `json:"attachmentURL"`
	EmployeeID      string  `json:"employeeID"`
}

type decideAdjustmentRequest struct {
	EmployeeID       string   `json:"employeeID"`
	Decision         string   `json:"decision"`
	ApprovedQuantity *float64 `json:"approvedQuantity"`
	DecisionReason   *string  `json:"decisionReason"`
}

func (h *Handler) CreateStockAdjustmentRequest(c *gin.Context) {
	zoneID := strings.TrimSpace(c.Param("zoneID"))
	var request createAdjustmentRequest
	evidence, ok := bindAdjustmentRequest(c, &request)
	if !ok {
		return
	}
	fields := make(map[string]string)
	if request.CountedQuantity < 0 || math.IsNaN(request.CountedQuantity) || math.IsInf(request.CountedQuantity, 0) {
		fields["countedQuantity"] = "ต้องไม่น้อยกว่า 0"
	}
	if !nonBlank(request.Description) {
		fields["description"] = "กรุณาระบุรายละเอียด"
	}
	if request.AttachmentURL != nil && !nonBlank(*request.AttachmentURL) {
		fields["attachmentURL"] = "ห้ามเป็นค่าว่าง ให้ส่ง null หรือไม่ส่งฟิลด์เมื่อไม่มีไฟล์"
	}
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสพนักงาน"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	var zone models.StorageZone
	result := h.DB.First(&zone, "zone_id = ?", zoneID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	var storedPath string
	if evidence != nil {
		url, path, err := saveAdjustmentEvidence(evidence)
		if err != nil {
			Failure(c, http.StatusInternalServerError, "evidence_storage_failed", "จัดเก็บไฟล์ไม่สำเร็จ กรุณาลองใหม่", nil)
			return
		}
		request.AttachmentURL = &url
		storedPath = path
	}
	adjustment := models.StockAdjustmentRequest{
		SystemQuantity:  zone.QuantityOnHand,
		CountedQuantity: request.CountedQuantity,
		Description:     strings.TrimSpace(request.Description),
		AttachmentURL:   trimmedOptionalString(request.AttachmentURL),
		RequestDate:     time.Now().UTC(),
		Status:          adjustmentStatusPending,
		EmployeeID:      strings.TrimSpace(request.EmployeeID),
		ZoneID:          zone.ZoneID,
	}
	if err := h.DB.Create(&adjustment).Error; err != nil {
		if storedPath != "" {
			if removeErr := os.Remove(storedPath); removeErr != nil {
				_ = c.Error(removeErr)
			}
		}
		writeDatabaseFailure(c, err)
		return
	}
	adjustment.Zone = &zone
	Success(c, http.StatusCreated, adjustment, "สร้างคำขอปรับยอดสำเร็จ")
}

func (h *Handler) ListStockAdjustmentRequests(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != adjustmentStatusPending && status != adjustmentStatusApproved && status != adjustmentStatusRejected {
		validationFailure(c, map[string]string{"status": "ต้องเป็น pending, approved หรือ rejected"})
		return
	}
	employeeID := strings.TrimSpace(c.Query("employeeID"))
	limit, ok := parseListLimit(c)
	if !ok || !h.databaseReady(c) {
		return
	}
	var requests []models.StockAdjustmentRequest
	query := h.DB.
		Preload("Employee").
		Preload("Zone").
		Preload("Zone.Material").
		Preload("Approval").
		Order("request_date DESC, request_no DESC").
		Limit(limit)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if err := query.Find(&requests).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, requests, "อ่านรายการคำขอปรับยอดสำเร็จ")
}

func (h *Handler) GetStockAdjustmentRequest(c *gin.Context) {
	requestNo, ok := parsePositiveIntParam(c, "requestNo")
	if !ok || !h.databaseReady(c) {
		return
	}
	var request models.StockAdjustmentRequest
	result := h.DB.
		Preload("Employee").
		Preload("Zone").
		Preload("Zone.Material").
		Preload("Approval").
		First(&request, "request_no = ?", requestNo)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบคำขอปรับยอด", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, request, "อ่านคำขอปรับยอดสำเร็จ")
}

func (h *Handler) DecideStockAdjustment(c *gin.Context) {
	requestNo, ok := parsePositiveIntParam(c, "requestNo")
	if !ok {
		return
	}
	var request decideAdjustmentRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := validateAdjustmentDecision(request)
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}

	decision := strings.TrimSpace(request.Decision)
	var approval models.AdjustmentApproval
	var adjustment models.StockAdjustmentRequest
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&adjustment, "request_no = ?", requestNo).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newOperationError(http.StatusNotFound, "not_found", "ไม่พบคำขอปรับยอด", nil)
			}
			return err
		}
		if adjustment.Status != adjustmentStatusPending {
			return newOperationError(http.StatusConflict, "workflow_conflict", "คำขอนี้ได้รับการตัดสินแล้ว", nil)
		}

		now := time.Now().UTC()
		approval = models.AdjustmentApproval{
			Decision:         decision,
			ApprovedQuantity: request.ApprovedQuantity,
			DecisionReason:   trimmedOptionalString(request.DecisionReason),
			ApprovedAt:       now,
			RequestNo:        adjustment.RequestNo,
			EmployeeID:       strings.TrimSpace(request.EmployeeID),
		}

		if decision == adjustmentStatusRejected {
			approval.ApprovedQuantity = nil
			if err := tx.Create(&approval).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.StockAdjustmentRequest{}).
				Where("request_no = ?", adjustment.RequestNo).
				Update("status", adjustmentStatusRejected).Error; err != nil {
				return err
			}
			adjustment.Status = adjustmentStatusRejected
			return nil
		}

		var zone models.StorageZone
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&zone, "zone_id = ?", adjustment.ZoneID).Error; err != nil {
			return err
		}
		if zone.QuantityOnHand != adjustment.SystemQuantity {
			return newOperationError(http.StatusConflict, "stale_adjustment", "ยอดสต๊อกเปลี่ยนไปหลังสร้างคำขอ กรุณาสร้างคำขอใหม่", nil)
		}
		approvedQuantity := *request.ApprovedQuantity
		if approvedQuantity > zone.Capacity {
			return newOperationError(http.StatusUnprocessableEntity, "capacity_exceeded", "ยอดที่อนุมัติเกินความจุพื้นที่จัดเก็บ", map[string]string{"approvedQuantity": "ต้องไม่เกิน capacity ของพื้นที่"})
		}

		var warehouse models.Warehouse
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&warehouse, "warehouse_id = ?", zone.WarehouseID).Error; err != nil {
			return err
		}
		delta := approvedQuantity - adjustment.SystemQuantity
		if err := tx.Create(&approval).Error; err != nil {
			return err
		}
		stockTransaction := models.StockTransaction{
			Quantity:        delta,
			TransactionDate: now,
			EmployeeID:      strings.TrimSpace(request.EmployeeID),
			ZoneID:          zone.ZoneID,
		}
		if err := tx.Create(&stockTransaction).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StorageZone{}).
			Where("zone_id = ?", zone.ZoneID).
			Updates(map[string]any{
				"quantity_on_hand": approvedQuantity,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Warehouse{}).
			Where("warehouse_id = ?", warehouse.WarehouseID).
			Updates(map[string]any{
				"current_quantity": warehouse.CurrentQuantity + delta,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StockAdjustmentRequest{}).
			Where("request_no = ?", adjustment.RequestNo).
			Update("status", adjustmentStatusApproved).Error; err != nil {
			return err
		}
		adjustment.Status = adjustmentStatusApproved
		return nil
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	approval.Request = &adjustment
	Success(c, http.StatusCreated, approval, "บันทึกผลการพิจารณาคำขอสำเร็จ")
}

func validateAdjustmentDecision(request decideAdjustmentRequest) map[string]string {
	fields := make(map[string]string)
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสพนักงาน"
	}
	decision := strings.TrimSpace(request.Decision)
	if decision != adjustmentStatusApproved && decision != adjustmentStatusRejected {
		fields["decision"] = "ต้องเป็น approved หรือ rejected"
		return fields
	}
	if decision == adjustmentStatusApproved {
		if request.ApprovedQuantity == nil {
			fields["approvedQuantity"] = "กรุณาระบุยอดสุดท้ายที่อนุมัติ"
		} else if *request.ApprovedQuantity < 0 {
			fields["approvedQuantity"] = "ต้องไม่น้อยกว่า 0"
		}
	}
	if decision == adjustmentStatusRejected {
		if request.ApprovedQuantity != nil {
			fields["approvedQuantity"] = "ต้องเป็น null เมื่อปฏิเสธ"
		}
		if request.DecisionReason == nil || !nonBlank(*request.DecisionReason) {
			fields["decisionReason"] = "กรุณาระบุเหตุผลที่ปฏิเสธ"
		}
	}
	return fields
}

func (h *Handler) ListAdjustmentApprovals(c *gin.Context) {
	limit, ok := parseListLimit(c)
	if !ok || !h.databaseReady(c) {
		return
	}
	var approvals []models.AdjustmentApproval
	if err := h.DB.
		Preload("Employee").
		Preload("Request").
		Order("approved_at DESC, approval_id DESC").
		Limit(limit).
		Find(&approvals).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, approvals, "อ่านประวัติการพิจารณาปรับยอดสำเร็จ")
}

func (h *Handler) GetAdjustmentApproval(c *gin.Context) {
	approvalID, ok := parsePositiveIntParam(c, "approvalID")
	if !ok || !h.databaseReady(c) {
		return
	}
	var approval models.AdjustmentApproval
	result := h.DB.Preload("Employee").Preload("Request").First(&approval, "approval_id = ?", approvalID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบประวัติการพิจารณาปรับยอด", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, approval, "อ่านประวัติการพิจารณาปรับยอดสำเร็จ")
}
