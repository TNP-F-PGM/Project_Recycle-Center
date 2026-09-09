package models

import "time"

// UserRole defines the role type
type UserRole string

const (
	RoleSales               UserRole = "sales"
	RoleTransportSupervisor UserRole = "transport_supervisor"
	RoleDriver              UserRole = "driver"
	RoleManager             UserRole = "manager"
	RoleWarehouseStaff      UserRole = "warehouse_staff"
	RolePurchasingStaff     UserRole = "purchasing_staff"
	RoleCustomerService     UserRole = "customer_service"
	RoleFinance             UserRole = "finance"
	RoleSeller              UserRole = "seller"
)

func ValidUserRole(role UserRole) bool {
	switch role {
	case RoleSales, RoleTransportSupervisor, RoleDriver, RoleManager,
		RoleWarehouseStaff, RolePurchasingStaff, RoleCustomerService,
		RoleFinance, RoleSeller:
		return true
	default:
		return false
	}
}

// User represents a system user (all roles).
type User struct {
	UserID    string    `json:"user_id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	Phone     string    `json:"phone" gorm:"not null"`
	Email     string    `json:"email" gorm:"not null;uniqueIndex"`
	Password  string    `json:"-" gorm:"not null"`
	Role      UserRole  `json:"role" gorm:"not null;check:role IN ('sales','transport_supervisor','driver','manager','warehouse_staff','purchasing_staff','customer_service','finance','seller')"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// Role-specific records (Manager, PurchasingStaff, CustomerServiceOfficer, Seller)
	// reference User. They intentionally do not have reverse foreign-key fields here;
	// reverse associations would create circular foreign keys during AutoMigrate.
}

func (User) TableName() string { return "users" }
