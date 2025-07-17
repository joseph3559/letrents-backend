package postgres

import (
	"context"
	"fmt"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

// ================= ANALYTICS REPOSITORY =================

type MockAnalyticsRepository struct{}

func NewAnalyticsRepository() port.AnalyticsRepository {
	return &MockAnalyticsRepository{}
}

func (r *MockAnalyticsRepository) GetPlatformAnalytics(ctx context.Context) (*domain.PlatformAnalytics, error) {
	return &domain.PlatformAnalytics{
		ID:                    uuid.New(),
		TotalAgencies:         45,
		ActiveUnits:           2847,
		VacantUnits:           203,
		TotalProperties:       1248,
		IndependentLandlords:  89,
		ActiveTenants:         2644,
		TenantsInDefault:      23,
		MonthlyRevenue:        2400000,
		YearToDateRevenue:     28800000,
		OccupancyRate:         93.3,
		LeaseRenewalRate:      87.5,
		NewMaintenanceTickets: 45,
		NewComplaintTickets:   12,
		CreatedAt:             time.Now(),
	}, nil
}

func (r *MockAnalyticsRepository) GetRegionalAnalytics(ctx context.Context, region string) ([]*domain.RegionalAnalytics, error) {
	return []*domain.RegionalAnalytics{
		{
			ID:              uuid.New(),
			Region:          "Nairobi",
			OccupancyRate:   95.2,
			TotalProperties: 450,
			ActiveTenants:   1200,
			Revenue:         850000,
			CreatedAt:       time.Now(),
		},
		{
			ID:              uuid.New(),
			Region:          "Mombasa",
			OccupancyRate:   89.8,
			TotalProperties: 320,
			ActiveTenants:   890,
			Revenue:         620000,
			CreatedAt:       time.Now(),
		},
	}, nil
}

func (r *MockAnalyticsRepository) GetAgencyPerformance(ctx context.Context, limit int) ([]*domain.AgencyPerformance, error) {
	performances := []*domain.AgencyPerformance{
		{
			ID:              uuid.New(),
			AgencyID:        uuid.New(),
			AgencyName:      "Prime Properties",
			HealthScore:     95.8,
			Revenue:         450000,
			OccupancyRate:   97.2,
			ComplaintRate:   0.8,
			TotalProperties: 85,
			ActiveTenants:   420,
			CreatedAt:       time.Now(),
		},
		{
			ID:              uuid.New(),
			AgencyID:        uuid.New(),
			AgencyName:      "Urban Living",
			HealthScore:     92.3,
			Revenue:         380000,
			OccupancyRate:   94.1,
			ComplaintRate:   1.2,
			TotalProperties: 67,
			ActiveTenants:   310,
			CreatedAt:       time.Now(),
		},
	}

	if limit > 0 && len(performances) > limit {
		return performances[:limit], nil
	}
	return performances, nil
}

func (r *MockAnalyticsRepository) GetRevenueAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error) {
	return &domain.ChartData{
		Labels: []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun"},
		Data:   []float64{1800000, 2100000, 1950000, 2200000, 2350000, 2400000},
		Colors: []string{"#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"},
		Type:   "line",
	}, nil
}

func (r *MockAnalyticsRepository) GetOccupancyAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error) {
	return &domain.ChartData{
		Labels: []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun"},
		Data:   []float64{91.2, 92.8, 91.5, 93.2, 94.1, 93.3},
		Colors: []string{"#10B981"},
		Type:   "area",
	}, nil
}

func (r *MockAnalyticsRepository) GetTenantAnalytics(ctx context.Context, dateRange string) (*domain.ChartData, error) {
	return &domain.ChartData{
		Labels: []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun"},
		Data:   []float64{2400, 2520, 2480, 2580, 2620, 2644},
		Colors: []string{"#8B5CF6"},
		Type:   "bar",
	}, nil
}

func (r *MockAnalyticsRepository) CalculateOccupancyRate(ctx context.Context, agencyID *uuid.UUID) (float64, error) {
	return 93.3, nil
}

func (r *MockAnalyticsRepository) CalculateLeaseRenewalRate(ctx context.Context, agencyID *uuid.UUID) (float64, error) {
	return 87.5, nil
}

