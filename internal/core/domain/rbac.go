package domain

import (
	"time"

	"github.com/google/uuid"
)

// PermissionAction represents different types of actions
type PermissionAction string

const (
	ActionCreate PermissionAction = "create"
	ActionRead   PermissionAction = "read"
	ActionUpdate PermissionAction = "update"
	ActionDelete PermissionAction = "delete"
	ActionManage PermissionAction = "manage" // Full CRUD access
	ActionView   PermissionAction = "view"   // Read-only access
)

// ResourceType represents different types of resources
type ResourceType string

const (
	ResourceUser        ResourceType = "user"
	ResourceAgency      ResourceType = "agency"
	ResourceProperty    ResourceType = "property"
	ResourceUnit        ResourceType = "unit"
	ResourceTenant      ResourceType = "tenant"
	ResourceLease       ResourceType = "lease"
	ResourcePayment     ResourceType = "payment"
	ResourceMaintenance ResourceType = "maintenance"
	ResourceReport      ResourceType = "report"
	ResourceSystem      ResourceType = "system"
	ResourceCaretaker   ResourceType = "caretaker"
	ResourceAgent       ResourceType = "agent"
)

// Permission represents a specific permission
type Permission struct {
	ID           uuid.UUID        `json:"id"`
	Code         string           `json:"code"`
	Name         string           `json:"name"`
	Description  string           `json:"description"`
	ResourceType ResourceType     `json:"resource_type"`
	Action       PermissionAction `json:"action"`
	CreatedAt    time.Time        `json:"created_at"`
}

// RolePermission represents permissions assigned to a role
type RolePermission struct {
	ID           uuid.UUID  `json:"id"`
	Role         UserRole   `json:"role"`
	PermissionID uuid.UUID  `json:"permission_id"`
	Permission   Permission `json:"permission,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// UserRoleAssignment represents role assignments to users
type UserRoleAssignment struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Role      UserRole   `json:"role"`
	AgencyID  *uuid.UUID `json:"agency_id"`
	CreatedBy uuid.UUID  `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
	IsActive  bool       `json:"is_active"`
}

// ResourcePermission represents permissions on specific resources
type ResourcePermission struct {
	ID           uuid.UUID        `json:"id"`
	UserID       uuid.UUID        `json:"user_id"`
	ResourceType ResourceType     `json:"resource_type"`
	ResourceID   uuid.UUID        `json:"resource_id"`
	Action       PermissionAction `json:"action"`
	GrantedBy    uuid.UUID        `json:"granted_by"`
	CreatedAt    time.Time        `json:"created_at"`
	ExpiresAt    *time.Time       `json:"expires_at"`
	IsActive     bool             `json:"is_active"`
}

// AccessPolicy represents access control policies
type AccessPolicy struct {
	ID          uuid.UUID    `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Rules       []AccessRule `json:"rules"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	IsActive    bool         `json:"is_active"`
}

// AccessRule represents individual access control rules
type AccessRule struct {
	ID           uuid.UUID        `json:"id"`
	PolicyID     uuid.UUID        `json:"policy_id"`
	ResourceType ResourceType     `json:"resource_type"`
	Action       PermissionAction `json:"action"`
	Condition    string           `json:"condition"` // JSON condition
	Effect       string           `json:"effect"`    // "allow" or "deny"
	Priority     int              `json:"priority"`
}

