package services

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"
	"time"

	"github.com/google/uuid"
)

type NotificationService struct {
	emailProvider EmailProvider
	pushProvider  PushProvider
	smsProvider   SMSProvider
	templates     map[string]*template.Template
}

type EmailProvider interface {
	SendEmail(ctx context.Context, to []string, subject, htmlBody, textBody string, attachments []EmailAttachment) error
	SendTemplateEmail(ctx context.Context, to []string, templateID string, data interface{}) error
}

type PushProvider interface {
	SendPushNotification(ctx context.Context, tokens []string, notification PushNotification) error
	SendDataMessage(ctx context.Context, tokens []string, data map[string]string) error
	SubscribeToTopic(ctx context.Context, tokens []string, topic string) error
	UnsubscribeFromTopic(ctx context.Context, tokens []string, topic string) error
}

type SMSProvider interface {
	SendSMS(ctx context.Context, to []string, message string) error
	SendTemplateSMS(ctx context.Context, to []string, templateID string, data interface{}) error
}

type NotificationRequest struct {
	UserIDs     []uuid.UUID            `json:"user_ids"`
	Channels    []string               `json:"channels"` // email, push, sms, in_app
	Type        string                 `json:"type"`     // message, reminder, alert, system
	Priority    string                 `json:"priority"` // low, medium, high, urgent
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Data        map[string]interface{} `json:"data,omitempty"`
	ActionURL   string                 `json:"action_url,omitempty"`
	ScheduledAt *time.Time             `json:"scheduled_at,omitempty"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
	Template    *NotificationTemplate  `json:"template,omitempty"`
}

type NotificationTemplate struct {
	ID       string                 `json:"id"`
	Subject  string                 `json:"subject,omitempty"`
	Body     string                 `json:"body"`
	Data     map[string]interface{} `json:"data"`
	Language string                 `json:"language,omitempty"`
}

type PushNotification struct {
	Title       string            `json:"title"`
	Body        string            `json:"body"`
	Icon        string            `json:"icon,omitempty"`
	Image       string            `json:"image,omitempty"`
	Badge       int               `json:"badge,omitempty"`
	Sound       string            `json:"sound,omitempty"`
	ClickAction string            `json:"click_action,omitempty"`
	Data        map[string]string `json:"data,omitempty"`
	Priority    string            `json:"priority,omitempty"`
	TTL         int               `json:"ttl,omitempty"`
}

type EmailAttachment struct {
	Name        string `json:"name"`
	ContentType string `json:"content_type"`
	Data        []byte `json:"data"`
}

type NotificationPreferences struct {
	UserID                uuid.UUID `json:"user_id"`
	EmailEnabled          bool      `json:"email_enabled"`
	PushEnabled           bool      `json:"push_enabled"`
	SMSEnabled            bool      `json:"sms_enabled"`
	InAppEnabled          bool      `json:"in_app_enabled"`
	MessageNotifications  bool      `json:"message_notifications"`
	ReminderNotifications bool      `json:"reminder_notifications"`
	MaintenanceAlerts     bool      `json:"maintenance_alerts"`
	PaymentReminders      bool      `json:"payment_reminders"`
	SystemNotifications   bool      `json:"system_notifications"`
	QuietHoursStart       string    `json:"quiet_hours_start"`
	QuietHoursEnd         string    `json:"quiet_hours_end"`
	TimeZone              string    `json:"timezone"`
}

type NotificationLog struct {
	ID           uuid.UUID              `json:"id"`
	UserID       uuid.UUID              `json:"user_id"`
	Type         string                 `json:"type"`
	Channel      string                 `json:"channel"`
	Title        string                 `json:"title"`
	Message      string                 `json:"message"`
	Status       string                 `json:"status"` // pending, sent, delivered, failed, read
	SentAt       *time.Time             `json:"sent_at,omitempty"`
	DeliveredAt  *time.Time             `json:"delivered_at,omitempty"`
	ReadAt       *time.Time             `json:"read_at,omitempty"`
	ErrorMessage *string                `json:"error_message,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

func NewNotificationService(emailProvider EmailProvider, pushProvider PushProvider, smsProvider SMSProvider) *NotificationService {
	return &NotificationService{
		emailProvider: emailProvider,
		pushProvider:  pushProvider,
		smsProvider:   smsProvider,
		templates:     make(map[string]*template.Template),
	}
}

func (s *NotificationService) SendNotification(ctx context.Context, req NotificationRequest) error {
	// Get user preferences and contact info
	users, err := s.getUsersWithPreferences(ctx, req.UserIDs)
	if err != nil {
		return fmt.Errorf("failed to get user preferences: %w", err)
	}

	// Process each user
	for _, user := range users {
		// Check if user has notifications enabled for this type
		if !s.shouldSendNotification(user, req.Type, req.Priority) {
			continue
		}

		// Send via requested channels
		for _, channel := range req.Channels {
			switch channel {
			case "email":
				if user.Preferences.EmailEnabled {
					go s.sendEmailNotification(ctx, user, req)
				}
			case "push":
				if user.Preferences.PushEnabled {
					go s.sendPushNotification(ctx, user, req)
				}
			case "sms":
				if user.Preferences.SMSEnabled {
					go s.sendSMSNotification(ctx, user, req)
				}
			case "in_app":
				if user.Preferences.InAppEnabled {
					go s.sendInAppNotification(ctx, user, req)
				}
			}
		}
	}

	return nil
}

func (s *NotificationService) SendMessageNotification(ctx context.Context, userIDs []uuid.UUID, senderName, messagePreview, conversationTitle string, messageID uuid.UUID) error {
	req := NotificationRequest{
		UserIDs:  userIDs,
		Channels: []string{"push", "email", "in_app"},
		Type:     "message",
		Priority: "medium",
		Title:    fmt.Sprintf("New message from %s", senderName),
		Message:  messagePreview,
		Data: map[string]interface{}{
			"message_id":         messageID.String(),
			"sender_name":        senderName,
			"conversation_title": conversationTitle,
		},
		ActionURL: fmt.Sprintf("/messages?conversation=%s&message=%s", conversationTitle, messageID.String()),
	}

	return s.SendNotification(ctx, req)
}

func (s *NotificationService) SendMaintenanceAlert(ctx context.Context, userIDs []uuid.UUID, propertyName, unitNumber, maintenanceType string, scheduledDate time.Time) error {
	req := NotificationRequest{
		UserIDs:  userIDs,
		Channels: []string{"email", "push", "sms", "in_app"},
		Type:     "alert",
		Priority: "high",
		Title:    "Scheduled Maintenance Notice",
		Message:  fmt.Sprintf("Maintenance scheduled for %s Unit %s on %s", propertyName, unitNumber, scheduledDate.Format("Jan 2, 2006")),
		Data: map[string]interface{}{
			"property_name":    propertyName,
			"unit_number":      unitNumber,
			"maintenance_type": maintenanceType,
			"scheduled_date":   scheduledDate.Format(time.RFC3339),
		},
	}

	return s.SendNotification(ctx, req)
}

func (s *NotificationService) SendRentReminder(ctx context.Context, userIDs []uuid.UUID, propertyName, unitNumber, amount string, dueDate time.Time) error {
	req := NotificationRequest{
		UserIDs:  userIDs,
		Channels: []string{"email", "push", "in_app"},
		Type:     "reminder",
		Priority: "high",
		Title:    "Rent Payment Reminder",
		Message:  fmt.Sprintf("Rent payment of %s for %s Unit %s is due on %s", amount, propertyName, unitNumber, dueDate.Format("Jan 2, 2006")),
		Data: map[string]interface{}{
			"property_name": propertyName,
			"unit_number":   unitNumber,
			"amount":        amount,
			"due_date":      dueDate.Format(time.RFC3339),
		},
		ActionURL: "/payments",
	}

	return s.SendNotification(ctx, req)
}

func (s *NotificationService) sendEmailNotification(ctx context.Context, user UserWithPreferences, req NotificationRequest) error {
	// Check quiet hours
	if s.isInQuietHours(user.Preferences) && req.Priority != "urgent" {
		// Schedule for later or skip
		return nil
	}

	subject := req.Title
	body := req.Message

	// Use template if provided
	if req.Template != nil {
		var err error
		subject, body, err = s.renderTemplate(req.Template, req.Data)
		if err != nil {
			return fmt.Errorf("failed to render email template: %w", err)
		}
	}

	// Add HTML formatting
	htmlBody := s.formatEmailHTML(subject, body, req.ActionURL)
	textBody := s.formatEmailText(body)

	err := s.emailProvider.SendEmail(ctx, []string{user.Email}, subject, htmlBody, textBody, nil)
	if err != nil {
		s.logNotification(ctx, user.ID, "email", req.Type, subject, body, "failed", err.Error())
		return fmt.Errorf("failed to send email: %w", err)
	}

	s.logNotification(ctx, user.ID, "email", req.Type, subject, body, "sent", "")
	return nil
}

func (s *NotificationService) sendPushNotification(ctx context.Context, user UserWithPreferences, req NotificationRequest) error {
	// Get user's push tokens
	tokens, err := s.getUserPushTokens(ctx, user.ID)
	if err != nil || len(tokens) == 0 {
		return fmt.Errorf("no push tokens found for user %s", user.ID)
	}

	// Create push notification
	notification := PushNotification{
		Title:       req.Title,
		Body:        req.Message,
		ClickAction: req.ActionURL,
		Priority:    req.Priority,
		TTL:         3600, // 1 hour
	}

	// Add data payload
	if req.Data != nil {
		notification.Data = make(map[string]string)
		for k, v := range req.Data {
			notification.Data[k] = fmt.Sprintf("%v", v)
		}
	}

	// Set icon and sound based on type
	switch req.Type {
	case "message":
		notification.Icon = "message_icon"
		notification.Sound = "message_sound"
	case "alert":
		notification.Icon = "alert_icon"
		notification.Sound = "alert_sound"
	case "reminder":
		notification.Icon = "reminder_icon"
		notification.Sound = "default"
	default:
		notification.Icon = "default_icon"
		notification.Sound = "default"
	}

	err = s.pushProvider.SendPushNotification(ctx, tokens, notification)
	if err != nil {
		s.logNotification(ctx, user.ID, "push", req.Type, req.Title, req.Message, "failed", err.Error())
		return fmt.Errorf("failed to send push notification: %w", err)
	}

	s.logNotification(ctx, user.ID, "push", req.Type, req.Title, req.Message, "sent", "")
	return nil
}

func (s *NotificationService) sendSMSNotification(ctx context.Context, user UserWithPreferences, req NotificationRequest) error {
	if user.Phone == "" {
		return fmt.Errorf("no phone number for user %s", user.ID)
	}

	// Create concise SMS message
	message := fmt.Sprintf("%s: %s", req.Title, req.Message)
	if len(message) > 160 {
		message = message[:157] + "..."
	}

	err := s.smsProvider.SendSMS(ctx, []string{user.Phone}, message)
	if err != nil {
		s.logNotification(ctx, user.ID, "sms", req.Type, req.Title, message, "failed", err.Error())
		return fmt.Errorf("failed to send SMS: %w", err)
	}

	s.logNotification(ctx, user.ID, "sms", req.Type, req.Title, message, "sent", "")
	return nil
}

func (s *NotificationService) sendInAppNotification(ctx context.Context, user UserWithPreferences, req NotificationRequest) error {
	// Store in-app notification in database
	notification := NotificationLog{
		ID:        uuid.New(),
		UserID:    user.ID,
		Type:      req.Type,
		Channel:   "in_app",
		Title:     req.Title,
		Message:   req.Message,
		Status:    "sent",
		SentAt:    timePtr(time.Now()),
		Metadata:  req.Data,
		CreatedAt: time.Now(),
	}

	err := s.saveInAppNotification(ctx, notification)
	if err != nil {
		return fmt.Errorf("failed to save in-app notification: %w", err)
	}

	return nil
}

func (s *NotificationService) shouldSendNotification(user UserWithPreferences, notificationType, priority string) bool {
	// Check type-specific preferences
	switch notificationType {
	case "message":
		if !user.Preferences.MessageNotifications {
			return false
		}
	case "reminder":
		if !user.Preferences.ReminderNotifications {
			return false
		}
	case "alert":
		if !user.Preferences.MaintenanceAlerts {
			return false
		}
	case "system":
		if !user.Preferences.SystemNotifications {
			return false
		}
	}

	// Always send urgent notifications
	if priority == "urgent" {
		return true
	}

	// Check quiet hours for non-urgent notifications
	if s.isInQuietHours(user.Preferences) {
		return false
	}

	return true
}

func (s *NotificationService) isInQuietHours(prefs NotificationPreferences) bool {
	if prefs.QuietHoursStart == "" || prefs.QuietHoursEnd == "" {
		return false
	}

	// Load user's timezone
	location, err := time.LoadLocation(prefs.TimeZone)
	if err != nil {
		location = time.UTC
	}

	now := time.Now().In(location)
	currentTime := now.Format("15:04")

	// Simple time comparison (assumes same day)
	if prefs.QuietHoursStart <= prefs.QuietHoursEnd {
		return currentTime >= prefs.QuietHoursStart && currentTime <= prefs.QuietHoursEnd
	} else {
		// Quiet hours span midnight
		return currentTime >= prefs.QuietHoursStart || currentTime <= prefs.QuietHoursEnd
	}
}

func (s *NotificationService) formatEmailHTML(subject, body, actionURL string) string {
	html := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8">
		<title>%s</title>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
			.container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 5px; }
			.header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
			.content { background: white; padding: 20px; border-radius: 0 0 5px 5px; }
			.button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
			.footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<h1>%s</h1>
			</div>
			<div class="content">
				<p>%s</p>
				%s
			</div>
			<div class="footer">
				<p>This is an automated message from LetRents Property Management System.</p>
			</div>
		</div>
	</body>
	</html>
	`, subject, subject, strings.ReplaceAll(body, "\n", "<br>"), func() string {
		if actionURL != "" {
			return fmt.Sprintf(`<a href="%s" class="button">View Details</a>`, actionURL)
		}
		return ""
	}())

	return html
}

func (s *NotificationService) formatEmailText(body string) string {
	return body + "\n\n---\nThis is an automated message from LetRents Property Management System."
}

func (s *NotificationService) renderTemplate(tmpl *NotificationTemplate, data map[string]interface{}) (string, string, error) {
	// Render subject
	subjectTmpl, err := template.New("subject").Parse(tmpl.Subject)
	if err != nil {
		return "", "", err
	}

	var subjectBuf bytes.Buffer
	if err := subjectTmpl.Execute(&subjectBuf, data); err != nil {
		return "", "", err
	}

	// Render body
	bodyTmpl, err := template.New("body").Parse(tmpl.Body)
	if err != nil {
		return "", "", err
	}

	var bodyBuf bytes.Buffer
	if err := bodyTmpl.Execute(&bodyBuf, data); err != nil {
		return "", "", err
	}

	return subjectBuf.String(), bodyBuf.String(), nil
}

// Helper types and functions
type UserWithPreferences struct {
	ID          uuid.UUID               `json:"id"`
	FirstName   string                  `json:"first_name"`
	LastName    string                  `json:"last_name"`
	Email       string                  `json:"email"`
	Phone       string                  `json:"phone"`
	Preferences NotificationPreferences `json:"preferences"`
}

func (s *NotificationService) getUsersWithPreferences(ctx context.Context, userIDs []uuid.UUID) ([]UserWithPreferences, error) {
	// This would query your database for users and their notification preferences
	// Implementation depends on your database setup
	return nil, fmt.Errorf("not implemented")
}

func (s *NotificationService) getUserPushTokens(ctx context.Context, userID uuid.UUID) ([]string, error) {
	// This would query your database for user's push notification tokens
	return nil, fmt.Errorf("not implemented")
}

func (s *NotificationService) logNotification(ctx context.Context, userID uuid.UUID, channel, notificationType, title, message, status, errorMessage string) {
	// This would log the notification attempt to your database
}

func (s *NotificationService) saveInAppNotification(ctx context.Context, notification NotificationLog) error {
	// This would save the in-app notification to your database
	return fmt.Errorf("not implemented")
}

func timePtr(t time.Time) *time.Time {
	return &t
}

// SMTP Email Provider Implementation
type SMTPEmailProvider struct {
	host     string
	port     int
	username string
	password string
	from     string
}

func NewSMTPEmailProvider(host string, port int, username, password, from string) *SMTPEmailProvider {
	return &SMTPEmailProvider{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
	}
}

func (p *SMTPEmailProvider) SendEmail(ctx context.Context, to []string, subject, htmlBody, textBody string, attachments []EmailAttachment) error {
	auth := smtp.PlainAuth("", p.username, p.password, p.host)

	// Create message
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		p.from, strings.Join(to, ", "), subject, htmlBody)

	err := smtp.SendMail(fmt.Sprintf("%s:%d", p.host, p.port), auth, p.from, to, []byte(msg))
	return err
}

func (p *SMTPEmailProvider) SendTemplateEmail(ctx context.Context, to []string, templateID string, data interface{}) error {
	// Implementation would depend on your template system
	return fmt.Errorf("not implemented")
}

// Firebase Cloud Messaging Provider Implementation
type FCMProvider struct {
	serverKey string
	projectID string
}

func NewFCMProvider(serverKey, projectID string) *FCMProvider {
	return &FCMProvider{
		serverKey: serverKey,
		projectID: projectID,
	}
}

func (p *FCMProvider) SendPushNotification(ctx context.Context, tokens []string, notification PushNotification) error {
	// Implementation would use Firebase Admin SDK
	return fmt.Errorf("not implemented")
}

func (p *FCMProvider) SendDataMessage(ctx context.Context, tokens []string, data map[string]string) error {
	return fmt.Errorf("not implemented")
}

func (p *FCMProvider) SubscribeToTopic(ctx context.Context, tokens []string, topic string) error {
	return fmt.Errorf("not implemented")
}

func (p *FCMProvider) UnsubscribeFromTopic(ctx context.Context, tokens []string, topic string) error {
	return fmt.Errorf("not implemented")
}
