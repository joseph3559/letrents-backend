package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type CommunicationRepository struct {
	db *sql.DB
}

// Domain types
type Message struct {
	ID             uuid.UUID           `json:"id"`
	ConversationID *uuid.UUID          `json:"conversation_id,omitempty"`
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
	ThreadID       *uuid.UUID          `json:"thread_id,omitempty"`
	CreatedBy      uuid.UUID           `json:"created_by"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      *time.Time          `json:"updated_at,omitempty"`
	IsAIGenerated  bool                `json:"is_ai_generated"`
	TemplateID     *uuid.UUID          `json:"template_id,omitempty"`
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

type MessageFilters struct {
	Type        *string    `json:"type,omitempty"`
	Status      *string    `json:"status,omitempty"`
	Priority    *string    `json:"priority,omitempty"`
	SenderID    *uuid.UUID `json:"sender_id,omitempty"`
	DateFrom    *time.Time `json:"date_from,omitempty"`
	DateTo      *time.Time `json:"date_to,omitempty"`
	SearchQuery *string    `json:"search_query,omitempty"`
	Tags        []string   `json:"tags,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

type ConversationFilters struct {
	Type        *string    `json:"type,omitempty"`
	Status      *string    `json:"status,omitempty"`
	PropertyID  *uuid.UUID `json:"property_id,omitempty"`
	UnitID      *uuid.UUID `json:"unit_id,omitempty"`
	SearchQuery *string    `json:"search_query,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

type CreateMessageRequest struct {
	ConversationID *uuid.UUID  `json:"conversation_id,omitempty"`
	Type           string      `json:"type"`
	Subject        string      `json:"subject"`
	Content        string      `json:"content"`
	Recipients     []uuid.UUID `json:"recipients"`
	SentVia        []string    `json:"sent_via"`
	Priority       string      `json:"priority"`
	Tags           []string    `json:"tags"`
	TemplateID     *uuid.UUID  `json:"template_id,omitempty"`
	Attachments    []uuid.UUID `json:"attachments"`
	ScheduledFor   *time.Time  `json:"scheduled_for,omitempty"`
}

type CreateConversationRequest struct {
	Title        string      `json:"title"`
	Participants []uuid.UUID `json:"participants"`
	Type         string      `json:"type"`
	PropertyID   *uuid.UUID  `json:"property_id,omitempty"`
	UnitID       *uuid.UUID  `json:"unit_id,omitempty"`
	Tags         []string    `json:"tags"`
}

func NewCommunicationRepository(db *sql.DB) *CommunicationRepository {
	return &CommunicationRepository{db: db}
}

// Message methods
func (r *CommunicationRepository) GetMessages(ctx context.Context, userID uuid.UUID, filters MessageFilters) ([]Message, int, error) {
	// Build dynamic query based on filters
	query := `
		SELECT 
			m.id, m.conversation_id, m.type, m.subject, m.content,
			m.sender_id, u.first_name, u.last_name, u.role,
			m.priority, m.status, m.sent_via, m.tags,
			m.sent_at, m.read_at, m.template_id, m.is_ai_generated,
			m.created_by, m.created_at, m.updated_at,
			COUNT(*) OVER() as total_count
		FROM messages m
		LEFT JOIN users u ON m.sender_id = u.id
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 0

	// Add user-specific filtering (either sender or recipient)
	argCount++
	query += fmt.Sprintf(` AND (m.sender_id = $%d OR EXISTS (
		SELECT 1 FROM message_recipients mr 
		WHERE mr.message_id = m.id AND mr.recipient_id = $%d
	))`, argCount, argCount)
	args = append(args, userID)

	// Add filters
	if filters.Type != nil {
		argCount++
		query += fmt.Sprintf(" AND m.type = $%d", argCount)
		args = append(args, *filters.Type)
	}

	if filters.Status != nil {
		argCount++
		query += fmt.Sprintf(" AND m.status = $%d", argCount)
		args = append(args, *filters.Status)
	}

	if filters.Priority != nil {
		argCount++
		query += fmt.Sprintf(" AND m.priority = $%d", argCount)
		args = append(args, *filters.Priority)
	}

	if filters.SenderID != nil {
		argCount++
		query += fmt.Sprintf(" AND m.sender_id = $%d", argCount)
		args = append(args, *filters.SenderID)
	}

	if filters.DateFrom != nil {
		argCount++
		query += fmt.Sprintf(" AND m.created_at >= $%d", argCount)
		args = append(args, *filters.DateFrom)
	}

	if filters.DateTo != nil {
		argCount++
		query += fmt.Sprintf(" AND m.created_at <= $%d", argCount)
		args = append(args, *filters.DateTo)
	}

	if filters.SearchQuery != nil {
		argCount++
		query += fmt.Sprintf(" AND (m.subject ILIKE $%d OR m.content ILIKE $%d)", argCount, argCount)
		args = append(args, "%"+*filters.SearchQuery+"%")
	}

	// Order and pagination
	query += " ORDER BY m.created_at DESC"

	if filters.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filters.Limit)
	}

	if filters.Offset > 0 {
		argCount++
		query += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	var totalCount int

	for rows.Next() {
		var msg Message
		var senderFirstName, senderLastName, senderRole string
		var sentViaJSON, tagsJSON []byte
		var conversationID, templateID sql.NullString
		var sentAt, readAt, updatedAt sql.NullTime

		err := rows.Scan(
			&msg.ID, &conversationID, &msg.Type, &msg.Subject, &msg.Content,
			&msg.Sender.ID, &senderFirstName, &senderLastName, &senderRole,
			&msg.Priority, &msg.Status, &sentViaJSON, &tagsJSON,
			&sentAt, &readAt, &templateID, &msg.IsAIGenerated,
			&msg.CreatedBy, &msg.CreatedAt, &updatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan message: %w", err)
		}

		// Parse conversation ID
		if conversationID.Valid {
			if convID, err := uuid.Parse(conversationID.String); err == nil {
				msg.ConversationID = &convID
			}
		}

		// Parse template ID
		if templateID.Valid {
			if tplID, err := uuid.Parse(templateID.String); err == nil {
				msg.TemplateID = &tplID
			}
		}

		// Set sender info
		msg.Sender.Name = fmt.Sprintf("%s %s", senderFirstName, senderLastName)
		msg.Sender.Role = senderRole

		// Parse JSON fields
		if len(sentViaJSON) > 0 {
			json.Unmarshal(sentViaJSON, &msg.SentVia)
		}
		if len(tagsJSON) > 0 {
			json.Unmarshal(tagsJSON, &msg.Tags)
		}

		// Set nullable time fields
		if sentAt.Valid {
			msg.SentAt = &sentAt.Time
		}
		if readAt.Valid {
			msg.ReadAt = &readAt.Time
		}
		if updatedAt.Valid {
			msg.UpdatedAt = &updatedAt.Time
		}

		// Get recipients
		recipients, recipientNames, err := r.getMessageRecipients(ctx, msg.ID)
		if err == nil {
			msg.Recipients = recipients
			msg.RecipientNames = recipientNames
		}

		// Get attachments
		attachments, err := r.getMessageAttachments(ctx, msg.ID)
		if err == nil {
			msg.Attachments = attachments
		}

		// Calculate read count
		msg.ReadCount = r.getMessageReadCount(ctx, msg.ID)

		messages = append(messages, msg)
	}

	return messages, totalCount, nil
}

