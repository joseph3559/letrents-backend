import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';

const service = new AuthService();

export const register = async (req: Request, res: Response) => {
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
	} catch (err: any) {
		const msg = err?.message || 'An error occurred during registration';
		const status = msg.includes('exists') ? 409 : 500;
		return res.status(status).json({ success: false, message: msg });
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { email, password, remember_me, device_info } = req.body || {};
		const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
		const ua = req.headers['user-agent'] || '';
		const result = await service.login({ email, password, remember_me, device_info }, ip, ua);
		return res.status(200).json({ success: true, message: 'Login successful', data: result });
	} catch (err: any) {
		const msg = err?.message || 'An error occurred during authentication';
		const map: Record<string, number> = {
			'invalid credentials': 401,
			'user not found': 404,
			'user account is inactive': 403,
			'user account is not verified': 403,
		};
		const status = map[msg] || 500;
		return res.status(status).json({ success: false, message: msg });
	}
};

export const refresh = async (req: Request, res: Response) => {
	try {
		const { refresh_token } = req.body || {};
		if (!refresh_token) return res.status(400).json({ success: false, message: 'Missing refresh token' });
		const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
		const ua = req.headers['user-agent'] || '';
		const result = await service.refresh(refresh_token, ip, ua);
		return res.status(200).json({ success: true, message: 'Token refreshed successfully', data: result });
	} catch (err: any) {
		const msg = err?.message || 'Invalid refresh token';
		const status = msg.includes('expired') ? 401 : 401;
		return res.status(status).json({ success: false, message: msg });
	}
};

export const verifyEmail = async (req: Request, res: Response) => {
	try {
		const token = req.method === 'GET' ? (req.query.token as string) : req.body?.token;
		if (!token) return res.status(400).json({ success: false, message: 'Verification token is required' });
		
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
	} catch (err: any) {
		const msg = err?.message || 'Invalid or expired verification token';
		return res.status(400).json({ success: false, message: msg });
	}
};

export const requestPasswordReset = async (req: Request, res: Response) => {
	try {
		const { email } = req.body || {};
		if (!email) {
			return res.status(400).json({ success: false, message: 'Email is required' });
		}
		const result = await service.requestPasswordReset(email);
		return res.status(200).json({ success: true, message: result.message });
	} catch (err: any) {
		const msg = err?.message || 'An error occurred while requesting password reset';
		return res.status(500).json({ success: false, message: msg });
	}
};

export const resetPassword = async (req: Request, res: Response) => {
	try {
		const { token, password } = req.body || {};
		if (!token || !password) {
			return res.status(400).json({ success: false, message: 'Token and new password are required' });
		}
		await service.resetPassword(token, password);
		return res.status(200).json({ success: true, message: 'Password reset successfully' });
	} catch (err: any) {
		const msg = err?.message || 'Invalid or expired reset token';
		const status = msg.includes('expired') || msg.includes('invalid') ? 400 : 500;
		return res.status(status).json({ success: false, message: msg });
	}
};

export const resendVerificationEmail = async (req: Request, res: Response) => {
	try {
		const { email } = req.body || {};
		if (!email) {
			return res.status(400).json({ success: false, message: 'Email is required' });
		}
		const result = await service.resendVerificationEmail(email);
		const status = result.success ? 200 : 400;
		return res.status(status).json({ success: result.success, message: result.message });
	} catch (err: any) {
		const msg = err?.message || 'An error occurred while resending verification email';
		return res.status(500).json({ success: false, message: msg });
	}
};

export const verifyInvitation = async (req: Request, res: Response) => {
	try {
		const token = req.query.token as string;
		if (!token) {
			return res.status(400).json({ success: false, message: 'Invitation token is required' });
		}

		// Extract user ID from invitation token (format: invitation-{userId})
		if (!token.startsWith('invitation-')) {
			return res.status(400).json({ success: false, message: 'Invalid invitation token format' });
		}

		const userId = token.replace('invitation-', '');
		const { PrismaClient } = await import('@prisma/client');
		const prisma = new PrismaClient();

		// Define roles that can use invitations
		// Team member roles (SaaS team)
		const TEAM_MEMBER_ROLES = ['admin', 'manager', 'team_lead', 'staff', 'finance', 'sales', 'marketing', 'support', 'hr', 'auditor'];
		// Customer-facing staff roles that can receive invitations
		const STAFF_ROLES = ['agency_admin', 'landlord', 'agent', 'caretaker', 'cleaner', 'security', 'maintenance', 'receptionist', 'accountant', 'manager'];
		// Tenant role
		const TENANT_ROLE = 'tenant';

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				first_name: true,
				last_name: true,
				role: true,
				status: true,
				email_verified: true,
			}
		});

		if (!user) {
			return res.status(404).json({ success: false, message: 'Invalid invitation token' });
		}

		const isTeamMember = TEAM_MEMBER_ROLES.includes(user.role);
		const isStaffMember = STAFF_ROLES.includes(user.role);
		const isTenant = user.role === TENANT_ROLE;

		// Check if invitation is valid - allow tenants, team members, and staff members
		if (!isTenant && !isTeamMember && !isStaffMember) {
			return res.status(400).json({ success: false, message: 'Invalid invitation token for this user type' });
		}

		if (user.status !== 'pending' && user.status !== 'pending_setup') {
			return res.status(410).json({ success: false, message: 'This invitation has already been used or the account is already active' });
		}

		// Return user info for the setup page
		return res.status(200).json({
			success: true,
			user: {
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				role: user.role,
			}
		});
	} catch (err: any) {
		console.error('Error verifying invitation:', err);
		return res.status(500).json({ success: false, message: 'An error occurred while verifying invitation' });
	}
};

export const setupPassword = async (req: Request, res: Response) => {
	try {
		const { token, password } = req.body || {};
		if (!token || !password) {
			return res.status(400).json({ success: false, message: 'Token and password are required' });
		}

		// Extract user ID from invitation token
		if (!token.startsWith('invitation-')) {
			return res.status(400).json({ success: false, message: 'Invalid invitation token format' });
		}

		const userId = token.replace('invitation-', '');
		const { PrismaClient } = await import('@prisma/client');
		const prisma = new PrismaClient();

		// Get user info from database to verify and get email
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				first_name: true,
				last_name: true,
				role: true,
				status: true,
			}
		});

		if (!user) {
			return res.status(404).json({ success: false, message: 'Invalid invitation token' });
		}

		// Use the register method with invitation_token to handle password setup
		const result = await service.register({
			email: user.email!,
			password,
			first_name: user.first_name || '',
			last_name: user.last_name || '',
			invitation_token: token
		});

		if ('requires_mfa' in result) {
			return res.status(201).json({ success: true, message: 'Password setup successful', data: result });
		}

		// Check if result has token (successful registration with tokens)
		if ('token' in result && 'refresh_token' in result) {
			// Return tokens for auto-login
			return res.status(200).json({
				success: true,
				message: 'Password setup successful',
				access_token: result.token,
				refresh_token: result.refresh_token,
				user: result.user
			});
		}

		// Fallback if result structure is unexpected
		return res.status(200).json({
			success: true,
			message: 'Password setup successful',
			user: result.user
		});
	} catch (err: any) {
		const msg = err?.message || 'An error occurred while setting up password';
		const status = msg.includes('invalid') || msg.includes('expired') ? 400 : msg.includes('already') ? 409 : 500;
		return res.status(status).json({ success: false, message: msg });
	}
};
