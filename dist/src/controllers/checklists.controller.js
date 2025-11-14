// ============================================================================
// Checklist & Inspection Controller
// ============================================================================
import { ChecklistsService } from '../services/checklists.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const checklistsService = new ChecklistsService();
export class ChecklistsController {
    // ============================================================================
    // TEMPLATE ENDPOINTS
    // ============================================================================
    /**
     * POST /api/v1/checklists/templates
     * Create a new checklist template
     */
    createTemplate = async (req, res) => {
        try {
            const user = req.user;
            const template = await checklistsService.createTemplate(req.body, user);
            writeSuccess(res, 201, 'Template created successfully', template);
        }
        catch (error) {
            console.error('❌ Error creating template:', error);
            const statusCode = error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to create template');
        }
    };
    /**
     * GET /api/v1/checklists/templates
     * Get all templates for the company
     */
    getTemplates = async (req, res) => {
        try {
            const user = req.user;
            const filters = {
                inspection_type: req.query.inspection_type,
                property_id: req.query.property_id,
                is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
                agencyId: req.query.agencyId, // For super-admin viewing as specific agency
            };
            const templates = await checklistsService.getTemplates(user, filters);
            writeSuccess(res, 200, 'Templates retrieved successfully', templates);
        }
        catch (error) {
            console.error('❌ Error getting templates:', error);
            writeError(res, 500, error.message || 'Failed to retrieve templates');
        }
    };
    /**
     * GET /api/v1/checklists/templates/:id
     * Get a single template by ID
     */
    getTemplate = async (req, res) => {
        try {
            const user = req.user;
            const template = await checklistsService.getTemplate(req.params.id, user);
            writeSuccess(res, 200, 'Template retrieved successfully', template);
        }
        catch (error) {
            console.error('❌ Error getting template:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            writeError(res, statusCode, error.message || 'Failed to retrieve template');
        }
    };
    /**
     * PUT /api/v1/checklists/templates/:id
     * Update a template
     */
    updateTemplate = async (req, res) => {
        try {
            const user = req.user;
            const template = await checklistsService.updateTemplate(req.params.id, req.body, user);
            writeSuccess(res, 200, 'Template updated successfully', template);
        }
        catch (error) {
            console.error('❌ Error updating template:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to update template');
        }
    };
    /**
     * DELETE /api/v1/checklists/templates/:id
     * Delete a template
     */
    deleteTemplate = async (req, res) => {
        try {
            const user = req.user;
            await checklistsService.deleteTemplate(req.params.id, user);
            writeSuccess(res, 200, 'Template deleted successfully', null);
        }
        catch (error) {
            console.error('❌ Error deleting template:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to delete template');
        }
    };
    // ============================================================================
    // INSPECTION ENDPOINTS
    // ============================================================================
    /**
     * POST /api/v1/checklists/inspections
     * Create a new inspection
     */
    createInspection = async (req, res) => {
        try {
            const user = req.user;
            const inspection = await checklistsService.createInspection(req.body, user);
            writeSuccess(res, 201, 'Inspection created successfully', inspection);
        }
        catch (error) {
            console.error('❌ Error creating inspection:', error);
            const statusCode = error.message.includes('permissions') ? 403 : error.message.includes('not found') ? 404 : 400;
            writeError(res, statusCode, error.message || 'Failed to create inspection');
        }
    };
    /**
     * GET /api/v1/checklists/inspections
     * Get all inspections (with optional filters)
     */
    getInspections = async (req, res) => {
        try {
            const user = req.user;
            const filters = {
                property_id: req.query.property_id,
                unit_id: req.query.unit_id,
                tenant_id: req.query.tenant_id,
                inspection_type: req.query.inspection_type,
                status: req.query.status,
                agencyId: req.query.agencyId, // For super-admin viewing as specific agency
            };
            const inspections = await checklistsService.getInspections(user, filters);
            writeSuccess(res, 200, 'Inspections retrieved successfully', inspections);
        }
        catch (error) {
            console.error('❌ Error getting inspections:', error);
            writeError(res, 500, error.message || 'Failed to retrieve inspections');
        }
    };
    /**
     * GET /api/v1/checklists/inspections/:id
     * Get a single inspection by ID
     */
    getInspection = async (req, res) => {
        try {
            const user = req.user;
            const inspection = await checklistsService.getInspection(req.params.id, user);
            writeSuccess(res, 200, 'Inspection retrieved successfully', inspection);
        }
        catch (error) {
            console.error('❌ Error getting inspection:', error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            writeError(res, statusCode, error.message || 'Failed to retrieve inspection');
        }
    };
    /**
     * PUT /api/v1/checklists/inspections/:id
     * Update an inspection
     */
    updateInspection = async (req, res) => {
        try {
            const user = req.user;
            const inspection = await checklistsService.updateInspection(req.params.id, req.body, user);
            writeSuccess(res, 200, 'Inspection updated successfully', inspection);
        }
        catch (error) {
            console.error('❌ Error updating inspection:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to update inspection');
        }
    };
    /**
     * DELETE /api/v1/checklists/inspections/:id
     * Delete an inspection
     */
    deleteInspection = async (req, res) => {
        try {
            const user = req.user;
            await checklistsService.deleteInspection(req.params.id, user);
            writeSuccess(res, 200, 'Inspection deleted successfully', null);
        }
        catch (error) {
            console.error('❌ Error deleting inspection:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to delete inspection');
        }
    };
    /**
     * PUT /api/v1/checklists/inspections/:inspectionId/items/:itemId
     * Record response for a specific inspection item
     */
    recordInspectionItem = async (req, res) => {
        try {
            const user = req.user;
            const { inspectionId, itemId } = req.params;
            const item = await checklistsService.recordInspectionItem(inspectionId, itemId, req.body, user);
            writeSuccess(res, 200, 'Inspection item recorded successfully', item);
        }
        catch (error) {
            console.error('❌ Error recording inspection item:', error);
            const statusCode = error.message.includes('not found') ? 404 : 400;
            writeError(res, statusCode, error.message || 'Failed to record inspection item');
        }
    };
    /**
     * POST /api/v1/checklists/inspections/:id/photos
     * Upload a photo for an inspection
     */
    uploadInspectionPhoto = async (req, res) => {
        try {
            const user = req.user;
            const photo = await checklistsService.uploadInspectionPhoto(req.params.id, req.body, user);
            writeSuccess(res, 201, 'Photo uploaded successfully', photo);
        }
        catch (error) {
            console.error('❌ Error uploading photo:', error);
            const statusCode = error.message.includes('not found') ? 404 : 400;
            writeError(res, statusCode, error.message || 'Failed to upload photo');
        }
    };
}
