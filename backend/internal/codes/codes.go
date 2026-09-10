package codes

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// DocumentCounter stores the last allocated number for one document scope.
// The scope includes the document kind, date and warehouse when applicable.
type DocumentCounter struct {
	Scope     string    `gorm:"column:scope;type:text;primaryKey"`
	LastValue int       `gorm:"column:last_value;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null"`
}

func (DocumentCounter) TableName() string { return "document_counters" }

// DocumentWriteRequest makes create requests idempotent when a client retries.
type DocumentWriteRequest struct {
	RequestID   string    `gorm:"column:request_id;type:varchar(128);primaryKey"`
	Fingerprint string    `gorm:"column:fingerprint;type:char(64);not null"`
	Status      int       `gorm:"column:status;not null"`
	Response    []byte    `gorm:"column:response;type:bytea;not null"`
	CreatedAt   time.Time `gorm:"column:created_at;not null"`
}

func (DocumentWriteRequest) TableName() string { return "document_write_requests" }

var prefixes = map[string]string{
	"warehouse":        "WH",
	"zone":             "ZN",
	"material":         "MAT",
	"assessment_batch": "ASM",
	"receipt":          "RCV",
	"issue":            "ISS",
}

func ValidKind(kind string) bool {
	_, ok := prefixes[strings.TrimSpace(kind)]
	return ok
}

func counterScope(kind, warehouseID string, at time.Time) (string, error) {
	kind = strings.TrimSpace(kind)
	if !ValidKind(kind) {
		return "", fmt.Errorf("unsupported document kind %q", kind)
	}
	warehouseID = strings.TrimSpace(warehouseID)
	if kind == "zone" && warehouseID == "" {
		return "", fmt.Errorf("warehouse is required for zone codes")
	}
	return strings.Join([]string{kind, warehouseID, at.Format("200601")}, ":"), nil
}

func format(kind, warehouseID string, at time.Time, sequence int) string {
	if kind == "zone" {
		return fmt.Sprintf("%s-%s-%04d", warehouseID, prefixes[kind], sequence)
	}
	return fmt.Sprintf("%s-%s-%04d", prefixes[kind], at.Format("0601"), sequence)
}

// Preview reads the next number without reserving it.
func Preview(db *gorm.DB, kind, warehouseID string, at time.Time) (string, error) {
	scope, err := counterScope(kind, warehouseID, at)
	if err != nil {
		return "", err
	}
	var counter DocumentCounter
	result := db.Where("scope = ?", scope).Limit(1).Find(&counter)
	if result.Error != nil {
		return "", result.Error
	}
	return format(strings.TrimSpace(kind), strings.TrimSpace(warehouseID), at, counter.LastValue+1), nil
}

// Next atomically reserves and returns the next number. PostgreSQL's upsert
// keeps concurrent requests from receiving the same document code.
func Next(db *gorm.DB, kind, warehouseID string, at time.Time) (string, error) {
	scope, err := counterScope(kind, warehouseID, at)
	if err != nil {
		return "", err
	}
	var sequence int
	err = db.Raw(`
		INSERT INTO document_counters (scope, last_value, updated_at)
		VALUES (?, 1, ?)
		ON CONFLICT (scope) DO UPDATE
		SET last_value = document_counters.last_value + 1,
		    updated_at = EXCLUDED.updated_at
		RETURNING last_value`, scope, at).Scan(&sequence).Error
	if err != nil {
		return "", err
	}
	return format(strings.TrimSpace(kind), strings.TrimSpace(warehouseID), at, sequence), nil
}
