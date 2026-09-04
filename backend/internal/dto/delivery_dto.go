package dto

import (
	"github.com/SA-1-69/T20/backend/internal/models"
	"time"
)

// DeliveryDetailsInput supplies optional delivery details when creating an order.
type DeliveryDetailsInput struct {
	RequestDate string   `json:"request_date"`
	Customer    string   `json:"customer_name"`
	Address     string   `json:"address"`
	Phone       string   `json:"phone_number"`
	Latitude    *float64 `json:"destination_latitude"`
	Longitude   *float64 `json:"destination_longitude"`
}

type UpdateDeliveryRequest struct {
	ClearCoordinates bool                `json:"clear_coordinates"`
	Customer         PatchField[string]  `json:"customer_name"`
	Address          PatchField[string]  `json:"address"`
	Phone            PatchField[string]  `json:"phone_number"`
	RequestDate      PatchField[string]  `json:"request_date"`
	Latitude         PatchField[float64] `json:"destination_latitude"`
	Longitude        PatchField[float64] `json:"destination_longitude"`
}

type AssignDeliveryRequest struct {
	IncidentID     string `json:"incident_id"`
	ResolutionNote string `json:"resolution_note"`
	TruckID        string `json:"truck_id"`
	DriverID       string `json:"driver_id"`
	SupervisorID   string `json:"supervisor_id"`
}

type UpdateDeliveryStatusRequest struct {
	Status   string `json:"status"`
	DriverID string `json:"driver_id"`
}

type CancelDeliveryRequest struct {
	SupervisorID     string `json:"supervisor_id"`
	Reason           string `json:"reason"`
	MaterialsSecured bool   `json:"materials_secured"`
	CancelID         string `json:"cancel_id"`
}

type DeliveryAssignmentResponse struct {
	TruckID    string    `json:"truck_id"`
	DriverID   string    `json:"driver_id"`
	AssignedAt time.Time `json:"assigned_at"`
}

type DeliveryMaterialResponse struct {
	MaterialID string `json:"material_id"`
	Name       string `json:"material_name"`
	Unit       string `json:"unit"`
	Quantity   int    `json:"delivery_quantity"`
}

type DeliveryCancellationResponse struct {
	Reason       string  `json:"reason"`
	SupervisorID *string `json:"supervisor_id"`
	CancelID     string  `json:"cancel_id"`
	TruckID      *string `json:"truck_id"`
	CancelDate   string  `json:"cancel_date"`
}

type DeliveryResponse struct {
	Incidents      []models.DeliveryIncident     `json:"incidents"`
	HasCoordinates bool                          `json:"has_coordinates"`
	RequestID      string                        `json:"request_id"`
	OrderID        string                        `json:"order_id"`
	Customer       string                        `json:"customer_name"`
	Address        string                        `json:"address"`
	Phone          string                        `json:"phone_number"`
	RequestDate    string                        `json:"request_date"`
	Status         string                        `json:"status"`
	SupervisorID   *string                       `json:"supervisor_id"`
	Latitude       float64                       `json:"destination_latitude"`
	Longitude      float64                       `json:"destination_longitude"`
	Materials      []DeliveryMaterialResponse    `json:"materials"`
	Assignment     *DeliveryAssignmentResponse   `json:"assignment"`
	Cancellation   *DeliveryCancellationResponse `json:"cancellation"`
}

type DeliveryListItem struct {
	Latitude       float64 `json:"destination_latitude" gorm:"column:destination_latitude"`
	Longitude      float64 `json:"destination_longitude" gorm:"column:destination_longitude"`
	HasCoordinates bool    `json:"has_coordinates"`
	RequestID      string  `json:"request_id"`
	OrderID        string  `json:"order_id"`
	CustomerName   string  `json:"customer_name"`
	Address        string  `json:"address"`
	RequestDate    string  `json:"request_date"`
	Status         string  `json:"status"`
	SupervisorID   *string `json:"supervisor_id"`
	TruckID        *string `json:"truck_id"`
	DriverID       *string `json:"driver_id"`
}
