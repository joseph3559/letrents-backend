package domain

import (
	"time"

	"github.com/google/uuid"
)

// AgentAssignment represents the properties/units assigned to an agent
type AgentAssignment struct {
	ID         uuid.UUID `json:"id" db:"id"`
	AgentID    uuid.UUID `json:"agent_id" db:"agent_id"`
	PropertyID uuid.UUID `json:"property_id" db:"property_id"`
	AssignedBy uuid.UUID `json:"assigned_by" db:"assigned_by"`
	AssignedAt time.Time `json:"assigned_at" db:"assigned_at"`
	IsActive   bool      `json:"is_active" db:"is_active"`
	Notes      *string   `json:"notes" db:"notes"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// AgentDashboardStats represents the dashboard statistics for an agent
type AgentDashboardStats struct {
	AgentID             uuid.UUID `json:"agent_id"`
	PropertiesAssigned  int       `json:"properties_assigned"`
	UnitsAssigned       int       `json:"units_assigned"`
	OccupiedUnits       int       `json:"occupied_units"`
	VacantUnits         int       `json:"vacant_units"`
	OccupancyRate       float64   `json:"occupancy_rate"`
	TotalRentCollected  float64   `json:"total_rent_collected"`
	UnitsWithUnpaidRent int       `json:"units_with_unpaid_rent"`
	PendingMaintenance  int       `json:"pending_maintenance"`
	LeasesExpiringIn30  int       `json:"leases_expiring_in_30"`
	TenantsInArrears    int       `json:"tenants_in_arrears"`
	CalculatedAt        time.Time `json:"calculated_at"`
}

// RentTrend represents monthly rent collection trends
type RentTrend struct {
	Month           string  `json:"month"`
	Year            int     `json:"year"`
	AmountCollected float64 `json:"amount_collected"`
	ExpectedAmount  float64 `json:"expected_amount"`
	CollectionRate  float64 `json:"collection_rate"`
}

// UnitStatus represents different unit statuses for agent management
type UnitStatusEnum string

const (
	UnitStatusVacant      UnitStatusEnum = "vacant"
	UnitStatusOccupied    UnitStatusEnum = "occupied"
	UnitStatusReserved    UnitStatusEnum = "reserved"
	UnitStatusMaintenance UnitStatusEnum = "maintenance"
	UnitStatusUnderRepair UnitStatusEnum = "under_repair"
	UnitStatusArrears     UnitStatusEnum = "arrears"
)

// AgentUnitOverview represents a simplified unit view for agents
type AgentUnitOverview struct {
	UnitID            uuid.UUID      `json:"unit_id"`
	PropertyID        uuid.UUID      `json:"property_id"`
	PropertyName      string         `json:"property_name"`
	UnitNumber        string         `json:"unit_number"`
	UnitType          string         `json:"unit_type"`
	RentAmount        float64        `json:"rent_amount"`
	Currency          string         `json:"currency"`
	Status            UnitStatusEnum `json:"status"`
	TenantID          *uuid.UUID     `json:"tenant_id"`
	TenantName        *string        `json:"tenant_name"`
	TenantPhone       *string        `json:"tenant_phone"`
	LastPaymentDate   *time.Time     `json:"last_payment_date"`
	LeaseEndDate      *time.Time     `json:"lease_end_date"`
	DaysOverdue       *int           `json:"days_overdue"`
	OutstandingAmount float64        `json:"outstanding_amount"`
}

// AgentTenantOverview represents tenant information for agents
type AgentTenantOverview struct {
	TenantID        uuid.UUID  `json:"tenant_id"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	Email           string     `json:"email"`
	PhoneNumber     *string    `json:"phone_number"`
	UnitID          uuid.UUID  `json:"unit_id"`
	UnitNumber      string     `json:"unit_number"`
	PropertyName    string     `json:"property_name"`
	RentAmount      float64    `json:"rent_amount"`
	CurrentBalance  float64    `json:"current_balance"`
	LeaseStartDate  *time.Time `json:"lease_start_date"`
	LeaseEndDate    *time.Time `json:"lease_end_date"`
	LastPaymentDate *time.Time `json:"last_payment_date"`
	DaysOverdue     int        `json:"days_overdue"`
	IsInArrears     bool       `json:"is_in_arrears"`
}

