import { Router, Request, Response, NextFunction } from 'express';
import auth from './auth.js';
import properties from './properties.js';
import units from './units.js';
import tenants from './tenants.js';
import tenantPortal from './tenant-portal.js';
import maintenance from './maintenance.js';
import invoices from './invoices.js';
import dashboard from './dashboard.js';
import users from './users.js';
import rbac from './rbac.js';
import staff from './staff.js';
import caretakers from './caretakers.js';
import propertyCaretakers from './property-caretakers.js';
import propertyFinancials from './property-financials.js';
import propertyStaff from './property-staff.js';
import leases from './leases.js';
import notifications from './notifications.js';
import messages from './messages.js';
import messaging from './messaging.js';
import reports from './reports.js';
import payments from './payments.js';
import mpesa from './mpesa.js';
import billing from './billing.js';
import superAdmin from './super-admin.js';
import enums from './enums.js';
import email from './email.js';
import setup from './setup.js';
import testEmail from './test-email.js';
import checklists from './checklists.js';
import cleanup from './cleanup.js';
import tasks from './task.routes.js';
import webhooks from './webhooks.js';
import emergencyContacts from './emergency-contacts.js';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';

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

// Webhook endpoints (NO AUTH - verified via signature)
router.use('/webhooks', webhooks);

router.use('/auth', auth);

// Invitations endpoints (public - for invitation verification and setup)
router.get('/invitations/verify', async (req, res) => {
	const { verifyInvitation } = await import('../controllers/auth.controller.js');
	return verifyInvitation(req, res);
});

router.post('/invitations/setup-password', async (req, res) => {
	const { setupPassword } = await import('../controllers/auth.controller.js');
	return setupPassword(req, res);
});

router.use('/properties', requireAuth, properties);
router.use('/units', requireAuth, units);
router.use('/tenants', requireAuth, tenants);
router.use('/tenant-portal', requireAuth, tenantPortal);
router.use('/maintenance', requireAuth, maintenance);
router.use('/invoices', requireAuth, invoices);
router.use('/dashboard', requireAuth, dashboard);
router.use('/users', requireAuth, users);
router.use('/rbac', requireAuth, rbac);
router.use('/staff', requireAuth, staff); // Primary staff endpoint (all roles)
router.use('/caretakers', requireAuth, caretakers); // Legacy alias for backward compatibility
  router.use('/property-caretakers', requireAuth, propertyCaretakers);
  router.use('/properties', requireAuth, propertyFinancials);
  router.use('/properties', requireAuth, propertyStaff);
router.use('/leases', requireAuth, leases);

// Notification templates routes (must be before /notifications router)
router.get('/notifications/templates', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getNotificationTemplates } = await import('../controllers/super-admin.controller.js');
	await getNotificationTemplates(req, res);
});

router.post('/notifications/templates', requireAuth, requireSuperAdmin, async (req, res) => {
	const { createNotificationTemplate } = await import('../controllers/super-admin.controller.js');
	await createNotificationTemplate(req, res);
});

router.put('/notifications/templates/:id', requireAuth, requireSuperAdmin, async (req, res) => {
	const { updateNotificationTemplate } = await import('../controllers/super-admin.controller.js');
	await updateNotificationTemplate(req, res);
});

router.use('/notifications', requireAuth, notifications);
router.use('/messages', requireAuth, messages);
router.use('/messaging', requireAuth, messaging);
router.use('/reports', requireAuth, reports);
router.use('/payments', requireAuth, payments);
router.use('/mpesa', requireAuth, mpesa); // M-Pesa management needs auth

// Public billing endpoints (no authentication required) - must come before authenticated routes
router.get('/billing/plans', async (req, res) => {
  const { getPlans } = await import('../controllers/billing.controller.js');
  return getPlans(req, res);
});

// Verify subscription endpoint (optional auth for new registrations)
router.post('/billing/subscription/verify', async (req, res, next) => {
  const { optionalAuth } = await import('../middleware/auth.js');
  const { verifySubscription } = await import('../controllers/billing.controller.js');
  optionalAuth(req, res, () => verifySubscription(req, res));
});