func (r *MockAnalyticsRepository) CalculateAgencyHealthScore(ctx context.Context, agencyID uuid.UUID) (float64, error) {
	return 95.8, nil
}

func (r *MockAnalyticsRepository) GetHistoricalAnalytics(ctx context.Context, dateRange string) ([]*domain.PlatformAnalytics, error) {
	return []*domain.PlatformAnalytics{}, nil
}

// ================= SUPER ADMIN AGENCY REPOSITORY =================

type MockSuperAdminAgencyRepository struct{}

func NewSuperAdminAgencyRepository() port.SuperAdminAgencyRepository {
	return &MockSuperAdminAgencyRepository{}
}

func (r *MockSuperAdminAgencyRepository) CreateAgency(ctx context.Context, agency *domain.Agency) error {
	return nil
}

func (r *MockSuperAdminAgencyRepository) GetAgency(ctx context.Context, id uuid.UUID) (*domain.Agency, error) {
	return &domain.Agency{
		ID:          id,
		Name:        "Prime Properties",
		Email:       "admin@primeproperties.co.ke",
		PhoneNumber: func() *string { s := "+254700123456"; return &s }(),
		Address:     func() *string { s := "123 Business District, Nairobi"; return &s }(),
		Status:      domain.StatusActive,
		CreatedBy:   uuid.New(),
		CreatedAt:   time.Now().AddDate(0, -6, 0),
		UpdatedAt:   time.Now(),
	}, nil
}

func (r *MockSuperAdminAgencyRepository) GetAllAgencies(ctx context.Context, limit, offset int) ([]*domain.Agency, error) {
	agencies := []*domain.Agency{
		{
			ID:          uuid.New(),
			Name:        "Prime Properties",
			Email:       "admin@primeproperties.co.ke",
			PhoneNumber: func() *string { s := "+254700123456"; return &s }(),
			Address:     func() *string { s := "123 Business District, Nairobi"; return &s }(),
			Status:      domain.StatusActive,
			CreatedBy:   uuid.New(),
			CreatedAt:   time.Now().AddDate(0, -6, 0),
			UpdatedAt:   time.Now(),
		},
		{
			ID:          uuid.New(),
			Name:        "Urban Living",
			Email:       "info@urbanliving.co.ke",
			PhoneNumber: func() *string { s := "+254701234567"; return &s }(),
			Address:     func() *string { s := "456 City Center, Mombasa"; return &s }(),
			Status:      domain.StatusActive,
			CreatedBy:   uuid.New(),
			CreatedAt:   time.Now().AddDate(0, -4, 0),
			UpdatedAt:   time.Now(),
		},
	}

	if limit > 0 && len(agencies) > limit {
		return agencies[:limit], nil
	}
	return agencies, nil
}

func (r *MockSuperAdminAgencyRepository) UpdateAgency(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockSuperAdminAgencyRepository) DeleteAgency(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockSuperAdminAgencyRepository) SuspendAgency(ctx context.Context, id uuid.UUID, reason string) error {
	return nil
}

func (r *MockSuperAdminAgencyRepository) ReactivateAgency(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockSuperAdminAgencyRepository) GetAgencyStats(ctx context.Context, id uuid.UUID) (*domain.AgencyPerformance, error) {
	return &domain.AgencyPerformance{
		ID:              uuid.New(),
		AgencyID:        id,
		AgencyName:      "Prime Properties",
		HealthScore:     95.8,
		Revenue:         450000,
		OccupancyRate:   97.2,
		ComplaintRate:   0.8,
		TotalProperties: 85,
		ActiveTenants:   420,
		CreatedAt:       time.Now(),
	}, nil
}

func (r *MockSuperAdminAgencyRepository) GetAgencyUsers(ctx context.Context, agencyID uuid.UUID) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminAgencyRepository) GetAgencyProperties(ctx context.Context, agencyID uuid.UUID) ([]interface{}, error) {
	return []interface{}{}, nil
}

func (r *MockSuperAdminAgencyRepository) SearchAgencies(ctx context.Context, query string, filters map[string]interface{}) ([]*domain.Agency, error) {
	return []*domain.Agency{}, nil
}

// ================= SUPER ADMIN USER REPOSITORY =================

type MockSuperAdminUserRepository struct{}

