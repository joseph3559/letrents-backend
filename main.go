package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"letrents-backend/internal/websocket"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// mockLogger implements the Logger interface for demo purposes
type mockLogger struct{}

func (m *mockLogger) Error(msg string, args ...interface{}) {
	log.Printf("[ERROR] "+msg, args...)
}

func (m *mockLogger) Info(msg string, args ...interface{}) {
	log.Printf("[INFO] "+msg, args...)
}

// Simple auth middleware for demo
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For demo, just pass through without strict auth
		next.ServeHTTP(w, r)
	})
}

// Simple database connection
func initDB() (*sql.DB, error) {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "password"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "payrents_db"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
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

// WebSocket repository adapter
type WebSocketRepoAdapter struct {
	db *sql.DB
}

func (r *WebSocketRepoAdapter) LogConnection(ctx context.Context, userID uuid.UUID, connectionID, room, userAgent, ipAddress string) error {
	query := `
		INSERT INTO websocket_connections (user_id, connection_id, room, user_agent, ip_address, status)
		VALUES ($1, $2, $3, $4, $5, 'connected')
		ON CONFLICT (connection_id) DO UPDATE SET
			status = 'connected',
			last_seen = NOW(),
			user_agent = EXCLUDED.user_agent,
			ip_address = EXCLUDED.ip_address
	`
	_, err := r.db.ExecContext(ctx, query, userID, connectionID, room, userAgent, ipAddress)
	return err
}

func (r *WebSocketRepoAdapter) UpdateConnectionStatus(ctx context.Context, connectionID, status string) error {
	query := `UPDATE websocket_connections SET status = $1, last_seen = NOW() WHERE connection_id = $2`
	_, err := r.db.ExecContext(ctx, query, status, connectionID)
	return err
}

func (r *WebSocketRepoAdapter) GetActiveConnections(ctx context.Context, userID uuid.UUID) ([]string, error) {
	query := `SELECT connection_id FROM websocket_connections WHERE user_id = $1 AND status = 'connected'`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var connections []string
	for rows.Next() {
		var connectionID string
		if err := rows.Scan(&connectionID); err != nil {
			continue
		}
		connections = append(connections, connectionID)
	}
	return connections, nil
}

func (r *WebSocketRepoAdapter) CleanupInactiveConnections(ctx context.Context) error {
	query := `
		UPDATE websocket_connections 
		SET status = 'disconnected' 
		WHERE last_seen < NOW() - INTERVAL '10 minutes' AND status = 'connected'
	`
	_, err := r.db.ExecContext(ctx, query)
	return err
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize database connection
	db, err := initDB()
	if err != nil {
		log.Printf("Database connection failed: %v", err)
		log.Println("Continuing without database connection for demo purposes")
	} else {
		defer db.Close()
		log.Println("Database connected successfully")
	}

	// Initialize services
	// Communication repository initialization removed - not currently used

	// Initialize enhanced services
	// aiService := services.NewAIService(os.Getenv("OPENAI_API_KEY")) // Commented out - not currently used

	// Initialize file upload service (commented out - not currently used)
	// localFileProvider := services.NewLocalFileProvider("./uploads", "http://localhost:8080/uploads")
	// fileUploadService := services.NewFileUploadService(localFileProvider)

	// Initialize notification service (commented out - not currently used)
	// smtpProvider := services.NewSMTPEmailProvider(
	// 	os.Getenv("SMTP_HOST"),
	// 	587,
	// 	os.Getenv("SMTP_USERNAME"),
	// 	os.Getenv("SMTP_PASSWORD"),
	// 	os.Getenv("SMTP_FROM_EMAIL"),
	// )
	// fcmProvider := services.NewFCMProvider(
	// 	os.Getenv("FCM_SERVER_KEY"),
	// 	os.Getenv("FCM_PROJECT_ID"),
	// )
	// notificationService := services.NewNotificationService(smtpProvider, fcmProvider, nil)

	// Initialize WebSocket hub
	var wsHub *websocket.Hub
	if db != nil {
		wsRepo := &WebSocketRepoAdapter{db: db}
		wsHub = websocket.NewHub(wsRepo)
		go wsHub.Run()
	}

	// Initialize enhanced communication handler
	// var enhancedCommunicationHandler *handler.CommunicationHandler
	// if communicationRepo != nil && wsHub != nil {
	// 	enhancedCommunicationHandler = handler.NewCommunicationHandler(
	// 		&mockLogger{},
	// 	)
	// }

	// Initialize router
	router := mux.NewRouter()

	// Add CORS middleware
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:3000", "http://localhost:3001"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)(router)

	// Basic auth routes
	router.HandleFunc("/api/auth/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/auth/me", currentUserHandler).Methods("GET")
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Landlord routes
	apiV1 := router.PathPrefix("/api/v1").Subrouter()
	apiV1.Use(authMiddleware)

	// Properties routes
	apiV1.HandleFunc("/properties", func(w http.ResponseWriter, r *http.Request) {
		properties := []map[string]interface{}{
			{
				"id":              "1",
				"name":            "Westlands Apartments",
				"type":            "residential",
				"description":     "Modern residential apartments in the heart of Westlands",
				"address":         "123 Westlands Road, Nairobi",
				"total_units":     8,
				"occupied_units":  7,
				"vacant_units":    1,
				"monthly_revenue": 320000,
				"estimated_value": 25000000,
				"caretaker":       "John Mwangi",
				"caretaker_phone": "+254-700-123-456",
				"images":          []string{"property1.jpg", "property1_2.jpg"},
				"amenities":       []string{"Parking", "Security", "Generator", "Water Supply", "Internet"},
				"created_at":      "2024-01-15",
				"status":          "active",
				"features":        []string{"Parking", "Security", "Generator", "Water Supply", "Internet"},
				"tags":            []string{"luxury", "family-friendly"},
				"units": []map[string]interface{}{
					{
						"id":             "unit-1-1",
						"unit_number":    "A01",
						"rent_amount":    45000,
						"deposit_amount": 45000,
						"status":         "vacant",
					},
					{
						"id":             "unit-1-2",
						"unit_number":    "A02",
						"rent_amount":    50000,
						"deposit_amount": 50000,
						"status":         "vacant",
					},
					{
						"id":             "unit-1-3",
						"unit_number":    "B01",
						"rent_amount":    55000,
						"deposit_amount": 55000,
						"status":         "occupied",
					},
				},
			},
			{
				"id":              "2",
				"name":            "Kilimani Commercial Plaza",
				"type":            "commercial",
				"description":     "Prime commercial space in Kilimani business district",
				"address":         "456 Kilimani Street, Nairobi",
				"total_units":     12,
				"occupied_units":  10,
				"vacant_units":    2,
				"monthly_revenue": 480000,
				"estimated_value": 35000000,
				"caretaker":       "Mary Wanjiku",
				"caretaker_phone": "+254-700-789-012",
				"images":          []string{"property2.jpg"},
				"amenities":       []string{"Parking", "Security", "Elevator", "CCTV", "Fire Safety"},
				"created_at":      "2024-02-20",
				"status":          "active",
				"features":        []string{"Parking", "Security", "Elevator", "CCTV", "Fire Safety"},
				"tags":            []string{"commercial", "prime-location"},
				"units": []map[string]interface{}{
					{
						"id":             "unit-2-1",
						"unit_number":    "Shop 1",
						"rent_amount":    80000,
						"deposit_amount": 160000,
						"status":         "vacant",
					},
					{
						"id":             "unit-2-2",
						"unit_number":    "Shop 2",
						"rent_amount":    75000,
						"deposit_amount": 150000,
						"status":         "available",
					},
					{
						"id":             "unit-2-3",
						"unit_number":    "Office 301",
						"rent_amount":    60000,
						"deposit_amount": 120000,
						"status":         "occupied",
					},
				},
			},
			{
				"id":              "3",
				"name":            "Lavington Villas",
				"type":            "residential",
				"description":     "Luxury residential villas with garden spaces",
				"address":         "789 Lavington Gardens, Nairobi",
				"total_units":     6,
				"occupied_units":  5,
				"vacant_units":    1,
				"monthly_revenue": 720000,
				"estimated_value": 45000000,
				"caretaker":       "Peter Kamau",
				"caretaker_phone": "+254-700-345-678",
				"images":          []string{"property3.jpg", "property3_2.jpg", "property3_3.jpg"},
				"amenities":       []string{"Parking", "Security", "Garden", "Swimming Pool", "Gym", "Children Play Area"},
				"created_at":      "2024-03-10",
				"status":          "active",
				"features":        []string{"Parking", "Security", "Garden", "Swimming Pool", "Gym", "Children Play Area"},
				"tags":            []string{"luxury", "villa", "garden"},
				"units": []map[string]interface{}{
					{
						"id":             "unit-3-1",
						"unit_number":    "Villa 1",
						"rent_amount":    120000,
						"deposit_amount": 240000,
						"status":         "vacant",
					},
					{
						"id":             "unit-3-2",
						"unit_number":    "Villa 2",
						"rent_amount":    110000,
						"deposit_amount": 220000,
						"status":         "occupied",
					},
					{
						"id":             "unit-3-3",
						"unit_number":    "Villa 3",
						"rent_amount":    125000,
						"deposit_amount": 250000,
						"status":         "occupied",
					},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Properties retrieved successfully",
			"data":    properties,
		})
	}).Methods("GET")

	// Units routes
	apiV1.HandleFunc("/units", func(w http.ResponseWriter, r *http.Request) {
		// Mock units data
		allUnits := []map[string]interface{}{
			{"id": "unit-1-1", "property_id": "1", "unit_number": "A01", "rent_amount": 45000, "deposit_amount": 45000, "status": "vacant", "unit_type": "1BR"},
			{"id": "unit-1-2", "property_id": "1", "unit_number": "A02", "rent_amount": 50000, "deposit_amount": 50000, "status": "vacant", "unit_type": "2BR"},
			{"id": "unit-1-3", "property_id": "1", "unit_number": "B01", "rent_amount": 55000, "deposit_amount": 55000, "status": "occupied", "unit_type": "3BR"},
			{"id": "unit-2-1", "property_id": "2", "unit_number": "Shop 1", "rent_amount": 80000, "deposit_amount": 160000, "status": "vacant", "unit_type": "commercial"},
			{"id": "unit-2-2", "property_id": "2", "unit_number": "Shop 2", "rent_amount": 75000, "deposit_amount": 150000, "status": "available", "unit_type": "commercial"},
			{"id": "unit-2-3", "property_id": "2", "unit_number": "Office 301", "rent_amount": 60000, "deposit_amount": 120000, "status": "occupied", "unit_type": "office"},
			{"id": "unit-3-1", "property_id": "3", "unit_number": "Villa 1", "rent_amount": 120000, "deposit_amount": 240000, "status": "vacant", "unit_type": "villa"},
			{"id": "unit-3-2", "property_id": "3", "unit_number": "Villa 2", "rent_amount": 110000, "deposit_amount": 220000, "status": "occupied", "unit_type": "villa"},
			{"id": "unit-3-3", "property_id": "3", "unit_number": "Villa 3", "rent_amount": 125000, "deposit_amount": 250000, "status": "occupied", "unit_type": "villa"},
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
	}).Methods("GET")

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

	// Enhanced communication routes (commented out for now)
	// if enhancedCommunicationHandler != nil {
	// 	apiV2 := router.PathPrefix("/api/v2").Subrouter()
	// 	apiV2.Use(authMiddleware)

	// 	// Enhanced message endpoints
	// 	apiV2.HandleFunc("/messages", enhancedCommunicationHandler.GetMessages).Methods("GET")
	// 	apiV2.HandleFunc("/messages", enhancedCommunicationHandler.CreateMessage).Methods("POST")
	// 	apiV2.HandleFunc("/messages/{messageId}/read", enhancedCommunicationHandler.MarkMessageAsRead).Methods("POST")

	// 	// Conversation endpoints
	// 	apiV2.HandleFunc("/conversations", enhancedCommunicationHandler.GetConversations).Methods("GET")
	// 	apiV2.HandleFunc("/conversations", enhancedCommunicationHandler.CreateConversation).Methods("POST")

	// 	// Template endpoints
	// 	apiV2.HandleFunc("/templates", enhancedCommunicationHandler.GetMessageTemplates).Methods("GET")

	// 	// File upload endpoints
	// 	apiV2.HandleFunc("/attachments", enhancedCommunicationHandler.UploadAttachment).Methods("POST")

	// 	// AI assistance endpoints
	// 	apiV2.HandleFunc("/ai/assistance", enhancedCommunicationHandler.AIAssistance).Methods("POST")

	// 	// Analytics endpoints
	// 	apiV2.HandleFunc("/analytics", enhancedCommunicationHandler.GetAnalytics).Methods("GET")

	// 	// WebSocket endpoint
	// 	if wsHub != nil {
	// 		router.HandleFunc("/ws", wsHub.HandleWebSocket)
	// 	}
	// } else {
	// 	// Fallback route for when enhanced communication is not available
	// 	router.HandleFunc("/api/v2/messages", func(w http.ResponseWriter, r *http.Request) {
	// 		w.Header().Set("Content-Type", "application/json")
	// 		json.NewEncoder(w).Encode(map[string]interface{}{
	// 			"success": false,
	// 			"message": "Enhanced communication not available - database connection required",
	// 			"data":    []interface{}{},
	// 		})
	// 	}).Methods("GET")
	// }

	// Serve static files for file uploads
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Database connected: %v", db != nil)
	// log.Printf("Enhanced communication available: %v", enhancedCommunicationHandler != nil)

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