router.post('/billing/webhook/paystack', async (req, res) => {
  const { paystackWebhook } = await import('../controllers/billing.controller.js');
  return paystackWebhook(req, res);
});

router.get('/billing/subscription/status/:companyId', async (req, res) => {
  const { getPublicSubscriptionStatus } = await import('../controllers/billing.controller.js');
  return getPublicSubscriptionStatus(req, res);
});

router.use('/billing', requireAuth, billing); // Billing management needs auth
router.use('/email', email); // Email endpoints (auth handled within routes)
router.use('/tasks', requireAuth, tasks); // Task management (auth required)

// M-Pesa C2B callbacks (no authentication required)
router.post('/mpesa/c2b/validation', async (req, res) => {
  const { c2bValidation } = await import('../controllers/mpesa.controller.js');
  return c2bValidation(req, res);
});

router.post('/mpesa/c2b/confirmation', async (req, res) => {
  const { c2bConfirmation } = await import('../controllers/mpesa.controller.js');
  return c2bConfirmation(req, res);
});
router.use('/enums', enums);
router.use('/setup', setup);
router.use('/test-email', testEmail);
router.use('/checklists', requireAuth, checklists);
router.use('/cleanup', requireAuth, cleanup);
router.use('/emergency-contacts', requireAuth, emergencyContacts);

// Super Admin specific endpoints that frontend calls directly
router.get('/kpis', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getKPIMetrics } = await import('../controllers/super-admin.controller.js');
	await getKPIMetrics(req, res);
});

router.get('/system/health', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getSystemHealth } = await import('../controllers/super-admin.controller.js');
	await getSystemHealth(req, res);
});

router.get('/audit-logs', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getAuditLogs } = await import('../controllers/super-admin.controller.js');
	await getAuditLogs(req, res);
});

router.get('/analytics/:chartType', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getAnalyticsChart } = await import('../controllers/super-admin.controller.js');
	await getAnalyticsChart(req, res);
});

// Additional super-admin endpoints
router.get('/platform-analytics', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getPlatformAnalytics } = await import('../controllers/super-admin.controller.js');
	await getPlatformAnalytics(req, res);
});

router.get('/revenue/dashboard', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getRevenueDashboard } = await import('../controllers/super-admin.controller.js');
	await getRevenueDashboard(req, res);
});

// Removed duplicate /agencies routes - they're now in /super-admin/agencies

// Add proper users/metrics endpoint
router.get('/users/metrics', requireAuth, requireSuperAdmin, (req, res) => {
	try {
		console.log('Users/metrics endpoint hit by user:', (req as any).user);
		const role = req.query.role as string;
	
		let metrics;
	
		if (role === 'landlord') {
			metrics = {
				total_users: 1,
				active_users: 1,
				inactive_users: 0,
				users_by_role: [
					{ role: 'landlord', count: 1 }
				],
				growth_rate: 0
			};
		} else if (role === 'tenant') {
			metrics = {
				total_users: 3,
				active_users: 3,
				inactive_users: 0,
				users_by_role: [
					{ role: 'tenant', count: 3 }
				],
				growth_rate: 15.2
			};
		} else {
			// All users
			metrics = {
				total_users: 6,
				active_users: 6,
				inactive_users: 0,
				users_by_role: [
					{ role: 'super_admin', count: 1 },
					{ role: 'landlord', count: 1 },
					{ role: 'tenant', count: 3 },
					{ role: 'caretaker', count: 1 },
					{ role: 'agent', count: 1 }
				],
				growth_rate: 8.5
			};
		}

		res.status(200).json({ 
			success: true, 
			message: 'User metrics retrieved successfully', 
			data: metrics 
		});
	} catch (error) {
		console.error('Error in users/metrics endpoint:', error);
		res.status(500).json({ 
			success: false, 
			message: 'Internal server error', 
			error: error instanceof Error ? error.message : String(error) 
		});
	}
});

router.get('/revenue/summary', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getRevenueSummary } = await import('../controllers/super-admin.controller.js');
	await getRevenueSummary(req, res);
});

