package service

import (
	"errors"
	"time"

	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
)

// CaretakerService defines the interface for caretaker-related operations
type CaretakerService interface {
	// Authentication & Profile
	GetCaretakerIDByUserID(userID uuid.UUID) (uuid.UUID, error)
	GetDashboardData(caretakerID uuid.UUID) (*domain.CaretakerDashboard, error)
	GetCaretakerStats(caretakerID uuid.UUID) (*domain.CaretakerStats, error)

	// Task Management
	GetTasks(filters map[string]interface{}) ([]domain.CaretakerTask, error)
	GetTaskDetails(taskID, caretakerID uuid.UUID) (*domain.CaretakerTask, error)
	UpdateTaskStatus(taskID, caretakerID uuid.UUID, status domain.TaskStatus, notes string, actualHours *float64, photoURLs []string, audioURL *string, location *domain.Location) error
	AddTaskUpdate(update *domain.TaskUpdate) error

	// Tenant Movements
	GetTenantMovements(filters map[string]interface{}) ([]domain.TenantMovement, error)
	UpdateMovementStatus(movementID, caretakerID uuid.UUID, status domain.MovementStatus, checklist []domain.ChecklistItem, notes string, keysCollected, keysReturned *bool, actualDate *time.Time) error

	// Unit Conditions
	GetUnitConditions(filters map[string]interface{}) ([]domain.CaretakerUnitCondition, error)
	CreateUnitCondition(condition *domain.CaretakerUnitCondition) error
	UpdateUnitCondition(conditionID uuid.UUID, updates map[string]interface{}) error

	// Photo Management
	GetUnitPhotos(filters map[string]interface{}) ([]domain.UnitPhoto, error)

	// Maintenance Requests
	GetMaintenanceRequests(filters map[string]interface{}) ([]interface{}, error)
	UpdateMaintenanceRequest(requestID, caretakerID uuid.UUID, status interface{}, estimatedCost, actualCost *float64, photoURLs []string, updateMessage string, audioURL *string) error

	// Assignments
	GetAssignments(caretakerID uuid.UUID) ([]interface{}, error)
	GetAssignedProperties(caretakerID uuid.UUID) ([]interface{}, error)

	// Activity
	GetRecentActivity(caretakerID uuid.UUID, filters map[string]interface{}) ([]interface{}, error)

	// Emergency Management
	ReportEmergency(emergency *domain.Emergency) error
	SendEmergencyNotifications(emergency *domain.Emergency) error

	// QR Code Processing
	ProcessUnitQR(qrData string, caretakerID uuid.UUID) (interface{}, error)
}

// MockCaretakerService implements CaretakerService with mock data
type MockCaretakerService struct{}

// NewMockCaretakerService creates a new mock caretaker service
func NewMockCaretakerService() CaretakerService {
	return &MockCaretakerService{}
}

// GetCaretakerIDByUserID returns a mock caretaker ID for a user ID
func (s *MockCaretakerService) GetCaretakerIDByUserID(userID uuid.UUID) (uuid.UUID, error) {
	// Mock: return a fixed caretaker ID for any user
	return uuid.MustParse("caretaker-1234-5678-9012-123456789012"), nil
}

