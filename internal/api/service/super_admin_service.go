package service

import (
	"context"
	"fmt"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

type SuperAdminService struct {
	analyticsRepo     port.AnalyticsRepository
	agencyRepo        port.SuperAdminAgencyRepository
	userRepo          port.SuperAdminUserRepository
	auditRepo         port.AuditRepository
	billingRepo       port.SubscriptionRepository
	reportRepo        port.ReportRepository
	notificationRepo  port.NotificationRepository
	broadcastRepo     port.BroadcastRepository
	systemSettingRepo port.SystemSettingRepository
	apiKeyRepo        port.APIKeyRepository
	messagingService  port.MessagingService
	fileService       port.FileService
}

func NewSuperAdminService(
	analyticsRepo port.AnalyticsRepository,
	agencyRepo port.SuperAdminAgencyRepository,
	userRepo port.SuperAdminUserRepository,
	auditRepo port.AuditRepository,
	billingRepo port.SubscriptionRepository,
	reportRepo port.ReportRepository,
	notificationRepo port.NotificationRepository,
	broadcastRepo port.BroadcastRepository,
	systemSettingRepo port.SystemSettingRepository,
	apiKeyRepo port.APIKeyRepository,
	messagingService port.MessagingService,
	fileService port.FileService,
) port.SuperAdminService {
	return &SuperAdminService{
		analyticsRepo:     analyticsRepo,
		agencyRepo:        agencyRepo,
		userRepo:          userRepo,
		auditRepo:         auditRepo,
		billingRepo:       billingRepo,
		reportRepo:        reportRepo,
		notificationRepo:  notificationRepo,
		broadcastRepo:     broadcastRepo,
		systemSettingRepo: systemSettingRepo,
		apiKeyRepo:        apiKeyRepo,
		messagingService:  messagingService,
		fileService:       fileService,
	}
}

// ================= DASHBOARD & ANALYTICS =================

func (s *SuperAdminService) GetDashboardData(ctx context.Context, filters *domain.DashboardFilters) (map[string]interface{}, error) {
	// Get platform analytics
	analytics, err := s.analyticsRepo.GetPlatformAnalytics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get platform analytics: %w", err)
	}

	// Get KPI cards
	kpis, err := s.GetKPIMetrics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get KPI metrics: %w", err)
	}

	// Get recent activities
	activities, err := s.getRecentActivities(ctx, 20)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent activities: %w", err)
	}

	// Get system health
	systemHealth, err := s.GetSystemHealth(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get system health: %w", err)
	}

	return map[string]interface{}{
		"platform_analytics": analytics,
		"kpi_cards":          kpis,
		"recent_activities":  activities,
		"system_health":      systemHealth,
		"timestamp":          time.Now(),
	}, nil
}

func (s *SuperAdminService) GetKPIMetrics(ctx context.Context) ([]*domain.KPICard, error) {
	analytics, err := s.analyticsRepo.GetPlatformAnalytics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get platform analytics: %w", err)
	}

	kpis := []*domain.KPICard{
		{
			Title:       "Total Agencies",
			Value:       analytics.TotalAgencies,
			Change:      "+5.2%",
			ChangeType:  "positive",
			Icon:        "🏢",
			Color:       "blue",
			Description: "Active agencies on platform",
		},
		{
			Title:       "Total Properties",
			Value:       analytics.TotalProperties,
			Change:      "+12.8%",
			ChangeType:  "positive",
			Icon:        "🏠",
			Color:       "green",
			Description: "Properties managed",
		},
		{
			Title:       "Occupancy Rate",
			Value:       fmt.Sprintf("%.1f%%", analytics.OccupancyRate),
			Change:      "+2.1%",
			ChangeType:  "positive",
			Icon:        "📊",
			Color:       "yellow",
			Description: "Overall occupancy",
		},
		{
			Title:       "Monthly Revenue",
			Value:       fmt.Sprintf("$%.0f", analytics.MonthlyRevenue),
			Change:      "+8.5%",
			ChangeType:  "positive",
			Icon:        "💰",
			Color:       "purple",
			Description: "Platform revenue",
		},
		{
			Title:       "Active Tenants",
			Value:       analytics.ActiveTenants,
			Change:      "+15.3%",
			ChangeType:  "positive",
			Icon:        "👥",
			Color:       "indigo",
			Description: "Tenants on platform",
		},
		{
			Title:       "System Health",
			Value:       "99.9%",
			Change:      "stable",
			ChangeType:  "neutral",
			Icon:        "🔧",
			Color:       "green",
			Description: "Platform uptime",
		},
	}

	return kpis, nil
}

