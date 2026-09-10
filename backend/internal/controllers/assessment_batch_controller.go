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

const (
	batchStatusInProgress = "in_progress"
	batchStatusCompleted  = "completed"
)

type createAssessmentBatchRequest struct {
	AssessmentBatchID string `json:"assessmentBatchID"`
	SellerCode        string `json:"sellerCode"`
	EmployeeID        string `json:"employeeID"`
}

func (h *Handler) CreateAssessmentBatch(c *gin.Context) {
	var request createAssessmentBatchRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)
	if !nonBlank(request.SellerCode) {
		fields["sellerCode"] = "กรุณาระบุรหัสผู้ขาย"
	}
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสผู้สร้างชุดประเมิน"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.AssessmentBatchID, "assessment_batch", "") {
		return
	}
	batch := models.AssessmentBatch{
		AssessmentBatchID: strings.TrimSpace(request.AssessmentBatchID),
		SellerCode:        strings.TrimSpace(request.SellerCode),
		EmployeeID:        strings.TrimSpace(request.EmployeeID),
		AssessmentDate:    time.Now().UTC(),
		Status:            batchStatusInProgress,
	}
	// No authentication yet: employeeID is an explicit development input.
	if err := h.DB.WithContext(c.Request.Context()).Create(&batch).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	if err := h.DB.WithContext(c.Request.Context()).Preload("Employee").First(&batch, "assessment_batch_id = ?", batch.AssessmentBatchID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, batch, "สร้างชุดประเมินสำเร็จ")
}

// batchReadQuery intentionally includes every result, even rejected/purchased ones.
func batchReadQuery(db *gorm.DB) *gorm.DB {
	return db.Preload("Employee").Preload("Assessments", func(query *gorm.DB) *gorm.DB {
		return query.Order("assessment_id ASC")
	}).Preload("Assessments.Material")
}

func (h *Handler) ListAssessmentBatches(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && status != batchStatusInProgress && status != batchStatusCompleted {
		validationFailure(c, map[string]string{"status": "ต้องเป็น in_progress หรือ completed"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	query := batchReadQuery(h.DB.WithContext(c.Request.Context())).Order("assessment_date DESC, assessment_batch_id ASC")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	batches := make([]models.AssessmentBatch, 0)
	if err := query.Find(&batches).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, batches, "อ่านรายการชุดประเมินสำเร็จ")
}

func (h *Handler) GetAssessmentBatch(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var batch models.AssessmentBatch
	err := batchReadQuery(h.DB.WithContext(c.Request.Context())).First(&batch, "assessment_batch_id = ?", strings.TrimSpace(c.Param("assessmentBatchID"))).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบชุดประเมิน", nil)
		return
	}
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, batch, "อ่านชุดประเมินสำเร็จ")
}

// Both append and complete lock this same row until commit.
func lockOpenAssessmentBatch(tx *gorm.DB, batchID string) (*models.AssessmentBatch, error) {
	var batch models.AssessmentBatch
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&batch, "assessment_batch_id = ?", batchID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newOperationError(http.StatusNotFound, "not_found", "ไม่พบชุดประเมิน", nil)
	}
	if err != nil {
		return nil, err
	}
	if batch.Status != batchStatusInProgress {
		return nil, newOperationError(http.StatusConflict, "workflow_conflict", "ชุดประเมินนี้ปิดแล้ว ไม่สามารถเพิ่มรายการหรือยืนยันซ้ำได้", nil)
	}
	return &batch, nil
}

func (h *Handler) CompleteAssessmentBatch(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	batchID := strings.TrimSpace(c.Param("assessmentBatchID"))
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if _, err := lockOpenAssessmentBatch(tx, batchID); err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.QualityAssessment{}).Where("assessment_batch_id = ?", batchID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return newOperationError(http.StatusConflict, "workflow_conflict", "ต้องมีรายการประเมินอย่างน้อยหนึ่งรายการก่อนยืนยันเสร็จ", nil)
		}
		return tx.Model(&models.AssessmentBatch{}).Where("assessment_batch_id = ?", batchID).Update("status", batchStatusCompleted).Error
	})
	if err != nil {
		if !respondOperationError(c, err) {
			writeDatabaseFailure(c, err)
		}
		return
	}
	var batch models.AssessmentBatch
	if err := batchReadQuery(h.DB.WithContext(c.Request.Context())).First(&batch, "assessment_batch_id = ?", batchID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, batch, "ยืนยันประเมินเสร็จสำเร็จ")
}
