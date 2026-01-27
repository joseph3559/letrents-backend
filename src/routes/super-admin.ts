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
  bulkUpdateSystemSettings,
  initializeSystemSettings,
  getSecurityLogs,
  getUserManagement,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCompanyManagement,
  createCompany,
  updateCompany,
  deleteCompany,
  getAgencyManagement,
  getAgencyById,
  getAgencyProperties,
  getAgencyUnits,
  createAgency,
  updateAgency,
  deleteAgency,
  activateEntity,
  deactivateEntity,
  suspendEntity,
  sendInvitation,
  getEntitySubscription,
  updateEntitySubscription,
  getEntitySubscriptionHistory,
  getEntitySubscriptionInvoices,
  getAgencyBilling,
  getLandlordBilling,
  getAgencyPerformance,
  getBillingPlans,
  getBillingSubscriptions,
  getBillingInvoices,
  getPlatformAnalytics,
  getRevenueDashboard,
  checkCompanyIntegrity,
  getPaymentGateways,
  getPaymentGateway,
  createPaymentGateway,
  updatePaymentGateway,
  togglePaymentGatewayStatus,
  getUserMetrics
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

// Logging middleware for debugging
router.use((req, res, next) => {
	console.log(`🔍 Super-admin router: ${req.method} ${req.path}`);
	next();
});

// All super-admin routes require authentication
router.use(requireAuth);

// Company update endpoint - allow landlords/agency_admins to update their own company
// This route is handled before requireSuperAdmin to allow self-updates
router.put('/companies/:id', updateCompany);

// All other super-admin routes require super_admin role
router.use(requireSuperAdmin);

// Dashboard and Analytics
router.get('/dashboard', getDashboardData);
router.get('/kpis', getKPIMetrics);
router.get('/analytics/:chartType', getAnalyticsChart);
router.get('/platform-analytics', getPlatformAnalytics);
router.get('/revenue-dashboard', getRevenueDashboard);

// System Management
router.get('/system/health', getSystemHealth);
router.get('/system/company-integrity', checkCompanyIntegrity);
router.get('/system/settings', getSystemSettings);
router.post('/system/settings/initialize', initializeSystemSettings);
router.put('/system/settings/:key', updateSystemSettings);
router.post('/system/settings/bulk', bulkUpdateSystemSettings);

// Audit and Security
router.get('/audit-logs', getAuditLogs);
router.get('/security-logs', getSecurityLogs);

// User Management
router.get('/users', getUserManagement);
router.get('/users/metrics', getUserMetrics);
router.get('/users/search', getUserManagement); // Reuse getUserManagement for search
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Company Management
router.get('/companies', getCompanyManagement);
router.post('/companies', createCompany);
// Note: PUT /companies/:id is defined above (before requireSuperAdmin) to allow self-updates
router.delete('/companies/:id', deleteCompany);

// Agency Management
router.get('/agencies', getAgencyManagement);
router.get('/agencies/performance', getAgencyPerformance);
router.get('/agencies/:id', getAgencyById);
router.get('/agencies/:id/properties', getAgencyProperties);
router.get('/agencies/:id/units', getAgencyUnits);
router.post('/agencies', createAgency);
router.put('/agencies/:id', updateAgency);
router.delete('/agencies/:id', deleteAgency);

// Entity Status Management (works for users, companies, and agencies)
router.post('/entities/:entityType/:entityId/activate', activateEntity);
router.post('/entities/:entityType/:entityId/deactivate', deactivateEntity);
router.post('/entities/:entityType/:entityId/suspend', suspendEntity);

// Invitation Management
router.post('/entities/:entityType/:entityId/invite', sendInvitation);
// Direct user invitation route (convenience)
router.post('/users/:id/invite', (req, res) => {
  (req.params as any).entityType = 'user';
  (req.params as any).entityId = req.params.id;
  sendInvitation(req, res);
});

// Subscription Management
router.get('/entities/:entityType/:entityId/subscription', getEntitySubscription);
router.put('/entities/:entityType/:entityId/subscription', updateEntitySubscription);
router.get('/entities/:entityType/:entityId/subscription/history', getEntitySubscriptionHistory);
router.get('/entities/:entityType/:entityId/subscription/invoices', getEntitySubscriptionInvoices);

// Billing Management
router.get('/billing/agencies', getAgencyBilling);
router.get('/billing/landlords', getLandlordBilling);
router.get('/billing/plans', getBillingPlans);
router.get('/billing/subscriptions', getBillingSubscriptions);
router.get('/billing/invoices', getBillingInvoices);

// Payment Gateway Management
router.get('/billing/gateways', getPaymentGateways);
router.get('/billing/gateways/:id', getPaymentGateway);
router.post('/billing/gateways', createPaymentGateway);
router.put('/billing/gateways/:id', updatePaymentGateway);
router.patch('/billing/gateways/:id/toggle', togglePaymentGatewayStatus);

export default router;
