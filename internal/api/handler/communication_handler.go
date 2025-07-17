package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"letrents-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type CommunicationHandler struct {
	logger Logger
}

type Logger interface {
	Error(msg string, args ...interface{})
	Info(msg string, args ...interface{})
}

// Request/Response Types for Universal Communication
type CreateMessageRequest struct {
	Type         string      `json:"type" validate:"required,oneof=individual group broadcast"`
	Subject      string      `json:"subject" validate:"required"`
	Content      string      `json:"content" validate:"required"`
	Recipients   []uuid.UUID `json:"recipients" validate:"required"`
	SentVia      []string    `json:"sent_via" validate:"required"`
	Priority     string      `json:"priority" validate:"required,oneof=low medium high urgent"`
	Tags         []string    `json:"tags"`
	TemplateID   *uuid.UUID  `json:"template_id,omitempty"`
	Attachments  []uuid.UUID `json:"attachments"`
	ScheduledFor *time.Time  `json:"scheduled_for,omitempty"`
}

type Message struct {
	ID             uuid.UUID           `json:"id"`
	Type           string              `json:"type"`
	Subject        string              `json:"subject"`
	Content        string              `json:"content"`
	Sender         MessageParticipant  `json:"sender"`
	Recipients     []uuid.UUID         `json:"recipients"`
	RecipientNames []string            `json:"recipient_names"`
	SentVia        []string            `json:"sent_via"`
	Status         string              `json:"status"`
	Priority       string              `json:"priority"`
	SentAt         *time.Time          `json:"sent_at,omitempty"`
	ReadAt         *time.Time          `json:"read_at,omitempty"`
	ReadCount      int                 `json:"read_count"`
	Attachments    []MessageAttachment `json:"attachments"`
	Tags           []string            `json:"tags"`
	CreatedBy      uuid.UUID           `json:"created_by"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      *time.Time          `json:"updated_at,omitempty"`
}

type MessageParticipant struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Role   string    `json:"role"`
	Avatar *string   `json:"avatar,omitempty"`
}

type MessageAttachment struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	URL        string    `json:"url"`
	Size       int64     `json:"size"`
	MimeType   string    `json:"mime_type"`
	UploadedAt time.Time `json:"uploaded_at"`
}

type Conversation struct {
	ID            uuid.UUID                 `json:"id"`
	Title         string                    `json:"title"`
	Participants  []ConversationParticipant `json:"participants"`
	LastMessage   string                    `json:"last_message"`
	LastMessageAt time.Time                 `json:"last_message_at"`
	UnreadCount   int                       `json:"unread_count"`
	Status        string                    `json:"status"`
	Type          string                    `json:"type"`
	PropertyID    *uuid.UUID                `json:"property_id,omitempty"`
	UnitID        *uuid.UUID                `json:"unit_id,omitempty"`
	Priority      string                    `json:"priority"`
	Tags          []string                  `json:"tags"`
	CreatedAt     time.Time                 `json:"created_at"`
}

type ConversationParticipant struct {
	ID       uuid.UUID  `json:"id"`
	Name     string     `json:"name"`
	Role     string     `json:"role"`
	Avatar   *string    `json:"avatar,omitempty"`
	IsOnline bool       `json:"is_online"`
	LastSeen *time.Time `json:"last_seen,omitempty"`
}

type MessageTemplate struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Subject          string    `json:"subject"`
	Content          string    `json:"content"`
	Category         string    `json:"category"`
	UsageCount       int       `json:"usage_count"`
	Variables        []string  `json:"variables"`
	CreatedBy        uuid.UUID `json:"created_by"`
	CreatedAt        time.Time `json:"created_at"`
	IsSystemTemplate bool      `json:"is_system_template"`
}

func NewCommunicationHandler(logger Logger) *CommunicationHandler {
	return &CommunicationHandler{
		logger: logger,
	}
}

// GetMessages returns paginated messages for a user
func (h *CommunicationHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID, err := h.extractUserID(r)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	// Mock data for now - replace with real service calls
	messages := h.getMockMessages(userID)

	utils.WriteSuccess(w, http.StatusOK, "Messages retrieved successfully", map[string]interface{}{
		"messages":    messages,
		"total":       len(messages),
		"page":        1,
		"per_page":    20,
		"total_pages": 1,
	})
}

// SendMessage sends a new message
func (h *CommunicationHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := h.extractUserID(r)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Mock message creation
	message := Message{
		ID:      uuid.New(),
		Type:    req.Type,
		Subject: req.Subject,
		Content: req.Content,
		Sender: MessageParticipant{
			ID:   userID,
			Name: "Demo User",
			Role: "landlord",
		},
		Recipients:     req.Recipients,
		RecipientNames: []string{"Demo Recipient"},
		SentVia:        req.SentVia,
		Status:         "sent",
		Priority:       req.Priority,
		SentAt:         &[]time.Time{time.Now()}[0],
		ReadCount:      0,
		Attachments:    []MessageAttachment{},
		Tags:           req.Tags,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
	}

	utils.WriteSuccess(w, http.StatusCreated, "Message sent successfully", message)
}

// GetConversations returns paginated conversations for a user
func (h *CommunicationHandler) GetConversations(w http.ResponseWriter, r *http.Request) {
	userID, err := h.extractUserID(r)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	// Mock data for now
	conversations := h.getMockConversations(userID)

	utils.WriteSuccess(w, http.StatusOK, "Conversations retrieved successfully", map[string]interface{}{
		"conversations": conversations,
		"total":         len(conversations),
		"page":          1,
		"per_page":      20,
		"total_pages":   1,
	})
}

// GetMessageTemplates returns message templates for a user
func (h *CommunicationHandler) GetMessageTemplates(w http.ResponseWriter, r *http.Request) {
	_, err := h.extractUserID(r)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	// Mock templates
	templates := h.getMockTemplates()

	utils.WriteSuccess(w, http.StatusOK, "Message templates retrieved successfully", templates)
}

// MarkMessageAsRead marks a message as read
func (h *CommunicationHandler) MarkMessageAsRead(w http.ResponseWriter, r *http.Request) {
	if _, err := h.extractUserID(r); err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	if _, err := h.extractUUIDParam(r, "message_id"); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid message ID", err)
		return
	}

	// h.logger.Info("Message marked as read", "user_id", userID, "message_id", messageID)

	utils.WriteSuccess(w, http.StatusOK, "Message marked as read", nil)
}

// Helper methods
func (h *CommunicationHandler) extractUserID(r *http.Request) (uuid.UUID, error) {
	userClaims := r.Context().Value("user").(map[string]interface{})
	userIDStr := userClaims["user_id"].(string)
	return uuid.Parse(userIDStr)
}

func (h *CommunicationHandler) extractUUIDParam(r *http.Request, param string) (uuid.UUID, error) {
	vars := mux.Vars(r)
	paramValue := vars[param]
	if paramValue == "" {
		return uuid.Nil, nil
	}
	return uuid.Parse(paramValue)
}

// Mock data methods - replace with real database calls
func (h *CommunicationHandler) getMockMessages(userID uuid.UUID) []Message {
	return []Message{
		{
			ID:      uuid.New(),
			Type:    "individual",
			Subject: "Maintenance Request - Kitchen Faucet",
			Content: "Hi, I need to report a leaking kitchen faucet in Unit 4B. The leak started yesterday and is getting worse.",
			Sender: MessageParticipant{
				ID:   uuid.New(),
				Name: "John Doe",
				Role: "tenant",
			},
			Recipients:     []uuid.UUID{userID},
			RecipientNames: []string{"Landlord"},
			SentVia:        []string{"app", "email"},
			Status:         "delivered",
			Priority:       "medium",
			SentAt:         &[]time.Time{time.Now().Add(-2 * time.Hour)}[0],
			ReadCount:      0,
			Attachments: []MessageAttachment{
				{
					ID:         uuid.New(),
					Name:       "kitchen-leak.jpg",
					Type:       "image",
					URL:        "/api/attachments/kitchen-leak.jpg",
					Size:       245760,
					MimeType:   "image/jpeg",
					UploadedAt: time.Now().Add(-2 * time.Hour),
				},
			},
			Tags:      []string{"maintenance", "urgent"},
			CreatedBy: uuid.New(),
			CreatedAt: time.Now().Add(-2 * time.Hour),
		},
	}
}

func (h *CommunicationHandler) getMockConversations(userID uuid.UUID) []Conversation {
	return []Conversation{
		{
			ID:    uuid.New(),
			Title: "John Doe - Unit 4B",
			Participants: []ConversationParticipant{
				{
					ID:       uuid.New(),
					Name:     "John Doe",
					Role:     "tenant",
					IsOnline: true,
				},
				{
					ID:       userID,
					Name:     "Landlord",
					Role:     "landlord",
					IsOnline: true,
				},
			},
			LastMessage:   "Hi, I need to report a leaking kitchen faucet...",
			LastMessageAt: time.Now().Add(-2 * time.Hour),
			UnreadCount:   1,
			Status:        "active",
			Type:          "direct",
			PropertyID:    &[]uuid.UUID{uuid.New()}[0],
			UnitID:        &[]uuid.UUID{uuid.New()}[0],
			Priority:      "medium",
			Tags:          []string{"maintenance"},
			CreatedAt:     time.Now().Add(-24 * time.Hour),
		},
	}
}

func (h *CommunicationHandler) getMockTemplates() []MessageTemplate {
	return []MessageTemplate{
		{
			ID:               uuid.New(),
			Name:             "Rent Reminder",
			Subject:          "Rent Payment Reminder - {{property_name}} Unit {{unit_number}}",
			Content:          "Dear {{tenant_name}},\n\nThis is a friendly reminder that your rent payment for {{property_name}} Unit {{unit_number}} is due on {{due_date}}.\n\nAmount: {{rent_amount}}\nPayment methods: {{payment_methods}}\n\nPlease contact us if you have any questions.\n\nBest regards,\n{{sender_name}}",
			Category:         "rent_reminder",
			UsageCount:       25,
			Variables:        []string{"tenant_name", "property_name", "unit_number", "due_date", "rent_amount", "payment_methods", "sender_name"},
			CreatedBy:        uuid.New(),
			CreatedAt:        time.Now().Add(-30 * 24 * time.Hour),
			IsSystemTemplate: true,
		},
		{
			ID:               uuid.New(),
			Name:             "Maintenance Notice",
			Subject:          "Scheduled Maintenance - {{property_name}} Unit {{unit_number}}",
			Content:          "Dear {{tenant_name}},\n\nWe have scheduled maintenance for your unit on {{maintenance_date}} from {{start_time}} to {{end_time}}.\n\nMaintenance Type: {{maintenance_type}}\nDescription: {{description}}\n\nPlease ensure someone is available during this time.\n\nThank you,\n{{sender_name}}",
			Category:         "maintenance",
			UsageCount:       18,
			Variables:        []string{"tenant_name", "property_name", "unit_number", "maintenance_date", "start_time", "end_time", "maintenance_type", "description", "sender_name"},
			CreatedBy:        uuid.New(),
			CreatedAt:        time.Now().Add(-20 * 24 * time.Hour),
			IsSystemTemplate: true,
		},
	}
}

// CreateConversation creates a new conversation
func (h *CommunicationHandler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement conversation creation logic
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"message": "Conversation creation endpoint - implementation pending",
		"data":    map[string]string{"id": "placeholder-conversation-id"},
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// CreateMessageTemplate creates a new message template
func (h *CommunicationHandler) CreateMessageTemplate(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement template creation logic
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"message": "Message template creation endpoint - implementation pending",
		"data":    map[string]string{"id": "placeholder-template-id"},
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GetCommunicationAnalytics returns communication analytics
func (h *CommunicationHandler) GetCommunicationAnalytics(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement analytics logic
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"message": "Communication analytics endpoint - implementation pending",
		"data": map[string]interface{}{
			"total_messages":        100,
			"messages_this_week":    25,
			"response_rate":         0.85,
			"average_response_time": "2h 30m",
		},
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// UploadAttachment handles file upload for message attachments
func (h *CommunicationHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement file upload logic
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"success": true,
		"message": "File upload endpoint - implementation pending",
		"data":    map[string]string{"attachment_id": "placeholder-attachment-id"},
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
