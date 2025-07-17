package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type AIService struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

type AIRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stop        []string  `json:"stop,omitempty"`
}

type AIResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
	Error   *Error   `json:"error,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type Error struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code"`
}

// Smart Reply Options
type SmartReplyRequest struct {
	OriginalMessage     string                `json:"original_message"`
	ConversationContext []ConversationMessage `json:"conversation_context"`
	SenderRole          string                `json:"sender_role"`
	RecipientRole       string                `json:"recipient_role"`
	Tone                string                `json:"tone"` // professional, friendly, urgent, casual
	MaxReplies          int                   `json:"max_replies"`
	PropertyContext     *PropertyContext      `json:"property_context,omitempty"`
}

type SmartReplyResponse struct {
	Replies     []string  `json:"replies"`
	Confidence  float64   `json:"confidence"`
	Reasoning   string    `json:"reasoning"`
	GeneratedAt time.Time `json:"generated_at"`
}

type ConversationMessage struct {
	Role    string    `json:"role"`
	Content string    `json:"content"`
	SentAt  time.Time `json:"sent_at"`
}

type PropertyContext struct {
	PropertyName string `json:"property_name"`
	UnitNumber   string `json:"unit_number"`
	TenantName   string `json:"tenant_name"`
	IssueType    string `json:"issue_type,omitempty"`
}

// Message Summary Options
type MessageSummaryRequest struct {
	Messages         []ConversationMessage `json:"messages"`
	SummaryType      string                `json:"summary_type"` // brief, detailed, action_items
	TimeRange        string                `json:"time_range"`   // today, week, month
	IncludeActions   bool                  `json:"include_actions"`
	IncludeSentiment bool                  `json:"include_sentiment"`
}

type MessageSummaryResponse struct {
	Summary      string             `json:"summary"`
	ActionItems  []string           `json:"action_items,omitempty"`
	KeyTopics    []string           `json:"key_topics"`
	Sentiment    *SentimentAnalysis `json:"sentiment,omitempty"`
	Participants []string           `json:"participants"`
	MessageCount int                `json:"message_count"`
	GeneratedAt  time.Time          `json:"generated_at"`
}

type SentimentAnalysis struct {
	Overall    string   `json:"overall"`    // positive, negative, neutral
	Score      float64  `json:"score"`      // -1 to 1
	Confidence float64  `json:"confidence"` // 0 to 1
	Emotions   []string `json:"emotions"`
}

// Content Enhancement Options
type ContentEnhancementRequest struct {
	OriginalContent string `json:"original_content"`
	EnhancementType string `json:"enhancement_type"` // grammar, tone, clarity, translation
	TargetTone      string `json:"target_tone,omitempty"`
	TargetLanguage  string `json:"target_language,omitempty"`
	Context         string `json:"context,omitempty"`
}

type ContentEnhancementResponse struct {
	EnhancedContent string    `json:"enhanced_content"`
	Changes         []string  `json:"changes"`
	Confidence      float64   `json:"confidence"`
	GeneratedAt     time.Time `json:"generated_at"`
}

// Template Generation Options
type TemplateGenerationRequest struct {
	Category       string   `json:"category"` // rent_reminder, maintenance, welcome, etc.
	Variables      []string `json:"variables"`
	Tone           string   `json:"tone"`
	Length         string   `json:"length"` // short, medium, long
	IncludeSubject bool     `json:"include_subject"`
	CustomPrompt   string   `json:"custom_prompt,omitempty"`
}

type TemplateGenerationResponse struct {
	Subject     string    `json:"subject,omitempty"`
	Content     string    `json:"content"`
	Variables   []string  `json:"variables"`
	Usage       string    `json:"usage"`
	GeneratedAt time.Time `json:"generated_at"`
}

const (
	DefaultModel       = "gpt-4"
	DefaultMaxTokens   = 1000
	DefaultTemperature = 0.7
	DefaultTopP        = 1.0
)

