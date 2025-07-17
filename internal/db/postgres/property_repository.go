package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
)

type propertyRepository struct {
	db *DB
}

// NewPropertyRepository creates a new PostgreSQL property repository
func NewPropertyRepository(db *DB) port.PropertyRepository {
	return &propertyRepository{db: db}
}

func (r *propertyRepository) CreateProperty(ctx context.Context, property *domain.Property) error {
	query := `
		INSERT INTO properties (
			id, name, type, description, street, city, region, country, postal_code,
			latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			amenities, access_control, maintenance_schedule, status, year_built,
			last_renovation, documents, images, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
		)`

	// Convert arrays to JSON
	amenitiesJSON, _ := json.Marshal(property.Amenities)
	documentsJSON, _ := json.Marshal(property.Documents)
	imagesJSON, _ := json.Marshal(property.Images)

	property.ID = uuid.New()
	property.CreatedAt = time.Now()
	property.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		property.ID, property.Name, property.Type, property.Description,
		property.Street, property.City, property.Region, property.Country, property.PostalCode,
		property.Latitude, property.Longitude, property.OwnershipType, property.OwnerID,
		property.AgencyID, property.NumberOfUnits, property.NumberOfBlocks, property.NumberOfFloors,
		property.ServiceChargeRate, property.ServiceChargeType, amenitiesJSON,
		property.AccessControl, property.MaintenanceSchedule, property.Status,
		property.YearBuilt, property.LastRenovation, documentsJSON, imagesJSON,
		property.CreatedBy, property.CreatedAt, property.UpdatedAt,
	)

	return err
}