// RentInvoice represents rent invoices created by agents
type RentInvoice struct {
	ID                uuid.UUID      `json:"id" db:"id"`
	InvoiceNumber     string         `json:"invoice_number" db:"invoice_number"`
	TenantID          uuid.UUID      `json:"tenant_id" db:"tenant_id"`
	UnitID            uuid.UUID      `json:"unit_id" db:"unit_id"`
	PropertyID        uuid.UUID      `json:"property_id" db:"property_id"`
	CreatedBy         uuid.UUID      `json:"created_by" db:"created_by"`
	InvoiceType       InvoiceType    `json:"invoice_type" db:"invoice_type"`
	Status            InvoiceStatus  `json:"status" db:"status"`
	RentAmount        float64        `json:"rent_amount" db:"rent_amount"`
	AdditionalCharges float64        `json:"additional_charges" db:"additional_charges"`
	TotalAmount       float64        `json:"total_amount" db:"total_amount"`
	Currency          string         `json:"currency" db:"currency"`
	DueDate           time.Time      `json:"due_date" db:"due_date"`
	PaidDate          *time.Time     `json:"paid_date" db:"paid_date"`
	PaymentMethod     *string        `json:"payment_method" db:"payment_method"`
	Notes             *string        `json:"notes" db:"notes"`
	ChargeBreakdown   InvoiceCharges `json:"charge_breakdown" db:"charge_breakdown"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at" db:"updated_at"`
}

// InvoiceType represents different types of invoices
type InvoiceType string

const (
	InvoiceTypeMonthly InvoiceType = "monthly"
	InvoiceTypeOneTime InvoiceType = "one_time"
	InvoiceTypePenalty InvoiceType = "penalty"
)

// InvoiceStatus represents the status of an invoice
type InvoiceStatus string

const (
	InvoiceStatusDraft     InvoiceStatus = "draft"
	InvoiceStatusSent      InvoiceStatus = "sent"
	InvoiceStatusPaid      InvoiceStatus = "paid"
	InvoiceStatusOverdue   InvoiceStatus = "overdue"
	InvoiceStatusCancelled InvoiceStatus = "cancelled"
)

// InvoiceCharges represents the breakdown of charges in an invoice
type InvoiceCharges struct {
	Rent        float64            `json:"rent"`
	Water       float64            `json:"water"`
	Garbage     float64            `json:"garbage"`
	Penalties   float64            `json:"penalties"`
	Maintenance float64            `json:"maintenance"`
	Other       map[string]float64 `json:"other"`
}

// MaintenanceRequest represents maintenance requests managed by agents
type MaintenanceRequest struct {
	ID              uuid.UUID           `json:"id" db:"id"`
	RequestNumber   string              `json:"request_number" db:"request_number"`
	UnitID          uuid.UUID           `json:"unit_id" db:"unit_id"`
	PropertyID      uuid.UUID           `json:"property_id" db:"property_id"`
	TenantID        uuid.UUID           `json:"tenant_id" db:"tenant_id"`
	CaretakerID     *uuid.UUID          `json:"caretaker_id" db:"caretaker_id"`
	ForwardedBy     *uuid.UUID          `json:"forwarded_by" db:"forwarded_by"`
	Title           string              `json:"title" db:"title"`
	Description     string              `json:"description" db:"description"`
	Category        MaintenanceCategory `json:"category" db:"category"`
	Priority        MaintenancePriority `json:"priority" db:"priority"`
	Status          MaintenanceStatus   `json:"status" db:"status"`
	EstimatedCost   *float64            `json:"estimated_cost" db:"estimated_cost"`
	ActualCost      *float64            `json:"actual_cost" db:"actual_cost"`
	Currency        string              `json:"currency" db:"currency"`
	Images          []string            `json:"images" db:"images"`
	Attachments     []string            `json:"attachments" db:"attachments"`
	AgentNotes      *string             `json:"agent_notes" db:"agent_notes"`
	CaretakerNotes  *string             `json:"caretaker_notes" db:"caretaker_notes"`
	ResolutionNotes *string             `json:"resolution_notes" db:"resolution_notes"`
	ScheduledDate   *time.Time          `json:"scheduled_date" db:"scheduled_date"`
	CompletedDate   *time.Time          `json:"completed_date" db:"completed_date"`
	CreatedAt       time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at" db:"updated_at"`
}

// MaintenanceCategory represents categories of maintenance requests
type MaintenanceCategory string

const (
	MaintenancePlumbing   MaintenanceCategory = "plumbing"
	MaintenanceElectrical MaintenanceCategory = "electrical"
	MaintenanceAppliances MaintenanceCategory = "appliances"
	MaintenanceCleaning   MaintenanceCategory = "cleaning"
	MaintenancePainting   MaintenanceCategory = "painting"
	MaintenanceSecurity   MaintenanceCategory = "security"
	MaintenanceOther      MaintenanceCategory = "other"
)

// MaintenancePriority represents priority levels for maintenance
type MaintenancePriority string

const (
	PriorityLow      MaintenancePriority = "low"
	PriorityMedium   MaintenancePriority = "medium"
	PriorityHigh     MaintenancePriority = "high"
	PriorityCritical MaintenancePriority = "critical"
)

// MaintenanceStatus represents the status of maintenance requests
type MaintenanceStatus string

