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

type receivePendingItemRequest struct {
	ReceiveNo  string  `json:"receiveNo"`
	ZoneID     string  `json:"zoneID"`
	EmployeeID string  `json:"employeeID"`
	Quantity   float64 `json:"quantity"`
}

type issueFromZoneRequest struct {
	IssueNo        string  `json:"issueNo"`
	ReferenceNo    string  `json:"referenceNo"`
	RequestingUnit string  `json:"requestingUnit"`
	EmployeeID     string  `json:"employeeID"`
	Quantity       float64 `json:"quantity"`
}

type stockTransactionResponse struct {
	models.StockTransaction
	BalanceAfter float64 `json:"balanceAfter"`
}

type stockTransactionBalance struct {
	TransactionID int     `gorm:"column:transaction_id"`
	BalanceAfter  float64 `gorm:"column:balance_after"`
}

func loadTransactionBalances(db *gorm.DB, transactions []models.StockTransaction) (map[int]float64, error) {
	if len(transactions) == 0 {
		return map[int]float64{}, nil
	}
	ids := make([]int, len(transactions))
	for i, transaction := range transactions {
		ids[i] = transaction.TransactionID
	}
	var rows []stockTransactionBalance
	err := db.Raw(`
		SELECT current_transaction.transaction_id,
		       zone.quantity_on_hand - COALESCE((
		           SELECT SUM(CASE WHEN issue.transaction_id IS NOT NULL
		                           THEN -later.quantity ELSE later.quantity END)
		           FROM stock_transactions AS later
		           LEFT JOIN issue_transactions AS issue
		             ON issue.transaction_id = later.transaction_id
		           WHERE later.zone_id = current_transaction.zone_id
		             AND (later.transaction_date > current_transaction.transaction_date
		                  OR (later.transaction_date = current_transaction.transaction_date
		                      AND later.transaction_id > current_transaction.transaction_id))
		       ), 0) AS balance_after
		FROM stock_transactions AS current_transaction
		JOIN storage_zones AS zone ON zone.zone_id = current_transaction.zone_id
		WHERE current_transaction.transaction_id IN ?`, ids).Scan(&rows).Error
	balances := make(map[int]float64, len(rows))
	for _, row := range rows {
		balances[row.TransactionID] = row.BalanceAfter
	}
	return balances, err
}

func transactionsWithBalances(transactions []models.StockTransaction, balances map[int]float64) []stockTransactionResponse {
	response := make([]stockTransactionResponse, len(transactions))
	for i, transaction := range transactions {
		response[i] = stockTransactionResponse{StockTransaction: transaction, BalanceAfter: balances[transaction.TransactionID]}
	}
	return response
}

