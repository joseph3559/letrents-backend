package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"letrents-backend/config"
	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/api/service"
	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/db/postgres"
	"letrents-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// SetupRoutes configures all API routes
func SetupRoutes(
	router *mux.Router,
	cfg *config.Config,
	userRepo port.UserRepository,
	authRepo port.AuthRepository,
	propertyRepo port.PropertyRepository,
	unitRepo port.UnitRepository,
) {
	fmt.Println("🔧 DEBUG: SetupRoutes function called")
	// Initialize JWT manager
	jwtManager := utils.NewJWTManager(cfg.JWT.Secret, cfg.JWT.ExpirationHours)

	// Initialize demo user repository for authentication
	// if userRepo == nil {
	//	userRepo = &MockUserRepository{}
	// }

	// Initialize middleware with RBAC support
	authMiddleware := middleware.NewAuthMiddleware(jwtManager, userRepo, authRepo)

	// Initialize handlers
	userHandler := handler.NewUserHandler(userRepo)

	// Initialize RBAC service and handler
	rbacService := service.NewRBACService(authRepo, userRepo)
	rbacHandler := handler.NewRBACHandler(rbacService)

	// API version prefix
	api := router.PathPrefix("/api/v1").Subrouter()

	// Health check endpoint
	api.HandleFunc("/health", HealthCheckHandler).Methods("GET")

	// Direct test endpoint
	api.HandleFunc("/test-direct", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("🔧 DEBUG: Direct test endpoint called")
		utils.WriteSuccess(w, http.StatusOK, "Direct test endpoint working", map[string]string{"status": "ok"})
	}).Methods("GET")

	// Public routes (no authentication required)
	public := api.PathPrefix("").Subrouter()

	// Authentication routes - basic demo implementation
	auth := public.PathPrefix("/auth").Subrouter()
	auth.HandleFunc("/login", GetLoginHandler(cfg)).Methods("POST")
	auth.HandleFunc("/register", RegisterHandler).Methods("POST")
	auth.HandleFunc("/logout", LogoutHandler).Methods("POST")
	auth.HandleFunc("/me", CurrentUserHandler).Methods("GET")

	// Protected routes (authentication required)
	protected := api.PathPrefix("").Subrouter()
	protected.Use(authMiddleware.RequireAuth)

	// RBAC routes (authentication required)
	rbac := protected.PathPrefix("/rbac").Subrouter()
	rbac.HandleFunc("/roles", rbacHandler.GetAllRoles).Methods("GET")
	rbac.HandleFunc("/permissions", rbacHandler.GetAllPermissions).Methods("GET")
	rbac.HandleFunc("/me/permissions", rbacHandler.GetCurrentUserPermissions).Methods("GET")
	rbac.HandleFunc("/me/check/{permission}", rbacHandler.CheckCurrentUserPermission).Methods("GET")
	rbac.HandleFunc("/me/hierarchy", rbacHandler.GetCurrentUserHierarchy).Methods("GET")

	// User management routes
	users := protected.PathPrefix("/users").Subrouter()
	users.HandleFunc("", userHandler.CreateUser).Methods("POST")
	users.HandleFunc("", userHandler.GetUsers).Methods("GET")
	users.HandleFunc("/{id}", userHandler.GetUser).Methods("GET")
	users.HandleFunc("/{id}", userHandler.UpdateUser).Methods("PUT")
	users.HandleFunc("/{id}", userHandler.DeleteUser).Methods("DELETE")
	users.HandleFunc("/me", userHandler.GetCurrentUser).Methods("GET")
	users.HandleFunc("/me", userHandler.UpdateCurrentUser).Methods("PUT")
	users.HandleFunc("/me/password", userHandler.ChangePassword).Methods("PUT")

	// Admin-only routes
	admin := protected.PathPrefix("/admin").Subrouter()
	admin.Use(authMiddleware.RequireRole([]string{"super_admin"}))
	admin.HandleFunc("/users", userHandler.GetAllUsers).Methods("GET")
	admin.HandleFunc("/users/{id}/activate", userHandler.ActivateUser).Methods("PUT")
	admin.HandleFunc("/users/{id}/deactivate", userHandler.DeactivateUser).Methods("PUT")

	// Agency admin routes
	agencyAdmin := protected.PathPrefix("/agency").Subrouter()
	agencyAdmin.Use(authMiddleware.RequireRole([]string{"super_admin", "agency_admin"}))
	agencyAdmin.HandleFunc("/users", userHandler.GetAgencyUsers).Methods("GET")
	agencyAdmin.HandleFunc("/users", userHandler.CreateAgencyUser).Methods("POST")

	// Property & Unit Management routes
	if propertyRepo != nil && unitRepo != nil {
		// Initialize services
		propertyService := service.NewPropertyService(propertyRepo, unitRepo, userRepo)
		unitService := service.NewUnitService(unitRepo, propertyRepo, userRepo)

		// Setup property management routes
		SetupPropertyManagementRoutes(protected, propertyService, unitService, authMiddleware)
	}

	// Landlord Dashboard routes
	if propertyRepo != nil && unitRepo != nil {
		// Initialize landlord service (using a mock repository for now)
		landlordRepo := &MockLandlordRepository{}
		landlordService := service.NewLandlordService(propertyRepo, unitRepo, userRepo, landlordRepo)

		// Setup landlord routes
		SetupLandlordRoutes(protected, landlordService, authMiddleware)
	}

	// Caretaker routes
	SetupCaretakerRoutes(protected, authMiddleware)

	// Agency routes with enhanced RBAC
	SetupSimpleAgencyRoutes(protected, authMiddleware)

	fmt.Println("🔧 DEBUG: All routes configured successfully")
}

