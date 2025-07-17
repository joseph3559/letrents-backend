.PHONY: build run seed clean test help

# Default target
.DEFAULT_GOAL := help

# Build the main server
build:
	@echo "Building LetRents Backend Server..."
	go build -o server cmd/server/main.go

# Build the database seeder
build-seed:
	@echo "Building Database Seeder..."
	go build -o seed cmd/seed/main.go

# Run the server
run: build
	@echo "Starting LetRents Backend Server..."
	./server

# Run database seeding
seed: build-seed
	@echo "Seeding database with demo data..."
	./seed

# Run tests
test:
	@echo "Running tests..."
	go test ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f server seed

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Run linter
lint:
	@echo "Running linter..."
	golangci-lint run

# Check dependencies
deps:
	@echo "Checking dependencies..."
	go mod tidy
	go mod verify

# Development mode (rebuild and run on changes)
dev: build
	@echo "Starting development server..."
	./server

# Full setup for new developers
setup: deps build-seed seed build
	@echo "Setup complete! Run 'make run' to start the server."

# Show help
help:
	@echo "LetRents Backend - Available Commands:"
	@echo ""
	@echo "  build      - Build the main server"
	@echo "  build-seed - Build the database seeder"
	@echo "  run        - Build and run the server"
	@echo "  seed       - Build and run database seeder"
	@echo "  test       - Run tests"
	@echo "  clean      - Clean build artifacts"
	@echo "  fmt        - Format code"
	@echo "  lint       - Run linter"
	@echo "  deps       - Check and tidy dependencies"
	@echo "  dev        - Development mode"
	@echo "  setup      - Full setup for new developers"
	@echo "  help       - Show this help"
	@echo ""
	@echo "Demo Login Credentials (Password: demo123!):"
	@echo "  Super Admin: admin@payrents.com"
	@echo "  Agency Admin: agency@demo.com"
	@echo "  Landlord: landlord@demo.com"
	@echo "  Agent: agent@demo.com"
	@echo "  Tenant: tenant@demo.com" 