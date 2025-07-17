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

type PropertyHandler struct {
	propertyService port.PropertyService
	unitService     port.UnitService
}

// NewPropertyHandler creates a new property handler
func NewPropertyHandler(propertyService port.PropertyService, unitService port.UnitService) *PropertyHandler {
	return &PropertyHandler{
		propertyService: propertyService,
		unitService:     unitService,
	}
}

// CreateProperty handles POST /api/properties
func (h *PropertyHandler) CreateProperty(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req port.CreatePropertyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Create property
	property, err := h.propertyService.CreateProperty(r.Context(), &req)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to create property", err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Property created successfully",
		"data":    property,
	})
}

// GetProperty handles GET /api/properties/{id}
func (h *PropertyHandler) GetProperty(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Get property
	property, err := h.propertyService.GetProperty(r.Context(), propertyID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusNotFound, "property not found", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    property,
	})
}

// UpdateProperty handles PUT /api/properties/{id}
func (h *PropertyHandler) UpdateProperty(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Parse request body
	var req port.UpdatePropertyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Update property
	property, err := h.propertyService.UpdateProperty(r.Context(), propertyID, &req, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to update property", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Property updated successfully",
		"data":    property,
	})
}

// DeleteProperty handles DELETE /api/properties/{id}
func (h *PropertyHandler) DeleteProperty(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Delete property
	err = h.propertyService.DeleteProperty(r.Context(), propertyID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to delete property", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Property deleted successfully",
	})
}

// ListProperties handles GET /api/properties
func (h *PropertyHandler) ListProperties(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse query parameters
	filters := h.parsePropertyFilters(r)

	// Get properties
	response, err := h.propertyService.ListProperties(r.Context(), filters, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "failed to get properties", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    response,
	})
}

// GetPropertyAnalytics handles GET /api/properties/{id}/analytics
func (h *PropertyHandler) GetPropertyAnalytics(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Get analytics
	analytics, err := h.propertyService.GetPropertyAnalytics(r.Context(), propertyID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to get analytics", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    analytics,
	})
}

// GetPropertyUnits handles GET /api/properties/{id}/units
func (h *PropertyHandler) GetPropertyUnits(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Parse unit filters from query parameters
	filters := h.parseUnitFilters(r)
	// Set the property ID filter
	filters.PropertyID = &propertyID

	// Get units for the property
	response, err := h.unitService.ListUnits(r.Context(), filters, userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "failed to get property units", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"data":     response.Units,
		"total":    response.Total,
		"page":     response.Page,
		"per_page": response.PerPage,
	})
}

// GetOccupancyReport handles GET /api/properties/{id}/reports/occupancy
func (h *PropertyHandler) GetOccupancyReport(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Get occupancy report
	report, err := h.propertyService.GetOccupancyReport(r.Context(), propertyID, userID)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to get occupancy report", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    report,
	})
}

// GetRevenueReport handles GET /api/properties/{id}/reports/revenue
func (h *PropertyHandler) GetRevenueReport(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	userID, err := utils.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	// Parse property ID
	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid property ID", err)
		return
	}

	// Get period parameter
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "monthly" // default
	}

	// Get revenue report
	report, err := h.propertyService.GetRevenueReport(r.Context(), propertyID, userID, period)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to get revenue report", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    report,
	})
}

// Helper methods

func (h *PropertyHandler) parsePropertyFilters(r *http.Request) port.PropertyFilters {
	query := r.URL.Query()
	filters := port.PropertyFilters{
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
	if ownerID := query.Get("owner_id"); ownerID != "" {
		if id, err := uuid.Parse(ownerID); err == nil {
			filters.OwnerID = &id
		}
	}

	if agencyID := query.Get("agency_id"); agencyID != "" {
		if id, err := uuid.Parse(agencyID); err == nil {
			filters.AgencyID = &id
		}
	}

	if propType := query.Get("type"); propType != "" {
		propertyType := domain.PropertyType(propType)
		filters.Type = &propertyType
	}

	if status := query.Get("status"); status != "" {
		propertyStatus := domain.PropertyStatus(status)
		filters.Status = &propertyStatus
	}

	if city := query.Get("city"); city != "" {
		filters.City = &city
	}

	if region := query.Get("region"); region != "" {
		filters.Region = &region
	}

	if country := query.Get("country"); country != "" {
		filters.Country = &country
	}

	if minUnits := query.Get("min_units"); minUnits != "" {
		if m, err := strconv.Atoi(minUnits); err == nil {
			filters.MinUnits = &m
		}
	}

	if maxUnits := query.Get("max_units"); maxUnits != "" {
		if m, err := strconv.Atoi(maxUnits); err == nil {
			filters.MaxUnits = &m
		}
	}

	if yearBuiltMin := query.Get("year_built_min"); yearBuiltMin != "" {
		if y, err := strconv.Atoi(yearBuiltMin); err == nil {
			filters.YearBuiltMin = &y
		}
	}

	if yearBuiltMax := query.Get("year_built_max"); yearBuiltMax != "" {
		if y, err := strconv.Atoi(yearBuiltMax); err == nil {
			filters.YearBuiltMax = &y
		}
	}

	if amenities := query["amenities"]; len(amenities) > 0 {
		filters.Amenities = amenities
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

func (h *PropertyHandler) parseUnitFilters(r *http.Request) port.UnitFilters {
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

	if status := query.Get("status"); status != "" {
		unitStatus := domain.UnitStatus(status)
		filters.Status = &unitStatus
	}

	if unitType := query.Get("unit_type"); unitType != "" {
		uType := domain.UnitType(unitType)
		filters.UnitType = &uType
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

	if amenities := query["amenities"]; len(amenities) > 0 {
		filters.Amenities = amenities
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
