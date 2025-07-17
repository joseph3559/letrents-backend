package utils

import (
	"encoding/json"
	"net/http"
)

// APIResponse represents a standard API response structure
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   interface{} `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// Meta represents metadata for paginated responses
type Meta struct {
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	Total       int64 `json:"total"`
	TotalPages  int   `json:"total_pages"`
}

// ErrorDetail represents detailed error information
type ErrorDetail struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Field   string      `json:"field,omitempty"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorResponse represents a standard error response
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SuccessResponse represents a standard success response
type SuccessResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// WriteJSON writes a JSON response to the client
func WriteJSON(w http.ResponseWriter, statusCode int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	return json.NewEncoder(w).Encode(data)
}

// WriteError writes a standardized error response to the client
func WriteError(w http.ResponseWriter, statusCode int, message string, err error) {
	errorMsg := message
	if err != nil {
		errorMsg = err.Error()
	}

	response := ErrorResponse{
		Success: false,
		Error:   errorMsg,
		Message: message,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}

// WriteSuccess writes a standardized success response to the client
func WriteSuccess(w http.ResponseWriter, statusCode int, message string, data interface{}) {
	response := SuccessResponse{
		Success: true,
		Message: message,
		Data:    data,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}

// CreatedResponse sends a created response
func CreatedResponse(w http.ResponseWriter, data interface{}, message string) {
	response := APIResponse{
		Success: true,
		Message: message,
		Data:    data,
	}
	WriteJSON(w, http.StatusCreated, response)
}

// BadRequestResponse sends a bad request error response
func BadRequestResponse(w http.ResponseWriter, message string, err error) {
	WriteError(w, http.StatusBadRequest, message, err)
}

// UnauthorizedResponse sends an unauthorized error response
func UnauthorizedResponse(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, message, nil)
}

// ForbiddenResponse sends a forbidden error response
func ForbiddenResponse(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusForbidden, message, nil)
}

// NotFoundResponse sends a not found error response
func NotFoundResponse(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, message, nil)
}

// ConflictResponse sends a conflict error response
func ConflictResponse(w http.ResponseWriter, message string, err error) {
	WriteError(w, http.StatusConflict, message, err)
}

// InternalServerErrorResponse sends an internal server error response
func InternalServerErrorResponse(w http.ResponseWriter, message string, err error) {
	WriteError(w, http.StatusInternalServerError, message, err)
}

// ValidationErrorResponse sends a validation error response
func ValidationErrorResponse(w http.ResponseWriter, errors []ErrorDetail) {
	response := APIResponse{
		Success: false,
		Message: "Validation failed",
		Error:   errors,
	}
	WriteJSON(w, http.StatusUnprocessableEntity, response)
}

// PaginatedResponse sends a paginated response
func PaginatedResponse(w http.ResponseWriter, data interface{}, meta *Meta, message string) {
	response := APIResponse{
		Success: true,
		Message: message,
		Data:    data,
		Meta:    meta,
	}
	WriteJSON(w, http.StatusOK, response)
}

// CalculatePagination calculates pagination metadata
func CalculatePagination(page, perPage int, total int64) *Meta {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}

	totalPages := int((total + int64(perPage) - 1) / int64(perPage))

	return &Meta{
		CurrentPage: page,
		PerPage:     perPage,
		Total:       total,
		TotalPages:  totalPages,
	}
}

// GetOffset calculates the offset for database queries
func GetOffset(page, perPage int) int {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 10
	}
	return (page - 1) * perPage
}

// SendSuccessResponse sends a standardized success response with data
func SendSuccessResponse(w http.ResponseWriter, data interface{}, message string) {
	response := APIResponse{
		Success: true,
		Message: message,
		Data:    data,
	}
	WriteJSON(w, http.StatusOK, response)
}
