package handler

import (
	"net/http"

	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/api/service"
	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/utils"

	"github.com/gorilla/mux"
)

// RBACHandler handles role-based access control API endpoints
type RBACHandler struct {
	rbacService *service.RBACService
}

// NewRBACHandler creates a new RBAC handler
func NewRBACHandler(rbacService *service.RBACService) *RBACHandler {
	return &RBACHandler{
		rbacService: rbacService,
	}
}

// GetCurrentUserPermissions returns permissions for the current authenticated user
func (h *RBACHandler) GetCurrentUserPermissions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r)
	if !ok {
		utils.UnauthorizedResponse(w, "User not found in context")
		return
	}

	permissions, err := h.rbacService.GetUserPermissions(r.Context(), userID)
	if err != nil {
		utils.InternalServerErrorResponse(w, "Failed to get user permissions", err)
		return
	}

	utils.SendSuccessResponse(w, map[string]interface{}{
		"user_id":     userID,
		"permissions": permissions,
	}, "User permissions retrieved successfully")
}

// GetAllRoles returns all available roles and their permissions
func (h *RBACHandler) GetAllRoles(w http.ResponseWriter, r *http.Request) {
	roles := map[string][]string{
		string(domain.RoleSuperAdmin):  domain.GetRolePermissions(domain.RoleSuperAdmin),
		string(domain.RoleAgencyAdmin): domain.GetRolePermissions(domain.RoleAgencyAdmin),
		string(domain.RoleAgent):       domain.GetRolePermissions(domain.RoleAgent),
		string(domain.RoleCaretaker):   domain.GetRolePermissions(domain.RoleCaretaker),
		string(domain.RoleLandlord):    domain.GetRolePermissions(domain.RoleLandlord),
		string(domain.RoleTenant):      domain.GetRolePermissions(domain.RoleTenant),
	}

	utils.SendSuccessResponse(w, map[string]interface{}{
		"roles": roles,
	}, "Roles retrieved successfully")
}

// GetAllPermissions returns all available permissions
func (h *RBACHandler) GetAllPermissions(w http.ResponseWriter, r *http.Request) {
	permissions := domain.GetAllPermissions()

	utils.SendSuccessResponse(w, map[string]interface{}{
		"permissions": permissions,
		"count":       len(permissions),
	}, "Permissions retrieved successfully")
}

// CheckCurrentUserPermission checks if the current user has a specific permission
func (h *RBACHandler) CheckCurrentUserPermission(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	permission := vars["permission"]

	userID, ok := middleware.GetUserIDFromContext(r)
	if !ok {
		utils.UnauthorizedResponse(w, "User not found in context")
		return
	}

	hasPermission, err := h.rbacService.CheckPermission(r.Context(), userID, permission)
	if err != nil {
		utils.InternalServerErrorResponse(w, "Failed to check permission", err)
		return
	}

	utils.SendSuccessResponse(w, map[string]interface{}{
		"user_id":        userID,
		"permission":     permission,
		"has_permission": hasPermission,
	}, "Permission check completed")
}

// GetCurrentUserHierarchy returns the permission hierarchy for the current user
func (h *RBACHandler) GetCurrentUserHierarchy(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r)
	if !ok {
		utils.UnauthorizedResponse(w, "User not found in context")
		return
	}

	hierarchy, err := h.rbacService.GetPermissionHierarchy(r.Context(), userID)
	if err != nil {
		utils.InternalServerErrorResponse(w, "Failed to get permission hierarchy", err)
		return
	}

	utils.SendSuccessResponse(w, hierarchy, "Permission hierarchy retrieved successfully")
}
