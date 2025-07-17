package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"letrents-backend/internal/core/port"
	"letrents-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// LandlordHandler handles landlord dashboard API requests
type LandlordHandler struct {
	landlordService port.LandlordService
}

// NewLandlordHandler creates a new landlord handler
func NewLandlordHandler(landlordService port.LandlordService) *LandlordHandler {
	return &LandlordHandler{
		landlordService: landlordService,
	}
}

// GetDashboardOverview returns the complete dashboard overview for a landlord
func (h *LandlordHandler) GetDashboardOverview(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	overview, err := h.landlordService.GetDashboardOverview(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get dashboard overview", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Dashboard overview retrieved successfully", overview)
}

// GetDashboardStats returns dashboard statistics for a landlord
func (h *LandlordHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	stats, err := h.landlordService.GetDashboardStats(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get dashboard stats", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Dashboard stats retrieved successfully", stats)
}

// GetRevenueAnalytics returns revenue analytics for a landlord
func (h *LandlordHandler) GetRevenueAnalytics(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "monthly"
	}

	analytics, err := h.landlordService.GetRevenueAnalytics(r.Context(), landlordID, period)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get revenue analytics", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Revenue analytics retrieved successfully", analytics)
}

// GetOccupancyAnalytics returns occupancy analytics for a landlord
func (h *LandlordHandler) GetOccupancyAnalytics(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	analytics, err := h.landlordService.GetOccupancyAnalytics(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get occupancy analytics", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Occupancy analytics retrieved successfully", analytics)
}

// GetLandlordProperties returns properties owned by a landlord
func (h *LandlordHandler) GetLandlordProperties(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parsePropertyFilters(r)
	properties, err := h.landlordService.GetLandlordProperties(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get properties", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Properties retrieved successfully", properties)
}

// GetPropertySummary returns detailed summary for a specific property
func (h *LandlordHandler) GetPropertySummary(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	vars := mux.Vars(r)
	propertyID, err := uuid.Parse(vars["property_id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid property ID", err)
		return
	}

	summary, err := h.landlordService.GetPropertySummary(r.Context(), propertyID, landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get property summary", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Property summary retrieved successfully", summary)
}

// GetLandlordTenants returns tenants associated with a landlord's properties
func (h *LandlordHandler) GetLandlordTenants(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parseTenantFilters(r)
	tenants, err := h.landlordService.GetLandlordTenants(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get tenants", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Tenants retrieved successfully", tenants)
}

// GetTenantSummary returns detailed summary for a specific tenant
func (h *LandlordHandler) GetTenantSummary(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	vars := mux.Vars(r)
	tenantID, err := uuid.Parse(vars["tenant_id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid tenant ID", err)
		return
	}

	summary, err := h.landlordService.GetTenantSummary(r.Context(), tenantID, landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get tenant summary", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Tenant summary retrieved successfully", summary)
}

// GetFinancialOverview returns financial overview for a landlord
func (h *LandlordHandler) GetFinancialOverview(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	overview, err := h.landlordService.GetFinancialOverview(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get financial overview", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Financial overview retrieved successfully", overview)
}

// GetPaymentHistory returns payment history for a landlord
func (h *LandlordHandler) GetPaymentHistory(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parsePaymentFilters(r)
	payments, err := h.landlordService.GetPaymentHistory(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get payment history", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Payment history retrieved successfully", payments)
}

// GetRentCollectionStats returns rent collection statistics for a landlord
func (h *LandlordHandler) GetRentCollectionStats(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "monthly"
	}

	stats, err := h.landlordService.GetRentCollectionStats(r.Context(), landlordID, period)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get rent collection stats", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Rent collection stats retrieved successfully", stats)
}

// ================= INVOICE MANAGEMENT HANDLERS =================

