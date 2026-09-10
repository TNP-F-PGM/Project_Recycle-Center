package controllers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type operationError struct {
	status  int
	code    string
	message string
	fields  map[string]string
}

func (err *operationError) Error() string {
	return err.message
}

func newOperationError(status int, code, message string, fields map[string]string) error {
	return &operationError{status: status, code: code, message: message, fields: fields}
}

func respondOperationError(c *gin.Context, err error) bool {
	var target *operationError
	if !errors.As(err, &target) {
		return false
	}
	Failure(c, target.status, target.code, target.message, target.fields)
	return true
}

func bindJSON(c *gin.Context, destination any) bool {
	if err := c.ShouldBindJSON(destination); err != nil {
		Failure(c, http.StatusBadRequest, "invalid_json", "รูปแบบ JSON ไม่ถูกต้อง", nil)
		return false
	}
	return true
}

func validationFailure(c *gin.Context, fields map[string]string) {
	Failure(c, http.StatusUnprocessableEntity, "validation_error", "ข้อมูลไม่ถูกต้อง", fields)
}

func (h *Handler) databaseReady(c *gin.Context) bool {
	if h.DB == nil {
		Failure(c, http.StatusInternalServerError, "database_unavailable", "ไม่สามารถเชื่อมต่อฐานข้อมูลได้", nil)
		return false
	}
	return true
}

func parsePositiveIntParam(c *gin.Context, name string) (int, bool) {
	value, err := strconv.Atoi(c.Param(name))
	if err != nil || value <= 0 {
		Failure(c, http.StatusBadRequest, "invalid_path_parameter", "รหัสใน URL ไม่ถูกต้อง", map[string]string{name: "ต้องเป็นจำนวนเต็มมากกว่า 0"})
		return 0, false
	}
	return value, true
}

func parseListLimit(c *gin.Context) (int, bool) {
	raw := strings.TrimSpace(c.Query("limit"))
	if raw == "" {
		return 50, true
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > 100 {
		validationFailure(c, map[string]string{"limit": "ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 100"})
		return 0, false
	}
	return limit, true
}

func nonBlank(value string) bool {
	return strings.TrimSpace(value) != ""
}

func writeDatabaseFailure(c *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrDuplicatedKey):
		Failure(c, http.StatusConflict, "conflict", "ข้อมูลนี้มีอยู่แล้ว", nil)
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		Failure(c, http.StatusUnprocessableEntity, "invalid_reference", "ไม่พบข้อมูลอ้างอิงที่ระบุ", nil)
	default:
		Failure(c, http.StatusInternalServerError, "database_error", "ไม่สามารถบันทึกข้อมูลได้", nil)
	}
}

func deleteDatabaseFailure(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		Failure(c, http.StatusConflict, "resource_in_use", "ไม่สามารถลบข้อมูลที่ยังถูกอ้างอิงอยู่ได้", nil)
		return
	}
	Failure(c, http.StatusInternalServerError, "database_error", "ไม่สามารถลบข้อมูลได้", nil)
}

func readDatabaseFailure(c *gin.Context) {
	Failure(c, http.StatusInternalServerError, "database_error", "ไม่สามารถอ่านข้อมูลได้", nil)
}