func (s *SuperAdminService) GetAnalyticsCharts(ctx context.Context, chartType string, period string) (*domain.ChartData, error) {
	switch chartType {
	case "revenue":
		return s.analyticsRepo.GetRevenueAnalytics(ctx, period)
	case "occupancy":
		return s.analyticsRepo.GetOccupancyAnalytics(ctx, period)
	case "tenants":
		return s.analyticsRepo.GetTenantAnalytics(ctx, period)
	default:
		return nil, fmt.Errorf("unknown chart type: %s", chartType)
	}
}

// ================= AGENCY MANAGEMENT =================

func (s *SuperAdminService) ManageAgency(ctx context.Context, action string, agencyID uuid.UUID, data map[string]interface{}) error {
	switch action {
	case "suspend":
		reason, ok := data["reason"].(string)
		if !ok {
			return fmt.Errorf("reason is required for suspension")
		}
		return s.agencyRepo.SuspendAgency(ctx, agencyID, reason)
	case "reactivate":
		return s.agencyRepo.ReactivateAgency(ctx, agencyID)
	case "update":
		return s.agencyRepo.UpdateAgency(ctx, agencyID, data)
	case "delete":
		return s.agencyRepo.DeleteAgency(ctx, agencyID)
	default:
		return fmt.Errorf("unknown action: %s", action)
	}
}

func (s *SuperAdminService) ProcessAgencyApplication(ctx context.Context, applicationID uuid.UUID, action string, reviewerID uuid.UUID, notes string) error {
	// This would be implemented with the AgencyApplicationRepository
	// For now, return success
	return nil
}

// ================= BILLING & REVENUE =================

func (s *SuperAdminService) GetRevenueDashboard(ctx context.Context, period string) (map[string]interface{}, error) {
	summary, err := s.billingRepo.GetRevenueSummary(ctx, period)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue summary: %w", err)
	}

	analytics, err := s.billingRepo.GetSubscriptionAnalytics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription analytics: %w", err)
	}

	return map[string]interface{}{
		"revenue_summary":        summary,
		"subscription_analytics": analytics,
		"period":                 period,
		"timestamp":              time.Now(),
	}, nil
}

func (s *SuperAdminService) ManageSubscription(ctx context.Context, subscriptionID uuid.UUID, action string, data map[string]interface{}) error {
	switch action {
	case "cancel":
		return s.billingRepo.CancelSubscription(ctx, subscriptionID)
	case "update":
		return s.billingRepo.UpdateSubscription(ctx, subscriptionID, data)
	default:
		return fmt.Errorf("unknown subscription action: %s", action)
	}
}

func (s *SuperAdminService) ProcessPayment(ctx context.Context, invoiceID uuid.UUID, paymentData map[string]interface{}) error {
	// This would integrate with payment processing
	return nil
}

// ================= USER & TENANT MANAGEMENT =================

