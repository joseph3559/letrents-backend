import { Router } from 'express';
import { createUnit, createUnits, getUnit, updateUnit, deleteUnit, listUnits, updateUnitStatus, assignTenant, releaseTenant, searchAvailableUnits } from '../controllers/units.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Units CRUD
router.post('/', rbacResource('units', 'create'), createUnit);
router.post('/batch', rbacResource('units', 'create'), createUnits);
router.get('/', rbacResource('units', 'read'), listUnits);
router.get('/available', searchAvailableUnits); // Public endpoint for searching available units
router.get('/:id', rbacResource('units', 'read'), getUnit);
router.put('/:id', rbacResource('units', 'update'), updateUnit);
router.delete('/:id', rbacResource('units', 'delete'), deleteUnit);
// Unit status management
router.patch('/:id/status', rbacResource('units', 'status'), updateUnitStatus);
// Tenant management
router.post('/:id/assign-tenant', rbacResource('units', 'assign'), assignTenant);
router.post('/:id/release-tenant', rbacResource('units', 'release'), releaseTenant);
export default router;
