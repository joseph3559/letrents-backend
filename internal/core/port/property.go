package port

import (
	"context"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// PropertyRepository defines the interface for property data operations
type PropertyRepository interface {
	// Property CRUD operations
	CreateProperty(ctx context.Context, property *domain.Property) error
	GetPropertyByID(ctx context.Context, id uuid.UUID) (*domain.Property, error)
	GetPropertiesByOwner(ctx context.Context, ownerID uuid.UUID, limit, offset int) ([]*domain.Property, error)
	GetPropertiesByAgency(ctx context.Context, agencyID uuid.UUID, limit, offset int) ([]*domain.Property, error)
	UpdateProperty(ctx context.Context, property *domain.Property) error
	DeleteProperty(ctx context.Context, id uuid.UUID) error

	// Property search and filtering
	SearchProperties(ctx context.Context, filters PropertyFilters) ([]*domain.Property, error)
	GetPropertiesCount(ctx context.Context, filters PropertyFilters) (int, error)
	GetPropertiesByLocation(ctx context.Context, city, region string, limit, offset int) ([]*domain.Property, error)
	GetPropertiesByType(ctx context.Context, propertyType domain.PropertyType, limit, offset int) ([]*domain.Property, error)

	// Property statistics
	GetPropertyStats(ctx context.Context, ownerID *uuid.UUID, agencyID *uuid.UUID) (*PropertyStats, error)
}

// UnitRepository defines the interface for unit data operations
type UnitRepository interface {
	// Unit CRUD operations
	CreateUnit(ctx context.Context, unit *domain.Unit) error
	CreateUnits(ctx context.Context, units []*domain.Unit) error // Bulk creation
	GetUnitByID(ctx context.Context, id uuid.UUID) (*domain.Unit, error)
	GetUnitsByProperty(ctx context.Context, propertyID uuid.UUID, limit, offset int) ([]*domain.Unit, error)
	UpdateUnit(ctx context.Context, unit *domain.Unit) error
	DeleteUnit(ctx context.Context, id uuid.UUID) error

	// Unit search and filtering
	SearchUnits(ctx context.Context, filters UnitFilters) ([]*domain.Unit, error)
	GetUnitsCount(ctx context.Context, filters UnitFilters) (int, error)
	GetAvailableUnits(ctx context.Context, filters UnitFilters) ([]*domain.Unit, error)
	GetUnitsByStatus(ctx context.Context, status domain.UnitStatus, limit, offset int) ([]*domain.Unit, error)
	GetUnitsByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Unit, error)

	// Unit management
	UpdateUnitStatus(ctx context.Context, unitID uuid.UUID, status domain.UnitStatus) error
	AssignTenant(ctx context.Context, unitID, tenantID uuid.UUID, leaseStart, leaseEnd *string) error
	ReleaseTenant(ctx context.Context, unitID uuid.UUID) error

	// Unit statistics
	GetUnitStats(ctx context.Context, propertyID *uuid.UUID, ownerID *uuid.UUID) (*UnitStats, error)
	GetOccupancyRate(ctx context.Context, propertyID uuid.UUID) (float64, error)
}

// PropertyDocumentRepository defines the interface for property document operations
type PropertyDocumentRepository interface {
	CreateDocument(ctx context.Context, doc *domain.PropertyDocument) error
	GetDocumentsByProperty(ctx context.Context, propertyID uuid.UUID) ([]*domain.PropertyDocument, error)
	GetDocumentsByUnit(ctx context.Context, unitID uuid.UUID) ([]*domain.PropertyDocument, error)
	GetDocumentByID(ctx context.Context, id uuid.UUID) (*domain.PropertyDocument, error)
	UpdateDocument(ctx context.Context, doc *domain.PropertyDocument) error
	DeleteDocument(ctx context.Context, id uuid.UUID) error
	GetDocumentsByType(ctx context.Context, propertyID uuid.UUID, documentType string) ([]*domain.PropertyDocument, error)
}

