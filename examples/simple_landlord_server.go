package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// Simple auth middleware for demo
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For demo, just pass through without strict auth
		next.ServeHTTP(w, r)
	})
}

// Login handler for demo
func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Demo authentication
	var role string
	var firstName, lastName string
	var valid bool

	switch req["email"] {
	case "admin@letrents.com":
		if req["password"] == "admin123!" {
			role = "super_admin"
			firstName = "Super"
			lastName = "Admin"
			valid = true
		}
	case "landlord@demo.com":
		if req["password"] == "admin123!" {
			role = "landlord"
			firstName = "John"
			lastName = "Landlord"
			valid = true
		}
	case "caretaker@demo.com":
		if req["password"] == "admin123!" {
			role = "caretaker"
			firstName = "Jane"
			lastName = "Caretaker"
			valid = true
		}
	}

	if !valid {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	authData := map[string]interface{}{
		"token":         fmt.Sprintf("demo-jwt-token-%s-%d", role, time.Now().Unix()),
		"refresh_token": fmt.Sprintf("demo-refresh-token-%s", role),
		"user": map[string]interface{}{
			"email":      req["email"],
			"first_name": firstName,
			"last_name":  lastName,
			"role":       role,
			"status":     "active",
		},
		"expires_at": time.Now().Add(24 * time.Hour),
	}

	response := map[string]interface{}{
		"success": true,
		"data":    authData,
		"message": "Login successful",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Current user handler
func currentUserHandler(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")

	// Default user
	user := map[string]interface{}{
		"id":         "c4c8b0bd-821d-4ca9-bce9-efaa1da85caa",
		"email":      "admin@letrents.com",
		"first_name": "Super",
		"last_name":  "Admin",
		"role":       "super_admin",
		"status":     "active",
		"created_at": time.Now().Add(-24 * time.Hour),
		"updated_at": time.Now(),
	}

	// Parse token for role-specific user
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")

		if strings.Contains(token, "landlord") {
			user = map[string]interface{}{
				"id":         "b2c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"email":      "landlord@demo.com",
				"first_name": "John",
				"last_name":  "Landlord",
				"role":       "landlord",
				"status":     "active",
				"created_at": time.Now().Add(-24 * time.Hour),
				"updated_at": time.Now(),
			}
		} else if strings.Contains(token, "caretaker") {
			user = map[string]interface{}{
				"id":         "e5c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"email":      "caretaker@demo.com",
				"first_name": "Jane",
				"last_name":  "Caretaker",
				"role":       "caretaker",
				"status":     "active",
				"created_at": time.Now().Add(-24 * time.Hour),
				"updated_at": time.Now(),
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    user,
	})
}

// Health check handler
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"time":   time.Now(),
	})
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize router
	router := mux.NewRouter()

	// Add CORS middleware
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:3000", "http://localhost:3000"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)(router)

	// Health check route (outside of API versioning)
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// API v1 routes
	apiV1 := router.PathPrefix("/api/v1").Subrouter()

	// Auth routes (no middleware needed for login)
	apiV1.HandleFunc("/auth/login", loginHandler).Methods("POST")
	apiV1.HandleFunc("/auth/me", currentUserHandler).Methods("GET")

	// Protected routes with auth middleware
	apiV1.Use(authMiddleware)

	// Landlord caretaker routes
	landlordRouter := apiV1.PathPrefix("/landlord").Subrouter()

	// Get all caretakers
	landlordRouter.HandleFunc("/caretakers", func(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Caretakers retrieved successfully",
			"data":    caretakers,
		})
	}).Methods("GET")

	// Get specific caretaker details
	landlordRouter.HandleFunc("/caretakers/{id}", func(w http.ResponseWriter, r *http.Request) {
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Caretaker details retrieved successfully",
			"data":    caretakerDetails,
		})
	}).Methods("GET")

	// Create new caretaker
	landlordRouter.HandleFunc("/caretakers", func(w http.ResponseWriter, r *http.Request) {
		var caretakerData map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&caretakerData); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
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

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Caretaker created successfully",
			"data":    newCaretaker,
		})
	}).Methods("POST")

	// Delete caretaker
	landlordRouter.HandleFunc("/caretakers/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		caretakerID := vars["id"]

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Caretaker deleted successfully",
			"data": map[string]interface{}{
				"caretaker_id": caretakerID,
				"deleted_at":   time.Now(),
			},
		})
	}).Methods("DELETE")

	// Serve static files for file uploads
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Landlord routes available at /api/v1/landlord/")

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