func (h *Handler) ReceivePendingItem(c *gin.Context) {
	pendingID, ok := parsePositiveIntParam(c, "pendingID")
	if !ok {
		return
	}
	var request receivePendingItemRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)

	if !nonBlank(request.ZoneID) {
		fields["zoneID"] = "กรุณาระบุพื้นที่จัดเก็บ"
	}
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสพนักงาน"
	}
	if request.Quantity <= 0 {
		fields["quantity"] = "จำนวนต้องมากกว่า 0"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.ReceiveNo, "receipt", "") {
		return
	}

	var stockTransaction models.StockTransaction
	var receiveTransaction models.ReceiveTransaction
	var updatedPending models.PendingWarehouseItem
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var pending models.PendingWarehouseItem
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&pending, "pending_id = ?", pendingID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newOperationError(http.StatusNotFound, "not_found", "ไม่พบรายการรอรับเข้าคลัง", nil)
			}
			return err
		}
		if pending.ReceivingStatus != pendingStatusWaitingReceipt {
			return newOperationError(http.StatusConflict, "workflow_conflict", "รายการนี้ถูกรับเข้าคลังแล้ว", nil)
		}
		if request.Quantity > pending.Quantity {
			return newOperationError(http.StatusUnprocessableEntity, "quantity_exceeds_assessment", "น้ำหนักรับเข้าจริงต้องไม่เกินน้ำหนักที่ประเมิน", map[string]string{"quantity": "น้ำหนักจริงต้องไม่เกินน้ำหนักที่ประเมิน"})
		}

		var zone models.StorageZone
		zoneID := strings.TrimSpace(request.ZoneID)
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&zone, "zone_id = ?", zoneID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newOperationError(http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
			}
			return err
		}
		if pending.MaterialID != zone.MaterialID {
			return newOperationError(http.StatusUnprocessableEntity, "material_mismatch", "วัสดุของรายการรอรับไม่ตรงกับพื้นที่จัดเก็บ", map[string]string{"zoneID": "พื้นที่นี้เก็บวัสดุคนละชนิด"})
		}
		if pending.AssessedGrade != zone.SupportedGrade {
			return newOperationError(http.StatusUnprocessableEntity, "grade_mismatch", "เกรดของรายการรอรับไม่ตรงกับพื้นที่จัดเก็บ", map[string]string{"zoneID": "พื้นที่นี้รองรับเกรดอื่น"})
		}
		if zone.StockStatus != storageZoneStatusAvailable {
			return newOperationError(http.StatusUnprocessableEntity, "zone_unavailable", "พื้นที่จัดเก็บไม่พร้อมใช้งาน", map[string]string{"zoneID": "กรุณาเลือกพื้นที่ที่มีสถานะ available"})
		}
		if zone.QuantityOnHand+request.Quantity > zone.Capacity {
			return newOperationError(http.StatusUnprocessableEntity, "capacity_exceeded", "พื้นที่จัดเก็บมีความจุไม่เพียงพอ", map[string]string{"quantity": "จำนวนรับเข้าทำให้เกินความจุ"})
		}

		var warehouse models.Warehouse
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&warehouse, "warehouse_id = ?", zone.WarehouseID).Error; err != nil {
			return err
		}

		now := time.Now().UTC()
		stockTransaction = models.StockTransaction{
			Quantity:        request.Quantity,
			TransactionDate: now,
			EmployeeID:      strings.TrimSpace(request.EmployeeID),
			ZoneID:          zone.ZoneID,
		}
		if err := tx.Create(&stockTransaction).Error; err != nil {
			return err
		}
		receiveTransaction = models.ReceiveTransaction{
			ReceiveNo:     strings.TrimSpace(request.ReceiveNo),
			TransactionID: stockTransaction.TransactionID,
			PendingID:     pending.PendingID,
		}
		if err := tx.Create(&receiveTransaction).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.PendingWarehouseItem{}).
			Where("pending_id = ?", pending.PendingID).
			Update("receiving_status", pendingStatusReceived).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StorageZone{}).
			Where("zone_id = ?", zone.ZoneID).
			Updates(map[string]any{
				"quantity_on_hand": zone.QuantityOnHand + request.Quantity,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Warehouse{}).
			Where("warehouse_id = ?", warehouse.WarehouseID).
			Updates(map[string]any{
				"current_quantity": warehouse.CurrentQuantity + request.Quantity,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}

		pending.ReceivingStatus = pendingStatusReceived
		updatedPending = pending
		return nil
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	receiveTransaction.Transaction = &stockTransaction
	receiveTransaction.PendingItem = &updatedPending
	Success(c, http.StatusCreated, receiveTransaction, "รับวัสดุเข้าคลังสำเร็จ")
}

func (h *Handler) IssueFromZone(c *gin.Context) {
	zoneID := strings.TrimSpace(c.Param("zoneID"))
	var request issueFromZoneRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)

	if !nonBlank(request.ReferenceNo) {
		fields["referenceNo"] = "กรุณาระบุเลขอ้างอิง"
	}
	if !nonBlank(request.RequestingUnit) {
		fields["requestingUnit"] = "กรุณาระบุหน่วยงานที่ขอเบิก"
	}
	if !nonBlank(request.EmployeeID) {
		fields["employeeID"] = "กรุณาระบุรหัสพนักงาน"
	}
	if request.Quantity <= 0 {
		fields["quantity"] = "จำนวนต้องมากกว่า 0"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	if !h.assignGeneratedCode(c, &request.IssueNo, "issue", "") {
		return
	}

	var stockTransaction models.StockTransaction
	var issueTransaction models.IssueTransaction
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var zone models.StorageZone
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&zone, "zone_id = ?", zoneID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newOperationError(http.StatusNotFound, "not_found", "ไม่พบพื้นที่จัดเก็บ", nil)
			}
			return err
		}
		if request.Quantity > zone.QuantityOnHand {
			return newOperationError(http.StatusUnprocessableEntity, "insufficient_stock", "จำนวนคงเหลือไม่เพียงพอ", map[string]string{"quantity": "จำนวนเบิกมากกว่าจำนวนคงเหลือ"})
		}

		var warehouse models.Warehouse
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&warehouse, "warehouse_id = ?", zone.WarehouseID).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		stockTransaction = models.StockTransaction{
			Quantity:        request.Quantity,
			TransactionDate: now,
			EmployeeID:      strings.TrimSpace(request.EmployeeID),
			ZoneID:          zone.ZoneID,
		}
		if err := tx.Create(&stockTransaction).Error; err != nil {
			return err
		}
		issueTransaction = models.IssueTransaction{
			IssueNo:        strings.TrimSpace(request.IssueNo),
			ReferenceNo:    strings.TrimSpace(request.ReferenceNo),
			RequestingUnit: strings.TrimSpace(request.RequestingUnit),
			TransactionID:  stockTransaction.TransactionID,
		}
		if err := tx.Create(&issueTransaction).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StorageZone{}).
			Where("zone_id = ?", zone.ZoneID).
			Updates(map[string]any{
				"quantity_on_hand": zone.QuantityOnHand - request.Quantity,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Warehouse{}).
			Where("warehouse_id = ?", warehouse.WarehouseID).
			Updates(map[string]any{
				"current_quantity": warehouse.CurrentQuantity - request.Quantity,
				"last_updated":     now,
			}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	issueTransaction.Transaction = &stockTransaction
	Success(c, http.StatusCreated, issueTransaction, "เบิกวัสดุสำเร็จ")
}

func (h *Handler) ListStockTransactions(c *gin.Context) {
	limit, ok := parseListLimit(c)
	if !ok || !h.databaseReady(c) {
		return
	}
	var transactions []models.StockTransaction
	if err := h.DB.
		Preload("Employee").
		Preload("Zone").
		Preload("ReceiveTransaction").
		Preload("IssueTransaction").
		Order("transaction_date DESC, transaction_id DESC").
		Limit(limit).
		Find(&transactions).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	balances, err := loadTransactionBalances(h.DB, transactions)
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, transactionsWithBalances(transactions, balances), "อ่านประวัติสต๊อกสำเร็จ")
}