func NewSuperAdminUserRepository() port.SuperAdminUserRepository {
	return &MockSuperAdminUserRepository{}
}

func (r *MockSuperAdminUserRepository) GetAllUsers(ctx context.Context, role *domain.UserRole, limit, offset int) ([]*domain.User, error) {
	users := []*domain.User{
		{
			ID:          uuid.New(),
			Email:       "admin@primeproperties.co.ke",
			FirstName:   "John",
			LastName:    "Doe",
			PhoneNumber: func() *string { s := "+254700123456"; return &s }(),
			Role:        domain.RoleAgencyAdmin,
			Status:      domain.StatusActive,
			AgencyID:    func() *uuid.UUID { id := uuid.New(); return &id }(),
			CreatedAt:   time.Now().AddDate(0, -6, 0),
			UpdatedAt:   time.Now(),
		},
		{
			ID:          uuid.New(),
			Email:       "landlord@example.com",
			FirstName:   "Jane",
			LastName:    "Smith",
			PhoneNumber: func() *string { s := "+254701234567"; return &s }(),
			Role:        domain.RoleLandlord,
			Status:      domain.StatusActive,
			CreatedAt:   time.Now().AddDate(0, -3, 0),
			UpdatedAt:   time.Now(),
		},
	}

	if limit > 0 && len(users) > limit {
		return users[:limit], nil
	}
	return users, nil
}

func (r *MockSuperAdminUserRepository) SearchUsers(ctx context.Context, query string, filters map[string]interface{}) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminUserRepository) GetUsersByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminUserRepository) SuspendUser(ctx context.Context, userID uuid.UUID, reason string) error {
	return nil
}

func (r *MockSuperAdminUserRepository) ReactivateUser(ctx context.Context, userID uuid.UUID) error {
	return nil
}

func (r *MockSuperAdminUserRepository) ResetUserPassword(ctx context.Context, userID uuid.UUID) (string, error) {
	return "temp-password-123", nil
}

func (r *MockSuperAdminUserRepository) GetAllTenants(ctx context.Context, filters map[string]interface{}) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminUserRepository) GetTenantsByStatus(ctx context.Context, status domain.UserStatus) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminUserRepository) FlagTenant(ctx context.Context, tenantID uuid.UUID, flag string, reason string) error {
	return nil
}

func (r *MockSuperAdminUserRepository) ExportTenants(ctx context.Context, filters map[string]interface{}) ([]byte, error) {
	return []byte("CSV data here"), nil
}

func (r *MockSuperAdminUserRepository) GetIndependentLandlords(ctx context.Context) ([]*domain.User, error) {
	return []*domain.User{}, nil
}

func (r *MockSuperAdminUserRepository) GetLandlordProperties(ctx context.Context, landlordID uuid.UUID) ([]interface{}, error) {
	return []interface{}{}, nil
}

// ================= AUDIT REPOSITORY =================

type MockAuditRepository struct{}

func NewAuditRepository() port.AuditRepository {
	return &MockAuditRepository{}
}

func (r *MockAuditRepository) CreateAuditLog(ctx context.Context, log *domain.AuditLog) error {
	return nil
}

func (r *MockAuditRepository) GetAuditLogs(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.AuditLog, error) {
	logs := []*domain.AuditLog{
		{
			ID:         uuid.New(),
			UserID:     func() *uuid.UUID { id := uuid.New(); return &id }(),
			Action:     "created",
			Resource:   "property",
			ResourceID: func() *uuid.UUID { id := uuid.New(); return &id }(),
			IPAddress:  "192.168.1.1",
			UserAgent:  "Mozilla/5.0",
			CreatedAt:  time.Now().Add(-1 * time.Hour),
		},
		{
			ID:         uuid.New(),
			UserID:     func() *uuid.UUID { id := uuid.New(); return &id }(),
			Action:     "updated",
			Resource:   "user",
			ResourceID: func() *uuid.UUID { id := uuid.New(); return &id }(),
			IPAddress:  "192.168.1.2",
			UserAgent:  "Mozilla/5.0",
			CreatedAt:  time.Now().Add(-2 * time.Hour),
		},
	}

	if limit > 0 && len(logs) > limit {
		return logs[:limit], nil
	}
	return logs, nil
}

