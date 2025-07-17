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

type unitRepository struct {
	db *DB
}

// NewUnitRepository creates a new PostgreSQL unit repository
func NewUnitRepository(db *DB) port.UnitRepository {
	return &unitRepository{db: db}
}

func (r *unitRepository) CreateUnit(ctx context.Context, unit *domain.Unit) error {
	query := `
		INSERT INTO units (
			id, property_id, unit_number, unit_type, block_number, floor_number,
			size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			deposit_amount, deposit_months, status, condition, furnishing_type,
			water_meter_number, electric_meter_number, utility_billing_type,
			in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			lease_end_date, lease_type, documents, images, estimated_value,
			market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
			$31, $32, $33, $34, $35, $36, $37, $38
		)`

	// Convert arrays to JSON
	amenitiesJSON, _ := json.Marshal(unit.InUnitAmenities)
	appliancesJSON, _ := json.Marshal(unit.Appliances)
	documentsJSON, _ := json.Marshal(unit.Documents)
	imagesJSON, _ := json.Marshal(unit.Images)

	unit.ID = uuid.New()
	unit.CreatedAt = time.Now()
	unit.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		unit.ID, unit.PropertyID, unit.UnitNumber, unit.UnitType, unit.BlockNumber,
		unit.FloorNumber, unit.SizeSquareFeet, unit.SizeSquareMeters,
		unit.NumberOfBedrooms, unit.NumberOfBathrooms, unit.HasEnsuite, unit.HasBalcony,
		unit.HasParking, unit.ParkingSpaces, unit.RentAmount, unit.Currency,
		unit.DepositAmount, unit.DepositMonths, unit.Status, unit.Condition,
		unit.FurnishingType, unit.WaterMeterNumber, unit.ElectricMeterNumber,
		unit.UtilityBillingType, amenitiesJSON, appliancesJSON, unit.CurrentTenantID,
		unit.LeaseStartDate, unit.LeaseEndDate, unit.LeaseType, documentsJSON,
		imagesJSON, unit.EstimatedValue, unit.MarketRentEstimate, unit.LastValuationDate,
		unit.CreatedBy, unit.CreatedAt, unit.UpdatedAt,
	)

	return err
}

