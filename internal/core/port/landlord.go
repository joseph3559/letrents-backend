package port

import (
	"context"
	"time"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// LandlordDashboardRepository defines the interface for landlord dashboard data operations
type LandlordDashboardRepository interface {
	// Dashboard statistics
	GetDashboardStats(ctx context.Context, landlordID uuid.UUID) (*LandlordDashboardStats, error)
	GetRevenueStats(ctx context.Context, landlordID uuid.UUID, period string) (*RevenueStats, error)
	GetOccupancyStats(ctx context.Context, landlordID uuid.UUID) (*OccupancyStats, error)
	GetMaintenanceStats(ctx context.Context, landlordID uuid.UUID) (*MaintenanceStats, error)
	GetInspectionStats(ctx context.Context, landlordID uuid.UUID) (*InspectionStats, error)

	// Recent activities
	GetRecentActivities(ctx context.Context, landlordID uuid.UUID, limit int) ([]*LandlordActivity, error)
	GetRecentPayments(ctx context.Context, landlordID uuid.UUID, limit int) ([]*PaymentRecord, error)
	GetRecentMaintenance(ctx context.Context, landlordID uuid.UUID, limit int) ([]*MaintenanceRecord, error)
	GetRecentInspections(ctx context.Context, landlordID uuid.UUID, limit int) ([]*InspectionRecord, error)

	// Notifications
	GetNotifications(ctx context.Context, landlordID uuid.UUID, limit, offset int) ([]*LandlordNotification, error)
	MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID) error
	GetUnreadNotificationCount(ctx context.Context, landlordID uuid.UUID) (int, error)
}

// LandlordService defines the interface for landlord business logic
type LandlordService interface {
	// Dashboard overview
	GetDashboardOverview(ctx context.Context, landlordID uuid.UUID) (*LandlordDashboardOverview, error)
	GetDashboardStats(ctx context.Context, landlordID uuid.UUID) (*LandlordDashboardStats, error)
	GetRevenueAnalytics(ctx context.Context, landlordID uuid.UUID, period string) (*RevenueAnalytics, error)
	GetOccupancyAnalytics(ctx context.Context, landlordID uuid.UUID) (*OccupancyAnalytics, error)

	// Property management
	GetLandlordProperties(ctx context.Context, landlordID uuid.UUID, filters LandlordPropertyFilters) (*PropertyListResponse, error)
	GetPropertySummary(ctx context.Context, propertyID uuid.UUID, landlordID uuid.UUID) (*LandlordPropertySummary, error)

	// Tenant management
	GetLandlordTenants(ctx context.Context, landlordID uuid.UUID, filters LandlordTenantFilters) (*TenantListResponse, error)
	GetTenantSummary(ctx context.Context, tenantID uuid.UUID, landlordID uuid.UUID) (*TenantSummary, error)

	// Financial management
	GetFinancialOverview(ctx context.Context, landlordID uuid.UUID) (*FinancialOverview, error)
	GetPaymentHistory(ctx context.Context, landlordID uuid.UUID, filters PaymentFilters) (*LandlordPaymentHistoryResponse, error)
	GetRentCollectionStats(ctx context.Context, landlordID uuid.UUID, period string) (*RentCollectionStats, error)

	// Maintenance management
	GetMaintenanceOverview(ctx context.Context, landlordID uuid.UUID) (*MaintenanceOverview, error)
	GetMaintenanceRequests(ctx context.Context, landlordID uuid.UUID, filters LandlordMaintenanceFilters) (*MaintenanceListResponse, error)

	// Inspection management
	GetInspectionOverview(ctx context.Context, landlordID uuid.UUID) (*InspectionOverview, error)
	GetInspectionSchedule(ctx context.Context, landlordID uuid.UUID, filters InspectionFilters) (*InspectionListResponse, error)

	// Communication
	GetCommunicationOverview(ctx context.Context, landlordID uuid.UUID) (*CommunicationOverview, error)
	GetMessages(ctx context.Context, landlordID uuid.UUID, filters MessageFilters) (*MessageListResponse, error)

	// Reports
	GeneratePropertyReport(ctx context.Context, landlordID uuid.UUID, reportType string, filters ReportFilters) (*PropertyReport, error)
	GenerateFinancialReport(ctx context.Context, landlordID uuid.UUID, reportType string, period string) (*FinancialReport, error)
	GenerateOccupancyReport(ctx context.Context, landlordID uuid.UUID, period string) (*OccupancyReport, error)

	// Notifications
	GetNotifications(ctx context.Context, landlordID uuid.UUID, limit, offset int) (*NotificationListResponse, error)
	MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID, landlordID uuid.UUID) error
	GetUnreadNotificationCount(ctx context.Context, landlordID uuid.UUID) (int, error)
}