// GetInvoices returns all invoices for a landlord with filtering and pagination
func (h *LandlordHandler) GetInvoices(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	// Parse query parameters (for future filtering implementation)
	_ = r.URL.Query()

	// For now, return mock data since we don't have the service implementation yet
	// TODO: Use landlordID for actual service call when implemented
	_ = landlordID
	mockInvoices := []map[string]interface{}{
		{
			"id":             "inv-001",
			"invoice_number": "INV-001",
			"tenant_id":      "tenant-1",
			"tenant_name":    "John Doe",
			"property_id":    "prop-1",
			"property_name":  "Westlands Apartments",
			"unit_id":        "unit-1",
			"unit_number":    "4B",
			"amount":         50000,
			"due_date":       "2024-01-31",
			"issue_date":     "2024-01-01",
			"payment_date":   "2024-01-15",
			"status":         "paid",
			"description":    "Monthly Rent - January 2024",
			"created_at":     time.Now().Add(-30 * 24 * time.Hour),
			"updated_at":     time.Now().Add(-15 * 24 * time.Hour),
		},
		{
			"id":             "inv-002",
			"invoice_number": "INV-002",
			"tenant_id":      "tenant-2",
			"tenant_name":    "Sarah Kim",
			"property_id":    "prop-2",
			"property_name":  "Kileleshwa Complex",
			"unit_id":        "unit-2",
			"unit_number":    "12A",
			"amount":         60000,
			"due_date":       "2024-01-31",
			"issue_date":     "2024-01-01",
			"status":         "overdue",
			"description":    "Monthly Rent - January 2024",
			"created_at":     time.Now().Add(-30 * 24 * time.Hour),
			"updated_at":     time.Now().Add(-30 * 24 * time.Hour),
		},
	}

	mockStats := map[string]interface{}{
		"total_invoices":  156,
		"total_amount":    2580000,
		"paid_amount":     2400000,
		"overdue_amount":  180000,
		"pending_amount":  0,
		"collection_rate": 93.02,
		"overdue_count":   2,
		"paid_count":      154,
		"pending_count":   0,
	}

	response := map[string]interface{}{
		"invoices":    mockInvoices,
		"total":       len(mockInvoices),
		"page":        1,
		"per_page":    10,
		"total_pages": 1,
		"stats":       mockStats,
	}

	utils.WriteSuccess(w, http.StatusOK, "Invoices retrieved successfully", response)
}

// CreateInvoice creates a new invoice
func (h *LandlordHandler) CreateInvoice(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	var invoiceData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&invoiceData); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Mock invoice creation - replace with actual service call
	newInvoice := map[string]interface{}{
		"id":             fmt.Sprintf("inv-%d", time.Now().Unix()),
		"invoice_number": fmt.Sprintf("INV-%03d", time.Now().Unix()%1000),
		"tenant_id":      invoiceData["tenant_id"],
		"tenant_name":    "Mock Tenant",
		"property_id":    invoiceData["property_id"],
		"property_name":  "Mock Property",
		"unit_id":        invoiceData["unit_id"],
		"unit_number":    "A1",
		"amount":         invoiceData["amount"],
		"due_date":       invoiceData["due_date"],
		"issue_date":     time.Now().Format("2006-01-02"),
		"status":         "draft",
		"description":    invoiceData["description"],
		"notes":          invoiceData["notes"],
		"created_at":     time.Now(),
		"updated_at":     time.Now(),
	}

	utils.WriteSuccess(w, http.StatusCreated, "Invoice created successfully", newInvoice)
}

// CreateBulkInvoices creates multiple invoices in bulk
func (h *LandlordHandler) CreateBulkInvoices(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	var bulkData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&bulkData); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Mock bulk creation - replace with actual service call
	createdInvoices := []map[string]interface{}{
		{
			"id":             fmt.Sprintf("inv-bulk-%d", time.Now().Unix()),
			"invoice_number": fmt.Sprintf("INV-BULK-%03d", time.Now().Unix()%1000),
			"status":         "draft",
			"created_at":     time.Now(),
		},
	}

	utils.WriteSuccess(w, http.StatusCreated, "Bulk invoices created successfully", createdInvoices)
}

