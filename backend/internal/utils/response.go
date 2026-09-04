package utils

import (
	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/gin-gonic/gin"
)

// WriteError ends the request with the existing JSON error contract.
func WriteError(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, dto.ErrorResponse{Error: message})
}