// Data structures for landlord dashboard

type LandlordDashboardOverview struct {
	Stats            *LandlordDashboardStats `json:"stats"`
	RecentActivities []*LandlordActivity     `json:"recent_activities"`
	RecentPayments   []*PaymentRecord        `json:"recent_payments"`
	Notifications    []*LandlordNotification `json:"notifications"`
	QuickActions     []*QuickAction          `json:"quick_actions"`
}

type LandlordDashboardStats struct {
	TotalProperties    int     `json:"total_properties"`
	TotalUnits         int     `json:"total_units"`
	OccupiedUnits      int     `json:"occupied_units"`
	VacantUnits        int     `json:"vacant_units"`
	OccupancyRate      float64 `json:"occupancy_rate"`
	TotalTenants       int     `json:"total_tenants"`
	ActiveTenants      int     `json:"active_tenants"`
	MonthlyRevenue     float64 `json:"monthly_revenue"`
	AnnualRevenue      float64 `json:"annual_revenue"`
	PendingMaintenance int     `json:"pending_maintenance"`
	PendingInspections int     `json:"pending_inspections"`
	OverduePayments    int     `json:"overdue_payments"`
	ExpiringLeases     int     `json:"expiring_leases"`
}

type RevenueStats struct {
	Period            string                      `json:"period"`
	TotalRevenue      float64                     `json:"total_revenue"`
	PotentialRevenue  float64                     `json:"potential_revenue"`
	RevenueEfficiency float64                     `json:"revenue_efficiency"`
	RevenueByMonth    []RevenueDataPoint          `json:"revenue_by_month"`
	RevenueByProperty map[uuid.UUID]float64       `json:"revenue_by_property"`
	RevenueByUnitType map[domain.UnitType]float64 `json:"revenue_by_unit_type"`
}

type OccupancyStats struct {
	TotalUnits    int                         `json:"total_units"`
	OccupiedUnits int                         `json:"occupied_units"`
	VacantUnits   int                         `json:"vacant_units"`
	OccupancyRate float64                     `json:"occupancy_rate"`
	ByProperty    map[uuid.UUID]OccupancyData `json:"by_property"`
	ByUnitType    map[domain.UnitType]int     `json:"by_unit_type"`
	Trend         []OccupancyDataPoint        `json:"trend"`
}

type MaintenanceStats struct {
	TotalRequests     int            `json:"total_requests"`
	PendingRequests   int            `json:"pending_requests"`
	CompletedRequests int            `json:"completed_requests"`
	AverageResolution float64        `json:"average_resolution_days"`
	ByPriority        map[string]int `json:"by_priority"`
	ByCategory        map[string]int `json:"by_category"`
}

type InspectionStats struct {
	TotalInspections     int            `json:"total_inspections"`
	ScheduledInspections int            `json:"scheduled_inspections"`
	CompletedInspections int            `json:"completed_inspections"`
	OverdueInspections   int            `json:"overdue_inspections"`
	AverageRating        float64        `json:"average_rating"`
	ByStatus             map[string]int `json:"by_status"`
}

