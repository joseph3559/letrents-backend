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

type unitService struct {
	unitRepo     port.UnitRepository
	propertyRepo port.PropertyRepository
	userRepo     port.UserRepository
}

// NewUnitService creates a new unit service
func NewUnitService(
	unitRepo port.UnitRepository,
	propertyRepo port.PropertyRepository,
	userRepo port.UserRepository,
) port.UnitService {
	return &unitService{
		unitRepo:     unitRepo,
		propertyRepo: propertyRepo,
		userRepo:     userRepo,
	}
}

func (s *unitService) CreateUnit(ctx context.Context, req *port.CreateUnitRequest) (*domain.Unit, error) {
	// Validate request
	if err := s.validateCreateUnitRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Verify property exists and user has access
	property, err := s.propertyRepo.GetPropertyByID(ctx, req.PropertyID)
	if err != nil {
		return nil, fmt.Errorf("property not found: %w", err)
	}

	// Create unit domain object
	unit := &domain.Unit{
		PropertyID:          req.PropertyID,
		UnitNumber:          req.UnitNumber,
		UnitType:            req.UnitType,
		BlockNumber:         req.BlockNumber,
		FloorNumber:         req.FloorNumber,
		SizeSquareFeet:      req.SizeSquareFeet,
		SizeSquareMeters:    req.SizeSquareMeters,
		NumberOfBedrooms:    req.NumberOfBedrooms,
		NumberOfBathrooms:   req.NumberOfBathrooms,
		HasEnsuite:          req.HasEnsuite,
		HasBalcony:          req.HasBalcony,
		HasParking:          req.HasParking,
		ParkingSpaces:       req.ParkingSpaces,
		RentAmount:          req.RentAmount,
		Currency:            req.Currency,
		DepositAmount:       req.DepositAmount,
		DepositMonths:       req.DepositMonths,
		Status:              domain.UnitStatusVacant, // Default to vacant
		Condition:           req.Condition,
		FurnishingType:      req.FurnishingType,
		WaterMeterNumber:    req.WaterMeterNumber,
		ElectricMeterNumber: req.ElectricMeterNumber,
		UtilityBillingType:  req.UtilityBillingType,
		InUnitAmenities:     req.InUnitAmenities,
		Appliances:          req.Appliances,
		Documents:           []string{},
		Images:              []string{},
		CreatedBy:           property.OwnerID, // Use property owner as creator
	}

	// Save to repository
	err = s.unitRepo.CreateUnit(ctx, unit)
	if err != nil {
		return nil, fmt.Errorf("failed to create unit: %w", err)
	}

	return unit, nil
}

func (s *unitService) CreateUnits(ctx context.Context, req *port.CreateUnitsRequest) ([]*domain.Unit, error) {
	if len(req.Units) == 0 {
		return nil, fmt.Errorf("no units provided")
	}

	var units []*domain.Unit

	// Validate all units first
	for i, unitReq := range req.Units {
		if err := s.validateCreateUnitRequest(&unitReq); err != nil {
			return nil, fmt.Errorf("validation failed for unit %d: %w", i+1, err)
		}

		// Get property for each unit (assuming they could be different properties)
		property, err := s.propertyRepo.GetPropertyByID(ctx, unitReq.PropertyID)
		if err != nil {
			return nil, fmt.Errorf("property not found for unit %d: %w", i+1, err)
		}

		unit := &domain.Unit{
			PropertyID:          unitReq.PropertyID,
			UnitNumber:          unitReq.UnitNumber,
			UnitType:            unitReq.UnitType,
			BlockNumber:         unitReq.BlockNumber,
			FloorNumber:         unitReq.FloorNumber,
			SizeSquareFeet:      unitReq.SizeSquareFeet,
			SizeSquareMeters:    unitReq.SizeSquareMeters,
			NumberOfBedrooms:    unitReq.NumberOfBedrooms,
			NumberOfBathrooms:   unitReq.NumberOfBathrooms,
			HasEnsuite:          unitReq.HasEnsuite,
			HasBalcony:          unitReq.HasBalcony,
			HasParking:          unitReq.HasParking,
			ParkingSpaces:       unitReq.ParkingSpaces,
			RentAmount:          unitReq.RentAmount,
			Currency:            unitReq.Currency,
			DepositAmount:       unitReq.DepositAmount,
			DepositMonths:       unitReq.DepositMonths,
			Status:              domain.UnitStatusVacant,
			Condition:           unitReq.Condition,
			FurnishingType:      unitReq.FurnishingType,
			WaterMeterNumber:    unitReq.WaterMeterNumber,
			ElectricMeterNumber: unitReq.ElectricMeterNumber,
			UtilityBillingType:  unitReq.UtilityBillingType,
			InUnitAmenities:     unitReq.InUnitAmenities,
			Appliances:          unitReq.Appliances,
			Documents:           []string{},
			Images:              []string{},
			CreatedBy:           property.OwnerID,
		}

		units = append(units, unit)
	}

	// Save all units
	err := s.unitRepo.CreateUnits(ctx, units)
	if err != nil {
		return nil, fmt.Errorf("failed to create units: %w", err)
	}

	return units, nil
}