// GetDashboardData returns mock dashboard data
func (s *MockCaretakerService) GetDashboardData(caretakerID uuid.UUID) (*domain.CaretakerDashboard, error) {
	stats := domain.CaretakerStats{
		AssignedProperties:    3,
		ActiveTasks:           8,
		CompletedToday:        2,
		MaintenanceRequests:   5,
		UpcomingMoveOuts:      1,
		UpcomingMoveIns:       2,
		OverdueItems:          1,
		AverageTaskTime:       2.5,
		PerformanceRating:     4.7,
		TasksThisMonth:        24,
		TasksCompletedOnTime:  22,
		EmergencyCallsHandled: 3,
	}

	todaysTasks := []domain.CaretakerTask{
		{
			ID:             uuid.New(),
			CaretakerID:    caretakerID,
			PropertyID:     uuid.New(),
			TaskType:       "maintenance",
			Priority:       "high",
			Status:         "pending",
			Title:          "Fix kitchen sink in Unit 4B",
			Description:    "Kitchen sink is blocked and water is not draining properly",
			EstimatedHours: 2.0,
			ScheduledDate:  timePtr(time.Now()),
			CreatedAt:      time.Now().Add(-2 * time.Hour),
			UpdatedAt:      time.Now().Add(-2 * time.Hour),
		},
		{
			ID:             uuid.New(),
			CaretakerID:    caretakerID,
			PropertyID:     uuid.New(),
			TaskType:       "inspection",
			Priority:       "medium",
			Status:         "in_progress",
			Title:          "Weekly security check - Building A",
			Description:    "Conduct weekly security inspection of all entry points",
			EstimatedHours: 1.5,
			ScheduledDate:  timePtr(time.Now().Add(2 * time.Hour)),
			CreatedAt:      time.Now().Add(-4 * time.Hour),
			UpdatedAt:      time.Now().Add(-1 * time.Hour),
		},
	}

	upcomingMovements := []domain.TenantMovement{
		{
			ID:            uuid.New(),
			TenantID:      uuid.New(),
			PropertyID:    uuid.New(),
			UnitID:        uuid.New(),
			CaretakerID:   caretakerID,
			MovementType:  "move_out",
			Status:        "scheduled",
			ScheduledDate: time.Now().Add(24 * time.Hour),
			ChecklistItems: []domain.ChecklistItem{
				{ID: "1", Title: "Collect keys", Completed: false},
				{ID: "2", Title: "Inspect unit condition", Completed: false},
				{ID: "3", Title: "Document damages", Completed: false},
			},
			CreatedAt: time.Now().Add(-48 * time.Hour),
			UpdatedAt: time.Now().Add(-48 * time.Hour),
		},
	}

	recentUpdates := []domain.TaskUpdate{
		{
			ID:        uuid.New(),
			TaskID:    todaysTasks[0].ID,
			UpdatedBy: caretakerID,
			Message:   "Started working on the kitchen sink issue",
			CreatedAt: time.Now().Add(-30 * time.Minute),
		},
	}

	return &domain.CaretakerDashboard{
		Stats:             stats,
		TodaysTasks:       todaysTasks,
		UpcomingMovements: upcomingMovements,
		RecentUpdates:     recentUpdates,
	}, nil
}

// GetCaretakerStats returns mock caretaker statistics
func (s *MockCaretakerService) GetCaretakerStats(caretakerID uuid.UUID) (*domain.CaretakerStats, error) {
	return &domain.CaretakerStats{
		AssignedProperties:    3,
		ActiveTasks:           8,
		CompletedToday:        2,
		MaintenanceRequests:   5,
		UpcomingMoveOuts:      1,
		UpcomingMoveIns:       2,
		OverdueItems:          1,
		AverageTaskTime:       2.5,
		PerformanceRating:     4.7,
		TasksThisMonth:        24,
		TasksCompletedOnTime:  22,
		EmergencyCallsHandled: 3,
	}, nil
}

// GetTasks returns mock tasks based on filters
func (s *MockCaretakerService) GetTasks(filters map[string]interface{}) ([]domain.CaretakerTask, error) {
	caretakerID := uuid.MustParse("caretaker-1234-5678-9012-123456789012")

	tasks := []domain.CaretakerTask{
		{
			ID:             uuid.MustParse("task-1111-2222-3333-444444444444"),
			CaretakerID:    caretakerID,
			PropertyID:     uuid.New(),
			TaskType:       "maintenance",
			Priority:       "high",
			Status:         "pending",
			Title:          "Fix kitchen sink in Unit 4B",
			Description:    "Kitchen sink is blocked and water is not draining properly",
			EstimatedHours: 2.0,
			ScheduledDate:  timePtr(time.Now()),
			CreatedAt:      time.Now().Add(-2 * time.Hour),
			UpdatedAt:      time.Now().Add(-2 * time.Hour),
		},
		{
			ID:             uuid.MustParse("task-2222-3333-4444-555555555555"),
			CaretakerID:    caretakerID,
			PropertyID:     uuid.New(),
			TaskType:       "inspection",
			Priority:       "medium",
			Status:         "in_progress",
			Title:          "Weekly security check - Building A",
			Description:    "Conduct weekly security inspection of all entry points",
			EstimatedHours: 1.5,
			ScheduledDate:  timePtr(time.Now().Add(2 * time.Hour)),
			CreatedAt:      time.Now().Add(-4 * time.Hour),
			UpdatedAt:      time.Now().Add(-1 * time.Hour),
		},
		{
			ID:             uuid.MustParse("task-3333-4444-5555-666666666666"),
			CaretakerID:    caretakerID,
			PropertyID:     uuid.New(),
			TaskType:       "cleaning",
			Priority:       "low",
			Status:         "completed",
			Title:          "Clean common area - Lobby",
			Description:    "Deep cleaning of lobby area including floors and windows",
			EstimatedHours: 3.0,
			ActualHours:    floatPtr(2.5),
			CompletedDate:  timePtr(time.Now().Add(-6 * time.Hour)),
			CreatedAt:      time.Now().Add(-24 * time.Hour),
			UpdatedAt:      time.Now().Add(-6 * time.Hour),
		},
	}

	// Apply filters
	if status, ok := filters["status"].(string); ok {
		var filtered []domain.CaretakerTask
		for _, task := range tasks {
			if task.Status == status {
				filtered = append(filtered, task)
			}
		}
		return filtered, nil
	}

	return tasks, nil
}

