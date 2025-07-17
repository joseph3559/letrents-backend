package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/utils"
)

type AuthHandler struct {
	userRepo   port.UserRepository
	authRepo   port.AuthRepository
	jwtManager *utils.JWTManager
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(userRepo port.UserRepository, authRepo port.AuthRepository, jwtManager *utils.JWTManager) *AuthHandler {
	return &AuthHandler{
		userRepo:   userRepo,
		authRepo:   authRepo,
		jwtManager: jwtManager,
	}
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginRequest

	// Parse request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Email and password are required",
		})
		return
	}

	// Demo authentication for admin@letrents.com
	if req.Email == "admin@letrents.com" && req.Password == "admin123!" {
		// Create a demo response for successful login
		response := map[string]interface{}{
			"token":         "demo-jwt-token-123456",
			"refresh_token": "demo-refresh-token-789",
			"user": map[string]interface{}{
				"id":         "admin-demo-id",
				"email":      "admin@letrents.com",
				"first_name": "Super",
				"last_name":  "Admin",
				"role":       "super_admin",
				"status":     "active",
			},
			"expires_at": time.Now().Add(24 * time.Hour),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Login successful!",
			"data":    response,
		})
		return
	}

	// Invalid credentials
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"message": "Invalid credentials",
	})
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	utils.SendSuccessResponse(w, nil, "RefreshToken - Not implemented yet")
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	utils.SendSuccessResponse(w, nil, "Logout - Not implemented yet")
}

// RequestPasswordReset handles password reset request
func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	utils.SendSuccessResponse(w, nil, "RequestPasswordReset - Not implemented yet")
}

// ConfirmPasswordReset handles password reset confirmation
func (h *AuthHandler) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	utils.SendSuccessResponse(w, nil, "ConfirmPasswordReset - Not implemented yet")
}

// getClientIP extracts the client IP from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxy/load balancer)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return forwarded
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}
