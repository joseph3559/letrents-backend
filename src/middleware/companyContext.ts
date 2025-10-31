/**
 * Middleware to validate that users have required company context
 * This prevents staff members from being created without proper company association
 */

import { Request, Response, NextFunction } from 'express';
import { JWTClaims } from '../types/index.js';

/**
 * Ensure that the user has a company_id
 * This is required for landlords, agency_admins, and when creating staff
 */
export const requireCompanyContext = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTClaims;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin is exempt from this check
  if (user.role === 'super_admin') {
    return next();
  }

  // Check if user has company_id
  if (!user.company_id) {
    console.error('❌ User attempting action without company_id:', {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      path: req.path,
      method: req.method
    });

    return res.status(403).json({
      success: false,
      message: 'Your account is not associated with a company. Please contact support to resolve this issue.',
      error_code: 'MISSING_COMPANY_CONTEXT'
    });
  }

  // User has company_id, proceed
  next();
};

/**
 * Ensure that the user has an agency_id (for agency-specific operations)
 */
export const requireAgencyContext = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTClaims;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin is exempt from this check
  if (user.role === 'super_admin') {
    return next();
  }

  // Check if user has agency_id
  if (!user.agency_id) {
    console.error('❌ User attempting agency operation without agency_id:', {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      path: req.path,
      method: req.method
    });

    return res.status(403).json({
      success: false,
      message: 'Your account is not associated with an agency. This operation requires agency context.',
      error_code: 'MISSING_AGENCY_CONTEXT'
    });
  }

  // User has agency_id, proceed
  next();
};

/**
 * Log company context for debugging
 */
export const logCompanyContext = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JWTClaims;

  if (user && process.env.NODE_ENV === 'development') {
    console.log('🔍 Company Context:', {
      user_id: user.user_id,
      role: user.role,
      company_id: user.company_id,
      agency_id: user.agency_id,
      path: req.path,
      method: req.method
    });
  }

  next();
};

