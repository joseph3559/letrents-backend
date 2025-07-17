package port

import (
	"context"
	"time"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// AgentRepository defines the interface for agent data operations
type AgentRepository interface {
	// Assignment Management
	AssignPropertyToAgent(ctx context.Context, assignment *domain.AgentAssignment) error
	UnassignPropertyFromAgent(ctx context.Context, agentID, propertyID uuid.UUID) error
	GetAgentAssignments(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentAssignment, error)
	GetAgentsByProperty(ctx context.Context, propertyID uuid.UUID) ([]*domain.User, error)

	// Dashboard Statistics
	GetAgentDashboardStats(ctx context.Context, agentID uuid.UUID) (*domain.AgentDashboardStats, error)
	GetRentTrends(ctx context.Context, agentID uuid.UUID, months int) ([]*domain.RentTrend, error)

	// Unit Management for Agents
	GetAgentUnits(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.AgentUnitOverview, error)
	GetUnitsByProperty(ctx context.Context, agentID, propertyID uuid.UUID) ([]*domain.AgentUnitOverview, error)
	GetUnitsWithUnpaidRent(ctx context.Context, agentID uuid.UUID, daysOverdue int) ([]*domain.AgentUnitOverview, error)
	GetUnitsWithExpiringLeases(ctx context.Context, agentID uuid.UUID, daysAhead int) ([]*domain.AgentUnitOverview, error)

	// Tenant Management for Agents
	GetAgentTenants(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.AgentTenantOverview, error)
	GetTenantsInArrears(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentTenantOverview, error)
	AddTenantToUnit(ctx context.Context, agentID uuid.UUID, tenant *domain.User, unitID uuid.UUID, leaseDetails map[string]interface{}) error
	SendTenantNotification(ctx context.Context, agentID, tenantID uuid.UUID, message, method string) error

	// Invoice Management
	CreateRentInvoice(ctx context.Context, invoice *domain.RentInvoice) error
	GetAgentInvoices(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.RentInvoice, error)
	UpdateInvoiceStatus(ctx context.Context, invoiceID uuid.UUID, status domain.InvoiceStatus, paidDate *time.Time, paymentMethod *string) error
	GetOverdueInvoices(ctx context.Context, agentID uuid.UUID) ([]*domain.RentInvoice, error)
	BulkCreateInvoices(ctx context.Context, invoices []*domain.RentInvoice) error

	// Maintenance Management
	GetMaintenanceRequests(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.MaintenanceRequest, error)
	ForwardMaintenanceRequest(ctx context.Context, requestID, caretakerID, agentID uuid.UUID, notes string) error
	UpdateMaintenancePriority(ctx context.Context, requestID uuid.UUID, priority domain.MaintenancePriority, agentNotes string) error
	GetPendingMaintenanceRequests(ctx context.Context, agentID uuid.UUID) ([]*domain.MaintenanceRequest, error)

	// Notifications
	CreateAgentNotification(ctx context.Context, notification *domain.AgentNotification) error
	GetAgentNotifications(ctx context.Context, agentID uuid.UUID, unreadOnly bool, limit int) ([]*domain.AgentNotification, error)
	MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID) error
	MarkAllNotificationsAsRead(ctx context.Context, agentID uuid.UUID) error
	GetUnreadNotificationCount(ctx context.Context, agentID uuid.UUID) (int, error)

	// Reports
	GenerateRentCollectionReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error)
	GenerateTenantsArrearsReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error)
	GenerateLeaseExpiryReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error)
	GenerateUnitConditionReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error)
	GenerateMaintenanceLogsReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error)
	ExportReport(ctx context.Context, reportID uuid.UUID, format string) (string, error)
}

