package domain

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// LoginMethod represents different login methods
type LoginMethod string

const (
	LoginMethodEmail      LoginMethod = "email"
	LoginMethodPhone      LoginMethod = "phone"
	LoginMethodOTP        LoginMethod = "otp"
	LoginMethodSocial     LoginMethod = "social"
	LoginMethodInvitation LoginMethod = "invitation"
)

// LoginRequest represents the login request payload
type LoginRequest struct {
	Email       string      `json:"email" validate:"omitempty,email"`
	PhoneNumber string      `json:"phone_number" validate:"omitempty,phone"`
	Password    string      `json:"password" validate:"omitempty,min=6"`
	OTPCode     string      `json:"otp_code" validate:"omitempty,numeric,len=6"`
	Method      LoginMethod `json:"method" validate:"required"`
	DeviceInfo  *DeviceInfo `json:"device_info,omitempty"`
	RememberMe  bool        `json:"remember_me"`
}

// PhoneLoginRequest for phone + OTP login
type PhoneLoginRequest struct {
	PhoneNumber string      `json:"phone_number" validate:"required,phone"`
	DeviceInfo  *DeviceInfo `json:"device_info,omitempty"`
}

// OTPVerificationRequest for OTP verification
type OTPVerificationRequest struct {
	PhoneNumber string      `json:"phone_number" validate:"required,phone"`
	OTPCode     string      `json:"otp_code" validate:"required,numeric,len=6"`
	DeviceInfo  *DeviceInfo `json:"device_info,omitempty"`
	RememberMe  bool        `json:"remember_me"`
}

// RegisterRequest represents the registration request payload
type RegisterRequest struct {
	Email       string      `json:"email" validate:"omitempty,email"`
	PhoneNumber string      `json:"phone_number" validate:"omitempty,phone"`
	Password    string      `json:"password" validate:"omitempty,min=8"`
	FirstName   string      `json:"first_name" validate:"required,min=2"`
	LastName    string      `json:"last_name" validate:"required,min=2"`
	Role        UserRole    `json:"role" validate:"required"`
	AgencyID    *uuid.UUID  `json:"agency_id"`
	LandlordID  *uuid.UUID  `json:"landlord_id"`
	DeviceInfo  *DeviceInfo `json:"device_info,omitempty"`
}

// InviteUserRequest for inviting users
type InviteUserRequest struct {
	Email       string     `json:"email" validate:"omitempty,email"`
	PhoneNumber string     `json:"phone_number" validate:"omitempty,phone"`
	FirstName   string     `json:"first_name" validate:"required,min=2"`
	LastName    string     `json:"last_name" validate:"required,min=2"`
	Role        UserRole   `json:"role" validate:"required"`
	AgencyID    *uuid.UUID `json:"agency_id"`
	LandlordID  *uuid.UUID `json:"landlord_id"`
	Message     string     `json:"message,omitempty"`
}

// DeviceInfo represents device information for sessions
type DeviceInfo struct {
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name"`
	Platform   string `json:"platform"`
	Version    string `json:"version"`
	UserAgent  string `json:"user_agent"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	User         *User     `json:"user"`
	ExpiresAt    time.Time `json:"expires_at"`
	Permissions  []string  `json:"permissions"`
	SessionID    string    `json:"session_id"`
	RequiresMFA  bool      `json:"requires_mfa,omitempty"`
	MFAMethods   []string  `json:"mfa_methods,omitempty"`
}

// OTPResponse for OTP requests
type OTPResponse struct {
	Message      string    `json:"message"`
	PhoneNumber  string    `json:"phone_number"`
	ExpiresAt    time.Time `json:"expires_at"`
	AttemptsLeft int       `json:"attempts_left"`
}

// RefreshTokenRequest represents refresh token request
type RefreshTokenRequest struct {
	RefreshToken string      `json:"refresh_token" validate:"required"`
	DeviceInfo   *DeviceInfo `json:"device_info,omitempty"`
}

// ChangePasswordRequest represents change password request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

// ResetPasswordRequest represents reset password request
type ResetPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ConfirmResetPasswordRequest represents confirm reset password request
type ConfirmResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

// VerifyEmailRequest for email verification
type VerifyEmailRequest struct {
	Token string `json:"token" validate:"required"`
}

// ResendVerificationRequest for resending verification
type ResendVerificationRequest struct {
	Email       string `json:"email" validate:"omitempty,email"`
	PhoneNumber string `json:"phone_number" validate:"omitempty,phone"`
	Type        string `json:"type" validate:"required,oneof=email phone"`
}

// JWTClaims represents the JWT claims
type JWTClaims struct {
	UserID      uuid.UUID  `json:"user_id"`
	Email       string     `json:"email"`
	PhoneNumber string     `json:"phone_number"`
	Role        UserRole   `json:"role"`
	AgencyID    *uuid.UUID `json:"agency_id"`
	LandlordID  *uuid.UUID `json:"landlord_id"`
	SessionID   string     `json:"session_id"`
	Permissions []string   `json:"permissions"`
	jwt.RegisteredClaims
}

// RefreshToken represents a refresh token stored in the database
type RefreshToken struct {
	ID         uuid.UUID   `json:"id" db:"id"`
	UserID     uuid.UUID   `json:"user_id" db:"user_id"`
	TokenHash  string      `json:"-" db:"token_hash"`
	DeviceInfo *DeviceInfo `json:"device_info" db:"device_info"`
	IPAddress  string      `json:"ip_address" db:"ip_address"`
	UserAgent  string      `json:"user_agent" db:"user_agent"`
	ExpiresAt  time.Time   `json:"expires_at" db:"expires_at"`
	CreatedAt  time.Time   `json:"created_at" db:"created_at"`
	IsRevoked  bool        `json:"is_revoked" db:"is_revoked"`
	RevokedAt  *time.Time  `json:"revoked_at" db:"revoked_at"`
}

// PasswordResetToken represents a password reset token
type PasswordResetToken struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	TokenHash string     `json:"-" db:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	IsUsed    bool       `json:"is_used" db:"is_used"`
	UsedAt    *time.Time `json:"used_at" db:"used_at"`
}

