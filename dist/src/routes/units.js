import { Router } from 'express';
import { createUnit, createUnits, getUnit, getUnitFinancials, updateUnit, deleteUnit, listUnits, updateUnitStatus, assignTenant, releaseTenant, searchAvailableUnits, cleanupDuplicateTenantAssignments } from '../controllers/units.controller.js';
import { uploadUnitImages, deleteUnitImage, uploadMiddleware } from '../controllers/images.controller.js';
import { getUnitDocuments, uploadUnitDocuments, documentUploadMiddleware } from '../controllers/documents.controller.js';
import { getUnitActivity } from '../controllers/unit-activity.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Units CRUD
router.post('/', rbacResource('units', 'create'), createUnit);
router.post('/batch', rbacResource('units', 'create'), createUnits);
router.get('/', rbacResource('units', 'read'), listUnits);
router.get('/available', searchAvailableUnits); // Public endpoint for searching available units
router.get('/:id/financials', rbacResource('units', 'read'), getUnitFinancials); // Must come before /:id route
// Unit images management (must come before /:id route)
router.post('/:id/images', rbacResource('units', 'photos'), uploadMiddleware, uploadUnitImages);
router.delete('/:id/images/:imageId', rbacResource('units', 'photos'), deleteUnitImage);
router.get('/:id/documents', rbacResource('units', 'read'), getUnitDocuments);
router.post('/:id/documents', rbacResource('units', 'update'), documentUploadMiddleware, uploadUnitDocuments);
router.get('/:id/history', rbacResource('units', 'read'), getUnitActivity);
router.get('/:id', rbacResource('units', 'read'), getUnit);
router.put('/:id', rbacResource('units', 'update'), updateUnit);
router.delete('/:id', rbacResource('units', 'delete'), deleteUnit);
// Unit status management
router.patch('/:id/status', rbacResource('units', 'status'), updateUnitStatus);
// Tenant management
router.post('/:id/assign-tenant', rbacResource('units', 'assign'), assignTenant);
router.post('/:id/release-tenant', rbacResource('units', 'release'), releaseTenant);
// Maintenance and cleanup
router.post('/cleanup/duplicate-tenants', rbacResource('units', 'update'), cleanupDuplicateTenantAssignments);
export default router;