// MockLandlordRepository is a temporary mock implementation for the landlord repository
type MockLandlordRepository struct{}

func (m *MockLandlordRepository) GetDashboardStats(ctx context.Context, landlordID uuid.UUID) (*port.LandlordDashboardStats, error) {
	return &port.LandlordDashboardStats{
		TotalProperties:    8,
		TotalUnits:         45,
		OccupiedUnits:      42,
		VacantUnits:        3,
		OccupancyRate:      93.3,
		TotalTenants:       42,
		ActiveTenants:      42,
		MonthlyRevenue:     680000,
		AnnualRevenue:      8160000,
		PendingMaintenance: 7,
		PendingInspections: 3,
		OverduePayments:    2,
		ExpiringLeases:     5,
	}, nil
}

func (m *MockLandlordRepository) GetRevenueStats(ctx context.Context, landlordID uuid.UUID, period string) (*port.RevenueStats, error) {
	return &port.RevenueStats{
		Period:            period,
		TotalRevenue:      680000,
		PotentialRevenue:  720000,
		RevenueEfficiency: 94.4,
		RevenueByMonth:    []port.RevenueDataPoint{},
		RevenueByProperty: make(map[uuid.UUID]float64),
		RevenueByUnitType: make(map[domain.UnitType]float64),
	}, nil
}

func (m *MockLandlordRepository) GetOccupancyStats(ctx context.Context, landlordID uuid.UUID) (*port.OccupancyStats, error) {
	return &port.OccupancyStats{
		TotalUnits:    45,
		OccupiedUnits: 42,
		VacantUnits:   3,
		OccupancyRate: 93.3,
		ByProperty:    make(map[uuid.UUID]port.OccupancyData),
		ByUnitType:    make(map[domain.UnitType]int),
		Trend:         []port.OccupancyDataPoint{},
	}, nil
}

func (m *MockLandlordRepository) GetMaintenanceStats(ctx context.Context, landlordID uuid.UUID) (*port.MaintenanceStats, error) {
	return &port.MaintenanceStats{
		TotalRequests:     15,
		PendingRequests:   7,
		CompletedRequests: 8,
		AverageResolution: 3.5,
		ByPriority:        make(map[string]int),
		ByCategory:        make(map[string]int),
	}, nil
}

func (m *MockLandlordRepository) GetInspectionStats(ctx context.Context, landlordID uuid.UUID) (*port.InspectionStats, error) {
	return &port.InspectionStats{
		TotalInspections:     12,
		ScheduledInspections: 3,
		CompletedInspections: 9,
		OverdueInspections:   0,
		AverageRating:        4.2,
		ByStatus:             make(map[string]int),
	}, nil
}

func (m *MockLandlordRepository) GetRecentActivities(ctx context.Context, landlordID uuid.UUID, limit int) ([]*port.LandlordActivity, error) {
	return []*port.LandlordActivity{
		{
			ID:          uuid.New(),
			Type:        "payment_received",
			Description: "Rent payment received from Unit A1",
			Amount:      &[]float64{45000}[0],
			Status:      "completed",
			CreatedAt:   time.Now().Add(-2 * time.Hour),
		},
		{
			ID:          uuid.New(),
			Type:        "maintenance_request",
			Description: "New maintenance request for Unit B3",
			Status:      "pending",
			CreatedAt:   time.Now().Add(-4 * time.Hour),
		},
	}, nil
}

