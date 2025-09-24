import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer '))
        return res.status(401).json({ success: false, message: 'Authorization header required' });
    const token = header.substring(7);
    try {
        const claims = jwt.verify(token, env.jwt.secret);
        req.user = claims;
        return next();
    }
    catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
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
