import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer '))
        return res.status(401).json({ success: false, message: 'Authorization header required' });
    const token = header.substring(7);
    try {
        const claims = jwt.verify(token, env.jwt.secret);
        // ✅ SECURITY: Check if token is expired (extra validation)
        const now = Math.floor(Date.now() / 1000);
        if (claims.exp && claims.exp < now) {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        req.user = claims;
        return next();
    }
    catch (e) {
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
export const requireRole = (roles) => (req, res, next) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!roles.includes(user.role))
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return next();
};