func NewAIService(apiKey string) *AIService {
	return &AIService{
		apiKey:  apiKey,
		baseURL: "https://api.openai.com/v1",
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *AIService) GenerateSmartReplies(ctx context.Context, req SmartReplyRequest) (*SmartReplyResponse, error) {
	// Build context from conversation
	var contextBuilder strings.Builder
	contextBuilder.WriteString("You are an AI assistant helping to generate professional smart replies for property management communications.\n\n")

	// Add property context if available
	if req.PropertyContext != nil {
		contextBuilder.WriteString(fmt.Sprintf("Property: %s, Unit: %s, Tenant: %s\n",
			req.PropertyContext.PropertyName,
			req.PropertyContext.UnitNumber,
			req.PropertyContext.TenantName))
	}

	// Add conversation context
	if len(req.ConversationContext) > 0 {
		contextBuilder.WriteString("\n--- Conversation History ---\n")
		for _, msg := range req.ConversationContext {
			contextBuilder.WriteString(fmt.Sprintf("%s (%s): %s\n", msg.Role, msg.SentAt.Format("Jan 2, 3:04 PM"), msg.Content))
		}
	}

	contextBuilder.WriteString(fmt.Sprintf("\n--- Original Message to Reply To ---\n%s\n\n", req.OriginalMessage))
	contextBuilder.WriteString(fmt.Sprintf("Generate %d appropriate replies from a %s to a %s in a %s tone. ",
		req.MaxReplies, req.SenderRole, req.RecipientRole, req.Tone))
	contextBuilder.WriteString("Each reply should be concise, professional, and contextually appropriate. ")
	contextBuilder.WriteString("Return the replies as a JSON array of strings.")

	messages := []Message{
		{
			Role:    "user",
			Content: contextBuilder.String(),
		},
	}

	aiReq := AIRequest{
		Model:       DefaultModel,
		Messages:    messages,
		MaxTokens:   DefaultMaxTokens,
		Temperature: DefaultTemperature,
	}

	response, err := s.makeRequest(ctx, aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate smart replies: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no replies generated")
	}

	// Parse the JSON response
	var replies []string
	content := response.Choices[0].Message.Content
	if err := json.Unmarshal([]byte(content), &replies); err != nil {
		// If JSON parsing fails, split by lines and clean up
		lines := strings.Split(content, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "```") {
				replies = append(replies, line)
			}
		}
	}

	// Calculate confidence based on response quality
	confidence := 0.8 // Default confidence
	if len(replies) >= req.MaxReplies {
		confidence = 0.9
	}

	return &SmartReplyResponse{
		Replies:     replies,
		Confidence:  confidence,
		Reasoning:   "Generated based on conversation context and role-appropriate tone",
		GeneratedAt: time.Now(),
	}, nil
}

