package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	assessmentResultPassed         = "passed"
	assessmentResultRejected       = "rejected"
	assessmentResultSpecialStorage = "special_storage"
	pendingStatusWaitingReceipt    = "waiting_receipt"
	pendingStatusReceived          = "received"
)

type createQualityAssessmentRequest struct {
	AssessedGrade    string  `json:"assessedGrade"`
	CleanlinessLevel string  `json:"cleanlinessLevel"`
	Result           string  `json:"result"`
	Detail           *string `json:"detail"`
	AssessedQuantity float64 `json:"assessedQuantity"`
	MaterialID       string  `json:"materialID"`
}

type createScrapPurchaseRequest struct {
	PurchaseID   string  `json:"purchaseID"`
	PaymentID    *string `json:"paymentID"`
	PurchaseDate string  `json:"purchaseDate"`
	SellerCode   string  `json:"sellerCode"`
	WasteType    string  `json:"wasteType"`
	Weight       float64 `json:"weight"`
	PricePerKg   float64 `json:"pricePerKg"`
	TotalAmount  float64 `json:"totalAmount"`
	EmployeeID   string  `json:"employeeID"`
	MaterialID   string  `json:"materialID"`
}

type createPendingTransferRequest struct {
	Quantity       float64 `json:"quantity"`
	AssessedBy     string  `json:"assessedBy"`
	StockRouteType string  `json:"stockRouteType"`
	MaterialID     string  `json:"materialID"`
}

type optionalNullableString struct {
	Set   bool
	Value *string
}

func (value *optionalNullableString) UnmarshalJSON(data []byte) error {
	value.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		value.Value = nil
		return nil
	}
	var decoded string
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.Value = &decoded
	return nil
}

type updatePaymentRequest struct {
	PaymentID optionalNullableString `json:"paymentID"`
}

func (h *Handler) CreateQualityAssessment(c *gin.Context) {
	var request createQualityAssessmentRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := validateQualityAssessment(request)
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	assessment := models.QualityAssessment{
		AssessedGrade:     strings.TrimSpace(request.AssessedGrade),
		CleanlinessLevel:  strings.TrimSpace(request.CleanlinessLevel),
		Result:            strings.TrimSpace(request.Result),
		Detail:            trimmedOptionalString(request.Detail),
		AssessedQuantity:  request.AssessedQuantity,
		AssessedAt:        time.Now().UTC(),
		AssessmentBatchID: strings.TrimSpace(c.Param("assessmentBatchID")),
		MaterialID:        strings.TrimSpace(request.MaterialID),
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if _, err := lockOpenAssessmentBatch(tx, assessment.AssessmentBatchID); err != nil {
			return err
		}
		return tx.Create(&assessment).Error
	})
	if err != nil {
		if !respondOperationError(c, err) {
			writeDatabaseFailure(c, err)
		}
		return
	}
	if err := h.DB.Preload("AssessmentBatch.Employee").Preload("Material").First(&assessment, "assessment_id = ?", assessment.AssessmentID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, assessment, "บันทึกผลประเมินสำเร็จ")
}

func validateQualityAssessment(request createQualityAssessmentRequest) map[string]string {
	fields := make(map[string]string)
	if !nonBlank(request.AssessedGrade) {
		fields["assessedGrade"] = "กรุณาระบุเกรดที่ประเมิน"
	}
	if !nonBlank(request.CleanlinessLevel) {
		fields["cleanlinessLevel"] = "กรุณาระบุระดับความสะอาด"
	}
	if !validAssessmentResult(request.Result) {
		fields["result"] = "ต้องเป็น passed, rejected หรือ special_storage"
	}
	if request.AssessedQuantity <= 0 {
		fields["assessedQuantity"] = "จำนวนต้องมากกว่า 0"
	}
	if !nonBlank(request.MaterialID) {
		fields["materialID"] = "กรุณาระบุรหัสวัสดุ"
	}
	return fields
}

func validAssessmentResult(result string) bool {
	switch strings.TrimSpace(result) {
	case assessmentResultPassed, assessmentResultRejected, assessmentResultSpecialStorage:
		return true
	default:
		return false
	}
}

func (h *Handler) ListQualityAssessments(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var assessments []models.QualityAssessment
	if err := h.DB.Preload("AssessmentBatch.Employee").Preload("Material").Preload("ScrapPurchase").Order("assessment_id DESC").Find(&assessments).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, assessments, "อ่านรายการผลประเมินสำเร็จ")
}

