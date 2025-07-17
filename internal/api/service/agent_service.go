package service

import (
	"context"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

// AgentService implements the port.AgentService interface
type AgentService struct {
	agentRepo    port.AgentRepository
	userRepo     port.UserRepository
	propertyRepo port.PropertyRepository
	unitRepo     port.UnitRepository
}

// NewAgentService creates a new agent service
func NewAgentService(
	agentRepo port.AgentRepository,
	userRepo port.UserRepository,
	propertyRepo port.PropertyRepository,
	unitRepo port.UnitRepository,
) port.AgentService {
	return &AgentService{
		agentRepo:    agentRepo,
		userRepo:     userRepo,
		propertyRepo: propertyRepo,
		unitRepo:     unitRepo,
	}
}

// Dashboard Operations

func (s *AgentService) GetDashboardOverview(ctx context.Context, agentID uuid.UUID) (*port.AgentDashboardResponse, error) {
	// Get dashboard stats
	stats, err := s.agentRepo.GetAgentDashboardStats(ctx, agentID)
	if err != nil {
		return nil, err
	}

	// Get recent activities (mock data for now)
	activities := []*port.ActivitySummary{
		{
			ID:           uuid.New(),
			Type:         "payment_received",
			Description:  "Rent payment received for Unit A1",
			PropertyName: stringPtr("Westlands Apartments"),
			UnitNumber:   stringPtr("A1"),
			CreatedAt:    time.Now().Add(-2 * time.Hour),
			Priority:     "normal",
		},
		{
			ID:           uuid.New(),
			Type:         "maintenance_request",
			Description:  "New maintenance request for plumbing",
			PropertyName: stringPtr("Kileleshwa Complex"),
			UnitNumber:   stringPtr("B3"),
			CreatedAt:    time.Now().Add(-4 * time.Hour),
			Priority:     "high",
		},
	}

	// Get notifications
	notifications, err := s.agentRepo.GetAgentNotifications(ctx, agentID, true, 5)
	if err != nil {
		return nil, err
	}

	// Get properties summary
	assignments, err := s.agentRepo.GetAgentAssignments(ctx, agentID)
	if err != nil {
		return nil, err
	}

	propertiesSummary := make([]*port.PropertySummary, 0, len(assignments))
	for _, assignment := range assignments {
		// Mock property summary data
		propertiesSummary = append(propertiesSummary, &port.PropertySummary{
			PropertyID:    assignment.PropertyID,
			Name:          "Property Name", // Would fetch from property repo
			UnitsCount:    25,
			OccupiedUnits: 23,
			VacantUnits:   2,
			ArrearsUnits:  1,
			Address:       "Property Address",
			Caretaker:     stringPtr("John Doe"),
		})
	}

	// Get upcoming lease expiry
	leaseExpiry := []*port.LeaseExpirySummary{
		{
			TenantName:   "Jane Smith",
			UnitNumber:   "A3",
			PropertyName: "Karen Heights",
			ExpiryDate:   time.Now().Add(30 * 24 * time.Hour),
			DaysLeft:     30,
			TenantPhone:  stringPtr("+254712345678"),
		},
	}

	return &port.AgentDashboardResponse{
		Stats:               stats,
		RecentActivities:    activities,
		Notifications:       notifications,
		PropertiesSummary:   propertiesSummary,
		UpcomingLeaseExpiry: leaseExpiry,
	}, nil
}

func (s *AgentService) GetDashboardStats(ctx context.Context, agentID uuid.UUID) (*domain.AgentDashboardStats, error) {
	return s.agentRepo.GetAgentDashboardStats(ctx, agentID)
}

func (s *AgentService) GetRentCollectionTrends(ctx context.Context, agentID uuid.UUID, months int) ([]*domain.RentTrend, error) {
	return s.agentRepo.GetRentTrends(ctx, agentID, months)
}

// Property & Unit Management

func (s *AgentService) GetAssignedProperties(ctx context.Context, agentID uuid.UUID) ([]*port.PropertySummary, error) {
	assignments, err := s.agentRepo.GetAgentAssignments(ctx, agentID)
	if err != nil {
		return nil, err
	}

	properties := make([]*port.PropertySummary, 0, len(assignments))
	for _, assignment := range assignments {
		// Mock property data - would fetch from property repo
		properties = append(properties, &port.PropertySummary{
			PropertyID:    assignment.PropertyID,
			Name:          "Property Name",
			UnitsCount:    25,
			OccupiedUnits: 23,
			VacantUnits:   2,
			ArrearsUnits:  1,
			Address:       "Property Address",
			Caretaker:     stringPtr("John Doe"),
		})
	}

	return properties, nil
}

func (s *AgentService) GetUnitsOverview(ctx context.Context, agentID uuid.UUID, filters *port.AgentUnitFilters) ([]*domain.AgentUnitOverview, error) {
	filtersMap := make(map[string]interface{})
	if filters != nil {
		if filters.PropertyID != nil {
			filtersMap["property_id"] = *filters.PropertyID
		}
		if filters.Status != nil {
			filtersMap["status"] = filters.Status
		}
		if filters.UnitType != nil {
			filtersMap["unit_type"] = filters.UnitType
		}
		if filters.MinRent != nil {
			filtersMap["min_rent"] = *filters.MinRent
		}
		if filters.MaxRent != nil {
			filtersMap["max_rent"] = *filters.MaxRent
		}
	}

	return s.agentRepo.GetAgentUnits(ctx, agentID, filtersMap)
}

func (s *AgentService) SearchUnits(ctx context.Context, agentID uuid.UUID, query string, filters *port.AgentUnitFilters) ([]*domain.AgentUnitOverview, error) {
	filtersMap := make(map[string]interface{})
	filtersMap["search"] = query

	if filters != nil {
		if filters.PropertyID != nil {
			filtersMap["property_id"] = *filters.PropertyID
		}
		if filters.Status != nil {
			filtersMap["status"] = filters.Status
		}
	}

	return s.agentRepo.GetAgentUnits(ctx, agentID, filtersMap)
}

func (s *AgentService) GetUnitDetails(ctx context.Context, agentID, unitID uuid.UUID) (*port.UnitDetailsResponse, error) {
	// Mock implementation - would fetch real data
	return &port.UnitDetailsResponse{
		Unit: &domain.AgentUnitOverview{
			UnitID:       unitID,
			PropertyID:   uuid.New(),
			PropertyName: "Westlands Apartments",
			UnitNumber:   "A1",
			UnitType:     "2 Bedroom",
			RentAmount:   45000,
			Currency:     "KES",
			Status:       domain.UnitStatusOccupied,
		},
		Property: &port.PropertySummary{
			PropertyID:    uuid.New(),
			Name:          "Westlands Apartments",
			UnitsCount:    25,
			OccupiedUnits: 23,
			VacantUnits:   2,
			ArrearsUnits:  1,
			Address:       "Westlands, Nairobi",
		},
		Tenant: &domain.AgentTenantOverview{
			TenantID:     uuid.New(),
			FirstName:    "John",
			LastName:     "Doe",
			Email:        "john.doe@email.com",
			PhoneNumber:  stringPtr("+254712345678"),
			UnitID:       unitID,
			UnitNumber:   "A1",
			PropertyName: "Westlands Apartments",
			RentAmount:   45000,
		},
		RecentPayments: []*port.PaymentSummary{
			{
				ID:            uuid.New(),
				Amount:        45000,
				PaymentDate:   time.Now().Add(-30 * 24 * time.Hour),
				PaymentMethod: "M-Pesa",
				Reference:     stringPtr("MPesa123456"),
				Status:        "completed",
			},
		},
		MaintenanceHistory: []*port.MaintenanceSummary{},
	}, nil
}

func (s *AgentService) UpdateUnitStatus(ctx context.Context, agentID, unitID uuid.UUID, status domain.UnitStatusEnum, notes string) error {
	// Mock implementation - would update unit status
	return nil
}

// Tenant Management

func (s *AgentService) GetTenantsOverview(ctx context.Context, agentID uuid.UUID, filters *port.TenantFilters) ([]*domain.AgentTenantOverview, error) {
	filtersMap := make(map[string]interface{})
	if filters != nil {
		if filters.PropertyID != nil {
			filtersMap["property_id"] = *filters.PropertyID
		}
		if filters.UnitID != nil {
			filtersMap["unit_id"] = *filters.UnitID
		}
		if filters.InArrears != nil {
			filtersMap["in_arrears"] = *filters.InArrears
		}
	}

	return s.agentRepo.GetAgentTenants(ctx, agentID, filtersMap)
}

func (s *AgentService) AddNewTenant(ctx context.Context, agentID uuid.UUID, request *port.AddTenantRequest) error {
	// Create new tenant user
	user := &domain.User{
		ID:          uuid.New(),
		Email:       request.Email,
		FirstName:   request.FirstName,
		LastName:    request.LastName,
		PhoneNumber: request.PhoneNumber,
		Role:        domain.RoleTenant,
		Status:      domain.StatusActive,
	}

	leaseDetails := map[string]interface{}{
		"lease_start_date": request.LeaseStartDate,
		"lease_end_date":   request.LeaseEndDate,
		"deposit_amount":   request.DepositAmount,
		"notes":            request.Notes,
	}

	return s.agentRepo.AddTenantToUnit(ctx, agentID, user, request.UnitID, leaseDetails)
}

func (s *AgentService) GetTenantDetails(ctx context.Context, agentID, tenantID uuid.UUID) (*port.TenantDetailsResponse, error) {
	// Mock implementation - would fetch real tenant details
	return &port.TenantDetailsResponse{
		Tenant: &domain.AgentTenantOverview{
			TenantID:     tenantID,
			FirstName:    "John",
			LastName:     "Doe",
			Email:        "john.doe@email.com",
			PhoneNumber:  stringPtr("+254712345678"),
			UnitID:       uuid.New(),
			UnitNumber:   "A1",
			PropertyName: "Westlands Apartments",
			RentAmount:   45000,
		},
		Unit: &domain.AgentUnitOverview{
			UnitID:       uuid.New(),
			PropertyName: "Westlands Apartments",
			UnitNumber:   "A1",
			UnitType:     "2 Bedroom",
			RentAmount:   45000,
			Status:       domain.UnitStatusOccupied,
		},
		PaymentHistory: []*port.PaymentSummary{},
		LeaseDetails: &port.LeaseDetails{
			StartDate:     time.Now().Add(-6 * 30 * 24 * time.Hour),
			EndDate:       time.Now().Add(6 * 30 * 24 * time.Hour),
			RentAmount:    45000,
			DepositAmount: 90000,
			LeaseType:     "Annual",
			Documents:     []string{},
		},
		Communications: []*port.CommunicationHistory{},
	}, nil
}

func (s *AgentService) SendTenantMessage(ctx context.Context, agentID, tenantID uuid.UUID, message *port.TenantMessage) error {
	return s.agentRepo.SendTenantNotification(ctx, agentID, tenantID, message.Body, message.Method)
}

func (s *AgentService) GetTenantsInArrears(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentTenantOverview, error) {
	return s.agentRepo.GetTenantsInArrears(ctx, agentID)
}

// Rent & Invoice Management

func (s *AgentService) CreateRentInvoice(ctx context.Context, agentID uuid.UUID, request *port.CreateInvoiceRequest) (*domain.RentInvoice, error) {
	invoice := &domain.RentInvoice{
		ID:                uuid.New(),
		InvoiceNumber:     generateInvoiceNumber(),
		TenantID:          request.TenantID,
		UnitID:            request.UnitID,
		PropertyID:        uuid.New(), // Would get from unit
		CreatedBy:         agentID,
		InvoiceType:       request.InvoiceType,
		Status:            domain.InvoiceStatusDraft,
		RentAmount:        request.RentAmount,
		AdditionalCharges: request.AdditionalCharges,
		TotalAmount:       request.RentAmount + request.AdditionalCharges,
		Currency:          "KES",
		DueDate:           request.DueDate,
		Notes:             request.Notes,
		ChargeBreakdown:   request.ChargeBreakdown,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	err := s.agentRepo.CreateRentInvoice(ctx, invoice)
	if err != nil {
		return nil, err
	}

	return invoice, nil
}

func (s *AgentService) BulkCreateInvoices(ctx context.Context, agentID uuid.UUID, request *port.BulkInvoiceRequest) ([]*domain.RentInvoice, error) {
	var invoices []*domain.RentInvoice

	// Create invoices for specified units
	for _, unitID := range request.UnitIDs {
		invoice := &domain.RentInvoice{
			ID:                uuid.New(),
			InvoiceNumber:     generateInvoiceNumber(),
			UnitID:            unitID,
			PropertyID:        uuid.New(), // Would get from unit
			CreatedBy:         agentID,
			InvoiceType:       request.InvoiceType,
			Status:            domain.InvoiceStatusDraft,
			AdditionalCharges: request.AdditionalCharges,
			Currency:          "KES",
			DueDate:           request.DueDate,
			Notes:             request.Notes,
			ChargeBreakdown:   request.ChargeBreakdown,
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}
		invoices = append(invoices, invoice)
	}

	err := s.agentRepo.BulkCreateInvoices(ctx, invoices)
	if err != nil {
		return nil, err
	}

	return invoices, nil
}

func (s *AgentService) GetInvoices(ctx context.Context, agentID uuid.UUID, filters *port.InvoiceFilters) ([]*domain.RentInvoice, error) {
	filtersMap := make(map[string]interface{})
	if filters != nil {
		if filters.PropertyID != nil {
			filtersMap["property_id"] = *filters.PropertyID
		}
		if filters.UnitID != nil {
			filtersMap["unit_id"] = *filters.UnitID
		}
		if filters.TenantID != nil {
			filtersMap["tenant_id"] = *filters.TenantID
		}
		if filters.Status != nil {
			filtersMap["status"] = filters.Status
		}
		if filters.Type != nil {
			filtersMap["type"] = filters.Type
		}
		if filters.DateFrom != nil {
			filtersMap["date_from"] = *filters.DateFrom
		}
		if filters.DateTo != nil {
			filtersMap["date_to"] = *filters.DateTo
		}
	}

	return s.agentRepo.GetAgentInvoices(ctx, agentID, filtersMap)
}

func (s *AgentService) MarkPaymentReceived(ctx context.Context, agentID, invoiceID uuid.UUID, payment *port.PaymentRecord) error {
	return s.agentRepo.UpdateInvoiceStatus(ctx, invoiceID, domain.InvoiceStatusPaid, &payment.PaymentDate, &payment.PaymentMethod)
}

func (s *AgentService) SendInvoiceToTenant(ctx context.Context, agentID, invoiceID uuid.UUID, delivery *port.InvoiceDelivery) error {
	// Mock implementation - would send invoice via specified method
	return nil
}

func (s *AgentService) GetOverdueInvoices(ctx context.Context, agentID uuid.UUID) ([]*domain.RentInvoice, error) {
	return s.agentRepo.GetOverdueInvoices(ctx, agentID)
}

// Maintenance Management

func (s *AgentService) GetMaintenanceRequests(ctx context.Context, agentID uuid.UUID, filters *port.MaintenanceFilters) ([]*domain.MaintenanceRequest, error) {
	filtersMap := make(map[string]interface{})
	if filters != nil {
		if filters.PropertyID != nil {
			filtersMap["property_id"] = *filters.PropertyID
		}
		if filters.UnitID != nil {
			filtersMap["unit_id"] = *filters.UnitID
		}
		if filters.Category != nil {
			filtersMap["category"] = filters.Category
		}
		if filters.Priority != nil {
			filtersMap["priority"] = filters.Priority
		}
		if filters.Status != nil {
			filtersMap["status"] = filters.Status
		}
	}

	return s.agentRepo.GetMaintenanceRequests(ctx, agentID, filtersMap)
}

func (s *AgentService) ForwardToCaretaker(ctx context.Context, agentID, requestID, caretakerID uuid.UUID, request *port.ForwardMaintenanceRequest) error {
	notes := ""
	if request.AgentNotes != nil {
		notes = *request.AgentNotes
	}

	err := s.agentRepo.ForwardMaintenanceRequest(ctx, requestID, caretakerID, agentID, notes)
	if err != nil {
		return err
	}

	// Update priority if specified
	if request.Priority != "" {
		err = s.agentRepo.UpdateMaintenancePriority(ctx, requestID, request.Priority, notes)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *AgentService) UpdateMaintenanceStatus(ctx context.Context, agentID, requestID uuid.UUID, status domain.MaintenanceStatus, notes string) error {
	// Mock implementation - would update maintenance status
	return nil
}

func (s *AgentService) GetPendingMaintenance(ctx context.Context, agentID uuid.UUID) ([]*domain.MaintenanceRequest, error) {
	return s.agentRepo.GetPendingMaintenanceRequests(ctx, agentID)
}

// Notifications & Alerts

func (s *AgentService) GetNotifications(ctx context.Context, agentID uuid.UUID, unreadOnly bool, limit int) ([]*domain.AgentNotification, error) {
	return s.agentRepo.GetAgentNotifications(ctx, agentID, unreadOnly, limit)
}

func (s *AgentService) MarkNotificationRead(ctx context.Context, agentID, notificationID uuid.UUID) error {
	return s.agentRepo.MarkNotificationAsRead(ctx, notificationID)
}

func (s *AgentService) GetUnreadCount(ctx context.Context, agentID uuid.UUID) (int, error) {
	return s.agentRepo.GetUnreadNotificationCount(ctx, agentID)
}

func (s *AgentService) CreateSystemNotification(ctx context.Context, agentID uuid.UUID, notification *port.SystemNotification) error {
	agentNotification := &domain.AgentNotification{
		ID:          uuid.New(),
		AgentID:     agentID,
		Type:        notification.Type,
		Title:       notification.Title,
		Message:     notification.Message,
		Priority:    notification.Priority,
		RelatedID:   notification.RelatedID,
		RelatedType: notification.RelatedType,
		IsRead:      false,
		CreatedAt:   time.Now(),
	}

	return s.agentRepo.CreateAgentNotification(ctx, agentNotification)
}

// Reports & Analytics

func (s *AgentService) GenerateReport(ctx context.Context, agentID uuid.UUID, reportType domain.ReportType, filters *domain.ReportFilters) (*domain.AgentReport, error) {
	switch reportType {
	case domain.ReportRentCollection:
		return s.agentRepo.GenerateRentCollectionReport(ctx, agentID, filters)
	case domain.ReportTenantsArrears:
		return s.agentRepo.GenerateTenantsArrearsReport(ctx, agentID, filters)
	case domain.ReportLeaseExpiry:
		return s.agentRepo.GenerateLeaseExpiryReport(ctx, agentID, filters)
	case domain.ReportUnitCondition:
		return s.agentRepo.GenerateUnitConditionReport(ctx, agentID, filters)
	default:
		return s.agentRepo.GenerateRentCollectionReport(ctx, agentID, filters)
	}
}

func (s *AgentService) ExportReportData(ctx context.Context, agentID, reportID uuid.UUID, format string) (string, error) {
	// Mock implementation - would export report data
	return "/path/to/exported/report.pdf", nil
}

func (s *AgentService) GetReportHistory(ctx context.Context, agentID uuid.UUID) ([]*domain.AgentReport, error) {
	// Mock implementation - would return report history
	return []*domain.AgentReport{}, nil
}

// Communication

func (s *AgentService) SendSMSToTenant(ctx context.Context, agentID, tenantID uuid.UUID, message string) error {
	return s.agentRepo.SendTenantNotification(ctx, agentID, tenantID, message, "sms")
}

func (s *AgentService) SendEmailToTenant(ctx context.Context, agentID, tenantID uuid.UUID, subject, body string) error {
	return s.agentRepo.SendTenantNotification(ctx, agentID, tenantID, body, "email")
}

func (s *AgentService) SendWhatsAppToTenant(ctx context.Context, agentID, tenantID uuid.UUID, message string) error {
	return s.agentRepo.SendTenantNotification(ctx, agentID, tenantID, message, "whatsapp")
}

// Helper functions

func stringPtr(s string) *string {
	return &s
}

func generateInvoiceNumber() string {
	return "INV-" + uuid.New().String()[:8]
}
