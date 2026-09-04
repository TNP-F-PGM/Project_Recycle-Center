// Package dto defines the JSON request and response contracts of the API.
package dto

import (
	"bytes"
	"encoding/json"
	"errors"
)

type ErrorResponse struct {
	Error string `json:"error"`
}

// PatchField distinguishes omission from null and keeps nested fields strict.
type PatchField[T any] struct {
	Present bool
	Value   T
}

func (field *PatchField[T]) UnmarshalJSON(data []byte) error {
	field.Present = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		return errors.New("patch fields cannot be null")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	return decoder.Decode(&field.Value)
}
