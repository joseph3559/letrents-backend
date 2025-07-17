package postgres

import (
	"context"
	"fmt"
	"time"

	"letrents-backend/internal/core/domain"
	"letrents-backend/internal/core/port"

	"github.com/google/uuid"
)

type MockUserRepository struct {
	users map[uuid.UUID]*domain.User
}

// NewMockUserRepository creates a new mock user repository with demo data
func NewMockUserRepository() port.UserRepository {
	// Create demo users matching the login handler
	demoUsers := map[uuid.UUID]*domain.User{
		// Super Admin
		uuid.MustParse("c4c8b0bd-821d-4ca9-bce9-efaa1da85caa"): {
			ID:        uuid.MustParse("c4c8b0bd-821d-4ca9-bce9-efaa1da85caa"),
			Email:     "admin@letrents.com",
			FirstName: "Super",
			LastName:  "Admin",
			Role:      domain.RoleSuperAdmin,
			Status:    domain.StatusActive,
			CreatedAt: time.Now().AddDate(0, -12, 0),
			UpdatedAt: time.Now(),
		},
		// Agency Admin
		uuid.MustParse("a1c8b0bd-821d-4ca9-bce9-efaa1da85caa"): {
			ID:        uuid.MustParse("a1c8b0bd-821d-4ca9-bce9-efaa1da85caa"),
			Email:     "agency@demo.com",
			FirstName: "Agency",
			LastName:  "Admin",
			Role:      domain.RoleAgencyAdmin,
			Status:    domain.StatusActive,
			AgencyID:  func() *uuid.UUID { id := uuid.MustParse("a1234567-e89b-12d3-a456-426614174001"); return &id }(),
			CreatedAt: time.Now().AddDate(0, -6, 0),
			UpdatedAt: time.Now(),
		},
		// Landlord
		uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa"): {
			ID:        uuid.MustParse("b2c8b0bd-821d-4ca9-bce9-efaa1da85caa"),
			Email:     "landlord@demo.com",
			FirstName: "John",
			LastName:  "Landlord",
			Role:      domain.RoleLandlord,
			Status:    domain.StatusActive,
			CreatedAt: time.Now().AddDate(0, -8, 0),
			UpdatedAt: time.Now(),
		},
		// Agent
		uuid.MustParse("a3c8b0bd-821d-4ca9-bce9-efaa1da85caa"): {
			ID:        uuid.MustParse("a3c8b0bd-821d-4ca9-bce9-efaa1da85caa"),
			Email:     "agent@demo.com",
			FirstName: "Jane",
			LastName:  "Agent",
			Role:      domain.RoleAgent,
			Status:    domain.StatusActive,
			AgencyID:  func() *uuid.UUID { id := uuid.MustParse("a1234567-e89b-12d3-a456-426614174001"); return &id }(),
			CreatedAt: time.Now().AddDate(0, -4, 0),
			UpdatedAt: time.Now(),
		},
		// Tenant
		uuid.MustParse("d4c8b0bd-821d-4ca9-bce9-efaa1da85caa"): {
			ID:        uuid.MustParse("d4c8b0bd-821d-4ca9-bce9-efaa1da85caa"),
			Email:     "tenant@demo.com",
			FirstName: "Bob",
			LastName:  "Tenant",
			Role:      domain.RoleTenant,
			Status:    domain.StatusActive,
			CreatedAt: time.Now().AddDate(0, -2, 0),
			UpdatedAt: time.Now(),
		},
	}

	return &MockUserRepository{
		users: demoUsers,
	}
}

// Create creates a new user
func (r *MockUserRepository) Create(ctx context.Context, user *domain.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	r.users[user.ID] = user
	return nil
}

