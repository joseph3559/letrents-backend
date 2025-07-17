package port

import (
	"context"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// UserRepository defines the interface for user data operations
type UserRepository interface {
	// User CRUD operations
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filters UserFilters) ([]*domain.User, int64, error)

	// Authentication specific operations
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	ChangePassword(ctx context.Context, userID uuid.UUID, newPasswordHash string) error

	// Agency related operations
	GetUsersByAgency(ctx context.Context, agencyID uuid.UUID, filters UserFilters) ([]*domain.User, int64, error)
	GetUsersByRole(ctx context.Context, role domain.UserRole, filters UserFilters) ([]*domain.User, int64, error)
}

// Basic auth operations are now in auth_port.go

// AgencyRepository defines the interface for agency data operations
type AgencyRepository interface {
	Create(ctx context.Context, agency *domain.Agency) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Agency, error)
	GetByEmail(ctx context.Context, email string) (*domain.Agency, error)
	Update(ctx context.Context, agency *domain.Agency) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filters AgencyFilters) ([]*domain.Agency, int64, error)
}

// PermissionRepository defines the interface for user permission operations
type PermissionRepository interface {
	GrantPermission(ctx context.Context, permission *domain.UserPermission) error
	RevokePermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID) error
	GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]*domain.UserPermission, error)
	HasPermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID) (bool, error)
	RevokeAllUserPermissions(ctx context.Context, userID uuid.UUID) error
}

// UserFilters represents filters for user queries
type UserFilters struct {
	Role     *domain.UserRole   `json:"role"`
	Status   *domain.UserStatus `json:"status"`
	AgencyID *uuid.UUID         `json:"agency_id"`
	Search   string             `json:"search"` // Search in name or email
	Page     int                `json:"page"`
	PerPage  int                `json:"per_page"`
	SortBy   string             `json:"sort_by"`
	SortDir  string             `json:"sort_dir"`
}

// AgencyFilters represents filters for agency queries
type AgencyFilters struct {
	Status  *domain.UserStatus `json:"status"`
	Search  string             `json:"search"` // Search in name or email
	Page    int                `json:"page"`
	PerPage int                `json:"per_page"`
	SortBy  string             `json:"sort_by"`
	SortDir string             `json:"sort_dir"`
}
