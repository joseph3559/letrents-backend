package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
)

type propertyService struct {
	propertyRepo port.PropertyRepository
	unitRepo     port.UnitRepository
	userRepo     port.UserRepository
}

// NewPropertyService creates a new property service
func NewPropertyService(
	propertyRepo port.PropertyRepository,
	unitRepo port.UnitRepository,
	userRepo port.UserRepository,
) port.PropertyService {
	return &propertyService{
		propertyRepo: propertyRepo,
		unitRepo:     unitRepo,
		userRepo:     userRepo,
	}
}

func (s *propertyService) CreateProperty(ctx context.Context, req *port.CreatePropertyRequest) (*domain.Property, error) {
	// Validate request
	if err := s.validateCreatePropertyRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Check if owner exists and has permission
	owner, err := s.userRepo.GetByID(ctx, req.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("owner not found: %w", err)
	}

	if !owner.CanManageProperties() {
		return nil, fmt.Errorf("user does not have permission to own properties")
	}

	// Create property domain object
	property := &domain.Property{
		Name:                req.Name,
		Type:                req.Type,
		Description:         req.Description,
		Street:              req.Street,
		City:                req.City,
		Region:              req.Region,
		Country:             req.Country,
		PostalCode:          req.PostalCode,
		Latitude:            req.Latitude,
		Longitude:           req.Longitude,
		OwnershipType:       req.OwnershipType,
		OwnerID:             req.OwnerID,
		AgencyID:            req.AgencyID,
		NumberOfUnits:       req.NumberOfUnits,
		NumberOfBlocks:      req.NumberOfBlocks,
		NumberOfFloors:      req.NumberOfFloors,
		ServiceChargeRate:   req.ServiceChargeRate,
		ServiceChargeType:   req.ServiceChargeType,
		Amenities:           req.Amenities,
		AccessControl:       req.AccessControl,
		MaintenanceSchedule: req.MaintenanceSchedule,
		Status:              domain.PropertyStatusActive,
		YearBuilt:           req.YearBuilt,
		Documents:           []string{},
		Images:              []string{},
		CreatedBy:           req.OwnerID, // Assuming the owner is creating it
	}

	// Save to repository
	err = s.propertyRepo.CreateProperty(ctx, property)
	if err != nil {
		return nil, fmt.Errorf("failed to create property: %w", err)
	}

	return property, nil
}

func (s *propertyService) GetProperty(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Property, error) {
	property, err := s.propertyRepo.GetPropertyByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	// Check if user has permission to view this property
	if err := s.checkPropertyAccess(ctx, property, userID, "view"); err != nil {
		return nil, err
	}

	return property, nil
}

func (s *propertyService) UpdateProperty(ctx context.Context, id uuid.UUID, req *port.UpdatePropertyRequest, userID uuid.UUID) (*domain.Property, error) {
	// Get existing property
	property, err := s.propertyRepo.GetPropertyByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	// Check permissions
	if err := s.checkPropertyAccess(ctx, property, userID, "update"); err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.Name != nil {
		property.Name = *req.Name
	}
	if req.Description != nil {
		property.Description = req.Description
	}
	if req.Street != nil {
		property.Street = *req.Street
	}
	if req.City != nil {
		property.City = *req.City
	}
	if req.Region != nil {
		property.Region = *req.Region
	}
	if req.Country != nil {
		property.Country = *req.Country
	}
	if req.PostalCode != nil {
		property.PostalCode = req.PostalCode
	}
	if req.Latitude != nil {
		property.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		property.Longitude = req.Longitude
	}
	if req.NumberOfBlocks != nil {
		property.NumberOfBlocks = req.NumberOfBlocks
	}
	if req.NumberOfFloors != nil {
		property.NumberOfFloors = req.NumberOfFloors
	}
	if req.ServiceChargeRate != nil {
		property.ServiceChargeRate = req.ServiceChargeRate
	}
	if req.ServiceChargeType != nil {
		property.ServiceChargeType = req.ServiceChargeType
	}
	if req.Amenities != nil {
		property.Amenities = req.Amenities
	}
	if req.AccessControl != nil {
		property.AccessControl = req.AccessControl
	}
	if req.MaintenanceSchedule != nil {
		property.MaintenanceSchedule = req.MaintenanceSchedule
	}
	if req.Status != nil {
		property.Status = *req.Status
	}
	if req.YearBuilt != nil {
		property.YearBuilt = req.YearBuilt
	}

	// Save updates
	err = s.propertyRepo.UpdateProperty(ctx, property)
	if err != nil {
		return nil, fmt.Errorf("failed to update property: %w", err)
	}

	return property, nil
}