// GetInvoiceStats returns invoice statistics
func (h *LandlordHandler) GetInvoiceStats(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	// Mock stats - replace with actual service call
	stats := map[string]interface{}{
		"total_invoices":  156,
		"total_amount":    2580000,
		"paid_amount":     2400000,
		"overdue_amount":  180000,
		"pending_amount":  0,
		"collection_rate": 93.02,
		"overdue_count":   2,
		"paid_count":      154,
		"pending_count":   0,
	}

	utils.WriteSuccess(w, http.StatusOK, "Invoice stats retrieved successfully", stats)
}

// GetInvoice returns a specific invoice by ID
func (h *LandlordHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	// Mock invoice data - replace with actual service call
	invoice := map[string]interface{}{
		"id":             invoiceID,
		"invoice_number": "INV-001",
		"tenant_name":    "John Doe",
		"property_name":  "Westlands Apartments",
		"unit_number":    "4B",
		"amount":         50000,
		"status":         "paid",
		"created_at":     time.Now(),
	}

	utils.WriteSuccess(w, http.StatusOK, "Invoice retrieved successfully", invoice)
}

// UpdateInvoice updates an existing invoice
func (h *LandlordHandler) UpdateInvoice(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Mock update - replace with actual service call
	updatedInvoice := map[string]interface{}{
		"id":         invoiceID,
		"updated_at": time.Now(),
		"status":     "updated",
	}

	utils.WriteSuccess(w, http.StatusOK, "Invoice updated successfully", updatedInvoice)
}

// DeleteInvoice deletes an invoice
func (h *LandlordHandler) DeleteInvoice(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	// Mock deletion - replace with actual service call
	utils.WriteSuccess(w, http.StatusOK, "Invoice deleted successfully", map[string]interface{}{
		"invoice_id": invoiceID,
		"deleted_at": time.Now(),
	})
}

// SendInvoice sends an invoice to tenant
func (h *LandlordHandler) SendInvoice(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	// Mock sending - replace with actual service call
	utils.WriteSuccess(w, http.StatusOK, "Invoice sent successfully", map[string]interface{}{
		"invoice_id": invoiceID,
		"sent_at":    time.Now(),
		"status":     "sent",
	})
}

// MarkInvoiceAsPaid marks an invoice as paid
func (h *LandlordHandler) MarkInvoiceAsPaid(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	var paymentData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&paymentData); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Mock marking as paid - replace with actual service call
	updatedInvoice := map[string]interface{}{
		"id":           invoiceID,
		"status":       "paid",
		"payment_date": paymentData["payment_date"],
		"updated_at":   time.Now(),
	}

	utils.WriteSuccess(w, http.StatusOK, "Invoice marked as paid successfully", updatedInvoice)
}

// GenerateInvoicePDF generates and returns invoice PDF
func (h *LandlordHandler) GenerateInvoicePDF(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	// Mock PDF generation - replace with actual PDF generation
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=invoice-%s.pdf", invoiceID))

	// For now, return a simple message instead of actual PDF
	mockPDF := fmt.Sprintf("Mock PDF content for invoice %s", invoiceID)
	w.Write([]byte(mockPDF))
}

// SendInvoiceReminder sends a reminder for an overdue invoice
func (h *LandlordHandler) SendInvoiceReminder(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	// Mock reminder sending - replace with actual service call
	utils.WriteSuccess(w, http.StatusOK, "Invoice reminder sent successfully", map[string]interface{}{
		"invoice_id":  invoiceID,
		"reminder_at": time.Now(),
	})
}

