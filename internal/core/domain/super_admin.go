package domain

import (
	"time"

	"github.com/google/uuid"
)

// ================= ANALYTICS & KPI MODELS =================

type PlatformAnalytics struct {
	ID                    uuid.UUID `json:"id" db:"id"`
	TotalAgencies         int       `json:"total_agencies" db:"total_agencies"`
	ActiveUnits           int       `json:"active_units" db:"active_units"`
	VacantUnits           int       `json:"vacant_units" db:"vacant_units"`
	TotalProperties       int       `json:"total_properties" db:"total_properties"`
	IndependentLandlords  int       `json:"independent_landlords" db:"independent_landlords"`
	ActiveTenants         int       `json:"active_tenants" db:"active_tenants"`
	TenantsInDefault      int       `json:"tenants_in_default" db:"tenants_in_default"`
	MonthlyRevenue        float64   `json:"monthly_revenue" db:"monthly_revenue"`
	YearToDateRevenue     float64   `json:"ytd_revenue" db:"ytd_revenue"`
	OccupancyRate         float64   `json:"occupancy_rate" db:"occupancy_rate"`
	LeaseRenewalRate      float64   `json:"lease_renewal_rate" db:"lease_renewal_rate"`
	NewMaintenanceTickets int       `json:"new_maintenance_tickets" db:"new_maintenance_tickets"`
	NewComplaintTickets   int       `json:"new_complaint_tickets" db:"new_complaint_tickets"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
}

type RegionalAnalytics struct {
	ID              uuid.UUID `json:"id" db:"id"`
	Region          string    `json:"region" db:"region"`
	OccupancyRate   float64   `json:"occupancy_rate" db:"occupancy_rate"`
	TotalProperties int       `json:"total_properties" db:"total_properties"`
	ActiveTenants   int       `json:"active_tenants" db:"active_tenants"`
	Revenue         float64   `json:"revenue" db:"revenue"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type AgencyPerformance struct {
	ID              uuid.UUID `json:"id" db:"id"`
	AgencyID        uuid.UUID `json:"agency_id" db:"agency_id"`
	AgencyName      string    `json:"agency_name" db:"agency_name"`
	HealthScore     float64   `json:"health_score" db:"health_score"`
	Revenue         float64   `json:"revenue" db:"revenue"`
	OccupancyRate   float64   `json:"occupancy_rate" db:"occupancy_rate"`
	ComplaintRate   float64   `json:"complaint_rate" db:"complaint_rate"`
	TotalProperties int       `json:"total_properties" db:"total_properties"`
	ActiveTenants   int       `json:"active_tenants" db:"active_tenants"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

// ================= SUBSCRIPTION & BILLING MODELS =================

type SubscriptionPlan struct {
	ID            uuid.UUID `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Type          string    `json:"type" db:"type"` // basic, premium, enterprise
	MonthlyPrice  float64   `json:"monthly_price" db:"monthly_price"`
	YearlyPrice   float64   `json:"yearly_price" db:"yearly_price"`
	Features      []string  `json:"features" db:"features"` // JSON array
	MaxProperties *int      `json:"max_properties" db:"max_properties"`
	MaxUnits      *int      `json:"max_units" db:"max_units"`
	MaxUsers      *int      `json:"max_users" db:"max_users"`
	SMSCredits    int       `json:"sms_credits" db:"sms_credits"`
	IsActive      bool      `json:"is_active" db:"is_active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type Subscription struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	AgencyID        *uuid.UUID `json:"agency_id" db:"agency_id"`
	LandlordID      *uuid.UUID `json:"landlord_id" db:"landlord_id"`
	PlanID          uuid.UUID  `json:"plan_id" db:"plan_id"`
	Status          string     `json:"status" db:"status"`               // active, suspended, cancelled, trial
	BillingCycle    string     `json:"billing_cycle" db:"billing_cycle"` // monthly, yearly
	StartDate       time.Time  `json:"start_date" db:"start_date"`
	EndDate         *time.Time `json:"end_date" db:"end_date"`
	NextBillingDate time.Time  `json:"next_billing_date" db:"next_billing_date"`
	Amount          float64    `json:"amount" db:"amount"`
	Currency        string     `json:"currency" db:"currency"`
	AutoRenewal     bool       `json:"auto_renewal" db:"auto_renewal"`
	TrialEndsAt     *time.Time `json:"trial_ends_at" db:"trial_ends_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

type Invoice struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	SubscriptionID uuid.UUID  `json:"subscription_id" db:"subscription_id"`
	InvoiceNumber  string     `json:"invoice_number" db:"invoice_number"`
	Amount         float64    `json:"amount" db:"amount"`
	Currency       string     `json:"currency" db:"currency"`
	Status         string     `json:"status" db:"status"` // pending, paid, failed, refunded
	DueDate        time.Time  `json:"due_date" db:"due_date"`
	PaidAt         *time.Time `json:"paid_at" db:"paid_at"`
	PaymentMethod  string     `json:"payment_method" db:"payment_method"`
	TransactionID  *string    `json:"transaction_id" db:"transaction_id"`
	Description    string     `json:"description" db:"description"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type PromoCode struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	Code          string     `json:"code" db:"code"`
	Description   string     `json:"description" db:"description"`
	DiscountType  string     `json:"discount_type" db:"discount_type"` // percentage, fixed
	DiscountValue float64    `json:"discount_value" db:"discount_value"`
	MinAmount     *float64   `json:"min_amount" db:"min_amount"`
	MaxDiscount   *float64   `json:"max_discount" db:"max_discount"`
	UsageLimit    *int       `json:"usage_limit" db:"usage_limit"`
	UsedCount     int        `json:"used_count" db:"used_count"`
	IsActive      bool       `json:"is_active" db:"is_active"`
	ValidFrom     time.Time  `json:"valid_from" db:"valid_from"`
	ValidUntil    *time.Time `json:"valid_until" db:"valid_until"`
	CreatedBy     uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// ================= AUDIT & LOGGING MODELS =================

type AuditLog struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	UserID     *uuid.UUID `json:"user_id" db:"user_id"`
	Action     string     `json:"action" db:"action"`
	Resource   string     `json:"resource" db:"resource"`
	ResourceID *uuid.UUID `json:"resource_id" db:"resource_id"`
	OldValues  *string    `json:"old_values" db:"old_values"` // JSON
	NewValues  *string    `json:"new_values" db:"new_values"` // JSON
	IPAddress  string     `json:"ip_address" db:"ip_address"`
	UserAgent  string     `json:"user_agent" db:"user_agent"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

type SystemLog struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Level     string    `json:"level" db:"level"` // info, warning, error, critical
	Service   string    `json:"service" db:"service"`
	Message   string    `json:"message" db:"message"`
	Details   *string   `json:"details" db:"details"` // JSON
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type LoginAttempt struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	Email         *string    `json:"email" db:"email"`
	PhoneNumber   *string    `json:"phone_number" db:"phone_number"`
	IPAddress     string     `json:"ip_address" db:"ip_address"`
	UserAgent     string     `json:"user_agent" db:"user_agent"`
	Success       bool       `json:"success" db:"success"`
	FailureReason *string    `json:"failure_reason" db:"failure_reason"`
	UserID        *uuid.UUID `json:"user_id" db:"user_id"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

// ================= NOTIFICATION MODELS =================

type NotificationTemplate struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Subject   string    `json:"subject" db:"subject"`
	EmailBody *string   `json:"email_body" db:"email_body"`
	SMSBody   *string   `json:"sms_body" db:"sms_body"`
	Variables []string  `json:"variables" db:"variables"` // JSON array
	Category  string    `json:"category" db:"category"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedBy uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type BroadcastMessage struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	Title           string     `json:"title" db:"title"`
	Message         string     `json:"message" db:"message"`
	Type            string     `json:"type" db:"type"`                       // email, sms, push, in_app
	TargetAudience  string     `json:"target_audience" db:"target_audience"` // all, agencies, landlords, tenants
	TargetFilters   *string    `json:"target_filters" db:"target_filters"`   // JSON filters
	ScheduledFor    *time.Time `json:"scheduled_for" db:"scheduled_for"`
	SentAt          *time.Time `json:"sent_at" db:"sent_at"`
	Status          string     `json:"status" db:"status"` // draft, scheduled, sending, sent, failed
	RecipientsCount int        `json:"recipients_count" db:"recipients_count"`
	DeliveredCount  int        `json:"delivered_count" db:"delivered_count"`
	OpenedCount     int        `json:"opened_count" db:"opened_count"`
	CreatedBy       uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// ================= SYSTEM SETTINGS MODELS =================

type SystemSetting struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Key         string    `json:"key" db:"key"`
	Value       string    `json:"value" db:"value"`
	DataType    string    `json:"data_type" db:"data_type"` // string, number, boolean, json
	Category    string    `json:"category" db:"category"`
	Description string    `json:"description" db:"description"`
	IsPublic    bool      `json:"is_public" db:"is_public"`
	UpdatedBy   uuid.UUID `json:"updated_by" db:"updated_by"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type APIKey struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Key         string     `json:"key" db:"key"`
	AgencyID    *uuid.UUID `json:"agency_id" db:"agency_id"`
	Permissions []string   `json:"permissions" db:"permissions"` // JSON array
	IsActive    bool       `json:"is_active" db:"is_active"`
	LastUsedAt  *time.Time `json:"last_used_at" db:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at" db:"expires_at"`
	CreatedBy   uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// ================= APPLICATION MODELS =================

type AgencyApplication struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	CompanyName   string     `json:"company_name" db:"company_name"`
	ContactEmail  string     `json:"contact_email" db:"contact_email"`
	ContactPhone  string     `json:"contact_phone" db:"contact_phone"`
	ContactPerson string     `json:"contact_person" db:"contact_person"`
	BusinessType  string     `json:"business_type" db:"business_type"`
	Address       string     `json:"address" db:"address"`
	City          string     `json:"city" db:"city"`
	Country       string     `json:"country" db:"country"`
	TaxID         *string    `json:"tax_id" db:"tax_id"`
	Website       *string    `json:"website" db:"website"`
	Description   string     `json:"description" db:"description"`
	Documents     []string   `json:"documents" db:"documents"` // JSON array of file URLs
	Status        string     `json:"status" db:"status"`       // pending, under_review, approved, rejected
	ReviewNotes   *string    `json:"review_notes" db:"review_notes"`
	ReviewedBy    *uuid.UUID `json:"reviewed_by" db:"reviewed_by"`
	ReviewedAt    *time.Time `json:"reviewed_at" db:"reviewed_at"`
	ApprovedAt    *time.Time `json:"approved_at" db:"approved_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// ================= REPORT MODELS =================

type ReportTemplate struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Type        string    `json:"type" db:"type"`             // tenants, revenue, occupancy, maintenance
	Query       string    `json:"query" db:"query"`           // SQL or structured query
	Parameters  []string  `json:"parameters" db:"parameters"` // JSON array
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedBy   uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type ScheduledReport struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	TemplateID uuid.UUID  `json:"template_id" db:"template_id"`
	Name       string     `json:"name" db:"name"`
	Recipients []string   `json:"recipients" db:"recipients"` // JSON array of emails
	Schedule   string     `json:"schedule" db:"schedule"`     // cron expression
	Format     string     `json:"format" db:"format"`         // pdf, excel, csv
	Parameters *string    `json:"parameters" db:"parameters"` // JSON
	IsActive   bool       `json:"is_active" db:"is_active"`
	LastRunAt  *time.Time `json:"last_run_at" db:"last_run_at"`
	NextRunAt  *time.Time `json:"next_run_at" db:"next_run_at"`
	CreatedBy  uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`
}

// ================= HELPER TYPES =================

type DashboardFilters struct {
	DateRange string   `json:"date_range"`
	AgencyIDs []string `json:"agency_ids"`
	Regions   []string `json:"regions"`
	Status    []string `json:"status"`
	UserRoles []string `json:"user_roles"`
}

type KPICard struct {
	Title       string      `json:"title"`
	Value       interface{} `json:"value"`
	Change      string      `json:"change"`
	ChangeType  string      `json:"change_type"` // positive, negative, neutral
	Icon        string      `json:"icon"`
	Color       string      `json:"color"`
	Description string      `json:"description"`
}

type ChartData struct {
	Labels []string  `json:"labels"`
	Data   []float64 `json:"data"`
	Colors []string  `json:"colors"`
	Type   string    `json:"type"` // line, bar, pie, donut, area
}
