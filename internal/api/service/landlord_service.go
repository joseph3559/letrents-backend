package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

// LandlordService implements the landlord business logic
type LandlordService struct {
	propertyRepo port.PropertyRepository
	unitRepo     port.UnitRepository
	userRepo     port.UserRepository
	landlordRepo port.LandlordDashboardRepository
}

// NewLandlordService creates a new landlord service instance
func NewLandlordService(
	propertyRepo port.PropertyRepository,
	unitRepo port.UnitRepository,
	userRepo port.UserRepository,
	landlordRepo port.LandlordDashboardRepository,
) port.LandlordService {
	return &LandlordService{
		propertyRepo: propertyRepo,
		unitRepo:     unitRepo,
		userRepo:     userRepo,
		landlordRepo: landlordRepo,
	}
}

// GetDashboardOverview returns the complete dashboard overview for a landlord
func (s *LandlordService) GetDashboardOverview(ctx context.Context, landlordID uuid.UUID) (*port.LandlordDashboardOverview, error) {
	// Get dashboard stats
	stats, err := s.GetDashboardStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Get recent activities
	activities, err := s.landlordRepo.GetRecentActivities(ctx, landlordID, 10)
	if err != nil {
		return nil, err
	}

	// Get recent payments
	payments, err := s.landlordRepo.GetRecentPayments(ctx, landlordID, 5)
	if err != nil {
		return nil, err
	}

	// Get notifications
	notifications, err := s.landlordRepo.GetNotifications(ctx, landlordID, 5, 0)
	if err != nil {
		return nil, err
	}

	// Define quick actions
	quickActions := []*port.QuickAction{
		{
			ID:          "add-property",
			Title:       "Add Property",
			Description: "Register a new property",
			Icon:        "🏠",
			Action:      "navigate",
			URL:         "/landlord/properties/new",
		},
		{
			ID:          "add-tenant",
			Title:       "Add Tenant",
			Description: "Register a new tenant",
			Icon:        "👤",
			Action:      "navigate",
			URL:         "/landlord/tenants/new",
		},
		{
			ID:          "schedule-inspection",
			Title:       "Schedule Inspection",
			Description: "Schedule property inspection",
			Icon:        "📋",
			Action:      "navigate",
			URL:         "/landlord/inspections/new",
		},
		{
			ID:          "generate-report",
			Title:       "Generate Report",
			Description: "Create financial report",
			Icon:        "📊",
			Action:      "navigate",
			URL:         "/landlord/reports",
		},
	}

	return &port.LandlordDashboardOverview{
		Stats:            stats,
		RecentActivities: activities,
		RecentPayments:   payments,
		Notifications:    notifications,
		QuickActions:     quickActions,
	}, nil
}

// GetDashboardStats returns dashboard statistics for a landlord
func (s *LandlordService) GetDashboardStats(ctx context.Context, landlordID uuid.UUID) (*port.LandlordDashboardStats, error) {
	// Get property stats
	propertyStats, err := s.propertyRepo.GetPropertyStats(ctx, &landlordID, nil)
	if err != nil {
		return nil, err
	}

	// Get unit stats
	unitStats, err := s.unitRepo.GetUnitStats(ctx, nil, &landlordID)
	if err != nil {
		return nil, err
	}

	// Calculate monthly and annual revenue (simplified calculation)
	monthlyRevenue := unitStats.TotalMonthlyRevenue
	annualRevenue := monthlyRevenue * 12

	// Get pending maintenance count
	maintenanceStats, err := s.landlordRepo.GetMaintenanceStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Get pending inspections count
	inspectionStats, err := s.landlordRepo.GetInspectionStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Calculate occupancy rate
	occupancyRate := 0.0
	if unitStats.TotalUnits > 0 {
		occupancyRate = float64(unitStats.OccupiedUnits) / float64(unitStats.TotalUnits) * 100
	}

	return &port.LandlordDashboardStats{
		TotalProperties:    propertyStats.TotalProperties,
		TotalUnits:         unitStats.TotalUnits,
		OccupiedUnits:      unitStats.OccupiedUnits,
		VacantUnits:        unitStats.VacantUnits,
		OccupancyRate:      occupancyRate,
		TotalTenants:       unitStats.OccupiedUnits, // Simplified: one tenant per occupied unit
		ActiveTenants:      unitStats.OccupiedUnits,
		MonthlyRevenue:     monthlyRevenue,
		AnnualRevenue:      annualRevenue,
		PendingMaintenance: maintenanceStats.PendingRequests,
		PendingInspections: inspectionStats.ScheduledInspections,
		OverduePayments:    0, // TODO: Implement payment tracking
		ExpiringLeases:     0, // TODO: Implement lease tracking
	}, nil
}

