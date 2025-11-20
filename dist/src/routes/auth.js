import { Router } from 'express';
import { login, register, refresh, verifyEmail, requestPasswordReset, resetPassword, resendVerificationEmail } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
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
// Get Supabase JWT token for authenticated user (for client-side Supabase connection)
router.get('/supabase-token', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        // Return Supabase URL and anon key for client-side connection
        // The client will use these to connect to Supabase Realtime
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(500).json({
                success: false,
                message: 'Supabase configuration not available',
            });
        }
        return res.json({
            success: true,
            data: {
                url: supabaseUrl,
                anonKey: supabaseAnonKey,
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting Supabase token:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
});
export default router;
