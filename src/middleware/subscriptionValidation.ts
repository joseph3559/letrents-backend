/**
 * Middleware to validate that companies have at least a Starter plan subscription
 * This ensures no account exists without a subscription
 */

import { Request, Response, NextFunction } from 'express';
import { JWTClaims } from '../types/index.js';
import { getPrisma } from '../config/prisma.js';

const prisma = getPrisma();

/**
 * Ensure that the company has at least a Starter plan subscription
 * This is required for landlords and agency_admins
 */
export const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
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

  // Only check for landlords and agency_admins
  if (!['landlord', 'agency_admin'].includes(user.role)) {
    return next();
  }

  // Check if user has company_id
  if (!user.company_id) {
    return res.status(403).json({
      success: false,
      message: 'Your account is not associated with a company. Please contact support.',
      error_code: 'MISSING_COMPANY_CONTEXT'
    });
  }

  try {
    // Check for active or trial subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        company_id: user.company_id,
        status: { in: ['active', 'trial'] },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!subscription) {
      console.warn('⚠️ Company without subscription attempting access:', {
        company_id: user.company_id,
        user_id: user.user_id,
        role: user.role,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        message: 'Your account requires an active subscription. Please subscribe to a plan to continue.',
        error_code: 'SUBSCRIPTION_REQUIRED',
        redirect_to: '/landlord/settings?tab=subscription'
      });
    }

    // Subscription exists, proceed
    next();
  } catch (error: any) {
    console.error('Error checking subscription:', error);
    // On error, allow access but log it
    next();
  }
};
