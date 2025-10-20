// ============================================================================
// Checklist & Inspection Routes
// ============================================================================
import { Router } from 'express';
import { ChecklistsController } from '../controllers/checklists.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
const checklistsController = new ChecklistsController();
// All routes require authentication
router.use(requireAuth);
// ============================================================================
// TEMPLATE ROUTES
// ============================================================================
// Create a new checklist template
router.post('/templates', rbacResource('checklists', 'create'), checklistsController.createTemplate);
// Get all templates
router.get('/templates', rbacResource('checklists', 'read'), checklistsController.getTemplates);
// Get a single template by ID
router.get('/templates/:id', rbacResource('checklists', 'read'), checklistsController.getTemplate);
// Update a template
router.put('/templates/:id', rbacResource('checklists', 'update'), checklistsController.updateTemplate);
// Delete a template
router.delete('/templates/:id', rbacResource('checklists', 'delete'), checklistsController.deleteTemplate);
// ============================================================================
// INSPECTION ROUTES
// ============================================================================
// Create a new inspection
router.post('/inspections', rbacResource('checklists', 'create'), checklistsController.createInspection);
// Get all inspections
router.get('/inspections', rbacResource('checklists', 'read'), checklistsController.getInspections);
// Get a single inspection by ID
router.get('/inspections/:id', rbacResource('checklists', 'read'), checklistsController.getInspection);
// Update an inspection
router.put('/inspections/:id', rbacResource('checklists', 'update'), checklistsController.updateInspection);
// Delete an inspection
router.delete('/inspections/:id', rbacResource('checklists', 'delete'), checklistsController.deleteInspection);
// Record response for a specific inspection item
router.put('/inspections/:inspectionId/items/:itemId', rbacResource('checklists', 'update'), checklistsController.recordInspectionItem);
// Upload a photo for an inspection
router.post('/inspections/:id/photos', rbacResource('checklists', 'update'), checklistsController.uploadInspectionPhoto);
export default router;
