package controllers

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
	"unicode/utf8"
)

// SearchAssessmentSellers supplies only the identity needed to select a seller
// in assessment entry. Seller editing and registration remain in their module.
func (h *Handler) SearchAssessmentSellers(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if size := utf8.RuneCountInString(query); size < 2 || size > 100 {
		validationFailure(c, map[string]string{"q": "กรุณาพิมพ์ชื่อหรือรหัสผู้ขาย 2–100 ตัวอักษร"})
		return
	}
	if !h.databaseReady(c) {
		return
	}
	pattern := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query) + "%"
	type sellerOption struct {
		SellerCode string `json:"sellerCode"`
		Name       string `json:"name"`
	}
	rows := make([]sellerOption, 0)
	err := h.DB.WithContext(c.Request.Context()).Table("sellers AS s").
		Select("s.seller_code, u.name").Joins("JOIN users AS u ON u.user_id = s.user_id").
		Where("s.seller_code ILIKE ? OR u.name ILIKE ?", pattern, pattern).
		Order("u.name ASC, s.seller_code ASC").Limit(20).Scan(&rows).Error
	if err != nil {
		readDatabaseFailure(c)
		return
	}
	Success(c, http.StatusOK, rows, "ค้นหาผู้ขายสำเร็จ")
}