// GetByID retrieves a user by ID
func (r *MockUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	user, exists := r.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

// GetByEmail retrieves a user by email
func (r *MockUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

// GetByPhoneNumber retrieves a user by phone number
func (r *MockUserRepository) GetByPhoneNumber(ctx context.Context, phoneNumber string) (*domain.User, error) {
	for _, user := range r.users {
		if user.PhoneNumber != nil && *user.PhoneNumber == phoneNumber {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

// Update updates a user
func (r *MockUserRepository) Update(ctx context.Context, user *domain.User) error {
	if _, exists := r.users[user.ID]; !exists {
		return fmt.Errorf("user not found")
	}
	user.UpdatedAt = time.Now()
	r.users[user.ID] = user
	return nil
}

// Delete deletes a user
func (r *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if _, exists := r.users[id]; !exists {
		return fmt.Errorf("user not found")
	}
	delete(r.users, id)
	return nil
}

// List lists users with filtering and pagination - matching port.UserFilters interface
func (r *MockUserRepository) List(ctx context.Context, filters port.UserFilters) ([]*domain.User, int64, error) {
	var result []*domain.User
	for _, user := range r.users {
		// Apply role filter
		if filters.Role != nil && user.Role != *filters.Role {
			continue
		}
		// Apply status filter
		if filters.Status != nil && user.Status != *filters.Status {
			continue
		}
		// Apply agency filter
		if filters.AgencyID != nil {
			if user.AgencyID == nil || *user.AgencyID != *filters.AgencyID {
				continue
			}
		}
		result = append(result, user)
	}

	total := int64(len(result))

	// Apply pagination
	if filters.Page > 0 && filters.PerPage > 0 {
		start := (filters.Page - 1) * filters.PerPage
		end := start + filters.PerPage
		if start >= len(result) {
			result = []*domain.User{}
		} else if end > len(result) {
			result = result[start:]
		} else {
			result = result[start:end]
		}
	}

	return result, total, nil
}

// UpdateLastLogin updates the last login timestamp
func (r *MockUserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	user, exists := r.users[userID]
	if !exists {
		return fmt.Errorf("user not found")
	}
	now := time.Now()
	user.LastLoginAt = &now
	user.UpdatedAt = now
	return nil
}

// ChangePassword changes user password
func (r *MockUserRepository) ChangePassword(ctx context.Context, userID uuid.UUID, newPasswordHash string) error {
	user, exists := r.users[userID]
	if !exists {
		return fmt.Errorf("user not found")
	}
	user.Password = newPasswordHash
	user.UpdatedAt = time.Now()
	return nil
}

// UpdateStatus updates user status
func (r *MockUserRepository) UpdateStatus(ctx context.Context, userID uuid.UUID, status domain.UserStatus) error {
	user, exists := r.users[userID]
	if !exists {
		return fmt.Errorf("user not found")
	}
	user.Status = status
	user.UpdatedAt = time.Now()
	return nil
}

// CountByRole counts users by role
func (r *MockUserRepository) CountByRole(ctx context.Context, role domain.UserRole) (int, error) {
	count := 0
	for _, user := range r.users {
		if user.Role == role {
			count++
		}
	}
	return count, nil
}

// CountByStatus counts users by status
func (r *MockUserRepository) CountByStatus(ctx context.Context, status domain.UserStatus) (int, error) {
	count := 0
	for _, user := range r.users {
		if user.Status == status {
			count++
		}
	}
	return count, nil
}

// GetUsersByAgency gets users by agency - matching the interface signature
func (r *MockUserRepository) GetUsersByAgency(ctx context.Context, agencyID uuid.UUID, filters port.UserFilters) ([]*domain.User, int64, error) {
	var result []*domain.User
	for _, user := range r.users {
		if user.AgencyID != nil && *user.AgencyID == agencyID {
			// Apply additional filters
			if filters.Role != nil && user.Role != *filters.Role {
				continue
			}
			if filters.Status != nil && user.Status != *filters.Status {
				continue
			}
			result = append(result, user)
		}
	}

	total := int64(len(result))

	// Apply pagination
	if filters.Page > 0 && filters.PerPage > 0 {
		start := (filters.Page - 1) * filters.PerPage
		end := start + filters.PerPage
		if start >= len(result) {
			result = []*domain.User{}
		} else if end > len(result) {
			result = result[start:]
		} else {
			result = result[start:end]
		}
	}

	return result, total, nil
}

// GetUsersByRole gets users by role - matching the interface signature
func (r *MockUserRepository) GetUsersByRole(ctx context.Context, role domain.UserRole, filters port.UserFilters) ([]*domain.User, int64, error) {
	var result []*domain.User
	for _, user := range r.users {
		if user.Role == role {
			// Apply additional filters
			if filters.Status != nil && user.Status != *filters.Status {
				continue
			}
			if filters.AgencyID != nil {
				if user.AgencyID == nil || *user.AgencyID != *filters.AgencyID {
					continue
				}
			}
			result = append(result, user)
		}
	}

	total := int64(len(result))

	// Apply pagination
	if filters.Page > 0 && filters.PerPage > 0 {
		start := (filters.Page - 1) * filters.PerPage
		end := start + filters.PerPage
		if start >= len(result) {
			result = []*domain.User{}
		} else if end > len(result) {
			result = result[start:]
		} else {
			result = result[start:end]
		}
	}

	return result, total, nil
}
