package port

import (
	"context"
	"letrents-backend/internal/core/domain"
	"time"

	"github.com/google/uuid"
)

// ================= ANALYTICS & DASHBOARD PORTS =================

type AnalyticsRepository interface {
	// Platform Analytics
	GetPlatformAnalytics(ctx context.Context) (*domain.PlatformAnalytics, error)
	GetRegionalAnalytics(ctx context.Context, region string) ([]*domain.RegionalAnalytics, error)
	GetAgencyPerformance(ctx context.Context, limit int) ([]*domain.AgencyPerformance, error)
	GetRevenueAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error)
	GetOccupancyAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error)
	GetTenantAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error)

	// KPI Calculations
	CalculateOccupancyRate(ctx context.Context, agencyID *uuid.UUID) (float64, error)
	CalculateLeaseRenewalRate(ctx context.Context, agencyID *uuid.UUID) (float64, error)
	CalculateAgencyHealthScore(ctx context.Context, agencyID uuid.UUID) (float64, error)

	// Historical Data
	GetHistoricalAnalytics(ctx context.Context, dateRange string) ([]*domain.PlatformAnalytics, error)
}

type DashboardService interface {
	GetKPICards(ctx context.Context, filters *domain.DashboardFilters) ([]*domain.KPICard, error)
	GetRevenueChart(ctx context.Context, period string) (*domain.ChartData, error)
	GetOccupancyChart(ctx context.Context, period string) (*domain.ChartData, error)
	GetPropertyHeatmap(ctx context.Context) (*domain.ChartData, error)
	GetRecentActivity(ctx context.Context, limit int) ([]interface{}, error)
}

// ================= AGENCY MANAGEMENT PORTS =================

