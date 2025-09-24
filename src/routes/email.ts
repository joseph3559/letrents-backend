import { Router } from 'express';
import { emailController } from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Apply authentication middleware to all email routes
router.use(requireAuth);

// Test email endpoint (for development/testing)
router.post('/test', emailController.testEmail);

// Send custom email endpoint
router.post('/send', emailController.sendCustomEmail);

// Get email provider status
router.get('/status', emailController.getEmailStatus);

export default router;