func (r *CommunicationRepository) CreateMessage(ctx context.Context, userID uuid.UUID, req CreateMessageRequest) (*Message, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Create message
	messageID := uuid.New()
	sentViaJSON, _ := json.Marshal(req.SentVia)
	tagsJSON, _ := json.Marshal(req.Tags)

	var query string
	var args []interface{}

	if req.ConversationID != nil {
		query = `
			INSERT INTO messages (id, conversation_id, type, subject, content, sender_id, priority, sent_via, tags, template_id, scheduled_for)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`
		args = []interface{}{messageID, req.ConversationID, req.Type, req.Subject, req.Content, userID, req.Priority, sentViaJSON, tagsJSON, req.TemplateID, req.ScheduledFor}
	} else {
		query = `
			INSERT INTO messages (id, type, subject, content, sender_id, priority, sent_via, tags, template_id, scheduled_for)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`
		args = []interface{}{messageID, req.Type, req.Subject, req.Content, userID, req.Priority, sentViaJSON, tagsJSON, req.TemplateID, req.ScheduledFor}
	}

	_, err = tx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to create message: %w", err)
	}

	// Add recipients
	for _, recipientID := range req.Recipients {
		for _, channel := range req.SentVia {
			_, err = tx.ExecContext(ctx, `
				INSERT INTO message_recipients (message_id, recipient_id, delivery_channel)
				VALUES ($1, $2, $3)
			`, messageID, recipientID, channel)
			if err != nil {
				return nil, fmt.Errorf("failed to add recipient: %w", err)
			}
		}
	}

	// Update template usage count if template was used
	if req.TemplateID != nil {
		_, err = tx.ExecContext(ctx, `
			UPDATE message_templates SET usage_count = usage_count + 1 WHERE id = $1
		`, req.TemplateID)
		if err != nil {
			// Don't fail the whole operation for this
			fmt.Printf("Warning: failed to update template usage count: %v\n", err)
		}
	}

	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Retrieve the created message
	messages, _, err := r.GetMessages(ctx, userID, MessageFilters{
		Limit:  1,
		Offset: 0,
	})
	if err != nil || len(messages) == 0 {
		return nil, fmt.Errorf("failed to retrieve created message")
	}

	// Find our message
	for _, msg := range messages {
		if msg.ID == messageID {
			return &msg, nil
		}
	}

	return nil, fmt.Errorf("created message not found")
}

