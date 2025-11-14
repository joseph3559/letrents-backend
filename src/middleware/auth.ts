import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { JWTClaims, UserRole } from '../types/index.js';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
	const header = req.headers.authorization || '';
	if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authorization header required' });
	const token = header.substring(7);
	try {
		const claims = jwt.verify(token, env.jwt.secret) as JWTClaims;
		
		// ✅ SECURITY: Check if token is expired (extra validation)
		const now = Math.floor(Date.now() / 1000);
		if (claims.exp && claims.exp < now) {
			return res.status(401).json({ 
				success: false, 
				message: 'Token expired',
				code: 'TOKEN_EXPIRED'
			});
		}
		
		(req as any).user = claims;
		return next();
	} catch (e: any) {
		// ✅ SECURITY: Provide specific error for expired tokens
		if (e.name === 'TokenExpiredError') {
			return res.status(401).json({ 
				success: false, 
				message: 'Token expired',
				code: 'TOKEN_EXPIRED'
			});
		}
		return res.status(401).json({ 
			success: false, 
			message: 'Invalid token',
			code: 'INVALID_TOKEN'
		});
	}
};

export const requireRole = (roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
	const user = (req as any).user as JWTClaims | undefined;
	if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
	if (!roles.includes(user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
	return next();
};

/**
 * Optional authentication middleware
 * Sets req.user if a valid token is present, but doesn't fail if token is missing
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
	const header = req.headers.authorization || '';
	if (!header.startsWith('Bearer ')) {
		// No token provided, continue without setting user
		(req as any).user = undefined;
		return next();
	}
	
	const token = header.substring(7);
	try {
		const claims = jwt.verify(token, env.jwt.secret) as JWTClaims;
		
		// Check if token is expired
		const now = Math.floor(Date.now() / 1000);
		if (claims.exp && claims.exp < now) {
			// Token expired, continue without user
			(req as any).user = undefined;
			return next();
		}
		
		(req as any).user = claims;
		return next();
	} catch (e: any) {
		// Invalid token, continue without user
		(req as any).user = undefined;
		return next();
	}
};
