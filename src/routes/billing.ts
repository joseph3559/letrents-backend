import { Router } from 'express';
import {
  getPlans,
  createSubscription,
  getCompanySubscription,
  cancelSubscription,
  getSubscriptionStats,
  paystackWebhook,
  getPublicSubscriptionStatus,
  verifySubscription
} from '../controllers/billing.controller.js';
import { rbacResource } from '../middleware/rbac.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public endpoints are handled in the main router

// Subscription management (authenticated)
router.post('/subscription', rbacResource('billing', 'create'), createSubscription);
// Note: /subscription/verify is handled in main router as a public endpoint
router.get('/subscription', rbacResource('billing', 'read'), getCompanySubscription);
router.post('/subscription/cancel', rbacResource('billing', 'update'), cancelSubscription);

// Statistics (super admin only)
router.get('/stats', rbacResource('billing', 'stats'), getSubscriptionStats);

export default router;