// AgentService defines the interface for agent business logic
type AgentService interface {
	// Dashboard Operations
	GetDashboardOverview(ctx context.Context, agentID uuid.UUID) (*AgentDashboardResponse, error)
	GetDashboardStats(ctx context.Context, agentID uuid.UUID) (*domain.AgentDashboardStats, error)
	GetRentCollectionTrends(ctx context.Context, agentID uuid.UUID, months int) ([]*domain.RentTrend, error)

	// Property & Unit Management
	GetAssignedProperties(ctx context.Context, agentID uuid.UUID) ([]*PropertySummary, error)
	GetUnitsOverview(ctx context.Context, agentID uuid.UUID, filters *AgentUnitFilters) ([]*domain.AgentUnitOverview, error)
	SearchUnits(ctx context.Context, agentID uuid.UUID, query string, filters *AgentUnitFilters) ([]*domain.AgentUnitOverview, error)
	GetUnitDetails(ctx context.Context, agentID, unitID uuid.UUID) (*UnitDetailsResponse, error)
	UpdateUnitStatus(ctx context.Context, agentID, unitID uuid.UUID, status domain.UnitStatusEnum, notes string) error

	// Tenant Management
	GetTenantsOverview(ctx context.Context, agentID uuid.UUID, filters *TenantFilters) ([]*domain.AgentTenantOverview, error)
	AddNewTenant(ctx context.Context, agentID uuid.UUID, request *AddTenantRequest) error
	GetTenantDetails(ctx context.Context, agentID, tenantID uuid.UUID) (*TenantDetailsResponse, error)
	SendTenantMessage(ctx context.Context, agentID, tenantID uuid.UUID, message *TenantMessage) error
	GetTenantsInArrears(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentTenantOverview, error)

	// Rent & Invoice Management
	CreateRentInvoice(ctx context.Context, agentID uuid.UUID, request *CreateInvoiceRequest) (*domain.RentInvoice, error)
	BulkCreateInvoices(ctx context.Context, agentID uuid.UUID, request *BulkInvoiceRequest) ([]*domain.RentInvoice, error)
	GetInvoices(ctx context.Context, agentID uuid.UUID, filters *InvoiceFilters) ([]*domain.RentInvoice, error)
	MarkPaymentReceived(ctx context.Context, agentID, invoiceID uuid.UUID, payment *PaymentRecord) error
	SendInvoiceToTenant(ctx context.Context, agentID, invoiceID uuid.UUID, delivery *InvoiceDelivery) error
	GetOverdueInvoices(ctx context.Context, agentID uuid.UUID) ([]*domain.RentInvoice, error)

	// Maintenance Management
	GetMaintenanceRequests(ctx context.Context, agentID uuid.UUID, filters *MaintenanceFilters) ([]*domain.MaintenanceRequest, error)
	ForwardToCaretaker(ctx context.Context, agentID, requestID, caretakerID uuid.UUID, request *ForwardMaintenanceRequest) error
	UpdateMaintenanceStatus(ctx context.Context, agentID, requestID uuid.UUID, status domain.MaintenanceStatus, notes string) error
	GetPendingMaintenance(ctx context.Context, agentID uuid.UUID) ([]*domain.MaintenanceRequest, error)

	// Notifications & Alerts
	GetNotifications(ctx context.Context, agentID uuid.UUID, unreadOnly bool, limit int) ([]*domain.AgentNotification, error)
	MarkNotificationRead(ctx context.Context, agentID, notificationID uuid.UUID) error
	GetUnreadCount(ctx context.Context, agentID uuid.UUID) (int, error)
	CreateSystemNotification(ctx context.Context, agentID uuid.UUID, notification *SystemNotification) error

	// Reports & Analytics
	GenerateReport(ctx context.Context, agentID uuid.UUID, reportType domain.ReportType, filters *domain.ReportFilters) (*domain.AgentReport, error)
	ExportReportData(ctx context.Context, agentID, reportID uuid.UUID, format string) (string, error)
	GetReportHistory(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentReport, error)

	// Communication
	SendSMSToTenant(ctx context.Context, agentID, tenantID uuid.UUID, message string) error
	SendEmailToTenant(ctx context.Context, agentID, tenantID uuid.UUID, subject, body string) error
	SendWhatsAppToTenant(ctx context.Context, agentID, tenantID uuid.UUID, message string) error
}

// Request/Response DTOs for Agent Service

