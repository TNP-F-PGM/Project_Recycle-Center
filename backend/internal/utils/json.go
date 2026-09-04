package utils

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Shared JSON decoding for HTTP controllers.
const maxJSONBody = 64 << 10

// Decode a single bounded object without changing Gin's global binding options.
func ReadJSON(c *gin.Context, value any) bool {
	r := c.Request
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		WriteError(c, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return false
	}
	r.Body = http.MaxBytesReader(c.Writer, r.Body, maxJSONBody)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(value); err == nil {
		if err = decoder.Decode(new(any)); errors.Is(err, io.EOF) {
			return true
		}
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		WriteError(c, http.StatusRequestEntityTooLarge, "JSON body must not exceed 64 KiB")
	} else {
		WriteError(c, http.StatusBadRequest, "body must contain one valid JSON object with supported fields")
	}
	return false
}
