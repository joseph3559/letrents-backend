package service

import (
	"context"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

// MockAgentRepository is a mock implementation for development/testing
type MockAgentRepository struct{}

// NewMockAgentRepository creates a new mock agent repository
func NewMockAgentRepository() port.AgentRepository {
	return &MockAgentRepository{}
}

// Assignment Management

func (m *MockAgentRepository) AssignPropertyToAgent(ctx context.Context, assignment *domain.AgentAssignment) error {
	return nil
}

func (m *MockAgentRepository) UnassignPropertyFromAgent(ctx context.Context, agentID, propertyID uuid.UUID) error {
	return nil
}

func (m *MockAgentRepository) GetAgentAssignments(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentAssignment, error) {
	return []*domain.AgentAssignment{
		{
			ID:         uuid.New(),
			AgentID:    agentID,
			PropertyID: uuid.New(),
			AssignedBy: uuid.New(),
			AssignedAt: time.Now().Add(-30 * 24 * time.Hour),
			IsActive:   true,
			CreatedAt:  time.Now().Add(-30 * 24 * time.Hour),
			UpdatedAt:  time.Now(),
		},
	}, nil
}

func (m *MockAgentRepository) GetAgentsByProperty(ctx context.Context, propertyID uuid.UUID) ([]*domain.User, error) {
	return []*domain.User{
		{
			ID:        uuid.New(),
			Email:     "agent@example.com",
			FirstName: "John",
			LastName:  "Agent",
			Role:      domain.RoleAgent,
			Status:    domain.StatusActive,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}, nil
}

// Dashboard Statistics

func (m *MockAgentRepository) GetAgentDashboardStats(ctx context.Context, agentID uuid.UUID) (*domain.AgentDashboardStats, error) {
	return &domain.AgentDashboardStats{
		AgentID:             agentID,
		PropertiesAssigned:  3,
		UnitsAssigned:       45,
		OccupiedUnits:       42,
		VacantUnits:         3,
		OccupancyRate:       93.3,
		TotalRentCollected:  1850000,
		UnitsWithUnpaidRent: 2,
		PendingMaintenance:  5,
		LeasesExpiringIn30:  3,
		TenantsInArrears:    2,
		CalculatedAt:        time.Now(),
	}, nil
}

func (m *MockAgentRepository) GetRentTrends(ctx context.Context, agentID uuid.UUID, months int) ([]*domain.RentTrend, error) {
	trends := make([]*domain.RentTrend, 0, months)
	for i := 0; i < months; i++ {
		month := time.Now().AddDate(0, -i, 0)
		trends = append(trends, &domain.RentTrend{
			Month:           month.Format("January"),
			Year:            month.Year(),
			AmountCollected: 1800000 + float64(i*50000),
			ExpectedAmount:  1900000,
			CollectionRate:  94.7,
		})
	}
	return trends, nil
}

// Unit Management for Agents

func (m *MockAgentRepository) GetAgentUnits(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.AgentUnitOverview, error) {
	return []*domain.AgentUnitOverview{
		{
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			PropertyName:      "Westlands Apartments",
			UnitNumber:        "A1",
			UnitType:          "2 Bedroom",
			RentAmount:        45000,
			Currency:          "KES",
			Status:            domain.UnitStatusOccupied,
			TenantID:          &[]uuid.UUID{uuid.New()}[0],
			TenantName:        &[]string{"John Doe"}[0],
			TenantPhone:       &[]string{"+254712345678"}[0],
			LastPaymentDate:   &[]time.Time{time.Now().Add(-30 * 24 * time.Hour)}[0],
			LeaseEndDate:      &[]time.Time{time.Now().Add(180 * 24 * time.Hour)}[0],
			OutstandingAmount: 0,
		},
		{
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			PropertyName:      "Kileleshwa Complex",
			UnitNumber:        "B3",
			UnitType:          "1 Bedroom",
			RentAmount:        35000,
			Currency:          "KES",
			Status:            domain.UnitStatusVacant,
			OutstandingAmount: 0,
		},
		{
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			PropertyName:      "Karen Heights",
			UnitNumber:        "C2",
			UnitType:          "3 Bedroom",
			RentAmount:        80000,
			Currency:          "KES",
			Status:            domain.UnitStatusArrears,
			TenantID:          &[]uuid.UUID{uuid.New()}[0],
			TenantName:        &[]string{"Jane Smith"}[0],
			TenantPhone:       &[]string{"+254723456789"}[0],
			LastPaymentDate:   &[]time.Time{time.Now().Add(-60 * 24 * time.Hour)}[0],
			LeaseEndDate:      &[]time.Time{time.Now().Add(120 * 24 * time.Hour)}[0],
			DaysOverdue:       &[]int{30}[0],
			OutstandingAmount: 160000,
		},
	}, nil
}

func (m *MockAgentRepository) GetUnitsByProperty(ctx context.Context, agentID, propertyID uuid.UUID) ([]*domain.AgentUnitOverview, error) {
	return m.GetAgentUnits(ctx, agentID, map[string]interface{}{"property_id": propertyID})
}

func (m *MockAgentRepository) GetUnitsWithUnpaidRent(ctx context.Context, agentID uuid.UUID, daysOverdue int) ([]*domain.AgentUnitOverview, error) {
	return []*domain.AgentUnitOverview{
		{
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			PropertyName:      "Karen Heights",
			UnitNumber:        "C2",
			UnitType:          "3 Bedroom",
			RentAmount:        80000,
			Currency:          "KES",
			Status:            domain.UnitStatusArrears,
			TenantID:          &[]uuid.UUID{uuid.New()}[0],
			TenantName:        &[]string{"Jane Smith"}[0],
			TenantPhone:       &[]string{"+254723456789"}[0],
			LastPaymentDate:   &[]time.Time{time.Now().Add(-60 * 24 * time.Hour)}[0],
			LeaseEndDate:      &[]time.Time{time.Now().Add(120 * 24 * time.Hour)}[0],
			DaysOverdue:       &[]int{30}[0],
			OutstandingAmount: 160000,
		},
	}, nil
}

func (m *MockAgentRepository) GetUnitsWithExpiringLeases(ctx context.Context, agentID uuid.UUID, daysAhead int) ([]*domain.AgentUnitOverview, error) {
	return []*domain.AgentUnitOverview{
		{
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			PropertyName:      "Westlands Apartments",
			UnitNumber:        "A3",
			UnitType:          "2 Bedroom",
			RentAmount:        45000,
			Currency:          "KES",
			Status:            domain.UnitStatusOccupied,
			TenantID:          &[]uuid.UUID{uuid.New()}[0],
			TenantName:        &[]string{"Mike Johnson"}[0],
			TenantPhone:       &[]string{"+254734567890"}[0],
			LastPaymentDate:   &[]time.Time{time.Now().Add(-15 * 24 * time.Hour)}[0],
			LeaseEndDate:      &[]time.Time{time.Now().Add(30 * 24 * time.Hour)}[0],
			OutstandingAmount: 0,
		},
	}, nil
}

// Tenant Management for Agents

func (m *MockAgentRepository) GetAgentTenants(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.AgentTenantOverview, error) {
	return []*domain.AgentTenantOverview{
		{
			TenantID:        uuid.New(),
			FirstName:       "John",
			LastName:        "Doe",
			Email:           "john.doe@email.com",
			PhoneNumber:     &[]string{"+254712345678"}[0],
			UnitID:          uuid.New(),
			UnitNumber:      "A1",
			PropertyName:    "Westlands Apartments",
			RentAmount:      45000,
			CurrentBalance:  0,
			LeaseStartDate:  &[]time.Time{time.Now().Add(-180 * 24 * time.Hour)}[0],
			LeaseEndDate:    &[]time.Time{time.Now().Add(185 * 24 * time.Hour)}[0],
			LastPaymentDate: &[]time.Time{time.Now().Add(-30 * 24 * time.Hour)}[0],
			DaysOverdue:     0,
			IsInArrears:     false,
		},
		{
			TenantID:        uuid.New(),
			FirstName:       "Jane",
			LastName:        "Smith",
			Email:           "jane.smith@email.com",
			PhoneNumber:     &[]string{"+254723456789"}[0],
			UnitID:          uuid.New(),
			UnitNumber:      "C2",
			PropertyName:    "Karen Heights",
			RentAmount:      80000,
			CurrentBalance:  160000,
			LeaseStartDate:  &[]time.Time{time.Now().Add(-300 * 24 * time.Hour)}[0],
			LeaseEndDate:    &[]time.Time{time.Now().Add(65 * 24 * time.Hour)}[0],
			LastPaymentDate: &[]time.Time{time.Now().Add(-60 * 24 * time.Hour)}[0],
			DaysOverdue:     30,
			IsInArrears:     true,
		},
	}, nil
}

func (m *MockAgentRepository) GetTenantsInArrears(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentTenantOverview, error) {
	return []*domain.AgentTenantOverview{
		{
			TenantID:        uuid.New(),
			FirstName:       "Jane",
			LastName:        "Smith",
			Email:           "jane.smith@email.com",
			PhoneNumber:     &[]string{"+254723456789"}[0],
			UnitID:          uuid.New(),
			UnitNumber:      "C2",
			PropertyName:    "Karen Heights",
			RentAmount:      80000,
			CurrentBalance:  160000,
			LeaseStartDate:  &[]time.Time{time.Now().Add(-300 * 24 * time.Hour)}[0],
			LeaseEndDate:    &[]time.Time{time.Now().Add(65 * 24 * time.Hour)}[0],
			LastPaymentDate: &[]time.Time{time.Now().Add(-60 * 24 * time.Hour)}[0],
			DaysOverdue:     30,
			IsInArrears:     true,
		},
	}, nil
}

func (m *MockAgentRepository) AddTenantToUnit(ctx context.Context, agentID uuid.UUID, tenant *domain.User, unitID uuid.UUID, leaseDetails map[string]interface{}) error {
	return nil
}

func (m *MockAgentRepository) SendTenantNotification(ctx context.Context, agentID, tenantID uuid.UUID, message, method string) error {
	return nil
}

// Invoice Management

func (m *MockAgentRepository) CreateRentInvoice(ctx context.Context, invoice *domain.RentInvoice) error {
	return nil
}

func (m *MockAgentRepository) GetAgentInvoices(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.RentInvoice, error) {
	return []*domain.RentInvoice{
		{
			ID:                uuid.New(),
			InvoiceNumber:     "INV-2024001",
			TenantID:          uuid.New(),
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			CreatedBy:         agentID,
			InvoiceType:       domain.InvoiceTypeMonthly,
			Status:            domain.InvoiceStatusSent,
			RentAmount:        45000,
			AdditionalCharges: 5000,
			TotalAmount:       50000,
			Currency:          "KES",
			DueDate:           time.Now().Add(7 * 24 * time.Hour),
			ChargeBreakdown: domain.InvoiceCharges{
				Rent:    45000,
				Water:   2000,
				Garbage: 1000,
				Other:   map[string]float64{"Security": 2000},
			},
			CreatedAt: time.Now().Add(-7 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-7 * 24 * time.Hour),
		},
		{
			ID:                uuid.New(),
			InvoiceNumber:     "INV-2024002",
			TenantID:          uuid.New(),
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			CreatedBy:         agentID,
			InvoiceType:       domain.InvoiceTypeMonthly,
			Status:            domain.InvoiceStatusOverdue,
			RentAmount:        80000,
			AdditionalCharges: 8000,
			TotalAmount:       88000,
			Currency:          "KES",
			DueDate:           time.Now().Add(-15 * 24 * time.Hour),
			ChargeBreakdown: domain.InvoiceCharges{
				Rent:      80000,
				Water:     3000,
				Garbage:   1000,
				Penalties: 4000,
			},
			CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-30 * 24 * time.Hour),
		},
	}, nil
}

func (m *MockAgentRepository) UpdateInvoiceStatus(ctx context.Context, invoiceID uuid.UUID, status domain.InvoiceStatus, paidDate *time.Time, paymentMethod *string) error {
	return nil
}

func (m *MockAgentRepository) GetOverdueInvoices(ctx context.Context, agentID uuid.UUID) ([]*domain.RentInvoice, error) {
	return []*domain.RentInvoice{
		{
			ID:                uuid.New(),
			InvoiceNumber:     "INV-2024002",
			TenantID:          uuid.New(),
			UnitID:            uuid.New(),
			PropertyID:        uuid.New(),
			CreatedBy:         agentID,
			InvoiceType:       domain.InvoiceTypeMonthly,
			Status:            domain.InvoiceStatusOverdue,
			RentAmount:        80000,
			AdditionalCharges: 8000,
			TotalAmount:       88000,
			Currency:          "KES",
			DueDate:           time.Now().Add(-15 * 24 * time.Hour),
			ChargeBreakdown: domain.InvoiceCharges{
				Rent:      80000,
				Water:     3000,
				Garbage:   1000,
				Penalties: 4000,
			},
			CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
			UpdatedAt: time.Now().Add(-30 * 24 * time.Hour),
		},
	}, nil
}

func (m *MockAgentRepository) BulkCreateInvoices(ctx context.Context, invoices []*domain.RentInvoice) error {
	return nil
}

// Maintenance Management

func (m *MockAgentRepository) GetMaintenanceRequests(ctx context.Context, agentID uuid.UUID, filters map[string]interface{}) ([]*domain.MaintenanceRequest, error) {
	return []*domain.MaintenanceRequest{
		{
			ID:            uuid.New(),
			RequestNumber: "MNT-2024001",
			UnitID:        uuid.New(),
			PropertyID:    uuid.New(),
			TenantID:      uuid.New(),
			Title:         "Leaking faucet in kitchen",
			Description:   "The kitchen faucet has been leaking for 2 days",
			Category:      domain.MaintenancePlumbing,
			Priority:      domain.PriorityMedium,
			Status:        "pending",
			EstimatedCost: &[]float64{5000}[0],
			Currency:      "KES",
			Images:        []string{},
			Attachments:   []string{},
			CreatedAt:     time.Now().Add(-2 * 24 * time.Hour),
			UpdatedAt:     time.Now().Add(-2 * 24 * time.Hour),
		},
		{
			ID:            uuid.New(),
			RequestNumber: "MNT-2024002",
			UnitID:        uuid.New(),
			PropertyID:    uuid.New(),
			TenantID:      uuid.New(),
			CaretakerID:   &[]uuid.UUID{uuid.New()}[0],
			Title:         "Electrical outlet not working",
			Description:   "Living room outlet stopped working",
			Category:      domain.MaintenanceElectrical,
			Priority:      domain.PriorityHigh,
			Status:        "in_progress",
			EstimatedCost: &[]float64{8000}[0],
			Currency:      "KES",
			Images:        []string{},
			Attachments:   []string{},
			ScheduledDate: &[]time.Time{time.Now().Add(24 * time.Hour)}[0],
			CreatedAt:     time.Now().Add(-5 * 24 * time.Hour),
			UpdatedAt:     time.Now().Add(-24 * time.Hour),
		},
	}, nil
}

func (m *MockAgentRepository) ForwardMaintenanceRequest(ctx context.Context, requestID, caretakerID, agentID uuid.UUID, notes string) error {
	return nil
}

func (m *MockAgentRepository) UpdateMaintenancePriority(ctx context.Context, requestID uuid.UUID, priority domain.MaintenancePriority, agentNotes string) error {
	return nil
}

func (m *MockAgentRepository) GetPendingMaintenanceRequests(ctx context.Context, agentID uuid.UUID) ([]*domain.MaintenanceRequest, error) {
	return []*domain.MaintenanceRequest{
		{
			ID:            uuid.New(),
			RequestNumber: "MNT-2024001",
			UnitID:        uuid.New(),
			PropertyID:    uuid.New(),
			TenantID:      uuid.New(),
			Title:         "Leaking faucet in kitchen",
			Description:   "The kitchen faucet has been leaking for 2 days",
			Category:      domain.MaintenancePlumbing,
			Priority:      domain.PriorityMedium,
			Status:        "pending",
			EstimatedCost: &[]float64{5000}[0],
			Currency:      "KES",
			Images:        []string{},
			Attachments:   []string{},
			CreatedAt:     time.Now().Add(-2 * 24 * time.Hour),
			UpdatedAt:     time.Now().Add(-2 * 24 * time.Hour),
		},
	}, nil
}

// Notifications

func (m *MockAgentRepository) CreateAgentNotification(ctx context.Context, notification *domain.AgentNotification) error {
	return nil
}

func (m *MockAgentRepository) GetAgentNotifications(ctx context.Context, agentID uuid.UUID, unreadOnly bool, limit int) ([]*domain.AgentNotification, error) {
	return []*domain.AgentNotification{
		{
			ID:          uuid.New(),
			AgentID:     agentID,
			Type:        domain.NotificationPaymentReceived,
			Title:       "Payment Received",
			Message:     "Rent payment of KSh 45,000 received for Unit A1",
			RelatedID:   &[]uuid.UUID{uuid.New()}[0],
			RelatedType: &[]string{"payment"}[0],
			IsRead:      false,
			Priority:    domain.NotificationPriorityMedium,
			CreatedAt:   time.Now().Add(-2 * time.Hour),
		},
		{
			ID:          uuid.New(),
			AgentID:     agentID,
			Type:        domain.NotificationMaintenanceUpdate,
			Title:       "New Maintenance Request",
			Message:     "New maintenance request submitted for Unit B3",
			RelatedID:   &[]uuid.UUID{uuid.New()}[0],
			RelatedType: &[]string{"maintenance"}[0],
			IsRead:      false,
			Priority:    domain.NotificationPriorityHigh,
			CreatedAt:   time.Now().Add(-4 * time.Hour),
		},
		{
			ID:          uuid.New(),
			AgentID:     agentID,
			Type:        domain.NotificationLeaseExpiring,
			Title:       "Lease Expiring Soon",
			Message:     "Unit A3 lease expires in 30 days",
			RelatedID:   &[]uuid.UUID{uuid.New()}[0],
			RelatedType: &[]string{"lease"}[0],
			IsRead:      true,
			Priority:    domain.NotificationPriorityMedium,
			CreatedAt:   time.Now().Add(-24 * time.Hour),
			ReadAt:      &[]time.Time{time.Now().Add(-12 * time.Hour)}[0],
		},
	}, nil
}

func (m *MockAgentRepository) MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID) error {
	return nil
}

