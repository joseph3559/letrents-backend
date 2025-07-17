package routes

import (
	"github.com/gorilla/mux"

	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/core/port"
)

// SetupPropertyRoutes configures all property and unit management routes
func SetupPropertyRoutes(
	router *mux.Router,
	propertyHandler *handler.PropertyHandler,
	unitHandler *handler.UnitHandler,
	authMiddleware *middleware.AuthMiddleware,
) {
	// Property routes
	propertyRouter := router.PathPrefix("/properties").Subrouter()

	// Apply authentication middleware to all property routes
	propertyRouter.Use(authMiddleware.RequireAuth)

	// Property CRUD operations
	propertyRouter.HandleFunc("", propertyHandler.CreateProperty).Methods("POST")
	propertyRouter.HandleFunc("", propertyHandler.ListProperties).Methods("GET")
	propertyRouter.HandleFunc("/{id}", propertyHandler.GetProperty).Methods("GET")
	propertyRouter.HandleFunc("/{id}", propertyHandler.UpdateProperty).Methods("PUT")
	propertyRouter.HandleFunc("/{id}", propertyHandler.DeleteProperty).Methods("DELETE")

	// Property units - NEW ENDPOINT
	propertyRouter.HandleFunc("/{id}/units", propertyHandler.GetPropertyUnits).Methods("GET")

	// Property analytics and reports
	propertyRouter.HandleFunc("/{id}/analytics", propertyHandler.GetPropertyAnalytics).Methods("GET")
	propertyRouter.HandleFunc("/{id}/reports/occupancy", propertyHandler.GetOccupancyReport).Methods("GET")
	propertyRouter.HandleFunc("/{id}/reports/revenue", propertyHandler.GetRevenueReport).Methods("GET")

	// Unit routes
	unitRouter := router.PathPrefix("/units").Subrouter()

	// Apply authentication middleware to all unit routes
	unitRouter.Use(authMiddleware.RequireAuth)

	// Unit CRUD operations
	unitRouter.HandleFunc("", unitHandler.CreateUnit).Methods("POST")
	unitRouter.HandleFunc("/batch", unitHandler.CreateUnits).Methods("POST")
	unitRouter.HandleFunc("", unitHandler.ListUnits).Methods("GET")
	unitRouter.HandleFunc("/{id}", unitHandler.GetUnit).Methods("GET")
	unitRouter.HandleFunc("/{id}", unitHandler.UpdateUnit).Methods("PUT")
	unitRouter.HandleFunc("/{id}", unitHandler.DeleteUnit).Methods("DELETE")

	// Unit status management
	unitRouter.HandleFunc("/{id}/status", unitHandler.UpdateUnitStatus).Methods("PATCH")

	// Tenant management
	unitRouter.HandleFunc("/{id}/assign-tenant", unitHandler.AssignTenant).Methods("POST")
	unitRouter.HandleFunc("/{id}/release-tenant", unitHandler.ReleaseTenant).Methods("POST")

	// Unit search and recommendations
	unitRouter.HandleFunc("/available", unitHandler.SearchAvailableUnits).Methods("GET")
	unitRouter.HandleFunc("/recommendations", unitHandler.GetUnitRecommendations).Methods("GET")
}

// SetupPropertyManagementRoutes is an alternative function that sets up all property management routes
// This includes properties, units, documents, inspections, and inventory
func SetupPropertyManagementRoutes(
	router *mux.Router,
	propertyService port.PropertyService,
	unitService port.UnitService,
	authMiddleware *middleware.AuthMiddleware,
) {
	// Create handlers
	propertyHandler := handler.NewPropertyHandler(propertyService, unitService)
	unitHandler := handler.NewUnitHandler(unitService)

	// Setup routes
	SetupPropertyRoutes(router, propertyHandler, unitHandler, authMiddleware)

	// Setup additional routes for documents, inspections, inventory etc.
	// These would be implemented as additional handlers and routes
	setupDocumentRoutes(router, authMiddleware)
	setupInspectionRoutes(router, authMiddleware)
	setupInventoryRoutes(router, authMiddleware)
}

// setupDocumentRoutes configures document management routes
func setupDocumentRoutes(router *mux.Router, authMiddleware *middleware.AuthMiddleware) {
	// Document routes for properties and units
	docRouter := router.PathPrefix("/documents").Subrouter()
	docRouter.Use(authMiddleware.RequireAuth)

	// Property documents
	docRouter.HandleFunc("/properties/{property_id}", nil).Methods("GET")             // List property documents
	docRouter.HandleFunc("/properties/{property_id}", nil).Methods("POST")            // Upload property document
	docRouter.HandleFunc("/properties/{property_id}/{doc_id}", nil).Methods("GET")    // Get property document
	docRouter.HandleFunc("/properties/{property_id}/{doc_id}", nil).Methods("DELETE") // Delete property document

	// Unit documents
	docRouter.HandleFunc("/units/{unit_id}", nil).Methods("GET")             // List unit documents
	docRouter.HandleFunc("/units/{unit_id}", nil).Methods("POST")            // Upload unit document
	docRouter.HandleFunc("/units/{unit_id}/{doc_id}", nil).Methods("GET")    // Get unit document
	docRouter.HandleFunc("/units/{unit_id}/{doc_id}", nil).Methods("DELETE") // Delete unit document
}

// setupInspectionRoutes configures inspection management routes
func setupInspectionRoutes(router *mux.Router, authMiddleware *middleware.AuthMiddleware) {
	// Inspection routes
	inspectionRouter := router.PathPrefix("/inspections").Subrouter()
	inspectionRouter.Use(authMiddleware.RequireAuth)

	// Inspection CRUD
	inspectionRouter.HandleFunc("", nil).Methods("POST")        // Schedule inspection
	inspectionRouter.HandleFunc("", nil).Methods("GET")         // List inspections
	inspectionRouter.HandleFunc("/{id}", nil).Methods("GET")    // Get inspection
	inspectionRouter.HandleFunc("/{id}", nil).Methods("PUT")    // Update inspection
	inspectionRouter.HandleFunc("/{id}", nil).Methods("DELETE") // Cancel inspection

	// Inspection queries
	inspectionRouter.HandleFunc("/property/{property_id}", nil).Methods("GET") // Property inspections
	inspectionRouter.HandleFunc("/unit/{unit_id}", nil).Methods("GET")         // Unit inspections
	inspectionRouter.HandleFunc("/pending", nil).Methods("GET")                // Pending inspections
}

// setupInventoryRoutes configures inventory management routes
func setupInventoryRoutes(router *mux.Router, authMiddleware *middleware.AuthMiddleware) {
	// Inventory routes
	inventoryRouter := router.PathPrefix("/inventory").Subrouter()
	inventoryRouter.Use(authMiddleware.RequireAuth)

	// Inventory CRUD
	inventoryRouter.HandleFunc("", nil).Methods("POST")        // Add inventory item
	inventoryRouter.HandleFunc("", nil).Methods("GET")         // List inventory
	inventoryRouter.HandleFunc("/{id}", nil).Methods("GET")    // Get inventory item
	inventoryRouter.HandleFunc("/{id}", nil).Methods("PUT")    // Update inventory item
	inventoryRouter.HandleFunc("/{id}", nil).Methods("DELETE") // Remove inventory item

	// Inventory queries
	inventoryRouter.HandleFunc("/property/{property_id}", nil).Methods("GET") // Property inventory
	inventoryRouter.HandleFunc("/unit/{unit_id}", nil).Methods("GET")         // Unit inventory
	inventoryRouter.HandleFunc("/category/{category}", nil).Methods("GET")    // Inventory by category
}
