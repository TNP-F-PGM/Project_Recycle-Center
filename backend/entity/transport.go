package entity

import "time"

type Truck struct {
	TruckID      string  `json:"truckId"`
	LicensePlate string  `json:"licensePlate"`
	Status       string  `json:"status"`
	Capacity     float64 `json:"capacity"`
	DriverID     string  `json:"driverId,omitempty"`
}

type DeliveryRequest struct {
	RequestID     string         `json:"requestId"`
	CustomerName  string         `json:"customerName"`
	Address       string         `json:"address"`
	PhoneNumber   string         `json:"phoneNumber"`
	RequestDate   time.Time      `json:"requestDate"`
	Status        string         `json:"status"`
	SupervisorID  string         `json:"supervisorId"`
	TruckID       string         `json:"truckId,omitempty"`
	MaterialItems []Material     `json:"materials"`
	Cancellation  *CancelRequest `json:"cancellation,omitempty"`
}

type CancelRequest struct {
	CancelID    string    `json:"cancelId"`
	TruckID     string    `json:"truckId"`
	Reason      string    `json:"reason"`
	RequestDate time.Time `json:"requestDate"`
}