type SuperAdminAgencyRepository interface {
	// CRUD Operations
	CreateAgency(ctx context.Context, agency *domain.Agency) error
	GetAgency(ctx context.Context, id uuid.UUID) (*domain.Agency, error)
	GetAllAgencies(ctx context.Context, limit, offset int) ([]*domain.Agency, error)
	UpdateAgency(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeleteAgency(ctx context.Context, id uuid.UUID) error

	// Status Management
	SuspendAgency(ctx context.Context, id uuid.UUID, reason string) error
	ReactivateAgency(ctx context.Context, id uuid.UUID) error

	// Performance & Analytics
	GetAgencyStats(ctx context.Context, id uuid.UUID) (*domain.AgencyPerformance, error)
	GetAgencyUsers(ctx context.Context, agencyID uuid.UUID) ([]*domain.User, error)
	GetAgencyProperties(ctx context.Context, agencyID uuid.UUID) ([]interface{}, error)

	// Search & Filter
	SearchAgencies(ctx context.Context, query string, filters map[string]interface{}) ([]*domain.Agency, error)
}

type AgencyApplicationRepository interface {
	CreateApplication(ctx context.Context, app *domain.AgencyApplication) error
	GetApplication(ctx context.Context, id uuid.UUID) (*domain.AgencyApplication, error)
	GetApplications(ctx context.Context, status string, limit, offset int) ([]*domain.AgencyApplication, error)
	UpdateApplication(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	ApproveApplication(ctx context.Context, id uuid.UUID, reviewedBy uuid.UUID, notes string) error
	RejectApplication(ctx context.Context, id uuid.UUID, reviewedBy uuid.UUID, reason string) error
}

// ================= BILLING & SUBSCRIPTION PORTS =================

type SubscriptionRepository interface {
	// Subscription Plans
	CreatePlan(ctx context.Context, plan *domain.SubscriptionPlan) error
	GetPlan(ctx context.Context, id uuid.UUID) (*domain.SubscriptionPlan, error)
	GetAllPlans(ctx context.Context) ([]*domain.SubscriptionPlan, error)
	UpdatePlan(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeletePlan(ctx context.Context, id uuid.UUID) error

	// Subscriptions
	CreateSubscription(ctx context.Context, sub *domain.Subscription) error
	GetSubscription(ctx context.Context, id uuid.UUID) (*domain.Subscription, error)
	GetSubscriptionsByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.Subscription, error)
	GetSubscriptionsByLandlord(ctx context.Context, landlordID uuid.UUID) ([]*domain.Subscription, error)
	UpdateSubscription(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	CancelSubscription(ctx context.Context, id uuid.UUID) error

	// Billing
	GetRevenueSummary(ctx context.Context, period string) (map[string]interface{}, error)
	GetSubscriptionAnalytics(ctx context.Context) (map[string]interface{}, error)
}

type InvoiceRepository interface {
	CreateInvoice(ctx context.Context, invoice *domain.Invoice) error
	GetInvoice(ctx context.Context, id uuid.UUID) (*domain.Invoice, error)
	GetInvoicesBySubscription(ctx context.Context, subscriptionID uuid.UUID) ([]*domain.Invoice, error)
	GetOverdueInvoices(ctx context.Context) ([]*domain.Invoice, error)
	UpdateInvoiceStatus(ctx context.Context, id uuid.UUID, status string) error
	GetRevenueReport(ctx context.Context, dateFrom, dateTo time.Time) ([]interface{}, error)
}

type PromoCodeRepository interface {
	CreatePromoCode(ctx context.Context, promo *domain.PromoCode) error
	GetPromoCode(ctx context.Context, code string) (*domain.PromoCode, error)
	GetAllPromoCodes(ctx context.Context, active bool) ([]*domain.PromoCode, error)
	UpdatePromoCode(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeactivatePromoCode(ctx context.Context, id uuid.UUID) error
	UsePromoCode(ctx context.Context, code string) error
}

// ================= USER & TENANT MANAGEMENT PORTS =================

type SuperAdminUserRepository interface {
	// Global User Operations
	GetAllUsers(ctx context.Context, role *domain.UserRole, limit, offset int) ([]*domain.User, error)
	SearchUsers(ctx context.Context, query string, filters map[string]interface{}) ([]*domain.User, error)
	GetUsersByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.User, error)

	// User Management
	SuspendUser(ctx context.Context, userID uuid.UUID, reason string) error
	ReactivateUser(ctx context.Context, userID uuid.UUID) error
	ResetUserPassword(ctx context.Context, userID uuid.UUID) (string, error)

	// Tenant Global Operations
	GetAllTenants(ctx context.Context, filters map[string]interface{}) ([]*domain.User, error)
	GetTenantsByStatus(ctx context.Context, status domain.UserStatus) ([]*domain.User, error)
	FlagTenant(ctx context.Context, tenantID uuid.UUID, flag string, reason string) error
	ExportTenants(ctx context.Context, filters map[string]interface{}) ([]byte, error)

	// Landlord Operations
	GetIndependentLandlords(ctx context.Context) ([]*domain.User, error)
	GetLandlordProperties(ctx context.Context, landlordID uuid.UUID) ([]interface{}, error)
}

// ================= AUDIT & LOGGING PORTS =================

type AuditRepository interface {
	// Audit Logs
	CreateAuditLog(ctx context.Context, log *domain.AuditLog) error
	GetAuditLogs(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.AuditLog, error)
	GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.AuditLog, error)
	GetResourceAuditLogs(ctx context.Context, resource string, resourceID uuid.UUID) ([]*domain.AuditLog, error)

	// System Logs
	CreateSystemLog(ctx context.Context, log *domain.SystemLog) error
	GetSystemLogs(ctx context.Context, level string, service string, limit, offset int) ([]*domain.SystemLog, error)

	// Login Attempts
	LogLoginAttempt(ctx context.Context, attempt *domain.LoginAttempt) error
	GetLoginAttempts(ctx context.Context, email string, limit, offset int) ([]*domain.LoginAttempt, error)
	GetFailedLoginAttempts(ctx context.Context, timeWindow time.Duration) ([]*domain.LoginAttempt, error)
}

// ================= NOTIFICATION & MESSAGING PORTS =================

type NotificationRepository interface {
	// Templates
	CreateTemplate(ctx context.Context, template *domain.NotificationTemplate) error
	GetTemplate(ctx context.Context, id uuid.UUID) (*domain.NotificationTemplate, error)
	GetTemplateByName(ctx context.Context, name string) (*domain.NotificationTemplate, error)
	GetAllTemplates(ctx context.Context, category string) ([]*domain.NotificationTemplate, error)
	UpdateTemplate(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeleteTemplate(ctx context.Context, id uuid.UUID) error
}

type BroadcastRepository interface {
	CreateBroadcast(ctx context.Context, broadcast *domain.BroadcastMessage) error
	GetBroadcast(ctx context.Context, id uuid.UUID) (*domain.BroadcastMessage, error)
	GetBroadcasts(ctx context.Context, status string, limit, offset int) ([]*domain.BroadcastMessage, error)
	UpdateBroadcast(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	ScheduleBroadcast(ctx context.Context, id uuid.UUID, scheduledFor time.Time) error
	SendBroadcast(ctx context.Context, id uuid.UUID) error
	GetBroadcastStats(ctx context.Context, id uuid.UUID) (map[string]interface{}, error)
}

type MessagingService interface {
	SendEmail(ctx context.Context, to []string, subject, body string) error
	SendSMS(ctx context.Context, to []string, message string) error
	SendPushNotification(ctx context.Context, userIDs []uuid.UUID, title, body string) error
	SendInAppNotification(ctx context.Context, userIDs []uuid.UUID, message string) error
}

// ================= SYSTEM SETTINGS & CONFIGURATION PORTS =================

type SystemSettingRepository interface {
	GetSetting(ctx context.Context, key string) (*domain.SystemSetting, error)
	GetSettingsByCategory(ctx context.Context, category string) ([]*domain.SystemSetting, error)
	GetPublicSettings(ctx context.Context) ([]*domain.SystemSetting, error)
	UpdateSetting(ctx context.Context, key, value string, updatedBy uuid.UUID) error
	CreateSetting(ctx context.Context, setting *domain.SystemSetting) error
	DeleteSetting(ctx context.Context, key string) error
}

type APIKeyRepository interface {
	CreateAPIKey(ctx context.Context, apiKey *domain.APIKey) error
	GetAPIKey(ctx context.Context, key string) (*domain.APIKey, error)
	GetAPIKeysByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.APIKey, error)
	GetAllAPIKeys(ctx context.Context) ([]*domain.APIKey, error)
	UpdateAPIKey(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	RevokeAPIKey(ctx context.Context, id uuid.UUID) error
	RecordAPIKeyUsage(ctx context.Context, keyID uuid.UUID) error
}

// ================= REPORTING PORTS =================

type ReportRepository interface {
	// Report Templates
	CreateReportTemplate(ctx context.Context, template *domain.ReportTemplate) error
	GetReportTemplate(ctx context.Context, id uuid.UUID) (*domain.ReportTemplate, error)
	GetReportTemplates(ctx context.Context, reportType string) ([]*domain.ReportTemplate, error)
	UpdateReportTemplate(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeleteReportTemplate(ctx context.Context, id uuid.UUID) error

	// Scheduled Reports
	CreateScheduledReport(ctx context.Context, report *domain.ScheduledReport) error
	GetScheduledReport(ctx context.Context, id uuid.UUID) (*domain.ScheduledReport, error)
	GetScheduledReports(ctx context.Context) ([]*domain.ScheduledReport, error)
	UpdateScheduledReport(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	DeleteScheduledReport(ctx context.Context, id uuid.UUID) error
	GetDueReports(ctx context.Context) ([]*domain.ScheduledReport, error)

	// Report Generation
	GenerateReport(ctx context.Context, templateID uuid.UUID, parameters map[string]interface{}) ([]byte, error)
	ExportData(ctx context.Context, reportType, format string, filters map[string]interface{}) ([]byte, error)
}

// ================= COMPREHENSIVE SUPER ADMIN SERVICE =================

type SuperAdminService interface {
	// Dashboard & Analytics
	GetDashboardData(ctx context.Context, filters *domain.DashboardFilters) (map[string]interface{}, error)
	GetKPIMetrics(ctx context.Context) ([]*domain.KPICard, error)
	GetAnalyticsCharts(ctx context.Context, chartType string, period string) (*domain.ChartData, error)

	// Agency Management
	ManageAgency(ctx context.Context, action string, agencyID uuid.UUID, data map[string]interface{}) error
	ProcessAgencyApplication(ctx context.Context, applicationID uuid.UUID, action string, reviewerID uuid.UUID, notes string) error

	// Billing & Revenue
	GetRevenueDashboard(ctx context.Context, period string) (map[string]interface{}, error)
	ManageSubscription(ctx context.Context, subscriptionID uuid.UUID, action string, data map[string]interface{}) error
	ProcessPayment(ctx context.Context, invoiceID uuid.UUID, paymentData map[string]interface{}) error

	// User & Tenant Management
	GetGlobalUserMetrics(ctx context.Context) (map[string]interface{}, error)
	ManageUser(ctx context.Context, userID uuid.UUID, action string, data map[string]interface{}) error

	// System Operations
	GetSystemHealth(ctx context.Context) (map[string]interface{}, error)
	ManageSystemSettings(ctx context.Context, settings map[string]interface{}) error

	// Communications
	SendBroadcastMessage(ctx context.Context, message *domain.BroadcastMessage) error
	ManageNotificationTemplates(ctx context.Context, action string, templateID *uuid.UUID, data map[string]interface{}) error

	// Reports & Export
	GenerateSystemReport(ctx context.Context, reportType string, filters map[string]interface{}) ([]byte, error)
	ExportSystemData(ctx context.Context, dataType string, format string, filters map[string]interface{}) ([]byte, error)

	// Audit & Security
	GetAuditTrail(ctx context.Context, filters map[string]interface{}) ([]*domain.AuditLog, error)
	GetSecurityLogs(ctx context.Context, filters map[string]interface{}) ([]*domain.LoginAttempt, error)
	ManageAPIKeys(ctx context.Context, action string, keyID *uuid.UUID, data map[string]interface{}) error
}

// ================= HELPER INTERFACES =================

type FileService interface {
	UploadFile(ctx context.Context, fileData []byte, filename string, folder string) (string, error)
	DeleteFile(ctx context.Context, fileURL string) error
	GeneratePDF(ctx context.Context, htmlContent string) ([]byte, error)
	GenerateExcel(ctx context.Context, data [][]string, headers []string) ([]byte, error)
	GenerateCSV(ctx context.Context, data [][]string) ([]byte, error)
}

type SecurityService interface {
	ValidateIPWhitelist(ctx context.Context, ip string, userID uuid.UUID) bool
	CheckRateLimit(ctx context.Context, identifier string, limit int, window time.Duration) bool
	HashAPIKey(key string) string
	ValidateAPIKey(ctx context.Context, key string) (*domain.APIKey, error)
	Generate2FASecret(ctx context.Context, userID uuid.UUID) (string, error)
	Validate2FAToken(ctx context.Context, userID uuid.UUID, token string) bool
}