func (s *AIService) SummarizeMessages(ctx context.Context, req MessageSummaryRequest) (*MessageSummaryResponse, error) {
	var contextBuilder strings.Builder
	contextBuilder.WriteString("You are an AI assistant helping to summarize property management communications.\n\n")

	// Add messages to context
	contextBuilder.WriteString("--- Messages to Summarize ---\n")
	participants := make(map[string]bool)

	for _, msg := range req.Messages {
		contextBuilder.WriteString(fmt.Sprintf("%s (%s): %s\n",
			msg.Role, msg.SentAt.Format("Jan 2, 3:04 PM"), msg.Content))
		participants[msg.Role] = true
	}

	var participantList []string
	for participant := range participants {
		participantList = append(participantList, participant)
	}

	// Build prompt based on summary type
	switch req.SummaryType {
	case "brief":
		contextBuilder.WriteString("\nProvide a brief 2-3 sentence summary of this conversation.")
	case "detailed":
		contextBuilder.WriteString("\nProvide a detailed summary including key points, decisions made, and any follow-up items.")
	case "action_items":
		contextBuilder.WriteString("\nFocus on extracting specific action items, deadlines, and responsibilities from this conversation.")
	default:
		contextBuilder.WriteString("\nProvide a balanced summary covering main topics and outcomes.")
	}

	if req.IncludeActions {
		contextBuilder.WriteString(" Include any action items or next steps mentioned.")
	}

	if req.IncludeSentiment {
		contextBuilder.WriteString(" Also analyze the overall sentiment and tone of the conversation.")
	}

	contextBuilder.WriteString("\n\nReturn the response as JSON with the following structure:")
	contextBuilder.WriteString(`
	{
		"summary": "Main summary text",
		"action_items": ["action1", "action2"] (if any),
		"key_topics": ["topic1", "topic2"],
		"sentiment": {
			"overall": "positive/negative/neutral",
			"score": 0.5,
			"confidence": 0.8,
			"emotions": ["satisfied", "concerned"]
		} (if requested)
	}`)

	messages := []Message{
		{
			Role:    "user",
			Content: contextBuilder.String(),
		},
	}

	aiReq := AIRequest{
		Model:       DefaultModel,
		Messages:    messages,
		MaxTokens:   DefaultMaxTokens,
		Temperature: 0.3, // Lower temperature for more consistent summaries
	}

	response, err := s.makeRequest(ctx, aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate summary: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no summary generated")
	}

	// Parse the JSON response
	content := response.Choices[0].Message.Content

	// Clean up the content if it has markdown formatting
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result struct {
		Summary     string             `json:"summary"`
		ActionItems []string           `json:"action_items"`
		KeyTopics   []string           `json:"key_topics"`
		Sentiment   *SentimentAnalysis `json:"sentiment"`
	}

	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// If JSON parsing fails, return a basic summary
		return &MessageSummaryResponse{
			Summary:      content,
			ActionItems:  []string{},
			KeyTopics:    []string{},
			Participants: participantList,
			MessageCount: len(req.Messages),
			GeneratedAt:  time.Now(),
		}, nil
	}

	return &MessageSummaryResponse{
		Summary:      result.Summary,
		ActionItems:  result.ActionItems,
		KeyTopics:    result.KeyTopics,
		Sentiment:    result.Sentiment,
		Participants: participantList,
		MessageCount: len(req.Messages),
		GeneratedAt:  time.Now(),
	}, nil
}

func (s *AIService) EnhanceContent(ctx context.Context, req ContentEnhancementRequest) (*ContentEnhancementResponse, error) {
	var contextBuilder strings.Builder
	contextBuilder.WriteString("You are an AI assistant helping to enhance property management communications.\n\n")

	contextBuilder.WriteString(fmt.Sprintf("Original content: %s\n\n", req.OriginalContent))

	switch req.EnhancementType {
	case "grammar":
		contextBuilder.WriteString("Fix any grammar, spelling, and punctuation errors in the content.")
	case "tone":
		contextBuilder.WriteString(fmt.Sprintf("Adjust the tone of the content to be more %s while maintaining the original meaning.", req.TargetTone))
	case "clarity":
		contextBuilder.WriteString("Improve the clarity and readability of the content without changing the core message.")
	case "translation":
		contextBuilder.WriteString(fmt.Sprintf("Translate the content to %s while maintaining the professional tone.", req.TargetLanguage))
	default:
		contextBuilder.WriteString("Improve the overall quality, clarity, and professionalism of the content.")
	}

	if req.Context != "" {
		contextBuilder.WriteString(fmt.Sprintf("\nContext: %s", req.Context))
	}

	contextBuilder.WriteString("\n\nReturn the response as JSON with the following structure:")
	contextBuilder.WriteString(`
	{
		"enhanced_content": "The improved content",
		"changes": ["List of changes made"],
		"confidence": 0.9
	}`)

	messages := []Message{
		{
			Role:    "user",
			Content: contextBuilder.String(),
		},
	}

	aiReq := AIRequest{
		Model:       DefaultModel,
		Messages:    messages,
		MaxTokens:   DefaultMaxTokens,
		Temperature: 0.3,
	}

	response, err := s.makeRequest(ctx, aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to enhance content: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no enhancement generated")
	}

	content := response.Choices[0].Message.Content
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result ContentEnhancementResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// If JSON parsing fails, return the raw content
		return &ContentEnhancementResponse{
			EnhancedContent: content,
			Changes:         []string{"Content enhanced"},
			Confidence:      0.7,
			GeneratedAt:     time.Now(),
		}, nil
	}

	result.GeneratedAt = time.Now()
	return &result, nil
}

