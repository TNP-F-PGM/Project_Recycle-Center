package controllers

import "github.com/gin-gonic/gin"

type successResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

type errorDetail struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

type errorResponse struct {
	Success bool        `json:"success"`
	Error   errorDetail `json:"error"`
}

func Success(c *gin.Context, status int, data any, message string) {
	c.JSON(status, successResponse{Success: true, Message: message, Data: data})
}

func Failure(c *gin.Context, status int, code, message string, fields map[string]string) {
	c.AbortWithStatusJSON(status, errorResponse{Success: false, Error: errorDetail{Code: code, Message: message, Fields: fields}})
}
