import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardData, getKPIMetrics, getSystemHealth, getAuditLogs, getAnalyticsChart, getSystemSettings, updateSystemSettings, getSecurityLogs, getUserManagement, getUserById, createUser, updateUser, deleteUser, getCompanyManagement, createCompany, updateCompany, deleteCompany, getAgencyManagement, getAgencyById, getAgencyProperties, getAgencyUnits, createAgency, updateAgency, deleteAgency, activateEntity, deactivateEntity, suspendEntity, sendInvitation, getEntitySubscription, updateEntitySubscription, getAgencyBilling } from '../controllers/super-admin.controller.js';
const router = Router();
// Super Admin middleware - only allow super_admin role
const requireSuperAdmin = (req, res, next) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
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
router.get('/users/:id', getUserById);
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
// Subscription Management
router.get('/entities/:entityType/:entityId/subscription', getEntitySubscription);
router.put('/entities/:entityType/:entityId/subscription', updateEntitySubscription);
// Billing Management
router.get('/billing/agencies', getAgencyBilling);
export default router;