func (s *unitService) GetUnit(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Unit, error) {
	unit, err := s.unitRepo.GetUnitByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("unit not found: %w", err)
	}

	// Check if user has permission to view this unit
	if err := s.checkUnitAccess(ctx, unit, userID, "view"); err != nil {
		return nil, err
	}

	return unit, nil
}

func (s *unitService) UpdateUnit(ctx context.Context, id uuid.UUID, req *port.UpdateUnitRequest, userID uuid.UUID) (*domain.Unit, error) {
	// Get existing unit
	unit, err := s.unitRepo.GetUnitByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("unit not found: %w", err)
	}

	// Check permissions
	if err := s.checkUnitAccess(ctx, unit, userID, "update"); err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.UnitNumber != nil {
		unit.UnitNumber = *req.UnitNumber
	}
	if req.UnitType != nil {
		unit.UnitType = *req.UnitType
	}
	if req.BlockNumber != nil {
		unit.BlockNumber = req.BlockNumber
	}
	if req.FloorNumber != nil {
		unit.FloorNumber = req.FloorNumber
	}
	if req.SizeSquareFeet != nil {
		unit.SizeSquareFeet = req.SizeSquareFeet
	}
	if req.SizeSquareMeters != nil {
		unit.SizeSquareMeters = req.SizeSquareMeters
	}
	if req.NumberOfBedrooms != nil {
		unit.NumberOfBedrooms = req.NumberOfBedrooms
	}
	if req.NumberOfBathrooms != nil {
		unit.NumberOfBathrooms = req.NumberOfBathrooms
	}
	if req.HasEnsuite != nil {
		unit.HasEnsuite = *req.HasEnsuite
	}
	if req.HasBalcony != nil {
		unit.HasBalcony = *req.HasBalcony
	}
	if req.HasParking != nil {
		unit.HasParking = *req.HasParking
	}
	if req.ParkingSpaces != nil {
		unit.ParkingSpaces = req.ParkingSpaces
	}
	if req.RentAmount != nil {
		unit.RentAmount = *req.RentAmount
	}
	if req.Currency != nil {
		unit.Currency = *req.Currency
	}
	if req.DepositAmount != nil {
		unit.DepositAmount = *req.DepositAmount
	}
	if req.DepositMonths != nil {
		unit.DepositMonths = *req.DepositMonths
	}
	if req.Status != nil {
		unit.Status = *req.Status
	}
	if req.Condition != nil {
		unit.Condition = *req.Condition
	}
	if req.FurnishingType != nil {
		unit.FurnishingType = *req.FurnishingType
	}
	if req.WaterMeterNumber != nil {
		unit.WaterMeterNumber = req.WaterMeterNumber
	}
	if req.ElectricMeterNumber != nil {
		unit.ElectricMeterNumber = req.ElectricMeterNumber
	}
	if req.UtilityBillingType != nil {
		unit.UtilityBillingType = *req.UtilityBillingType
	}
	if req.InUnitAmenities != nil {
		unit.InUnitAmenities = req.InUnitAmenities
	}
	if req.Appliances != nil {
		unit.Appliances = req.Appliances
	}

	// Save updates
	err = s.unitRepo.UpdateUnit(ctx, unit)
	if err != nil {
		return nil, fmt.Errorf("failed to update unit: %w", err)
	}

	return unit, nil
}

func (s *unitService) DeleteUnit(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	// Get existing unit
	unit, err := s.unitRepo.GetUnitByID(ctx, id)
	if err != nil {
		return fmt.Errorf("unit not found: %w", err)
	}

	// Check permissions
	if err := s.checkUnitAccess(ctx, unit, userID, "delete"); err != nil {
		return err
	}

	// Check if unit is occupied
	if unit.Status == domain.UnitStatusOccupied {
		return fmt.Errorf("cannot delete occupied unit")
	}

	// Delete unit
	err = s.unitRepo.DeleteUnit(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete unit: %w", err)
	}

	return nil
}

