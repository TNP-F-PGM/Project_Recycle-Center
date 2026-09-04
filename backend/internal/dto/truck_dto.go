package dto

import "encoding/json"

// Requests contain scalar fields only; nested model associations are not accepted.
type CreateTruckRequest struct {
	TruckID      string  `json:"truck_id"`
	LicensePlate string  `json:"license_plate"`
	Status       string  `json:"status"`
	Capacity     float64 `json:"capacity"`
	DriverID     *string `json:"driver_id"`
	RequestID    *string `json:"request_id"`
}

// RawMessage preserves the existing PATCH validation for omitted and null values.
type UpdateTruckRequest struct {
	LicensePlate json.RawMessage `json:"license_plate"`
	Status       json.RawMessage `json:"status"`
	Capacity     json.RawMessage `json:"capacity"`
}

type TruckResponse struct {
	TruckID      string  `json:"truck_id"`
	LicensePlate string  `json:"license_plate"`
	Status       string  `json:"status"`
	Capacity     float64 `json:"capacity"`
	DriverID     *string `json:"driver_id"`
	RequestID    *string `json:"request_id"`
}