// ExportInvoices exports invoices to CSV/Excel
func (h *LandlordHandler) ExportInvoices(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}
	_ = landlordID // TODO: Use for actual service call

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	// Mock export - replace with actual export functionality
	if format == "excel" {
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", "attachment; filename=invoices.xlsx")
	} else {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=invoices.csv")
	}

	mockData := "Invoice Number,Tenant,Property,Amount,Status\nINV-001,John Doe,Westlands Apartments,50000,Paid"
	w.Write([]byte(mockData))
}

// GetMaintenanceOverview returns maintenance overview for a landlord
func (h *LandlordHandler) GetMaintenanceOverview(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	overview, err := h.landlordService.GetMaintenanceOverview(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get maintenance overview", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Maintenance overview retrieved successfully", overview)
}

// GetMaintenanceRequests returns maintenance requests for a landlord
func (h *LandlordHandler) GetMaintenanceRequests(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parseMaintenanceFilters(r)
	requests, err := h.landlordService.GetMaintenanceRequests(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get maintenance requests", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Maintenance requests retrieved successfully", requests)
}

// GetInspectionOverview returns inspection overview for a landlord
func (h *LandlordHandler) GetInspectionOverview(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	overview, err := h.landlordService.GetInspectionOverview(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get inspection overview", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Inspection overview retrieved successfully", overview)
}

// GetInspectionSchedule returns inspection schedule for a landlord
func (h *LandlordHandler) GetInspectionSchedule(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parseInspectionFilters(r)
	schedule, err := h.landlordService.GetInspectionSchedule(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get inspection schedule", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Inspection schedule retrieved successfully", schedule)
}

// GetCommunicationOverview returns communication overview for a landlord
func (h *LandlordHandler) GetCommunicationOverview(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	overview, err := h.landlordService.GetCommunicationOverview(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get communication overview", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Communication overview retrieved successfully", overview)
}

// GetMessages returns messages for a landlord
func (h *LandlordHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	filters := h.parseMessageFilters(r)
	messages, err := h.landlordService.GetMessages(r.Context(), landlordID, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get messages", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Messages retrieved successfully", messages)
}

// GeneratePropertyReport generates a property report for a landlord
func (h *LandlordHandler) GeneratePropertyReport(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		reportType = "summary"
	}

	filters := h.parseReportFilters(r)
	report, err := h.landlordService.GeneratePropertyReport(r.Context(), landlordID, reportType, filters)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to generate property report", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Property report generated successfully", report)
}

// GenerateFinancialReport generates a financial report for a landlord
func (h *LandlordHandler) GenerateFinancialReport(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		reportType = "summary"
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "monthly"
	}

	report, err := h.landlordService.GenerateFinancialReport(r.Context(), landlordID, reportType, period)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to generate financial report", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Financial report generated successfully", report)
}

// GenerateOccupancyReport generates an occupancy report for a landlord
func (h *LandlordHandler) GenerateOccupancyReport(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "monthly"
	}

	report, err := h.landlordService.GenerateOccupancyReport(r.Context(), landlordID, period)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to generate occupancy report", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Occupancy report generated successfully", report)
}

// GetNotifications returns notifications for a landlord
func (h *LandlordHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 10
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	notifications, err := h.landlordService.GetNotifications(r.Context(), landlordID, limit, offset)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get notifications", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Notifications retrieved successfully", notifications)
}

// MarkNotificationAsRead marks a notification as read
func (h *LandlordHandler) MarkNotificationAsRead(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	vars := mux.Vars(r)
	notificationID, err := uuid.Parse(vars["notification_id"])
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid notification ID", err)
		return
	}

	err = h.landlordService.MarkNotificationAsRead(r.Context(), notificationID, landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to mark notification as read", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Notification marked as read successfully", nil)
}

// GetUnreadNotificationCount returns the count of unread notifications
func (h *LandlordHandler) GetUnreadNotificationCount(w http.ResponseWriter, r *http.Request) {
	landlordID, err := h.extractLandlordID(r)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid landlord ID", err)
		return
	}

	count, err := h.landlordService.GetUnreadNotificationCount(r.Context(), landlordID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get unread notification count", err)
		return
	}

	utils.WriteSuccess(w, http.StatusOK, "Unread notification count retrieved successfully", map[string]int{"count": count})
}