// EmailVerificationToken represents an email verification token
type EmailVerificationToken struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	TokenHash string     `json:"-" db:"token_hash"`
	Email     string     `json:"email" db:"email"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	IsUsed    bool       `json:"is_used" db:"is_used"`
	UsedAt    *time.Time `json:"used_at" db:"used_at"`
}

// PhoneVerificationToken represents a phone verification token (OTP)
type PhoneVerificationToken struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      *uuid.UUID `json:"user_id" db:"user_id"`
	PhoneNumber string     `json:"phone_number" db:"phone_number"`
	OTPCode     string     `json:"-" db:"otp_code"`
	ExpiresAt   time.Time  `json:"expires_at" db:"expires_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	IsUsed      bool       `json:"is_used" db:"is_used"`
	UsedAt      *time.Time `json:"used_at" db:"used_at"`
	Attempts    int        `json:"attempts" db:"attempts"`
}

// UserSession represents an active user session
type UserSession struct {
	ID           uuid.UUID   `json:"id" db:"id"`
	UserID       uuid.UUID   `json:"user_id" db:"user_id"`
	SessionToken string      `json:"-" db:"session_token"`
	DeviceInfo   *DeviceInfo `json:"device_info" db:"device_info"`
	IPAddress    string      `json:"ip_address" db:"ip_address"`
	UserAgent    string      `json:"user_agent" db:"user_agent"`
	LastActivity time.Time   `json:"last_activity" db:"last_activity"`
	ExpiresAt    time.Time   `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	IsActive     bool        `json:"is_active" db:"is_active"`
}

// AccountLockInfo represents account lock information
type AccountLockInfo struct {
	IsLocked       bool       `json:"is_locked"`
	LockUntil      *time.Time `json:"lock_until"`
	FailedAttempts int        `json:"failed_attempts"`
	RemainingTime  *int       `json:"remaining_time_seconds"`
}

// SessionInfo represents session information for user
type SessionInfo struct {
	SessionID    string      `json:"session_id"`
	DeviceInfo   *DeviceInfo `json:"device_info"`
	IPAddress    string      `json:"ip_address"`
	LastActivity time.Time   `json:"last_activity"`
	CreatedAt    time.Time   `json:"created_at"`
	IsCurrent    bool        `json:"is_current"`
}

// MultiFactorAuthRequest for MFA
type MultiFactorAuthRequest struct {
	UserID    uuid.UUID `json:"user_id"`
	Method    string    `json:"method" validate:"required,oneof=sms email totp"`
	Code      string    `json:"code" validate:"required"`
	SessionID string    `json:"session_id" validate:"required"`
}

// IsExpired checks if the refresh token is expired
func (rt *RefreshToken) IsExpired() bool {
	return time.Now().After(rt.ExpiresAt)
}

// IsValid checks if the refresh token is valid (not expired and not revoked)
func (rt *RefreshToken) IsValid() bool {
	return !rt.IsExpired() && !rt.IsRevoked
}

// IsExpired checks if the password reset token is expired
func (prt *PasswordResetToken) IsExpired() bool {
	return time.Now().After(prt.ExpiresAt)
}

// IsValid checks if the password reset token is valid (not expired and not used)
func (prt *PasswordResetToken) IsValid() bool {
	return !prt.IsExpired() && !prt.IsUsed
}

// IsExpired checks if the email verification token is expired
func (evt *EmailVerificationToken) IsExpired() bool {
	return time.Now().After(evt.ExpiresAt)
}

// IsValid checks if the email verification token is valid (not expired and not used)
func (evt *EmailVerificationToken) IsValid() bool {
	return !evt.IsExpired() && !evt.IsUsed
}

// IsExpired checks if the phone verification token is expired
func (pvt *PhoneVerificationToken) IsExpired() bool {
	return time.Now().After(pvt.ExpiresAt)
}

// IsValid checks if the phone verification token is valid (not expired and not used)
func (pvt *PhoneVerificationToken) IsValid() bool {
	return !pvt.IsExpired() && !pvt.IsUsed && pvt.Attempts < 3
}

// IsExpired checks if the user session is expired
func (us *UserSession) IsExpired() bool {
	return time.Now().After(us.ExpiresAt)
}

// IsValid checks if the user session is valid (not expired and active)
func (us *UserSession) IsValid() bool {
	return !us.IsExpired() && us.IsActive
}

// GetAttemptsRemaining calculates remaining OTP attempts
func (pvt *PhoneVerificationToken) GetAttemptsRemaining() int {
	maxAttempts := 3
	return maxAttempts - pvt.Attempts
}
