import { Request, Response } from 'express';
import { PaystackService, CreateSubscriptionRequest } from '../services/paystack.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';
import crypto from 'crypto';

const service = new PaystackService();

export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = service.getPlans();
    writeSuccess(res, 200, 'Subscription plans retrieved successfully', plans);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve subscription plans';
    writeError(res, 500, message);
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const subscriptionData: CreateSubscriptionRequest = req.body;

    // Validate required fields
    if (!subscriptionData.plan || !subscriptionData.customerEmail || !subscriptionData.customerName) {
      return writeError(res, 400, 'Plan, customer email, and customer name are required');
    }

    const result = await service.createSubscription(subscriptionData, user);
    writeSuccess(res, 201, 'Subscription created successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to create subscription';
    const status = message.includes('permissions') ? 403 :
                  message.includes('already has') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const getCompanySubscription = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const subscription = await service.getCompanySubscription(user);
    
    if (!subscription) {
      return writeError(res, 404, 'No subscription found');
    }

    writeSuccess(res, 200, 'Subscription retrieved successfully', subscription);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve subscription';
    writeError(res, 500, message);
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { reason } = req.body;

    const subscription = await service.cancelSubscription(user, reason);
    writeSuccess(res, 200, 'Subscription canceled successfully', subscription);
  } catch (error: any) {
    const message = error.message || 'Failed to cancel subscription';
    const status = message.includes('no active subscription') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const getSubscriptionStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const stats = await service.getSubscriptionStats(user);
    writeSuccess(res, 200, 'Subscription statistics retrieved successfully', stats);
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve subscription statistics';
    const status = message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const paystackWebhook = async (req: Request, res: Response) => {
  try {
    // Verify Paystack signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || 'sk_test_d3829a1a9e2b62e6314b12f5f38ec1afd22599f7')
      .update(JSON.stringify(req.body))
      .digest('hex');

    const signature = req.headers['x-paystack-signature'];

    if (hash !== signature) {
      return writeError(res, 400, 'Invalid signature');
    }

    console.log('🔍 Paystack webhook received:', req.body.event);
    
    await service.handleWebhook(req.body);
    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error handling Paystack webhook:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Public endpoint to get subscription status for a company
export const getPublicSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return writeError(res, 400, 'Company ID is required');
    }

    // This is a simplified check - in production you might want more security
    const { getPrisma } = await import('../config/prisma.js');
    const prisma = getPrisma();

    const subscription = await prisma.subscription.findFirst({
      where: { company_id: companyId },
      select: {
        status: true,
        plan: true,
        trial_end_date: true,
        next_billing_date: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!subscription) {
      return writeSuccess(res, 200, 'No subscription found', {
        status: 'none',
        can_use_system: false,
      });
    }

    const canUseSystem = ['trial', 'active'].includes(subscription.status);
    const isTrialExpired = subscription.trial_end_date && new Date() > subscription.trial_end_date;

    writeSuccess(res, 200, 'Subscription status retrieved', {
      status: subscription.status,
      plan: subscription.plan,
      can_use_system: canUseSystem && !isTrialExpired,
      trial_end_date: subscription.trial_end_date,
      next_billing_date: subscription.next_billing_date,
    });
  } catch (error: any) {
    const message = error.message || 'Failed to retrieve subscription status';
    writeError(res, 500, message);
  }
};
