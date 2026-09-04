package dto

type DriverInput struct {
	SupervisorID  string  `json:"supervisor_id"`
	Name          *string `json:"name"`
	Phone         *string `json:"phone"`
	Email         *string `json:"email"`
	Position      *string `json:"position"`
	HireDate      *string `json:"hire_date"`
	Status        *string `json:"status"`
	LicenseNumber *string `json:"license_number"`
	LicenseExpiry *string `json:"license_expiry"`
}

type DriverResponse struct {
	EmployeeResponse
	Phone           string  `json:"phone"`
	Email           string  `json:"email"`
	Status          string  `json:"status"`
	LicenseNumber   *string `json:"license_number"`
	LicenseExpiry   *string `json:"license_expiry"`
	ActiveRequestID *string `json:"active_request_id"`
	Eligible        bool    `json:"eligible"`
}
