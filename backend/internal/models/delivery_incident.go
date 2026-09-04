package models

import "time"

// Incidents keep the vehicle/driver at report time even after reassignment.
type DeliveryIncident struct {
	IncidentID          string               `gorm:"primaryKey" json:"incident_id"`
	RequestID           string               `gorm:"not null;index;uniqueIndex:idx_delivery_open_incident,where:resolved_at IS NULL" json:"request_id"`
	TruckID             string               `gorm:"not null" json:"truck_id"`
	DriverID            string               `gorm:"not null" json:"driver_id"`
	Reason              string               `gorm:"not null" json:"reason"`
	Details             string               `gorm:"not null" json:"details"`
	PreviousStatus      string               `gorm:"not null" json:"previous_status"`
	ReportedAt          time.Time            `gorm:"not null" json:"reported_at"`
	ResolvedAt          *time.Time           `json:"resolved_at"`
	SupervisorID        *string              `json:"supervisor_id"`
	Resolution          string               `json:"resolution"`
	ResolutionNote      string               `json:"resolution_note"`
	ReplacementTruckID  *string              `json:"replacement_truck_id"`
	ReplacementDriverID *string              `json:"replacement_driver_id"`
	Delivery            *DeliveryRequest     `gorm:"belongsTo;foreignKey:RequestID;references:RequestID;constraint:OnDelete:RESTRICT" json:"-"`
	Truck               *Truck               `gorm:"belongsTo;foreignKey:TruckID;references:TruckID;constraint:OnDelete:RESTRICT" json:"-"`
	Driver              *Driver              `gorm:"belongsTo;foreignKey:DriverID;references:EmployeeID;constraint:OnDelete:RESTRICT" json:"-"`
	Supervisor          *TransportSupervisor `gorm:"belongsTo;foreignKey:SupervisorID;references:UserID;constraint:OnDelete:RESTRICT" json:"-"`
}
