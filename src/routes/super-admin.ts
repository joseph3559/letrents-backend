import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getDashboardData,
  getKPIMetrics,
  getSystemHealth,
  getAuditLogs,
  getAnalyticsChart,
  getSystemSettings,
  updateSystemSettings,
  getSecurityLogs,
  getUserManagement,
  createUser,
  updateUser,
  deleteUser,
  getCompanyManagement,
  createCompany,
  updateCompany,
  deleteCompany,
  getAgencyManagement,
  createAgency,
  updateAgency,
  deleteAgency
} from '../controllers/super-admin.controller.js';

const router = Router();

// Super Admin middleware - only allow super_admin role
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
	if (user.role !== 'super_admin') {
		return res.status(403).json({ success: false, message: 'Super admin access required' });
	}
	return next();
};

// All super-admin routes require authentication and super_admin role
router.use(requireAuth);
router.use(requireSuperAdmin);

// Dashboard and Analytics
router.get('/dashboard', getDashboardData);
router.get('/kpis', getKPIMetrics);
router.get('/analytics/:chartType', getAnalyticsChart);

// System Management
router.get('/system/health', getSystemHealth);
router.get('/system/settings', getSystemSettings);
router.put('/system/settings/:id', updateSystemSettings);

// Audit and Security
router.get('/audit-logs', getAuditLogs);
router.get('/security-logs', getSecurityLogs);

// User Management
router.get('/users', getUserManagement);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Company Management
router.get('/companies', getCompanyManagement);
router.post('/companies', createCompany);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);

// Agency Management
router.get('/agencies', getAgencyManagement);
router.post('/agencies', createAgency);
router.put('/agencies/:id', updateAgency);
router.delete('/agencies/:id', deleteAgency);

export default router;
