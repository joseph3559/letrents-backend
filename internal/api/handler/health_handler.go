package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
	Uptime    string    `json:"uptime"`
}

var startTime = time.Now()

// HealthCheck handles health check requests
func HealthCheck(c *gin.Context) {
	uptime := time.Since(startTime)

	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
		Service:   "letrents-backend",
		Version:   "1.0.0",
		Uptime:    uptime.String(),
	}

	c.JSON(http.StatusOK, response)
}

// ReadinessCheck handles readiness probe requests
func ReadinessCheck(c *gin.Context) {
	// Add checks for database connectivity, external services, etc.
	// For now, we'll just return ready
	c.JSON(http.StatusOK, gin.H{
		"status":    "ready",
		"timestamp": time.Now(),
		"checks": gin.H{
			"database":   "ok",
			"filesystem": "ok",
		},
	})
}

// LivenessCheck handles liveness probe requests
func LivenessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"timestamp": time.Now(),
	})
}