type LandlordActivity struct {
	ID          uuid.UUID  `json:"id"`
	Type        string     `json:"type"`
	Description string     `json:"description"`
	PropertyID  *uuid.UUID `json:"property_id,omitempty"`
	UnitID      *uuid.UUID `json:"unit_id,omitempty"`
	TenantID    *uuid.UUID `json:"tenant_id,omitempty"`
	Amount      *float64   `json:"amount,omitempty"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
}

type MaintenanceRecord struct {
	ID          uuid.UUID  `json:"id"`
	PropertyID  uuid.UUID  `json:"property_id"`
	UnitID      *uuid.UUID `json:"unit_id,omitempty"`
	TenantID    *uuid.UUID `json:"tenant_id,omitempty"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type InspectionRecord struct {
	ID             uuid.UUID  `json:"id"`
	PropertyID     uuid.UUID  `json:"property_id"`
	UnitID         *uuid.UUID `json:"unit_id,omitempty"`
	InspectionType string     `json:"inspection_type"`
	Status         string     `json:"status"`
	ScheduledDate  time.Time  `json:"scheduled_date"`
	CompletedDate  *time.Time `json:"completed_date,omitempty"`
	Rating         *int       `json:"rating,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type LandlordNotification struct {
	ID         uuid.UUID  `json:"id"`
	Type       string     `json:"type"`
	Title      string     `json:"title"`
	Message    string     `json:"message"`
	IsRead     bool       `json:"is_read"`
	PropertyID *uuid.UUID `json:"property_id,omitempty"`
	UnitID     *uuid.UUID `json:"unit_id,omitempty"`
	TenantID   *uuid.UUID `json:"tenant_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type QuickAction struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Action      string `json:"action"`
	URL         string `json:"url"`
}

// Filter structures

type PaymentFilters struct {
	PropertyID  *uuid.UUID `json:"property_id,omitempty"`
	UnitID      *uuid.UUID `json:"unit_id,omitempty"`
	TenantID    *uuid.UUID `json:"tenant_id,omitempty"`
	PaymentType *string    `json:"payment_type,omitempty"`
	Status      *string    `json:"status,omitempty"`
	DateFrom    *time.Time `json:"date_from,omitempty"`
	DateTo      *time.Time `json:"date_to,omitempty"`
	MinAmount   *float64   `json:"min_amount,omitempty"`
	MaxAmount   *float64   `json:"max_amount,omitempty"`
	SortBy      *string    `json:"sort_by,omitempty"`
	SortOrder   *string    `json:"sort_order,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

type InspectionFilters struct {
	PropertyID     *uuid.UUID `json:"property_id,omitempty"`
	UnitID         *uuid.UUID `json:"unit_id,omitempty"`
	InspectionType *string    `json:"inspection_type,omitempty"`
	Status         *string    `json:"status,omitempty"`
	DateFrom       *time.Time `json:"date_from,omitempty"`
	DateTo         *time.Time `json:"date_to,omitempty"`
	InspectorID    *uuid.UUID `json:"inspector_id,omitempty"`
	SortBy         *string    `json:"sort_by,omitempty"`
	SortOrder      *string    `json:"sort_order,omitempty"`
	Limit          int        `json:"limit"`
	Offset         int        `json:"offset"`
}

type MessageFilters struct {
	PropertyID  *uuid.UUID `json:"property_id,omitempty"`
	UnitID      *uuid.UUID `json:"unit_id,omitempty"`
	TenantID    *uuid.UUID `json:"tenant_id,omitempty"`
	MessageType *string    `json:"message_type,omitempty"`
	Priority    *string    `json:"priority,omitempty"`
	Status      *string    `json:"status,omitempty"`
	DateFrom    *time.Time `json:"date_from,omitempty"`
	DateTo      *time.Time `json:"date_to,omitempty"`
	SortBy      *string    `json:"sort_by,omitempty"`
	SortOrder   *string    `json:"sort_order,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

type ReportFilters struct {
	PropertyID    *uuid.UUID `json:"property_id,omitempty"`
	UnitID        *uuid.UUID `json:"unit_id,omitempty"`
	TenantID      *uuid.UUID `json:"tenant_id,omitempty"`
	DateFrom      *time.Time `json:"date_from,omitempty"`
	DateTo        *time.Time `json:"date_to,omitempty"`
	IncludeCharts bool       `json:"include_charts"`
	Format        string     `json:"format"` // pdf, excel, csv
}

// Response structures

type TenantListResponse struct {
	Tenants    []*domain.User `json:"tenants"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"per_page"`
	TotalPages int            `json:"total_pages"`
}

type PaymentHistoryResponse struct {
	Payments   []*PaymentRecord `json:"payments"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	PerPage    int              `json:"per_page"`
	TotalPages int              `json:"total_pages"`
}

type MaintenanceListResponse struct {
	Maintenance []*MaintenanceRecord `json:"maintenance"`
	Total       int                  `json:"total"`
	Page        int                  `json:"page"`
	PerPage     int                  `json:"per_page"`
	TotalPages  int                  `json:"total_pages"`
}

type InspectionListResponse struct {
	Inspections []*InspectionRecord `json:"inspections"`
	Total       int                 `json:"total"`
	Page        int                 `json:"page"`
	PerPage     int                 `json:"per_page"`
	TotalPages  int                 `json:"total_pages"`
}

type MessageListResponse struct {
	Messages   []interface{} `json:"messages"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	PerPage    int           `json:"per_page"`
	TotalPages int           `json:"total_pages"`
}

type NotificationListResponse struct {
	Notifications []*LandlordNotification `json:"notifications"`
	Total         int                     `json:"total"`
	Page          int                     `json:"page"`
	PerPage       int                     `json:"per_page"`
	TotalPages    int                     `json:"total_pages"`
}

// Analytics structures

type RevenueAnalytics struct {
	Period                  string                      `json:"period"`
	TotalRevenue            float64                     `json:"total_revenue"`
	PotentialRevenue        float64                     `json:"potential_revenue"`
	RevenueEfficiency       float64                     `json:"revenue_efficiency"`
	RevenueByMonth          []RevenueDataPoint          `json:"revenue_by_month"`
	RevenueByProperty       map[uuid.UUID]float64       `json:"revenue_by_property"`
	RevenueByUnitType       map[domain.UnitType]float64 `json:"revenue_by_unit_type"`
	TopPerformingProperties []PropertyRevenueRanking    `json:"top_performing_properties"`
}

type OccupancyAnalytics struct {
	OverallOccupancyRate float64                     `json:"overall_occupancy_rate"`
	OccupancyByProperty  map[uuid.UUID]OccupancyData `json:"occupancy_by_property"`
	OccupancyByUnitType  map[domain.UnitType]int     `json:"occupancy_by_unit_type"`
	OccupancyTrend       []OccupancyDataPoint        `json:"occupancy_trend"`
	VacancyAnalysis      []VacancyAnalysis           `json:"vacancy_analysis"`
}

type PropertyRevenueRanking struct {
	PropertyID    uuid.UUID `json:"property_id"`
	PropertyName  string    `json:"property_name"`
	Revenue       float64   `json:"revenue"`
	OccupancyRate float64   `json:"occupancy_rate"`
	Rank          int       `json:"rank"`
}

type OccupancyData struct {
	PropertyID    uuid.UUID `json:"property_id"`
	PropertyName  string    `json:"property_name"`
	TotalUnits    int       `json:"total_units"`
	OccupiedUnits int       `json:"occupied_units"`
	VacantUnits   int       `json:"vacant_units"`
	OccupancyRate float64   `json:"occupancy_rate"`
}

type VacancyAnalysis struct {
	PropertyID    uuid.UUID `json:"property_id"`
	PropertyName  string    `json:"property_name"`
	UnitID        uuid.UUID `json:"unit_id"`
	UnitNumber    string    `json:"unit_number"`
	DaysVacant    int       `json:"days_vacant"`
	PotentialLoss float64   `json:"potential_loss"`
	LastTenant    *string   `json:"last_tenant,omitempty"`
}

type TenantSummary struct {
	Tenant             *domain.User         `json:"tenant"`
	CurrentUnit        *domain.Unit         `json:"current_unit"`
	CurrentProperty    *domain.Property     `json:"current_property"`
	LeaseInfo          *LeaseInfo           `json:"lease_info"`
	PaymentHistory     []*PaymentRecord     `json:"payment_history"`
	MaintenanceHistory []*MaintenanceRecord `json:"maintenance_history"`
}

type LeaseInfo struct {
	LeaseID       uuid.UUID `json:"lease_id"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	RentAmount    float64   `json:"rent_amount"`
	Status        string    `json:"status"`
	DaysRemaining int       `json:"days_remaining"`
}

type FinancialOverview struct {
	TotalRevenue      float64                 `json:"total_revenue"`
	PotentialRevenue  float64                 `json:"potential_revenue"`
	RevenueEfficiency float64                 `json:"revenue_efficiency"`
	OverduePayments   float64                 `json:"overdue_payments"`
	MonthlyTrend      []MonthlyFinancialData  `json:"monthly_trend"`
	PropertyBreakdown []PropertyFinancialData `json:"property_breakdown"`
}

type MonthlyFinancialData struct {
	Month            string  `json:"month"`
	Revenue          float64 `json:"revenue"`
	PotentialRevenue float64 `json:"potential_revenue"`
	OccupancyRate    float64 `json:"occupancy_rate"`
}

type PropertyFinancialData struct {
	PropertyID       uuid.UUID `json:"property_id"`
	PropertyName     string    `json:"property_name"`
	Revenue          float64   `json:"revenue"`
	PotentialRevenue float64   `json:"potential_revenue"`
	OccupancyRate    float64   `json:"occupancy_rate"`
}

type RentCollectionStats struct {
	Period            string                  `json:"period"`
	TotalCollected    float64                 `json:"total_collected"`
	TotalExpected     float64                 `json:"total_expected"`
	CollectionRate    float64                 `json:"collection_rate"`
	OverdueAmount     float64                 `json:"overdue_amount"`
	OverdueCount      int                     `json:"overdue_count"`
	CollectionByMonth []MonthlyCollectionData `json:"collection_by_month"`
}

type MonthlyCollectionData struct {
	Month          string  `json:"month"`
	Collected      float64 `json:"collected"`
	Expected       float64 `json:"expected"`
	CollectionRate float64 `json:"collection_rate"`
}

type MaintenanceOverview struct {
	TotalRequests     int                  `json:"total_requests"`
	PendingRequests   int                  `json:"pending_requests"`
	CompletedRequests int                  `json:"completed_requests"`
	AverageResolution float64              `json:"average_resolution_days"`
	ByPriority        map[string]int       `json:"by_priority"`
	ByCategory        map[string]int       `json:"by_category"`
	RecentRequests    []*MaintenanceRecord `json:"recent_requests"`
}

type InspectionOverview struct {
	TotalInspections     int                 `json:"total_inspections"`
	ScheduledInspections int                 `json:"scheduled_inspections"`
	CompletedInspections int                 `json:"completed_inspections"`
	OverdueInspections   int                 `json:"overdue_inspections"`
	AverageRating        float64             `json:"average_rating"`
	ByStatus             map[string]int      `json:"by_status"`
	RecentInspections    []*InspectionRecord `json:"recent_inspections"`
}

type CommunicationOverview struct {
	TotalMessages  int            `json:"total_messages"`
	UnreadMessages int            `json:"unread_messages"`
	UrgentMessages int            `json:"urgent_messages"`
	ByPriority     map[string]int `json:"by_priority"`
	ByType         map[string]int `json:"by_type"`
	RecentMessages []interface{}  `json:"recent_messages"`
}

type PropertyReport struct {
	ReportID    string                 `json:"report_id"`
	ReportType  string                 `json:"report_type"`
	GeneratedAt time.Time              `json:"generated_at"`
	Period      string                 `json:"period"`
	Summary     map[string]interface{} `json:"summary"`
	Data        interface{}            `json:"data"`
	Charts      []ChartData            `json:"charts,omitempty"`
	DownloadURL *string                `json:"download_url,omitempty"`
}

type FinancialReport struct {
	ReportID    string                 `json:"report_id"`
	ReportType  string                 `json:"report_type"`
	GeneratedAt time.Time              `json:"generated_at"`
	Period      string                 `json:"period"`
	Summary     map[string]interface{} `json:"summary"`
	Data        interface{}            `json:"data"`
	Charts      []ChartData            `json:"charts,omitempty"`
	DownloadURL *string                `json:"download_url,omitempty"`
}

type ChartData struct {
	Type    string      `json:"type"`
	Title   string      `json:"title"`
	Data    interface{} `json:"data"`
	Options interface{} `json:"options,omitempty"`
}

// LandlordPropertySummary is a landlord-specific property summary with all required fields
// (Do not conflict with agent.go PropertySummary)
type LandlordPropertySummary struct {
	Property           *domain.Property    `json:"property"`
	Units              []*domain.Unit      `json:"units"`
	OccupancyRate      float64             `json:"occupancy_rate"`
	MonthlyRevenue     float64             `json:"monthly_revenue"`
	PendingMaintenance int                 `json:"pending_maintenance"`
	RecentActivities   []*LandlordActivity `json:"recent_activities"`
}

// LandlordTenantFilters is a landlord-specific tenant filter struct
// (Do not conflict with agent.go TenantFilters)
type LandlordTenantFilters struct {
	PropertyID    *uuid.UUID `json:"property_id,omitempty"`
	UnitID        *uuid.UUID `json:"unit_id,omitempty"`
	Status        *string    `json:"status,omitempty"`
	SearchQuery   *string    `json:"search_query,omitempty"`
	LeaseStatus   *string    `json:"lease_status,omitempty"`
	PaymentStatus *string    `json:"payment_status,omitempty"`
	SortBy        *string    `json:"sort_by,omitempty"`
	SortOrder     *string    `json:"sort_order,omitempty"`
	Limit         int        `json:"limit"`
	Offset        int        `json:"offset"`
}

// LandlordMaintenanceFilters is a landlord-specific maintenance filter struct
// (Do not conflict with agent.go MaintenanceFilters)
type LandlordMaintenanceFilters struct {
	PropertyID *uuid.UUID `json:"property_id,omitempty"`
	UnitID     *uuid.UUID `json:"unit_id,omitempty"`
	TenantID   *uuid.UUID `json:"tenant_id,omitempty"`
	Category   *string    `json:"category,omitempty"`
	Priority   *string    `json:"priority,omitempty"`
	Status     *string    `json:"status,omitempty"`
	DateFrom   *time.Time `json:"date_from,omitempty"`
	DateTo     *time.Time `json:"date_to,omitempty"`
	SortBy     *string    `json:"sort_by,omitempty"`
	SortOrder  *string    `json:"sort_order,omitempty"`
	Limit      int        `json:"limit"`
	Offset     int        `json:"offset"`
}

// LandlordPaymentRecord is a landlord-specific payment record with all required fields
// (Do not conflict with agent.go PaymentRecord)
type LandlordPaymentRecord struct {
	ID            uuid.UUID  `json:"id"`
	Amount        float64    `json:"amount"`
	PaymentMethod string     `json:"payment_method"`
	PaymentDate   time.Time  `json:"payment_date"`
	Reference     *string    `json:"reference"`
	Notes         *string    `json:"notes"`
	PropertyID    *uuid.UUID `json:"property_id,omitempty"`
	UnitID        *uuid.UUID `json:"unit_id,omitempty"`
	TenantID      *uuid.UUID `json:"tenant_id,omitempty"`
	PaymentType   *string    `json:"payment_type,omitempty"`
	Status        *string    `json:"status,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// LandlordPropertyFilters is a landlord-specific property filter struct
// (Do not conflict with agent.go PropertyFilters)
type LandlordPropertyFilters struct {
	OwnerID     *uuid.UUID `json:"owner_id,omitempty"`
	Status      *string    `json:"status,omitempty"`
	SearchQuery *string    `json:"search_query,omitempty"`
	SortBy      *string    `json:"sort_by,omitempty"`
	SortOrder   *string    `json:"sort_order,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

// LandlordPaymentHistoryResponse is a landlord-specific payment history response
// (Do not conflict with agent.go PaymentHistoryResponse)
type LandlordPaymentHistoryResponse struct {
	Payments   []*LandlordPaymentRecord `json:"payments"`
	Total      int                      `json:"total"`
	Page       int                      `json:"page"`
	PerPage    int                      `json:"per_page"`
	TotalPages int                      `json:"total_pages"`
}