func (m *MockAgentRepository) MarkAllNotificationsAsRead(ctx context.Context, agentID uuid.UUID) error {
	return nil
}

func (m *MockAgentRepository) GetUnreadNotificationCount(ctx context.Context, agentID uuid.UUID) (int, error) {
	return 5, nil
}

// Reports

func (m *MockAgentRepository) GenerateRentCollectionReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	return &domain.AgentReport{
		ID:          uuid.New(),
		AgentID:     agentID,
		ReportType:  domain.ReportRentCollection,
		Title:       "Rent Collection Report",
		Description: &[]string{"Monthly rent collection summary"}[0],
		Filters:     *filters,
		Data:        map[string]interface{}{"total_collected": 1850000, "collection_rate": 94.7},
		GeneratedAt: time.Now(),
		CreatedAt:   time.Now(),
	}, nil
}

func (m *MockAgentRepository) GenerateTenantsArrearsReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	return &domain.AgentReport{
		ID:          uuid.New(),
		AgentID:     agentID,
		ReportType:  domain.ReportTenantsArrears,
		Title:       "Tenants in Arrears Report",
		Description: &[]string{"Summary of tenants with outstanding balances"}[0],
		Filters:     *filters,
		Data:        map[string]interface{}{"total_arrears": 320000, "tenants_count": 2},
		GeneratedAt: time.Now(),
		CreatedAt:   time.Now(),
	}, nil
}