func (h *Handler) GetStockTransaction(c *gin.Context) {
	transactionID, ok := parsePositiveIntParam(c, "transactionID")
	if !ok || !h.databaseReady(c) {
		return
	}
	var transaction models.StockTransaction
	result := h.DB.
		Preload("Employee").
		Preload("Zone").
		Preload("ReceiveTransaction").
		Preload("IssueTransaction").
		First(&transaction, "transaction_id = ?", transactionID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการเคลื่อนไหวสต๊อก", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	balances, err := loadTransactionBalances(h.DB, []models.StockTransaction{transaction})
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, stockTransactionResponse{StockTransaction: transaction, BalanceAfter: balances[transaction.TransactionID]}, "อ่านประวัติสต๊อกสำเร็จ")
}

func (h *Handler) ListReceiveTransactions(c *gin.Context) {
	limit, ok := parseListLimit(c)
	if !ok || !h.databaseReady(c) {
		return
	}
	var transactions []models.ReceiveTransaction
	if err := h.DB.
		Preload("Transaction.Employee").
		Preload("Transaction.Zone").
		Preload("PendingItem").
		Joins("JOIN stock_transactions ON stock_transactions.transaction_id = receive_transactions.transaction_id").
		Order("stock_transactions.transaction_date DESC, receive_transactions.receive_no ASC").
		Limit(limit).
		Find(&transactions).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, transactions, "อ่านประวัติรับเข้าสำเร็จ")
}

func (h *Handler) GetReceiveTransaction(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	receiveNo := strings.TrimSpace(c.Param("receiveNo"))
	var transaction models.ReceiveTransaction
	result := h.DB.
		Preload("Transaction.Employee").
		Preload("Transaction.Zone").
		Preload("PendingItem").
		First(&transaction, "receive_no = ?", receiveNo)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการรับเข้า", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, transaction, "อ่านประวัติรับเข้าสำเร็จ")
}

func (h *Handler) ListIssueTransactions(c *gin.Context) {
	limit, ok := parseListLimit(c)
	if !ok || !h.databaseReady(c) {
		return
	}
	var transactions []models.IssueTransaction
	if err := h.DB.
		Preload("Transaction.Employee").
		Preload("Transaction.Zone").
		Joins("JOIN stock_transactions ON stock_transactions.transaction_id = issue_transactions.transaction_id").
		Order("stock_transactions.transaction_date DESC, issue_transactions.issue_no ASC").
		Limit(limit).
		Find(&transactions).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, transactions, "อ่านประวัติเบิกจ่ายสำเร็จ")
}

func (h *Handler) GetIssueTransaction(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	issueNo := strings.TrimSpace(c.Param("issueNo"))
	var transaction models.IssueTransaction
	result := h.DB.
		Preload("Transaction.Employee").
		Preload("Transaction.Zone").
		First(&transaction, "issue_no = ?", issueNo)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบรายการเบิกจ่าย", nil)
		} else {
			readDatabaseFailure(c)
		}
		return
	}
	Success(c, http.StatusOK, transaction, "อ่านประวัติเบิกจ่ายสำเร็จ")
}