func (r *MockAuditRepository) GetUserAuditLogs(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*domain.AuditLog, error) {
	return []*domain.AuditLog{}, nil
}

func (r *MockAuditRepository) GetResourceAuditLogs(ctx context.Context, resource string, resourceID uuid.UUID) ([]*domain.AuditLog, error) {
	return []*domain.AuditLog{}, nil
}

func (r *MockAuditRepository) CreateSystemLog(ctx context.Context, log *domain.SystemLog) error {
	return nil
}

func (r *MockAuditRepository) GetSystemLogs(ctx context.Context, level string, service string, limit, offset int) ([]*domain.SystemLog, error) {
	return []*domain.SystemLog{}, nil
}

func (r *MockAuditRepository) LogLoginAttempt(ctx context.Context, attempt *domain.LoginAttempt) error {
	return nil
}

func (r *MockAuditRepository) GetLoginAttempts(ctx context.Context, email string, limit, offset int) ([]*domain.LoginAttempt, error) {
	attempts := []*domain.LoginAttempt{
		{
			ID:        uuid.New(),
			Email:     &email,
			IPAddress: "192.168.1.1",
			UserAgent: "Mozilla/5.0",
			Success:   true,
			UserID:    func() *uuid.UUID { id := uuid.New(); return &id }(),
			CreatedAt: time.Now().Add(-1 * time.Hour),
		},
	}

	if limit > 0 && len(attempts) > limit {
		return attempts[:limit], nil
	}
	return attempts, nil
}

func (r *MockAuditRepository) GetFailedLoginAttempts(ctx context.Context, timeWindow time.Duration) ([]*domain.LoginAttempt, error) {
	return []*domain.LoginAttempt{}, nil
}

// ================= SUBSCRIPTION REPOSITORY =================

type MockSubscriptionRepository struct{}

func NewSubscriptionRepository() port.SubscriptionRepository {
	return &MockSubscriptionRepository{}
}

func (r *MockSubscriptionRepository) CreatePlan(ctx context.Context, plan *domain.SubscriptionPlan) error {
	return nil
}

func (r *MockSubscriptionRepository) GetPlan(ctx context.Context, id uuid.UUID) (*domain.SubscriptionPlan, error) {
	return &domain.SubscriptionPlan{
		ID:           id,
		Name:         "Premium Plan",
		Type:         "premium",
		MonthlyPrice: 99.99,
		YearlyPrice:  999.99,
		Features:     []string{"unlimited_properties", "advanced_analytics", "priority_support"},
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}, nil
}

func (r *MockSubscriptionRepository) GetAllPlans(ctx context.Context) ([]*domain.SubscriptionPlan, error) {
	return []*domain.SubscriptionPlan{}, nil
}

func (r *MockSubscriptionRepository) UpdatePlan(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockSubscriptionRepository) DeletePlan(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockSubscriptionRepository) CreateSubscription(ctx context.Context, sub *domain.Subscription) error {
	return nil
}

func (r *MockSubscriptionRepository) GetSubscription(ctx context.Context, id uuid.UUID) (*domain.Subscription, error) {
	return &domain.Subscription{}, nil
}

func (r *MockSubscriptionRepository) GetSubscriptionsByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.Subscription, error) {
	return []*domain.Subscription{}, nil
}

func (r *MockSubscriptionRepository) GetSubscriptionsByLandlord(ctx context.Context, landlordID uuid.UUID) ([]*domain.Subscription, error) {
	return []*domain.Subscription{}, nil
}

func (r *MockSubscriptionRepository) UpdateSubscription(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockSubscriptionRepository) CancelSubscription(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockSubscriptionRepository) GetRevenueSummary(ctx context.Context, period string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"total_revenue":           2400000,
		"monthly_recurring":       450000,
		"new_subscriptions":       45,
		"cancelled_subscriptions": 12,
		"conversion_rate":         15.8,
	}, nil
}

func (r *MockSubscriptionRepository) GetSubscriptionAnalytics(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"total_subscriptions":  156,
		"active_subscriptions": 142,
		"trial_subscriptions":  14,
		"churn_rate":           5.2,
	}, nil
}

// ================= REPORT REPOSITORY =================

type MockReportRepository struct{}

