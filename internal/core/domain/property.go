package domain

import (
	"time"

	"github.com/google/uuid"
)

// PropertyType represents different types of properties
type PropertyType string

const (
	PropertyTypeResidential   PropertyType = "residential"
	PropertyTypeCommercial    PropertyType = "commercial"
	PropertyTypeIndustrial    PropertyType = "industrial"
	PropertyTypeMixedUse      PropertyType = "mixed_use"
	PropertyTypeInstitutional PropertyType = "institutional"
	PropertyTypeVacantLand    PropertyType = "vacant_land"
	PropertyTypeHospitality   PropertyType = "hospitality"
	PropertyTypeRecreational  PropertyType = "recreational"
)

// PropertyStatus represents the status of a property
type PropertyStatus string

const (
	PropertyStatusActive            PropertyStatus = "active"
	PropertyStatusUnderConstruction PropertyStatus = "under_construction"
	PropertyStatusRenovation        PropertyStatus = "renovation"
	PropertyStatusInactive          PropertyStatus = "inactive"
)

// OwnershipType represents the ownership type of a property
type OwnershipType string

const (
	OwnershipTypeIndividual OwnershipType = "individual"
	OwnershipTypeCompany    OwnershipType = "company"
	OwnershipTypeJoint      OwnershipType = "joint"
)

// UnitType represents different types of units
type UnitType string

const (
	// Residential Unit Types
	UnitTypeSingleRoom      UnitType = "single_room"
	UnitTypeDoubleRoom      UnitType = "double_room"
	UnitTypeBedsitter       UnitType = "bedsitter"
	UnitTypeStudio          UnitType = "studio"
	UnitTypeOneBedroom      UnitType = "1_bedroom"
	UnitTypeTwoBedroom      UnitType = "2_bedroom"
	UnitTypeThreeBedroom    UnitType = "3_bedroom"
	UnitTypeFourBedroom     UnitType = "4_bedroom"
	UnitTypeFivePlusBedroom UnitType = "5_plus_bedroom"
	UnitTypeServantQuarter  UnitType = "servant_quarter"
	UnitTypeMaisonette      UnitType = "maisonette"
	UnitTypePenthouse       UnitType = "penthouse"

	// Commercial Unit Types
	UnitTypeOfficeSpace     UnitType = "office_space"
	UnitTypeRetailShop      UnitType = "retail_shop"
	UnitTypeKiosk           UnitType = "kiosk"
	UnitTypeStall           UnitType = "stall"
	UnitTypeWarehouse       UnitType = "warehouse"
	UnitTypeRestaurantSpace UnitType = "restaurant_space"
	UnitTypeStudioOffice    UnitType = "studio_office"
	UnitTypeCoworkingUnit   UnitType = "coworking_unit"
	UnitTypeMedicalSuite    UnitType = "medical_suite"
)

// UnitStatus is an alias for UnitStatusEnum defined in agent.go to avoid duplication
type UnitStatus = UnitStatusEnum

// UnitCondition represents the condition of a unit
type UnitCondition string

const (
	UnitConditionNew          UnitCondition = "new"
	UnitConditionExcellent    UnitCondition = "excellent"
	UnitConditionGood         UnitCondition = "good"
	UnitConditionFair         UnitCondition = "fair"
	UnitConditionPoor         UnitCondition = "poor"
	UnitConditionNeedsRepairs UnitCondition = "needs_repairs"
	UnitConditionRenovated    UnitCondition = "renovated"
)

// FurnishingType represents the furnishing status of a unit
type FurnishingType string

const (
	FurnishingTypeFurnished     FurnishingType = "furnished"
	FurnishingTypeUnfurnished   FurnishingType = "unfurnished"
	FurnishingTypeSemiFurnished FurnishingType = "semi_furnished"
)

// UtilityBillingType represents how utilities are billed
type UtilityBillingType string

const (
	UtilityBillingTypePrepaid   UtilityBillingType = "prepaid"
	UtilityBillingTypePostpaid  UtilityBillingType = "postpaid"
	UtilityBillingTypeInclusive UtilityBillingType = "inclusive"
)

