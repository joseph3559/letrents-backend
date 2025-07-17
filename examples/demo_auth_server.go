package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
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

	if req["password"] != "admin123!" {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	switch req["email"] {
	case "admin@letrents.com":
		role = "super_admin"
		firstName = "Super"
		lastName = "Admin"
		userID = uuid.MustParse("c4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	case "agency@demo.com":
		role = "agency_admin"
		firstName = "Agency"
		lastName = "Admin"
		userID = uuid.MustParse("a1c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	case "agent@demo.com":
		role = "agent"
		firstName = "Jane"
		lastName = "Agent"
		userID = uuid.MustParse("a3c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	case "landlord@demo.com":
		role = "landlord"
		firstName = "John"
		lastName = "Landlord"
		userID = uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	case "tenant@demo.com":
		role = "tenant"
		firstName = "Bob"
		lastName = "Tenant"
		userID = uuid.MustParse("d4c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	case "caretaker@demo.com":
		role = "caretaker"
		firstName = "Mike"
		lastName = "Caretaker"
		userID = uuid.MustParse("e5c8b0bd-821d-4ca9-bce9-efaa1da85caa")
		valid = true
	}

	if !valid {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"message": "Login successful",
		"data": map[string]interface{}{
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
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Logout handler
func logoutHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Logout successful",
	})
}

// Current user handler
func currentUserHandler(w http.ResponseWriter, r *http.Request) {
	// Return a default user for demo
	user := map[string]interface{}{
		"id":         "demo-user-id",
		"email":      "demo@letrents.com",
		"first_name": "Demo",
		"last_name":  "User",
		"role":       "tenant",
		"status":     "active",
		"created_at": time.Now().Add(-24 * time.Hour),
		"updated_at": time.Now(),
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

func main() {
	router := mux.NewRouter()

	// Setup CORS
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:3000", "http://localhost:3001", "*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)(router)

	// Public routes
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/api/auth/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/auth/logout", logoutHandler).Methods("POST")
	router.HandleFunc("/api/auth/me", currentUserHandler).Methods("GET")

	// Start server
	port := "8080"
	log.Printf("Demo authentication server starting on port %s", port)
	log.Printf("Available demo accounts (password: admin123!):")
	log.Printf("  Super Admin: admin@letrents.com")
	log.Printf("  Agency Admin: agency@demo.com")
	log.Printf("  Agent: agent@demo.com")
	log.Printf("  Landlord: landlord@demo.com")
	log.Printf("  Tenant: tenant@demo.com")
	log.Printf("  Caretaker: caretaker@demo.com")

	if err := http.ListenAndServe(":"+port, corsHandler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
