package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type SuperAdminHandler struct {
	superAdminService port.SuperAdminService
	analyticsRepo     port.AnalyticsRepository
	agencyRepo        port.SuperAdminAgencyRepository
	userRepo          port.SuperAdminUserRepository
	auditRepo         port.AuditRepository
	billingRepo       port.SubscriptionRepository
	reportRepo        port.ReportRepository
}

func NewSuperAdminHandler(
	superAdminService port.SuperAdminService,
	analyticsRepo port.AnalyticsRepository,
	agencyRepo port.SuperAdminAgencyRepository,
	userRepo port.SuperAdminUserRepository,
	auditRepo port.AuditRepository,
	billingRepo port.SubscriptionRepository,
	reportRepo port.ReportRepository,
) *SuperAdminHandler {
	return &SuperAdminHandler{
		superAdminService: superAdminService,
		analyticsRepo:     analyticsRepo,
		agencyRepo:        agencyRepo,
		userRepo:          userRepo,
		auditRepo:         auditRepo,
		billingRepo:       billingRepo,
		reportRepo:        reportRepo,
	}
}

// ================= DASHBOARD & ANALYTICS ENDPOINTS =================

// GetDashboardData returns comprehensive dashboard data
func (h *SuperAdminHandler) GetDashboardData(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters for filters
	filters := &domain.DashboardFilters{
		DateRange: r.URL.Query().Get("date_range"),
		AgencyIDs: r.URL.Query()["agency_ids"],
		Regions:   r.URL.Query()["regions"],
		Status:    r.URL.Query()["status"],
		UserRoles: r.URL.Query()["user_roles"],
	}

	dashboardData, err := h.superAdminService.GetDashboardData(r.Context(), filters)
	if err != nil {
		http.Error(w, "Failed to get dashboard data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    dashboardData,
	})
}

// GetKPIMetrics returns key performance indicators
func (h *SuperAdminHandler) GetKPIMetrics(w http.ResponseWriter, r *http.Request) {
	kpis, err := h.superAdminService.GetKPIMetrics(r.Context())
	if err != nil {
		http.Error(w, "Failed to get KPI metrics: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    kpis,
	})
}

// GetAnalyticsChart returns specific chart data
func (h *SuperAdminHandler) GetAnalyticsChart(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chartType := vars["type"]
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}

	chartData, err := h.superAdminService.GetAnalyticsCharts(r.Context(), chartType, period)
	if err != nil {
		http.Error(w, "Failed to get chart data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    chartData,
	})
}

// GetPlatformAnalytics returns platform-wide analytics
func (h *SuperAdminHandler) GetPlatformAnalytics(w http.ResponseWriter, r *http.Request) {
	analytics, err := h.analyticsRepo.GetPlatformAnalytics(r.Context())
	if err != nil {
		http.Error(w, "Failed to get platform analytics: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    analytics,
	})
}

// ================= AGENCY MANAGEMENT ENDPOINTS =================

// GetAllAgencies returns all agencies with pagination
func (h *SuperAdminHandler) GetAllAgencies(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 20
	}

	agencies, err := h.agencyRepo.GetAllAgencies(r.Context(), limit, offset)
	if err != nil {
		http.Error(w, "Failed to get agencies: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    agencies,
	})
}

// GetAgency returns a specific agency
func (h *SuperAdminHandler) GetAgency(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]

	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid agency ID", http.StatusBadRequest)
		return
	}

	agency, err := h.agencyRepo.GetAgency(r.Context(), id)
	if err != nil {
		http.Error(w, "Failed to get agency: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    agency,
	})
}

// ManageAgency handles various agency management operations
func (h *SuperAdminHandler) ManageAgency(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	action := vars["action"]

	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid agency ID", http.StatusBadRequest)
		return
	}

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.superAdminService.ManageAgency(r.Context(), action, id, data)
	if err != nil {
		http.Error(w, "Failed to manage agency: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Agency " + action + " completed successfully",
	})
}

// GetAgencyPerformance returns agency performance metrics
func (h *SuperAdminHandler) GetAgencyPerformance(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 10
	}

	performance, err := h.analyticsRepo.GetAgencyPerformance(r.Context(), limit)
	if err != nil {
		http.Error(w, "Failed to get agency performance: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    performance,
	})
}

// ================= USER & TENANT MANAGEMENT ENDPOINTS =================

