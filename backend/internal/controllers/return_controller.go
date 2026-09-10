package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func complaintDetails(db *gorm.DB) *gorm.DB {
	return db.Preload("PurchaseOrder.Factory").Preload("Factory").Preload("AuditTrail")
}

func returnDetails(db *gorm.DB) *gorm.DB {
	return db.Preload("WarehouseStaff.User").Preload("Warehouse").Preload("Complaint")
}

func (h *Handler) ListComplaints(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var rows []models.Complaint
	if err := complaintDetails(h.DB.WithContext(c.Request.Context())).Order("complaint_date DESC, complaint_id ASC").Find(&rows).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, rows, "อ่านรายการคำร้องเรียนสำเร็จ")
}

func (h *Handler) GetComplaint(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var row models.Complaint
	err := complaintDetails(h.DB.WithContext(c.Request.Context())).First(&row, "complaint_id = ?", strings.TrimSpace(c.Param("complaintID"))).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบคำร้องเรียน", nil)
		return
	}
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, row, "อ่านคำร้องเรียนสำเร็จ")
}

func (h *Handler) CreateComplaint(c *gin.Context) {
	var request struct {
		ComplaintID        string   `json:"complaintID"`
		OrderID            string   `json:"orderID"`
		FactoryID          string   `json:"factory_id"`
		EmployeeID         string   `json:"employee_id"`
		ProblemDescription string   `json:"problemDescription"`
		EvidenceFile       string   `json:"evidenceFile"`
		EvidenceFiles      []string `json:"evidence_files"`
	}
	if !bindJSON(c, &request) {
		return
	}
	fields := map[string]string{}
	if !nonBlank(request.ComplaintID) {
		fields["complaintID"] = "กรุณาระบุรหัสคำร้องเรียน"
	}
	if !nonBlank(request.OrderID) {
		fields["orderID"] = "กรุณาระบุรหัสคำขอซื้อ"
	}
	if !nonBlank(request.ProblemDescription) {
		fields["problemDescription"] = "กรุณาระบุรายละเอียดปัญหา"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	row := models.Complaint{ComplaintID: strings.TrimSpace(request.ComplaintID), ComplaintDate: time.Now(), ProblemDescription: strings.TrimSpace(request.ProblemDescription), EvidenceFile: strings.TrimSpace(request.EvidenceFile), EvidenceFiles: request.EvidenceFiles, Status: models.ComplaintStatusPending, OrderID: strings.TrimSpace(request.OrderID)}
	if value := strings.TrimSpace(request.FactoryID); value != "" {
		row.FactoryID = &value
	}
	if value := strings.TrimSpace(request.EmployeeID); value != "" {
		row.EmployeeID = &value
	}
	if row.EvidenceFile != "" && len(row.EvidenceFiles) == 0 {
		row.EvidenceFiles = []string{row.EvidenceFile}
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if row.OrderID != "" {
			var order models.PurchaseOrder
			if err := tx.First(&order, "order_id = ?", row.OrderID).Error; err != nil {
				return err
			}
			if row.FactoryID == nil {
				row.FactoryID = &order.FactoryID
			}
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		createdBy := "system"
		if row.EmployeeID != nil {
			createdBy = *row.EmployeeID
		}
		return tx.Create(&models.ComplaintAudit{ComplaintID: row.ComplaintID, CreatedBy: createdBy, CreatedAction: "created", CreatedAt: row.ComplaintDate}).Error
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, row, "สร้างคำร้องเรียนสำเร็จ")
}

func (h *Handler) ReviewComplaint(c *gin.Context) {
	var request struct {
		Status          string `json:"status"`
		Result          string `json:"result"`
		RejectionReason string `json:"rejectionReason"`
		ReviewedBy      string `json:"reviewedBy"`
	}
	if !bindJSON(c, &request) {
		return
	}
	request.Status = strings.ToLower(strings.TrimSpace(request.Status))
	fields := map[string]string{}
	if request.Status != "approved" && request.Status != "rejected" {
		fields["status"] = "สถานะต้องเป็น approved หรือ rejected"
	}
	if !nonBlank(request.ReviewedBy) {
		fields["reviewedBy"] = "กรุณาระบุผู้ตรวจสอบ"
	}
	if request.Status == "rejected" && !nonBlank(request.RejectionReason) {
		fields["rejectionReason"] = "กรุณาระบุเหตุผลที่ปฏิเสธ"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	now := time.Now()
	id := strings.TrimSpace(c.Param("complaintID"))
	updates := map[string]any{"status": request.Status, "reviewed_by": strings.TrimSpace(request.ReviewedBy), "reviewed_at": now, "result": nullableText(request.Result), "rejection_reason": nullableText(request.RejectionReason)}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&models.Complaint{}).Where("complaint_id = ? AND status = ?", id, models.ComplaintStatusPending).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return newOperationError(http.StatusConflict, "not_pending", "ไม่พบคำร้องเรียนที่รอตรวจสอบ", nil)
		}
		from, to, action, reason := models.ComplaintStatusPending, models.ComplaintStatus(request.Status), request.Status, request.RejectionReason
		return tx.Create(&models.ComplaintAudit{ComplaintID: id, CreatedBy: strings.TrimSpace(request.ReviewedBy), CreatedAction: "reviewed", CreatedAt: now, ReviewedBy: &request.ReviewedBy, ReviewedAt: &now, ReviewAction: &action, ReviewFromStatus: &from, ReviewToStatus: &to, ReviewReason: &reason}).Error
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	h.GetComplaint(c)
}

func (h *Handler) ListReturnRecords(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var rows []models.ReturnRecord
	if err := returnDetails(h.DB.WithContext(c.Request.Context())).Order("return_date DESC, return_id ASC").Find(&rows).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, rows, "อ่านรายการรับคืนสำเร็จ")
}

