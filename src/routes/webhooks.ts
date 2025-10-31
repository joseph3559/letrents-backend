import { Router } from 'express';
import { handlePaystackWebhook } from '../controllers/webhooks.controller.js';

const router = Router();

/**
 * Paystack Webhook Endpoint
 * 
 * This endpoint receives payment notifications directly from Paystack
 * NO AUTHENTICATION REQUIRED - Paystack calls this endpoint
 * Security is handled via signature verification
 * 
 * To set up in Paystack Dashboard:
 * 1. Go to Settings → Webhooks
 * 2. Add webhook URL: https://your-domain.com/api/v1/webhooks/paystack
 * 3. Paystack will automatically call this when payments succeed
 */
router.post('/paystack', handlePaystackWebhook);

export default router;

