package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"letrents-backend/internal/api/middleware"
	"letrents-backend/internal/api/service"
	"letrents-backend/internal/core/domain"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type CaretakerHandler struct {
	caretakerService service.CaretakerService
}

func NewCaretakerHandler(caretakerService service.CaretakerService) *CaretakerHandler {
	return &CaretakerHandler{
		caretakerService: caretakerService,
	}
}

// Dashboard endpoints

// GetCaretakerDashboard returns the main dashboard data
func (h *CaretakerHandler) GetCaretakerDashboard(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user_object").(*domain.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	dashboard, err := h.caretakerService.GetDashboardData(caretakerID)
	if err != nil {
		log.Printf("Error getting dashboard data: %v", err)
		http.Error(w, "Failed to get dashboard data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dashboard)
}

// GetCaretakerStats returns statistics for the caretaker
func (h *CaretakerHandler) GetCaretakerStats(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user_object").(*domain.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	stats, err := h.caretakerService.GetCaretakerStats(caretakerID)
	if err != nil {
		log.Printf("Error getting caretaker stats: %v", err)
		http.Error(w, "Failed to get stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Task management endpoints

// GetTasks returns tasks assigned to the caretaker
func (h *CaretakerHandler) GetTasks(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user_object").(*domain.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")
	taskType := r.URL.Query().Get("type")
	propertyID := r.URL.Query().Get("property_id")
	dateFilter := r.URL.Query().Get("date") // "today", "week", "overdue"

	filters := map[string]interface{}{
		"caretaker_id": caretakerID,
	}

	if status != "" {
		filters["status"] = status
	}
	if priority != "" {
		filters["priority"] = priority
	}
	if taskType != "" {
		filters["task_type"] = taskType
	}
	if propertyID != "" {
		if pid, err := uuid.Parse(propertyID); err == nil {
			filters["property_id"] = pid
		}
	}
	if dateFilter != "" {
		filters["date_filter"] = dateFilter
	}

	tasks, err := h.caretakerService.GetTasks(filters)
	if err != nil {
		log.Printf("Error getting tasks: %v", err)
		http.Error(w, "Failed to get tasks", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

// GetTaskDetails returns detailed information about a specific task
func (h *CaretakerHandler) GetTaskDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID, err := uuid.Parse(vars["taskId"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	task, err := h.caretakerService.GetTaskDetails(taskID, caretakerID)
	if err != nil {
		log.Printf("Error getting task details: %v", err)
		http.Error(w, "Failed to get task details", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

// UpdateTaskStatus updates the status of a task
func (h *CaretakerHandler) UpdateTaskStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID, err := uuid.Parse(vars["taskId"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var updateRequest struct {
		Status      domain.TaskStatus `json:"status"`
		Notes       string            `json:"notes"`
		ActualHours *float64          `json:"actual_hours,omitempty"`
		PhotoURLs   []string          `json:"photo_urls,omitempty"`
		AudioURL    *string           `json:"audio_url,omitempty"`
		Location    *domain.Location  `json:"location,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateRequest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.caretakerService.UpdateTaskStatus(taskID, caretakerID, updateRequest.Status, updateRequest.Notes, updateRequest.ActualHours, updateRequest.PhotoURLs, updateRequest.AudioURL, updateRequest.Location)
	if err != nil {
		log.Printf("Error updating task status: %v", err)
		http.Error(w, "Failed to update task", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Task updated successfully"})
}

// AddTaskUpdate adds an update/comment to a task
func (h *CaretakerHandler) AddTaskUpdate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID, err := uuid.Parse(vars["taskId"])
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var update domain.TaskUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	update.ID = uuid.New()
	update.TaskID = taskID
	update.UpdatedBy = caretakerID
	update.CreatedAt = time.Now()

	err = h.caretakerService.AddTaskUpdate(&update)
	if err != nil {
		log.Printf("Error adding task update: %v", err)
		http.Error(w, "Failed to add update", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(update)
}

// Tenant movement endpoints

// GetTenantMovements returns upcoming and recent tenant movements
func (h *CaretakerHandler) GetTenantMovements(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	movementType := r.URL.Query().Get("type") // "move_in", "move_out"
	status := r.URL.Query().Get("status")
	daysAhead := r.URL.Query().Get("days_ahead")

	filters := map[string]interface{}{
		"caretaker_id": caretakerID,
	}

	if movementType != "" {
		filters["movement_type"] = movementType
	}
	if status != "" {
		filters["status"] = status
	}
	if daysAhead != "" {
		if days, err := strconv.Atoi(daysAhead); err == nil {
			filters["days_ahead"] = days
		}
	}

	movements, err := h.caretakerService.GetTenantMovements(filters)
	if err != nil {
		log.Printf("Error getting tenant movements: %v", err)
		http.Error(w, "Failed to get movements", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(movements)
}

// UpdateMovementStatus updates the status of a tenant movement
func (h *CaretakerHandler) UpdateMovementStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	movementID, err := uuid.Parse(vars["movementId"])
	if err != nil {
		http.Error(w, "Invalid movement ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var updateRequest struct {
		Status         domain.MovementStatus  `json:"status"`
		ChecklistItems []domain.ChecklistItem `json:"checklist_items,omitempty"`
		Notes          string                 `json:"notes"`
		KeysCollected  *bool                  `json:"keys_collected,omitempty"`
		KeysReturned   *bool                  `json:"keys_returned,omitempty"`
		ActualDate     *time.Time             `json:"actual_date,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateRequest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.caretakerService.UpdateMovementStatus(movementID, caretakerID, updateRequest.Status, updateRequest.ChecklistItems, updateRequest.Notes, updateRequest.KeysCollected, updateRequest.KeysReturned, updateRequest.ActualDate)
	if err != nil {
		log.Printf("Error updating movement status: %v", err)
		http.Error(w, "Failed to update movement", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Movement updated successfully"})
}

// Unit condition endpoints

// GetUnitConditions returns unit conditions for assigned properties
func (h *CaretakerHandler) GetUnitConditions(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	propertyID := r.URL.Query().Get("property_id")
	unitID := r.URL.Query().Get("unit_id")
	status := r.URL.Query().Get("status")

	filters := map[string]interface{}{
		"caretaker_id": caretakerID,
	}

	if propertyID != "" {
		if pid, err := uuid.Parse(propertyID); err == nil {
			filters["property_id"] = pid
		}
	}
	if unitID != "" {
		if uid, err := uuid.Parse(unitID); err == nil {
			filters["unit_id"] = uid
		}
	}
	if status != "" {
		filters["status"] = status
	}

	conditions, err := h.caretakerService.GetUnitConditions(filters)
	if err != nil {
		log.Printf("Error getting unit conditions: %v", err)
		http.Error(w, "Failed to get unit conditions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conditions)
}

// CreateUnitCondition creates a new unit condition report
func (h *CaretakerHandler) CreateUnitCondition(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var condition domain.CaretakerUnitCondition
	if err := json.NewDecoder(r.Body).Decode(&condition); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	condition.ID = uuid.New()
	condition.CaretakerID = caretakerID
	condition.InspectionDate = time.Now()
	condition.CreatedAt = time.Now()
	condition.UpdatedAt = time.Now()

	err = h.caretakerService.CreateUnitCondition(&condition)
	if err != nil {
		log.Printf("Error creating unit condition: %v", err)
		http.Error(w, "Failed to create unit condition", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(condition)
}

// UpdateUnitCondition updates an existing unit condition report
func (h *CaretakerHandler) UpdateUnitCondition(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	conditionID, err := uuid.Parse(vars["conditionId"])
	if err != nil {
		http.Error(w, "Invalid condition ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var updateRequest struct {
		OverallStatus  domain.ConditionStatus  `json:"overall_status"`
		Areas          []domain.AreaCondition  `json:"areas"`
		Issues         []domain.ConditionIssue `json:"issues"`
		ReadyForTenant bool                    `json:"ready_for_tenant"`
		Notes          string                  `json:"notes"`
		NextInspection *time.Time              `json:"next_inspection,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateRequest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// TODO: Implement UpdateUnitCondition service method
	updateData := map[string]interface{}{
		"caretaker_id":     caretakerID,
		"overall_status":   updateRequest.OverallStatus,
		"areas":            updateRequest.Areas,
		"issues":           updateRequest.Issues,
		"ready_for_tenant": updateRequest.ReadyForTenant,
		"notes":            updateRequest.Notes,
		"next_inspection":  updateRequest.NextInspection,
	}

	err = h.caretakerService.UpdateUnitCondition(conditionID, updateData)
	if err != nil {
		log.Printf("Error updating unit condition: %v", err)
		http.Error(w, "Failed to update unit condition", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Unit condition updated successfully"})
}

// Photo upload endpoints

// UploadUnitPhoto handles photo uploads for units
func (h *CaretakerHandler) UploadUnitPhoto(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse multipart form
	err = r.ParseMultipartForm(32 << 20) // 32MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "Failed to get file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Get form data
	unitIDStr := r.FormValue("unit_id")
	caption := r.FormValue("caption")
	photoType := r.FormValue("photo_type")
	area := r.FormValue("area")
	taskIDStr := r.FormValue("task_id")

	unitID, err := uuid.Parse(unitIDStr)
	if err != nil {
		http.Error(w, "Invalid unit ID", http.StatusBadRequest)
		return
	}

	var taskID *uuid.UUID
	if taskIDStr != "" {
		if tid, err := uuid.Parse(taskIDStr); err == nil {
			taskID = &tid
		}
	}

	// TODO: Implement photo upload service
	// For now, create mock response
	photo := &domain.UnitPhoto{
		ID:           uuid.New(),
		UnitID:       unitID,
		CaretakerID:  caretakerID,
		TaskID:       taskID,
		PhotoURL:     "https://example.com/photo.jpg",
		ThumbnailURL: "https://example.com/thumb.jpg",
		Caption:      caption,
		PhotoType:    photoType,
		Area:         area,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// TODO: Implement SaveUnitPhoto service method
	err = nil
	if err != nil {
		log.Printf("Error saving photo record: %v", err)
		http.Error(w, "Failed to save photo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photo)
}

// GetUnitPhotos returns photos for a specific unit
func (h *CaretakerHandler) GetUnitPhotos(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	unitID, err := uuid.Parse(vars["unitId"])
	if err != nil {
		http.Error(w, "Invalid unit ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	photoType := r.URL.Query().Get("type")
	area := r.URL.Query().Get("area")

	filters := map[string]interface{}{
		"unit_id":      unitID,
		"caretaker_id": caretakerID,
	}

	if photoType != "" {
		filters["photo_type"] = photoType
	}
	if area != "" {
		filters["area"] = area
	}

	photos, err := h.caretakerService.GetUnitPhotos(filters)
	if err != nil {
		log.Printf("Error getting unit photos: %v", err)
		http.Error(w, "Failed to get photos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photos)
}

// Maintenance endpoints

// GetMaintenanceRequests returns maintenance requests assigned to the caretaker
func (h *CaretakerHandler) GetMaintenanceRequests(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	priority := r.URL.Query().Get("priority")

	filters := map[string]interface{}{
		"assigned_to": caretakerID,
	}

	if status != "" {
		filters["status"] = status
	}
	if category != "" {
		filters["category"] = category
	}
	if priority != "" {
		filters["priority"] = priority
	}

	requests, err := h.caretakerService.GetMaintenanceRequests(filters)
	if err != nil {
		log.Printf("Error getting maintenance requests: %v", err)
		http.Error(w, "Failed to get maintenance requests", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// UpdateMaintenanceRequest updates a maintenance request
func (h *CaretakerHandler) UpdateMaintenanceRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID, err := uuid.Parse(vars["requestId"])
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var updateRequest struct {
		Status        domain.MaintenanceStatus `json:"status"`
		EstimatedCost *float64                 `json:"estimated_cost,omitempty"`
		ActualCost    *float64                 `json:"actual_cost,omitempty"`
		PhotoURLs     []string                 `json:"photo_urls,omitempty"`
		UpdateMessage string                   `json:"update_message"`
		AudioURL      *string                  `json:"audio_url,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateRequest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = h.caretakerService.UpdateMaintenanceRequest(requestID, caretakerID, updateRequest.Status, updateRequest.EstimatedCost, updateRequest.ActualCost, updateRequest.PhotoURLs, updateRequest.UpdateMessage, updateRequest.AudioURL)
	if err != nil {
		log.Printf("Error updating maintenance request: %v", err)
		http.Error(w, "Failed to update maintenance request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Maintenance request updated successfully"})
}

// Emergency endpoints

// ReportEmergency handles emergency reports from caretakers
func (h *CaretakerHandler) ReportEmergency(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var emergency domain.Emergency
	if err := json.NewDecoder(r.Body).Decode(&emergency); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	emergency.ID = uuid.New()
	emergency.ReportedBy = caretakerID
	emergency.Status = domain.EmergencyStatusReported
	emergency.ReportedAt = time.Now()
	emergency.CreatedAt = time.Now()

	err = h.caretakerService.ReportEmergency(&emergency)
	if err != nil {
		log.Printf("Error reporting emergency: %v", err)
		http.Error(w, "Failed to report emergency", http.StatusInternalServerError)
		return
	}

	// Send immediate notifications to relevant parties
	go h.caretakerService.SendEmergencyNotifications(&emergency)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(emergency)
}

// Assignment endpoints

// GetAssignments returns property/unit assignments for the caretaker
func (h *CaretakerHandler) GetAssignments(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	assignments, err := h.caretakerService.GetAssignments(caretakerID)
	if err != nil {
		log.Printf("Error getting assignments: %v", err)
		http.Error(w, "Failed to get assignments", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assignments)
}

// Utility endpoints

// GetAssignedProperties returns properties assigned to the caretaker
func (h *CaretakerHandler) GetAssignedProperties(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	properties, err := h.caretakerService.GetAssignedProperties(caretakerID)
	if err != nil {
		log.Printf("Error getting assigned properties: %v", err)
		http.Error(w, "Failed to get properties", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(properties)
}

// GetRecentActivity returns recent activities for the caretaker dashboard
func (h *CaretakerHandler) GetRecentActivity(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	limit := 10 // default
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	filters := map[string]interface{}{
		"limit": limit,
	}
	activities, err := h.caretakerService.GetRecentActivity(caretakerID, filters)
	if err != nil {
		log.Printf("Error getting recent activity: %v", err)
		http.Error(w, "Failed to get activities", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// QR Code endpoints for advanced features

// ScanUnitQR handles QR code scanning for units
func (h *CaretakerHandler) ScanUnitQR(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	caretakerID, err := h.caretakerService.GetCaretakerIDByUserID(user.ID)
	if err != nil {
		http.Error(w, "Caretaker not found", http.StatusNotFound)
		return
	}

	var request struct {
		QRCode   string           `json:"qr_code"`
		Location *domain.Location `json:"location,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Parse QR code and get unit information
	result, err := h.caretakerService.ProcessUnitQR(request.QRCode, caretakerID)
	if err != nil {
		log.Printf("Error processing QR code: %v", err)
		http.Error(w, "Failed to process QR code", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"result":   result,
		"location": request.Location,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