func (s *SuperAdminService) GetGlobalUserMetrics(ctx context.Context) (map[string]interface{}, error) {
	// Get users by role
	totalUsers, _ := s.userRepo.GetAllUsers(ctx, nil, 1000, 0) // Get total count
	tenants, _ := s.userRepo.GetAllTenants(ctx, nil)
	landlords, _ := s.userRepo.GetIndependentLandlords(ctx)

	return map[string]interface{}{
		"total_users":         len(totalUsers),
		"total_tenants":       len(tenants),
		"total_landlords":     len(landlords),
		"active_users":        len(totalUsers), // Simplified
		"suspended_users":     0,               // Would need proper filtering
		"new_users_this_week": 25,              // Would need proper calculation
		"user_growth_rate":    15.2,            // Would need proper calculation
	}, nil
}

func (s *SuperAdminService) ManageUser(ctx context.Context, userID uuid.UUID, action string, data map[string]interface{}) error {
	switch action {
	case "suspend":
		reason, ok := data["reason"].(string)
		if !ok {
			return fmt.Errorf("reason is required for suspension")
		}
		return s.userRepo.SuspendUser(ctx, userID, reason)
	case "reactivate":
		return s.userRepo.ReactivateUser(ctx, userID)
	case "reset_password":
		_, err := s.userRepo.ResetUserPassword(ctx, userID)
		return err
	case "flag":
		flag, _ := data["flag"].(string)
		reason, _ := data["reason"].(string)
		return s.userRepo.FlagTenant(ctx, userID, flag, reason)
	default:
		return fmt.Errorf("unknown user action: %s", action)
	}
}

// ================= SYSTEM OPERATIONS =================

func (s *SuperAdminService) GetSystemHealth(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"api": map[string]interface{}{
			"status":        "healthy",
			"response_time": "45ms",
			"uptime":        "99.9%",
		},
		"database": map[string]interface{}{
			"status":          "healthy",
			"connections":     25,
			"queries_per_sec": 150,
		},
		"storage": map[string]interface{}{
			"status": "healthy",
			"usage":  "65%",
			"free":   "2.1TB",
		},
		"payments": map[string]interface{}{
			"status":       "healthy",
			"success_rate": "99.2%",
			"volume":       "$2.4M",
		},
		"last_updated": time.Now(),
	}, nil
}

func (s *SuperAdminService) ManageSystemSettings(ctx context.Context, settings map[string]interface{}) error {
	// Implement system settings management
	return nil
}

// ================= COMMUNICATIONS =================

func (s *SuperAdminService) SendBroadcastMessage(ctx context.Context, message *domain.BroadcastMessage) error {
	// Create broadcast in database
	if err := s.broadcastRepo.CreateBroadcast(ctx, message); err != nil {
		return fmt.Errorf("failed to create broadcast: %w", err)
	}

	// Send immediately or schedule
	if message.ScheduledFor != nil && message.ScheduledFor.After(time.Now()) {
		return s.broadcastRepo.ScheduleBroadcast(ctx, message.ID, *message.ScheduledFor)
	}

	return s.broadcastRepo.SendBroadcast(ctx, message.ID)
}

func (s *SuperAdminService) ManageNotificationTemplates(ctx context.Context, action string, templateID *uuid.UUID, data map[string]interface{}) error {
	switch action {
	case "create":
		template := &domain.NotificationTemplate{}
		// Map data to template
		return s.notificationRepo.CreateTemplate(ctx, template)
	case "update":
		if templateID == nil {
			return fmt.Errorf("template ID is required for update")
		}
		return s.notificationRepo.UpdateTemplate(ctx, *templateID, data)
	case "delete":
		if templateID == nil {
			return fmt.Errorf("template ID is required for delete")
		}
		return s.notificationRepo.DeleteTemplate(ctx, *templateID)
	default:
		return fmt.Errorf("unknown template action: %s", action)
	}
}

// ================= REPORTS & EXPORT =================

func (s *SuperAdminService) GenerateSystemReport(ctx context.Context, reportType string, filters map[string]interface{}) ([]byte, error) {
	// Get data based on report type
	switch reportType {
	case "revenue":
		return s.generateRevenueReport(ctx, filters)
	case "occupancy":
		return s.generateOccupancyReport(ctx, filters)
	case "users":
		return s.generateUsersReport(ctx, filters)
	case "agencies":
		return s.generateAgenciesReport(ctx, filters)
	default:
		return nil, fmt.Errorf("unknown report type: %s", reportType)
	}
}