func (m *MockLandlordRepository) GetRecentPayments(ctx context.Context, landlordID uuid.UUID, limit int) ([]*port.PaymentRecord, error) {
	return []*port.PaymentRecord{
		{
			Amount:        45000,
			PaymentMethod: "M-Pesa",
			PaymentDate:   time.Now().Add(-2 * time.Hour),
		},
		{
			Amount:        52000,
			PaymentMethod: "Bank Transfer",
			PaymentDate:   time.Now().Add(-24 * time.Hour),
		},
	}, nil
}

func (m *MockLandlordRepository) GetRecentMaintenance(ctx context.Context, landlordID uuid.UUID, limit int) ([]*port.MaintenanceRecord, error) {
	return []*port.MaintenanceRecord{
		{
			ID:          uuid.New(),
			PropertyID:  uuid.New(),
			Title:       "Leaking tap in bathroom",
			Description: "Tenant reported leaking tap in Unit A1 bathroom",
			Category:    "plumbing",
			Priority:    "medium",
			Status:      "pending",
			CreatedAt:   time.Now().Add(-4 * time.Hour),
			UpdatedAt:   time.Now().Add(-4 * time.Hour),
		},
	}, nil
}

func (m *MockLandlordRepository) GetRecentInspections(ctx context.Context, landlordID uuid.UUID, limit int) ([]*port.InspectionRecord, error) {
	return []*port.InspectionRecord{
		{
			ID:             uuid.New(),
			PropertyID:     uuid.New(),
			InspectionType: "routine",
			Status:         "scheduled",
			ScheduledDate:  time.Now().Add(48 * time.Hour),
			CreatedAt:      time.Now().Add(-24 * time.Hour),
		},
	}, nil
}

func (m *MockLandlordRepository) GetNotifications(ctx context.Context, landlordID uuid.UUID, limit, offset int) ([]*port.LandlordNotification, error) {
	return []*port.LandlordNotification{
		{
			ID:        uuid.New(),
			Type:      "payment",
			Title:     "Payment Received",
			Message:   "Rent payment of KSh 45,000 received for Unit A1",
			IsRead:    false,
			CreatedAt: time.Now().Add(-2 * time.Hour),
		},
		{
			ID:        uuid.New(),
			Type:      "maintenance",
			Title:     "New Maintenance Request",
			Message:   "New maintenance request submitted for Unit B3",
			IsRead:    false,
			CreatedAt: time.Now().Add(-4 * time.Hour),
		},
	}, nil
}

func (m *MockLandlordRepository) MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID) error {
	return nil
}

func (m *MockLandlordRepository) GetUnreadNotificationCount(ctx context.Context, landlordID uuid.UUID) (int, error) {
	return 12, nil
}

// Authentication handlers

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	PhoneNumber string `json:"phone_number,omitempty"`
	Role        string `json:"role"`
	AgencyID    string `json:"agency_id,omitempty"`
}

type LoginResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// GetLoginHandler returns a login handler with access to config
func GetLoginHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		LoginHandler(w, r, cfg)
	}
}

