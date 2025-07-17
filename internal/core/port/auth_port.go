package port

import (
	"context"
	"time"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// AuthRepository defines the interface for authentication data operations
type AuthRepository interface {
	// User authentication
	CreateUser(ctx context.Context, user *domain.User) error
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	GetUserByPhone(ctx context.Context, phoneNumber string) (*domain.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*domain.User, error)
	UpdateUser(ctx context.Context, user *domain.User) error
	UpdateUserPassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	IncrementFailedLoginAttempts(ctx context.Context, userID uuid.UUID) error
	ResetFailedLoginAttempts(ctx context.Context, userID uuid.UUID) error
	LockUserAccount(ctx context.Context, userID uuid.UUID, lockUntil time.Time) error
	UnlockUserAccount(ctx context.Context, userID uuid.UUID) error

	// Refresh token operations
	CreateRefreshToken(ctx context.Context, refreshToken *domain.RefreshToken) error
	GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, tokenHash string) error
	RevokeAllUserRefreshTokens(ctx context.Context, userID uuid.UUID) error
	CleanupExpiredRefreshTokens(ctx context.Context) error

	// Password reset token operations
	CreatePasswordResetToken(ctx context.Context, resetToken *domain.PasswordResetToken) error
	GetPasswordResetTokenByHash(ctx context.Context, tokenHash string) (*domain.PasswordResetToken, error)
	UsePasswordResetToken(ctx context.Context, tokenHash string) error
	CleanupExpiredPasswordResetTokens(ctx context.Context) error

	// Email verification token operations
	CreateEmailVerificationToken(ctx context.Context, verificationToken *domain.EmailVerificationToken) error
	GetEmailVerificationTokenByHash(ctx context.Context, tokenHash string) (*domain.EmailVerificationToken, error)
	UseEmailVerificationToken(ctx context.Context, tokenHash string) error
	CleanupExpiredEmailVerificationTokens(ctx context.Context) error

	// Phone verification token operations (OTP)
	CreatePhoneVerificationToken(ctx context.Context, otpToken *domain.PhoneVerificationToken) error
	GetPhoneVerificationToken(ctx context.Context, phoneNumber, otpCode string) (*domain.PhoneVerificationToken, error)
	GetLatestPhoneVerificationToken(ctx context.Context, phoneNumber string) (*domain.PhoneVerificationToken, error)
	IncrementOTPAttempts(ctx context.Context, tokenID uuid.UUID) error
	UsePhoneVerificationToken(ctx context.Context, tokenID uuid.UUID) error
	CleanupExpiredPhoneVerificationTokens(ctx context.Context) error

	// User session operations
	CreateUserSession(ctx context.Context, session *domain.UserSession) error
	GetUserSessionByToken(ctx context.Context, sessionToken string) (*domain.UserSession, error)
	UpdateUserSessionActivity(ctx context.Context, sessionToken string) error
	DeactivateUserSession(ctx context.Context, sessionToken string) error
	DeactivateAllUserSessions(ctx context.Context, userID uuid.UUID) error
	GetUserActiveSessions(ctx context.Context, userID uuid.UUID) ([]*domain.UserSession, error)
	CleanupExpiredSessions(ctx context.Context) error

	// Login attempt tracking
	LogLoginAttempt(ctx context.Context, attempt *domain.LoginAttempt) error
	GetRecentFailedAttempts(ctx context.Context, identifier string, timeWindow time.Duration) (int, error)
	GetLoginAttempts(ctx context.Context, userID uuid.UUID, limit int) ([]*domain.LoginAttempt, error)

	// User permissions and RBAC
	GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error)
	GetRolePermissions(ctx context.Context, role domain.UserRole) ([]string, error)
	HasPermission(ctx context.Context, userID uuid.UUID, permission string) (bool, error)
	GrantUserPermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID, grantedBy uuid.UUID) error
	RevokeUserPermission(ctx context.Context, userID uuid.UUID, permission string, resourceID *uuid.UUID) error

	// Agency operations
	CreateAgency(ctx context.Context, agency *domain.Agency) error
	GetAgencyByID(ctx context.Context, agencyID uuid.UUID) (*domain.Agency, error)
	UpdateAgency(ctx context.Context, agency *domain.Agency) error
}

