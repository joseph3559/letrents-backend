package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"letrents-backend/config"
	"letrents-backend/internal/db/postgres"
)

func main() {
	// Load configuration
	cfg := config.Load()
	log.Printf("Starting database seeding in %s mode", cfg.App.Environment)

	// Connect to database
	db, err := postgres.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Database connection established successfully")

	// Read and execute the seeding script
	seedFile := "scripts/seed_demo_data.sql"
	if _, err := os.Stat(seedFile); os.IsNotExist(err) {
		log.Fatalf("Seed file not found: %s", seedFile)
	}

	log.Printf("Reading seed file: %s", seedFile)
	seedSQL, err := ioutil.ReadFile(seedFile)
	if err != nil {
		log.Fatalf("Failed to read seed file: %v", err)
	}

	log.Println("Executing seed script...")
	if err := db.RunMigration(string(seedSQL)); err != nil {
		log.Fatalf("Failed to execute seed script: %v", err)
	}

	log.Println("✅ Database seeding completed successfully!")
	log.Println("")
	log.Println("Demo Login Credentials:")
	log.Println("=====================")
	log.Println("Password for ALL accounts: demo123!")
	log.Println("")
	log.Println("Super Admin:")
	log.Println("  Email: admin@letrents.com")
	log.Println("")
	log.Println("Agency Admin:")
	log.Println("  Email: agency@demo.com")
	log.Println("")
	log.Println("Landlord:")
	log.Println("  Email: landlord@demo.com")
	log.Println("")
	log.Println("Agent:")
	log.Println("  Email: agent@demo.com")
	log.Println("")
	log.Println("Tenant:")
	log.Println("  Email: tenant@demo.com")
	log.Println("")
	log.Println("Use these credentials to test different user roles!")

	fmt.Println("\nDatabase seeded successfully! 🎉")
}