func (h *Handler) GetQualityAssessment(c *gin.Context) {
	assessmentID, ok := parsePositiveIntParam(c, "assessmentID")
	if !ok || !h.databaseReady(c) {
		return
	}
	var assessment models.QualityAssessment
	result := h.DB.Preload("AssessmentBatch.Employee").Preload("Material").Preload("ScrapPurchase").First(&assessment, "assessment_id = ?", assessmentID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบผลประเมิน", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, assessment, "อ่านผลประเมินสำเร็จ")
}

func (h *Handler) CreateScrapPurchase(c *gin.Context) {
	assessmentID, ok := parsePositiveIntParam(c, "assessmentID")
	if !ok {
		return
	}
	var request createScrapPurchaseRequest
	if !bindJSON(c, &request) {
		return
	}
	purchaseDate, fields := validateScrapPurchase(request)
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	var assessment models.QualityAssessment
	result := h.DB.First(&assessment, "assessment_id = ?", assessmentID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบผลประเมิน", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	if assessment.Result != assessmentResultPassed && assessment.Result != assessmentResultSpecialStorage {
		Failure(c, http.StatusConflict, "workflow_conflict", "ผลประเมินนี้ไม่สามารถสร้างรายการซื้อได้", nil)
		return
	}
	if assessment.MaterialID != strings.TrimSpace(request.MaterialID) {
		validationFailure(c, map[string]string{"materialID": "วัสดุต้องตรงกับรายการที่ประเมิน"})
		return
	}
	purchase := models.ScrapPurchaseItem{
		PurchaseID:   strings.TrimSpace(request.PurchaseID),
		PaymentID:    trimmedOptionalString(request.PaymentID),
		PurchaseDate: purchaseDate,
		SellerCode:   strings.TrimSpace(request.SellerCode),
		WasteType:    strings.TrimSpace(request.WasteType),
		Weight:       request.Weight,
		PricePerKg:   request.PricePerKg,
		TotalAmount:  request.TotalAmount,
		EmployeeID:   strings.TrimSpace(request.EmployeeID),
		MaterialID:   strings.TrimSpace(request.MaterialID),
		AssessmentID: assessmentID,
	}
	if err := h.DB.Create(&purchase).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	if err := h.DB.Preload("Employee").Preload("Material").Preload("Assessment.AssessmentBatch.Employee").First(&purchase, "purchase_id = ?", purchase.PurchaseID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, purchase, "สร้างรายการซื้อเศษวัสดุสำเร็จ")
}

func validateScrapPurchase(request createScrapPurchaseRequest) (time.Time, map[string]string) {
	fields := make(map[string]string)
	if !nonBlank(request.PurchaseID) {
		fields["purchaseID"] = "กรุณาระบุรหัสรายการซื้อ"
	}
	purchaseDate, err := time.Parse("2006-01-02", request.PurchaseDate)
	if err != nil {
		fields["purchaseDate"] = "ต้องใช้รูปแบบ YYYY-MM-DD"
	}
	if !nonBlank(request.SellerCode) {
		fields["sellerCode"] = "กรุณาระบุรหัสผู้ขาย"
	}
	if !nonBlank(request.WasteType) {
		fields["wasteType"] = "กรุณาระบุประเภทของเสีย"
	}
	if request.Weight <= 0 {
		fields["weight"] = "น้ำหนักต้องมากกว่า 0"
	}
	if request.PricePerKg < 0 {
		fields["pricePerKg"] = "ต้องไม่น้อยกว่า 0"
	}
	if request.TotalAmount < 0 {
		fields["totalAmount"] = "ต้องไม่น้อยกว่า 0"
	}
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสพนักงาน"
	}
	if !nonBlank(request.MaterialID) {
		fields["materialID"] = "กรุณาระบุรหัสวัสดุ"
	}
	return purchaseDate, fields
}

func (h *Handler) ListScrapPurchases(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var purchases []models.ScrapPurchaseItem
	if err := h.DB.Preload("Employee").Preload("Material").Preload("Assessment.AssessmentBatch.Employee").Order("purchase_date DESC, purchase_id ASC").Find(&purchases).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, purchases, "อ่านรายการซื้อเศษวัสดุสำเร็จ")
}

func (h *Handler) GetScrapPurchase(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	purchaseID := strings.TrimSpace(c.Param("purchaseID"))
	var purchase models.ScrapPurchaseItem
	result := h.DB.Preload("Employee").Preload("Material").Preload("Assessment.AssessmentBatch.Employee").Preload("PendingItem").First(&purchase, "purchase_id = ?", purchaseID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการซื้อเศษวัสดุ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, purchase, "อ่านรายการซื้อเศษวัสดุสำเร็จ")
}

func (h *Handler) UpdateScrapPurchasePayment(c *gin.Context) {
	var request updatePaymentRequest
	if !bindJSON(c, &request) {
		return
	}
	if !request.PaymentID.Set {
		validationFailure(c, map[string]string{"paymentID": "กรุณาระบุ paymentID หรือ null"})
		return
	}
	if request.PaymentID.Value != nil {
		if !nonBlank(*request.PaymentID.Value) {
			validationFailure(c, map[string]string{"paymentID": "ให้ใช้ null เมื่อต้องการล้างค่า"})
			return
		}
		trimmed := strings.TrimSpace(*request.PaymentID.Value)
		request.PaymentID.Value = &trimmed
	}
	if !h.databaseReady(c) {
		return
	}
	purchaseID := strings.TrimSpace(c.Param("purchaseID"))
	result := h.DB.Model(&models.ScrapPurchaseItem{}).Where("purchase_id = ?", purchaseID).Update("payment_id", request.PaymentID.Value)
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการซื้อเศษวัสดุ", nil)
		return
	}
	var purchase models.ScrapPurchaseItem
	if err := h.DB.First(&purchase, "purchase_id = ?", purchaseID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, purchase, "แก้ไขข้อมูลการชำระเงินสำเร็จ")
}