// AuthService defines the interface for authentication business logic
type AuthService interface {
	// Authentication methods
	Login(ctx context.Context, req *domain.LoginRequest, ipAddress, userAgent string) (*domain.LoginResponse, error)
	LoginWithPhone(ctx context.Context, req *domain.PhoneLoginRequest, ipAddress, userAgent string) (*domain.OTPResponse, error)
	VerifyOTP(ctx context.Context, req *domain.OTPVerificationRequest, ipAddress, userAgent string) (*domain.LoginResponse, error)
	RefreshToken(ctx context.Context, req *domain.RefreshTokenRequest, ipAddress, userAgent string) (*domain.LoginResponse, error)
	Logout(ctx context.Context, refreshToken, sessionToken string) error
	LogoutAllSessions(ctx context.Context, userID uuid.UUID) error

	// User registration and invitation
	Register(ctx context.Context, req *domain.RegisterRequest, ipAddress, userAgent string) (*domain.LoginResponse, error)
	InviteUser(ctx context.Context, req *domain.InviteUserRequest, invitedBy uuid.UUID) error
	AcceptInvitation(ctx context.Context, token string, password string) (*domain.LoginResponse, error)

	// Email verification
	SendEmailVerification(ctx context.Context, userID uuid.UUID) error
	VerifyEmail(ctx context.Context, req *domain.VerifyEmailRequest) error
	ResendEmailVerification(ctx context.Context, email string) error

	// Phone verification
	SendPhoneVerification(ctx context.Context, phoneNumber string) (*domain.OTPResponse, error)
	ResendPhoneVerification(ctx context.Context, phoneNumber string) (*domain.OTPResponse, error)

	// Password management
	ChangePassword(ctx context.Context, userID uuid.UUID, req *domain.ChangePasswordRequest) error
	RequestPasswordReset(ctx context.Context, req *domain.ResetPasswordRequest) error
	ConfirmPasswordReset(ctx context.Context, req *domain.ConfirmResetPasswordRequest) error

	// JWT operations
	GenerateAccessToken(ctx context.Context, user *domain.User, sessionID string) (string, time.Time, error)
	GenerateRefreshToken(ctx context.Context, userID uuid.UUID, deviceInfo *domain.DeviceInfo, ipAddress, userAgent string) (*domain.RefreshToken, error)
	ValidateAccessToken(ctx context.Context, token string) (*domain.JWTClaims, error)
	ValidateRefreshToken(ctx context.Context, token string) (*domain.RefreshToken, error)

	// Session management
	CreateSession(ctx context.Context, userID uuid.UUID, deviceInfo *domain.DeviceInfo, ipAddress, userAgent string) (*domain.UserSession, error)
	GetUserSessions(ctx context.Context, userID uuid.UUID) ([]*domain.SessionInfo, error)
	TerminateSession(ctx context.Context, userID uuid.UUID, sessionID string) error
	TerminateAllSessions(ctx context.Context, userID uuid.UUID) error

	// Security and monitoring
	CheckAccountLock(ctx context.Context, userID uuid.UUID) (*domain.AccountLockInfo, error)
	TrackLoginAttempt(ctx context.Context, email, phone, ipAddress, userAgent string, success bool, userID *uuid.UUID, failureReason string) error
	ValidateLoginSecurity(ctx context.Context, identifier, ipAddress string) error

	// Authorization and permissions
	GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error)
	CheckPermission(ctx context.Context, userID uuid.UUID, permission string) (bool, error)
	CheckResourcePermission(ctx context.Context, userID uuid.UUID, permission string, resourceID uuid.UUID) (bool, error)

	// Multi-factor authentication (future)
	EnableMFA(ctx context.Context, userID uuid.UUID, method string) error
	DisableMFA(ctx context.Context, userID uuid.UUID) error
	VerifyMFA(ctx context.Context, req *domain.MultiFactorAuthRequest) (bool, error)

	// Administrative functions
	CleanupExpiredTokens(ctx context.Context) error
	GetSecurityReport(ctx context.Context, filters map[string]interface{}) (interface{}, error)
}

// EmailService defines the interface for email operations
type EmailService interface {
	SendEmailVerification(ctx context.Context, to, name, token string) error
	SendPasswordReset(ctx context.Context, to, name, token string) error
	SendWelcomeEmail(ctx context.Context, to, name string) error
	SendInvitationEmail(ctx context.Context, to, name, inviterName, token, message string) error
	SendLoginAlert(ctx context.Context, to, name, ipAddress, userAgent string, timestamp time.Time) error
	SendPasswordChangedAlert(ctx context.Context, to, name string) error
}

// SMSService defines the interface for SMS operations (future implementation)
type SMSService interface {
	SendOTP(ctx context.Context, phoneNumber, otpCode string) error
	SendLoginAlert(ctx context.Context, phoneNumber, message string) error
	SendPasswordChangedAlert(ctx context.Context, phoneNumber, message string) error
}

// CacheService defines the interface for caching operations
type CacheService interface {
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	Get(ctx context.Context, key string) (string, error)
	Delete(ctx context.Context, key string) error
	DeleteByPattern(ctx context.Context, pattern string) error
}

// ValidationService defines the interface for input validation
type ValidationService interface {
	ValidateEmail(email string) error
	ValidatePhoneNumber(phoneNumber string) error
	ValidatePassword(password string) error
	ValidateUserRole(role domain.UserRole, context string) error
	SanitizeInput(input string) string
}

// SecurityConfig represents security configuration
type SecurityConfig struct {
	MaxLoginAttempts         int           `json:"max_login_attempts"`
	AccountLockDuration      time.Duration `json:"account_lock_duration"`
	PasswordMinLength        int           `json:"password_min_length"`
	PasswordRequireSpecial   bool          `json:"password_require_special"`
	PasswordRequireNumber    bool          `json:"password_require_number"`
	PasswordRequireUppercase bool          `json:"password_require_uppercase"`
	OTPExpiration            time.Duration `json:"otp_expiration"`
	OTPMaxAttempts           int           `json:"otp_max_attempts"`
	SessionTimeout           time.Duration `json:"session_timeout"`
	RefreshTokenExpiration   time.Duration `json:"refresh_token_expiration"`
	JWTExpiration            time.Duration `json:"jwt_expiration"`
	RequireEmailVerification bool          `json:"require_email_verification"`
	RequirePhoneVerification bool          `json:"require_phone_verification"`
}
