package controllers

import (
	"net/http"
	"strings"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type createUserRequest struct {
	UserID   string `json:"userID"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type updateUserRequest struct {
	Name     *string `json:"name"`
	Phone    *string `json:"phone"`
	Email    *string `json:"email"`
	Password *string `json:"password"`
	Role     *string `json:"role"`
}

func (h *Handler) CreateUser(c *gin.Context) {
	var request createUserRequest
	if !bindJSON(c, &request) {
		return
	}
	fields := make(map[string]string)
	if !nonBlank(request.UserID) {
		fields["userID"] = "กรุณาระบุรหัสผู้ใช้"
	}
	if !nonBlank(request.Name) {
		fields["name"] = "กรุณาระบุชื่อ"
	}
	if !nonBlank(request.Phone) {
		fields["phone"] = "กรุณาระบุเบอร์โทรศัพท์"
	}
	if !nonBlank(request.Email) {
		fields["email"] = "กรุณาระบุอีเมล"
	}
	if request.Password == "" {
		fields["password"] = "กรุณาระบุรหัสผ่าน"
	}
	if !nonBlank(request.Role) {
		fields["role"] = "กรุณาระบุบทบาท"
	} else if !models.ValidUserRole(models.UserRole(strings.TrimSpace(request.Role))) {
		fields["role"] = "บทบาทผู้ใช้ไม่ถูกต้อง"
	}
	if len(fields) > 0 {
		validationFailure(c, fields)
		return
	}
	if !h.databaseReady(c) {
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		Failure(c, http.StatusInternalServerError, "password_hash_error", "ไม่สามารถจัดเก็บรหัสผ่านได้", nil)
		return
	}
	user := models.User{
		UserID:   strings.TrimSpace(request.UserID),
		Name:     strings.TrimSpace(request.Name),
		Phone:    strings.TrimSpace(request.Phone),
		Email:    strings.TrimSpace(request.Email),
		Password: string(hashedPassword),
		Role:     models.UserRole(strings.TrimSpace(request.Role)),
	}
	if err := h.DB.Create(&user).Error; err != nil {
		writeDatabaseFailure(c, err)
		return
	}
	Success(c, http.StatusCreated, user, "สร้างผู้ใช้สำเร็จ")
}

func (h *Handler) ListUsers(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	var users []models.User
	if err := h.DB.Omit("password").Order("user_id ASC").Find(&users).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, users, "อ่านรายการผู้ใช้สำเร็จ")
}

func (h *Handler) GetUser(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	userID := strings.TrimSpace(c.Param("userID"))
	var user models.User
	result := h.DB.Omit("password").First(&user, "user_id = ?", userID)
	if result.Error != nil {
		if result.RowsAffected == 0 {
			Failure(c, http.StatusNotFound, "not_found", "ไม่พบผู้ใช้", nil)
			return
		}
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, user, "อ่านข้อมูลผู้ใช้สำเร็จ")
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var request updateUserRequest
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
	addStringUpdate("name", "name", request.Name)
	addStringUpdate("phone", "phone", request.Phone)
	addStringUpdate("email", "email", request.Email)
	if request.Role != nil {
		role := models.UserRole(strings.TrimSpace(*request.Role))
		if !models.ValidUserRole(role) {
			fields["role"] = "บทบาทผู้ใช้ไม่ถูกต้อง"
		} else {
			updates["role"] = role
		}
	}
	if request.Password != nil {
		if *request.Password == "" {
			fields["password"] = "ห้ามเป็นค่าว่าง"
		} else {
			hash, err := bcrypt.GenerateFromPassword([]byte(*request.Password), bcrypt.DefaultCost)
			if err != nil {
				Failure(c, http.StatusInternalServerError, "password_hash_error", "ไม่สามารถจัดเก็บรหัสผ่านได้", nil)
				return
			}
			updates["password"] = string(hash)
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

	userID := strings.TrimSpace(c.Param("userID"))
	result := h.DB.Model(&models.User{}).Where("user_id = ?", userID).Updates(updates)
	if result.Error != nil {
		writeDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบผู้ใช้", nil)
		return
	}
	var user models.User
	if err := h.DB.Omit("password").First(&user, "user_id = ?", userID).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, user, "แก้ไขผู้ใช้สำเร็จ")
}

func (h *Handler) DeleteUser(c *gin.Context) {
	if !h.databaseReady(c) {
		return
	}
	userID := strings.TrimSpace(c.Param("userID"))
	result := h.DB.Delete(&models.User{}, "user_id = ?", userID)
	if result.Error != nil {
		deleteDatabaseFailure(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบผู้ใช้", nil)
		return
	}
	Success(c, http.StatusOK, gin.H{"userID": userID}, "ลบผู้ใช้สำเร็จ")
}