type AgentDashboardResponse struct {
	Stats               *domain.AgentDashboardStats `json:"stats"`
	RecentActivities    []*ActivitySummary          `json:"recent_activities"`
	Notifications       []*domain.AgentNotification `json:"notifications"`
	PropertiesSummary   []*PropertySummary          `json:"properties_summary"`
	UpcomingLeaseExpiry []*LeaseExpirySummary       `json:"upcoming_lease_expiry"`
}

type PropertySummary struct {
	PropertyID    uuid.UUID `json:"property_id"`
	Name          string    `json:"name"`
	UnitsCount    int       `json:"units_count"`
	OccupiedUnits int       `json:"occupied_units"`
	VacantUnits   int       `json:"vacant_units"`
	ArrearsUnits  int       `json:"arrears_units"`
	Address       string    `json:"address"`
	Caretaker     *string   `json:"caretaker"`
}

type ActivitySummary struct {
	ID           uuid.UUID `json:"id"`
	Type         string    `json:"type"`
	Description  string    `json:"description"`
	PropertyName *string   `json:"property_name"`
	UnitNumber   *string   `json:"unit_number"`
	CreatedAt    time.Time `json:"created_at"`
	Priority     string    `json:"priority"`
}

type LeaseExpirySummary struct {
	TenantName   string    `json:"tenant_name"`
	UnitNumber   string    `json:"unit_number"`
	PropertyName string    `json:"property_name"`
	ExpiryDate   time.Time `json:"expiry_date"`
	DaysLeft     int       `json:"days_left"`
	TenantPhone  *string   `json:"tenant_phone"`
}

type AgentUnitFilters struct {
	PropertyID *uuid.UUID              `json:"property_id"`
	Status     []domain.UnitStatusEnum `json:"status"`
	UnitType   []string                `json:"unit_type"`
	MinRent    *float64                `json:"min_rent"`
	MaxRent    *float64                `json:"max_rent"`
	Block      *string                 `json:"block"`
	Floor      *int                    `json:"floor"`
}

type TenantFilters struct {
	PropertyID    *uuid.UUID `json:"property_id"`
	UnitID        *uuid.UUID `json:"unit_id"`
	InArrears     *bool      `json:"in_arrears"`
	MinOverdue    *int       `json:"min_overdue_days"`
	PaymentStatus *string    `json:"payment_status,omitempty"`
}

type InvoiceFilters struct {
	PropertyID *uuid.UUID             `json:"property_id"`
	UnitID     *uuid.UUID             `json:"unit_id"`
	TenantID   *uuid.UUID             `json:"tenant_id"`
	Status     []domain.InvoiceStatus `json:"status"`
	Type       []domain.InvoiceType   `json:"type"`
	DateFrom   *time.Time             `json:"date_from"`
	DateTo     *time.Time             `json:"date_to"`
}

type MaintenanceFilters struct {
	PropertyID *uuid.UUID                   `json:"property_id"`
	UnitID     *uuid.UUID                   `json:"unit_id"`
	Category   []domain.MaintenanceCategory `json:"category"`
	Priority   []domain.MaintenancePriority `json:"priority"`
	Status     []domain.MaintenanceStatus   `json:"status"`
	DateFrom   *time.Time                   `json:"date_from"`
	DateTo     *time.Time                   `json:"date_to"`
}