// GetRevenueAnalytics returns revenue analytics for a landlord
func (s *LandlordService) GetRevenueAnalytics(ctx context.Context, landlordID uuid.UUID, period string) (*port.RevenueAnalytics, error) {
	// Get revenue stats from repository
	revenueStats, err := s.landlordRepo.GetRevenueStats(ctx, landlordID, period)
	if err != nil {
		return nil, err
	}

	// Get property rankings
	properties, err := s.propertyRepo.GetPropertiesByOwner(ctx, landlordID, 10, 0)
	if err != nil {
		return nil, err
	}

	// Build property revenue rankings
	var topPerformingProperties []port.PropertyRevenueRanking
	for i, property := range properties {
		// Get units for this property
		units, err := s.unitRepo.GetUnitsByProperty(ctx, property.ID, 100, 0)
		if err != nil {
			continue
		}

		// Calculate property revenue
		propertyRevenue := 0.0
		occupiedUnits := 0
		for _, unit := range units {
			if unit.IsOccupied() {
				propertyRevenue += unit.RentAmount
				occupiedUnits++
			}
		}

		// Calculate occupancy rate
		occupancyRate := 0.0
		if len(units) > 0 {
			occupancyRate = float64(occupiedUnits) / float64(len(units)) * 100
		}

		topPerformingProperties = append(topPerformingProperties, port.PropertyRevenueRanking{
			PropertyID:    property.ID,
			PropertyName:  property.Name,
			Revenue:       propertyRevenue,
			OccupancyRate: occupancyRate,
			Rank:          i + 1,
		})
	}

	return &port.RevenueAnalytics{
		Period:                  revenueStats.Period,
		TotalRevenue:            revenueStats.TotalRevenue,
		PotentialRevenue:        revenueStats.PotentialRevenue,
		RevenueEfficiency:       revenueStats.RevenueEfficiency,
		RevenueByMonth:          revenueStats.RevenueByMonth,
		RevenueByProperty:       revenueStats.RevenueByProperty,
		RevenueByUnitType:       revenueStats.RevenueByUnitType,
		TopPerformingProperties: topPerformingProperties,
	}, nil
}

// GetOccupancyAnalytics returns occupancy analytics for a landlord
func (s *LandlordService) GetOccupancyAnalytics(ctx context.Context, landlordID uuid.UUID) (*port.OccupancyAnalytics, error) {
	// Get occupancy stats from repository
	occupancyStats, err := s.landlordRepo.GetOccupancyStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Get properties for vacancy analysis
	properties, err := s.propertyRepo.GetPropertiesByOwner(ctx, landlordID, 100, 0)
	if err != nil {
		return nil, err
	}

	// Build vacancy analysis
	var vacancyAnalysis []port.VacancyAnalysis
	for _, property := range properties {
		units, err := s.unitRepo.GetUnitsByProperty(ctx, property.ID, 100, 0)
		if err != nil {
			continue
		}

		for _, unit := range units {
			if unit.IsVacant() {
				// Calculate days vacant (simplified)
				daysVacant := 30 // TODO: Implement actual vacancy tracking
				potentialLoss := unit.RentAmount * float64(daysVacant) / 30

				vacancyAnalysis = append(vacancyAnalysis, port.VacancyAnalysis{
					PropertyID:    property.ID,
					PropertyName:  property.Name,
					UnitID:        unit.ID,
					UnitNumber:    unit.UnitNumber,
					DaysVacant:    daysVacant,
					PotentialLoss: potentialLoss,
					LastTenant:    nil, // TODO: Implement tenant history
				})
			}
		}
	}

	return &port.OccupancyAnalytics{
		OverallOccupancyRate: occupancyStats.OccupancyRate,
		OccupancyByProperty:  occupancyStats.ByProperty,
		OccupancyByUnitType:  occupancyStats.ByUnitType,
		OccupancyTrend:       occupancyStats.Trend,
		VacancyAnalysis:      vacancyAnalysis,
	}, nil
}

