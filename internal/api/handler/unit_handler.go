package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/utils"
)

type UnitHandler struct {
	unitService port.UnitService
}

// NewUnitHandler creates a new unit handler
func NewUnitHandler(unitService port.UnitService) *UnitHandler {
	return &UnitHandler{
		unitService: unitService,
	}
}

// CreateUnit handles POST /api/units
func (h *UnitHandler) CreateUnit(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req port.CreateUnitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Create unit
	unit, err := h.unitService.CreateUnit(r.Context(), &req)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to create unit", err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Unit created successfully",
		"data":    unit,
	})
}

// CreateUnits handles POST /api/units/batch
func (h *UnitHandler) CreateUnits(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req port.CreateUnitsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Create units
	units, err := h.unitService.CreateUnits(r.Context(), &req)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to create units", err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Units created successfully",
		"data":    units,
	})
}

// GetUnit handles GET /api/units/{id}
func (h *UnitHandler) GetUnit(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Get unit
	unit, err := h.unitService.GetUnit(r.Context(), unitID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "unit not found", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    unit,
	})
}

// UpdateUnit handles PUT /api/units/{id}
func (h *UnitHandler) UpdateUnit(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Parse request body
	var req port.UpdateUnitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Update unit
	unit, err := h.unitService.UpdateUnit(r.Context(), unitID, &req, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to update unit", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Unit updated successfully",
		"data":    unit,
	})
}

// DeleteUnit handles DELETE /api/units/{id}
func (h *UnitHandler) DeleteUnit(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Delete unit
	err = h.unitService.DeleteUnit(r.Context(), unitID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to delete unit", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Unit deleted successfully",
	})
}

// ListUnits handles GET /api/units
func (h *UnitHandler) ListUnits(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse query parameters
	filters := h.parseUnitFilters(r)

	// Get units
	response, err := h.unitService.ListUnits(r.Context(), filters, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "failed to get units", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    response,
	})
}

// UpdateUnitStatus handles PATCH /api/units/{id}/status
func (h *UnitHandler) UpdateUnitStatus(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Parse request body
	var req struct {
		Status domain.UnitStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Update status
	err = h.unitService.UpdateUnitStatus(r.Context(), unitID, req.Status, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to update unit status", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Unit status updated successfully",
	})
}

// AssignTenant handles POST /api/units/{id}/assign-tenant
func (h *UnitHandler) AssignTenant(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Parse request body
	var req port.AssignTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Set unit ID from URL
	req.UnitID = unitID

	// Assign tenant
	err = h.unitService.AssignTenant(r.Context(), &req, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to assign tenant", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tenant assigned successfully",
	})
}

// ReleaseTenant handles POST /api/units/{id}/release-tenant
func (h *UnitHandler) ReleaseTenant(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse unit ID
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid unit ID", err)
		return
	}

	// Release tenant
	err = h.unitService.ReleaseTenant(r.Context(), unitID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to release tenant", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tenant released successfully",
	})
}

// SearchAvailableUnits handles GET /api/units/available
func (h *UnitHandler) SearchAvailableUnits(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	filters := h.parseUnitFilters(r)

	// Search available units
	response, err := h.unitService.SearchAvailableUnits(r.Context(), filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "failed to search available units", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    response,
	})
}

// GetUnitRecommendations handles GET /api/units/recommendations
func (h *UnitHandler) GetUnitRecommendations(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse preferences from query parameters
	preferences := h.parseUnitPreferences(r)

	// Get recommendations
	units, err := h.unitService.GetUnitRecommendations(r.Context(), userID, &preferences)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "failed to get recommendations", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    units,
	})
}

// Helper methods