// PropertyInspectionRepository defines the interface for property inspection operations
type PropertyInspectionRepository interface {
	CreateInspection(ctx context.Context, inspection *domain.PropertyInspection) error
	GetInspectionByID(ctx context.Context, id uuid.UUID) (*domain.PropertyInspection, error)
	GetInspectionsByProperty(ctx context.Context, propertyID uuid.UUID, limit, offset int) ([]*domain.PropertyInspection, error)
	GetInspectionsByUnit(ctx context.Context, unitID uuid.UUID, limit, offset int) ([]*domain.PropertyInspection, error)
	GetInspectionsByInspector(ctx context.Context, inspectorID uuid.UUID, limit, offset int) ([]*domain.PropertyInspection, error)
	UpdateInspection(ctx context.Context, inspection *domain.PropertyInspection) error
	DeleteInspection(ctx context.Context, id uuid.UUID) error
	GetPendingInspections(ctx context.Context, inspectorID *uuid.UUID) ([]*domain.PropertyInspection, error)
	GetInspectionsByDateRange(ctx context.Context, startDate, endDate string) ([]*domain.PropertyInspection, error)
}

// PropertyInventoryRepository defines the interface for property inventory operations
type PropertyInventoryRepository interface {
	CreateInventoryItem(ctx context.Context, item *domain.PropertyInventory) error
	GetInventoryByProperty(ctx context.Context, propertyID uuid.UUID) ([]*domain.PropertyInventory, error)
	GetInventoryByUnit(ctx context.Context, unitID uuid.UUID) ([]*domain.PropertyInventory, error)
	GetInventoryItemByID(ctx context.Context, id uuid.UUID) (*domain.PropertyInventory, error)
	UpdateInventoryItem(ctx context.Context, item *domain.PropertyInventory) error
	DeleteInventoryItem(ctx context.Context, id uuid.UUID) error
	GetInventoryByCategory(ctx context.Context, propertyID uuid.UUID, category string) ([]*domain.PropertyInventory, error)
}

// Filter structs for search and filtering
type PropertyFilters struct {
	OwnerID      *uuid.UUID             `json:"owner_id,omitempty"`
	AgencyID     *uuid.UUID             `json:"agency_id,omitempty"`
	Type         *domain.PropertyType   `json:"type,omitempty"`
	Status       *domain.PropertyStatus `json:"status,omitempty"`
	City         *string                `json:"city,omitempty"`
	Region       *string                `json:"region,omitempty"`
	Country      *string                `json:"country,omitempty"`
	MinUnits     *int                   `json:"min_units,omitempty"`
	MaxUnits     *int                   `json:"max_units,omitempty"`
	Amenities    []string               `json:"amenities,omitempty"`
	YearBuiltMin *int                   `json:"year_built_min,omitempty"`
	YearBuiltMax *int                   `json:"year_built_max,omitempty"`
	SearchQuery  *string                `json:"search_query,omitempty"`
	SortBy       *string                `json:"sort_by,omitempty"`
	SortOrder    *string                `json:"sort_order,omitempty"`
	Limit        int                    `json:"limit"`
	Offset       int                    `json:"offset"`
}