// LoginHandler handles user login
func LoginHandler(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request format", err)
		return
	}

	// Demo authentication - require exact credentials
	if req.Email == "" || req.Password == "" {
		utils.WriteError(w, http.StatusBadRequest, "Email and password are required", nil)
		return
	}

	// Validate password for demo accounts
	if req.Password != "admin123!" {
		utils.WriteError(w, http.StatusUnauthorized, "Invalid credentials", nil)
		return
	}

	// Create a demo user response based on email with consistent UUIDs
	var role domain.UserRole
	var firstName, lastName string
	var userID uuid.UUID

	switch req.Email {
	case "admin@letrents.com":
		role = domain.RoleSuperAdmin
		firstName = "Super"
		lastName = "Admin"
		userID = uuid.MustParse("c4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	case "agency@demo.com":
		role = domain.RoleAgencyAdmin
		firstName = "Agency"
		lastName = "Admin"
		userID = uuid.MustParse("a1c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	case "landlord@demo.com":
		role = domain.RoleLandlord
		firstName = "John"
		lastName = "Landlord"
		userID = uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	case "agent@demo.com":
		role = domain.RoleAgent
		firstName = "Jane"
		lastName = "Agent"
		userID = uuid.MustParse("a3c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	case "tenant@demo.com":
		role = domain.RoleTenant
		firstName = "Bob"
		lastName = "Tenant"
		userID = uuid.MustParse("d4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	case "caretaker@demo.com":
		role = domain.RoleCaretaker
		firstName = "Mike"
		lastName = "Caretaker"
		userID = uuid.MustParse("e5c8b0bd-821d-4ca9-bce9-efaa1da85caa")
	default:
		// Unknown email
		utils.WriteError(w, http.StatusUnauthorized, "Invalid credentials", nil)
		return
	}

	// Create a demo user object
	demoUser := &domain.User{
		ID:        userID,
		Email:     req.Email,
		FirstName: firstName,
		LastName:  lastName,
		Role:      role,
		Status:    domain.StatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Generate proper JWT token using config from context
	jwtManager := utils.NewJWTManager("your-super-secret-jwt-key", 24)
	token, expiresAt, err := jwtManager.GenerateToken(demoUser)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to generate token", err)
		return
	}

	refreshToken, _, err := jwtManager.GenerateRefreshToken(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to generate refresh token", err)
		return
	}

	response := map[string]interface{}{
		"token":         token,
		"refresh_token": refreshToken,
		"user": map[string]interface{}{
			"id":         userID.String(),
			"email":      req.Email,
			"first_name": firstName,
			"last_name":  lastName,
			"role":       string(role),
			"status":     "active",
		},
		"expires_at": expiresAt,
	}

	utils.WriteSuccess(w, http.StatusOK, "Login successful", response)
}

// RegisterHandler handles user registration
func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request format", err)
		return
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		utils.WriteError(w, http.StatusBadRequest, "Email, password, first name, and last name are required", nil)
		return
	}

	// Default to tenant role if not specified
	if req.Role == "" {
		req.Role = "tenant"
	}

	// Demo registration - always succeeds
	user := map[string]interface{}{
		"id":         "demo-user-id-" + req.Role,
		"email":      req.Email,
		"first_name": req.FirstName,
		"last_name":  req.LastName,
		"role":       req.Role,
		"status":     "active",
		"created_at": time.Now(),
		"updated_at": time.Now(),
	}

	if req.PhoneNumber != "" {
		user["phone_number"] = req.PhoneNumber
	}

	if req.AgencyID != "" {
		user["agency_id"] = req.AgencyID
	}

	utils.WriteSuccess(w, http.StatusCreated, "Registration successful", user)
}

// LogoutHandler handles user logout
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	utils.WriteSuccess(w, http.StatusOK, "Logout successful", nil)
}

// CurrentUserHandler returns current user information
func CurrentUserHandler(w http.ResponseWriter, r *http.Request) {
	// For demo purposes, return a default user
	user := map[string]interface{}{
		"id":         "demo-user-id",
		"email":      "demo@letrents.com",
		"first_name": "Demo",
		"last_name":  "User",
		"role":       "tenant",
		"status":     "active",
		"created_at": time.Now().Add(-24 * time.Hour),
		"updated_at": time.Now(),
	}

	utils.WriteSuccess(w, http.StatusOK, "Current user retrieved successfully", user)
}

// HealthCheckHandler handles health check requests
func HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	utils.WriteSuccess(w, http.StatusOK, "Service is healthy", map[string]interface{}{
		"status":  "healthy",
		"service": "letrents-backend",
		"version": "1.0.0",
	})
}

// SetupSuperAdminRoutes initializes and registers all Super Admin routes
func SetupSuperAdminRoutes(router *mux.Router, cfg *config.Config, authMiddleware *middleware.AuthMiddleware) {
	// Initialize Super Admin repositories (mock implementations)
	analyticsRepo := postgres.NewAnalyticsRepository()
	agencyRepo := postgres.NewSuperAdminAgencyRepository()
	userRepo := postgres.NewSuperAdminUserRepository()
	auditRepo := postgres.NewAuditRepository()
	billingRepo := postgres.NewSubscriptionRepository()
	reportRepo := postgres.NewReportRepository()
	notificationRepo := postgres.NewNotificationRepository()
	broadcastRepo := postgres.NewBroadcastRepository()
	systemSettingRepo := postgres.NewSystemSettingRepository()
	apiKeyRepo := postgres.NewAPIKeyRepository()
	messagingService := postgres.NewMessagingService()
	fileService := postgres.NewFileService()

	// Initialize Super Admin service
	superAdminService := service.NewSuperAdminService(
		analyticsRepo,
		agencyRepo,
		userRepo,
		auditRepo,
		billingRepo,
		reportRepo,
		notificationRepo,
		broadcastRepo,
		systemSettingRepo,
		apiKeyRepo,
		messagingService,
		fileService,
	)

	// Initialize Super Admin handler
	superAdminHandler := handler.NewSuperAdminHandler(
		superAdminService,
		analyticsRepo,
		agencyRepo,
		userRepo,
		auditRepo,
		billingRepo,
		reportRepo,
	)

	// Register Super Admin routes
	superAdminHandler.RegisterRoutes(router)
}