func (r *CommunicationRepository) MarkMessageAsRead(ctx context.Context, userID uuid.UUID, messageID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE message_recipients 
		SET status = 'read', read_at = NOW() 
		WHERE message_id = $1 AND recipient_id = $2 AND status != 'read'
	`, messageID, userID)

	return err
}

// Conversation methods
func (r *CommunicationRepository) GetConversations(ctx context.Context, userID uuid.UUID, filters ConversationFilters) ([]Conversation, int, error) {
	query := `
		SELECT DISTINCT
			c.id, c.title, c.type, c.status, c.priority,
			c.property_id, c.unit_id, c.tags,
			c.last_message, c.last_message_at, c.created_at,
			COUNT(*) OVER() as total_count
		FROM conversations c
		LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
		WHERE cp.user_id = $1
	`
	args := []interface{}{userID}
	argCount := 1

	// Add filters
	if filters.Type != nil {
		argCount++
		query += fmt.Sprintf(" AND c.type = $%d", argCount)
		args = append(args, *filters.Type)
	}

	if filters.Status != nil {
		argCount++
		query += fmt.Sprintf(" AND c.status = $%d", argCount)
		args = append(args, *filters.Status)
	}

	if filters.PropertyID != nil {
		argCount++
		query += fmt.Sprintf(" AND c.property_id = $%d", argCount)
		args = append(args, *filters.PropertyID)
	}

	if filters.UnitID != nil {
		argCount++
		query += fmt.Sprintf(" AND c.unit_id = $%d", argCount)
		args = append(args, *filters.UnitID)
	}

	if filters.SearchQuery != nil {
		argCount++
		query += fmt.Sprintf(" AND (c.title ILIKE $%d OR c.last_message ILIKE $%d)", argCount, argCount)
		args = append(args, "%"+*filters.SearchQuery+"%")
	}

	query += " ORDER BY c.last_message_at DESC NULLS LAST"

	if filters.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filters.Limit)
	}

	if filters.Offset > 0 {
		argCount++
		query += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query conversations: %w", err)
	}
	defer rows.Close()

	var conversations []Conversation
	var totalCount int

	for rows.Next() {
		var conv Conversation
		var tagsJSON []byte
		var propertyID, unitID sql.NullString
		var lastMessageAt sql.NullTime

		err := rows.Scan(
			&conv.ID, &conv.Title, &conv.Type, &conv.Status, &conv.Priority,
			&propertyID, &unitID, &tagsJSON,
			&conv.LastMessage, &lastMessageAt, &conv.CreatedAt,
			&totalCount,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation: %w", err)
		}

		// Parse UUIDs
		if propertyID.Valid {
			if propID, err := uuid.Parse(propertyID.String); err == nil {
				conv.PropertyID = &propID
			}
		}
		if unitID.Valid {
			if uID, err := uuid.Parse(unitID.String); err == nil {
				conv.UnitID = &uID
			}
		}

		// Parse tags
		if len(tagsJSON) > 0 {
			json.Unmarshal(tagsJSON, &conv.Tags)
		}

		// Set last message time
		if lastMessageAt.Valid {
			conv.LastMessageAt = lastMessageAt.Time
		}

		// Get participants
		participants, err := r.getConversationParticipants(ctx, conv.ID)
		if err == nil {
			conv.Participants = participants
		}

		// Calculate unread count
		conv.UnreadCount = r.getUnreadMessageCount(ctx, userID, conv.ID)

		conversations = append(conversations, conv)
	}

	return conversations, totalCount, nil
}

func (r *CommunicationRepository) CreateConversation(ctx context.Context, userID uuid.UUID, req CreateConversationRequest) (*Conversation, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Create conversation
	conversationID := uuid.New()
	tagsJSON, _ := json.Marshal(req.Tags)

	_, err = tx.ExecContext(ctx, `
		INSERT INTO conversations (id, title, type, property_id, unit_id, tags, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, conversationID, req.Title, req.Type, req.PropertyID, req.UnitID, tagsJSON, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add creator as participant
	_, err = tx.ExecContext(ctx, `
		INSERT INTO conversation_participants (conversation_id, user_id, role, is_admin)
		SELECT $1, $2, u.role, true
		FROM users u WHERE u.id = $2
	`, conversationID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to add creator as participant: %w", err)
	}

	// Add other participants
	for _, participantID := range req.Participants {
		if participantID != userID { // Don't add creator twice
			_, err = tx.ExecContext(ctx, `
				INSERT INTO conversation_participants (conversation_id, user_id, role)
				SELECT $1, $2, u.role
				FROM users u WHERE u.id = $2
			`, conversationID, participantID)
			if err != nil {
				return nil, fmt.Errorf("failed to add participant: %w", err)
			}
		}
	}

	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Retrieve the created conversation
	conversations, _, err := r.GetConversations(ctx, userID, ConversationFilters{
		Limit:  1,
		Offset: 0,
	})
	if err != nil || len(conversations) == 0 {
		return nil, fmt.Errorf("failed to retrieve created conversation")
	}

	// Find our conversation
	for _, conv := range conversations {
		if conv.ID == conversationID {
			return &conv, nil
		}
	}

	return nil, fmt.Errorf("created conversation not found")
}

// Template methods
func (r *CommunicationRepository) GetMessageTemplates(ctx context.Context, userID uuid.UUID, category string) ([]MessageTemplate, error) {
	query := `
		SELECT id, name, subject, content, category, usage_count, variables, created_by, created_at, is_system_template
		FROM message_templates
		WHERE is_active = true AND (is_system_template = true OR created_by = $1)
	`
	args := []interface{}{userID}

	if category != "" {
		query += " AND category = $2"
		args = append(args, category)
	}

	query += " ORDER BY usage_count DESC, name ASC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query templates: %w", err)
	}
	defer rows.Close()

	var templates []MessageTemplate
	for rows.Next() {
		var tpl MessageTemplate
		var variablesJSON []byte

		err := rows.Scan(
			&tpl.ID, &tpl.Name, &tpl.Subject, &tpl.Content, &tpl.Category,
			&tpl.UsageCount, &variablesJSON, &tpl.CreatedBy, &tpl.CreatedAt, &tpl.IsSystemTemplate,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan template: %w", err)
		}

		// Parse variables
		if len(variablesJSON) > 0 {
			json.Unmarshal(variablesJSON, &tpl.Variables)
		}

		templates = append(templates, tpl)
	}

	return templates, nil
}