type UnitFilters struct {
	PropertyID      *uuid.UUID             `json:"property_id,omitempty"`
	UnitType        *domain.UnitType       `json:"unit_type,omitempty"`
	Status          *domain.UnitStatus     `json:"status,omitempty"`
	Condition       *domain.UnitCondition  `json:"condition,omitempty"`
	FurnishingType  *domain.FurnishingType `json:"furnishing_type,omitempty"`
	MinRent         *float64               `json:"min_rent,omitempty"`
	MaxRent         *float64               `json:"max_rent,omitempty"`
	MinBedrooms     *int                   `json:"min_bedrooms,omitempty"`
	MaxBedrooms     *int                   `json:"max_bedrooms,omitempty"`
	MinBathrooms    *int                   `json:"min_bathrooms,omitempty"`
	MaxBathrooms    *int                   `json:"max_bathrooms,omitempty"`
	HasEnsuite      *bool                  `json:"has_ensuite,omitempty"`
	HasBalcony      *bool                  `json:"has_balcony,omitempty"`
	HasParking      *bool                  `json:"has_parking,omitempty"`
	MinSize         *float64               `json:"min_size,omitempty"`
	MaxSize         *float64               `json:"max_size,omitempty"`
	Amenities       []string               `json:"amenities,omitempty"`
	Appliances      []string               `json:"appliances,omitempty"`
	AvailableFrom   *string                `json:"available_from,omitempty"`
	LeaseType       *string                `json:"lease_type,omitempty"`
	CurrentTenantID *uuid.UUID             `json:"current_tenant_id,omitempty"`
	BlockNumber     *string                `json:"block_number,omitempty"`
	FloorNumber     *int                   `json:"floor_number,omitempty"`
	SearchQuery     *string                `json:"search_query,omitempty"`
	SortBy          *string                `json:"sort_by,omitempty"`
	SortOrder       *string                `json:"sort_order,omitempty"`
	Limit           int                    `json:"limit"`
	Offset          int                    `json:"offset"`
}

// Statistics structs
type PropertyStats struct {
	TotalProperties         int                           `json:"total_properties"`
	PropertiesByType        map[domain.PropertyType]int   `json:"properties_by_type"`
	PropertiesByStatus      map[domain.PropertyStatus]int `json:"properties_by_status"`
	TotalUnits              int                           `json:"total_units"`
	AverageUnitsPerProperty float64                       `json:"average_units_per_property"`
	TotalValue              float64                       `json:"total_value"`
}

type UnitStats struct {
	TotalUnits          int                       `json:"total_units"`
	UnitsByType         map[domain.UnitType]int   `json:"units_by_type"`
	UnitsByStatus       map[domain.UnitStatus]int `json:"units_by_status"`
	VacantUnits         int                       `json:"vacant_units"`
	OccupiedUnits       int                       `json:"occupied_units"`
	OccupancyRate       float64                   `json:"occupancy_rate"`
	AverageRent         float64                   `json:"average_rent"`
	TotalMonthlyRevenue float64                   `json:"total_monthly_revenue"`
	PotentialRevenue    float64                   `json:"potential_revenue"`
	RevenueEfficiency   float64                   `json:"revenue_efficiency"`
}

