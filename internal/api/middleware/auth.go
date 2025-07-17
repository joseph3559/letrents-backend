package middleware

import (
	"context"
	"net/http"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Context keys for request context
const (
	UserContextKey    = "user"
	ClaimsContextKey  = "claims"
	UserObjContextKey = "user_object"
)

type AuthMiddleware struct {
	jwtManager *utils.JWTManager
	userRepo   port.UserRepository
	authRepo   port.AuthRepository
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(jwtManager *utils.JWTManager, userRepo port.UserRepository, authRepo port.AuthRepository) *AuthMiddleware {
	return &AuthMiddleware{
		jwtManager: jwtManager,
		userRepo:   userRepo,
		authRepo:   authRepo,
	}
}

// RequireAuth middleware to require authentication
func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			utils.UnauthorizedResponse(w, "Authorization header required")
			return
		}

		token := utils.ExtractTokenFromHeader(authHeader)
		if token == "" {
			utils.UnauthorizedResponse(w, "Invalid authorization header format")
			return
		}

		// Validate token
		claims, err := m.jwtManager.ValidateToken(token)
		if err != nil {
			if err == utils.ErrExpiredToken {
				utils.UnauthorizedResponse(w, "Token has expired")
			} else {
				utils.UnauthorizedResponse(w, "Invalid token")
			}
			return
		}

		// Get user from database to ensure they still exist and are active
		user, err := m.userRepo.GetByID(r.Context(), claims.UserID)
		if err != nil {
			utils.UnauthorizedResponse(w, "User not found")
			return
		}

		if !user.IsActive() {
			utils.UnauthorizedResponse(w, "User account is not active")
			return
		}

		// Add user and claims to request context
		userMap := map[string]interface{}{
			"user_id":    claims.UserID.String(),
			"email":      claims.Email,
			"role":       string(claims.Role),
			"agency_id":  "",
			"first_name": user.FirstName,
			"last_name":  user.LastName,
		}

		if claims.AgencyID != nil {
			userMap["agency_id"] = claims.AgencyID.String()
		}

		ctx := context.WithValue(r.Context(), UserContextKey, userMap)
		ctx = context.WithValue(ctx, UserObjContextKey, user)
		ctx = context.WithValue(ctx, ClaimsContextKey, claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole middleware to require specific roles
func (m *AuthMiddleware) RequireRole(allowedRoles []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Check if user has required role
			hasRole := false
			for _, role := range allowedRoles {
				if string(user.Role) == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				utils.ForbiddenResponse(w, "Insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermission middleware to require specific permissions
func (m *AuthMiddleware) RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Check if user has the required permission
			hasPermission, err := m.authRepo.HasPermission(r.Context(), user.ID, permission)
			if err != nil {
				utils.InternalServerErrorResponse(w, "Failed to check permissions", err)
				return
			}

			if !hasPermission {
				utils.ForbiddenResponse(w, "Insufficient permissions: "+permission)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireResourcePermission middleware to require permission on specific resource
func (m *AuthMiddleware) RequireResourcePermission(permission string, resourceIDParam string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Extract resource ID from URL parameters
			vars := mux.Vars(r)
			resourceIDStr, exists := vars[resourceIDParam]
			if !exists {
				utils.BadRequestResponse(w, "Resource ID not found in URL", nil)
				return
			}

			resourceID, err := uuid.Parse(resourceIDStr)
			if err != nil {
				utils.BadRequestResponse(w, "Invalid resource ID format", err)
				return
			}

			// Check if user has permission on this specific resource
			// This would typically involve checking ownership, agency membership, etc.
			hasPermission := m.checkResourceAccess(r.Context(), user, permission, resourceID)
			if !hasPermission {
				utils.ForbiddenResponse(w, "Insufficient permissions for this resource")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAgency middleware to require user belongs to a specific agency
func (m *AuthMiddleware) RequireAgency(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
		if !ok {
			utils.UnauthorizedResponse(w, "User not found in context")
			return
		}

		// Super admin can access all agencies
		if user.IsSuperAdmin() {
			next.ServeHTTP(w, r)
			return
		}

		// Other users must belong to an agency
		if user.AgencyID == nil {
			utils.ForbiddenResponse(w, "User must belong to an agency")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequireActiveUser middleware to ensure user is active
func (m *AuthMiddleware) RequireActiveUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
		if !ok {
			utils.UnauthorizedResponse(w, "User not found in context")
			return
		}

		if !user.IsActive() {
			utils.ForbiddenResponse(w, "User account is not active")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Role-based middleware combinations for common use cases

// RequireSuperAdmin middleware for super admin only routes
func (m *AuthMiddleware) RequireSuperAdmin() func(http.Handler) http.Handler {
	return m.RequireRole([]string{string(domain.RoleSuperAdmin)})
}

// RequireAgencyAdminOrHigher middleware for agency admin and super admin
func (m *AuthMiddleware) RequireAgencyAdminOrHigher() func(http.Handler) http.Handler {
	return m.RequireRole([]string{string(domain.RoleSuperAdmin), string(domain.RoleAgencyAdmin)})
}

// RequireAgentOrHigher middleware for agent, agency admin, and super admin
func (m *AuthMiddleware) RequireAgentOrHigher() func(http.Handler) http.Handler {
	return m.RequireRole([]string{string(domain.RoleSuperAdmin), string(domain.RoleAgencyAdmin), string(domain.RoleAgent)})
}

// RequireCaretakerOrHigher middleware for caretaker and above
func (m *AuthMiddleware) RequireCaretakerOrHigher() func(http.Handler) http.Handler {
	return m.RequireRole([]string{
		string(domain.RoleSuperAdmin),
		string(domain.RoleAgencyAdmin),
		string(domain.RoleAgent),
		string(domain.RoleCaretaker),
	})
}

// RequireLandlordOrHigher middleware for landlord and above
func (m *AuthMiddleware) RequireLandlordOrHigher() func(http.Handler) http.Handler {
	return m.RequireRole([]string{
		string(domain.RoleSuperAdmin),
		string(domain.RoleAgencyAdmin),
		string(domain.RoleAgent),
		string(domain.RoleLandlord),
	})
}

// RequirePropertyAccess middleware to check property access
func (m *AuthMiddleware) RequirePropertyAccess(action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Super admin has access to everything
			if user.IsSuperAdmin() {
				next.ServeHTTP(w, r)
				return
			}

			// Extract property ID from URL
			vars := mux.Vars(r)
			propertyIDStr, exists := vars["propertyId"]
			if !exists {
				propertyIDStr, exists = vars["id"]
				if !exists {
					utils.BadRequestResponse(w, "Property ID not found in URL", nil)
					return
				}
			}

			propertyID, err := uuid.Parse(propertyIDStr)
			if err != nil {
				utils.BadRequestResponse(w, "Invalid property ID format", err)
				return
			}

			// Check property access
			hasAccess := m.checkPropertyAccess(r.Context(), user, propertyID, action)
			if !hasAccess {
				utils.ForbiddenResponse(w, "Insufficient permissions for this property")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireUnitAccess middleware to check unit access
func (m *AuthMiddleware) RequireUnitAccess(action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Super admin has access to everything
			if user.IsSuperAdmin() {
				next.ServeHTTP(w, r)
				return
			}

			// Extract unit ID from URL
			vars := mux.Vars(r)
			unitIDStr, exists := vars["unitId"]
			if !exists {
				unitIDStr, exists = vars["id"]
				if !exists {
					utils.BadRequestResponse(w, "Unit ID not found in URL", nil)
					return
				}
			}

			unitID, err := uuid.Parse(unitIDStr)
			if err != nil {
				utils.BadRequestResponse(w, "Invalid unit ID format", err)
				return
			}

			// Check unit access
			hasAccess := m.checkUnitAccess(r.Context(), user, unitID, action)
			if !hasAccess {
				utils.ForbiddenResponse(w, "Insufficient permissions for this unit")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAgencyMatch middleware to ensure user belongs to the same agency as the resource
func (m *AuthMiddleware) RequireAgencyMatch() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Super admin can access all agencies
			if user.Role == domain.RoleSuperAdmin {
				next.ServeHTTP(w, r)
				return
			}

			// Extract agency ID from URL
			vars := mux.Vars(r)
			agencyIDStr, exists := vars["agencyId"]
			if !exists {
				utils.BadRequestResponse(w, "Agency ID not found in URL", nil)
				return
			}

			agencyID, err := uuid.Parse(agencyIDStr)
			if err != nil {
				utils.BadRequestResponse(w, "Invalid agency ID format", err)
				return
			}

			// Check if user belongs to the same agency
			if user.AgencyID == nil || *user.AgencyID != agencyID {
				utils.ForbiddenResponse(w, "Access denied: user does not belong to this agency")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireTenantSelfOrHigher middleware to require tenant accessing own data or higher role
func (m *AuthMiddleware) RequireTenantSelfOrHigher() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Higher roles can access any tenant data
			if user.Role == domain.RoleSuperAdmin ||
				user.Role == domain.RoleAgencyAdmin ||
				user.Role == domain.RoleAgent {
				next.ServeHTTP(w, r)
				return
			}

			// Extract tenant ID from URL
			vars := mux.Vars(r)
			tenantIDStr, exists := vars["tenantId"]
			if !exists {
				tenantIDStr, exists = vars["id"]
				if !exists {
					utils.BadRequestResponse(w, "Tenant ID not found in URL", nil)
					return
				}
			}

			tenantID, err := uuid.Parse(tenantIDStr)
			if err != nil {
				utils.BadRequestResponse(w, "Invalid tenant ID format", err)
				return
			}

			// Tenants can only access their own data
			if user.Role == domain.RoleTenant && user.ID != tenantID {
				utils.ForbiddenResponse(w, "Access denied: tenants can only access their own data")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Helper methods for access control

// checkResourceAccess checks if user has access to a specific resource
func (m *AuthMiddleware) checkResourceAccess(ctx context.Context, user *domain.User, permission string, resourceID uuid.UUID) bool {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true
	}

	// Check specific permission in database
	hasPermission, err := m.authRepo.HasPermission(ctx, user.ID, permission)
	if err != nil {
		return false
	}

	return hasPermission
}

// checkPropertyAccess checks if user has access to a specific property
func (m *AuthMiddleware) checkPropertyAccess(ctx context.Context, user *domain.User, propertyID uuid.UUID, action string) bool {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true
	}

	// TODO: Implement property-specific access control
	// This would involve checking:
	// - Property ownership (for landlords)
	// - Agency management (for agency users)
	// - Agent assignments (for agents)
	// - Tenant lease agreements (for tenants)

	return true // Placeholder - implement based on business logic
}

// checkUnitAccess checks if user has access to a specific unit
func (m *AuthMiddleware) checkUnitAccess(ctx context.Context, user *domain.User, unitID uuid.UUID, action string) bool {
	// Super admin has access to everything
	if user.IsSuperAdmin() {
		return true
	}

	// TODO: Implement unit-specific access control
	// This would involve checking:
	// - Unit ownership through property
	// - Agency management
	// - Tenant occupancy
	// - Caretaker assignments

	return true // Placeholder - implement based on business logic
}

// GetUserFromContext extracts user from request context
func GetUserFromContext(r *http.Request) (*domain.User, bool) {
	user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
	return user, ok
}

// GetUserMapFromContext extracts user map from request context
func GetUserMapFromContext(r *http.Request) (map[string]interface{}, bool) {
	user, ok := r.Context().Value(UserContextKey).(map[string]interface{})
	return user, ok
}

// GetClaimsFromContext extracts JWT claims from request context
func GetClaimsFromContext(r *http.Request) (*domain.JWTClaims, bool) {
	claims, ok := r.Context().Value(ClaimsContextKey).(*domain.JWTClaims)
	return claims, ok
}

// GetUserIDFromContext extracts user ID from request context
func GetUserIDFromContext(r *http.Request) (uuid.UUID, bool) {
	claims, ok := GetClaimsFromContext(r)
	if !ok {
		return uuid.Nil, false
	}
	return claims.UserID, true
}

// GetUserRoleFromContext extracts user role from request context
func GetUserRoleFromContext(r *http.Request) (domain.UserRole, bool) {
	user, ok := GetUserFromContext(r)
	if !ok {
		return "", false
	}
	return user.Role, true
}

// GetUserAgencyIDFromContext extracts user agency ID from request context
func GetUserAgencyIDFromContext(r *http.Request) (*uuid.UUID, bool) {
	user, ok := GetUserFromContext(r)
	if !ok {
		return nil, false
	}
	return user.AgencyID, true
}

// RequireAnyRole middleware to require any of the specified roles
func (m *AuthMiddleware) RequireAnyRole(roles []domain.UserRole) func(http.Handler) http.Handler {
	roleStrings := make([]string, len(roles))
	for i, role := range roles {
		roleStrings[i] = string(role)
	}
	return m.RequireRole(roleStrings)
}

// RequireAllRoles middleware to require all of the specified roles (rarely used)
func (m *AuthMiddleware) RequireAllRoles(roles []domain.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Check if user has all required roles (typically just one role per user)
			for _, role := range roles {
				if user.Role != role {
					utils.ForbiddenResponse(w, "Insufficient permissions")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAccountStatus middleware to require specific account status
func (m *AuthMiddleware) RequireAccountStatus(statuses []domain.UserStatus) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			// Check if user has required status
			hasStatus := false
			for _, status := range statuses {
				if user.Status == status {
					hasStatus = true
					break
				}
			}

			if !hasStatus {
				utils.ForbiddenResponse(w, "Account status does not meet requirements")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireVerification middleware to require email/phone verification
func (m *AuthMiddleware) RequireVerification(requireEmail, requirePhone bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserObjContextKey).(*domain.User)
			if !ok {
				utils.UnauthorizedResponse(w, "User not found in context")
				return
			}

			if requireEmail && !user.EmailVerified {
				utils.ForbiddenResponse(w, "Email verification required")
				return
			}

			if requirePhone && !user.PhoneVerified {
				utils.ForbiddenResponse(w, "Phone verification required")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Rate limiting middleware (placeholder for future implementation)
func (m *AuthMiddleware) RateLimit(requests int, window string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// TODO: Implement rate limiting logic
			// This would typically use Redis or in-memory cache
			// to track request counts per user/IP
			next.ServeHTTP(w, r)
		})
	}
}

// AuditLog middleware to log important actions
func (m *AuthMiddleware) AuditLog(action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, _ := GetUserFromContext(r)

			// TODO: Implement audit logging
			// Log the action with user info, timestamp, IP, etc.
			_ = user
			_ = action

			next.ServeHTTP(w, r)
		})
	}
}