func (r *propertyRepository) GetPropertyByID(ctx context.Context, id uuid.UUID) (*domain.Property, error) {
	query := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties 
		WHERE id = $1`

	property := &domain.Property{}
	var amenitiesJSON, documentsJSON, imagesJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&property.ID, &property.Name, &property.Type, &property.Description,
		&property.Street, &property.City, &property.Region, &property.Country, &property.PostalCode,
		&property.Latitude, &property.Longitude, &property.OwnershipType, &property.OwnerID,
		&property.AgencyID, &property.NumberOfUnits, &property.NumberOfBlocks, &property.NumberOfFloors,
		&property.ServiceChargeRate, &property.ServiceChargeType, &amenitiesJSON,
		&property.AccessControl, &property.MaintenanceSchedule, &property.Status,
		&property.YearBuilt, &property.LastRenovation, &documentsJSON, &imagesJSON,
		&property.CreatedBy, &property.CreatedAt, &property.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("property not found")
		}
		return nil, err
	}

	// Parse JSON arrays
	json.Unmarshal(amenitiesJSON, &property.Amenities)
	json.Unmarshal(documentsJSON, &property.Documents)
	json.Unmarshal(imagesJSON, &property.Images)

	return property, nil
}

func (r *propertyRepository) GetPropertiesByOwner(ctx context.Context, ownerID uuid.UUID, limit, offset int) ([]*domain.Property, error) {
	query := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties 
		WHERE owner_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanProperties(ctx, query, ownerID, limit, offset)
}

func (r *propertyRepository) GetPropertiesByAgency(ctx context.Context, agencyID uuid.UUID, limit, offset int) ([]*domain.Property, error) {
	query := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties 
		WHERE agency_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanProperties(ctx, query, agencyID, limit, offset)
}

func (r *propertyRepository) UpdateProperty(ctx context.Context, property *domain.Property) error {
	query := `
		UPDATE properties SET
			name = $2, type = $3, description = $4, street = $5, city = $6, region = $7,
			country = $8, postal_code = $9, latitude = $10, longitude = $11,
			ownership_type = $12, number_of_blocks = $13, number_of_floors = $14,
			service_charge_rate = $15, service_charge_type = $16, amenities = $17,
			access_control = $18, maintenance_schedule = $19, status = $20,
			year_built = $21, last_renovation = $22, documents = $23, images = $24,
			updated_at = $25
		WHERE id = $1`

	// Convert arrays to JSON
	amenitiesJSON, _ := json.Marshal(property.Amenities)
	documentsJSON, _ := json.Marshal(property.Documents)
	imagesJSON, _ := json.Marshal(property.Images)

	property.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		property.ID, property.Name, property.Type, property.Description,
		property.Street, property.City, property.Region, property.Country, property.PostalCode,
		property.Latitude, property.Longitude, property.OwnershipType,
		property.NumberOfBlocks, property.NumberOfFloors, property.ServiceChargeRate,
		property.ServiceChargeType, amenitiesJSON, property.AccessControl,
		property.MaintenanceSchedule, property.Status, property.YearBuilt,
		property.LastRenovation, documentsJSON, imagesJSON, property.UpdatedAt,
	)

	return err
}

func (r *propertyRepository) DeleteProperty(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM properties WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *propertyRepository) SearchProperties(ctx context.Context, filters port.PropertyFilters) ([]*domain.Property, error) {
	query, args := r.buildSearchQuery(filters)
	return r.scanPropertiesWithArgs(ctx, query, args...)
}

func (r *propertyRepository) GetPropertiesCount(ctx context.Context, filters port.PropertyFilters) (int, error) {
	query, args := r.buildCountQuery(filters)

	var count int
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&count)
	return count, err
}

func (r *propertyRepository) GetPropertiesByLocation(ctx context.Context, city, region string, limit, offset int) ([]*domain.Property, error) {
	query := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties 
		WHERE city = $1 AND region = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	return r.scanProperties(ctx, query, city, region, limit, offset)
}

func (r *propertyRepository) GetPropertiesByType(ctx context.Context, propertyType domain.PropertyType, limit, offset int) ([]*domain.Property, error) {
	query := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties 
		WHERE type = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanProperties(ctx, query, propertyType, limit, offset)
}

func (r *propertyRepository) GetPropertyStats(ctx context.Context, ownerID *uuid.UUID, agencyID *uuid.UUID) (*port.PropertyStats, error) {
	var whereClause string
	var args []interface{}
	argCount := 0

	if ownerID != nil {
		argCount++
		whereClause = fmt.Sprintf("WHERE owner_id = $%d", argCount)
		args = append(args, *ownerID)
	} else if agencyID != nil {
		argCount++
		whereClause = fmt.Sprintf("WHERE agency_id = $%d", argCount)
		args = append(args, *agencyID)
	}

	query := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_properties,
			SUM(number_of_units) as total_units,
			AVG(number_of_units) as avg_units_per_property,
			type,
			status
		FROM properties 
		%s
		GROUP BY type, status`, whereClause)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := &port.PropertyStats{
		PropertiesByType:   make(map[domain.PropertyType]int),
		PropertiesByStatus: make(map[domain.PropertyStatus]int),
	}

	for rows.Next() {
		var count, totalUnits int
		var avgUnits float64
		var propType domain.PropertyType
		var status domain.PropertyStatus

		err := rows.Scan(&count, &totalUnits, &avgUnits, &propType, &status)
		if err != nil {
			return nil, err
		}

		stats.TotalProperties += count
		stats.TotalUnits += totalUnits
		stats.AverageUnitsPerProperty = avgUnits

		stats.PropertiesByType[propType] += count
		stats.PropertiesByStatus[status] += count
	}

	return stats, nil
}

// Helper methods