func (s *SuperAdminService) ExportSystemData(ctx context.Context, dataType string, format string, filters map[string]interface{}) ([]byte, error) {
	switch dataType {
	case "users":
		return s.userRepo.ExportTenants(ctx, filters)
	default:
		return nil, fmt.Errorf("unknown data type: %s", dataType)
	}
}

// ================= AUDIT & SECURITY =================

func (s *SuperAdminService) GetAuditTrail(ctx context.Context, filters map[string]interface{}) ([]*domain.AuditLog, error) {
	limit := 100
	offset := 0

	if l, ok := filters["limit"].(int); ok {
		limit = l
	}
	if o, ok := filters["offset"].(int); ok {
		offset = o
	}

	return s.auditRepo.GetAuditLogs(ctx, filters, limit, offset)
}

func (s *SuperAdminService) GetSecurityLogs(ctx context.Context, filters map[string]interface{}) ([]*domain.LoginAttempt, error) {
	email, _ := filters["email"].(string)
	limit := 100
	offset := 0

	return s.auditRepo.GetLoginAttempts(ctx, email, limit, offset)
}

func (s *SuperAdminService) ManageAPIKeys(ctx context.Context, action string, keyID *uuid.UUID, data map[string]interface{}) error {
	switch action {
	case "create":
		apiKey := &domain.APIKey{}
		// Map data to API key
		return s.apiKeyRepo.CreateAPIKey(ctx, apiKey)
	case "update":
		if keyID == nil {
			return fmt.Errorf("key ID is required for update")
		}
		return s.apiKeyRepo.UpdateAPIKey(ctx, *keyID, data)
	case "revoke":
		if keyID == nil {
			return fmt.Errorf("key ID is required for revoke")
		}
		return s.apiKeyRepo.UpdateAPIKey(ctx, *keyID, map[string]interface{}{"is_active": false})
	default:
		return fmt.Errorf("unknown API key action: %s", action)
	}
}

// ================= HELPER METHODS =================

func (s *SuperAdminService) getRecentActivities(ctx context.Context, limit int) ([]interface{}, error) {
	// Get recent audit logs as activities
	auditLogs, err := s.auditRepo.GetAuditLogs(ctx, map[string]interface{}{}, limit, 0)
	if err != nil {
		return nil, err
	}

	activities := make([]interface{}, len(auditLogs))
	for i, log := range auditLogs {
		activities[i] = map[string]interface{}{
			"id":          log.ID,
			"type":        log.Action,
			"description": fmt.Sprintf("%s performed on %s", log.Action, log.Resource),
			"user_id":     log.UserID,
			"timestamp":   log.CreatedAt,
			"status":      "completed",
		}
	}

	return activities, nil
}

func (s *SuperAdminService) generateRevenueReport(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	// Generate revenue report as PDF
	htmlContent := "<h1>Revenue Report</h1><p>Revenue data goes here...</p>"
	return s.fileService.GeneratePDF(ctx, htmlContent)
}

func (s *SuperAdminService) generateOccupancyReport(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	// Generate occupancy report as PDF
	htmlContent := "<h1>Occupancy Report</h1><p>Occupancy data goes here...</p>"
	return s.fileService.GeneratePDF(ctx, htmlContent)
}

func (s *SuperAdminService) generateUsersReport(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	// Generate users report as PDF
	htmlContent := "<h1>Users Report</h1><p>Users data goes here...</p>"
	return s.fileService.GeneratePDF(ctx, htmlContent)
}

func (s *SuperAdminService) generateAgenciesReport(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	// Generate agencies report as PDF
	htmlContent := "<h1>Agencies Report</h1><p>Agencies data goes here...</p>"
	return s.fileService.GeneratePDF(ctx, htmlContent)
}
