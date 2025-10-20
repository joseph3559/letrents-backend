import { AuthService } from '../services/auth.service.js';
const service = new AuthService();
export const register = async (req, res) => {
    try {
        const { email, password, first_name, last_name, role, phone_number, company_name, business_type, invitation_token } = req.body || {};
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ success: false, message: 'Email, password, first name, and last name are required' });
        }
        const result = await service.register({ email, password, first_name, last_name, role, phone_number, company_name, business_type, invitation_token });
        if ('requires_mfa' in result) {
            return res.status(201).json({ success: true, message: 'Registration successful. Please check your email for verification.', data: result });
        }
        return res.status(201).json({ success: true, message: 'Registration successful', data: result });
    }
    catch (err) {
        const msg = err?.message || 'An error occurred during registration';
        const status = msg.includes('exists') ? 409 : 500;
        return res.status(status).json({ success: false, message: msg });
    }
};
export const login = async (req, res) => {
    try {
        const { email, password, remember_me, device_info } = req.body || {};
        const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
        const ua = req.headers['user-agent'] || '';
        const result = await service.login({ email, password, remember_me, device_info }, ip, ua);
        return res.status(200).json({ success: true, message: 'Login successful', data: result });
    }
    catch (err) {
        const msg = err?.message || 'An error occurred during authentication';
        const map = {
            'invalid credentials': 401,
            'user not found': 404,
            'user account is inactive': 403,
            'user account is not verified': 403,
        };
        const status = map[msg] || 500;
        return res.status(status).json({ success: false, message: msg });
    }
};
export const refresh = async (req, res) => {
    try {
        const { refresh_token } = req.body || {};
        if (!refresh_token)
            return res.status(400).json({ success: false, message: 'Missing refresh token' });
        const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
        const ua = req.headers['user-agent'] || '';
        const result = await service.refresh(refresh_token, ip, ua);
        return res.status(200).json({ success: true, message: 'Token refreshed successfully', data: result });
    }
    catch (err) {
        const msg = err?.message || 'Invalid refresh token';
        const status = msg.includes('expired') ? 401 : 401;
        return res.status(status).json({ success: false, message: msg });
    }
};
export const verifyEmail = async (req, res) => {
    try {
        const token = req.method === 'GET' ? req.query.token : req.body?.token;
        if (!token)
            return res.status(400).json({ success: false, message: 'Verification token is required' });
        const result = await service.verifyEmail(token);
        if (req.method === 'GET') {
            // For GET requests, redirect to success page
            return res.redirect((process.env.APP_URL || 'http://localhost:3000') + '/verification-success');
        }
        // For POST requests, return JSON response
        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                email_verified: true,
                already_verified: result.already_verified || false,
                user: result.user || null
            }
        });
    }
    catch (err) {
        const msg = err?.message || 'Invalid or expired verification token';
        return res.status(400).json({ success: false, message: msg });
    }
};
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const result = await service.requestPasswordReset(email);
        return res.status(200).json({ success: true, message: result.message });
    }
    catch (err) {
        const msg = err?.message || 'An error occurred while requesting password reset';
        return res.status(500).json({ success: false, message: msg });
    }
};
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body || {};
        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and new password are required' });
        }
        await service.resetPassword(token, password);
        return res.status(200).json({ success: true, message: 'Password reset successfully' });
    }
    catch (err) {
        const msg = err?.message || 'Invalid or expired reset token';
        const status = msg.includes('expired') || msg.includes('invalid') ? 400 : 500;
        return res.status(status).json({ success: false, message: msg });
    }
};
export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const result = await service.resendVerificationEmail(email);
        const status = result.success ? 200 : 400;
        return res.status(status).json({ success: result.success, message: result.message });
    }
    catch (err) {
        const msg = err?.message || 'An error occurred while resending verification email';
        return res.status(500).json({ success: false, message: msg });
    }
};
