package main

import (
	"context"
	"database/sql"
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
	_ "github.com/lib/pq"

	"letrents-backend/internal/api/handler"
	"letrents-backend/internal/db/postgres"
	"letrents-backend/internal/services"
	"letrents-backend/internal/websocket"
)

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

// Simple auth middleware
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

// WebSocket repository adapter
type WebSocketRepoAdapter struct {
	db *sql.DB
}

func (r *WebSocketRepoAdapter) LogConnection(ctx context.Context, userID uuid.UUID, connectionID, room, userAgent, ipAddress string) error {
	if r.db == nil {
		return nil
	}
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
	if r.db == nil {
		return nil
	}
	query := `UPDATE websocket_connections SET status = $1, last_seen = NOW() WHERE connection_id = $2`
	_, err := r.db.ExecContext(ctx, query, status, connectionID)
	return err
}

func (r *WebSocketRepoAdapter) GetActiveConnections(ctx context.Context, userID uuid.UUID) ([]string, error) {
	if r.db == nil {
		return []string{}, nil
	}
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
	if r.db == nil {
		return nil
	}
	query := `
		UPDATE websocket_connections 
		SET status = 'disconnected' 
		WHERE last_seen < NOW() - INTERVAL '10 minutes' AND status = 'connected'
	`
	_, err := r.db.ExecContext(ctx, query)
	return err
}

// Setup enhanced communication routes
func setupEnhancedCommunicationRoutes(router *mux.Router, handler *handler.EnhancedCommunicationHandler, wsHub *websocket.Hub) {
	apiV2 := router.PathPrefix("/api/v2").Subrouter()
	apiV2.Use(authMiddleware)

	apiV2.HandleFunc("/messages", handler.GetMessages).Methods("GET")
	apiV2.HandleFunc("/messages", handler.CreateMessage).Methods("POST")
	apiV2.HandleFunc("/messages/{messageId}/read", handler.MarkMessageAsRead).Methods("POST")
	apiV2.HandleFunc("/conversations", handler.GetConversations).Methods("GET")
	apiV2.HandleFunc("/conversations", handler.CreateConversation).Methods("POST")
	apiV2.HandleFunc("/templates", handler.GetMessageTemplates).Methods("GET")
	apiV2.HandleFunc("/attachments", handler.UploadAttachment).Methods("POST")
	apiV2.HandleFunc("/ai/assistance", handler.AIAssistance).Methods("POST")
	apiV2.HandleFunc("/analytics", handler.GetAnalytics).Methods("GET")

	if wsHub != nil {
		router.HandleFunc("/ws", wsHub.HandleWebSocket)
	}
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
	var communicationRepo *postgres.CommunicationRepository
	if db != nil {
		communicationRepo = postgres.NewCommunicationRepository(db)
	}

	aiService := services.NewAIService(os.Getenv("OPENAI_API_KEY"))
	localFileProvider := services.NewLocalFileProvider("./uploads", "http://localhost:8080/uploads")
	fileUploadService := services.NewFileUploadService(localFileProvider)

	smtpProvider := services.NewSMTPEmailProvider(
		os.Getenv("SMTP_HOST"),
		587,
		os.Getenv("SMTP_USERNAME"),
		os.Getenv("SMTP_PASSWORD"),
		os.Getenv("SMTP_FROM_EMAIL"),
	)
	fcmProvider := services.NewFCMProvider(
		os.Getenv("FCM_SERVER_KEY"),
		os.Getenv("FCM_PROJECT_ID"),
	)
	notificationService := services.NewNotificationService(smtpProvider, fcmProvider, nil)

	// Initialize WebSocket hub
	var wsHub *websocket.Hub
	if db != nil {
		wsRepo := &WebSocketRepoAdapter{db: db}
		wsHub = websocket.NewHub(wsRepo)
		go wsHub.Run()
	}

	// Initialize enhanced communication handler
	var enhancedCommunicationHandler *handler.EnhancedCommunicationHandler
	if communicationRepo != nil {
		enhancedCommunicationHandler = handler.NewEnhancedCommunicationHandler(
			communicationRepo,
			aiService,
			fileUploadService,
			notificationService,
			wsHub,
		)
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

	// Properties routes
	apiV1 := router.PathPrefix("/api/v1").Subrouter()
	apiV1.Use(authMiddleware)

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

	apiV1.HandleFunc("/units", func(w http.ResponseWriter, r *http.Request) {
		// Mock units data
		allUnits := []map[string]interface{}{
			{"id": "unit-1-1", "property_id": "1", "unit_number": "A01", "rent_amount": 45000, "deposit_amount": 45000, "status": "vacant", "unit_type": "1BR"},
			{"id": "unit-1-2", "property_id": "1", "unit_number": "A02", "rent_amount": 50000, "deposit_amount": 50000, "status": "vacant", "unit_type": "2BR"},
			{"id": "unit-2-1", "property_id": "2", "unit_number": "Shop 1", "rent_amount": 80000, "deposit_amount": 160000, "status": "vacant", "unit_type": "commercial"},
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Units retrieved successfully",
			"data":    filteredUnits,
		})
	}).Methods("GET")

	// Enhanced communication routes
	if enhancedCommunicationHandler != nil {
		setupEnhancedCommunicationRoutes(router, enhancedCommunicationHandler, wsHub)
		log.Println("Enhanced communication routes registered")
	} else {
		// Fallback route
		router.HandleFunc("/api/v2/messages", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Enhanced communication not available - database connection required",
				"data":    []interface{}{},
			})
		}).Methods("GET")
		log.Println("Using fallback communication routes")
	}

	// Serve static files
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Database connected: %v", db != nil)
	log.Printf("Enhanced communication available: %v", enhancedCommunicationHandler != nil)

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
