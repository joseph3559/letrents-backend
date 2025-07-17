package domain

import (
	"time"

	"github.com/google/uuid"
)

// CaretakerTask represents a task assigned to a caretaker
type CaretakerTask struct {
	ID             uuid.UUID  `json:"id"`
	CaretakerID    uuid.UUID  `json:"caretaker_id"`
	PropertyID     uuid.UUID  `json:"property_id"`
	UnitID         *uuid.UUID `json:"unit_id,omitempty"`
	TaskType       string     `json:"task_type"`
	Priority       string     `json:"priority"`
	Status         string     `json:"status"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	EstimatedHours float64    `json:"estimated_hours"`
	ActualHours    *float64   `json:"actual_hours,omitempty"`
	ScheduledDate  *time.Time `json:"scheduled_date,omitempty"`
	CompletedDate  *time.Time `json:"completed_date,omitempty"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	PhotoURLs      []string   `json:"photo_urls"`
	AudioURL       *string    `json:"audio_url,omitempty"`
	Notes          string     `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CaretakerStats represents statistics for a caretaker
type CaretakerStats struct {
	AssignedProperties    int     `json:"assigned_properties"`
	ActiveTasks           int     `json:"active_tasks"`
	CompletedToday        int     `json:"completed_today"`
	MaintenanceRequests   int     `json:"maintenance_requests"`
	UpcomingMoveOuts      int     `json:"upcoming_move_outs"`
	UpcomingMoveIns       int     `json:"upcoming_move_ins"`
	OverdueItems          int     `json:"overdue_items"`
	AverageTaskTime       float64 `json:"average_task_time"`
	PerformanceRating     float64 `json:"performance_rating"`
	TasksThisMonth        int     `json:"tasks_this_month"`
	TasksCompletedOnTime  int     `json:"tasks_completed_on_time"`
	EmergencyCallsHandled int     `json:"emergency_calls_handled"`
}

// CaretakerDashboard represents the dashboard data for a caretaker
type CaretakerDashboard struct {
	Stats             CaretakerStats   `json:"stats"`
	TodaysTasks       []CaretakerTask  `json:"todays_tasks"`
	UpcomingMovements []TenantMovement `json:"upcoming_movements"`
	RecentUpdates     []TaskUpdate     `json:"recent_updates"`
}

// Task status constants
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusOnHold     TaskStatus = "on_hold"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// Task priority constants
type TaskPriority string

const (
	TaskPriorityLow       TaskPriority = "low"
	TaskPriorityMedium    TaskPriority = "medium"
	TaskPriorityHigh      TaskPriority = "high"
	TaskPriorityUrgent    TaskPriority = "urgent"
	TaskPriorityEmergency TaskPriority = "emergency"
)

// Location represents a geographic location
type Location struct {
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Address   string    `json:"address,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// TaskUpdate represents an update made to a task
type TaskUpdate struct {
	ID        uuid.UUID `json:"id"`
	TaskID    uuid.UUID `json:"task_id"`
	UpdatedBy uuid.UUID `json:"updated_by"`
	Message   string    `json:"message"`
	PhotoURLs []string  `json:"photo_urls"`
	AudioURL  *string   `json:"audio_url,omitempty"`
	Location  *Location `json:"location,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// TenantMovement represents a tenant move-in or move-out
type TenantMovement struct {
	ID             uuid.UUID       `json:"id"`
	TenantID       uuid.UUID       `json:"tenant_id"`
	PropertyID     uuid.UUID       `json:"property_id"`
	UnitID         uuid.UUID       `json:"unit_id"`
	CaretakerID    uuid.UUID       `json:"caretaker_id"`
	MovementType   string          `json:"movement_type"` // "move_in", "move_out"
	Status         string          `json:"status"`
	ScheduledDate  time.Time       `json:"scheduled_date"`
	ActualDate     *time.Time      `json:"actual_date,omitempty"`
	ChecklistItems []ChecklistItem `json:"checklist_items"`
	KeysCollected  *bool           `json:"keys_collected,omitempty"`
	KeysReturned   *bool           `json:"keys_returned,omitempty"`
	Notes          string          `json:"notes"`
	PhotoURLs      []string        `json:"photo_urls"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// MovementStatus represents the status of a tenant movement
type MovementStatus string

const (
	MovementStatusScheduled  MovementStatus = "scheduled"
	MovementStatusInProgress MovementStatus = "in_progress"
	MovementStatusCompleted  MovementStatus = "completed"
	MovementStatusCancelled  MovementStatus = "cancelled"
)

// ChecklistItem represents an item in a movement checklist
type ChecklistItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Completed   bool   `json:"completed"`
	Notes       string `json:"notes,omitempty"`
}

// CaretakerUnitCondition represents the condition of a unit as assessed by a caretaker
type CaretakerUnitCondition struct {
	ID              uuid.UUID        `json:"id"`
	PropertyID      uuid.UUID        `json:"property_id"`
	UnitID          uuid.UUID        `json:"unit_id"`
	CaretakerID     uuid.UUID        `json:"caretaker_id"`
	ConditionType   string           `json:"condition_type"`
	OverallRating   int              `json:"overall_rating"`
	Status          string           `json:"status"`
	InspectionDate  time.Time        `json:"inspection_date"`
	Areas           []AreaCondition  `json:"areas"`
	Issues          []ConditionIssue `json:"issues"`
	Recommendations []string         `json:"recommendations"`
	PhotoURLs       []string         `json:"photo_urls"`
	Notes           string           `json:"notes"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

// AreaCondition represents the condition of a specific area
type AreaCondition struct {
	Area        string   `json:"area"`
	Rating      int      `json:"rating"`
	Description string   `json:"description,omitempty"`
	PhotoURLs   []string `json:"photo_urls,omitempty"`
}

// ConditionIssue represents an issue found during inspection
type ConditionIssue struct {
	ID          string   `json:"id"`
	Area        string   `json:"area"`
	Issue       string   `json:"issue"`
	Severity    string   `json:"severity"`
	Description string   `json:"description,omitempty"`
	PhotoURLs   []string `json:"photo_urls,omitempty"`
	Status      string   `json:"status"`
}

// ConditionStatus represents the overall status of a unit condition
type ConditionStatus string

const (
	ConditionStatusExcellent    ConditionStatus = "excellent"
	ConditionStatusGood         ConditionStatus = "good"
	ConditionStatusFair         ConditionStatus = "fair"
	ConditionStatusPoor         ConditionStatus = "poor"
	ConditionStatusNeedsRepairs ConditionStatus = "needs_repairs"
)

// UnitPhoto represents a photo of a unit
type UnitPhoto struct {
	ID           uuid.UUID  `json:"id"`
	UnitID       uuid.UUID  `json:"unit_id"`
	CaretakerID  uuid.UUID  `json:"caretaker_id"`
	TaskID       *uuid.UUID `json:"task_id,omitempty"`
	PhotoURL     string     `json:"photo_url"`
	ThumbnailURL string     `json:"thumbnail_url"`
	Caption      string     `json:"caption,omitempty"`
	PhotoType    string     `json:"photo_type"`
	Area         string     `json:"area,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Emergency represents an emergency report
type Emergency struct {
	ID            uuid.UUID  `json:"id"`
	PropertyID    uuid.UUID  `json:"property_id"`
	UnitID        *uuid.UUID `json:"unit_id,omitempty"`
	ReportedBy    uuid.UUID  `json:"reported_by"`
	EmergencyType string     `json:"emergency_type"`
	Severity      string     `json:"severity"`
	Description   string     `json:"description"`
	Status        string     `json:"status"`
	Location      *Location  `json:"location,omitempty"`
	PhotoURLs     []string   `json:"photo_urls,omitempty"`
	AudioURL      *string    `json:"audio_url,omitempty"`
	ReportedAt    time.Time  `json:"reported_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// Emergency status constants
const (
	EmergencyStatusReported   = "reported"
	EmergencyStatusInProgress = "in_progress"
	EmergencyStatusResolved   = "resolved"
	EmergencyStatusCancelled  = "cancelled"
)
