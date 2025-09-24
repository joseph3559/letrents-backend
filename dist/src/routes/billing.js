import { Router } from 'express';
import { createSubscription, getCompanySubscription, cancelSubscription, getSubscriptionStats } from '../controllers/billing.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Public endpoints are handled in the main router
// Subscription management (authenticated)
router.post('/subscription', rbacResource('billing', 'create'), createSubscription);
router.get('/subscription', rbacResource('billing', 'read'), getCompanySubscription);
router.post('/subscription/cancel', rbacResource('billing', 'update'), cancelSubscription);
// Statistics (super admin only)
router.get('/stats', rbacResource('billing', 'stats'), getSubscriptionStats);
export default router;
