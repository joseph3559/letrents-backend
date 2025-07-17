package routes

import (
	"fmt"
	"net/http"
	"time"

	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/utils"

	"github.com/gorilla/mux"
)

// SetupSimpleAgencyRoutes sets up the agency admin and agent routes with direct handlers
func SetupSimpleAgencyRoutes(router *mux.Router, authMiddleware *middleware.AuthMiddleware) {
	fmt.Println("🔧 DEBUG: SetupSimpleAgencyRoutes function called")

	// Test endpoint without auth
	router.HandleFunc("/test-agency", func(w http.ResponseWriter, r *http.Request) {
		utils.WriteSuccess(w, http.StatusOK, "Agency routes are working", map[string]string{"status": "ok"})
	}).Methods("GET")

	// Agency Admin Routes with auth
	agencyAdmin := router.PathPrefix("/agency-admin").Subrouter()
	agencyAdmin.Use(authMiddleware.RequireAuth)
	agencyAdmin.Use(authMiddleware.RequireRole([]string{"agency_admin"}))

	// Dashboard KPIs
	agencyAdmin.HandleFunc("/dashboard/kpis", func(w http.ResponseWriter, r *http.Request) {
		kpis := map[string]interface{}{
			"total_properties":  15,
			"total_units":       180,
			"occupancy_rate":    86.7,
			"total_tenants":     156,
			"income_this_month": 2450000.00,
			"unpaid_rent_count": 12,
			"vacant_units":      24,
			"open_tickets":      8,
			"last_updated":      time.Now(),
		}
		utils.WriteSuccess(w, http.StatusOK, "Dashboard KPIs retrieved successfully", kpis)
	}).Methods("GET")

	// Dashboard Charts
	agencyAdmin.HandleFunc("/dashboard/charts", func(w http.ResponseWriter, r *http.Request) {
		chartData := map[string]interface{}{
			"rent_collection_6_months": []map[string]interface{}{
				{"month": "Jan", "amount": 2100000},
				{"month": "Feb", "amount": 2350000},
				{"month": "Mar", "amount": 2200000},
				{"month": "Apr", "amount": 2450000},
				{"month": "May", "amount": 2380000},
				{"month": "Jun", "amount": 2450000},
			},
			"occupancy_breakdown": map[string]interface{}{
				"occupied": 156,
				"vacant":   18,
				"reserved": 6,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Chart data retrieved successfully", chartData)
	}).Methods("GET")

	// Get Agents
	agencyAdmin.HandleFunc("/staff/agents", func(w http.ResponseWriter, r *http.Request) {
		agents := []map[string]interface{}{
			{
				"id":           "agent-1",
				"email":        "jane.agent@demo.com",
				"first_name":   "Jane",
				"last_name":    "Agent",
				"phone_number": "+254712345678",
				"role":         "agent",
				"created_at":   time.Now().Add(-30 * 24 * time.Hour),
				"is_active":    true,
			},
			{
				"id":           "agent-2",
				"email":        "john.agent@demo.com",
				"first_name":   "John",
				"last_name":    "Agent",
				"phone_number": "+254712345679",
				"role":         "agent",
				"created_at":   time.Now().Add(-15 * 24 * time.Hour),
				"is_active":    true,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Agents retrieved successfully", agents)
	}).Methods("GET")

	// Get Caretakers
	agencyAdmin.HandleFunc("/staff/caretakers", func(w http.ResponseWriter, r *http.Request) {
		caretakers := []map[string]interface{}{
			{
				"id":           "caretaker-1",
				"email":        "john.caretaker@demo.com",
				"first_name":   "John",
				"last_name":    "Caretaker",
				"phone_number": "+254712345680",
				"role":         "caretaker",
				"created_at":   time.Now().Add(-45 * 24 * time.Hour),
				"is_active":    true,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Caretakers retrieved successfully", caretakers)
	}).Methods("GET")

	// Agent Routes with auth
	agent := router.PathPrefix("/agent").Subrouter()
	agent.Use(authMiddleware.RequireAuth)
	agent.Use(authMiddleware.RequireRole([]string{"agent"}))

	// Agent Dashboard
	agent.HandleFunc("/dashboard", func(w http.ResponseWriter, r *http.Request) {
		overview := map[string]interface{}{
			"assigned_properties":  3,
			"total_units":          45,
			"occupied_units":       42,
			"vacant_units":         3,
			"maintenance_requests": 7,
			"recent_payments":      12,
			"overdue_invoices":     2,
		}
		utils.WriteSuccess(w, http.StatusOK, "Agent dashboard overview", overview)
	}).Methods("GET")

	// Agent Dashboard Stats
	agent.HandleFunc("/dashboard/stats", func(w http.ResponseWriter, r *http.Request) {
		stats := map[string]interface{}{
			"monthly_revenue":     320000,
			"collection_rate":     94.5,
			"occupancy_rate":      93.3,
			"average_rent":        15000,
			"pending_maintenance": 7,
			"new_tenants_month":   3,
		}
		utils.WriteSuccess(w, http.StatusOK, "Agent dashboard stats", stats)
	}).Methods("GET")

	// Agent Properties
	agent.HandleFunc("/properties", func(w http.ResponseWriter, r *http.Request) {
		properties := []map[string]interface{}{
			{
				"id":          "prop-1",
				"name":        "Sunrise Apartments",
				"location":    "Westlands, Nairobi",
				"total_units": 24,
				"occupied":    22,
				"vacant":      2,
			},
			{
				"id":          "prop-2",
				"name":        "Garden View Estate",
				"location":    "Kileleshwa, Nairobi",
				"total_units": 18,
				"occupied":    17,
				"vacant":      1,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Assigned properties retrieved", properties)
	}).Methods("GET")

	// Agent Units
	agent.HandleFunc("/units", func(w http.ResponseWriter, r *http.Request) {
		units := []map[string]interface{}{
			{
				"id":            "unit-1",
				"unit_number":   "A101",
				"property_name": "Sunrise Apartments",
				"tenant_name":   "John Doe",
				"rent_amount":   25000,
				"status":        "occupied",
				"last_payment":  time.Now().Add(-10 * 24 * time.Hour),
			},
			{
				"id":            "unit-2",
				"unit_number":   "A102",
				"property_name": "Sunrise Apartments",
				"tenant_name":   "",
				"rent_amount":   25000,
				"status":        "vacant",
				"last_payment":  nil,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Units overview retrieved", units)
	}).Methods("GET")

	// Agent Tenants
	agent.HandleFunc("/tenants", func(w http.ResponseWriter, r *http.Request) {
		tenants := []map[string]interface{}{
			{
				"id":          "tenant-1",
				"name":        "John Doe",
				"email":       "john.doe@email.com",
				"phone":       "+254712345678",
				"unit":        "A101",
				"property":    "Sunrise Apartments",
				"rent_amount": 25000,
				"status":      "active",
				"arrears":     0,
			},
			{
				"id":          "tenant-2",
				"name":        "Jane Smith",
				"email":       "jane.smith@email.com",
				"phone":       "+254712345679",
				"unit":        "B205",
				"property":    "Garden View Estate",
				"rent_amount": 30000,
				"status":      "arrears",
				"arrears":     15000,
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Tenants overview retrieved", tenants)
	}).Methods("GET")

	// Agent Notifications
	agent.HandleFunc("/notifications", func(w http.ResponseWriter, r *http.Request) {
		notifications := []map[string]interface{}{
			{
				"id":         "notif-1",
				"type":       "payment_received",
				"title":      "Payment Received",
				"message":    "Rent payment of KSh 25,000 received from John Doe",
				"is_read":    false,
				"created_at": time.Now().Add(-2 * time.Hour),
			},
			{
				"id":         "notif-2",
				"type":       "maintenance_request",
				"title":      "Maintenance Request",
				"message":    "New maintenance request from Unit A105",
				"is_read":    false,
				"created_at": time.Now().Add(-4 * time.Hour),
			},
		}
		utils.WriteSuccess(w, http.StatusOK, "Notifications retrieved", notifications)
	}).Methods("GET")
}