func (h *UnitHandler) parseUnitFilters(r *http.Request) port.UnitFilters {
	query := r.URL.Query()
	filters := port.UnitFilters{
		Limit:  20, // default
		Offset: 0,  // default
	}

	// Parse pagination
	if limit := query.Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 && l <= 100 {
			filters.Limit = l
		}
	}

	if offset := query.Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			filters.Offset = o
		}
	}

	// Parse page (alternative to offset)
	if page := query.Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil && p > 0 {
			filters.Offset = (p - 1) * filters.Limit
		}
	}

	// Parse filters
	if propertyID := query.Get("property_id"); propertyID != "" {
		if id, err := uuid.Parse(propertyID); err == nil {
			filters.PropertyID = &id
		}
	}

	if unitType := query.Get("unit_type"); unitType != "" {
		uType := domain.UnitType(unitType)
		filters.UnitType = &uType
	}

	if status := query.Get("status"); status != "" {
		uStatus := domain.UnitStatus(status)
		filters.Status = &uStatus
	}

	if condition := query.Get("condition"); condition != "" {
		uCondition := domain.UnitCondition(condition)
		filters.Condition = &uCondition
	}

	if furnishingType := query.Get("furnishing_type"); furnishingType != "" {
		fType := domain.FurnishingType(furnishingType)
		filters.FurnishingType = &fType
	}

	if minRent := query.Get("min_rent"); minRent != "" {
		if r, err := strconv.ParseFloat(minRent, 64); err == nil {
			filters.MinRent = &r
		}
	}

	if maxRent := query.Get("max_rent"); maxRent != "" {
		if r, err := strconv.ParseFloat(maxRent, 64); err == nil {
			filters.MaxRent = &r
		}
	}

	if minBedrooms := query.Get("min_bedrooms"); minBedrooms != "" {
		if b, err := strconv.Atoi(minBedrooms); err == nil {
			filters.MinBedrooms = &b
		}
	}

	if maxBedrooms := query.Get("max_bedrooms"); maxBedrooms != "" {
		if b, err := strconv.Atoi(maxBedrooms); err == nil {
			filters.MaxBedrooms = &b
		}
	}

	if minBathrooms := query.Get("min_bathrooms"); minBathrooms != "" {
		if b, err := strconv.Atoi(minBathrooms); err == nil {
			filters.MinBathrooms = &b
		}
	}

	if maxBathrooms := query.Get("max_bathrooms"); maxBathrooms != "" {
		if b, err := strconv.Atoi(maxBathrooms); err == nil {
			filters.MaxBathrooms = &b
		}
	}

	if hasEnsuite := query.Get("has_ensuite"); hasEnsuite != "" {
		if e, err := strconv.ParseBool(hasEnsuite); err == nil {
			filters.HasEnsuite = &e
		}
	}

	if hasBalcony := query.Get("has_balcony"); hasBalcony != "" {
		if b, err := strconv.ParseBool(hasBalcony); err == nil {
			filters.HasBalcony = &b
		}
	}

	if hasParking := query.Get("has_parking"); hasParking != "" {
		if p, err := strconv.ParseBool(hasParking); err == nil {
			filters.HasParking = &p
		}
	}

	if minSize := query.Get("min_size"); minSize != "" {
		if s, err := strconv.ParseFloat(minSize, 64); err == nil {
			filters.MinSize = &s
		}
	}

	if maxSize := query.Get("max_size"); maxSize != "" {
		if s, err := strconv.ParseFloat(maxSize, 64); err == nil {
			filters.MaxSize = &s
		}
	}

	if amenities := query["amenities"]; len(amenities) > 0 {
		filters.Amenities = amenities
	}

	if appliances := query["appliances"]; len(appliances) > 0 {
		filters.Appliances = appliances
	}

	if availableFrom := query.Get("available_from"); availableFrom != "" {
		filters.AvailableFrom = &availableFrom
	}

	if leaseType := query.Get("lease_type"); leaseType != "" {
		filters.LeaseType = &leaseType
	}

	if tenantID := query.Get("tenant_id"); tenantID != "" {
		if id, err := uuid.Parse(tenantID); err == nil {
			filters.CurrentTenantID = &id
		}
	}

	if blockNumber := query.Get("block_number"); blockNumber != "" {
		filters.BlockNumber = &blockNumber
	}

	if floorNumber := query.Get("floor_number"); floorNumber != "" {
		if f, err := strconv.Atoi(floorNumber); err == nil {
			filters.FloorNumber = &f
		}
	}

	if search := query.Get("search"); search != "" {
		filters.SearchQuery = &search
	}

	if sortBy := query.Get("sort_by"); sortBy != "" {
		filters.SortBy = &sortBy
	}

	if sortOrder := query.Get("sort_order"); sortOrder != "" {
		filters.SortOrder = &sortOrder
	}

	return filters
}

func (h *UnitHandler) parseUnitPreferences(r *http.Request) port.UnitPreferences {
	query := r.URL.Query()
	preferences := port.UnitPreferences{}

	if minRent := query.Get("min_rent"); minRent != "" {
		if r, err := strconv.ParseFloat(minRent, 64); err == nil {
			preferences.MinRent = &r
		}
	}

	if maxRent := query.Get("max_rent"); maxRent != "" {
		if r, err := strconv.ParseFloat(maxRent, 64); err == nil {
			preferences.MaxRent = &r
		}
	}

	if unitTypes := query["unit_types"]; len(unitTypes) > 0 {
		var types []domain.UnitType
		for _, t := range unitTypes {
			types = append(types, domain.UnitType(t))
		}
		preferences.UnitTypes = types
	}

	if minBedrooms := query.Get("min_bedrooms"); minBedrooms != "" {
		if b, err := strconv.Atoi(minBedrooms); err == nil {
			preferences.MinBedrooms = &b
		}
	}

	if maxBedrooms := query.Get("max_bedrooms"); maxBedrooms != "" {
		if b, err := strconv.Atoi(maxBedrooms); err == nil {
			preferences.MaxBedrooms = &b
		}
	}

	if requiredAmenities := query["required_amenities"]; len(requiredAmenities) > 0 {
		preferences.RequiredAmenities = requiredAmenities
	}

	if preferredLocations := query["preferred_locations"]; len(preferredLocations) > 0 {
		preferences.PreferredLocations = preferredLocations
	}

	if furnishingType := query.Get("furnishing_type"); furnishingType != "" {
		fType := domain.FurnishingType(furnishingType)
		preferences.FurnishingType = &fType
	}

	if hasParking := query.Get("has_parking"); hasParking != "" {
		if p, err := strconv.ParseBool(hasParking); err == nil {
			preferences.HasParking = &p
		}
	}

	if hasBalcony := query.Get("has_balcony"); hasBalcony != "" {
		if b, err := strconv.ParseBool(hasBalcony); err == nil {
			preferences.HasBalcony = &b
		}
	}

	return preferences
}
