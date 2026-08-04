package entity

// User represents a person who can sign in to RecycleHub.
type User struct {
	UserID      string `json:"userId"`
	Name        string `json:"name"`
	Password    string `json:"-"`
	PhoneNumber string `json:"phoneNumber"`
	Role        string `json:"role"`
}

// Driver inherits the common user data through Go struct embedding.
type Driver struct {
	User
}

// TransportSupervisor inherits the common user data through Go struct embedding.
type TransportSupervisor struct {
	User
}

// SalesStaff inherits the common user data through Go struct embedding.
type SalesStaff struct {
	User
}