func (r *unitRepository) CreateUnits(ctx context.Context, units []*domain.Unit) error {
	if len(units) == 0 {
		return nil
	}

	// Use a transaction for bulk creation
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO units (
			id, property_id, unit_number, unit_type, block_number, floor_number,
			size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			deposit_amount, deposit_months, status, condition, furnishing_type,
			water_meter_number, electric_meter_number, utility_billing_type,
			in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			lease_end_date, lease_type, documents, images, estimated_value,
			market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
			$31, $32, $33, $34, $35, $36, $37, $38
		)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, unit := range units {
		// Convert arrays to JSON
		amenitiesJSON, _ := json.Marshal(unit.InUnitAmenities)
		appliancesJSON, _ := json.Marshal(unit.Appliances)
		documentsJSON, _ := json.Marshal(unit.Documents)
		imagesJSON, _ := json.Marshal(unit.Images)

		unit.ID = uuid.New()
		unit.CreatedAt = time.Now()
		unit.UpdatedAt = time.Now()

		_, err = stmt.Exec(
			unit.ID, unit.PropertyID, unit.UnitNumber, unit.UnitType, unit.BlockNumber,
			unit.FloorNumber, unit.SizeSquareFeet, unit.SizeSquareMeters,
			unit.NumberOfBedrooms, unit.NumberOfBathrooms, unit.HasEnsuite, unit.HasBalcony,
			unit.HasParking, unit.ParkingSpaces, unit.RentAmount, unit.Currency,
			unit.DepositAmount, unit.DepositMonths, unit.Status, unit.Condition,
			unit.FurnishingType, unit.WaterMeterNumber, unit.ElectricMeterNumber,
			unit.UtilityBillingType, amenitiesJSON, appliancesJSON, unit.CurrentTenantID,
			unit.LeaseStartDate, unit.LeaseEndDate, unit.LeaseType, documentsJSON,
			imagesJSON, unit.EstimatedValue, unit.MarketRentEstimate, unit.LastValuationDate,
			unit.CreatedBy, unit.CreatedAt, unit.UpdatedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *unitRepository) GetUnitByID(ctx context.Context, id uuid.UUID) (*domain.Unit, error) {
	query := `
		SELECT id, property_id, unit_number, unit_type, block_number, floor_number,
			   size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			   has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			   deposit_amount, deposit_months, status, condition, furnishing_type,
			   water_meter_number, electric_meter_number, utility_billing_type,
			   in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			   lease_end_date, lease_type, documents, images, estimated_value,
			   market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		FROM units 
		WHERE id = $1`

	unit := &domain.Unit{}
	var amenitiesJSON, appliancesJSON, documentsJSON, imagesJSON []byte

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&unit.ID, &unit.PropertyID, &unit.UnitNumber, &unit.UnitType, &unit.BlockNumber,
		&unit.FloorNumber, &unit.SizeSquareFeet, &unit.SizeSquareMeters,
		&unit.NumberOfBedrooms, &unit.NumberOfBathrooms, &unit.HasEnsuite, &unit.HasBalcony,
		&unit.HasParking, &unit.ParkingSpaces, &unit.RentAmount, &unit.Currency,
		&unit.DepositAmount, &unit.DepositMonths, &unit.Status, &unit.Condition,
		&unit.FurnishingType, &unit.WaterMeterNumber, &unit.ElectricMeterNumber,
		&unit.UtilityBillingType, &amenitiesJSON, &appliancesJSON, &unit.CurrentTenantID,
		&unit.LeaseStartDate, &unit.LeaseEndDate, &unit.LeaseType, &documentsJSON,
		&imagesJSON, &unit.EstimatedValue, &unit.MarketRentEstimate, &unit.LastValuationDate,
		&unit.CreatedBy, &unit.CreatedAt, &unit.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("unit not found")
		}
		return nil, err
	}

	// Parse JSON arrays
	json.Unmarshal(amenitiesJSON, &unit.InUnitAmenities)
	json.Unmarshal(appliancesJSON, &unit.Appliances)
	json.Unmarshal(documentsJSON, &unit.Documents)
	json.Unmarshal(imagesJSON, &unit.Images)

	return unit, nil
}

func (r *unitRepository) GetUnitsByProperty(ctx context.Context, propertyID uuid.UUID, limit, offset int) ([]*domain.Unit, error) {
	query := `
		SELECT id, property_id, unit_number, unit_type, block_number, floor_number,
			   size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			   has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			   deposit_amount, deposit_months, status, condition, furnishing_type,
			   water_meter_number, electric_meter_number, utility_billing_type,
			   in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			   lease_end_date, lease_type, documents, images, estimated_value,
			   market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		FROM units 
		WHERE property_id = $1
		ORDER BY unit_number ASC
		LIMIT $2 OFFSET $3`

	return r.scanUnits(ctx, query, propertyID, limit, offset)
}