func (h *Handler) TransferScrapPurchase(c *gin.Context) {
	purchaseID := strings.TrimSpace(c.Param("purchaseID"))
	var request createPendingTransferRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)
	if request.Quantity <= 0 {
		fields["quantity"] = "จำนวนต้องมากกว่า 0"
	}
	if !nonBlank(request.AssessedBy) {
		fields["assessedBy"] = "กรุณาระบุผู้ประเมิน"
	}
	if !nonBlank(request.StockRouteType) {
		fields["stockRouteType"] = "กรุณาระบุเส้นทางจัดเก็บ"
	}
	if !nonBlank(request.MaterialID) {
		fields["materialID"] = "กรุณาระบุรหัสวัสดุ"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	var purchase models.ScrapPurchaseItem
	result := h.DB.Preload("Assessment").First(&purchase, "purchase_id = ?", purchaseID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการซื้อเศษวัสดุ", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	if purchase.Assessment == nil {
		readDatabaseFailure(c)
		return
	}
	if purchase.MaterialID != strings.TrimSpace(request.MaterialID) {
		validationFailure(c, map[string]string{"materialID": "วัสดุต้องตรงกับรายการซื้อ"})
		return
	}
	pending := models.PendingWarehouseItem{
		Quantity:        request.Quantity,
		AssessedGrade:   purchase.Assessment.AssessedGrade,
		AssessedBy:      strings.TrimSpace(request.AssessedBy),
		TransferredDate: time.Now().UTC(),
		StockRouteType:  strings.TrimSpace(request.StockRouteType),
		PurchaseID:      purchaseID,
		ReceivingStatus: pendingStatusWaitingReceipt,
		MaterialID:      strings.TrimSpace(request.MaterialID),
	}
	if err := h.DB.Create(&pending).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	if err := h.DB.Preload("Purchase").Preload("Material").First(&pending, "pending_id = ?", pending.PendingID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusCreated, pending, "ส่งรายการไปรอรับเข้าคลังสำเร็จ")
}

func (h *Handler) ListPendingWarehouseItems(c *gin.Context) {
	status := strings.TrimSpace(c.Query("receivingStatus"))
	if status != "" && status != pendingStatusWaitingReceipt && status != pendingStatusReceived {
		validationFailure(c, map[string]string{"receivingStatus": "ต้องเป็น waiting_receipt หรือ received"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	query := h.DB.Preload("Purchase").Preload("Material").
		Preload("ReceiveTransaction.Transaction.Zone").Order("pending_id DESC")
	if status != "" {
		query = query.Where("receiving_status = ?", status)
	}
	var items []models.PendingWarehouseItem
	if err := query.Find(&items).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	response, err := pendingWarehouseItemResponses(h.DB, items)
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, response, "อ่านรายการรอรับเข้าคลังสำเร็จ")
}

func (h *Handler) GetPendingWarehouseItem(c *gin.Context) {
	pendingID, ok := parsePositiveIntParam(c, "pendingID")
	if !ok || !h.databaseReady(c) {
		return
	}
	var item models.PendingWarehouseItem
	result := h.DB.Preload("Purchase").Preload("Material").
		Preload("ReceiveTransaction.Transaction.Zone").First(&item, "pending_id = ?", pendingID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการรอรับเข้าคลัง", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	response, err := pendingWarehouseItemResponses(h.DB, []models.PendingWarehouseItem{item})
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, response[0], "อ่านรายการรอรับเข้าคลังสำเร็จ")
}

type pendingWarehouseItemResponse struct {
	models.PendingWarehouseItem
	ReceivedZoneID         string   `json:"receivedZoneID,omitempty"`
	RemainingCapacityAfter *float64 `json:"remainingCapacityAfter,omitempty"`
}

func pendingWarehouseItemResponses(db *gorm.DB, items []models.PendingWarehouseItem) ([]pendingWarehouseItemResponse, error) {
	transactions := make([]models.StockTransaction, 0, len(items))
	for _, item := range items {
		if item.ReceiveTransaction != nil && item.ReceiveTransaction.Transaction != nil {
			transactions = append(transactions, *item.ReceiveTransaction.Transaction)
		}
	}
	balances, err := loadTransactionBalances(db, transactions)
	if err != nil {
		return nil, err
	}

	response := make([]pendingWarehouseItemResponse, len(items))
	for index, item := range items {
		response[index] = pendingWarehouseItemResponse{PendingWarehouseItem: item}
		if item.ReceiveTransaction == nil || item.ReceiveTransaction.Transaction == nil {
			continue
		}
		transaction := item.ReceiveTransaction.Transaction
		response[index].ReceivedZoneID = transaction.ZoneID
		if transaction.Zone != nil {
			if balanceAfter, ok := balances[transaction.TransactionID]; ok {
				remaining := transaction.Zone.Capacity - balanceAfter
				response[index].RemainingCapacityAfter = &remaining
			}
		}
	}
	return response, nil
}

func trimmedOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}