// GetTaskDetails returns details for a specific task
func (s *MockCaretakerService) GetTaskDetails(taskID, caretakerID uuid.UUID) (*domain.CaretakerTask, error) {
	tasks, _ := s.GetTasks(map[string]interface{}{})

	for _, task := range tasks {
		if task.ID == taskID && task.CaretakerID == caretakerID {
			return &task, nil
		}
	}

	return nil, errors.New("task not found")
}

// UpdateTaskStatus updates the status of a task
func (s *MockCaretakerService) UpdateTaskStatus(taskID, caretakerID uuid.UUID, status domain.TaskStatus, notes string, actualHours *float64, photoURLs []string, audioURL *string, location *domain.Location) error {
	// Mock implementation - just validate that task exists
	_, err := s.GetTaskDetails(taskID, caretakerID)
	if err != nil {
		return err
	}

	// In a real implementation, this would update the database
	return nil
}

// AddTaskUpdate adds an update to a task
func (s *MockCaretakerService) AddTaskUpdate(update *domain.TaskUpdate) error {
	// Mock implementation - just validate the update
	if update.TaskID == uuid.Nil || update.UpdatedBy == uuid.Nil {
		return errors.New("invalid task update")
	}

	// In a real implementation, this would save to database
	return nil
}

// GetTenantMovements returns mock tenant movements
func (s *MockCaretakerService) GetTenantMovements(filters map[string]interface{}) ([]domain.TenantMovement, error) {
	caretakerID := uuid.MustParse("caretaker-1234-5678-9012-123456789012")

	movements := []domain.TenantMovement{
		{
			ID:            uuid.New(),
			TenantID:      uuid.New(),
			PropertyID:    uuid.New(),
			UnitID:        uuid.New(),
			CaretakerID:   caretakerID,
			MovementType:  "move_out",
			Status:        "scheduled",
			ScheduledDate: time.Now().Add(24 * time.Hour),
			ChecklistItems: []domain.ChecklistItem{
				{ID: "1", Title: "Collect keys", Completed: false},
				{ID: "2", Title: "Inspect unit condition", Completed: false},
			},
			CreatedAt: time.Now().Add(-48 * time.Hour),
			UpdatedAt: time.Now().Add(-48 * time.Hour),
		},
		{
			ID:            uuid.New(),
			TenantID:      uuid.New(),
			PropertyID:    uuid.New(),
			UnitID:        uuid.New(),
			CaretakerID:   caretakerID,
			MovementType:  "move_in",
			Status:        "scheduled",
			ScheduledDate: time.Now().Add(72 * time.Hour),
			ChecklistItems: []domain.ChecklistItem{
				{ID: "1", Title: "Prepare unit", Completed: true},
				{ID: "2", Title: "Hand over keys", Completed: false},
			},
			CreatedAt: time.Now().Add(-24 * time.Hour),
			UpdatedAt: time.Now().Add(-24 * time.Hour),
		},
	}

	return movements, nil
}