func (r *unitRepository) UpdateUnit(ctx context.Context, unit *domain.Unit) error {
	query := `
		UPDATE units SET
			unit_number = $2, unit_type = $3, block_number = $4, floor_number = $5,
			size_square_feet = $6, size_square_meters = $7, number_of_bedrooms = $8,
			number_of_bathrooms = $9, has_ensuite = $10, has_balcony = $11, has_parking = $12,
			parking_spaces = $13, rent_amount = $14, currency = $15, deposit_amount = $16,
			deposit_months = $17, status = $18, condition = $19, furnishing_type = $20,
			water_meter_number = $21, electric_meter_number = $22, utility_billing_type = $23,
			in_unit_amenities = $24, appliances = $25, current_tenant_id = $26,
			lease_start_date = $27, lease_end_date = $28, lease_type = $29, documents = $30,
			images = $31, estimated_value = $32, market_rent_estimate = $33,
			last_valuation_date = $34, updated_at = $35
		WHERE id = $1`

	// Convert arrays to JSON
	amenitiesJSON, _ := json.Marshal(unit.InUnitAmenities)
	appliancesJSON, _ := json.Marshal(unit.Appliances)
	documentsJSON, _ := json.Marshal(unit.Documents)
	imagesJSON, _ := json.Marshal(unit.Images)

	unit.UpdatedAt = time.Now()

	_, err := r.db.ExecContext(ctx, query,
		unit.ID, unit.UnitNumber, unit.UnitType, unit.BlockNumber, unit.FloorNumber,
		unit.SizeSquareFeet, unit.SizeSquareMeters, unit.NumberOfBedrooms,
		unit.NumberOfBathrooms, unit.HasEnsuite, unit.HasBalcony, unit.HasParking,
		unit.ParkingSpaces, unit.RentAmount, unit.Currency, unit.DepositAmount,
		unit.DepositMonths, unit.Status, unit.Condition, unit.FurnishingType,
		unit.WaterMeterNumber, unit.ElectricMeterNumber, unit.UtilityBillingType,
		amenitiesJSON, appliancesJSON, unit.CurrentTenantID, unit.LeaseStartDate,
		unit.LeaseEndDate, unit.LeaseType, documentsJSON, imagesJSON,
		unit.EstimatedValue, unit.MarketRentEstimate, unit.LastValuationDate,
		unit.UpdatedAt,
	)

	return err
}

func (r *unitRepository) DeleteUnit(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM units WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *unitRepository) SearchUnits(ctx context.Context, filters port.UnitFilters) ([]*domain.Unit, error) {
	query, args := r.buildSearchQuery(filters)
	return r.scanUnitsWithArgs(ctx, query, args...)
}

func (r *unitRepository) GetUnitsCount(ctx context.Context, filters port.UnitFilters) (int, error) {
	query, args := r.buildCountQuery(filters)

	var count int
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&count)
	return count, err
}

func (r *unitRepository) GetAvailableUnits(ctx context.Context, filters port.UnitFilters) ([]*domain.Unit, error) {
	// Force status to be vacant for available units
	vacantStatus := domain.UnitStatusVacant
	filters.Status = &vacantStatus
	return r.SearchUnits(ctx, filters)
}

func (r *unitRepository) GetUnitsByStatus(ctx context.Context, status domain.UnitStatus, limit, offset int) ([]*domain.Unit, error) {
	query := `
		SELECT id, property_id, unit_number, unit_type, block_number, floor_number,
			   size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			   has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			   deposit_amount, deposit_months, status, condition, furnishing_type,
			   water_meter_number, electric_meter_number, utility_billing_type,
			   in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			   lease_end_date, lease_type, documents, images, estimated_value,
			   market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		FROM units 
		WHERE status = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	return r.scanUnits(ctx, query, status, limit, offset)
}

func (r *unitRepository) GetUnitsByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Unit, error) {
	query := `
		SELECT id, property_id, unit_number, unit_type, block_number, floor_number,
			   size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			   has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			   deposit_amount, deposit_months, status, condition, furnishing_type,
			   water_meter_number, electric_meter_number, utility_billing_type,
			   in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			   lease_end_date, lease_type, documents, images, estimated_value,
			   market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		FROM units 
		WHERE current_tenant_id = $1
		ORDER BY created_at DESC`

	return r.scanUnits(ctx, query, tenantID)
}

func (r *unitRepository) UpdateUnitStatus(ctx context.Context, unitID uuid.UUID, status domain.UnitStatus) error {
	query := `UPDATE units SET status = $2, updated_at = $3 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, unitID, status, time.Now())
	return err
}

