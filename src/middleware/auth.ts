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
		(req as any).user = claims;
		return next();
	} catch (e) {
		return res.status(401).json({ success: false, message: 'Invalid token' });
	}
};

export const requireRole = (roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
	const user = (req as any).user as JWTClaims | undefined;
	if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
	if (!roles.includes(user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
	return next();
};
