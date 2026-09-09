package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/gin-gonic/gin"
)

const maxAdjustmentEvidenceSize = 5 * 1024 * 1024
const adjustmentEvidencePrefix = "/api/v1/stock-adjustment-evidence/"

var evidenceNamePattern = regexp.MustCompile(`^[a-f0-9]{32}\.(png|jpg|webp|pdf)$`)
var evidenceExtensions = map[string]string{
	"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf",
}

type adjustmentEvidence struct {
	data      []byte
	extension string
}

// File selection and request submission are one operation. JSON clients remain supported.
func bindAdjustmentRequest(c *gin.Context, request *createAdjustmentRequest) (*adjustmentEvidence, bool) {
	if c.ContentType() != "multipart/form-data" {
		return nil, bindJSON(c, request)
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAdjustmentEvidenceSize+64*1024)
	if err := c.Request.ParseMultipartForm(maxAdjustmentEvidenceSize + 64*1024); err != nil {
		var sizeError *http.MaxBytesError
		if errors.As(err, &sizeError) {
			Failure(c, http.StatusRequestEntityTooLarge, "file_too_large", "ไฟล์หลักฐานต้องไม่เกิน 5 MB", nil)
		} else {
			Failure(c, http.StatusBadRequest, "invalid_multipart", "อ่านไฟล์แนบไม่สำเร็จ กรุณาเลือกไฟล์ใหม่", nil)
		}
		return nil, false
	}
	defer c.Request.MultipartForm.RemoveAll()
	counted, err := strconv.ParseFloat(c.PostForm("countedQuantity"), 64)
	if err != nil {
		validationFailure(c, map[string]string{"countedQuantity": "กรุณาระบุจำนวนนับจริง"})
		return nil, false
	}
	request.CountedQuantity = counted
	request.Description = c.PostForm("description")
	request.EmployeeID = c.PostForm("employeeID")
	for key, files := range c.Request.MultipartForm.File {
		if key != "attachment" || len(files) != 1 {
			validationFailure(c, map[string]string{"attachment": "แนบหลักฐานได้ครั้งละ 1 ไฟล์"})
			return nil, false
		}
	}
	files := c.Request.MultipartForm.File["attachment"]
	if len(files) == 0 {
		return nil, true
	}
	if files[0].Size > maxAdjustmentEvidenceSize {
		Failure(c, http.StatusRequestEntityTooLarge, "file_too_large", "ไฟล์หลักฐานต้องไม่เกิน 5 MB", nil)
		return nil, false
	}
	file, err := files[0].Open()
	if err != nil {
		Failure(c, http.StatusBadRequest, "invalid_file", "อ่านไฟล์แนบไม่สำเร็จ", nil)
		return nil, false
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxAdjustmentEvidenceSize+1))
	if err != nil || len(data) == 0 {
		validationFailure(c, map[string]string{"attachment": "ไฟล์ว่างหรืออ่านไม่ได้ กรุณาเลือกไฟล์ใหม่"})
		return nil, false
	}
	if len(data) > maxAdjustmentEvidenceSize {
		Failure(c, http.StatusRequestEntityTooLarge, "file_too_large", "ไฟล์หลักฐานต้องไม่เกิน 5 MB", nil)
		return nil, false
	}
	extension, allowed := evidenceExtensions[http.DetectContentType(data)]
	if !allowed {
		validationFailure(c, map[string]string{"attachment": "รองรับเฉพาะภาพ JPG, PNG, WebP หรือ PDF"})
		return nil, false
	}
	return &adjustmentEvidence{data: data, extension: extension}, true
}

func adjustmentEvidenceDirectory() string {
	if directory := os.Getenv("ADJUSTMENT_EVIDENCE_DIR"); directory != "" {
		return directory
	}
	return filepath.Join("uploads", "adjustments")
}

func saveAdjustmentEvidence(evidence *adjustmentEvidence) (string, string, error) {
	directory := adjustmentEvidenceDirectory()
	if err := os.MkdirAll(directory, 0750); err != nil {
		return "", "", err
	}
	var token [16]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", "", err
	}
	name := hex.EncodeToString(token[:]) + evidence.extension
	path := filepath.Join(directory, name)
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0640)
	if err != nil {
		return "", "", err
	}
	_, writeErr := file.Write(evidence.data)
	closeErr := file.Close()
	if err := errors.Join(writeErr, closeErr); err != nil {
		_ = os.Remove(path)
		return "", "", err
	}
	return adjustmentEvidencePrefix + name, path, nil
}

// Serve only generated filenames that a saved adjustment request actually references.
func (h *Handler) GetAdjustmentEvidence(c *gin.Context) {
	name := c.Param("filename")
	if !evidenceNamePattern.MatchString(name) {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบไฟล์หลักฐาน", nil)
		return
	}
	if !h.databaseReady(c) {
		return
	}
	var count int64
	if err := h.DB.Model(&models.StockAdjustmentRequest{}).Where("attachment_url = ?", adjustmentEvidencePrefix+name).Count(&count).Error; err != nil {
		readDatabaseFailure(c)
		return
	}
	if count == 0 {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบไฟล์หลักฐาน", nil)
		return
	}
	file, err := os.Open(filepath.Join(adjustmentEvidenceDirectory(), name))
	if err != nil {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบไฟล์หลักฐาน", nil)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		Failure(c, http.StatusNotFound, "not_found", "ไม่พบไฟล์หลักฐาน", nil)
		return
	}
	for contentType, extension := range evidenceExtensions {
		if filepath.Ext(name) == extension {
			c.Header("Content-Type", contentType)
		}
	}
	c.Header("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": "evidence" + filepath.Ext(name)}))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Header("Cache-Control", "private, no-store")
	http.ServeContent(c.Writer, c.Request, name, info.ModTime(), file)
}