func NewReportRepository() port.ReportRepository {
	return &MockReportRepository{}
}

// Report Templates
func (r *MockReportRepository) CreateReportTemplate(ctx context.Context, template *domain.ReportTemplate) error {
	return nil
}

func (r *MockReportRepository) GetReportTemplate(ctx context.Context, id uuid.UUID) (*domain.ReportTemplate, error) {
	return &domain.ReportTemplate{}, nil
}

func (r *MockReportRepository) GetReportTemplates(ctx context.Context, reportType string) ([]*domain.ReportTemplate, error) {
	return []*domain.ReportTemplate{}, nil
}

func (r *MockReportRepository) UpdateReportTemplate(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockReportRepository) DeleteReportTemplate(ctx context.Context, id uuid.UUID) error {
	return nil
}

// Scheduled Reports
func (r *MockReportRepository) CreateScheduledReport(ctx context.Context, report *domain.ScheduledReport) error {
	return nil
}

func (r *MockReportRepository) GetScheduledReport(ctx context.Context, id uuid.UUID) (*domain.ScheduledReport, error) {
	return &domain.ScheduledReport{}, nil
}

func (r *MockReportRepository) GetScheduledReports(ctx context.Context) ([]*domain.ScheduledReport, error) {
	return []*domain.ScheduledReport{}, nil
}

func (r *MockReportRepository) UpdateScheduledReport(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockReportRepository) DeleteScheduledReport(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockReportRepository) GetDueReports(ctx context.Context) ([]*domain.ScheduledReport, error) {
	return []*domain.ScheduledReport{}, nil
}

// Report Generation
func (r *MockReportRepository) GenerateReport(ctx context.Context, templateID uuid.UUID, parameters map[string]interface{}) ([]byte, error) {
	return []byte("PDF report data"), nil
}

func (r *MockReportRepository) ExportData(ctx context.Context, reportType, format string, filters map[string]interface{}) ([]byte, error) {
	return []byte("Export data"), nil
}

// ================= NOTIFICATION REPOSITORY =================

type MockNotificationRepository struct{}

func NewNotificationRepository() port.NotificationRepository {
	return &MockNotificationRepository{}
}

func (r *MockNotificationRepository) CreateTemplate(ctx context.Context, template *domain.NotificationTemplate) error {
	return nil
}

func (r *MockNotificationRepository) GetTemplate(ctx context.Context, id uuid.UUID) (*domain.NotificationTemplate, error) {
	return &domain.NotificationTemplate{}, nil
}

func (r *MockNotificationRepository) GetTemplateByName(ctx context.Context, name string) (*domain.NotificationTemplate, error) {
	return &domain.NotificationTemplate{}, nil
}

func (r *MockNotificationRepository) GetAllTemplates(ctx context.Context, category string) ([]*domain.NotificationTemplate, error) {
	return []*domain.NotificationTemplate{}, nil
}

func (r *MockNotificationRepository) UpdateTemplate(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockNotificationRepository) DeleteTemplate(ctx context.Context, id uuid.UUID) error {
	return nil
}

// ================= BROADCAST REPOSITORY =================

type MockBroadcastRepository struct{}

func NewBroadcastRepository() port.BroadcastRepository {
	return &MockBroadcastRepository{}
}

func (r *MockBroadcastRepository) CreateBroadcast(ctx context.Context, broadcast *domain.BroadcastMessage) error {
	return nil
}

func (r *MockBroadcastRepository) GetBroadcast(ctx context.Context, id uuid.UUID) (*domain.BroadcastMessage, error) {
	return &domain.BroadcastMessage{}, nil
}

func (r *MockBroadcastRepository) GetBroadcasts(ctx context.Context, status string, limit, offset int) ([]*domain.BroadcastMessage, error) {
	return []*domain.BroadcastMessage{}, nil
}

func (r *MockBroadcastRepository) UpdateBroadcast(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockBroadcastRepository) ScheduleBroadcast(ctx context.Context, id uuid.UUID, scheduledFor time.Time) error {
	return nil
}

func (r *MockBroadcastRepository) SendBroadcast(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockBroadcastRepository) GetBroadcastStats(ctx context.Context, id uuid.UUID) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

