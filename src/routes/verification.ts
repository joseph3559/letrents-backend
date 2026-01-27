import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller.js';
import { rateLimitVerification } from '../middleware/rate-limit.js';

const router = Router();

// Apply rate limiting to all verification endpoints
// Limits: 100 requests per 15 minutes per IP
router.use(rateLimitVerification(15 * 60 * 1000, 100));

// Public verification endpoints (no authentication required, but rate-limited)
router.get('/receipt/:receiptNumber', verificationController.verifyReceipt);
router.get('/invoice/:invoiceNumber', verificationController.verifyInvoice);
router.get('/refund/:receiptNumber', verificationController.verifyRefund);

export default router;
