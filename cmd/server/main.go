package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

	"letrents-backend/config"
	"letrents-backend/internal/api/routes"
	"letrents-backend/internal/core/port"
	"letrents-backend/internal/db/postgres"
)

func main() {
	// Load configuration
	cfg := config.Load()
	log.Printf("Starting Pay-Rents Backend Server in %s mode", cfg.App.Environment)

	// Connect to database
	db, err := postgres.Connect(cfg)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Starting server without database connection for demo purposes")
		db = nil
	}
	if db != nil {
		defer db.Close()
	}

	// Run database migration if schema file exists and database is connected
	if db != nil {
		// Run main schema migration
		migrationFile := "internal/db/migration/schema.sql"
		if _, err := os.Stat(migrationFile); err == nil {
			log.Println("Running main database migration...")
			migrationSQL, err := os.ReadFile(migrationFile)
			if err != nil {
				log.Printf("Warning: Failed to read migration file: %v", err)
			} else {
				if err := db.RunMigration(string(migrationSQL)); err != nil {
					log.Printf("Warning: Failed to run migration: %v", err)
				}
			}
		}

		// Run property management schema migration
		propertyMigrationFile := "internal/db/migration/property_schema.sql"
		if _, err := os.Stat(propertyMigrationFile); err == nil {
			log.Println("Running property management migration...")
			propertyMigrationSQL, err := os.ReadFile(propertyMigrationFile)
			if err != nil {
				log.Printf("Warning: Failed to read property migration file: %v", err)
			} else {
				if err := db.RunMigration(string(propertyMigrationSQL)); err != nil {
					log.Printf("Warning: Failed to run property migration: %v", err)
				}
			}
		}
	}

	// Initialize repositories (mock if no database)
	var userRepo port.UserRepository
	var authRepo port.AuthRepository
	var propertyRepo port.PropertyRepository
	var unitRepo port.UnitRepository

	if db != nil {
		log.Println("Database connection established successfully")
		userRepo = postgres.NewUserRepository(db)
		// TODO: Re-enable when auth repository is fully implemented
		// authRepo = postgres.NewAuthRepository(db)
		authRepo = nil // Temporarily disabled for demo
		// Enable property and unit repositories
		propertyRepo = postgres.NewPropertyRepository(db)
		unitRepo = postgres.NewUnitRepository(db)
	} else {
		log.Println("Using mock repositories for demo purposes")
		userRepo = postgres.NewMockUserRepository() // Use mock repo with demo users
		authRepo = nil
		propertyRepo = nil
		unitRepo = nil
	}

	// Setup router with all routes
	router := mux.NewRouter()

	// Add API routes
	routes.SetupRoutes(router, cfg, userRepo, authRepo, propertyRepo, unitRepo)

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"}, // Configure this properly for production
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-CSRF-Token",
		},
		ExposedHeaders: []string{
			"Link",
		},
		AllowCredentials: true,
		MaxAge:           300,
	})

	// Wrap router with CORS
	handler := c.Handler(router)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Create a deadline for the shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server gracefully stopped")
}
