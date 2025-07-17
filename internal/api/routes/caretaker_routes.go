package routes

import (
	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/api/service"

	"github.com/gorilla/mux"
)

// SetupCaretakerRoutes sets up all caretaker-related routes
func SetupCaretakerRoutes(r *mux.Router, authMiddleware *middleware.AuthMiddleware) {
	// Create mock caretaker service for now
	caretakerService := service.NewMockCaretakerService()
	caretakerHandler := handler.NewCaretakerHandler(caretakerService)

	// Create caretaker subrouter with authentication middleware
	caretakerRouter := r.PathPrefix("/api/v1/caretaker").Subrouter()
	caretakerRouter.Use(authMiddleware.RequireAuth)
	caretakerRouter.Use(authMiddleware.RequireRole([]string{"caretaker", "super_admin", "agency_admin"}))

	// Dashboard endpoints
	caretakerRouter.HandleFunc("/dashboard", caretakerHandler.GetCaretakerDashboard).Methods("GET")
	caretakerRouter.HandleFunc("/stats", caretakerHandler.GetCaretakerStats).Methods("GET")

	// Task management endpoints
	caretakerRouter.HandleFunc("/tasks", caretakerHandler.GetTasks).Methods("GET")
	caretakerRouter.HandleFunc("/tasks/{taskId}", caretakerHandler.GetTaskDetails).Methods("GET")
	caretakerRouter.HandleFunc("/tasks/{taskId}/status", caretakerHandler.UpdateTaskStatus).Methods("PUT")
	caretakerRouter.HandleFunc("/tasks/{taskId}/updates", caretakerHandler.AddTaskUpdate).Methods("POST")

	// Tenant movement endpoints
	caretakerRouter.HandleFunc("/movements", caretakerHandler.GetTenantMovements).Methods("GET")
	caretakerRouter.HandleFunc("/movements/{movementId}/status", caretakerHandler.UpdateMovementStatus).Methods("PUT")

	// Unit condition endpoints
	caretakerRouter.HandleFunc("/conditions", caretakerHandler.GetUnitConditions).Methods("GET")
	caretakerRouter.HandleFunc("/conditions", caretakerHandler.CreateUnitCondition).Methods("POST")
	caretakerRouter.HandleFunc("/conditions/{conditionId}", caretakerHandler.UpdateUnitCondition).Methods("PUT")

	// Photo endpoints (using existing methods)
	caretakerRouter.HandleFunc("/units/{unitId}/photos", caretakerHandler.UploadUnitPhoto).Methods("POST")
	caretakerRouter.HandleFunc("/units/{unitId}/photos", caretakerHandler.GetUnitPhotos).Methods("GET")

	// QR scanner endpoint
	caretakerRouter.HandleFunc("/qr/scan", caretakerHandler.ScanUnitQR).Methods("POST")

	// Maintenance endpoints
	caretakerRouter.HandleFunc("/maintenance", caretakerHandler.GetMaintenanceRequests).Methods("GET")
	caretakerRouter.HandleFunc("/maintenance/{requestId}", caretakerHandler.UpdateMaintenanceRequest).Methods("PUT")

	// Emergency endpoint
	caretakerRouter.HandleFunc("/emergency/report", caretakerHandler.ReportEmergency).Methods("POST")

	// Assignment endpoints
	caretakerRouter.HandleFunc("/assignments", caretakerHandler.GetAssignments).Methods("GET")
	caretakerRouter.HandleFunc("/properties", caretakerHandler.GetAssignedProperties).Methods("GET")
	caretakerRouter.HandleFunc("/activity", caretakerHandler.GetRecentActivity).Methods("GET")
}
