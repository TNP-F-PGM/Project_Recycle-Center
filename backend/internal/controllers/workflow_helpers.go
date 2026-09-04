package controllers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type requestError struct {
	status  int
	message string
}

func (e *requestError) Error() string { return e.message }

func invalid(message string) error  { return &requestError{http.StatusBadRequest, message} }
func conflict(message string) error { return &requestError{http.StatusConflict, message} }

func workflowError(c *gin.Context, err error) {
	var problem *requestError
	switch {
	case errors.As(err, &problem):
		utils.WriteError(c, problem.status, problem.message)
	case errors.Is(err, gorm.ErrRecordNotFound):
		utils.WriteError(c, http.StatusNotFound, "record not found")
	case errors.Is(err, gorm.ErrDuplicatedKey):
		utils.WriteError(c, http.StatusConflict, "ID or relationship already exists")
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		utils.WriteError(c, http.StatusBadRequest, "referenced record does not exist")
	default:
		log.Printf("workflow: %v", err)
		utils.WriteError(c, http.StatusInternalServerError, "could not complete the request")
	}
}

func dateValue(value string, fallback time.Time) (time.Time, error) {
	if value == "" {
		value = fallback.Format(time.DateOnly)
	}
	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return time.Time{}, invalid("dates must use YYYY-MM-DD")
	}
	return parsed, nil
}

func requireText(value, name string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", invalid(name + " is required")
	}
	return value, nil
}

func requireReference(db *gorm.DB, table, column, id string) error {
	// Table and column names come only from constants in controllers.
	var count int64
	if err := db.Table(table).Where(column+" = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return invalid(fmt.Sprintf("%s does not exist", column))
	}
	return nil
}