func (s *propertyService) DeleteProperty(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	// Get existing property
	property, err := s.propertyRepo.GetPropertyByID(ctx, id)
	if err != nil {
		return fmt.Errorf("property not found: %w", err)
	}

	// Check permissions
	if err := s.checkPropertyAccess(ctx, property, userID, "delete"); err != nil {
		return err
	}

	// Check if property has active tenants
	occupiedStatus := domain.UnitStatusOccupied
	unitFilters := port.UnitFilters{
		PropertyID: &id,
		Status:     &occupiedStatus,
		Limit:      1,
	}

	occupiedUnits, err := s.unitRepo.SearchUnits(ctx, unitFilters)
	if err != nil {
		return fmt.Errorf("failed to check occupied units: %w", err)
	}

	if len(occupiedUnits) > 0 {
		return fmt.Errorf("cannot delete property with occupied units")
	}

	// Delete property
	err = s.propertyRepo.DeleteProperty(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete property: %w", err)
	}

	return nil
}

func (s *propertyService) ListProperties(ctx context.Context, filters port.PropertyFilters, userID uuid.UUID) (*port.PropertyListResponse, error) {
	// Get user to check permissions
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Apply user-based filters
	filters = s.applyUserFilters(filters, user)

	// Get properties
	properties, err := s.propertyRepo.SearchProperties(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to search properties: %w", err)
	}

	// Get total count
	totalCount, err := s.propertyRepo.GetPropertiesCount(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to get properties count: %w", err)
	}

	// Calculate pagination
	page := (filters.Offset / filters.Limit) + 1
	totalPages := int(math.Ceil(float64(totalCount) / float64(filters.Limit)))

	return &port.PropertyListResponse{
		Properties: properties,
		Total:      totalCount,
		Page:       page,
		PerPage:    filters.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *propertyService) GetPropertyAnalytics(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID) (*port.PropertyAnalytics, error) {
	// Check access
	property, err := s.propertyRepo.GetPropertyByID(ctx, propertyID)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	if err := s.checkPropertyAccess(ctx, property, userID, "view"); err != nil {
		return nil, err
	}

	unitStats, err := s.unitRepo.GetUnitStats(ctx, &propertyID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get unit stats: %w", err)
	}

	analytics := &port.PropertyAnalytics{
		PropertyID:          propertyID,
		TotalUnits:          unitStats.TotalUnits,
		OccupiedUnits:       unitStats.OccupiedUnits,
		VacantUnits:         unitStats.VacantUnits,
		OccupancyRate:       unitStats.OccupancyRate,
		TotalMonthlyRevenue: unitStats.TotalMonthlyRevenue,
		PotentialRevenue:    unitStats.PotentialRevenue,
		RevenueEfficiency:   unitStats.RevenueEfficiency,
		AverageRent:         unitStats.AverageRent,
		UnitsByType:         unitStats.UnitsByType,
		UnitsByStatus:       unitStats.UnitsByStatus,
	}

	return analytics, nil
}

func (s *propertyService) GetOccupancyReport(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID) (*port.OccupancyReport, error) {
	// Check access
	property, err := s.propertyRepo.GetPropertyByID(ctx, propertyID)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	if err := s.checkPropertyAccess(ctx, property, userID, "view"); err != nil {
		return nil, err
	}

	// Get current occupancy stats
	unitStats, err := s.unitRepo.GetUnitStats(ctx, &propertyID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get unit stats: %w", err)
	}

	report := &port.OccupancyReport{
		PropertyID:    propertyID,
		ReportDate:    time.Now().Format("2006-01-02"),
		OccupancyRate: unitStats.OccupancyRate,
		UnitsOccupied: unitStats.OccupiedUnits,
		UnitsVacant:   unitStats.VacantUnits,
		UnitsTotal:    unitStats.TotalUnits,
		VacancyTrend:  []port.OccupancyDataPoint{}, // TODO: Implement historical data
		UnitTurnover:  []port.UnitTurnoverInfo{},   // TODO: Implement turnover tracking
	}

	return report, nil
}

func (s *propertyService) GetRevenueReport(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID, period string) (*port.RevenueReport, error) {
	// Check access
	property, err := s.propertyRepo.GetPropertyByID(ctx, propertyID)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	if err := s.checkPropertyAccess(ctx, property, userID, "view"); err != nil {
		return nil, err
	}

	// Get revenue stats
	unitStats, err := s.unitRepo.GetUnitStats(ctx, &propertyID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get unit stats: %w", err)
	}

	// Calculate revenue by unit type
	revenueByUnitType := make(map[domain.UnitType]float64)

	// Get units by property to calculate revenue by type
	occupiedStatus := domain.UnitStatusOccupied
	unitFilters := port.UnitFilters{
		PropertyID: &propertyID,
		Status:     &occupiedStatus,
		Limit:      1000, // Get all units
	}

	units, err := s.unitRepo.SearchUnits(ctx, unitFilters)
	if err != nil {
		return nil, fmt.Errorf("failed to get units: %w", err)
	}

	for _, unit := range units {
		revenueByUnitType[unit.UnitType] += unit.RentAmount
	}

	report := &port.RevenueReport{
		PropertyID:        propertyID,
		Period:            period,
		TotalRevenue:      unitStats.TotalMonthlyRevenue,
		PotentialRevenue:  unitStats.PotentialRevenue,
		RevenueEfficiency: unitStats.RevenueEfficiency,
		RevenueByMonth:    []port.RevenueDataPoint{}, // TODO: Implement historical data
		RevenueByUnitType: revenueByUnitType,
	}

	return report, nil
}

// Helper methods

func (s *propertyService) validateCreatePropertyRequest(req *port.CreatePropertyRequest) error {
	if req.Name == "" {
		return fmt.Errorf("property name is required")
	}
	if req.Street == "" {
		return fmt.Errorf("street address is required")
	}
	if req.City == "" {
		return fmt.Errorf("city is required")
	}
	if req.Region == "" {
		return fmt.Errorf("region is required")
	}
	if req.Country == "" {
		return fmt.Errorf("country is required")
	}
	if req.NumberOfUnits < 1 {
		return fmt.Errorf("number of units must be at least 1")
	}
	if req.OwnerID == uuid.Nil {
		return fmt.Errorf("owner ID is required")
	}

	// Validate property type
	validTypes := []domain.PropertyType{
		domain.PropertyTypeResidential, domain.PropertyTypeCommercial,
		domain.PropertyTypeIndustrial, domain.PropertyTypeMixedUse,
		domain.PropertyTypeInstitutional, domain.PropertyTypeVacantLand,
		domain.PropertyTypeHospitality, domain.PropertyTypeRecreational,
	}

	typeValid := false
	for _, validType := range validTypes {
		if req.Type == validType {
			typeValid = true
			break
		}
	}
	if !typeValid {
		return fmt.Errorf("invalid property type")
	}

	return nil
}

func (s *propertyService) checkPropertyAccess(ctx context.Context, property *domain.Property, userID uuid.UUID, action string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Super admin can access everything
	if user.IsSuperAdmin() {
		return nil
	}

	// Owner can access their own properties
	if property.OwnerID == userID {
		return nil
	}

	// Agency admin can access properties managed by their agency
	if user.IsAgencyAdmin() && property.AgencyID != nil && user.AgencyID != nil && *property.AgencyID == *user.AgencyID {
		return nil
	}

	// Agent can access properties managed by their agency (read-only for some actions)
	if user.IsAgent() && property.AgencyID != nil && user.AgencyID != nil && *property.AgencyID == *user.AgencyID {
		if action == "view" {
			return nil
		}
		// Agents might have limited write access based on business rules
	}

	return fmt.Errorf("access denied: insufficient permissions")
}

func (s *propertyService) applyUserFilters(filters port.PropertyFilters, user *domain.User) port.PropertyFilters {
	// Super admin can see everything
	if user.IsSuperAdmin() {
		return filters
	}

	// Landlords see only their properties
	if user.IsLandlord() {
		filters.OwnerID = &user.ID
		return filters
	}

	// Agency users see only properties managed by their agency
	if user.AgencyID != nil && (user.IsAgencyAdmin() || user.IsAgent()) {
		filters.AgencyID = user.AgencyID
		return filters
	}

	// Other users (tenants, caretakers) have no property access by default
	// Return filters that will match no properties
	nilUUID := uuid.Nil
	filters.OwnerID = &nilUUID

	return filters
}