func (r *unitRepository) AssignTenant(ctx context.Context, unitID, tenantID uuid.UUID, leaseStart, leaseEnd *string) error {
	query := `
		UPDATE units SET 
			current_tenant_id = $2, 
			lease_start_date = $3, 
			lease_end_date = $4, 
			status = $5, 
			updated_at = $6 
		WHERE id = $1`

	var startDate, endDate sql.NullTime
	if leaseStart != nil {
		if parsedDate, err := time.Parse("2006-01-02", *leaseStart); err == nil {
			startDate = sql.NullTime{Time: parsedDate, Valid: true}
		}
	}
	if leaseEnd != nil {
		if parsedDate, err := time.Parse("2006-01-02", *leaseEnd); err == nil {
			endDate = sql.NullTime{Time: parsedDate, Valid: true}
		}
	}

	_, err := r.db.ExecContext(ctx, query, unitID, tenantID, startDate, endDate, domain.UnitStatusOccupied, time.Now())
	return err
}

func (r *unitRepository) ReleaseTenant(ctx context.Context, unitID uuid.UUID) error {
	query := `
		UPDATE units SET 
			current_tenant_id = NULL, 
			lease_start_date = NULL, 
			lease_end_date = NULL, 
			status = $2, 
			updated_at = $3 
		WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, unitID, domain.UnitStatusVacant, time.Now())
	return err
}

func (r *unitRepository) GetUnitStats(ctx context.Context, propertyID *uuid.UUID, ownerID *uuid.UUID) (*port.UnitStats, error) {
	var whereClause string
	var args []interface{}
	argCount := 0

	if propertyID != nil {
		argCount++
		whereClause = fmt.Sprintf("WHERE property_id = $%d", argCount)
		args = append(args, *propertyID)
	} else if ownerID != nil {
		argCount++
		whereClause = fmt.Sprintf("WHERE property_id IN (SELECT id FROM properties WHERE owner_id = $%d)", argCount)
		args = append(args, *ownerID)
	}

	query := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_units,
			SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
			SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
			AVG(rent_amount) as average_rent,
			SUM(CASE WHEN status = 'occupied' THEN rent_amount ELSE 0 END) as actual_revenue,
			SUM(rent_amount) as potential_revenue,
			unit_type,
			status
		FROM units 
		%s
		GROUP BY unit_type, status`, whereClause)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := &port.UnitStats{
		UnitsByType:   make(map[domain.UnitType]int),
		UnitsByStatus: make(map[domain.UnitStatus]int),
	}

	for rows.Next() {
		var count, occupiedUnits, vacantUnits int
		var avgRent, actualRevenue, potentialRevenue float64
		var unitType domain.UnitType
		var status domain.UnitStatus

		err := rows.Scan(&count, &occupiedUnits, &vacantUnits, &avgRent,
			&actualRevenue, &potentialRevenue, &unitType, &status)
		if err != nil {
			return nil, err
		}

		stats.TotalUnits += count
		stats.OccupiedUnits += occupiedUnits
		stats.VacantUnits += vacantUnits
		stats.TotalMonthlyRevenue += actualRevenue
		stats.PotentialRevenue += potentialRevenue
		stats.AverageRent = avgRent

		stats.UnitsByType[unitType] += count
		stats.UnitsByStatus[status] += count
	}

	// Calculate occupancy rate and revenue efficiency
	if stats.TotalUnits > 0 {
		stats.OccupancyRate = float64(stats.OccupiedUnits) / float64(stats.TotalUnits) * 100
	}
	if stats.PotentialRevenue > 0 {
		stats.RevenueEfficiency = stats.TotalMonthlyRevenue / stats.PotentialRevenue * 100
	}

	return stats, nil
}