// UpdateMovementStatus updates the status of a tenant movement
func (s *MockCaretakerService) UpdateMovementStatus(movementID, caretakerID uuid.UUID, status domain.MovementStatus, checklist []domain.ChecklistItem, notes string, keysCollected, keysReturned *bool, actualDate *time.Time) error {
	// Mock implementation - just validate parameters
	if movementID == uuid.Nil || caretakerID == uuid.Nil {
		return errors.New("invalid movement update")
	}

	return nil
}

// GetUnitConditions returns mock unit conditions
func (s *MockCaretakerService) GetUnitConditions(filters map[string]interface{}) ([]domain.CaretakerUnitCondition, error) {
	caretakerID := uuid.MustParse("caretaker-1234-5678-9012-123456789012")

	conditions := []domain.CaretakerUnitCondition{
		{
			ID:             uuid.New(),
			PropertyID:     uuid.New(),
			UnitID:         uuid.New(),
			CaretakerID:    caretakerID,
			ConditionType:  "routine",
			OverallRating:  4,
			Status:         "current",
			InspectionDate: time.Now().Add(-24 * time.Hour),
			Areas: []domain.AreaCondition{
				{Area: "Kitchen", Rating: 4, Description: "Good condition, minor wear"},
				{Area: "Bathroom", Rating: 3, Description: "Needs tile repair"},
			},
			Issues: []domain.ConditionIssue{
				{ID: "1", Area: "Bathroom", Issue: "Cracked tile", Severity: "minor", Status: "open"},
			},
			Recommendations: []string{"Replace bathroom tiles", "Deep clean kitchen"},
			CreatedAt:       time.Now().Add(-24 * time.Hour),
			UpdatedAt:       time.Now().Add(-24 * time.Hour),
		},
	}

	return conditions, nil
}

// CreateUnitCondition creates a new unit condition report
func (s *MockCaretakerService) CreateUnitCondition(condition *domain.CaretakerUnitCondition) error {
	// Mock implementation - just validate
	if condition.PropertyID == uuid.Nil || condition.UnitID == uuid.Nil {
		return errors.New("invalid unit condition")
	}

	return nil
}

// UpdateUnitCondition updates a unit condition with the provided data
func (s *MockCaretakerService) UpdateUnitCondition(conditionID uuid.UUID, updates map[string]interface{}) error {
	// Mock implementation - in real scenario, would update database
	return nil
}

// GetUnitPhotos returns mock unit photos
func (s *MockCaretakerService) GetUnitPhotos(filters map[string]interface{}) ([]domain.UnitPhoto, error) {
	return []domain.UnitPhoto{}, nil
}

// GetMaintenanceRequests returns mock maintenance requests
func (s *MockCaretakerService) GetMaintenanceRequests(filters map[string]interface{}) ([]interface{}, error) {
	return []interface{}{}, nil
}

// UpdateMaintenanceRequest updates a maintenance request
func (s *MockCaretakerService) UpdateMaintenanceRequest(requestID, caretakerID uuid.UUID, status interface{}, estimatedCost, actualCost *float64, photoURLs []string, updateMessage string, audioURL *string) error {
	return nil
}

// GetAssignments returns mock assignments
func (s *MockCaretakerService) GetAssignments(caretakerID uuid.UUID) ([]interface{}, error) {
	return []interface{}{}, nil
}

// GetAssignedProperties returns mock assigned properties
func (s *MockCaretakerService) GetAssignedProperties(caretakerID uuid.UUID) ([]interface{}, error) {
	return []interface{}{}, nil
}

// GetRecentActivity returns mock recent activity
func (s *MockCaretakerService) GetRecentActivity(caretakerID uuid.UUID, filters map[string]interface{}) ([]interface{}, error) {
	return []interface{}{}, nil
}

// Emergency Management
func (s *MockCaretakerService) ReportEmergency(emergency *domain.Emergency) error {
	return nil
}

func (s *MockCaretakerService) SendEmergencyNotifications(emergency *domain.Emergency) error {
	return nil
}

// QR Code Processing
func (s *MockCaretakerService) ProcessUnitQR(qrData string, caretakerID uuid.UUID) (interface{}, error) {
	return nil, nil
}

// Helper functions
func timePtr(t time.Time) *time.Time {
	return &t
}

func floatPtr(f float64) *float64 {
	return &f
}
