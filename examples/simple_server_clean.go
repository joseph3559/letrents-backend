package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// Simple auth middleware
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For demo, just pass through without strict auth
		next.ServeHTTP(w, r)
	})
}

// Login handler
func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var role string
	var firstName, lastName string
	var userID uuid.UUID
	var valid bool

	switch req["email"] {
	case "admin@letrents.com":
		if req["password"] == "admin123!" {
			role = "super_admin"
			firstName = "Super"
			lastName = "Admin"
			userID = uuid.MustParse("c4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	case "landlord@demo.com":
		if req["password"] == "admin123!" {
			role = "landlord"
			firstName = "John"
			lastName = "Landlord"
			userID = uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	case "caretaker@demo.com":
		if req["password"] == "admin123!" {
			role = "caretaker"
			firstName = "Jane"
			lastName = "Caretaker"
			userID = uuid.MustParse("e5c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	}

	if !valid {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	loginData := map[string]interface{}{
		"token":         fmt.Sprintf("demo-jwt-token-%s-%d", role, time.Now().Unix()),
		"refresh_token": fmt.Sprintf("demo-refresh-token-%s", userID.String()),
		"user": map[string]interface{}{
			"id":         userID.String(),
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
		"data":    loginData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Current user handler
func currentUserHandler(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")

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

// Health check
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"time":   time.Now(),
	})
}

// Property handlers
func propertyHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Mock property data
	property := map[string]interface{}{
		"id":             id,
		"name":           "Sunset Apartments",
		"type":           "residential",
		"description":    "Modern apartment complex with great amenities",
		"street":         "123 Main Street",
		"city":           "Nairobi",
		"state":          "Nairobi County",
		"country":        "Kenya",
		"total_units":    12,
		"occupied_units": 8,
		"vacant_units":   4,
		"features":       []string{"Parking", "Security", "Generator", "Water Supply"},
		"tags":           []string{"Modern", "Secure", "Central Location"},
		"status":         "active",
		"created_at":     time.Now().Add(-6 * time.Hour),
		"updated_at":     time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    property,
	})
}

func propertiesHandler(w http.ResponseWriter, r *http.Request) {
	// Mock properties data
	properties := []map[string]interface{}{
		{
			"id":             "prop-1",
			"name":           "Sunset Apartments",
			"type":           "residential",
			"description":    "Modern apartment complex with great amenities",
			"street":         "123 Main Street",
			"city":           "Nairobi",
			"total_units":    12,
			"occupied_units": 8,
			"status":         "active",
		},
		{
			"id":             "prop-2",
			"name":           "Downtown Office Complex",
			"type":           "commercial",
			"description":    "Prime commercial property in the heart of the city",
			"street":         "456 Business Ave",
			"city":           "Nairobi",
			"total_units":    8,
			"occupied_units": 6,
			"status":         "active",
		},
		{
			"id":             "prop-4",
			"name":           "Greenfield Residences",
			"type":           "residential",
			"description":    "Luxury residential complex with modern amenities",
			"street":         "789 Garden Lane",
			"city":           "Nairobi",
			"total_units":    20,
			"occupied_units": 15,
			"status":         "active",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    properties,
		"meta": map[string]interface{}{
			"total": len(properties),
			"page":  1,
			"limit": 20,
		},
	})
}

func propertyUnitsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	propertyId := vars["id"]

	// Mock units data based on property ID
	units := []map[string]interface{}{
		{
			"id":             "unit-1",
			"property_id":    propertyId,
			"unit_number":    "A01",
			"type":           "1BR",
			"bedrooms":       1,
			"bathrooms":      1,
			"size_sqft":      650,
			"rent_amount":    45000,
			"deposit_amount": 45000,
			"status":         "occupied",
			"tenant_name":    "John Doe",
			"tenant_phone":   "+254-700-123456",
			"features":       []string{"Balcony", "Built-in Wardrobes"},
			"images":         []string{},
			"created_at":     time.Now().Add(-24 * time.Hour),
			"updated_at":     time.Now(),
		},
		{
			"id":             "unit-2",
			"property_id":    propertyId,
			"unit_number":    "A02",
			"type":           "2BR",
			"bedrooms":       2,
			"bathrooms":      2,
			"size_sqft":      850,
			"rent_amount":    65000,
			"deposit_amount": 65000,
			"status":         "vacant",
			"features":       []string{"Balcony", "Built-in Wardrobes", "Modern Kitchen"},
			"images":         []string{},
			"created_at":     time.Now().Add(-24 * time.Hour),
			"updated_at":     time.Now(),
		},
		{
			"id":             "unit-3",
			"property_id":    propertyId,
			"unit_number":    "B01",
			"type":           "Studio",
			"bedrooms":       0,
			"bathrooms":      1,
			"size_sqft":      450,
			"rent_amount":    35000,
			"deposit_amount": 35000,
			"status":         "occupied",
			"tenant_name":    "Jane Smith",
			"tenant_phone":   "+254-700-789012",
			"features":       []string{"Built-in Wardrobes"},
			"images":         []string{},
			"created_at":     time.Now().Add(-24 * time.Hour),
			"updated_at":     time.Now(),
		},
		{
			"id":             "unit-4",
			"property_id":    propertyId,
			"unit_number":    "B02",
			"type":           "1BR",
			"bedrooms":       1,
			"bathrooms":      1,
			"size_sqft":      600,
			"rent_amount":    42000,
			"deposit_amount": 42000,
			"status":         "maintenance",
			"features":       []string{"Balcony"},
			"images":         []string{},
			"created_at":     time.Now().Add(-24 * time.Hour),
			"updated_at":     time.Now(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    units,
		"meta": map[string]interface{}{
			"total": len(units),
			"page":  1,
			"limit": 20,
		},
	})
}

func unitsHandler(w http.ResponseWriter, r *http.Request) {
	// Mock units data from all properties
	allUnits := []map[string]interface{}{
		{"id": "unit-1-1", "property_id": "prop-1", "unit_number": "A01", "rent_amount": 45000, "deposit_amount": 45000, "status": "vacant", "unit_type": "1BR"},
		{"id": "unit-1-2", "property_id": "prop-1", "unit_number": "A02", "rent_amount": 50000, "deposit_amount": 50000, "status": "vacant", "unit_type": "2BR"},
		{"id": "unit-2-1", "property_id": "prop-2", "unit_number": "Shop 1", "rent_amount": 80000, "deposit_amount": 160000, "status": "vacant", "unit_type": "commercial"},
		{"id": "unit-4-1", "property_id": "prop-4", "unit_number": "Villa 1", "rent_amount": 120000, "deposit_amount": 240000, "status": "vacant", "unit_type": "villa"},
	}

	// Apply filters
	filteredUnits := allUnits
	queryParams := r.URL.Query()

	if propertyID := queryParams.Get("property_id"); propertyID != "" {
		var filtered []map[string]interface{}
		for _, unit := range allUnits {
			if unit["property_id"] == propertyID {
				filtered = append(filtered, unit)
			}
		}
		filteredUnits = filtered
	}

	if status := queryParams.Get("status"); status != "" {
		var filtered []map[string]interface{}
		for _, unit := range filteredUnits {
			if unit["status"] == status {
				filtered = append(filtered, unit)
			}
		}
		filteredUnits = filtered
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Units retrieved successfully",
		"data":    filteredUnits,
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
		handlers.AllowedOrigins([]string{"http://localhost:3000", "http://localhost:3001"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)(router)

	// Auth routes
	router.HandleFunc("/api/v1/auth/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/v1/auth/me", currentUserHandler).Methods("GET")

	// Property routes
	router.HandleFunc("/api/v1/properties", propertiesHandler).Methods("GET")
	router.HandleFunc("/api/v1/properties/{id}", propertyHandler).Methods("GET")
	router.HandleFunc("/api/v1/properties/{id}/units", propertyUnitsHandler).Methods("GET")
	router.HandleFunc("/api/v1/units", unitsHandler).Methods("GET")

	// Health check
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Simple server starting on port %s", port)
	log.Printf("Available endpoints:")
	log.Printf("  POST /api/v1/auth/login")
	log.Printf("  GET  /api/v1/auth/me")
	log.Printf("  GET  /api/v1/properties")
	log.Printf("  GET  /api/v1/properties/{id}")
	log.Printf("  GET  /api/v1/properties/{id}/units")
	log.Printf("  GET  /health")

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