type AddTenantRequest struct {
	UnitID         uuid.UUID `json:"unit_id"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	Email          string    `json:"email"`
	PhoneNumber    *string   `json:"phone_number"`
	IDNumber       *string   `json:"id_number"`
	LeaseStartDate time.Time `json:"lease_start_date"`
	LeaseEndDate   time.Time `json:"lease_end_date"`
	DepositAmount  float64   `json:"deposit_amount"`
	Notes          *string   `json:"notes"`
}

type CreateInvoiceRequest struct {
	UnitID            uuid.UUID             `json:"unit_id"`
	TenantID          uuid.UUID             `json:"tenant_id"`
	InvoiceType       domain.InvoiceType    `json:"invoice_type"`
	RentAmount        float64               `json:"rent_amount"`
	AdditionalCharges float64               `json:"additional_charges"`
	ChargeBreakdown   domain.InvoiceCharges `json:"charge_breakdown"`
	DueDate           time.Time             `json:"due_date"`
	Notes             *string               `json:"notes"`
}

type BulkInvoiceRequest struct {
	PropertyIDs       []uuid.UUID           `json:"property_ids"`
	UnitIDs           []uuid.UUID           `json:"unit_ids"`
	InvoiceType       domain.InvoiceType    `json:"invoice_type"`
	AdditionalCharges float64               `json:"additional_charges"`
	ChargeBreakdown   domain.InvoiceCharges `json:"charge_breakdown"`
	DueDate           time.Time             `json:"due_date"`
	Notes             *string               `json:"notes"`
}

type PaymentRecord struct {
	Amount        float64   `json:"amount"`
	PaymentMethod string    `json:"payment_method"`
	PaymentDate   time.Time `json:"payment_date"`
	Reference     *string   `json:"reference"`
	Notes         *string   `json:"notes"`
}

type InvoiceDelivery struct {
	Method    string  `json:"method"` // email, sms, whatsapp
	Recipient string  `json:"recipient"`
	Subject   *string `json:"subject"`
	Message   *string `json:"message"`
}

type ForwardMaintenanceRequest struct {
	Priority      domain.MaintenancePriority `json:"priority"`
	AgentNotes    *string                    `json:"agent_notes"`
	ScheduledDate *time.Time                 `json:"scheduled_date"`
	Instructions  *string                    `json:"instructions"`
}

type TenantMessage struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
	Method  string `json:"method"` // email, sms, whatsapp
	Urgent  bool   `json:"urgent"`
}

type SystemNotification struct {
	Type        domain.NotificationType     `json:"type"`
	Title       string                      `json:"title"`
	Message     string                      `json:"message"`
	Priority    domain.NotificationPriority `json:"priority"`
	RelatedID   *uuid.UUID                  `json:"related_id"`
	RelatedType *string                     `json:"related_type"`
}

type UnitDetailsResponse struct {
	Unit               *domain.AgentUnitOverview   `json:"unit"`
	Property           *PropertySummary            `json:"property"`
	Tenant             *domain.AgentTenantOverview `json:"tenant"`
	RecentPayments     []*PaymentSummary           `json:"recent_payments"`
	MaintenanceHistory []*MaintenanceSummary       `json:"maintenance_history"`
}

type TenantDetailsResponse struct {
	Tenant         *domain.AgentTenantOverview `json:"tenant"`
	Unit           *domain.AgentUnitOverview   `json:"unit"`
	PaymentHistory []*PaymentSummary           `json:"payment_history"`
	LeaseDetails   *LeaseDetails               `json:"lease_details"`
	Communications []*CommunicationHistory     `json:"communications"`
}

type PaymentSummary struct {
	ID            uuid.UUID `json:"id"`
	Amount        float64   `json:"amount"`
	PaymentDate   time.Time `json:"payment_date"`
	PaymentMethod string    `json:"payment_method"`
	Reference     *string   `json:"reference"`
	Status        string    `json:"status"`
}

type MaintenanceSummary struct {
	ID            uuid.UUID                  `json:"id"`
	Title         string                     `json:"title"`
	Category      domain.MaintenanceCategory `json:"category"`
	Priority      domain.MaintenancePriority `json:"priority"`
	Status        domain.MaintenanceStatus   `json:"status"`
	CreatedAt     time.Time                  `json:"created_at"`
	CompletedAt   *time.Time                 `json:"completed_at"`
	CaretakerName *string                    `json:"caretaker_name"`
}

type LeaseDetails struct {
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	RentAmount    float64   `json:"rent_amount"`
	DepositAmount float64   `json:"deposit_amount"`
	LeaseType     string    `json:"lease_type"`
	Documents     []string  `json:"documents"`
}

type CommunicationHistory struct {
	ID        uuid.UUID `json:"id"`
	Type      string    `json:"type"`
	Subject   *string   `json:"subject"`
	Message   string    `json:"message"`
	SentBy    string    `json:"sent_by"`
	SentAt    time.Time `json:"sent_at"`
	Delivered bool      `json:"delivered"`
}
