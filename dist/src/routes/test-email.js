import { Router } from 'express';
import { emailService } from '../services/email.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const router = Router();
// Test email endpoint - only for debugging
router.post('/send-test', async (req, res) => {
    try {
        const { email = 'scottjoe3559@gmail.com' } = req.body;
        console.log('Testing email service...');
        const result = await emailService.sendVerificationEmail(email, 'https://letrents.com/verify-email?token=test123', 'Test User');
        console.log('Email test result:', result);
        if (result.success) {
            writeSuccess(res, 200, 'Test email sent successfully', {
                messageId: result.messageId,
                email: email
            });
        }
        else {
            writeError(res, 500, `Failed to send test email: ${result.error}`);
        }
    }
    catch (error) {
        console.error('Test email error:', error);
        writeError(res, 500, `Email test failed: ${error.message}`);
    }
});
// Check email configuration
router.get('/config', async (req, res) => {
    try {
        const config = {
            provider: process.env.EMAIL_PROVIDER || 'not set',
            fromAddress: process.env.EMAIL_FROM_ADDRESS || 'not set',
            fromName: process.env.EMAIL_FROM_NAME || 'not set',
            brevoKeyExists: !!process.env.BREVO_API_KEY,
            brevoKeyLength: process.env.BREVO_API_KEY?.length || 0,
            requireVerification: process.env.REQUIRE_EMAIL_VERIFICATION || 'not set'
        };
        writeSuccess(res, 200, 'Email configuration retrieved', config);
    }
    catch (error) {
        writeError(res, 500, error.message);
    }
});
export default router;