func (r *unitRepository) GetOccupancyRate(ctx context.Context, propertyID uuid.UUID) (float64, error) {
	query := `
		SELECT 
			COUNT(*) as total_units,
			SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_units
		FROM units 
		WHERE property_id = $1`

	var totalUnits, occupiedUnits int
	err := r.db.QueryRowContext(ctx, query, propertyID).Scan(&totalUnits, &occupiedUnits)
	if err != nil {
		return 0, err
	}

	if totalUnits == 0 {
		return 0, nil
	}

	return float64(occupiedUnits) / float64(totalUnits) * 100, nil
}

// Helper methods

func (r *unitRepository) scanUnits(ctx context.Context, query string, args ...interface{}) ([]*domain.Unit, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var units []*domain.Unit
	for rows.Next() {
		unit := &domain.Unit{}
		var amenitiesJSON, appliancesJSON, documentsJSON, imagesJSON []byte

		err := rows.Scan(
			&unit.ID, &unit.PropertyID, &unit.UnitNumber, &unit.UnitType, &unit.BlockNumber,
			&unit.FloorNumber, &unit.SizeSquareFeet, &unit.SizeSquareMeters,
			&unit.NumberOfBedrooms, &unit.NumberOfBathrooms, &unit.HasEnsuite, &unit.HasBalcony,
			&unit.HasParking, &unit.ParkingSpaces, &unit.RentAmount, &unit.Currency,
			&unit.DepositAmount, &unit.DepositMonths, &unit.Status, &unit.Condition,
			&unit.FurnishingType, &unit.WaterMeterNumber, &unit.ElectricMeterNumber,
			&unit.UtilityBillingType, &amenitiesJSON, &appliancesJSON, &unit.CurrentTenantID,
			&unit.LeaseStartDate, &unit.LeaseEndDate, &unit.LeaseType, &documentsJSON,
			&imagesJSON, &unit.EstimatedValue, &unit.MarketRentEstimate, &unit.LastValuationDate,
			&unit.CreatedBy, &unit.CreatedAt, &unit.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Parse JSON arrays
		json.Unmarshal(amenitiesJSON, &unit.InUnitAmenities)
		json.Unmarshal(appliancesJSON, &unit.Appliances)
		json.Unmarshal(documentsJSON, &unit.Documents)
		json.Unmarshal(imagesJSON, &unit.Images)

		units = append(units, unit)
	}

	return units, nil
}

func (r *unitRepository) scanUnitsWithArgs(ctx context.Context, query string, args ...interface{}) ([]*domain.Unit, error) {
	return r.scanUnits(ctx, query, args...)
}

func (r *unitRepository) buildSearchQuery(filters port.UnitFilters) (string, []interface{}) {
	baseQuery := `
		SELECT id, property_id, unit_number, unit_type, block_number, floor_number,
			   size_square_feet, size_square_meters, number_of_bedrooms, number_of_bathrooms,
			   has_ensuite, has_balcony, has_parking, parking_spaces, rent_amount, currency,
			   deposit_amount, deposit_months, status, condition, furnishing_type,
			   water_meter_number, electric_meter_number, utility_billing_type,
			   in_unit_amenities, appliances, current_tenant_id, lease_start_date,
			   lease_end_date, lease_type, documents, images, estimated_value,
			   market_rent_estimate, last_valuation_date, created_by, created_at, updated_at
		FROM units WHERE 1=1`

	var whereClauses []string
	var args []interface{}
	argCount := 0

	if filters.PropertyID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("property_id = $%d", argCount))
		args = append(args, *filters.PropertyID)
	}

	if filters.UnitType != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("unit_type = $%d", argCount))
		args = append(args, *filters.UnitType)
	}

	if filters.Status != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *filters.Status)
	}

	if filters.Condition != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("condition = $%d", argCount))
		args = append(args, *filters.Condition)
	}

	if filters.FurnishingType != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("furnishing_type = $%d", argCount))
		args = append(args, *filters.FurnishingType)
	}

	if filters.MinRent != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("rent_amount >= $%d", argCount))
		args = append(args, *filters.MinRent)
	}

	if filters.MaxRent != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("rent_amount <= $%d", argCount))
		args = append(args, *filters.MaxRent)
	}

	if filters.MinBedrooms != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_bedrooms >= $%d", argCount))
		args = append(args, *filters.MinBedrooms)
	}

	if filters.MaxBedrooms != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_bedrooms <= $%d", argCount))
		args = append(args, *filters.MaxBedrooms)
	}

	if filters.MinBathrooms != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_bathrooms >= $%d", argCount))
		args = append(args, *filters.MinBathrooms)
	}

	if filters.MaxBathrooms != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("number_of_bathrooms <= $%d", argCount))
		args = append(args, *filters.MaxBathrooms)
	}

	if filters.HasEnsuite != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("has_ensuite = $%d", argCount))
		args = append(args, *filters.HasEnsuite)
	}

	if filters.HasBalcony != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("has_balcony = $%d", argCount))
		args = append(args, *filters.HasBalcony)
	}

	if filters.HasParking != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("has_parking = $%d", argCount))
		args = append(args, *filters.HasParking)
	}

	if filters.MinSize != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("size_square_meters >= $%d", argCount))
		args = append(args, *filters.MinSize)
	}

	if filters.MaxSize != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("size_square_meters <= $%d", argCount))
		args = append(args, *filters.MaxSize)
	}

	if len(filters.Amenities) > 0 {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("in_unit_amenities ?& $%d", argCount))
		args = append(args, pq.Array(filters.Amenities))
	}

	if len(filters.Appliances) > 0 {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("appliances ?& $%d", argCount))
		args = append(args, pq.Array(filters.Appliances))
	}

	if filters.CurrentTenantID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("current_tenant_id = $%d", argCount))
		args = append(args, *filters.CurrentTenantID)
	}

	if filters.BlockNumber != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("block_number ILIKE $%d", argCount))
		args = append(args, "%"+*filters.BlockNumber+"%")
	}

	if filters.FloorNumber != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("floor_number = $%d", argCount))
		args = append(args, *filters.FloorNumber)
	}

	if filters.SearchQuery != nil {
		argCount++
		searchPattern := "%" + *filters.SearchQuery + "%"
		whereClauses = append(whereClauses,
			fmt.Sprintf("unit_number ILIKE $%d", argCount))
		args = append(args, searchPattern)
	}

	// Build the complete query
	if len(whereClauses) > 0 {
		baseQuery += " AND " + strings.Join(whereClauses, " AND ")
	}

	// Add sorting
	sortBy := "unit_number"
	if filters.SortBy != nil {
		sortBy = *filters.SortBy
	}
	sortOrder := "ASC"
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