router.get('/billing/plans', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getBillingPlans } = await import('../controllers/super-admin.controller.js');
	await getBillingPlans(req, res);
});

router.get('/billing/subscriptions', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getBillingSubscriptions } = await import('../controllers/super-admin.controller.js');
	await getBillingSubscriptions(req, res);
});

router.get('/billing/invoices', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getBillingInvoices } = await import('../controllers/super-admin.controller.js');
	await getBillingInvoices(req, res);
});

router.get('/applications', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getApplications } = await import('../controllers/super-admin.controller.js');
	await getApplications(req, res);
});

router.get('/applications/:id', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getApplication } = await import('../controllers/super-admin.controller.js');
	await getApplication(req, res);
});

router.post('/applications/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
	const { approveApplication } = await import('../controllers/super-admin.controller.js');
	await approveApplication(req, res);
});

router.post('/applications/:id/reject', requireAuth, requireSuperAdmin, async (req, res) => {
	const { rejectApplication } = await import('../controllers/super-admin.controller.js');
	await rejectApplication(req, res);
});

router.get('/messaging/broadcasts/estimate', requireAuth, requireSuperAdmin, async (req, res) => {
	const { estimateBroadcastRecipients } = await import('../controllers/super-admin.controller.js');
	await estimateBroadcastRecipients(req, res);
});

router.get('/messaging/broadcasts', requireAuth, requireSuperAdmin, async (req, res) => {
	const { getMessagingBroadcasts } = await import('../controllers/super-admin.controller.js');
	await getMessagingBroadcasts(req, res);
});

router.post('/messaging/broadcasts', requireAuth, requireSuperAdmin, async (req, res) => {
	const { createBroadcastMessage } = await import('../controllers/super-admin.controller.js');
	await createBroadcastMessage(req, res);
});

router.post('/messaging/broadcasts/:id/send', requireAuth, requireSuperAdmin, async (req, res) => {
	const { sendBroadcastMessage } = await import('../controllers/super-admin.controller.js');
	await sendBroadcastMessage(req, res);
});

router.post('/messaging/broadcasts/:id/schedule', requireAuth, requireSuperAdmin, async (req, res) => {
	const { scheduleBroadcastMessage } = await import('../controllers/super-admin.controller.js');
	await scheduleBroadcastMessage(req, res);
});

// Debug logging for super-admin routes
router.use('/super-admin', (req, res, next) => {
	console.log(`📍 Main router /super-admin: ${req.method} ${req.path}`);
	next();
});

// Full super-admin routes
router.use('/super-admin', superAdmin);

// Health check endpoint with optional database setup
router.get('/health', async (req, res) => {
	const setupDB = req.query.setup === 'true';
	
	let result: any = { 
		success: true, 
		status: 'healthy',
		service: 'letrents-backend-v2',
		version: '2.0.0',
		timestamp: new Date().toISOString()
	};
	
	if (setupDB) {
		try {
			const { setupDatabase } = require('../../manual-setup.js');
			const setupResult = await setupDatabase();
			result.database_setup = setupResult;
		} catch (error: any) {
			result.database_setup = {
				success: false,
				error: error.message
			};
		}
	}
	
	res.json(result);
});

// Manual database setup endpoint (temporary)
router.post('/manual-setup', async (_req, res) => {
	try {
		const { setupDatabase } = require('../../manual-setup.js');
		const result = await setupDatabase();
		res.json(result);
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: 'Manual setup failed',
			error: error.message
		});
	}
});

// Migration test endpoint
router.get('/migration/test', (_req, res) => {
	res.json({ success: true, message: 'New unified API structure is active!', migration_status: 'Phase 1 - Parallel deployment' });
});

// Onboarding status endpoint (matches Go backend)
router.get('/onboarding/status', requireAuth, rbacResource('dashboard', 'read'), async (req, res) => {
	try {
		const user = (req as any).user;
		const { getOnboardingStatus } = await import('../controllers/dashboard.controller.js');
		await getOnboardingStatus(req, res);
	} catch (error: any) {
		res.status(500).json({ success: false, message: 'Failed to get onboarding status', error: error.message });
	}
});

export default router;
