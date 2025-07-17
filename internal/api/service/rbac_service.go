package service

import (
	"context"
	"fmt"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

// RBACService handles role-based access control operations
type RBACService struct {
	authRepo port.AuthRepository
	userRepo port.UserRepository
}

// NewRBACService creates a new RBAC service
func NewRBACService(authRepo port.AuthRepository, userRepo port.UserRepository) *RBACService {
	return &RBACService{
		authRepo: authRepo,
		userRepo: userRepo,
	}
}

// CheckPermission checks if a user has a specific permission
func (s *RBACService) CheckPermission(ctx context.Context, userID uuid.UUID, permission string) (bool, error) {
	// Get user to check role-based permissions
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if the user's role has this permission
	if domain.HasRolePermission(user.Role, permission) {
		return true, nil
	}

	// Check for specific user permissions in database
	hasPermission, err := s.authRepo.HasPermission(ctx, userID, permission)
	if err != nil {
		return false, fmt.Errorf("failed to check user permission: %w", err)
	}

	return hasPermission, nil
}

// CheckResourcePermission checks if a user has permission on a specific resource
func (s *RBACService) CheckResourcePermission(ctx context.Context, userID uuid.UUID, permission string, resourceType domain.ResourceType, resourceID uuid.UUID) (bool, error) {
	// Get user to check role and context
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true, nil
	}

	// Check role-based permissions first
	if domain.HasRolePermission(user.Role, permission) {
		// Check if user has access to this specific resource
		return s.checkResourceAccess(ctx, user, resourceType, resourceID)
	}

	// Check for specific resource permissions in database
	// This would be implemented based on your specific resource permission schema
	return false, nil
}

// checkResourceAccess checks if user has access to a specific resource based on business rules
func (s *RBACService) checkResourceAccess(ctx context.Context, user *domain.User, resourceType domain.ResourceType, resourceID uuid.UUID) (bool, error) {
	switch resourceType {
	case domain.ResourceProperty:
		return s.checkPropertyAccess(ctx, user, resourceID)
	case domain.ResourceUnit:
		return s.checkUnitAccess(ctx, user, resourceID)
	case domain.ResourceTenant:
		return s.checkTenantAccess(ctx, user, resourceID)
	case domain.ResourceAgency:
		return s.checkAgencyAccess(ctx, user, resourceID)
	default:
		return false, nil
	}
}

// checkPropertyAccess checks if user has access to a specific property
func (s *RBACService) checkPropertyAccess(ctx context.Context, user *domain.User, propertyID uuid.UUID) (bool, error) {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true, nil
	}

	// TODO: Implement property access logic based on your property repository
	// This would typically check:
	// 1. Property ownership (for landlords)
	// 2. Agency management (for agency users)
	// 3. Agent assignments (for agents)

	return true, nil // Placeholder
}

// checkUnitAccess checks if user has access to a specific unit
func (s *RBACService) checkUnitAccess(ctx context.Context, user *domain.User, unitID uuid.UUID) (bool, error) {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true, nil
	}

	// TODO: Implement unit access logic
	// This would typically check:
	// 1. Unit ownership through property
	// 2. Tenant occupancy
	// 3. Caretaker assignments

	return true, nil // Placeholder
}

// checkTenantAccess checks if user has access to tenant information
func (s *RBACService) checkTenantAccess(ctx context.Context, user *domain.User, tenantID uuid.UUID) (bool, error) {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true, nil
	}

	// Tenants can only access their own information
	if user.IsTenant() && user.ID == tenantID {
		return true, nil
	}

	// TODO: Implement tenant access logic for other roles
	// This would check property/unit management relationships

	return true, nil // Placeholder
}

// checkAgencyAccess checks if user has access to agency information
func (s *RBACService) checkAgencyAccess(ctx context.Context, user *domain.User, agencyID uuid.UUID) (bool, error) {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true, nil
	}

	// Users can only access their own agency
	if user.AgencyID != nil && *user.AgencyID == agencyID {
		return true, nil
	}

	return false, nil
}

// GetUserPermissions returns all permissions for a user (role-based + specific)
func (s *RBACService) GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error) {
	// Get user to check role
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Get role-based permissions
	rolePermissions := domain.GetRolePermissions(user.Role)

	// Get specific user permissions from database
	specificPermissions, err := s.authRepo.GetUserPermissions(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Combine and deduplicate permissions
	permissionSet := make(map[string]bool)
	for _, permission := range rolePermissions {
		permissionSet[permission] = true
	}
	for _, permission := range specificPermissions {
		permissionSet[permission] = true
	}

	var allPermissions []string
	for permission := range permissionSet {
		allPermissions = append(allPermissions, permission)
	}

	return allPermissions, nil
}

// GrantPermission grants a specific permission to a user
func (s *RBACService) GrantPermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID, grantedBy uuid.UUID) error {
	return s.authRepo.GrantUserPermission(ctx, userID, permission, resourceID, grantedBy)
}