// Service interfaces for business logic
type PropertyService interface {
	// Property management
	CreateProperty(ctx context.Context, req *CreatePropertyRequest) (*domain.Property, error)
	GetProperty(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Property, error)
	UpdateProperty(ctx context.Context, id uuid.UUID, req *UpdatePropertyRequest, userID uuid.UUID) (*domain.Property, error)
	DeleteProperty(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	ListProperties(ctx context.Context, filters PropertyFilters, userID uuid.UUID) (*PropertyListResponse, error)

	// Property analytics
	GetPropertyAnalytics(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID) (*PropertyAnalytics, error)
	GetOccupancyReport(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID) (*OccupancyReport, error)
	GetRevenueReport(ctx context.Context, propertyID uuid.UUID, userID uuid.UUID, period string) (*RevenueReport, error)
}

type UnitService interface {
	// Unit management
	CreateUnit(ctx context.Context, req *CreateUnitRequest) (*domain.Unit, error)
	CreateUnits(ctx context.Context, req *CreateUnitsRequest) ([]*domain.Unit, error)
	GetUnit(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Unit, error)
	UpdateUnit(ctx context.Context, id uuid.UUID, req *UpdateUnitRequest, userID uuid.UUID) (*domain.Unit, error)
	DeleteUnit(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	ListUnits(ctx context.Context, filters UnitFilters, userID uuid.UUID) (*UnitListResponse, error)

	// Unit operations
	UpdateUnitStatus(ctx context.Context, unitID uuid.UUID, status domain.UnitStatus, userID uuid.UUID) error
	AssignTenant(ctx context.Context, req *AssignTenantRequest, userID uuid.UUID) error
	ReleaseTenant(ctx context.Context, unitID uuid.UUID, userID uuid.UUID) error

	// Unit search
	SearchAvailableUnits(ctx context.Context, filters UnitFilters) (*UnitListResponse, error)
	GetUnitRecommendations(ctx context.Context, tenantID uuid.UUID, preferences *UnitPreferences) ([]*domain.Unit, error)
}

// Request/Response structures
type CreatePropertyRequest struct {
	Name                string               `json:"name" validate:"required,min=2,max=255"`
	Type                domain.PropertyType  `json:"type" validate:"required"`
	Description         *string              `json:"description,omitempty"`
	Street              string               `json:"street" validate:"required"`
	City                string               `json:"city" validate:"required"`
	Region              string               `json:"region" validate:"required"`
	Country             string               `json:"country" validate:"required"`
	PostalCode          *string              `json:"postal_code,omitempty"`
	Latitude            *float64             `json:"latitude,omitempty"`
	Longitude           *float64             `json:"longitude,omitempty"`
	OwnershipType       domain.OwnershipType `json:"ownership_type" validate:"required"`
	OwnerID             uuid.UUID            `json:"owner_id" validate:"required"`
	AgencyID            *uuid.UUID           `json:"agency_id,omitempty"`
	NumberOfUnits       int                  `json:"number_of_units" validate:"required,min=1"`
	NumberOfBlocks      *int                 `json:"number_of_blocks,omitempty"`
	NumberOfFloors      *int                 `json:"number_of_floors,omitempty"`
	ServiceChargeRate   *float64             `json:"service_charge_rate,omitempty"`
	ServiceChargeType   *string              `json:"service_charge_type,omitempty"`
	Amenities           []string             `json:"amenities,omitempty"`
	AccessControl       *string              `json:"access_control,omitempty"`
	MaintenanceSchedule *string              `json:"maintenance_schedule,omitempty"`
	YearBuilt           *int                 `json:"year_built,omitempty"`
}

type UpdatePropertyRequest struct {
	Name                *string                `json:"name,omitempty"`
	Description         *string                `json:"description,omitempty"`
	Street              *string                `json:"street,omitempty"`
	City                *string                `json:"city,omitempty"`
	Region              *string                `json:"region,omitempty"`
	Country             *string                `json:"country,omitempty"`
	PostalCode          *string                `json:"postal_code,omitempty"`
	Latitude            *float64               `json:"latitude,omitempty"`
	Longitude           *float64               `json:"longitude,omitempty"`
	NumberOfBlocks      *int                   `json:"number_of_blocks,omitempty"`
	NumberOfFloors      *int                   `json:"number_of_floors,omitempty"`
	ServiceChargeRate   *float64               `json:"service_charge_rate,omitempty"`
	ServiceChargeType   *string                `json:"service_charge_type,omitempty"`
	Amenities           []string               `json:"amenities,omitempty"`
	AccessControl       *string                `json:"access_control,omitempty"`
	MaintenanceSchedule *string                `json:"maintenance_schedule,omitempty"`
	Status              *domain.PropertyStatus `json:"status,omitempty"`
	YearBuilt           *int                   `json:"year_built,omitempty"`
}

type CreateUnitRequest struct {
	PropertyID          uuid.UUID                 `json:"property_id" validate:"required"`
	UnitNumber          string                    `json:"unit_number" validate:"required"`
	UnitType            domain.UnitType           `json:"unit_type" validate:"required"`
	BlockNumber         *string                   `json:"block_number,omitempty"`
	FloorNumber         *int                      `json:"floor_number,omitempty"`
	SizeSquareFeet      *float64                  `json:"size_square_feet,omitempty"`
	SizeSquareMeters    *float64                  `json:"size_square_meters,omitempty"`
	NumberOfBedrooms    *int                      `json:"number_of_bedrooms,omitempty"`
	NumberOfBathrooms   *int                      `json:"number_of_bathrooms,omitempty"`
	HasEnsuite          bool                      `json:"has_ensuite"`
	HasBalcony          bool                      `json:"has_balcony"`
	HasParking          bool                      `json:"has_parking"`
	ParkingSpaces       *int                      `json:"parking_spaces,omitempty"`
	RentAmount          float64                   `json:"rent_amount" validate:"required,min=0"`
	Currency            string                    `json:"currency" validate:"required"`
	DepositAmount       float64                   `json:"deposit_amount" validate:"required,min=0"`
	DepositMonths       int                       `json:"deposit_months" validate:"required,min=1"`
	Condition           domain.UnitCondition      `json:"condition"`
	FurnishingType      domain.FurnishingType     `json:"furnishing_type"`
	WaterMeterNumber    *string                   `json:"water_meter_number,omitempty"`
	ElectricMeterNumber *string                   `json:"electric_meter_number,omitempty"`
	UtilityBillingType  domain.UtilityBillingType `json:"utility_billing_type"`
	InUnitAmenities     []string                  `json:"in_unit_amenities,omitempty"`
	Appliances          []string                  `json:"appliances,omitempty"`
}

type CreateUnitsRequest struct {
	Units []CreateUnitRequest `json:"units" validate:"required,min=1"`
}

type UpdateUnitRequest struct {
	UnitNumber          *string                    `json:"unit_number,omitempty"`
	UnitType            *domain.UnitType           `json:"unit_type,omitempty"`
	BlockNumber         *string                    `json:"block_number,omitempty"`
	FloorNumber         *int                       `json:"floor_number,omitempty"`
	SizeSquareFeet      *float64                   `json:"size_square_feet,omitempty"`
	SizeSquareMeters    *float64                   `json:"size_square_meters,omitempty"`
	NumberOfBedrooms    *int                       `json:"number_of_bedrooms,omitempty"`
	NumberOfBathrooms   *int                       `json:"number_of_bathrooms,omitempty"`
	HasEnsuite          *bool                      `json:"has_ensuite,omitempty"`
	HasBalcony          *bool                      `json:"has_balcony,omitempty"`
	HasParking          *bool                      `json:"has_parking,omitempty"`
	ParkingSpaces       *int                       `json:"parking_spaces,omitempty"`
	RentAmount          *float64                   `json:"rent_amount,omitempty"`
	Currency            *string                    `json:"currency,omitempty"`
	DepositAmount       *float64                   `json:"deposit_amount,omitempty"`
	DepositMonths       *int                       `json:"deposit_months,omitempty"`
	Status              *domain.UnitStatus         `json:"status,omitempty"`
	Condition           *domain.UnitCondition      `json:"condition,omitempty"`
	FurnishingType      *domain.FurnishingType     `json:"furnishing_type,omitempty"`
	WaterMeterNumber    *string                    `json:"water_meter_number,omitempty"`
	ElectricMeterNumber *string                    `json:"electric_meter_number,omitempty"`
	UtilityBillingType  *domain.UtilityBillingType `json:"utility_billing_type,omitempty"`
	InUnitAmenities     []string                   `json:"in_unit_amenities,omitempty"`
	Appliances          []string                   `json:"appliances,omitempty"`
}

type AssignTenantRequest struct {
	UnitID         uuid.UUID `json:"unit_id" validate:"required"`
	TenantID       uuid.UUID `json:"tenant_id" validate:"required"`
	LeaseStartDate string    `json:"lease_start_date" validate:"required"`
	LeaseEndDate   string    `json:"lease_end_date" validate:"required"`
	LeaseType      string    `json:"lease_type" validate:"required"`
}

type PropertyListResponse struct {
	Properties []*domain.Property `json:"properties"`
	Total      int                `json:"total"`
	Page       int                `json:"page"`
	PerPage    int                `json:"per_page"`
	TotalPages int                `json:"total_pages"`
}

type UnitListResponse struct {
	Units      []*domain.Unit `json:"units"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"per_page"`
	TotalPages int            `json:"total_pages"`
}

type UnitPreferences struct {
	MinRent            *float64               `json:"min_rent,omitempty"`
	MaxRent            *float64               `json:"max_rent,omitempty"`
	UnitTypes          []domain.UnitType      `json:"unit_types,omitempty"`
	MinBedrooms        *int                   `json:"min_bedrooms,omitempty"`
	MaxBedrooms        *int                   `json:"max_bedrooms,omitempty"`
	RequiredAmenities  []string               `json:"required_amenities,omitempty"`
	PreferredLocations []string               `json:"preferred_locations,omitempty"`
	FurnishingType     *domain.FurnishingType `json:"furnishing_type,omitempty"`
	HasParking         *bool                  `json:"has_parking,omitempty"`
	HasBalcony         *bool                  `json:"has_balcony,omitempty"`
}

// Analytics structures
type PropertyAnalytics struct {
	PropertyID          uuid.UUID                 `json:"property_id"`
	TotalUnits          int                       `json:"total_units"`
	OccupiedUnits       int                       `json:"occupied_units"`
	VacantUnits         int                       `json:"vacant_units"`
	OccupancyRate       float64                   `json:"occupancy_rate"`
	TotalMonthlyRevenue float64                   `json:"total_monthly_revenue"`
	PotentialRevenue    float64                   `json:"potential_revenue"`
	RevenueEfficiency   float64                   `json:"revenue_efficiency"`
	AverageRent         float64                   `json:"average_rent"`
	UnitsByType         map[domain.UnitType]int   `json:"units_by_type"`
	UnitsByStatus       map[domain.UnitStatus]int `json:"units_by_status"`
}

type OccupancyReport struct {
	PropertyID    uuid.UUID            `json:"property_id"`
	ReportDate    string               `json:"report_date"`
	OccupancyRate float64              `json:"occupancy_rate"`
	UnitsOccupied int                  `json:"units_occupied"`
	UnitsVacant   int                  `json:"units_vacant"`
	UnitsTotal    int                  `json:"units_total"`
	VacancyTrend  []OccupancyDataPoint `json:"vacancy_trend"`
	UnitTurnover  []UnitTurnoverInfo   `json:"unit_turnover"`
}

type RevenueReport struct {
	PropertyID        uuid.UUID                   `json:"property_id"`
	Period            string                      `json:"period"`
	TotalRevenue      float64                     `json:"total_revenue"`
	PotentialRevenue  float64                     `json:"potential_revenue"`
	RevenueEfficiency float64                     `json:"revenue_efficiency"`
	RevenueByMonth    []RevenueDataPoint          `json:"revenue_by_month"`
	RevenueByUnitType map[domain.UnitType]float64 `json:"revenue_by_unit_type"`
}

type OccupancyDataPoint struct {
	Date          string  `json:"date"`
	OccupancyRate float64 `json:"occupancy_rate"`
	UnitsOccupied int     `json:"units_occupied"`
	UnitsVacant   int     `json:"units_vacant"`
}

type UnitTurnoverInfo struct {
	UnitID         uuid.UUID  `json:"unit_id"`
	UnitNumber     string     `json:"unit_number"`
	VacantDate     string     `json:"vacant_date"`
	DaysVacant     int        `json:"days_vacant"`
	PreviousTenant *uuid.UUID `json:"previous_tenant,omitempty"`
}

type RevenueDataPoint struct {
	Month            string  `json:"month"`
	Revenue          float64 `json:"revenue"`
	PotentialRevenue float64 `json:"potential_revenue"`
	OccupancyRate    float64 `json:"occupancy_rate"`
}
