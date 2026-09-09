package controllers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/SA-1-69/T20/backend/internal/codes"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Keep the response private until the document and its number commit together.
// A retry of the same request returns the committed result without another write.
func (h *Handler) DocumentWrite(action func(*Handler, *gin.Context)) gin.HandlerFunc {
	return func(c *gin.Context) {
		if h.DB == nil {
			action(h, c)
			return
		}
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			Failure(c, 400, "invalid_json", "อ่านข้อมูลรายการไม่สำเร็จ", nil)
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))
		var request struct {
			RequestID string `json:"requestID"`
		}
		_ = json.Unmarshal(body, &request)
		if len(request.RequestID) > 128 {
			validationFailure(c, map[string]string{"requestID": "รหัสคำขอยาวเกินไป"})
			return
		}
		original := c.Writer
		defer func() { c.Writer = original }()
		buffered := &documentResponse{ResponseWriter: original, status: 200}
		aborted := errors.New("document rejected")
		digest := sha256.Sum256(append([]byte(c.Request.URL.Path+"\n"), body...))
		fingerprint := hex.EncodeToString(digest[:])
		err = h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
			if request.RequestID != "" {
				if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "document-request:"+request.RequestID).Error; err != nil {
					return err
				}
				var saved codes.DocumentWriteRequest
				result := tx.Where("request_id = ?", request.RequestID).Limit(1).Find(&saved)
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected > 0 {
					if saved.Fingerprint != fingerprint {
						return newOperationError(http.StatusConflict, "request_conflict", "คำขอนี้บันทึกแล้วด้วยข้อมูลอื่น กรุณาตรวจประวัติก่อนสร้างรายการใหม่", nil)
					}
					buffered.status = saved.Status
					_, _ = buffered.Write(saved.Response)
					return nil
				}
			}
			c.Writer = buffered
			scoped := *h
			scoped.DB = tx
			action(&scoped, c)
			if buffered.status >= 400 {
				return aborted
			}
			if request.RequestID != "" {
				return tx.Create(&codes.DocumentWriteRequest{RequestID: request.RequestID, Fingerprint: fingerprint, Status: buffered.status, Response: buffered.body.Bytes()}).Error
			}
			return nil
		})
		c.Writer = original
		if err != nil && !errors.Is(err, aborted) {
			if !respondOperationError(c, err) {
				writeDatabaseFailure(c, err)
			}
			return
		}
		c.Data(buffered.status, "application/json; charset=utf-8", buffered.body.Bytes())
	}
}

type documentResponse struct {
	gin.ResponseWriter
	body    bytes.Buffer
	status  int
	written bool
}

func (w *documentResponse) WriteHeader(status int) {
	if !w.written {
		w.status = status
	}
}
func (w *documentResponse) WriteHeaderNow()                   { w.written = true }
func (w *documentResponse) Write(b []byte) (int, error)       { w.written = true; return w.body.Write(b) }
func (w *documentResponse) WriteString(s string) (int, error) { return w.Write([]byte(s)) }
func (w *documentResponse) Status() int                       { return w.status }
func (w *documentResponse) Size() int {
	if !w.written {
		return -1
	}
	return w.body.Len()
}
func (w *documentResponse) Written() bool { return w.written }