func (r *unitRepository) buildCountQuery(filters port.UnitFilters) (string, []interface{}) {
	baseQuery := "SELECT COUNT(*) FROM units WHERE 1=1"

	var whereClauses []string
	var args []interface{}
	argCount := 0

	if filters.PropertyID != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("property_id = $%d", argCount))
		args = append(args, *filters.PropertyID)
	}

	if filters.UnitType != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("unit_type = $%d", argCount))
		args = append(args, *filters.UnitType)
	}

	if filters.Status != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argCount))
		args = append(args, *filters.Status)
	}

	if filters.MinRent != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("rent_amount >= $%d", argCount))
		args = append(args, *filters.MinRent)
	}

	if filters.MaxRent != nil {
		argCount++
		whereClauses = append(whereClauses, fmt.Sprintf("rent_amount <= $%d", argCount))
		args = append(args, *filters.MaxRent)
	}

	if filters.SearchQuery != nil {
		argCount++
		searchPattern := "%" + *filters.SearchQuery + "%"
		whereClauses = append(whereClauses,
			fmt.Sprintf("unit_number ILIKE $%d", argCount))
		args = append(args, searchPattern)
	}

	if len(whereClauses) > 0 {
		baseQuery += " AND " + strings.Join(whereClauses, " AND ")
	}

	return baseQuery, args
}