// GetAllUsers returns all users with optional role filtering
func (h *SuperAdminHandler) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	roleStr := r.URL.Query().Get("role")

	if limit == 0 {
		limit = 20
	}

	var role *domain.UserRole
	if roleStr != "" {
		userRole := domain.UserRole(roleStr)
		role = &userRole
	}

	users, err := h.userRepo.GetAllUsers(r.Context(), role, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get users: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    users,
	})
}

// SearchUsers searches for users globally
func (h *SuperAdminHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	filters := make(map[string]interface{})
	if role := r.URL.Query().Get("role"); role != "" {
		filters["role"] = role
	}
	if agency := r.URL.Query().Get("agency_id"); agency != "" {
		filters["agency_id"] = agency
	}

	users, err := h.userRepo.SearchUsers(r.Context(), query, filters)
	if err != nil {
		http.Error(w, "Failed to search users: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    users,
	})
}

// ManageUser handles user management operations
func (h *SuperAdminHandler) ManageUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	action := vars["action"]

	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.superAdminService.ManageUser(r.Context(), id, action, data)
	if err != nil {
		http.Error(w, "Failed to manage user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User " + action + " completed successfully",
	})
}

// GetGlobalUserMetrics returns user metrics across the platform
func (h *SuperAdminHandler) GetGlobalUserMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.superAdminService.GetGlobalUserMetrics(r.Context())
	if err != nil {
		http.Error(w, "Failed to get user metrics: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    metrics,
	})
}

// ================= BILLING & REVENUE ENDPOINTS =================

// GetRevenueDashboard returns revenue analytics
func (h *SuperAdminHandler) GetRevenueDashboard(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}

	dashboard, err := h.superAdminService.GetRevenueDashboard(r.Context(), period)
	if err != nil {
		http.Error(w, "Failed to get revenue dashboard: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    dashboard,
	})
}

// GetRevenueSummary returns revenue summary
func (h *SuperAdminHandler) GetRevenueSummary(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "month"
	}

	summary, err := h.billingRepo.GetRevenueSummary(r.Context(), period)
	if err != nil {
		http.Error(w, "Failed to get revenue summary: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    summary,
	})
}

// ================= AUDIT & LOGGING ENDPOINTS =================

// GetAuditLogs returns audit logs with filtering
func (h *SuperAdminHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 50
	}

	filters := make(map[string]interface{})
	if userID := r.URL.Query().Get("user_id"); userID != "" {
		filters["user_id"] = userID
	}
	if action := r.URL.Query().Get("action"); action != "" {
		filters["action"] = action
	}
	if resource := r.URL.Query().Get("resource"); resource != "" {
		filters["resource"] = resource
	}

	logs, err := h.auditRepo.GetAuditLogs(r.Context(), filters, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get audit logs: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    logs,
	})
}

// GetSecurityLogs returns security-related logs
func (h *SuperAdminHandler) GetSecurityLogs(w http.ResponseWriter, r *http.Request) {
	filters := make(map[string]interface{})
	if email := r.URL.Query().Get("email"); email != "" {
		filters["email"] = email
	}
	if success := r.URL.Query().Get("success"); success != "" {
		filters["success"] = success == "true"
	}

	logs, err := h.superAdminService.GetSecurityLogs(r.Context(), filters)
	if err != nil {
		http.Error(w, "Failed to get security logs: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    logs,
	})
}

// ================= SYSTEM OPERATIONS ENDPOINTS =================

// GetSystemHealth returns system health metrics
func (h *SuperAdminHandler) GetSystemHealth(w http.ResponseWriter, r *http.Request) {
	health, err := h.superAdminService.GetSystemHealth(r.Context())
	if err != nil {
		http.Error(w, "Failed to get system health: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    health,
	})
}

// ManageSystemSettings handles system configuration
func (h *SuperAdminHandler) ManageSystemSettings(w http.ResponseWriter, r *http.Request) {
	var settings map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.superAdminService.ManageSystemSettings(r.Context(), settings)
	if err != nil {
		http.Error(w, "Failed to update system settings: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "System settings updated successfully",
	})
}

// ================= REPORTING ENDPOINTS =================