func (s *unitService) ListUnits(ctx context.Context, filters port.UnitFilters, userID uuid.UUID) (*port.UnitListResponse, error) {
	// Get user to check permissions and apply filters
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Apply user-based filters
	filters = s.applyUserFiltersForUnits(filters, user)

	// Get units
	units, err := s.unitRepo.SearchUnits(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to search units: %w", err)
	}

	// Get total count
	totalCount, err := s.unitRepo.GetUnitsCount(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to get units count: %w", err)
	}

	// Calculate pagination
	page := (filters.Offset / filters.Limit) + 1
	totalPages := int(math.Ceil(float64(totalCount) / float64(filters.Limit)))

	return &port.UnitListResponse{
		Units:      units,
		Total:      totalCount,
		Page:       page,
		PerPage:    filters.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *unitService) UpdateUnitStatus(ctx context.Context, unitID uuid.UUID, status domain.UnitStatus, userID uuid.UUID) error {
	// Get unit
	unit, err := s.unitRepo.GetUnitByID(ctx, unitID)
	if err != nil {
		return fmt.Errorf("unit not found: %w", err)
	}

	// Check permissions
	if err := s.checkUnitAccess(ctx, unit, userID, "update"); err != nil {
		return err
	}

	// Validate status transition
	if err := s.validateStatusTransition(unit.Status, status); err != nil {
		return err
	}

	// Update status
	err = s.unitRepo.UpdateUnitStatus(ctx, unitID, status)
	if err != nil {
		return fmt.Errorf("failed to update unit status: %w", err)
	}

	return nil
}

func (s *unitService) AssignTenant(ctx context.Context, req *port.AssignTenantRequest, userID uuid.UUID) error {
	// Get unit
	unit, err := s.unitRepo.GetUnitByID(ctx, req.UnitID)
	if err != nil {
		return fmt.Errorf("unit not found: %w", err)
	}

	// Check permissions
	if err := s.checkUnitAccess(ctx, unit, userID, "update"); err != nil {
		return err
	}

	// Validate tenant
	tenant, err := s.userRepo.GetByID(ctx, req.TenantID)
	if err != nil {
		return fmt.Errorf("tenant not found: %w", err)
	}

	if !tenant.IsTenant() {
		return fmt.Errorf("user is not a tenant")
	}

	// Check if unit is available
	if unit.Status != domain.UnitStatusVacant {
		return fmt.Errorf("unit is not available for assignment")
	}

	// Validate lease dates
	leaseStart, err := time.Parse("2006-01-02", req.LeaseStartDate)
	if err != nil {
		return fmt.Errorf("invalid lease start date: %w", err)
	}

	leaseEnd, err := time.Parse("2006-01-02", req.LeaseEndDate)
	if err != nil {
		return fmt.Errorf("invalid lease end date: %w", err)
	}

	if leaseEnd.Before(leaseStart) {
		return fmt.Errorf("lease end date must be after start date")
	}

	// Assign tenant
	err = s.unitRepo.AssignTenant(ctx, req.UnitID, req.TenantID, &req.LeaseStartDate, &req.LeaseEndDate)
	if err != nil {
		return fmt.Errorf("failed to assign tenant: %w", err)
	}

	return nil
}

func (s *unitService) ReleaseTenant(ctx context.Context, unitID uuid.UUID, userID uuid.UUID) error {
	// Get unit
	unit, err := s.unitRepo.GetUnitByID(ctx, unitID)
	if err != nil {
		return fmt.Errorf("unit not found: %w", err)
	}

	// Check permissions
	if err := s.checkUnitAccess(ctx, unit, userID, "update"); err != nil {
		return err
	}

	// Check if unit has a tenant
	if unit.Status != domain.UnitStatusOccupied || unit.CurrentTenantID == nil {
		return fmt.Errorf("unit does not have an assigned tenant")
	}

	// Release tenant
	err = s.unitRepo.ReleaseTenant(ctx, unitID)
	if err != nil {
		return fmt.Errorf("failed to release tenant: %w", err)
	}

	return nil
}

func (s *unitService) SearchAvailableUnits(ctx context.Context, filters port.UnitFilters) (*port.UnitListResponse, error) {
	// Set default filter for available units
	if filters.Status == nil {
		vacantStatus := domain.UnitStatusVacant
		filters.Status = &vacantStatus
	}

	return s.ListUnits(ctx, filters, uuid.Nil) // Public search doesn't require user authentication
}

func (s *unitService) GetUnitRecommendations(ctx context.Context, tenantID uuid.UUID, preferences *port.UnitPreferences) ([]*domain.Unit, error) {
	// Base filters for available units
	vacantStatus := domain.UnitStatusVacant
	filters := port.UnitFilters{
		Status: &vacantStatus,
		Limit:  50, // Reasonable limit for recommendations
	}

	if preferences.MinRent != nil {
		filters.MinRent = preferences.MinRent
	}
	if preferences.MaxRent != nil {
		filters.MaxRent = preferences.MaxRent
	}
	if preferences.MinBedrooms != nil {
		filters.MinBedrooms = preferences.MinBedrooms
	}
	if preferences.MaxBedrooms != nil {
		filters.MaxBedrooms = preferences.MaxBedrooms
	}
	if preferences.FurnishingType != nil {
		filters.FurnishingType = preferences.FurnishingType
	}
	if preferences.HasParking != nil {
		filters.HasParking = preferences.HasParking
	}
	if preferences.HasBalcony != nil {
		filters.HasBalcony = preferences.HasBalcony
	}
	if len(preferences.RequiredAmenities) > 0 {
		filters.Amenities = preferences.RequiredAmenities
	}

	// Get matching units
	units, err := s.unitRepo.SearchUnits(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to get unit recommendations: %w", err)
	}

	// TODO: Implement scoring algorithm based on preferences
	// For now, return first matching units

	return units, nil
}

// Helper methods

func (s *unitService) validateCreateUnitRequest(req *port.CreateUnitRequest) error {
	if req.PropertyID == uuid.Nil {
		return fmt.Errorf("property ID is required")
	}
	if req.UnitNumber == "" {
		return fmt.Errorf("unit number is required")
	}
	if req.RentAmount < 0 {
		return fmt.Errorf("rent amount cannot be negative")
	}
	if req.DepositAmount < 0 {
		return fmt.Errorf("deposit amount cannot be negative")
	}
	if req.DepositMonths < 1 {
		return fmt.Errorf("deposit months must be at least 1")
	}
	if req.Currency == "" {
		return fmt.Errorf("currency is required")
	}

	return nil
}

func (s *unitService) checkUnitAccess(ctx context.Context, unit *domain.Unit, userID uuid.UUID, action string) error {
	// Get property to check ownership/management
	property, err := s.propertyRepo.GetPropertyByID(ctx, unit.PropertyID)
	if err != nil {
		return fmt.Errorf("failed to get property: %w", err)
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Super admin can access everything
	if user.IsSuperAdmin() {
		return nil
	}

	// Property owner can access their units
	if property.OwnerID == userID {
		return nil
	}

	// Agency users can access units in properties they manage
	if user.AgencyID != nil && property.AgencyID != nil && *user.AgencyID == *property.AgencyID {
		return nil
	}

	// Tenants can view their own units
	if action == "view" && unit.CurrentTenantID != nil && *unit.CurrentTenantID == userID {
		return nil
	}

	return fmt.Errorf("access denied: insufficient permissions")
}

func (s *unitService) applyUserFiltersForUnits(filters port.UnitFilters, user *domain.User) port.UnitFilters {
	// Super admin can see everything
	if user.IsSuperAdmin() {
		return filters
	}

	// For other users, we need to filter by properties they have access to
	// This is a simplified approach - in a real system, you might want to
	// get the list of accessible property IDs first

	// Tenants can only see their own units
	if user.IsTenant() {
		filters.CurrentTenantID = &user.ID
		return filters
	}

	// For property owners and agency users, we'll handle this at the property level
	// This would require joining with properties table in the repository layer

	return filters
}

func (s *unitService) validateStatusTransition(current, new domain.UnitStatus) error {
	// Define allowed transitions
	allowedTransitions := map[domain.UnitStatus][]domain.UnitStatus{
		domain.UnitStatusVacant: {
			domain.UnitStatusOccupied,
			domain.UnitStatusReserved,
			domain.UnitStatusUnderRepair,
			domain.UnitStatusMaintenance,
		},
		domain.UnitStatusOccupied: {
			domain.UnitStatusVacant,
			domain.UnitStatusUnderRepair,
			domain.UnitStatusMaintenance,
		},
		domain.UnitStatusReserved: {
			domain.UnitStatusOccupied,
			domain.UnitStatusVacant,
		},
		domain.UnitStatusUnderRepair: {
			domain.UnitStatusVacant,
			domain.UnitStatusMaintenance,
		},
		domain.UnitStatusMaintenance: {
			domain.UnitStatusVacant,
			domain.UnitStatusUnderRepair,
		},
	}

	if allowed, exists := allowedTransitions[current]; exists {
		for _, status := range allowed {
			if status == new {
				return nil
			}
		}
	}

	return fmt.Errorf("invalid status transition from %s to %s", current, new)
}