func (r *propertyRepository) scanProperties(ctx context.Context, query string, args ...interface{}) ([]*domain.Property, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var properties []*domain.Property
	for rows.Next() {
		property := &domain.Property{}
		var amenitiesJSON, documentsJSON, imagesJSON []byte

		err := rows.Scan(
			&property.ID, &property.Name, &property.Type, &property.Description,
			&property.Street, &property.City, &property.Region, &property.Country, &property.PostalCode,
			&property.Latitude, &property.Longitude, &property.OwnershipType, &property.OwnerID,
			&property.AgencyID, &property.NumberOfUnits, &property.NumberOfBlocks, &property.NumberOfFloors,
			&property.ServiceChargeRate, &property.ServiceChargeType, &amenitiesJSON,
			&property.AccessControl, &property.MaintenanceSchedule, &property.Status,
			&property.YearBuilt, &property.LastRenovation, &documentsJSON, &imagesJSON,
			&property.CreatedBy, &property.CreatedAt, &property.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Parse JSON arrays
		json.Unmarshal(amenitiesJSON, &property.Amenities)
		json.Unmarshal(documentsJSON, &property.Documents)
		json.Unmarshal(imagesJSON, &property.Images)

		properties = append(properties, property)
	}

	return properties, nil
}

func (r *propertyRepository) scanPropertiesWithArgs(ctx context.Context, query string, args ...interface{}) ([]*domain.Property, error) {
	return r.scanProperties(ctx, query, args...)
}

func (r *propertyRepository) buildSearchQuery(filters port.PropertyFilters) (string, []interface{}) {
	baseQuery := `
		SELECT id, name, type, description, street, city, region, country, postal_code,
			   latitude, longitude, ownership_type, owner_id, agency_id, number_of_units,
			   number_of_blocks, number_of_floors, service_charge_rate, service_charge_type,
			   amenities, access_control, maintenance_schedule, status, year_built,
			   last_renovation, documents, images, created_by, created_at, updated_at
		FROM properties WHERE 1=1`

	var whereClauses []string
	var args []interface{}
	argCount := 0

	if filters.OwnerID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("owner_id = $%d", argCount))
		args = append(args, *filters.OwnerID)
	}

	if filters.AgencyID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("agency_id = $%d", argCount))
		args = append(args, *filters.AgencyID)
	}

	if filters.Type != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("type = $%d", argCount))
		args = append(args, *filters.Type)
	}

	if filters.Status != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *filters.Status)
	}

	if filters.City != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("city ILIKE $%d", argCount))
		args = append(args, "%"+*filters.City+"%")
	}

	if filters.Region != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("region ILIKE $%d", argCount))
		args = append(args, "%"+*filters.Region+"%")
	}

	if filters.Country != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("country ILIKE $%d", argCount))
		args = append(args, "%"+*filters.Country+"%")
	}

	if filters.MinUnits != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_units >= $%d", argCount))
		args = append(args, *filters.MinUnits)
	}

	if filters.MaxUnits != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_units <= $%d", argCount))
		args = append(args, *filters.MaxUnits)
	}

	if filters.YearBuiltMin != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("year_built >= $%d", argCount))
		args = append(args, *filters.YearBuiltMin)
	}

	if filters.YearBuiltMax != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("year_built <= $%d", argCount))
		args = append(args, *filters.YearBuiltMax)
	}

	if len(filters.Amenities) > 0 {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("amenities ?& $%d", argCount))
		args = append(args, pq.Array(filters.Amenities))
	}

	if filters.SearchQuery != nil {
		argCount++
		searchPattern := "%" + *filters.SearchQuery + "%"
		whereClauses = append(whereClauses,
			fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d OR street ILIKE $%d)", argCount, argCount, argCount))
		args = append(args, searchPattern)
	}

	// Build the complete query
	if len(whereClauses) > 0 {
		baseQuery += " AND " + strings.Join(whereClauses, " AND ")
	}

	// Add sorting
	sortBy := "created_at"
	if filters.SortBy != nil {
		sortBy = *filters.SortBy
	}
	sortOrder := "DESC"
	if filters.SortOrder != nil {
		sortOrder = *filters.SortOrder
	}
	baseQuery += fmt.Sprintf(" ORDER BY %s %s", sortBy, sortOrder)

	// Add pagination
	if filters.Limit > 0 {
		argCount++
		baseQuery += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filters.Limit)
	}

	if filters.Offset > 0 {
		argCount++
		baseQuery += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, filters.Offset)
	}

	return baseQuery, args
}

func (r *propertyRepository) buildCountQuery(filters port.PropertyFilters) (string, []interface{}) {
	baseQuery := "SELECT COUNT(*) FROM properties WHERE 1=1"

	var whereClauses []string
	var args []interface{}
	argCount := 0

	if filters.OwnerID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("owner_id = $%d", argCount))
		args = append(args, *filters.OwnerID)
	}

	if filters.AgencyID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("agency_id = $%d", argCount))
		args = append(args, *filters.AgencyID)
	}

	if filters.Type != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("type = $%d", argCount))
		args = append(args, *filters.Type)
	}

	if filters.Status != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *filters.Status)
	}

	if filters.City != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("city ILIKE $%d", argCount))
		args = append(args, "%"+*filters.City+"%")
	}

	if filters.Region != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("region ILIKE $%d", argCount))
		args = append(args, "%"+*filters.Region+"%")
	}

	if filters.SearchQuery != nil {
		argCount++
		searchPattern := "%" + *filters.SearchQuery + "%"
		whereClauses = append(whereClauses,
			fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d OR street ILIKE $%d)", argCount, argCount, argCount))
		args = append(args, searchPattern)
	}

	if len(whereClauses) > 0 {
		baseQuery += " AND " + strings.Join(whereClauses, " AND ")
	}

	return baseQuery, args
}