// GenerateReport generates and returns a system report
func (h *SuperAdminHandler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportType := vars["type"]

	filters := make(map[string]interface{})
	// Parse filters from query parameters
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			filters[key] = values[0]
		}
	}

	reportData, err := h.superAdminService.GenerateSystemReport(r.Context(), reportType, filters)
	if err != nil {
		http.Error(w, "Failed to generate report: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set appropriate headers based on report type
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename="+reportType+"_"+time.Now().Format("2006-01-02")+".pdf")
	w.Write(reportData)
}

// ExportData exports system data in various formats
func (h *SuperAdminHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dataType := vars["type"]
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	filters := make(map[string]interface{})
	for key, values := range r.URL.Query() {
		if key != "format" && len(values) > 0 {
			filters[key] = values[0]
		}
	}

	exportData, err := h.superAdminService.ExportSystemData(r.Context(), dataType, format, filters)
	if err != nil {
		http.Error(w, "Failed to export data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set appropriate headers
	var contentType string
	var extension string
	switch format {
	case "excel":
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		extension = ".xlsx"
	case "csv":
		contentType = "text/csv"
		extension = ".csv"
	default:
		contentType = "application/octet-stream"
		extension = ".dat"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename="+dataType+"_"+time.Now().Format("2006-01-02")+extension)
	w.Write(exportData)
}

// ================= HELPER METHODS =================

// requireSuperAdmin middleware to check if user is super admin
func (h *SuperAdminHandler) requireSuperAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value("user")
		if user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		u, ok := user.(*domain.User)
		if !ok || !u.IsSuperAdmin() {
			http.Error(w, "Forbidden: Super admin access required", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	}
}

// RegisterRoutes registers all super admin routes
func (h *SuperAdminHandler) RegisterRoutes(router *mux.Router) {
	// Create super admin subrouter with middleware
	superAdminRouter := router.PathPrefix("/super-admin").Subrouter()

	// Dashboard & Analytics
	superAdminRouter.HandleFunc("/dashboard", h.requireSuperAdmin(h.GetDashboardData)).Methods("GET")
	superAdminRouter.HandleFunc("/kpis", h.requireSuperAdmin(h.GetKPIMetrics)).Methods("GET")
	superAdminRouter.HandleFunc("/analytics/{type}", h.requireSuperAdmin(h.GetAnalyticsChart)).Methods("GET")
	superAdminRouter.HandleFunc("/platform-analytics", h.requireSuperAdmin(h.GetPlatformAnalytics)).Methods("GET")

	// Agency Management
	superAdminRouter.HandleFunc("/agencies", h.requireSuperAdmin(h.GetAllAgencies)).Methods("GET")
	superAdminRouter.HandleFunc("/agencies/{id}", h.requireSuperAdmin(h.GetAgency)).Methods("GET")
	superAdminRouter.HandleFunc("/agencies/{id}/{action}", h.requireSuperAdmin(h.ManageAgency)).Methods("POST")
	superAdminRouter.HandleFunc("/agencies/performance", h.requireSuperAdmin(h.GetAgencyPerformance)).Methods("GET")

	// User Management
	superAdminRouter.HandleFunc("/users", h.requireSuperAdmin(h.GetAllUsers)).Methods("GET")
	superAdminRouter.HandleFunc("/users/search", h.requireSuperAdmin(h.SearchUsers)).Methods("GET")
	superAdminRouter.HandleFunc("/users/{id}/{action}", h.requireSuperAdmin(h.ManageUser)).Methods("POST")
	superAdminRouter.HandleFunc("/users/metrics", h.requireSuperAdmin(h.GetGlobalUserMetrics)).Methods("GET")

	// Billing & Revenue
	superAdminRouter.HandleFunc("/revenue/dashboard", h.requireSuperAdmin(h.GetRevenueDashboard)).Methods("GET")
	superAdminRouter.HandleFunc("/revenue/summary", h.requireSuperAdmin(h.GetRevenueSummary)).Methods("GET")

	// Audit & Security
	superAdminRouter.HandleFunc("/audit-logs", h.requireSuperAdmin(h.GetAuditLogs)).Methods("GET")
	superAdminRouter.HandleFunc("/security-logs", h.requireSuperAdmin(h.GetSecurityLogs)).Methods("GET")

	// System Operations
	superAdminRouter.HandleFunc("/system/health", h.requireSuperAdmin(h.GetSystemHealth)).Methods("GET")
	superAdminRouter.HandleFunc("/system/settings", h.requireSuperAdmin(h.ManageSystemSettings)).Methods("POST")

	// Reports & Export
	superAdminRouter.HandleFunc("/reports/{type}", h.requireSuperAdmin(h.GenerateReport)).Methods("GET")
	superAdminRouter.HandleFunc("/export/{type}", h.requireSuperAdmin(h.ExportData)).Methods("GET")
}
