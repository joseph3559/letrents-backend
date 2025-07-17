package utils

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Context keys for storing values in request context
type contextKey string

const (
	UserIDKey contextKey = "user_id"
	UserKey   contextKey = "user"
)

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (uuid.UUID, error) {
	userID, ok := ctx.Value(UserIDKey).(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("user ID not found in context")
	}
	return userID, nil
}

// SetUserIDInContext sets the user ID in the request context
func SetUserIDInContext(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

// GetUserFromContext extracts the user from the request context
func GetUserFromContext(ctx context.Context) (interface{}, error) {
	user := ctx.Value(UserKey)
	if user == nil {
		return nil, fmt.Errorf("user not found in context")
	}
	return user, nil
}

// SetUserInContext sets the user in the request context
func SetUserInContext(ctx context.Context, user interface{}) context.Context {
	return context.WithValue(ctx, UserKey, user)
}
