import { Router } from 'express';
import { createMaintenanceRequest, getMaintenanceRequest, listMaintenanceRequests, updateMaintenanceRequest, deleteMaintenanceRequest, getMaintenanceOverview } from '../controllers/maintenance.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Maintenance requests CRUD
router.post('/requests', rbacResource('maintenance', 'create'), createMaintenanceRequest);
router.get('/requests', rbacResource('maintenance', 'read'), listMaintenanceRequests);
router.get('/requests/:id', rbacResource('maintenance', 'read'), getMaintenanceRequest);
router.put('/requests/:id', rbacResource('maintenance', 'update'), updateMaintenanceRequest);
router.delete('/requests/:id', rbacResource('maintenance', 'delete'), deleteMaintenanceRequest);
// Maintenance overview
router.get('/overview', rbacResource('maintenance', 'overview'), getMaintenanceOverview);
export default router;