// Helper methods

func (h *LandlordHandler) extractLandlordID(r *http.Request) (uuid.UUID, error) {
	// In a real implementation, this would extract the landlord ID from the JWT token
	// For now, we'll use a demo landlord ID
	return uuid.Parse("demo-landlord-id")
}

func (h *LandlordHandler) parsePropertyFilters(r *http.Request) port.LandlordPropertyFilters {
	// Parse query parameters and build LandlordPropertyFilters
	// This is a simplified implementation
	return port.LandlordPropertyFilters{
		Limit:  10,
		Offset: 0,
	}
}

func (h *LandlordHandler) parseTenantFilters(r *http.Request) port.LandlordTenantFilters {
	query := r.URL.Query()
	filters := port.LandlordTenantFilters{
		Limit:  20, // default
		Offset: 0,  // default
	}

	// Parse pagination
	if limit := query.Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 && l <= 100 {
			filters.Limit = l
		}
	}

	if offset := query.Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			filters.Offset = o
		}
	}

	// Parse page (alternative to offset)
	if page := query.Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil && p > 0 {
			filters.Offset = (p - 1) * filters.Limit
		}
	}

	// Parse filters
	if propertyID := query.Get("property_id"); propertyID != "" {
		if id, err := uuid.Parse(propertyID); err == nil {
			filters.PropertyID = &id
		}
	}

	if unitID := query.Get("unit_id"); unitID != "" {
		if id, err := uuid.Parse(unitID); err == nil {
			filters.UnitID = &id
		}
	}

	if status := query.Get("status"); status != "" {
		filters.Status = &status
	}

	if searchQuery := query.Get("search_query"); searchQuery != "" {
		filters.SearchQuery = &searchQuery
	}

	if searchQuery := query.Get("search"); searchQuery != "" {
		filters.SearchQuery = &searchQuery
	}

	if leaseStatus := query.Get("lease_status"); leaseStatus != "" {
		filters.LeaseStatus = &leaseStatus
	}

	if paymentStatus := query.Get("payment_status"); paymentStatus != "" {
		filters.PaymentStatus = &paymentStatus
	}

	if sortBy := query.Get("sort_by"); sortBy != "" {
		filters.SortBy = &sortBy
	}

	if sortOrder := query.Get("sort_order"); sortOrder != "" {
		filters.SortOrder = &sortOrder
	}

	return filters
}

func (h *LandlordHandler) parsePaymentFilters(r *http.Request) port.PaymentFilters {
	// Parse query parameters and build PaymentFilters
	// This is a simplified implementation
	return port.PaymentFilters{
		Limit:  10,
		Offset: 0,
	}
}

func (h *LandlordHandler) parseMaintenanceFilters(r *http.Request) port.LandlordMaintenanceFilters {
	// Parse query parameters and build LandlordMaintenanceFilters
	// This is a simplified implementation
	return port.LandlordMaintenanceFilters{
		Limit:  10,
		Offset: 0,
	}
}

func (h *LandlordHandler) parseInspectionFilters(r *http.Request) port.InspectionFilters {
	// Parse query parameters and build InspectionFilters
	// This is a simplified implementation
	return port.InspectionFilters{
		Limit:  10,
		Offset: 0,
	}
}

func (h *LandlordHandler) parseMessageFilters(r *http.Request) port.MessageFilters {
	// Parse query parameters and build MessageFilters
	// This is a simplified implementation
	return port.MessageFilters{
		Limit:  10,
		Offset: 0,
	}
}

func (h *LandlordHandler) parseReportFilters(r *http.Request) port.ReportFilters {
	// Parse query parameters and build ReportFilters
	// This is a simplified implementation
	return port.ReportFilters{
		IncludeCharts: true,
		Format:        "pdf",
	}
}