func (s *AIService) GenerateTemplate(ctx context.Context, req TemplateGenerationRequest) (*TemplateGenerationResponse, error) {
	var contextBuilder strings.Builder
	contextBuilder.WriteString("You are an AI assistant helping to generate property management message templates.\n\n")

	contextBuilder.WriteString(fmt.Sprintf("Generate a %s template for the category: %s\n", req.Length, req.Category))
	contextBuilder.WriteString(fmt.Sprintf("Tone: %s\n", req.Tone))

	if len(req.Variables) > 0 {
		contextBuilder.WriteString(fmt.Sprintf("Include these variables: %s\n", strings.Join(req.Variables, ", ")))
		contextBuilder.WriteString("Use {{variable_name}} format for variables.\n")
	}

	if req.CustomPrompt != "" {
		contextBuilder.WriteString(fmt.Sprintf("Additional requirements: %s\n", req.CustomPrompt))
	}

	contextBuilder.WriteString("\nReturn the response as JSON with the following structure:")
	if req.IncludeSubject {
		contextBuilder.WriteString(`
		{
			"subject": "Email subject line with variables",
			"content": "Template content with variables",
			"variables": ["list", "of", "variables", "used"],
			"usage": "Description of when to use this template"
		}`)
	} else {
		contextBuilder.WriteString(`
		{
			"content": "Template content with variables",
			"variables": ["list", "of", "variables", "used"],
			"usage": "Description of when to use this template"
		}`)
	}

	messages := []Message{
		{
			Role:    "user",
			Content: contextBuilder.String(),
		},
	}

	aiReq := AIRequest{
		Model:       DefaultModel,
		Messages:    messages,
		MaxTokens:   DefaultMaxTokens,
		Temperature: 0.5,
	}

	response, err := s.makeRequest(ctx, aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate template: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no template generated")
	}

	content := response.Choices[0].Message.Content
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result TemplateGenerationResponse
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		// If JSON parsing fails, return basic template
		return &TemplateGenerationResponse{
			Content:     content,
			Variables:   req.Variables,
			Usage:       fmt.Sprintf("Use for %s communications", req.Category),
			GeneratedAt: time.Now(),
		}, nil
	}

	result.GeneratedAt = time.Now()
	return &result, nil
}

func (s *AIService) makeRequest(ctx context.Context, aiReq AIRequest) (*AIResponse, error) {
	reqBody, err := json.Marshal(aiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var aiResp AIResponse
	if err := json.Unmarshal(body, &aiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if aiResp.Error != nil {
		return nil, fmt.Errorf("OpenAI API error: %s", aiResp.Error.Message)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return &aiResp, nil
}

// Helper functions for database integration
func (s *AIService) LogAIGeneration(ctx context.Context, messageID *uuid.UUID, contentType, originalContent, generatedContent string, confidence float64) error {
	// This would integrate with your database to log AI-generated content
	// Implementation depends on your database setup
	return nil
}

func (s *AIService) GetAIHistory(ctx context.Context, userID uuid.UUID, limit int) ([]AIGenerationHistory, error) {
	// This would retrieve AI generation history from database
	return nil, nil
}

type AIGenerationHistory struct {
	ID               uuid.UUID  `json:"id"`
	MessageID        *uuid.UUID `json:"message_id,omitempty"`
	ContentType      string     `json:"content_type"`
	OriginalContent  string     `json:"original_content"`
	GeneratedContent string     `json:"generated_content"`
	ConfidenceScore  float64    `json:"confidence_score"`
	ModelUsed        string     `json:"model_used"`
	UserFeedback     *string    `json:"user_feedback,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}