func (m *MockAgentRepository) GenerateLeaseExpiryReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	return &domain.AgentReport{
		ID:          uuid.New(),
		AgentID:     agentID,
		ReportType:  domain.ReportLeaseExpiry,
		Title:       "Lease Expiry Report",
		Description: &[]string{"Upcoming lease expirations"}[0],
		Filters:     *filters,
		Data:        map[string]interface{}{"expiring_soon": 3, "expired": 0},
		GeneratedAt: time.Now(),
		CreatedAt:   time.Now(),
	}, nil
}

func (m *MockAgentRepository) GenerateUnitConditionReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	return &domain.AgentReport{
		ID:          uuid.New(),
		AgentID:     agentID,
		ReportType:  domain.ReportUnitCondition,
		Title:       "Unit Condition Report",
		Description: &[]string{"Unit maintenance and condition summary"}[0],
		Filters:     *filters,
		Data:        map[string]interface{}{"good_condition": 40, "needs_repair": 3, "under_maintenance": 2},
		GeneratedAt: time.Now(),
		CreatedAt:   time.Now(),
	}, nil
}

func (m *MockAgentRepository) GenerateMaintenanceLogsReport(ctx context.Context, agentID uuid.UUID, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	return &domain.AgentReport{
		ID:          uuid.New(),
		AgentID:     agentID,
		ReportType:  "maintenance_logs",
		Title:       "Maintenance Logs Report",
		Description: &[]string{"Maintenance activity summary"}[0],
		Filters:     *filters,
		Data:        map[string]interface{}{"total_requests": 15, "completed": 8, "pending": 5, "in_progress": 2},
		GeneratedAt: time.Now(),
		CreatedAt:   time.Now(),
	}, nil
}

func (m *MockAgentRepository) ExportReport(ctx context.Context, reportID uuid.UUID, format string) (string, error) {
	return "/path/to/exported/report." + format, nil
}