// Property represents a property in the system
type Property struct {
	ID          uuid.UUID    `json:"id" db:"id"`
	Name        string       `json:"name" db:"name"`
	Type        PropertyType `json:"type" db:"type"`
	Description *string      `json:"description" db:"description"`

	// Location details
	Street     string   `json:"street" db:"street"`
	City       string   `json:"city" db:"city"`
	Region     string   `json:"region" db:"region"`
	Country    string   `json:"country" db:"country"`
	PostalCode *string  `json:"postal_code" db:"postal_code"`
	Latitude   *float64 `json:"latitude" db:"latitude"`
	Longitude  *float64 `json:"longitude" db:"longitude"`

	// Ownership details
	OwnershipType OwnershipType `json:"ownership_type" db:"ownership_type"`
	OwnerID       uuid.UUID     `json:"owner_id" db:"owner_id"`
	AgencyID      *uuid.UUID    `json:"agency_id" db:"agency_id"`

	// Property structure
	NumberOfUnits  int  `json:"number_of_units" db:"number_of_units"`
	NumberOfBlocks *int `json:"number_of_blocks" db:"number_of_blocks"`
	NumberOfFloors *int `json:"number_of_floors" db:"number_of_floors"`

	// Financial details
	ServiceChargeRate *float64 `json:"service_charge_rate" db:"service_charge_rate"`
	ServiceChargeType *string  `json:"service_charge_type" db:"service_charge_type"` // monthly, quarterly, annual

	// Property amenities and features
	Amenities           []string `json:"amenities" db:"amenities"` // JSON array
	AccessControl       *string  `json:"access_control" db:"access_control"`
	MaintenanceSchedule *string  `json:"maintenance_schedule" db:"maintenance_schedule"`

	// Status and tracking
	Status         PropertyStatus `json:"status" db:"status"`
	YearBuilt      *int           `json:"year_built" db:"year_built"`
	LastRenovation *time.Time     `json:"last_renovation" db:"last_renovation"`

	// Document and media
	Documents []string `json:"documents" db:"documents"` // JSON array of document URLs
	Images    []string `json:"images" db:"images"`       // JSON array of image URLs

	// Audit fields
	CreatedBy uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Unit represents a unit within a property
type Unit struct {
	ID         uuid.UUID `json:"id" db:"id"`
	PropertyID uuid.UUID `json:"property_id" db:"property_id"`
	UnitNumber string    `json:"unit_number" db:"unit_number"`
	UnitType   UnitType  `json:"unit_type" db:"unit_type"`

	// Location within property
	BlockNumber *string `json:"block_number" db:"block_number"`
	FloorNumber *int    `json:"floor_number" db:"floor_number"`

	// Physical attributes
	SizeSquareFeet    *float64 `json:"size_square_feet" db:"size_square_feet"`
	SizeSquareMeters  *float64 `json:"size_square_meters" db:"size_square_meters"`
	NumberOfBedrooms  *int     `json:"number_of_bedrooms" db:"number_of_bedrooms"`
	NumberOfBathrooms *int     `json:"number_of_bathrooms" db:"number_of_bathrooms"`
	HasEnsuite        bool     `json:"has_ensuite" db:"has_ensuite"`
	HasBalcony        bool     `json:"has_balcony" db:"has_balcony"`
	HasParking        bool     `json:"has_parking" db:"has_parking"`
	ParkingSpaces     *int     `json:"parking_spaces" db:"parking_spaces"`

	// Financial details
	RentAmount    float64 `json:"rent_amount" db:"rent_amount"`
	Currency      string  `json:"currency" db:"currency"`
	DepositAmount float64 `json:"deposit_amount" db:"deposit_amount"`
	DepositMonths int     `json:"deposit_months" db:"deposit_months"`

	// Unit status and condition
	Status         UnitStatusEnum `json:"status" db:"status"`
	Condition      UnitCondition  `json:"condition" db:"condition"`
	FurnishingType FurnishingType `json:"furnishing_type" db:"furnishing_type"`

	// Utility details
	WaterMeterNumber    *string            `json:"water_meter_number" db:"water_meter_number"`
	ElectricMeterNumber *string            `json:"electric_meter_number" db:"electric_meter_number"`
	UtilityBillingType  UtilityBillingType `json:"utility_billing_type" db:"utility_billing_type"`

	// Unit amenities and features
	InUnitAmenities []string `json:"in_unit_amenities" db:"in_unit_amenities"` // JSON array
	Appliances      []string `json:"appliances" db:"appliances"`               // JSON array

	// Current lease information
	CurrentTenantID *uuid.UUID `json:"current_tenant_id" db:"current_tenant_id"`
	LeaseStartDate  *time.Time `json:"lease_start_date" db:"lease_start_date"`
	LeaseEndDate    *time.Time `json:"lease_end_date" db:"lease_end_date"`
	LeaseType       *string    `json:"lease_type" db:"lease_type"` // short_term, long_term

	// Document and media
	Documents []string `json:"documents" db:"documents"` // JSON array
	Images    []string `json:"images" db:"images"`       // JSON array

	// Valuation and market data
	EstimatedValue     *float64   `json:"estimated_value" db:"estimated_value"`
	MarketRentEstimate *float64   `json:"market_rent_estimate" db:"market_rent_estimate"`
	LastValuationDate  *time.Time `json:"last_valuation_date" db:"last_valuation_date"`

	// Audit fields
	CreatedBy uuid.UUID `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// PropertyDocument represents documents associated with a property
type PropertyDocument struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	PropertyID   uuid.UUID  `json:"property_id" db:"property_id"`
	UnitID       *uuid.UUID `json:"unit_id" db:"unit_id"` // null for property-level documents
	DocumentType string     `json:"document_type" db:"document_type"`
	DocumentName string     `json:"document_name" db:"document_name"`
	FilePath     string     `json:"file_path" db:"file_path"`
	FileSize     *int64     `json:"file_size" db:"file_size"`
	MimeType     *string    `json:"mime_type" db:"mime_type"`
	UploadedBy   uuid.UUID  `json:"uploaded_by" db:"uploaded_by"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// PropertyInspection represents property inspection records
type PropertyInspection struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	PropertyID      uuid.UUID  `json:"property_id" db:"property_id"`
	UnitID          *uuid.UUID `json:"unit_id" db:"unit_id"`
	InspectorID     uuid.UUID  `json:"inspector_id" db:"inspector_id"`
	InspectionType  string     `json:"inspection_type" db:"inspection_type"` // routine, move_in, move_out, maintenance
	InspectionDate  time.Time  `json:"inspection_date" db:"inspection_date"`
	ScheduledDate   time.Time  `json:"scheduled_date" db:"scheduled_date"`
	Status          string     `json:"status" db:"status"` // scheduled, completed, cancelled
	Notes           *string    `json:"notes" db:"notes"`
	Issues          []string   `json:"issues" db:"issues"`                   // JSON array
	Recommendations []string   `json:"recommendations" db:"recommendations"` // JSON array
	Photos          []string   `json:"photos" db:"photos"`                   // JSON array
	OverallRating   *int       `json:"overall_rating" db:"overall_rating"`   // 1-5 scale
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// PropertyInventory represents inventory items for properties/units
type PropertyInventory struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	PropertyID     uuid.UUID  `json:"property_id" db:"property_id"`
	UnitID         *uuid.UUID `json:"unit_id" db:"unit_id"`
	ItemName       string     `json:"item_name" db:"item_name"`
	Category       string     `json:"category" db:"category"`
	Description    *string    `json:"description" db:"description"`
	Quantity       int        `json:"quantity" db:"quantity"`
	Condition      string     `json:"condition" db:"condition"`
	PurchaseDate   *time.Time `json:"purchase_date" db:"purchase_date"`
	PurchasePrice  *float64   `json:"purchase_price" db:"purchase_price"`
	SerialNumber   *string    `json:"serial_number" db:"serial_number"`
	WarrantyExpiry *time.Time `json:"warranty_expiry" db:"warranty_expiry"`
	CreatedBy      uuid.UUID  `json:"created_by" db:"created_by"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Helper methods for Property
func (p *Property) IsActive() bool {
	return p.Status == PropertyStatusActive
}

func (p *Property) GetFullAddress() string {
	address := p.Street + ", " + p.City + ", " + p.Region
	if p.PostalCode != nil {
		address += " " + *p.PostalCode
	}
	return address + ", " + p.Country
}

func (p *Property) IsResidential() bool {
	return p.Type == PropertyTypeResidential
}

func (p *Property) IsCommercial() bool {
	return p.Type == PropertyTypeCommercial
}

// Helper methods for Unit
func (u *Unit) IsVacant() bool {
	return u.Status == UnitStatusVacant
}

func (u *Unit) IsOccupied() bool {
	return u.Status == UnitStatusOccupied
}

func (u *Unit) IsAvailable() bool {
	return u.Status == UnitStatusVacant
}

func (u *Unit) GetFullUnitNumber() string {
	fullNumber := u.UnitNumber
	if u.BlockNumber != nil {
		fullNumber = *u.BlockNumber + "-" + fullNumber
	}
	if u.FloorNumber != nil {
		fullNumber = fullNumber + "-F" + string(rune(*u.FloorNumber))
	}
	return fullNumber
}

func (u *Unit) GetMonthlyTotal() float64 {
	return u.RentAmount
}

func (u *Unit) GetTotalDeposit() float64 {
	return u.DepositAmount
}

func (u *Unit) IsResidential() bool {
	residentialTypes := []UnitType{
		UnitTypeSingleRoom, UnitTypeDoubleRoom, UnitTypeBedsitter, UnitTypeStudio,
		UnitTypeOneBedroom, UnitTypeTwoBedroom, UnitTypeThreeBedroom, UnitTypeFourBedroom,
		UnitTypeFivePlusBedroom, UnitTypeServantQuarter, UnitTypeMaisonette, UnitTypePenthouse,
	}

	for _, unitType := range residentialTypes {
		if u.UnitType == unitType {
			return true
		}
	}
	return false
}

func (u *Unit) IsCommercial() bool {
	return !u.IsResidential()
}

// Document type constants
const (
	DocumentTypeTitleDeed         = "title_deed"
	DocumentTypeLease             = "lease_agreement"
	DocumentTypeInsurance         = "insurance_policy"
	DocumentTypeSurveyReport      = "survey_report"
	DocumentTypeFloorPlan         = "floor_plan"
	DocumentTypeUtilityBill       = "utility_bill"
	DocumentTypeMaintenanceRecord = "maintenance_record"
	DocumentTypeInspectionReport  = "inspection_report"
	DocumentTypePhotos            = "photos"
	DocumentTypeOther             = "other"
)

// Inspection type constants
const (
	InspectionTypeRoutine     = "routine"
	InspectionTypeMoveIn      = "move_in"
	InspectionTypeMoveOut     = "move_out"
	InspectionTypeMaintenance = "maintenance"
	InspectionTypeEmergency   = "emergency"
)

// Common amenities constants
var (
	PropertyAmenities = []string{
		"parking", "elevator", "generator", "borehole", "swimming_pool",
		"gym", "playground", "security_guard", "cctv", "gate_access",
		"garden", "laundry", "conference_room", "rooftop", "backup_water",
	}

	UnitAmenities = []string{
		"wifi", "cable_tv", "air_conditioning", "heating", "balcony",
		"ensuite", "walk_in_closet", "fireplace", "dishwasher", "microwave",
		"refrigerator", "washing_machine", "dryer", "storage", "study_room",
	}

	ApplianceTypes = []string{
		"refrigerator", "microwave", "washing_machine", "dryer", "dishwasher",
		"oven", "cooktop", "water_heater", "air_conditioner", "heater",
		"television", "sound_system", "internet_router", "security_system",
	}
)