// RevokePermission revokes a specific permission from a user
func (s *RBACService) RevokePermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID) error {
	return s.authRepo.RevokeUserPermission(ctx, userID, permission, resourceID)
}

// CheckMultiplePermissions checks if a user has all of the specified permissions
func (s *RBACService) CheckMultiplePermissions(ctx context.Context, userID uuid.UUID, permissions []string) (map[string]bool, error) {
	results := make(map[string]bool)

	for _, permission := range permissions {
		hasPermission, err := s.CheckPermission(ctx, userID, permission)
		if err != nil {
			return nil, fmt.Errorf("failed to check permission %s: %w", permission, err)
		}
		results[permission] = hasPermission
	}

	return results, nil
}

// CheckAnyPermission checks if a user has any of the specified permissions
func (s *RBACService) CheckAnyPermission(ctx context.Context, userID uuid.UUID, permissions []string) (bool, error) {
	for _, permission := range permissions {
		hasPermission, err := s.CheckPermission(ctx, userID, permission)
		if err != nil {
			return false, fmt.Errorf("failed to check permission %s: %w", permission, err)
		}
		if hasPermission {
			return true, nil
		}
	}
	return false, nil
}

// GetRolePermissions returns all permissions for a specific role
func (s *RBACService) GetRolePermissions(role domain.UserRole) []string {
	return domain.GetRolePermissions(role)
}

// GetUserRole returns the role of a user
func (s *RBACService) GetUserRole(ctx context.Context, userID uuid.UUID) (domain.UserRole, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get user: %w", err)
	}
	return user.Role, nil
}

// IsUserInRole checks if a user has a specific role
func (s *RBACService) IsUserInRole(ctx context.Context, userID uuid.UUID, role domain.UserRole) (bool, error) {
	userRole, err := s.GetUserRole(ctx, userID)
	if err != nil {
		return false, err
	}
	return userRole == role, nil
}

// GetUsersByRole returns all users with a specific role
func (s *RBACService) GetUsersByRole(ctx context.Context, role domain.UserRole) ([]*domain.User, error) {
	filters := port.UserFilters{
		Role: &role,
	}
	users, _, err := s.userRepo.List(ctx, filters)
	return users, err
}

// CanUserAccessResource checks if a user can access a resource based on their role and permissions
func (s *RBACService) CanUserAccessResource(ctx context.Context, userID uuid.UUID, resourceType domain.ResourceType, resourceID uuid.UUID, action domain.PermissionAction) (bool, error) {
	permission := fmt.Sprintf("%s:%s", resourceType, action)
	return s.CheckResourcePermission(ctx, userID, permission, resourceType, resourceID)
}

// GetAccessibleResources returns resources that a user can access
func (s *RBACService) GetAccessibleResources(ctx context.Context, userID uuid.UUID, resourceType domain.ResourceType, action domain.PermissionAction) ([]uuid.UUID, error) {
	// Get user to check role and context
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Super admin has access to everything
	if user.IsSuperAdmin() {
		// TODO: Return all resources of the specified type
		return []uuid.UUID{}, nil
	}

	// TODO: Implement resource filtering based on user role and permissions
	// This would typically involve:
	// 1. Getting all resources of the specified type
	// 2. Filtering based on user's role and permissions
	// 3. Returning only accessible resource IDs

	return []uuid.UUID{}, nil
}

// ValidatePermission validates if a permission string is valid
func (s *RBACService) ValidatePermission(permission string) bool {
	// Check if permission exists in any role
	allPermissions := domain.GetAllPermissions()
	for _, p := range allPermissions {
		if p == permission {
			return true
		}
	}
	return false
}

// GetPermissionHierarchy returns the permission hierarchy for a user
func (s *RBACService) GetPermissionHierarchy(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	permissions, err := s.GetUserPermissions(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	hierarchy := map[string]interface{}{
		"user_id":        userID,
		"role":           user.Role,
		"permissions":    permissions,
		"agency_id":      user.AgencyID,
		"is_super_admin": user.IsSuperAdmin(),
	}

	return hierarchy, nil
}