func (r *CommunicationRepository) CreateMessageTemplate(ctx context.Context, userID uuid.UUID, name, subject, content, category string, variables []string) (*MessageTemplate, error) {
	templateID := uuid.New()
	variablesJSON, _ := json.Marshal(variables)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO message_templates (id, name, subject, content, category, variables, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, templateID, name, subject, content, category, variablesJSON, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to create template: %w", err)
	}

	// Retrieve the created template
	templates, err := r.GetMessageTemplates(ctx, userID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve created template")
	}

	for _, tpl := range templates {
		if tpl.ID == templateID {
			return &tpl, nil
		}
	}

	return nil, fmt.Errorf("created template not found")
}

// Helper methods
func (r *CommunicationRepository) getMessageRecipients(ctx context.Context, messageID uuid.UUID) ([]uuid.UUID, []string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT mr.recipient_id, u.first_name, u.last_name
		FROM message_recipients mr
		LEFT JOIN users u ON mr.recipient_id = u.id
		WHERE mr.message_id = $1
		GROUP BY mr.recipient_id, u.first_name, u.last_name
	`, messageID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var recipients []uuid.UUID
	var names []string

	for rows.Next() {
		var recipientID uuid.UUID
		var firstName, lastName string

		err := rows.Scan(&recipientID, &firstName, &lastName)
		if err != nil {
			continue
		}

		recipients = append(recipients, recipientID)
		names = append(names, fmt.Sprintf("%s %s", firstName, lastName))
	}

	return recipients, names, nil
}

func (r *CommunicationRepository) getMessageAttachments(ctx context.Context, messageID uuid.UUID) ([]MessageAttachment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, original_name, file_type, file_url, file_size, mime_type, uploaded_at
		FROM message_attachments
		WHERE message_id = $1 AND upload_status = 'completed'
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []MessageAttachment
	for rows.Next() {
		var att MessageAttachment
		err := rows.Scan(&att.ID, &att.Name, &att.Type, &att.URL, &att.Size, &att.MimeType, &att.UploadedAt)
		if err != nil {
			continue
		}
		attachments = append(attachments, att)
	}

	return attachments, nil
}

func (r *CommunicationRepository) getMessageReadCount(ctx context.Context, messageID uuid.UUID) int {
	var count int
	r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM message_recipients WHERE message_id = $1 AND status = 'read'
	`, messageID).Scan(&count)
	return count
}

