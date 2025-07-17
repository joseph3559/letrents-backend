package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"letrents-backend/config"
	"letrents-backend/internal/core/port"
)

// EmailService implements the EmailService port using Brevo
type EmailService struct {
	config *config.Config
	client *http.Client
}

// NewEmailService creates a new email service instance
func NewEmailService(cfg *config.Config) port.EmailService {
	return &EmailService{
		config: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// BrevoEmailRequest represents the request structure for Brevo API
type BrevoEmailRequest struct {
	Sender      BrevoSender    `json:"sender"`
	To          []BrevoContact `json:"to"`
	Subject     string         `json:"subject"`
	HTMLContent string         `json:"htmlContent"`
	TextContent string         `json:"textContent,omitempty"`
}

type BrevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type BrevoContact struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

// SendEmailVerification sends an email verification link to the user
func (s *EmailService) SendEmailVerification(ctx context.Context, to, name, token string) error {
	verificationURL := fmt.Sprintf("%s/auth/verify-email?token=%s", s.config.App.AppURL, token)

	subject := "Verify Your Email Address - Pay-Rents"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Pay-Rents!</h1>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p>Thank you for registering with Pay-Rents. To complete your account setup, please verify your email address by clicking the button below:</p>
            
            <p style="text-align: center;">
                <a href="%s" class="button">Verify Email Address</a>
            </p>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">%s</p>
            
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with Pay-Rents, please ignore this email.</p>
            
            <p>Best regards,<br>The Pay-Rents Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name, verificationURL, verificationURL)

	textContent := fmt.Sprintf(`
Hi %s,

Thank you for registering with Pay-Rents. To complete your account setup, please verify your email address by visiting this link:

%s

This verification link will expire in 24 hours.

If you didn't create an account with Pay-Rents, please ignore this email.

Best regards,
The Pay-Rents Team

This is an automated message. Please do not reply to this email.
`, name, verificationURL)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// SendPasswordReset sends a password reset link to the user
func (s *EmailService) SendPasswordReset(ctx context.Context, to, name, token string) error {
	resetURL := fmt.Sprintf("%s/auth/reset-password?token=%s", s.config.App.AppURL, token)

	subject := "Reset Your Password - Pay-Rents"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p>We received a request to reset your password for your Pay-Rents account. If you made this request, click the button below to reset your password:</p>
            
            <p style="text-align: center;">
                <a href="%s" class="button">Reset Password</a>
            </p>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc2626;">%s</p>
            
            <div class="warning">
                <strong>Security Notice:</strong>
                <ul>
                    <li>This password reset link will expire in 1 hour</li>
                    <li>The link can only be used once</li>
                    <li>If you didn't request this reset, please ignore this email</li>
                </ul>
            </div>
            
            <p>If you continue to have problems or didn't request this reset, please contact our support team.</p>
            
            <p>Best regards,<br>The Pay-Rents Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name, resetURL, resetURL)

	textContent := fmt.Sprintf(`
Hi %s,

We received a request to reset your password for your Pay-Rents account. If you made this request, visit this link to reset your password:

%s

Security Notice:
- This password reset link will expire in 1 hour
- The link can only be used once
- If you didn't request this reset, please ignore this email

If you continue to have problems or didn't request this reset, please contact our support team.

Best regards,
The Pay-Rents Team

This is an automated message. Please do not reply to this email.
`, name, resetURL)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// SendWelcomeEmail sends a welcome email to new users
func (s *EmailService) SendWelcomeEmail(ctx context.Context, to, name string) error {
	subject := "Welcome to Pay-Rents!"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Pay-Rents</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
        .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Pay-Rents!</h1>
            <p>Your account is now active</p>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p>Welcome to Pay-Rents! We're excited to have you on board. Your account has been successfully verified and you can now start using our platform.</p>
            
            <div class="features">
                <h3>What you can do now:</h3>
                <ul>
                    <li>Manage your properties and units</li>
                    <li>Add and manage tenants</li>
                    <li>Track rent payments</li>
                    <li>Handle maintenance requests</li>
                    <li>Generate reports and analytics</li>
                </ul>
            </div>
            
            <p style="text-align: center;">
                <a href="%s" class="button">Access Your Dashboard</a>
            </p>
            
            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
            
            <p>Best regards,<br>The Pay-Rents Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name, s.config.App.AppURL)

	textContent := fmt.Sprintf(`
Hi %s,

Welcome to Pay-Rents! We're excited to have you on board. Your account has been successfully verified and you can now start using our platform.

What you can do now:
- Manage your properties and units
- Add and manage tenants
- Track rent payments
- Handle maintenance requests
- Generate reports and analytics

Access your dashboard: %s

If you have any questions or need help getting started, don't hesitate to reach out to our support team.

Best regards,
The Pay-Rents Team

This is an automated message. Please do not reply to this email.
`, name, s.config.App.AppURL)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// SendInvitationEmail sends an invitation email to new users
func (s *EmailService) SendInvitationEmail(ctx context.Context, to, name, inviterName, token, message string) error {
	invitationURL := fmt.Sprintf("%s/auth/accept-invitation?token=%s", s.config.App.AppURL, token)

	subject := fmt.Sprintf("You're invited to join Pay-Rents by %s", inviterName)

	customMessage := ""
	if message != "" {
		customMessage = fmt.Sprintf(`
            <div style="background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
                <h4>Personal Message from %s:</h4>
                <p style="font-style: italic;">"%s"</p>
            </div>`, inviterName, message)
	}

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to Pay-Rents</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0ea5e9; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You're Invited!</h1>
            <p>Join the Pay-Rents platform</p>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p><strong>%s</strong> has invited you to join their team on Pay-Rents, a comprehensive property management platform.</p>
            
            %s
            
            <p>Click the button below to accept your invitation and create your account:</p>
            
            <p style="text-align: center;">
                <a href="%s" class="button">Accept Invitation</a>
            </p>
            
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #0ea5e9;">%s</p>
            
            <p><strong>This invitation will expire in 7 days.</strong></p>
            
            <p>If you have any questions about this invitation, please contact %s directly.</p>
            
            <p>Best regards,<br>The Pay-Rents Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name, inviterName, customMessage, invitationURL, invitationURL, inviterName)

	textContent := fmt.Sprintf(`
Hi %s,

%s has invited you to join their team on Pay-Rents, a comprehensive property management platform.

%s

Click this link to accept your invitation and create your account:
%s

This invitation will expire in 7 days.

If you have any questions about this invitation, please contact %s directly.

Best regards,
The Pay-Rents Team

This is an automated message. Please do not reply to this email.
`, name, inviterName, func() string {
		if message != "" {
			return fmt.Sprintf("\nPersonal Message from %s:\n\"%s\"\n", inviterName, message)
		}
		return ""
	}(), invitationURL, inviterName)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// SendLoginAlert sends a security alert for new login
func (s *EmailService) SendLoginAlert(ctx context.Context, to, name, ipAddress, userAgent string, timestamp time.Time) error {
	subject := "New Sign-in to Your Pay-Rents Account"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Security Alert</h1>
            <p>New sign-in detected</p>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p>We detected a new sign-in to your Pay-Rents account. If this was you, no action is needed.</p>
            
            <div class="info-box">
                <h4>Sign-in Details:</h4>
                <ul>
                    <li><strong>Time:</strong> %s</li>
                    <li><strong>IP Address:</strong> %s</li>
                    <li><strong>Device:</strong> %s</li>
                </ul>
            </div>
            
            <p><strong>If this wasn't you:</strong></p>
            <ol>
                <li>Change your password immediately</li>
                <li>Review your account activity</li>
                <li>Contact our support team</li>
            </ol>
            
            <p>For your security, we recommend using strong, unique passwords and enabling two-factor authentication when available.</p>
            
            <p>Best regards,<br>The Pay-Rents Security Team</p>
        </div>
        <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name, timestamp.Format("January 2, 2006 at 3:04 PM MST"), ipAddress, userAgent)

	textContent := fmt.Sprintf(`
Hi %s,

We detected a new sign-in to your Pay-Rents account. If this was you, no action is needed.

Sign-in Details:
- Time: %s
- IP Address: %s
- Device: %s

If this wasn't you:
1. Change your password immediately
2. Review your account activity
3. Contact our support team

For your security, we recommend using strong, unique passwords and enabling two-factor authentication when available.

Best regards,
The Pay-Rents Security Team

This is an automated security message. Please do not reply to this email.
`, name, timestamp.Format("January 2, 2006 at 3:04 PM MST"), ipAddress, userAgent)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// SendPasswordChangedAlert sends notification when password is changed
func (s *EmailService) SendPasswordChangedAlert(ctx context.Context, to, name string) error {
	subject := "Password Changed - Pay-Rents"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Changed</h1>
            <p>Your account security has been updated</p>
        </div>
        <div class="content">
            <h2>Hi %s,</h2>
            <p>Your Pay-Rents account password has been successfully changed.</p>
            
            <div class="warning">
                <strong>If you didn't make this change:</strong>
                <ol>
                    <li>Someone may have accessed your account</li>
                    <li>Contact our support team immediately</li>
                    <li>Review your recent account activity</li>
                </ol>
            </div>
            
            <p>For your security, we recommend:</p>
            <ul>
                <li>Using a unique, strong password</li>
                <li>Not sharing your password with anyone</li>
                <li>Enabling two-factor authentication when available</li>
                <li>Signing out of all devices if you suspect unauthorized access</li>
            </ul>
            
            <p>Best regards,<br>The Pay-Rents Security Team</p>
        </div>
        <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`, name)

	textContent := fmt.Sprintf(`
Hi %s,

Your Pay-Rents account password has been successfully changed.

If you didn't make this change:
1. Someone may have accessed your account
2. Contact our support team immediately
3. Review your recent account activity

For your security, we recommend:
- Using a unique, strong password
- Not sharing your password with anyone
- Enabling two-factor authentication when available
- Signing out of all devices if you suspect unauthorized access

Best regards,
The Pay-Rents Security Team

This is an automated security message. Please do not reply to this email.
`, name)

	return s.sendEmail(ctx, to, name, subject, htmlContent, textContent)
}

// sendEmail is the core method that sends emails via Brevo API
func (s *EmailService) sendEmail(ctx context.Context, to, name, subject, htmlContent, textContent string) error {
	// Prepare the request payload
	emailReq := BrevoEmailRequest{
		Sender: BrevoSender{
			Name:  s.config.Email.BrevoSenderName,
			Email: s.config.Email.BrevoSenderEmail,
		},
		To: []BrevoContact{
			{
				Email: to,
				Name:  name,
			},
		},
		Subject:     subject,
		HTMLContent: htmlContent,
		TextContent: textContent,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(emailReq)
	if err != nil {
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.brevo.com/v3/smtp/email", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", s.config.Email.BrevoSecret)

	// Send the request
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email request: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if the request was successful
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("email API returned error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
