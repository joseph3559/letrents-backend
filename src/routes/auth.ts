import { Router } from 'express';
import { login, register, refresh, verifyEmail, requestPasswordReset, resetPassword, resendVerificationEmail, verifyInvitation, setupPassword } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);
router.get('/me', (_req, res) => {
	res.json({ success: true, data: { id: 'demo-user-id', email: 'demo@letrents.com', first_name: 'Demo', last_name: 'User', role: 'tenant', status: 'active' } });
});

export default router;
