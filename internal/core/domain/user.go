package domain

import (
	"time"

	"github.com/google/uuid"
)

// UserRole represents the different roles in the system
type UserRole string

const (
	RoleSuperAdmin  UserRole = "super_admin"
	RoleAgencyAdmin UserRole = "agency_admin"
	RoleAgent       UserRole = "agent"
	RoleCaretaker   UserRole = "caretaker"
	RoleTenant      UserRole = "tenant"
	RoleLandlord    UserRole = "landlord"
)

// UserStatus represents the status of a user account
type UserStatus string

const (
	StatusActive    UserStatus = "active"
	StatusInactive  UserStatus = "inactive"
	StatusSuspended UserStatus = "suspended"
	StatusPending   UserStatus = "pending"
)

// User represents a user in the system
type User struct {
	ID                  uuid.UUID  `json:"id" db:"id"`
	Email               string     `json:"email" db:"email"`
	Password            string     `json:"-" db:"password_hash"` // Never expose password in JSON
	FirstName           string     `json:"first_name" db:"first_name"`
	LastName            string     `json:"last_name" db:"last_name"`
	PhoneNumber         *string    `json:"phone_number" db:"phone_number"`
	Role                UserRole   `json:"role" db:"role"`
	Status              UserStatus `json:"status" db:"status"`
	AgencyID            *uuid.UUID `json:"agency_id" db:"agency_id"`     // Null for super admin and independent landlords
	LandlordID          *uuid.UUID `json:"landlord_id" db:"landlord_id"` // For agents working with independent landlords
	EmailVerified       bool       `json:"email_verified" db:"email_verified"`
	PhoneVerified       bool       `json:"phone_verified" db:"phone_verified"`
	AccountLockedUntil  *time.Time `json:"account_locked_until" db:"account_locked_until"`
	FailedLoginAttempts int        `json:"failed_login_attempts" db:"failed_login_attempts"`
	CreatedBy           *uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
	LastLoginAt         *time.Time `json:"last_login_at" db:"last_login_at"`
}

// Agency represents a property management agency
type Agency struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Email       string     `json:"email" db:"email"`
	PhoneNumber *string    `json:"phone_number" db:"phone_number"`
	Address     *string    `json:"address" db:"address"`
	Status      UserStatus `json:"status" db:"status"`
	CreatedBy   uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// UserPermission represents specific permissions for roles
type UserPermission struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	UserID     uuid.UUID  `json:"user_id" db:"user_id"`
	Permission string     `json:"permission" db:"permission"`
	ResourceID *uuid.UUID `json:"resource_id" db:"resource_id"` // For specific resource permissions
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

// Permission constants
const (
	// User management
	PermissionManageUsers = "manage_users"
	PermissionViewUsers   = "view_users"
	PermissionCreateUsers = "create_users"
	PermissionUpdateUsers = "update_users"
	PermissionDeleteUsers = "delete_users"

	// Agency management
	PermissionManageAgencies = "manage_agencies"
	PermissionViewAgencies   = "view_agencies"
	PermissionCreateAgencies = "create_agencies"
	PermissionUpdateAgencies = "update_agencies"
	PermissionDeleteAgencies = "delete_agencies"

	// Property management
	PermissionManageProperties = "manage_properties"
	PermissionViewProperties   = "view_properties"
	PermissionCreateProperties = "create_properties"
	PermissionUpdateProperties = "update_properties"
	PermissionDeleteProperties = "delete_properties"

	// Tenant management
	PermissionManageTenants = "manage_tenants"
	PermissionViewTenants   = "view_tenants"
	PermissionCreateTenants = "create_tenants"
	PermissionUpdateTenants = "update_tenants"
	PermissionDeleteTenants = "delete_tenants"

	// Payment management
	PermissionManagePayments  = "manage_payments"
	PermissionViewPayments    = "view_payments"
	PermissionProcessPayments = "process_payments"

	// Reports and analytics
	PermissionViewReports   = "view_reports"
	PermissionViewAnalytics = "view_analytics"

	// Maintenance
	PermissionManageMaintenance = "manage_maintenance"
	PermissionViewMaintenance   = "view_maintenance"
	PermissionCreateMaintenance = "create_maintenance"
	PermissionUpdateMaintenance = "update_maintenance"
)

// GetFullName returns the full name of the user
func (u *User) GetFullName() string {
	return u.FirstName + " " + u.LastName
}

// IsActive checks if the user is active
func (u *User) IsActive() bool {
	return u.Status == StatusActive
}

// HasRole checks if the user has a specific role
func (u *User) HasRole(role UserRole) bool {
	return u.Role == role
}

// IsSuperAdmin checks if the user is a super admin
func (u *User) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}

// IsAgencyAdmin checks if the user is an agency admin
func (u *User) IsAgencyAdmin() bool {
	return u.Role == RoleAgencyAdmin
}

// IsAgent checks if the user is an agent
func (u *User) IsAgent() bool {
	return u.Role == RoleAgent
}

// IsCaretaker checks if the user is a caretaker
func (u *User) IsCaretaker() bool {
	return u.Role == RoleCaretaker
}

// IsTenant checks if the user is a tenant
func (u *User) IsTenant() bool {
	return u.Role == RoleTenant
}

// IsLandlord checks if the user is a landlord
func (u *User) IsLandlord() bool {
	return u.Role == RoleLandlord
}

// CanManageAgency checks if the user can manage agency operations
func (u *User) CanManageAgency() bool {
	return u.Role == RoleSuperAdmin || u.Role == RoleAgencyAdmin
}

// CanManageProperties checks if the user can manage properties
func (u *User) CanManageProperties() bool {
	return u.Role == RoleSuperAdmin || u.Role == RoleAgencyAdmin || u.Role == RoleAgent || u.Role == RoleLandlord
}

// CanManageTenants checks if the user can manage tenants
func (u *User) CanManageTenants() bool {
	return u.Role == RoleSuperAdmin || u.Role == RoleAgencyAdmin || u.Role == RoleAgent || u.Role == RoleLandlord
}

// BelongsToAgency checks if the user belongs to a specific agency
func (u *User) BelongsToAgency(agencyID uuid.UUID) bool {
	return u.AgencyID != nil && *u.AgencyID == agencyID
}