// RBAC Permission Matrix - Default permissions for each role
var RolePermissions = map[UserRole][]string{
	RoleSuperAdmin: {
		// System-wide permissions
		"system:manage",
		"system:view",
		"system:backup",
		"system:restore",

		// User management
		"user:create",
		"user:read",
		"user:update",
		"user:delete",
		"user:manage",

		// Agency management
		"agency:create",
		"agency:read",
		"agency:update",
		"agency:delete",
		"agency:manage",

		// Property management
		"property:create",
		"property:read",
		"property:update",
		"property:delete",
		"property:manage",

		// Unit management
		"unit:create",
		"unit:read",
		"unit:update",
		"unit:delete",
		"unit:manage",

		// Tenant management
		"tenant:create",
		"tenant:read",
		"tenant:update",
		"tenant:delete",
		"tenant:manage",

		// Payment management
		"payment:create",
		"payment:read",
		"payment:update",
		"payment:delete",
		"payment:manage",
		"payment:process",

		// Maintenance management
		"maintenance:create",
		"maintenance:read",
		"maintenance:update",
		"maintenance:delete",
		"maintenance:manage",

		// Reports and analytics
		"report:create",
		"report:read",
		"report:update",
		"report:delete",
		"report:manage",
		"analytics:view",
		"analytics:export",

		// Audit and security
		"audit:view",
		"security:manage",
	},

	RoleAgencyAdmin: {
		// Agency-scoped permissions
		"agency:read",
		"agency:update",

		// User management within agency
		"user:create",
		"user:read",
		"user:update",
		"user:delete",

		// Property management within agency
		"property:create",
		"property:read",
		"property:update",
		"property:delete",
		"property:manage",

		// Unit management within agency
		"unit:create",
		"unit:read",
		"unit:update",
		"unit:delete",
		"unit:manage",

		// Tenant management within agency
		"tenant:create",
		"tenant:read",
		"tenant:update",
		"tenant:delete",
		"tenant:manage",

		// Payment management within agency
		"payment:read",
		"payment:update",
		"payment:manage",
		"payment:process",

		// Maintenance management within agency
		"maintenance:create",
		"maintenance:read",
		"maintenance:update",
		"maintenance:delete",
		"maintenance:manage",

		// Reports within agency
		"report:create",
		"report:read",
		"report:update",
		"analytics:view",

		// Agent and caretaker management
		"agent:create",
		"agent:read",
		"agent:update",
		"agent:delete",
		"agent:manage",
		"caretaker:create",
		"caretaker:read",
		"caretaker:update",
		"caretaker:delete",
		"caretaker:manage",
	},

	RoleAgent: {
		// Property management (assigned properties only)
		"property:read",
		"property:update",

		// Unit management (assigned units only)
		"unit:read",
		"unit:update",
		"unit:manage",

		// Tenant management (assigned properties only)
		"tenant:create",
		"tenant:read",
		"tenant:update",
		"tenant:manage",

		// Payment management (assigned properties only)
		"payment:read",
		"payment:update",
		"payment:process",

		// Maintenance management (assigned properties only)
		"maintenance:create",
		"maintenance:read",
		"maintenance:update",
		"maintenance:manage",

		// Reports (assigned properties only)
		"report:read",
		"report:create",

		// Caretaker coordination
		"caretaker:read",
		"caretaker:update",
	},

	RoleCaretaker: {
		// Task management
		"task:read",
		"task:update",
		"task:create",

		// Maintenance management (assigned tasks only)
		"maintenance:read",
		"maintenance:update",
		"maintenance:create",

		// Unit management (assigned units only)
		"unit:read",
		"unit:update",

		// Photo and documentation
		"photo:create",
		"photo:read",
		"photo:update",

		// Movement tracking
		"movement:create",
		"movement:read",
		"movement:update",

		// Condition reporting
		"condition:create",
		"condition:read",
		"condition:update",

		// Emergency reporting
		"emergency:create",
		"emergency:read",

		// QR code scanning
		"qr:scan",
		"qr:read",
	},

	RoleLandlord: {
		// Property management (owned properties only)
		"property:create",
		"property:read",
		"property:update",
		"property:delete",
		"property:manage",

		// Unit management (owned units only)
		"unit:create",
		"unit:read",
		"unit:update",
		"unit:delete",
		"unit:manage",

		// Tenant management (owned properties only)
		"tenant:create",
		"tenant:read",
		"tenant:update",
		"tenant:delete",
		"tenant:manage",

		// Payment management (owned properties only)
		"payment:read",
		"payment:update",
		"payment:manage",
		"payment:process",

		// Maintenance management (owned properties only)
		"maintenance:create",
		"maintenance:read",
		"maintenance:update",
		"maintenance:delete",
		"maintenance:manage",

		// Reports (owned properties only)
		"report:create",
		"report:read",
		"report:update",
		"analytics:view",

		// Caretaker management (owned properties only)
		"caretaker:create",
		"caretaker:read",
		"caretaker:update",
		"caretaker:delete",
		"caretaker:manage",
	},

	RoleTenant: {
		// Self-service permissions
		"profile:read",
		"profile:update",

		// Lease management (own lease only)
		"lease:read",

		// Payment management (own payments only)
		"payment:read",
		"payment:create",

		// Maintenance requests (own unit only)
		"maintenance:create",
		"maintenance:read",

		// Unit information (own unit only)
		"unit:read",

		// Communication
		"message:create",
		"message:read",

		// Document access (own documents only)
		"document:read",
	},
}

// GetRolePermissions returns all permissions for a given role
func GetRolePermissions(role UserRole) []string {
	permissions, exists := RolePermissions[role]
	if !exists {
		return []string{}
	}
	return permissions
}

