package controllers

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func (h *Handler) RegisterSeller(c *gin.Context) {
	var request dto.RegisterSellerRequest
	if !bindJSON(c, &request) {
		return
	}
	request.NationalID = strings.TrimSpace(request.NationalID)
	request.Name = strings.TrimSpace(request.Name)
	request.Phone = strings.TrimSpace(request.Phone)
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))
	request.Address = strings.TrimSpace(request.Address)
	request.SellerType = strings.TrimSpace(request.SellerType)
	request.PurchasingStaffID = strings.TrimSpace(request.PurchasingStaffID)
	fields := map[string]string{}
	if len(request.NationalID) != 13 || !allDigits(request.NationalID) {
		fields["national_id"] = "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก"
	}
	if request.Name == "" {
		fields["name"] = "กรุณาระบุชื่อผู้ขาย"
	}
	if request.Phone == "" {
		fields["phone"] = "กรุณาระบุหมายเลขโทรศัพท์"
	}
	if _, err := mail.ParseAddress(request.Email); err != nil {
		fields["email"] = "รูปแบบอีเมลไม่ถูกต้อง"
	}
	if request.Address == "" {
		fields["address"] = "กรุณาระบุที่อยู่"
	}
	if request.SellerType == "" {
		fields["seller_type"] = "กรุณาระบุประเภทผู้ขาย"
	}
	if len(request.Password) > 0 && len(request.Password) < 8 {
		fields["password"] = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}

	for value, prefix := range map[*string]string{
		&request.SellerCode: "SEL", &request.UserID: "USR", &request.RegistrationID: "REG",
	} {
		*value = strings.TrimSpace(*value)
		if *value == "" {
			generated, err := utils.GenerateID(prefix)
			if err != nil {
				Failure(c, http.StatusInternalServerError, "id_generation_error", "ไม่สามารถสร้างรหัสรายการได้", nil)
				return
			}
			*value = generated
		}
	}
	password := request.Password
	if password == "" {
		password, _ = utils.GenerateID("DISABLED")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		Failure(c, http.StatusInternalServerError, "password_error", "ไม่สามารถเตรียมบัญชีผู้ขายได้", nil)
		return
	}
	now := time.Now()
	user := models.User{UserID: request.UserID, Name: request.Name, Phone: request.Phone, Email: request.Email, Password: string(hash), Role: models.RoleSeller}
	seller := models.Seller{SellerCode: request.SellerCode, NationalID: request.NationalID, SellerType: request.SellerType, UserID: request.UserID, Address: request.Address, AccountStatus: models.AccountStatusActive, RegistrationDate: now}
	registration := models.RegistrationForm{RegistrationID: request.RegistrationID, SellerCode: request.SellerCode, NationalID: request.NationalID, RegistrationDate: now, IdentityDocuments: request.IdentityDocuments, Status: "active"}
	if request.PurchasingStaffID != "" {
		registration.PurchasingStaffID = &request.PurchasingStaffID
	}
	err = h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if registration.PurchasingStaffID != nil {
			var count int64
			if err := tx.Model(&models.PurchasingStaff{}).Where("purchasing_staff_id = ?", *registration.PurchasingStaffID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return newOperationError(http.StatusUnprocessableEntity, "invalid_purchasing_staff", "ไม่พบเจ้าหน้าที่รับซื้อที่ระบุ", map[string]string{"purchasing_staff_id": "ไม่พบข้อมูลอ้างอิง"})
			}
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		if err := tx.Create(&seller).Error; err != nil {
			return err
		}
		return tx.Create(&registration).Error
	})
	if err != nil {
		if respondOperationError(c, err) {
			return
		}
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, dto.RegisterSellerResponse{Seller: &seller, RegistrationForm: &registration}, "ลงทะเบียนผู้ขายสำเร็จ")
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func (h *Handler) CheckSellerNationalID(c *gin.Context) {
	nationalID := strings.TrimSpace(c.Query("national_id"))
	if len(nationalID) != 13 || !allDigits(nationalID) {
		validationFailure(c, map[string]string{"national_id": "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	var seller models.Seller
	result := h.DB.WithContext(c.Request.Context()).Where("national_id = ?", nationalID).Limit(1).Find(&seller)
	if result.Error != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, gin.H{"exists": result.RowsAffected > 0, "account_status": seller.AccountStatus}, "ตรวจสอบเลขบัตรประชาชนสำเร็จ")
}

func sellerDetails(db *gorm.DB) *gorm.DB { return db.Preload("User") }

func sellerListItem(seller models.Seller, registration *models.RegistrationForm) dto.SellerListItem {
	item := dto.SellerListItem{
		SellerCode: seller.SellerCode, NationalID: seller.NationalID, UserID: seller.UserID,
		Address: seller.Address, SellerType: seller.SellerType, AccountStatus: seller.AccountStatus,
		SuspendedReason: seller.SuspendedReason, SuspendedAt: seller.SuspendedAt, RegistrationDate: seller.RegistrationDate,
	}
	if seller.User != nil {
		item.Name, item.Phone, item.Email = seller.User.Name, seller.User.Phone, seller.User.Email
	}
	if registration != nil {
		item.IdentityDocuments = registration.IdentityDocuments
		item.PurchasingStaffID = registration.PurchasingStaffID
		item.RegistrationFormStatus = registration.Status
	}
	return item
}

func (h *Handler) ListSellers(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	query := sellerDetails(h.DB.WithContext(c.Request.Context()))
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		if status != string(models.AccountStatusActive) && status != string(models.AccountStatusSuspended) {
			validationFailure(c, map[string]string{"status": "สถานะต้องเป็น active หรือ suspended"})
			return
		}
		query = query.Where("account_status = ?", status)
	}
	if code := strings.TrimSpace(c.Query("seller_code")); code != "" {
		query = query.Where("seller_code = ?", code)
	}
	if nationalID := strings.TrimSpace(c.Query("national_id")); nationalID != "" {
		query = query.Where("national_id = ?", nationalID)
	}
	var rows []models.Seller
	if err := query.Order("registration_date DESC, seller_code ASC").Find(&rows).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	registrations := make(map[string]models.RegistrationForm)
	var forms []models.RegistrationForm
	if len(rows) > 0 {
		if err := h.DB.WithContext(c.Request.Context()).Where("seller_code IN ?", sellerCodes(rows)).Find(&forms).Error; err != nil {
			readDatabaseFailure(c)
			return
		}
	}
	for _, form := range forms {
		registrations[form.SellerCode] = form
	}
	items := make([]dto.SellerListItem, 0, len(rows))
	for _, row := range rows {
		form, ok := registrations[row.SellerCode]
		if ok {
			items = append(items, sellerListItem(row, &form))
		} else {
			items = append(items, sellerListItem(row, nil))
		}
	}
	Success(c, http.StatusOK, items, "อ่านรายการผู้ขายสำเร็จ")
}

func sellerCodes(rows []models.Seller) []string {
	codes := make([]string, 0, len(rows))
	for _, row := range rows {
		codes = append(codes, row.SellerCode)
	}
	return codes
}

func (h *Handler) GetSeller(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var seller models.Seller
	err := sellerDetails(h.DB.WithContext(c.Request.Context())).First(&seller, "seller_code = ?", strings.TrimSpace(c.Param("sellerCode"))).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบผู้ขาย", nil)
		return
	}
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	var registration models.RegistrationForm
	result := h.DB.WithContext(c.Request.Context()).Where("seller_code = ?", seller.SellerCode).Order("registration_date DESC").Limit(1).Find(&registration)
	if result.Error != nil {
		readDatabaseFailure(c)
		return
	}
	if result.RowsAffected > 0 {
		Success(c, http.StatusOK, sellerListItem(seller, &registration), "อ่านข้อมูลผู้ขายสำเร็จ")
		return
	}
	Success(c, http.StatusOK, sellerListItem(seller, nil), "อ่านข้อมูลผู้ขายสำเร็จ")
}

func (h *Handler) UpdateSellerStatus(c *gin.Context) {
	var request dto.UpdateSellerStatusRequest
	if !bindJSON(c, &request) {
		return
	}
	request.SuspendedReason = strings.TrimSpace(request.SuspendedReason)
	if request.Status != models.AccountStatusActive && request.Status != models.AccountStatusSuspended {
		validationFailure(c, map[string]string{"status": "สถานะต้องเป็น active หรือ suspended"})
		return
	}
	if request.Status == models.AccountStatusSuspended && request.SuspendedReason == "" {
		validationFailure(c, map[string]string{"suspended_reason": "กรุณาระบุเหตุผลที่ระงับผู้ขาย"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	updates := map[string]any{"account_status": request.Status}
	if request.Status == models.AccountStatusSuspended {
		updates["suspended_reason"] = request.SuspendedReason
		updates["suspended_at"] = time.Now()
	} else {
		updates["suspended_reason"] = ""
		updates["suspended_at"] = nil
	}
	result := h.DB.WithContext(c.Request.Context()).Model(&models.Seller{}).Where("seller_code = ?", strings.TrimSpace(c.Param("sellerCode"))).Updates(updates)
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบผู้ขาย", nil)
		return
	}
	h.GetSeller(c)
}