const (
	MaintenanceStatusOpen       MaintenanceStatus = "open"
	MaintenanceStatusForwarded  MaintenanceStatus = "forwarded"
	MaintenanceStatusInProgress MaintenanceStatus = "in_progress"
	MaintenanceStatusCompleted  MaintenanceStatus = "completed"
	MaintenanceStatusCancelled  MaintenanceStatus = "cancelled"
)

// AgentNotification represents notifications for agents
type AgentNotification struct {
	ID          uuid.UUID            `json:"id" db:"id"`
	AgentID     uuid.UUID            `json:"agent_id" db:"agent_id"`
	Type        NotificationType     `json:"type" db:"type"`
	Title       string               `json:"title" db:"title"`
	Message     string               `json:"message" db:"message"`
	RelatedID   *uuid.UUID           `json:"related_id" db:"related_id"`
	RelatedType *string              `json:"related_type" db:"related_type"`
	IsRead      bool                 `json:"is_read" db:"is_read"`
	Priority    NotificationPriority `json:"priority" db:"priority"`
	CreatedAt   time.Time            `json:"created_at" db:"created_at"`
	ReadAt      *time.Time           `json:"read_at" db:"read_at"`
}

// NotificationType represents different types of notifications
type NotificationType string

const (
	NotificationLeaseExpiring     NotificationType = "lease_expiring"
	NotificationNewTenant         NotificationType = "new_tenant"
	NotificationOverdueRent       NotificationType = "overdue_rent"
	NotificationMaintenanceUpdate NotificationType = "maintenance_update"
	NotificationAgencyMessage     NotificationType = "agency_message"
	NotificationPaymentReceived   NotificationType = "payment_received"
)

// NotificationPriority represents notification priority levels
type NotificationPriority string

const (
	NotificationPriorityLow      NotificationPriority = "low"
	NotificationPriorityMedium   NotificationPriority = "medium"
	NotificationPriorityHigh     NotificationPriority = "high"
	NotificationPriorityCritical NotificationPriority = "critical"
)

// AgentReport represents various reports agents can generate
type AgentReport struct {
	ID           uuid.UUID     `json:"id" db:"id"`
	AgentID      uuid.UUID     `json:"agent_id" db:"agent_id"`
	ReportType   ReportType    `json:"report_type" db:"report_type"`
	Title        string        `json:"title" db:"title"`
	Description  *string       `json:"description" db:"description"`
	Filters      ReportFilters `json:"filters" db:"filters"`
	Data         interface{}   `json:"data" db:"data"`
	GeneratedAt  time.Time     `json:"generated_at" db:"generated_at"`
	ExportFormat *string       `json:"export_format" db:"export_format"`
	FilePath     *string       `json:"file_path" db:"file_path"`
	CreatedAt    time.Time     `json:"created_at" db:"created_at"`
}

// ReportType represents different types of reports
type ReportType string

const (
	ReportRentCollection  ReportType = "rent_collection"
	ReportTenantsArrears  ReportType = "tenants_arrears"
	ReportLeaseExpiry     ReportType = "lease_expiry"
	ReportUnitCondition   ReportType = "unit_condition"
	ReportMaintenanceLogs ReportType = "maintenance_logs"
	ReportOccupancyStats  ReportType = "occupancy_stats"
)

// ReportFilters represents filters applied to reports
type ReportFilters struct {
	PropertyIDs []uuid.UUID `json:"property_ids"`
	UnitIDs     []uuid.UUID `json:"unit_ids"`
	TenantIDs   []uuid.UUID `json:"tenant_ids"`
	DateFrom    *time.Time  `json:"date_from"`
	DateTo      *time.Time  `json:"date_to"`
	Status      []string    `json:"status"`
	Category    []string    `json:"category"`
}

// Helper methods for AgentDashboardStats
func (s *AgentDashboardStats) CalculateOccupancyRate() {
	if s.UnitsAssigned > 0 {
		s.OccupancyRate = float64(s.OccupiedUnits) / float64(s.UnitsAssigned) * 100
	}
}

// Helper methods for MaintenanceRequest
func (m *MaintenanceRequest) IsOverdue() bool {
	if m.ScheduledDate == nil {
		return false
	}
	return time.Now().After(*m.ScheduledDate) && m.Status != MaintenanceStatusCompleted
}

func (m *MaintenanceRequest) GetResolutionTime() *time.Duration {
	if m.CompletedDate == nil {
		return nil
	}
	duration := m.CompletedDate.Sub(m.CreatedAt)
	return &duration
}

// Helper methods for RentInvoice
func (r *RentInvoice) IsOverdue() bool {
	return time.Now().After(r.DueDate) && r.Status != InvoiceStatusPaid
}

func (r *RentInvoice) GetDaysOverdue() int {
	if !r.IsOverdue() {
		return 0
	}
	return int(time.Since(r.DueDate).Hours() / 24)
}

// Helper methods for AgentNotification
func (n *AgentNotification) MarkAsRead() {
	n.IsRead = true
	now := time.Now()
	n.ReadAt = &now
}