// ================= SYSTEM SETTING REPOSITORY =================

type MockSystemSettingRepository struct{}

func NewSystemSettingRepository() port.SystemSettingRepository {
	return &MockSystemSettingRepository{}
}

func (r *MockSystemSettingRepository) GetSetting(ctx context.Context, key string) (*domain.SystemSetting, error) {
	return &domain.SystemSetting{}, nil
}

func (r *MockSystemSettingRepository) GetSettingsByCategory(ctx context.Context, category string) ([]*domain.SystemSetting, error) {
	return []*domain.SystemSetting{}, nil
}

func (r *MockSystemSettingRepository) GetPublicSettings(ctx context.Context) ([]*domain.SystemSetting, error) {
	return []*domain.SystemSetting{}, nil
}

func (r *MockSystemSettingRepository) UpdateSetting(ctx context.Context, key, value string, updatedBy uuid.UUID) error {
	return nil
}

func (r *MockSystemSettingRepository) CreateSetting(ctx context.Context, setting *domain.SystemSetting) error {
	return nil
}

func (r *MockSystemSettingRepository) DeleteSetting(ctx context.Context, key string) error {
	return nil
}

// ================= API KEY REPOSITORY =================

type MockAPIKeyRepository struct{}

func NewAPIKeyRepository() port.APIKeyRepository {
	return &MockAPIKeyRepository{}
}

func (r *MockAPIKeyRepository) CreateAPIKey(ctx context.Context, apiKey *domain.APIKey) error {
	return nil
}

func (r *MockAPIKeyRepository) GetAPIKey(ctx context.Context, key string) (*domain.APIKey, error) {
	return &domain.APIKey{}, nil
}

func (r *MockAPIKeyRepository) GetAPIKeysByAgency(ctx context.Context, agencyID uuid.UUID) ([]*domain.APIKey, error) {
	return []*domain.APIKey{}, nil
}

func (r *MockAPIKeyRepository) GetAllAPIKeys(ctx context.Context) ([]*domain.APIKey, error) {
	return []*domain.APIKey{}, nil
}

func (r *MockAPIKeyRepository) UpdateAPIKey(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	return nil
}

func (r *MockAPIKeyRepository) RevokeAPIKey(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (r *MockAPIKeyRepository) RecordAPIKeyUsage(ctx context.Context, keyID uuid.UUID) error {
	return nil
}

// ================= MESSAGING SERVICE =================

type MockMessagingService struct{}

func NewMessagingService() port.MessagingService {
	return &MockMessagingService{}
}

func (s *MockMessagingService) SendEmail(ctx context.Context, to []string, subject, body string) error {
	fmt.Printf("Sending email to %v: %s\n", to, subject)
	return nil
}

func (s *MockMessagingService) SendSMS(ctx context.Context, to []string, message string) error {
	fmt.Printf("Sending SMS to %v: %s\n", to, message)
	return nil
}

func (s *MockMessagingService) SendPushNotification(ctx context.Context, userIDs []uuid.UUID, title, body string) error {
	fmt.Printf("Sending push notification to %v: %s\n", userIDs, title)
	return nil
}

func (s *MockMessagingService) SendInAppNotification(ctx context.Context, userIDs []uuid.UUID, message string) error {
	fmt.Printf("Sending in-app notification to %v: %s\n", userIDs, message)
	return nil
}

// ================= FILE SERVICE =================

type MockFileService struct{}

func NewFileService() port.FileService {
	return &MockFileService{}
}

func (s *MockFileService) UploadFile(ctx context.Context, fileData []byte, filename string, folder string) (string, error) {
	return fmt.Sprintf("https://storage.example.com/%s/%s", folder, filename), nil
}

func (s *MockFileService) DeleteFile(ctx context.Context, fileURL string) error {
	return nil
}

func (s *MockFileService) GeneratePDF(ctx context.Context, htmlContent string) ([]byte, error) {
	return []byte("PDF content"), nil
}

func (s *MockFileService) GenerateExcel(ctx context.Context, data [][]string, headers []string) ([]byte, error) {
	return []byte("Excel content"), nil
}

func (s *MockFileService) GenerateCSV(ctx context.Context, data [][]string) ([]byte, error) {
	return []byte("CSV content"), nil
}
