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
	case "agency@demo.com":
		if req["password"] == "admin123!" {
			role = "agency_admin"
			firstName = "Agency"
			lastName = "Admin"
			userID = uuid.MustParse("a1c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	case "agent@demo.com":
		if req["password"] == "admin123!" {
			role = "agent"
			firstName = "Jane"
			lastName = "Agent"
			userID = uuid.MustParse("a3c8b0bd-821d-4ca9-bce9-efaa1da85caa")
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
	case "tenant@demo.com":
		if req["password"] == "admin123!" {
			role = "tenant"
			firstName = "Bob"
			lastName = "Tenant"
			userID = uuid.MustParse("d4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	case "caretaker@demo.com":
		if req["password"] == "admin123!" {
			role = "caretaker"
			firstName = "Mike"
			lastName = "Caretaker"
			userID = uuid.MustParse("e5c8b0bd-821d-4ca9-bce9-efaa1da85caa")
			valid = true
		}
	}

	if !valid {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	response := map[string]interface{}{
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

// Mock messages endpoint
func messagesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		// Mock message data
		messages := []map[string]interface{}{
			{
				"id":              "550e8400-e29b-41d4-a716-446655440001",
				"sender_id":       "b2c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"sender_name":     "John Doe",
				"recipient_id":    "e5c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"content":         "Hi, I need to report a leaking kitchen faucet...",
				"type":            "chat",
				"status":          "delivered",
				"priority":        "medium",
				"created_at":      time.Now().Add(-time.Hour),
				"conversation_id": "550e8400-e29b-41d4-a716-446655440002",
			},
			{
				"id":              "550e8400-e29b-41d4-a716-446655440003",
				"sender_id":       "e5c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"sender_name":     "Jane Smith",
				"recipient_id":    "b2c8b0bd-821d-4ca9-bce9-efaa1da85caa",
				"content":         "I'll schedule a maintenance visit for tomorrow morning.",
				"type":            "chat",
				"status":          "delivered",
				"priority":        "medium",
				"created_at":      time.Now().Add(-30 * time.Minute),
				"conversation_id": "550e8400-e29b-41d4-a716-446655440002",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"data":    messages,
			"meta": map[string]interface{}{
				"total": 2,
				"page":  1,
				"limit": 20,
			},
		})
	} else if r.Method == "POST" {
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Create mock response for new message
		newMessage := map[string]interface{}{
			"id":         uuid.New().String(),
			"sender_id":  "b2c8b0bd-821d-4ca9-bce9-efaa1da85caa",
			"content":    req["content"],
			"type":       req["type"],
			"status":     "sent",
			"priority":   req["priority"],
			"created_at": time.Now(),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"data":    newMessage,
			"message": "Message sent successfully",
		})
	}
}

// Mock conversations endpoint
func conversationsHandler(w http.ResponseWriter, r *http.Request) {
	conversations := []map[string]interface{}{
		{
			"id":   "550e8400-e29b-41d4-a716-446655440002",
			"name": "John Doe - Unit 4B",
			"participants": []map[string]interface{}{
				{
					"id":   "b2c8b0bd-821d-4ca9-bce9-efaa1da85caa",
					"name": "John Doe",
					"role": "tenant",
				},
				{
					"id":   "e5c8b0bd-821d-4ca9-bce9-efaa1da85caa",
					"name": "Jane Smith",
					"role": "caretaker",
				},
			},
			"last_message": map[string]interface{}{
				"content":     "I'll schedule a maintenance visit for tomorrow morning.",
				"created_at":  time.Now().Add(-30 * time.Minute),
				"sender_name": "Jane Smith",
			},
			"unread_count": 1,
			"created_at":   time.Now().Add(-24 * time.Hour),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    conversations,
	})
}

// Mock templates endpoint
func templatesHandler(w http.ResponseWriter, r *http.Request) {
	templates := []map[string]interface{}{
		{
			"id":       "template-1",
			"name":     "Maintenance Request Response",
			"content":  "Thank you for your maintenance request. We will schedule a visit within 24 hours.",
			"category": "maintenance",
		},
		{
			"id":       "template-2",
			"name":     "Rent Reminder",
			"content":  "This is a friendly reminder that your rent payment is due on {{due_date}}.",
			"category": "payment",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    templates,
	})
}

// Mock analytics endpoint
func analyticsHandler(w http.ResponseWriter, r *http.Request) {
	analytics := map[string]interface{}{
		"total_messages":      156,
		"unread_count":        12,
		"conversations_count": 8,
		"response_rate":       0.89,
		"avg_response_time":   "2.5 hours",
		"message_types": map[string]int{
			"chat":         89,
			"notification": 45,
			"broadcast":    22,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    analytics,
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
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    properties,
		"meta": map[string]interface{}{
			"total": 2,
			"page":  1,
			"limit": 20,
		},
	})
}

func propertyUnitsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	propertyId := vars["id"]

	// Mock units data
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

	// Basic routes
	router.HandleFunc("/api/auth/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/auth/me", currentUserHandler).Methods("GET")
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Enhanced communication routes
	apiV2 := router.PathPrefix("/api/v2").Subrouter()
	apiV2.Use(authMiddleware)

	apiV2.HandleFunc("/messages", messagesHandler).Methods("GET", "POST")
	apiV2.HandleFunc("/conversations", conversationsHandler).Methods("GET")
	apiV2.HandleFunc("/templates", templatesHandler).Methods("GET")
	apiV2.HandleFunc("/analytics", analyticsHandler).Methods("GET")

	// Serve static files
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Simple server starting on port %s", port)
	log.Printf("Available endpoints:")
	log.Printf("  POST /api/auth/login")
	log.Printf("  GET  /api/auth/me")
	log.Printf("  GET  /api/v2/messages")
	log.Printf("  POST /api/v2/messages")
	log.Printf("  GET  /api/v2/conversations")
	log.Printf("  GET  /api/v2/templates")
	log.Printf("  GET  /api/v2/analytics")
	log.Printf("  GET  /health")

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
