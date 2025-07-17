package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/utils"
	"time"

	"github.com/gorilla/mux"
)

// SetupLandlordRoutes configures landlord dashboard API routes
func SetupLandlordRoutes(
	router *mux.Router,
	landlordService port.LandlordService,
	authMiddleware *middleware.AuthMiddleware,
) {
	// Initialize landlord handler
	landlordHandler := handler.NewLandlordHandler(landlordService)

	// Landlord routes (protected by authentication)
	landlord := router.PathPrefix("/landlord").Subrouter()
	landlord.Use(authMiddleware.RequireAuth)
	landlord.Use(authMiddleware.RequireRole([]string{"landlord"}))

	// Dashboard routes
	landlord.HandleFunc("/dashboard", landlordHandler.GetDashboardOverview).Methods("GET")
	landlord.HandleFunc("/dashboard/stats", landlordHandler.GetDashboardStats).Methods("GET")
	landlord.HandleFunc("/dashboard/revenue", landlordHandler.GetRevenueAnalytics).Methods("GET")
	landlord.HandleFunc("/dashboard/occupancy", landlordHandler.GetOccupancyAnalytics).Methods("GET")

	// Property management routes
	landlord.HandleFunc("/properties", landlordHandler.GetLandlordProperties).Methods("GET")
	landlord.HandleFunc("/properties/{property_id}", landlordHandler.GetPropertySummary).Methods("GET")

	// Tenant management routes
	landlord.HandleFunc("/tenants", landlordHandler.GetLandlordTenants).Methods("GET")
	landlord.HandleFunc("/tenants/{tenant_id}", landlordHandler.GetTenantSummary).Methods("GET")

	// Caretaker management routes
	landlord.HandleFunc("/caretakers", func(w http.ResponseWriter, r *http.Request) {
		caretakers := []map[string]interface{}{
			{
				"id":                 "caretaker-1",
				"email":              "john.caretaker@demo.com",
				"first_name":         "John",
				"last_name":          "Mwangi",
				"phone_number":       "+254712345680",
				"role":               "caretaker",
				"specialization":     "General Maintenance",
				"experience_years":   8,
				"availability":       "available",
				"rating":             4.8,
				"properties_managed": 12,
				"created_at":         time.Now().Add(-45 * 24 * time.Hour),
				"is_active":          true,
			},
			{
				"id":                 "caretaker-2",
				"email":              "grace.caretaker@demo.com",
				"first_name":         "Grace",
				"last_name":          "Wanjiku",
				"phone_number":       "+254723456789",
				"role":               "caretaker",
				"specialization":     "Electrical & Plumbing",
				"experience_years":   6,
				"availability":       "available",
				"rating":             4.9,
				"properties_managed": 8,
				"created_at":         time.Now().Add(-30 * 24 * time.Hour),
				"is_active":          true,
			},
			{
				"id":                 "caretaker-3",
				"email":              "david.caretaker@demo.com",
				"first_name":         "David",
				"last_name":          "Ochieng",
				"phone_number":       "+254734567890",
				"role":               "caretaker",
				"specialization":     "Security & Cleaning",
				"experience_years":   10,
				"availability":       "busy",
				"rating":             4.7,
				"properties_managed": 15,
				"created_at":         time.Now().Add(-60 * 24 * time.Hour),
				"is_active":          true,
			},
			{
				"id":                 "caretaker-4",
				"email":              "mary.caretaker@demo.com",
				"first_name":         "Mary",
				"last_name":          "Njoki",
				"phone_number":       "+254745678901",
				"role":               "caretaker",
				"specialization":     "Landscaping & Garden",
				"experience_years":   4,
				"availability":       "available",
				"rating":             4.6,
				"properties_managed": 6,
				"created_at":         time.Now().Add(-20 * 24 * time.Hour),
				"is_active":          true,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Caretakers retrieved successfully", caretakers)
	}).Methods("GET")

	// Create new caretaker
	landlord.HandleFunc("/caretakers", func(w http.ResponseWriter, r *http.Request) {
		var caretakerData map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&caretakerData); err != nil {
			utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
			return
		}

		// Generate unique ID for new caretaker
		newCaretaker := map[string]interface{}{
			"id":                  fmt.Sprintf("caretaker-%d", time.Now().Unix()),
			"email":               caretakerData["email"],
			"first_name":          caretakerData["first_name"],
			"last_name":           caretakerData["last_name"],
			"phone_number":        caretakerData["phone"],
			"id_number":           caretakerData["id_number"],
			"role":                "caretaker",
			"specialization":      caretakerData["position"],
			"experience_years":    0,
			"availability":        "available",
			"rating":              4.0,
			"properties_managed":  0,
			"created_at":          time.Now(),
			"is_active":           true,
			"employment_date":     caretakerData["employment_date"],
			"salary":              caretakerData["salary"],
			"salary_currency":     caretakerData["salary_currency"],
			"address":             caretakerData["address"],
			"nationality":         caretakerData["nationality"],
			"working_hours":       caretakerData["working_hours"],
			"off_days":            caretakerData["off_days"],
			"skills":              caretakerData["skills"],
			"languages":           caretakerData["languages"],
			"assigned_properties": caretakerData["assigned_properties"],
		}

		// Add emergency contact if provided
		if caretakerData["emergency_contact_name"] != nil {
			newCaretaker["emergency_contact"] = map[string]interface{}{
				"name":         caretakerData["emergency_contact_name"],
				"phone":        caretakerData["emergency_contact_phone"],
				"relationship": caretakerData["emergency_relationship"],
			}
		}

		utils.WriteSuccess(w, http.StatusCreated, "Caretaker created successfully", newCaretaker)
	}).Methods("POST")

	// Get specific caretaker details
	landlord.HandleFunc("/caretakers/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		caretakerID := vars["id"]

		// Mock caretaker details
		caretakerDetails := map[string]interface{}{
			"id":                 caretakerID,
			"email":              "john.caretaker@demo.com",
			"first_name":         "John",
			"last_name":          "Mwangi",
			"phone_number":       "+254712345680",
			"role":               "caretaker",
			"specialization":     "General Maintenance",
			"experience_years":   8,
			"availability":       "available",
			"rating":             4.8,
			"properties_managed": 12,
			"created_at":         time.Now().Add(-45 * 24 * time.Hour),
			"is_active":          true,
			"address":            "123 Westlands Road, Nairobi",
			"salary":             45000,
			"salary_currency":    "KSh",
			"employment_date":    "2023-01-15",
			"id_number":          "12345678",
			"nationality":        "Kenyan",
			"working_hours":      "8:00 AM - 5:00 PM",
			"off_days":           "Sunday",
			"skills":             []string{"Plumbing", "Electrical Work", "Painting", "General Repairs"},
			"languages":          []string{"English", "Swahili", "Kikuyu"},
			"emergency_contact": map[string]interface{}{
				"name":         "Mary Mwangi",
				"phone":        "+254723456789",
				"relationship": "spouse",
			},
			"assigned_properties": []map[string]interface{}{
				{"id": "1", "name": "Westlands Apartments", "address": "Westlands, Nairobi", "units": 24},
				{"id": "2", "name": "Kilimani Towers", "address": "Kilimani, Nairobi", "units": 18},
			},
			"performance_metrics": map[string]interface{}{
				"tasks_completed":        127,
				"average_response_time":  2.5,
				"tenant_satisfaction":    4.6,
				"maintenance_efficiency": 92,
			},
			"recent_activities": []map[string]interface{}{
				{
					"id":          "1",
					"type":        "maintenance",
					"description": "Fixed plumbing issue in Unit 2A - Westlands Apartments",
					"date":        time.Now().Add(-1 * 24 * time.Hour),
					"status":      "completed",
				},
				{
					"id":          "2",
					"type":        "inspection",
					"description": "Conducted monthly safety inspection - Kilimani Towers",
					"date":        time.Now().Add(-2 * 24 * time.Hour),
					"status":      "completed",
				},
			},
		}

		utils.WriteSuccess(w, http.StatusOK, "Caretaker details retrieved successfully", caretakerDetails)
	}).Methods("GET")

	// Send invitation to caretaker
	landlord.HandleFunc("/caretakers/{id}/invite", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		caretakerID := vars["id"]

		// Here you would typically:
		// 1. Generate a secure invitation token
		// 2. Send email with login credentials
		// 3. Create user account if it doesn't exist

		utils.WriteSuccess(w, http.StatusOK, "Invitation sent successfully", map[string]interface{}{
			"caretaker_id": caretakerID,
			"invited_at":   time.Now(),
		})
	}).Methods("POST")

	// Delete caretaker
	landlord.HandleFunc("/caretakers/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		caretakerID := vars["id"]

		// Here you would typically delete from database
		utils.WriteSuccess(w, http.StatusOK, "Caretaker deleted successfully", map[string]interface{}{
			"caretaker_id": caretakerID,
			"deleted_at":   time.Now(),
		})
	}).Methods("DELETE")

	// Financial management routes
	landlord.HandleFunc("/financial/overview", landlordHandler.GetFinancialOverview).Methods("GET")
	landlord.HandleFunc("/financial/payments", landlordHandler.GetPaymentHistory).Methods("GET")
	landlord.HandleFunc("/financial/rent-collection", landlordHandler.GetRentCollectionStats).Methods("GET")

	// Invoice management routes
	landlord.HandleFunc("/invoices", landlordHandler.GetInvoices).Methods("GET")
	landlord.HandleFunc("/invoices", landlordHandler.CreateInvoice).Methods("POST")
	landlord.HandleFunc("/invoices/bulk", landlordHandler.CreateBulkInvoices).Methods("POST")
	landlord.HandleFunc("/invoices/stats", landlordHandler.GetInvoiceStats).Methods("GET")
	landlord.HandleFunc("/invoices/{invoice_id}", landlordHandler.GetInvoice).Methods("GET")
	landlord.HandleFunc("/invoices/{invoice_id}", landlordHandler.UpdateInvoice).Methods("PUT")
	landlord.HandleFunc("/invoices/{invoice_id}", landlordHandler.DeleteInvoice).Methods("DELETE")
	landlord.HandleFunc("/invoices/{invoice_id}/send", landlordHandler.SendInvoice).Methods("POST")
	landlord.HandleFunc("/invoices/{invoice_id}/mark-paid", landlordHandler.MarkInvoiceAsPaid).Methods("POST")
	landlord.HandleFunc("/invoices/{invoice_id}/pdf", landlordHandler.GenerateInvoicePDF).Methods("GET")
	landlord.HandleFunc("/invoices/{invoice_id}/reminder", landlordHandler.SendInvoiceReminder).Methods("POST")
	landlord.HandleFunc("/invoices/export", landlordHandler.ExportInvoices).Methods("GET")

	// Maintenance management routes
	landlord.HandleFunc("/maintenance/overview", landlordHandler.GetMaintenanceOverview).Methods("GET")
	landlord.HandleFunc("/maintenance/requests", landlordHandler.GetMaintenanceRequests).Methods("GET")

	// Inspection management routes
	landlord.HandleFunc("/inspections/overview", landlordHandler.GetInspectionOverview).Methods("GET")
	landlord.HandleFunc("/inspections/schedule", landlordHandler.GetInspectionSchedule).Methods("GET")

	// Communication routes
	landlord.HandleFunc("/communication/overview", landlordHandler.GetCommunicationOverview).Methods("GET")
	landlord.HandleFunc("/communication/messages", landlordHandler.GetMessages).Methods("GET")

	// Report generation routes
	landlord.HandleFunc("/reports/property", landlordHandler.GeneratePropertyReport).Methods("GET")
	landlord.HandleFunc("/reports/financial", landlordHandler.GenerateFinancialReport).Methods("GET")
	landlord.HandleFunc("/reports/occupancy", landlordHandler.GenerateOccupancyReport).Methods("GET")

	// Notification routes
	landlord.HandleFunc("/notifications", landlordHandler.GetNotifications).Methods("GET")
	landlord.HandleFunc("/notifications/{notification_id}/read", landlordHandler.MarkNotificationAsRead).Methods("PUT")
	landlord.HandleFunc("/notifications/unread-count", landlordHandler.GetUnreadNotificationCount).Methods("GET")
}