func (h *Handler) CreateReturnRecord(c *gin.Context) {
	var request struct {
		ReturnID       string     `json:"returnID"`
		ReturnDate     *time.Time `json:"returnDate"`
		ReturnQuantity float64    `json:"returnQuantity"`
		ProcessedBy    string     `json:"processedBy"`
		WarehouseID    string     `json:"warehouseID"`
		ComplaintID    string     `json:"complaintID"`
	}
	if !bindJSON(c, &request) {
		return
	}
	fields := map[string]string{}
	if !nonBlank(request.ReturnID) {
		fields["returnID"] = "กรุณาระบุรหัสการรับคืน"
	}
	if request.ReturnQuantity <= 0 {
		fields["returnQuantity"] = "จำนวนรับคืนต้องมากกว่า 0"
	}
	if !nonBlank(request.ProcessedBy) {
		fields["processedBy"] = "กรุณาระบุพนักงานคลัง"
	}
	if !nonBlank(request.WarehouseID) {
		fields["warehouseID"] = "กรุณาระบุคลัง"
	}
	if !nonBlank(request.ComplaintID) {
		fields["complaintID"] = "กรุณาระบุคำร้องเรียน"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	returnDate := time.Now()
	if request.ReturnDate != nil {
		returnDate = *request.ReturnDate
	}
	row := models.ReturnRecord{
		ReturnID:       strings.TrimSpace(request.ReturnID),
		ReturnDate:     returnDate,
		ReturnQuantity: request.ReturnQuantity,
		ProcessedBy:    strings.TrimSpace(request.ProcessedBy),
		WarehouseID:    strings.TrimSpace(request.WarehouseID),
		ComplaintID:    strings.TrimSpace(request.ComplaintID),
	}
	if !h.databaseReady(c) {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var complaint models.Complaint
		if err := tx.First(&complaint, "complaint_id = ?", row.ComplaintID).Error; err != nil {
			return err
		}
		if complaint.Status != "approved" {
			return newOperationError(http.StatusConflict, "complaint_not_approved", "รับคืนได้เฉพาะคำร้องเรียนที่อนุมัติแล้ว", nil)
		}
		return tx.Create(&row).Error
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, row, "บันทึกการรับคืนสำเร็จ")
}

func nullableText(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