func (r *CommunicationRepository) getConversationParticipants(ctx context.Context, conversationID uuid.UUID) ([]ConversationParticipant, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT cp.user_id, u.first_name, u.last_name, u.role,
			   CASE WHEN wc.status = 'connected' THEN true ELSE false END as is_online,
			   wc.last_seen
		FROM conversation_participants cp
		LEFT JOIN users u ON cp.user_id = u.id
		LEFT JOIN websocket_connections wc ON cp.user_id = wc.user_id AND wc.status = 'connected'
		WHERE cp.conversation_id = $1
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []ConversationParticipant
	for rows.Next() {
		var p ConversationParticipant
		var firstName, lastName string
		var lastSeen sql.NullTime

		err := rows.Scan(&p.ID, &firstName, &lastName, &p.Role, &p.IsOnline, &lastSeen)
		if err != nil {
			continue
		}

		p.Name = fmt.Sprintf("%s %s", firstName, lastName)
		if lastSeen.Valid {
			p.LastSeen = &lastSeen.Time
		}

		participants = append(participants, p)
	}

	return participants, nil
}

func (r *CommunicationRepository) getUnreadMessageCount(ctx context.Context, userID uuid.UUID, conversationID uuid.UUID) int {
	var count int
	r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM messages m
		LEFT JOIN message_recipients mr ON m.id = mr.message_id
		WHERE m.conversation_id = $1 
		AND mr.recipient_id = $2 
		AND mr.status != 'read'
	`, conversationID, userID).Scan(&count)
	return count
}