// HasRolePermission checks if a role has a specific permission
func HasRolePermission(role UserRole, permission string) bool {
	permissions := GetRolePermissions(role)
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// GetAllPermissions returns all unique permissions across all roles
func GetAllPermissions() []string {
	permissionSet := make(map[string]bool)
	for _, permissions := range RolePermissions {
		for _, permission := range permissions {
			permissionSet[permission] = true
		}
	}

	var allPermissions []string
	for permission := range permissionSet {
		allPermissions = append(allPermissions, permission)
	}

	return allPermissions
}

// PermissionScope represents the scope of a permission
type PermissionScope string

const (
	ScopeGlobal   PermissionScope = "global"   // System-wide access
	ScopeAgency   PermissionScope = "agency"   // Agency-scoped access
	ScopeProperty PermissionScope = "property" // Property-scoped access
	ScopeUnit     PermissionScope = "unit"     // Unit-scoped access
	ScopeSelf     PermissionScope = "self"     // Self-only access
)

// PermissionDefinition represents a permission definition with scope
type PermissionDefinition struct {
	Code        string           `json:"code"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Scope       PermissionScope  `json:"scope"`
	Resource    ResourceType     `json:"resource"`
	Action      PermissionAction `json:"action"`
}

// PermissionDefinitions maps permission codes to their definitions
var PermissionDefinitions = map[string]PermissionDefinition{
	// System permissions
	"system:manage": {
		Code:        "system:manage",
		Name:        "System Management",
		Description: "Full system administration access",
		Scope:       ScopeGlobal,
		Resource:    ResourceSystem,
		Action:      ActionManage,
	},
	"system:view": {
		Code:        "system:view",
		Name:        "System View",
		Description: "View system information and status",
		Scope:       ScopeGlobal,
		Resource:    ResourceSystem,
		Action:      ActionView,
	},

	// User permissions
	"user:create": {
		Code:        "user:create",
		Name:        "Create Users",
		Description: "Create new user accounts",
		Scope:       ScopeAgency,
		Resource:    ResourceUser,
		Action:      ActionCreate,
	},
	"user:read": {
		Code:        "user:read",
		Name:        "View Users",
		Description: "View user information",
		Scope:       ScopeAgency,
		Resource:    ResourceUser,
		Action:      ActionRead,
	},
	"user:update": {
		Code:        "user:update",
		Name:        "Update Users",
		Description: "Update user information",
		Scope:       ScopeAgency,
		Resource:    ResourceUser,
		Action:      ActionUpdate,
	},
	"user:delete": {
		Code:        "user:delete",
		Name:        "Delete Users",
		Description: "Delete user accounts",
		Scope:       ScopeAgency,
		Resource:    ResourceUser,
		Action:      ActionDelete,
	},
	"user:manage": {
		Code:        "user:manage",
		Name:        "Manage Users",
		Description: "Full user management access",
		Scope:       ScopeAgency,
		Resource:    ResourceUser,
		Action:      ActionManage,
	},

	// Property permissions
	"property:create": {
		Code:        "property:create",
		Name:        "Create Properties",
		Description: "Create new properties",
		Scope:       ScopeAgency,
		Resource:    ResourceProperty,
		Action:      ActionCreate,
	},
	"property:read": {
		Code:        "property:read",
		Name:        "View Properties",
		Description: "View property information",
		Scope:       ScopeProperty,
		Resource:    ResourceProperty,
		Action:      ActionRead,
	},
	"property:update": {
		Code:        "property:update",
		Name:        "Update Properties",
		Description: "Update property information",
		Scope:       ScopeProperty,
		Resource:    ResourceProperty,
		Action:      ActionUpdate,
	},
	"property:delete": {
		Code:        "property:delete",
		Name:        "Delete Properties",
		Description: "Delete properties",
		Scope:       ScopeProperty,
		Resource:    ResourceProperty,
		Action:      ActionDelete,
	},
	"property:manage": {
		Code:        "property:manage",
		Name:        "Manage Properties",
		Description: "Full property management access",
		Scope:       ScopeProperty,
		Resource:    ResourceProperty,
		Action:      ActionManage,
	},

	// Add more permission definitions as needed...
}

// GetPermissionDefinition returns the definition for a permission code
func GetPermissionDefinition(code string) (PermissionDefinition, bool) {
	definition, exists := PermissionDefinitions[code]
	return definition, exists
}

// CheckPermissionScope checks if a permission is valid for a given scope
func CheckPermissionScope(permission string, scope PermissionScope) bool {
	definition, exists := GetPermissionDefinition(permission)
	if !exists {
		return false
	}

	// Global scope can access everything
	if scope == ScopeGlobal {
		return true
	}

	// Check if the permission scope matches or is more restrictive
	switch definition.Scope {
	case ScopeGlobal:
		return scope == ScopeGlobal
	case ScopeAgency:
		return scope == ScopeGlobal || scope == ScopeAgency
	case ScopeProperty:
		return scope == ScopeGlobal || scope == ScopeAgency || scope == ScopeProperty
	case ScopeUnit:
		return scope == ScopeGlobal || scope == ScopeAgency || scope == ScopeProperty || scope == ScopeUnit
	case ScopeSelf:
		return true // Self permissions can be checked at any scope
	default:
		return false
	}
}
