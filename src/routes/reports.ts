import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { reportsController } from '../controllers/reports.controller.js';

const router = Router();

// Apply authentication to all report routes
router.use(requireAuth);

// General reports
router.get('/', rbacResource('reports', 'read'), reportsController.getReports);

// Specific report types
router.get('/property', rbacResource('reports', 'read'), reportsController.getPropertyReport);
router.get('/financial', rbacResource('reports', 'read'), reportsController.getFinancialReport);
router.get('/occupancy', rbacResource('reports', 'read'), reportsController.getOccupancyReport);
router.get('/rent-collection', rbacResource('reports', 'read'), reportsController.getRentCollectionReport);
router.get('/maintenance', rbacResource('reports', 'read'), reportsController.getMaintenanceReport);

// Export functionality
router.get('/export/:type', rbacResource('reports', 'read'), reportsController.exportReport);
// Backward/alternate path used by some clients: /reports/:type/export
router.get('/:type/export', rbacResource('reports', 'read'), reportsController.exportReport);

export default router;
