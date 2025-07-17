package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Database DatabaseConfig
	JWT      JWTConfig
	Server   ServerConfig
	App      AppConfig
	Email    EmailConfig
	Security SecurityConfig
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	Secret                 string
	ExpirationHours        int
	RefreshExpirationHours int
	Issuer                 string
	Audience               string
}

type ServerConfig struct {
	Host string
	Port string
}

type AppConfig struct {
	Environment string
	AppURL      string
	APIURL      string
}

type EmailConfig struct {
	BrevoSecret      string
	BrevoSenderEmail string
	BrevoSenderName  string
	APISecret        string
	APISender        string
}

type SecurityConfig struct {
	MaxLoginAttempts         int
	AccountLockDurationMins  int
	OTPExpirationMins        int
	OTPMaxAttempts           int
	SessionTimeoutHours      int
	RequireEmailVerification bool
	RequirePhoneVerification bool
	PasswordMinLength        int
	PasswordRequireSpecial   bool
	PasswordRequireNumber    bool
	PasswordRequireUpper     bool
}

func Load() *Config {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	expirationHours, err := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "24"))
	if err != nil {
		expirationHours = 24
	}

	refreshExpirationHours, err := strconv.Atoi(getEnv("JWT_REFRESH_EXPIRATION_HOURS", "168"))
	if err != nil {
		refreshExpirationHours = 168 // 7 days
	}

	maxLoginAttempts, err := strconv.Atoi(getEnv("MAX_LOGIN_ATTEMPTS", "5"))
	if err != nil {
		maxLoginAttempts = 5
	}

	accountLockDurationMins, err := strconv.Atoi(getEnv("ACCOUNT_LOCK_DURATION_MINS", "30"))
	if err != nil {
		accountLockDurationMins = 30
	}

	otpExpirationMins, err := strconv.Atoi(getEnv("OTP_EXPIRATION_MINS", "10"))
	if err != nil {
		otpExpirationMins = 10
	}

	otpMaxAttempts, err := strconv.Atoi(getEnv("OTP_MAX_ATTEMPTS", "3"))
	if err != nil {
		otpMaxAttempts = 3
	}

	sessionTimeoutHours, err := strconv.Atoi(getEnv("SESSION_TIMEOUT_HOURS", "8"))
	if err != nil {
		sessionTimeoutHours = 8
	}

	passwordMinLength, err := strconv.Atoi(getEnv("PASSWORD_MIN_LENGTH", "8"))
	if err != nil {
		passwordMinLength = 8
	}

	requireEmailVerification, err := strconv.ParseBool(getEnv("REQUIRE_EMAIL_VERIFICATION", "true"))
	if err != nil {
		requireEmailVerification = true
	}

	requirePhoneVerification, err := strconv.ParseBool(getEnv("REQUIRE_PHONE_VERIFICATION", "false"))
	if err != nil {
		requirePhoneVerification = false
	}

	passwordRequireSpecial, err := strconv.ParseBool(getEnv("PASSWORD_REQUIRE_SPECIAL", "true"))
	if err != nil {
		passwordRequireSpecial = true
	}

	passwordRequireNumber, err := strconv.ParseBool(getEnv("PASSWORD_REQUIRE_NUMBER", "true"))
	if err != nil {
		passwordRequireNumber = true
	}

	passwordRequireUpper, err := strconv.ParseBool(getEnv("PASSWORD_REQUIRE_UPPER", "true"))
	if err != nil {
		passwordRequireUpper = true
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "password"),
			Name:     getEnv("DB_NAME", "payrents_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:                 getEnv("JWT_SECRET", "your-super-secret-jwt-key"),
			ExpirationHours:        expirationHours,
			RefreshExpirationHours: refreshExpirationHours,
			Issuer:                 getEnv("JWT_ISSUER", "pay-rents-api"),
			Audience:               getEnv("JWT_AUDIENCE", "pay-rents-app"),
		},
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "localhost"),
			Port: getEnv("SERVER_PORT", "8080"),
		},
		App: AppConfig{
			Environment: getEnv("ENV", "development"),
			AppURL:      getEnv("APP_URL", "http://localhost:3000"),
			APIURL:      getEnv("API_URL", "http://localhost:8080"),
		},
		Email: EmailConfig{
			BrevoSecret:      getEnv("BREVO_SECRET", ""),
			BrevoSenderEmail: getEnv("BREVO_SENDER_EMAIL", ""),
			BrevoSenderName:  getEnv("BREVO_SENDER_NAME", "Pay-Rents"),
			APISecret:        getEnv("EMAIL_API_SECRET", ""),
			APISender:        getEnv("EMAIL_API_SENDER", ""),
		},
		Security: SecurityConfig{
			MaxLoginAttempts:         maxLoginAttempts,
			AccountLockDurationMins:  accountLockDurationMins,
			OTPExpirationMins:        otpExpirationMins,
			OTPMaxAttempts:           otpMaxAttempts,
			SessionTimeoutHours:      sessionTimeoutHours,
			RequireEmailVerification: requireEmailVerification,
			RequirePhoneVerification: requirePhoneVerification,
			PasswordMinLength:        passwordMinLength,
			PasswordRequireSpecial:   passwordRequireSpecial,
			PasswordRequireNumber:    passwordRequireNumber,
			PasswordRequireUpper:     passwordRequireUpper,
		},
	}
}

// GetJWTExpiration returns JWT expiration as time.Duration
func (c *Config) GetJWTExpiration() time.Duration {
	return time.Duration(c.JWT.ExpirationHours) * time.Hour
}

// GetRefreshTokenExpiration returns refresh token expiration as time.Duration
func (c *Config) GetRefreshTokenExpiration() time.Duration {
	return time.Duration(c.JWT.RefreshExpirationHours) * time.Hour
}

// GetAccountLockDuration returns account lock duration as time.Duration
func (c *Config) GetAccountLockDuration() time.Duration {
	return time.Duration(c.Security.AccountLockDurationMins) * time.Minute
}

// GetOTPExpiration returns OTP expiration as time.Duration
func (c *Config) GetOTPExpiration() time.Duration {
	return time.Duration(c.Security.OTPExpirationMins) * time.Minute
}

// GetSessionTimeout returns session timeout as time.Duration
func (c *Config) GetSessionTimeout() time.Duration {
	return time.Duration(c.Security.SessionTimeoutHours) * time.Hour
}

// IsDevelopment checks if the app is in development mode
func (c *Config) IsDevelopment() bool {
	return c.App.Environment == "development"
}

// IsProduction checks if the app is in production mode
func (c *Config) IsProduction() bool {
	return c.App.Environment == "production"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