// GetLandlordProperties returns properties owned by a landlord
func (s *LandlordService) GetLandlordProperties(ctx context.Context, landlordID uuid.UUID, filters port.LandlordPropertyFilters) (*port.PropertyListResponse, error) {
	// Convert to generic PropertyFilters for repository
	repoFilters := port.PropertyFilters{
		OwnerID:     &landlordID,
		SearchQuery: filters.SearchQuery,
		SortBy:      filters.SortBy,
		SortOrder:   filters.SortOrder,
		Limit:       filters.Limit,
		Offset:      filters.Offset,
	}

	// Convert status if provided
	if filters.Status != nil {
		propertyStatus := domain.PropertyStatus(*filters.Status)
		repoFilters.Status = &propertyStatus
	}

	// Get properties from repository
	properties, err := s.propertyRepo.SearchProperties(ctx, repoFilters)
	if err != nil {
		return nil, err
	}

	// Get total count
	total, err := s.propertyRepo.GetPropertiesCount(ctx, repoFilters)
	if err != nil {
		return nil, err
	}

	// Calculate pagination
	totalPages := (total + filters.Limit - 1) / filters.Limit
	currentPage := (filters.Offset / filters.Limit) + 1

	return &port.PropertyListResponse{
		Properties: properties,
		Total:      total,
		Page:       currentPage,
		PerPage:    filters.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetPropertySummary returns a detailed summary of a property
func (s *LandlordService) GetPropertySummary(ctx context.Context, propertyID uuid.UUID, landlordID uuid.UUID) (*port.LandlordPropertySummary, error) {
	// Get property
	property, err := s.propertyRepo.GetPropertyByID(ctx, propertyID)
	if err != nil {
		return nil, err
	}

	// Verify ownership
	if property.OwnerID != landlordID {
		return nil, errors.New("unauthorized: You don't have permission to access this property")
	}

	// Get units for this property
	units, err := s.unitRepo.GetUnitsByProperty(ctx, propertyID, 100, 0)
	if err != nil {
		return nil, err
	}

	// Calculate occupancy rate
	occupiedUnits := 0
	monthlyRevenue := 0.0
	for _, unit := range units {
		if unit.IsOccupied() {
			occupiedUnits++
			monthlyRevenue += unit.RentAmount
		}
	}

	occupancyRate := 0.0
	if len(units) > 0 {
		occupancyRate = float64(occupiedUnits) / float64(len(units)) * 100
	}

	// Get recent activities
	activities, err := s.landlordRepo.GetRecentActivities(ctx, landlordID, 5)
	if err != nil {
		return nil, err
	}

	// Filter activities for this property
	var propertyActivities []*port.LandlordActivity
	for _, activity := range activities {
		if activity.PropertyID != nil && *activity.PropertyID == propertyID {
			propertyActivities = append(propertyActivities, activity)
		}
	}

	return &port.LandlordPropertySummary{
		Property:           property,
		Units:              units,
		OccupancyRate:      occupancyRate,
		MonthlyRevenue:     monthlyRevenue,
		PendingMaintenance: 0, // TODO: Implement maintenance tracking
		RecentActivities:   propertyActivities,
	}, nil
}

// GetLandlordTenants returns tenants associated with a landlord's properties
func (s *LandlordService) GetLandlordTenants(ctx context.Context, landlordID uuid.UUID, filters port.LandlordTenantFilters) (*port.TenantListResponse, error) {
	// Get properties owned by landlord
	properties, err := s.propertyRepo.GetPropertiesByOwner(ctx, landlordID, 100, 0)
	if err != nil {
		return nil, err
	}

	// Get all units for these properties
	var allUnits []*domain.Unit
	for _, property := range properties {
		// Filter by property if specified
		if filters.PropertyID != nil && property.ID != *filters.PropertyID {
			continue
		}

		units, err := s.unitRepo.GetUnitsByProperty(ctx, property.ID, 100, 0)
		if err != nil {
			continue
		}

		// Filter by unit if specified
		if filters.UnitID != nil {
			var filteredUnits []*domain.Unit
			for _, unit := range units {
				if unit.ID == *filters.UnitID {
					filteredUnits = append(filteredUnits, unit)
				}
			}
			units = filteredUnits
		}

		allUnits = append(allUnits, units...)
	}

	// Get tenants from occupied units
	var tenants []*domain.User
	tenantMap := make(map[uuid.UUID]bool) // To avoid duplicates

	for _, unit := range allUnits {
		if unit.CurrentTenantID != nil && !tenantMap[*unit.CurrentTenantID] {
			tenant, err := s.userRepo.GetByID(ctx, *unit.CurrentTenantID)
			if err != nil {
				continue
			}
			tenants = append(tenants, tenant)
			tenantMap[*unit.CurrentTenantID] = true
		}
	}

	// Apply filters
	var filteredTenants []*domain.User
	for _, tenant := range tenants {
		// Apply search query filter
		if filters.SearchQuery != nil && *filters.SearchQuery != "" {
			searchQuery := strings.ToLower(*filters.SearchQuery)
			if !strings.Contains(strings.ToLower(tenant.FirstName), searchQuery) &&
				!strings.Contains(strings.ToLower(tenant.LastName), searchQuery) &&
				!strings.Contains(strings.ToLower(tenant.Email), searchQuery) {
				continue
			}
		}

		// Apply status filter (tenant status)
		if filters.Status != nil && *filters.Status != "" && *filters.Status != "all" {
			// For now, we'll use a simple mapping. In a real implementation,
			// you'd need to get lease status from the lease/unit relationship
			if !s.matchesTenantStatus(tenant, *filters.Status) {
				continue
			}
		}

		// Apply payment status filter
		if filters.PaymentStatus != nil && *filters.PaymentStatus != "" && *filters.PaymentStatus != "all" {
			// For now, we'll use a simple mapping. In a real implementation,
			// you'd need to get payment status from payment records
			if !s.matchesPaymentStatus(ctx, tenant.ID, *filters.PaymentStatus) {
				continue
			}
		}

		// Apply lease status filter
		if filters.LeaseStatus != nil && *filters.LeaseStatus != "" && *filters.LeaseStatus != "all" {
			// In a real implementation, you'd check the actual lease status
			if !s.matchesLeaseStatus(ctx, tenant.ID, *filters.LeaseStatus) {
				continue
			}
		}

		filteredTenants = append(filteredTenants, tenant)
	}

	// Apply sorting
	if filters.SortBy != nil && *filters.SortBy != "" {
		s.sortTenants(filteredTenants, *filters.SortBy, filters.SortOrder)
	}

	// Apply pagination
	total := len(filteredTenants)
	start := filters.Offset
	end := start + filters.Limit
	if end > total {
		end = total
	}
	if start > total {
		start = total
	}

	paginatedTenants := filteredTenants[start:end]

	return &port.TenantListResponse{
		Tenants:    paginatedTenants,
		Total:      total,
		Page:       (filters.Offset / filters.Limit) + 1,
		PerPage:    filters.Limit,
		TotalPages: (total + filters.Limit - 1) / filters.Limit,
	}, nil
}

// Helper method to check tenant status
func (s *LandlordService) matchesTenantStatus(tenant *domain.User, status string) bool {
	// Simple implementation - in reality, you'd check lease dates, etc.
	switch status {
	case "active":
		return tenant.Status == domain.StatusActive
	case "inactive":
		return tenant.Status == domain.StatusInactive
	case "expiring":
		// Would need to check lease end dates
		return true // Placeholder
	default:
		return true
	}
}

// Helper method to check payment status
func (s *LandlordService) matchesPaymentStatus(ctx context.Context, tenantID uuid.UUID, paymentStatus string) bool {
	// Simple implementation - in reality, you'd check actual payment records
	// This is a placeholder that would need to be implemented with real payment data
	switch paymentStatus {
	case "paid", "pending", "overdue":
		// For demo purposes, distribute tenants across statuses
		// In reality, you'd query payment records
		return true // Placeholder - would check actual payment status
	default:
		return true
	}
}

// Helper method to check lease status
func (s *LandlordService) matchesLeaseStatus(ctx context.Context, tenantID uuid.UUID, leaseStatus string) bool {
	// Simple implementation - in reality, you'd check lease records
	switch leaseStatus {
	case "active", "expiring", "expired":
		return true // Placeholder - would check actual lease status
	default:
		return true
	}
}

// Helper method to sort tenants
func (s *LandlordService) sortTenants(tenants []*domain.User, sortBy string, sortOrder *string) {
	// Simple implementation - would implement actual sorting logic
	// This is a placeholder for demonstration
}

// GetTenantSummary returns a detailed summary of a tenant
func (s *LandlordService) GetTenantSummary(ctx context.Context, tenantID uuid.UUID, landlordID uuid.UUID) (*port.TenantSummary, error) {
	// Get tenant
	tenant, err := s.userRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Get current unit and property
	units, err := s.unitRepo.GetUnitsByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var currentUnit *domain.Unit
	var currentProperty *domain.Property

	if len(units) > 0 {
		currentUnit = units[0] // Assume first unit is current
		currentProperty, err = s.propertyRepo.GetPropertyByID(ctx, currentUnit.PropertyID)
		if err != nil {
			return nil, err
		}

		// Verify ownership
		if currentProperty.OwnerID != landlordID {
			return nil, errors.New("unauthorized: You don't have permission to access this tenant")
		}
	}

	// Build lease info
	var leaseInfo *port.LeaseInfo
	if currentUnit != nil && currentUnit.LeaseStartDate != nil && currentUnit.LeaseEndDate != nil {
		daysRemaining := int(currentUnit.LeaseEndDate.Sub(time.Now()).Hours() / 24)
		leaseInfo = &port.LeaseInfo{
			LeaseID:       uuid.New(), // TODO: Get actual lease ID
			StartDate:     *currentUnit.LeaseStartDate,
			EndDate:       *currentUnit.LeaseEndDate,
			RentAmount:    currentUnit.RentAmount,
			Status:        "active", // TODO: Implement lease status logic
			DaysRemaining: daysRemaining,
		}
	}

	// Get payment history
	payments, err := s.landlordRepo.GetRecentPayments(ctx, landlordID, 10)
	if err != nil {
		return nil, err
	}

	// Filter payments for this tenant (simplified - PaymentRecord doesn't have TenantID)
	// TODO: Implement proper tenant payment filtering when PaymentRecord is enhanced
	var tenantPayments []*port.PaymentRecord
	// For now, just return all payments since we can't filter by tenant
	tenantPayments = payments

	// Get maintenance history
	maintenance, err := s.landlordRepo.GetRecentMaintenance(ctx, landlordID, 10)
	if err != nil {
		return nil, err
	}

	// Filter maintenance for this tenant
	var tenantMaintenance []*port.MaintenanceRecord
	for _, record := range maintenance {
		if record.TenantID != nil && *record.TenantID == tenantID {
			tenantMaintenance = append(tenantMaintenance, record)
		}
	}

	return &port.TenantSummary{
		Tenant:             tenant,
		CurrentUnit:        currentUnit,
		CurrentProperty:    currentProperty,
		LeaseInfo:          leaseInfo,
		PaymentHistory:     tenantPayments,
		MaintenanceHistory: tenantMaintenance,
	}, nil
}

// GetFinancialOverview returns financial overview for a landlord
func (s *LandlordService) GetFinancialOverview(ctx context.Context, landlordID uuid.UUID) (*port.FinancialOverview, error) {
	// Get unit stats
	unitStats, err := s.unitRepo.GetUnitStats(ctx, nil, &landlordID)
	if err != nil {
		return nil, err
	}

	// Calculate financial metrics
	totalRevenue := unitStats.TotalMonthlyRevenue
	potentialRevenue := unitStats.PotentialRevenue
	revenueEfficiency := unitStats.RevenueEfficiency
	overduePayments := 0.0 // TODO: Implement overdue payment tracking

	// Build monthly trend (simplified)
	var monthlyTrend []port.MonthlyFinancialData
	currentMonth := time.Now()
	for i := 0; i < 12; i++ {
		month := currentMonth.AddDate(0, -i, 0)
		monthlyTrend = append([]port.MonthlyFinancialData{{
			Month:            month.Format("2006-01"),
			Revenue:          totalRevenue * 0.9, // Simplified: assume 90% collection
			PotentialRevenue: totalRevenue,
			OccupancyRate:    unitStats.OccupancyRate,
		}}, monthlyTrend...)
	}

	// Build property breakdown
	properties, err := s.propertyRepo.GetPropertiesByOwner(ctx, landlordID, 100, 0)
	if err != nil {
		return nil, err
	}

	var propertyBreakdown []port.PropertyFinancialData
	for _, property := range properties {
		units, err := s.unitRepo.GetUnitsByProperty(ctx, property.ID, 100, 0)
		if err != nil {
			continue
		}

		propertyRevenue := 0.0
		occupiedUnits := 0
		for _, unit := range units {
			if unit.IsOccupied() {
				propertyRevenue += unit.RentAmount
				occupiedUnits++
			}
		}

		occupancyRate := 0.0
		if len(units) > 0 {
			occupancyRate = float64(occupiedUnits) / float64(len(units)) * 100
		}

		propertyBreakdown = append(propertyBreakdown, port.PropertyFinancialData{
			PropertyID:       property.ID,
			PropertyName:     property.Name,
			Revenue:          propertyRevenue,
			PotentialRevenue: propertyRevenue / occupancyRate * 100, // Estimate potential
			OccupancyRate:    occupancyRate,
		})
	}

	return &port.FinancialOverview{
		TotalRevenue:      totalRevenue,
		PotentialRevenue:  potentialRevenue,
		RevenueEfficiency: revenueEfficiency,
		OverduePayments:   overduePayments,
		MonthlyTrend:      monthlyTrend,
		PropertyBreakdown: propertyBreakdown,
	}, nil
}

// GetPaymentHistory returns payment history for a landlord
func (s *LandlordService) GetPaymentHistory(ctx context.Context, landlordID uuid.UUID, filters port.PaymentFilters) (*port.LandlordPaymentHistoryResponse, error) {
	// Get recent payments
	payments, err := s.landlordRepo.GetRecentPayments(ctx, landlordID, 100)
	if err != nil {
		return nil, err
	}

	// Convert PaymentRecord to LandlordPaymentRecord and apply filters
	var filteredPayments []*port.LandlordPaymentRecord
	for _, payment := range payments {
		// Convert to LandlordPaymentRecord (using available fields only)
		landlordPayment := &port.LandlordPaymentRecord{
			ID:            uuid.New(), // Generate new ID since PaymentRecord doesn't have one
			Amount:        payment.Amount,
			PaymentMethod: payment.PaymentMethod,
			PaymentDate:   payment.PaymentDate,
			Reference:     payment.Reference,
			Notes:         payment.Notes,
			CreatedAt:     payment.PaymentDate, // Use PaymentDate as CreatedAt
			// TODO: Map additional fields from payment record if available
		}

		// Apply filters (simplified implementation - most filters can't be applied without the extended fields)
		// Filter by amount range
		if filters.MinAmount != nil && payment.Amount < *filters.MinAmount {
			continue
		}
		if filters.MaxAmount != nil && payment.Amount > *filters.MaxAmount {
			continue
		}

		// Filter by date range
		if filters.DateFrom != nil && payment.PaymentDate.Before(*filters.DateFrom) {
			continue
		}
		if filters.DateTo != nil && payment.PaymentDate.After(*filters.DateTo) {
			continue
		}

		filteredPayments = append(filteredPayments, landlordPayment)
	}

	// Apply pagination
	start := filters.Offset
	end := start + filters.Limit
	if end > len(filteredPayments) {
		end = len(filteredPayments)
	}
	if start > len(filteredPayments) {
		start = len(filteredPayments)
	}

	paginatedPayments := filteredPayments[start:end]

	return &port.LandlordPaymentHistoryResponse{
		Payments:   paginatedPayments,
		Total:      len(filteredPayments),
		Page:       (filters.Offset / filters.Limit) + 1,
		PerPage:    filters.Limit,
		TotalPages: (len(filteredPayments) + filters.Limit - 1) / filters.Limit,
	}, nil
}

// GetRentCollectionStats returns rent collection statistics
func (s *LandlordService) GetRentCollectionStats(ctx context.Context, landlordID uuid.UUID, period string) (*port.RentCollectionStats, error) {
	// Get unit stats
	unitStats, err := s.unitRepo.GetUnitStats(ctx, nil, &landlordID)
	if err != nil {
		return nil, err
	}

	// Calculate collection metrics
	totalExpected := unitStats.TotalMonthlyRevenue
	totalCollected := totalExpected * 0.95 // Assume 95% collection rate
	collectionRate := 95.0
	overdueAmount := totalExpected - totalCollected
	overdueCount := 2 // TODO: Implement actual overdue tracking

	// Build monthly collection data
	var collectionByMonth []port.MonthlyCollectionData
	currentMonth := time.Now()
	for i := 0; i < 12; i++ {
		month := currentMonth.AddDate(0, -i, 0)
		collected := totalCollected * 0.9 // Assume some variation
		expected := totalExpected
		monthlyRate := (collected / expected) * 100

		collectionByMonth = append([]port.MonthlyCollectionData{{
			Month:          month.Format("2006-01"),
			Collected:      collected,
			Expected:       expected,
			CollectionRate: monthlyRate,
		}}, collectionByMonth...)
	}

	return &port.RentCollectionStats{
		Period:            period,
		TotalCollected:    totalCollected,
		TotalExpected:     totalExpected,
		CollectionRate:    collectionRate,
		OverdueAmount:     overdueAmount,
		OverdueCount:      overdueCount,
		CollectionByMonth: collectionByMonth,
	}, nil
}

// GetMaintenanceOverview returns maintenance overview for a landlord
func (s *LandlordService) GetMaintenanceOverview(ctx context.Context, landlordID uuid.UUID) (*port.MaintenanceOverview, error) {
	// Get maintenance stats
	stats, err := s.landlordRepo.GetMaintenanceStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Get recent maintenance requests
	recentRequests, err := s.landlordRepo.GetRecentMaintenance(ctx, landlordID, 10)
	if err != nil {
		return nil, err
	}

	return &port.MaintenanceOverview{
		TotalRequests:     stats.TotalRequests,
		PendingRequests:   stats.PendingRequests,
		CompletedRequests: stats.CompletedRequests,
		AverageResolution: stats.AverageResolution,
		ByPriority:        stats.ByPriority,
		ByCategory:        stats.ByCategory,
		RecentRequests:    recentRequests,
	}, nil
}

// GetMaintenanceRequests returns maintenance requests for a landlord
func (s *LandlordService) GetMaintenanceRequests(ctx context.Context, landlordID uuid.UUID, filters port.LandlordMaintenanceFilters) (*port.MaintenanceListResponse, error) {
	// Get recent maintenance
	maintenance, err := s.landlordRepo.GetRecentMaintenance(ctx, landlordID, 100)
	if err != nil {
		return nil, err
	}

	// Apply filters (simplified implementation)
	var filteredMaintenance []*port.MaintenanceRecord
	for _, record := range maintenance {
		// Filter by property
		if filters.PropertyID != nil && record.PropertyID != *filters.PropertyID {
			continue
		}

		// Filter by unit
		if filters.UnitID != nil && (record.UnitID == nil || *record.UnitID != *filters.UnitID) {
			continue
		}

		// Filter by tenant
		if filters.TenantID != nil && (record.TenantID == nil || *record.TenantID != *filters.TenantID) {
			continue
		}

		// Filter by category
		if filters.Category != nil && record.Category != *filters.Category {
			continue
		}

		// Filter by priority
		if filters.Priority != nil && record.Priority != *filters.Priority {
			continue
		}

		// Filter by status
		if filters.Status != nil && record.Status != *filters.Status {
			continue
		}

		// Filter by date range
		if filters.DateFrom != nil && record.CreatedAt.Before(*filters.DateFrom) {
			continue
		}
		if filters.DateTo != nil && record.CreatedAt.After(*filters.DateTo) {
			continue
		}

		filteredMaintenance = append(filteredMaintenance, record)
	}

	// Apply pagination
	start := filters.Offset
	end := start + filters.Limit
	if end > len(filteredMaintenance) {
		end = len(filteredMaintenance)
	}
	if start > len(filteredMaintenance) {
		start = len(filteredMaintenance)
	}

	paginatedMaintenance := filteredMaintenance[start:end]

	return &port.MaintenanceListResponse{
		Maintenance: paginatedMaintenance,
		Total:       len(filteredMaintenance),
		Page:        (filters.Offset / filters.Limit) + 1,
		PerPage:     filters.Limit,
		TotalPages:  (len(filteredMaintenance) + filters.Limit - 1) / filters.Limit,
	}, nil
}

// GetInspectionOverview returns inspection overview for a landlord
func (s *LandlordService) GetInspectionOverview(ctx context.Context, landlordID uuid.UUID) (*port.InspectionOverview, error) {
	// Get inspection stats
	stats, err := s.landlordRepo.GetInspectionStats(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Get recent inspections
	recentInspections, err := s.landlordRepo.GetRecentInspections(ctx, landlordID, 10)
	if err != nil {
		return nil, err
	}

	return &port.InspectionOverview{
		TotalInspections:     stats.TotalInspections,
		ScheduledInspections: stats.ScheduledInspections,
		CompletedInspections: stats.CompletedInspections,
		OverdueInspections:   stats.OverdueInspections,
		AverageRating:        stats.AverageRating,
		ByStatus:             stats.ByStatus,
		RecentInspections:    recentInspections,
	}, nil
}

// GetInspectionSchedule returns inspection schedule for a landlord
func (s *LandlordService) GetInspectionSchedule(ctx context.Context, landlordID uuid.UUID, filters port.InspectionFilters) (*port.InspectionListResponse, error) {
	// Get recent inspections
	inspections, err := s.landlordRepo.GetRecentInspections(ctx, landlordID, 100)
	if err != nil {
		return nil, err
	}

	// Apply filters (simplified implementation)
	var filteredInspections []*port.InspectionRecord
	for _, inspection := range inspections {
		// Filter by property
		if filters.PropertyID != nil && inspection.PropertyID != *filters.PropertyID {
			continue
		}

		// Filter by unit
		if filters.UnitID != nil && (inspection.UnitID == nil || *inspection.UnitID != *filters.UnitID) {
			continue
		}

		// Filter by inspection type
		if filters.InspectionType != nil && inspection.InspectionType != *filters.InspectionType {
			continue
		}

		// Filter by status
		if filters.Status != nil && inspection.Status != *filters.Status {
			continue
		}

		// Filter by date range
		if filters.DateFrom != nil && inspection.ScheduledDate.Before(*filters.DateFrom) {
			continue
		}
		if filters.DateTo != nil && inspection.ScheduledDate.After(*filters.DateTo) {
			continue
		}

		filteredInspections = append(filteredInspections, inspection)
	}

	// Apply pagination
	start := filters.Offset
	end := start + filters.Limit
	if end > len(filteredInspections) {
		end = len(filteredInspections)
	}
	if start > len(filteredInspections) {
		start = len(filteredInspections)
	}

	paginatedInspections := filteredInspections[start:end]

	return &port.InspectionListResponse{
		Inspections: paginatedInspections,
		Total:       len(filteredInspections),
		Page:        (filters.Offset / filters.Limit) + 1,
		PerPage:     filters.Limit,
		TotalPages:  (len(filteredInspections) + filters.Limit - 1) / filters.Limit,
	}, nil
}

// GetCommunicationOverview returns communication overview for a landlord
func (s *LandlordService) GetCommunicationOverview(ctx context.Context, landlordID uuid.UUID) (*port.CommunicationOverview, error) {
	// TODO: Implement communication tracking
	return &port.CommunicationOverview{
		TotalMessages:  0,
		UnreadMessages: 0,
		UrgentMessages: 0,
		ByPriority:     make(map[string]int),
		ByType:         make(map[string]int),
		RecentMessages: []interface{}{},
	}, nil
}

// GetMessages returns messages for a landlord
func (s *LandlordService) GetMessages(ctx context.Context, landlordID uuid.UUID, filters port.MessageFilters) (*port.MessageListResponse, error) {
	// TODO: Implement message retrieval
	return &port.MessageListResponse{
		Messages:   []interface{}{},
		Total:      0,
		Page:       1,
		PerPage:    filters.Limit,
		TotalPages: 0,
	}, nil
}

// GeneratePropertyReport generates a property report
func (s *LandlordService) GeneratePropertyReport(ctx context.Context, landlordID uuid.UUID, reportType string, filters port.ReportFilters) (*port.PropertyReport, error) {
	// TODO: Implement report generation
	return &port.PropertyReport{
		ReportID:    uuid.New().String(),
		ReportType:  reportType,
		GeneratedAt: time.Now(),
		Period:      "current",
		Summary:     make(map[string]interface{}),
		Data:        nil,
		Charts:      []port.ChartData{},
		DownloadURL: nil,
	}, nil
}

// GenerateFinancialReport generates a financial report
func (s *LandlordService) GenerateFinancialReport(ctx context.Context, landlordID uuid.UUID, reportType string, period string) (*port.FinancialReport, error) {
	// TODO: Implement financial report generation
	return &port.FinancialReport{
		ReportID:    uuid.New().String(),
		ReportType:  reportType,
		GeneratedAt: time.Now(),
		Period:      period,
		Summary:     make(map[string]interface{}),
		Data:        nil,
		Charts:      []port.ChartData{},
		DownloadURL: nil,
	}, nil
}

// GenerateOccupancyReport generates an occupancy report
func (s *LandlordService) GenerateOccupancyReport(ctx context.Context, landlordID uuid.UUID, period string) (*port.OccupancyReport, error) {
	// TODO: Implement occupancy report generation
	return &port.OccupancyReport{
		PropertyID:    uuid.New(),
		ReportDate:    time.Now().Format("2006-01-02"),
		OccupancyRate: 0.0,
		UnitsOccupied: 0,
		UnitsVacant:   0,
		UnitsTotal:    0,
		VacancyTrend:  []port.OccupancyDataPoint{},
		UnitTurnover:  []port.UnitTurnoverInfo{},
	}, nil
}

// GetNotifications returns notifications for a landlord
func (s *LandlordService) GetNotifications(ctx context.Context, landlordID uuid.UUID, limit, offset int) (*port.NotificationListResponse, error) {
	// Get notifications from repository
	notifications, err := s.landlordRepo.GetNotifications(ctx, landlordID, limit, offset)
	if err != nil {
		return nil, err
	}

	// Get total count
	total, err := s.landlordRepo.GetUnreadNotificationCount(ctx, landlordID)
	if err != nil {
		return nil, err
	}

	// Calculate pagination
	totalPages := (total + limit - 1) / limit
	currentPage := (offset / limit) + 1

	return &port.NotificationListResponse{
		Notifications: notifications,
		Total:         total,
		Page:          currentPage,
		PerPage:       limit,
		TotalPages:    totalPages,
	}, nil
}

// MarkNotificationAsRead marks a notification as read
func (s *LandlordService) MarkNotificationAsRead(ctx context.Context, notificationID uuid.UUID, landlordID uuid.UUID) error {
	return s.landlordRepo.MarkNotificationAsRead(ctx, notificationID)
}

// GetUnreadNotificationCount returns the count of unread notifications
func (s *LandlordService) GetUnreadNotificationCount(ctx context.Context, landlordID uuid.UUID) (int, error) {
	return s.landlordRepo.GetUnreadNotificationCount(ctx, landlordID)
}
