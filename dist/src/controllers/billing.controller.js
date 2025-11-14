import { PaystackService } from '../services/paystack.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import crypto from 'crypto';
const service = new PaystackService();
/**
 * Get human-readable display name for payment channel
 */
function getChannelDisplayName(channel, authorization) {
    if (!channel)
        return 'Online Payment';
    const channelLower = channel.toLowerCase();
    // Map Paystack channels to display names
    const channelMap = {
        'card': 'Card',
        'bank': 'Bank Transfer',
        'ussd': 'USSD',
        'qr': 'QR Code',
        'mobile_money': 'Mobile Money',
        'mobilemoney': 'Mobile Money',
        'mpesa': 'M-Pesa',
        'bank_transfer': 'Bank Transfer',
        'eft': 'Bank Transfer',
        'ach': 'Bank Transfer'
    };
    // Check if we have a direct mapping
    if (channelMap[channelLower]) {
        return channelMap[channelLower];
    }
    // Try to infer from authorization data
    if (authorization) {
        if (authorization.card_type) {
            return `${authorization.card_type} Card`;
        }
        if (authorization.bank) {
            return `${authorization.bank} Bank`;
        }
        if (authorization.brand) {
            return `${authorization.brand} Card`;
        }
    }
    // Default: capitalize first letter
    return channel.charAt(0).toUpperCase() + channel.slice(1).replace(/_/g, ' ');
}
export const getPlans = async (req, res) => {
    try {
        const plans = service.getPlans();
        writeSuccess(res, 200, 'Subscription plans retrieved successfully', plans);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve subscription plans';
        writeError(res, 500, message);
    }
};
export const createSubscription = async (req, res) => {
    try {
        const user = req.user;
        const subscriptionData = req.body;
        // Validate required fields
        if (!subscriptionData.plan || !subscriptionData.customerEmail || !subscriptionData.customerName) {
            return writeError(res, 400, 'Plan, customer email, and customer name are required');
        }
        const result = await service.createSubscription(subscriptionData, user);
        writeSuccess(res, 201, 'Subscription created successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to create subscription';
        const status = message.includes('permissions') ? 403 :
            message.includes('already has') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const getCompanySubscription = async (req, res) => {
    try {
        const user = req.user;
        const subscription = await service.getCompanySubscription(user);
        if (!subscription) {
            return writeError(res, 404, 'No subscription found');
        }
        writeSuccess(res, 200, 'Subscription retrieved successfully', subscription);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve subscription';
        writeError(res, 500, message);
    }
};
export const cancelSubscription = async (req, res) => {
    try {
        const user = req.user;
        const { reason } = req.body;
        const subscription = await service.cancelSubscription(user, reason);
        writeSuccess(res, 200, 'Subscription canceled successfully', subscription);
    }
    catch (error) {
        const message = error.message || 'Failed to cancel subscription';
        const status = message.includes('no active subscription') ? 404 : 500;
        writeError(res, status, message);
    }
};
export const getSubscriptionStats = async (req, res) => {
    try {
        const user = req.user;
        const stats = await service.getSubscriptionStats(user);
        writeSuccess(res, 200, 'Subscription statistics retrieved successfully', stats);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve subscription statistics';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const paystackWebhook = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error handling Paystack webhook:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
// Public endpoint to get subscription status for a company
export const getPublicSubscriptionStatus = async (req, res) => {
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
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve subscription status';
        writeError(res, 500, message);
    }
};
/**
 * Verify subscription payment
 */
export const verifySubscription = async (req, res) => {
    try {
        let user = req.user;
        const { reference } = req.body;
        if (!reference) {
            return writeError(res, 400, 'Payment reference is required');
        }
        // If user is not authenticated (new registration), we'll find them by email from transaction metadata
        let userEmail;
        let verificationResponse = null;
        if (!user) {
            // Verify transaction with Paystack first to get metadata
            const axios = (await import('axios')).default;
            const secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_d3829a1a9e2b62e6314b12f5f38ec1afd22599f7';
            try {
                verificationResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                    headers: {
                        Authorization: `Bearer ${secretKey}`,
                    },
                });
                if (verificationResponse.data.status && verificationResponse.data.data) {
                    const transaction = verificationResponse.data.data;
                    const metadata = transaction.metadata || {};
                    userEmail = metadata.user_email || transaction.customer?.email;
                    if (userEmail) {
                        // Find user by email
                        const { getPrisma } = await import('../config/prisma.js');
                        const prisma = getPrisma();
                        const foundUser = await prisma.user.findUnique({
                            where: { email: userEmail },
                            include: { company: true },
                        });
                        if (foundUser) {
                            // Create a mock user object for the rest of the function
                            user = {
                                user_id: foundUser.id,
                                email: foundUser.email,
                                role: foundUser.role,
                                company_id: foundUser.company_id || '',
                                phone_number: foundUser.phone_number || '',
                                session_id: '',
                                permissions: [],
                                iat: Math.floor(Date.now() / 1000),
                                exp: Math.floor(Date.now() / 1000) + 86400,
                                nbf: Math.floor(Date.now() / 1000),
                                iss: 'letrents-api',
                                sub: foundUser.id,
                                agency_id: foundUser.agency_id || undefined,
                                landlord_id: foundUser.landlord_id || undefined,
                            };
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error fetching transaction for unauthenticated user:', error);
            }
        }
        if (!user) {
            return writeError(res, 401, 'User not found. Please ensure you are logged in or the payment was made with a registered email.');
        }
        if (!user.company_id) {
            return writeError(res, 403, 'User must belong to a company');
        }
        // Verify transaction with Paystack API directly (if not already verified above)
        // IMPORTANT: Use subscription Paystack credentials, not rent credentials
        if (!verificationResponse) {
            const axios = (await import('axios')).default;
            // Use subscription Paystack secret key (not rent payment key)
            const secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_d3829a1a9e2b62e6314b12f5f38ec1afd22599f7';
            console.log('🔑 Using Paystack secret key:', secretKey.substring(0, 20) + '...');
            try {
                verificationResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                    headers: {
                        Authorization: `Bearer ${secretKey}`,
                    },
                });
            }
            catch (error) {
                const errorData = error.response?.data || {};
                console.error('❌ Paystack API Error:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: errorData,
                    message: error.message,
                    reference,
                    paystackMessage: errorData.message,
                    paystackCode: errorData.code,
                });
                // If Paystack returns 400, it means the reference is invalid or not found
                if (error.response?.status === 400) {
                    const paystackMessage = errorData.message || 'Transaction reference not found';
                    return writeError(res, 400, `Paystack verification failed: ${paystackMessage}. Reference: ${reference}. Please ensure the payment was completed successfully.`);
                }
                // For other errors, return generic message
                return writeError(res, 500, `Paystack verification failed: ${errorData.message || error.message}`);
            }
        }
        if (!verificationResponse.data.status || !verificationResponse.data.data) {
            console.error('❌ Paystack verification failed:', {
                responseStatus: verificationResponse.data.status,
                hasData: !!verificationResponse.data.data,
                message: verificationResponse.data.message,
                reference,
            });
            return writeError(res, 400, `Payment verification failed: ${verificationResponse.data.message || 'Unknown error'}`);
        }
        const transaction = verificationResponse.data.data;
        // Extract payment channel information
        const paymentChannel = transaction.channel || transaction.authorization?.channel || 'unknown';
        const channelDisplay = getChannelDisplayName(paymentChannel, transaction.authorization);
        console.log('✅ Paystack transaction verified:', {
            reference: transaction.reference,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            customer: transaction.customer,
            plan: transaction.plan,
            authorization: transaction.authorization,
            channel: paymentChannel,
            channel_display: channelDisplay,
        });
        // Check if payment was successful
        if (transaction.status !== 'success') {
            console.warn('⚠️ Payment not successful:', {
                status: transaction.status,
                gateway_response: transaction.gateway_response,
                reference,
            });
            return writeError(res, 400, `Payment not successful. Status: ${transaction.status}. ${transaction.gateway_response || ''}`);
        }
        // Check if this transaction is for a subscription
        const metadata = transaction.metadata || {};
        // Try multiple ways to get plan code: metadata, transaction plan, or authorization
        const planCode = metadata.plan_code ||
            metadata.plan ||
            transaction.plan?.code ||
            transaction.authorization?.plan_code ||
            transaction.plan_code;
        console.log('🔍 Payment verification debug:', {
            reference,
            metadata,
            transactionPlan: transaction.plan,
            planCode,
            transactionKeys: Object.keys(transaction),
        });
        if (!planCode) {
            // If no plan code found, try to get it from the subscription if it exists
            // This handles cases where payment was made but plan wasn't in metadata
            const { getPrisma } = await import('../config/prisma.js');
            const prisma = getPrisma();
            // Check if there's an existing subscription for this company
            const existingSub = await prisma.subscription.findFirst({
                where: { company_id: user.company_id },
                orderBy: { created_at: 'desc' },
            });
            if (existingSub && existingSub.paystack_plan_code) {
                // Use existing plan code if available
                const planCodeToName = {
                    'PLN_o3ryf9smw5vhppd': 'starter',
                    'PLN_5hpqovvz3chh7gn': 'professional',
                    'PLN_klg59ghnitsonct': 'enterprise',
                };
                const planName = planCodeToName[existingSub.paystack_plan_code] || existingSub.plan;
                // Extract payment channel information
                const paymentChannel = transaction.channel || transaction.authorization?.channel || 'unknown';
                const channelDisplay = getChannelDisplayName(paymentChannel, transaction.authorization);
                // Update subscription to active if payment was successful
                await prisma.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        status: 'active',
                        metadata: {
                            ...(existingSub.metadata || {}),
                            transaction_reference: reference,
                            verified_at: new Date().toISOString(),
                            last_payment_date: new Date().toISOString(),
                            payment_channel: paymentChannel,
                            payment_channel_display: channelDisplay,
                        },
                    },
                });
                return writeSuccess(res, 200, 'Payment verified successfully', {
                    plan_name: planName,
                    amount: transaction.amount / 100,
                    next_payment_date: existingSub.next_billing_date,
                    status: 'active',
                });
            }
            return writeError(res, 400, 'Invalid payment: plan code not found in transaction metadata');
        }
        // Get subscription by company and plan code
        const { getPrisma } = await import('../config/prisma.js');
        const prisma = getPrisma();
        // Map plan code to plan name
        const planCodeToName = {
            'PLN_o3ryf9smw5vhppd': 'starter',
            'PLN_5hpqovvz3chh7gn': 'professional',
            'PLN_klg59ghnitsonct': 'enterprise',
        };
        const planName = planCodeToName[planCode] || 'starter';
        // Get plan amount from PaystackService
        const { PaystackService: PaystackServiceClass } = await import('../services/paystack.service.js');
        const paystackServiceInstance = new PaystackServiceClass();
        const planConfig = paystackServiceInstance.plans[planName];
        const planAmount = planConfig ? planConfig.amount / 100 : 2500; // Convert from kobo to KES
        // First, try to find existing subscription by plan code (exact match)
        let subscription = await prisma.subscription.findFirst({
            where: {
                company_id: user.company_id,
                paystack_plan_code: planCode,
            },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });
        // If not found by plan code, find ANY existing subscription for this company (for upgrades)
        if (!subscription) {
            console.log(`🔍 No subscription found with plan code ${planCode}, checking for existing subscription to upgrade...`);
            subscription = await prisma.subscription.findFirst({
                where: {
                    company_id: user.company_id,
                },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            });
            // If existing subscription found, update it to the new plan
            if (subscription) {
                console.log(`🔄 Upgrading existing subscription from ${subscription.plan} to ${planName}`);
                // Calculate next billing date (30 days from now)
                const nextBillingDate = new Date();
                nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                subscription = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        plan: planName,
                        status: 'active',
                        paystack_plan_code: planCode,
                        amount: planAmount,
                        paystack_customer_code: transaction.customer?.customer_code || subscription.paystack_customer_code,
                        next_billing_date: nextBillingDate,
                        metadata: {
                            ...(subscription.metadata || {}),
                            transaction_reference: reference,
                            verified_at: new Date().toISOString(),
                            last_payment_date: new Date().toISOString(),
                            upgraded_from: subscription.plan,
                            upgraded_at: new Date().toISOString(),
                            payment_channel: paymentChannel,
                            payment_channel_display: channelDisplay,
                        },
                        updated_at: new Date(),
                    },
                    include: {
                        company: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                });
            }
        }
        // If subscription still doesn't exist, create it
        if (!subscription) {
            console.log(`📝 Creating new subscription for company ${user.company_id} with plan ${planName} (${planCode})`);
            const trialStartDate = new Date();
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial
            subscription = await prisma.subscription.create({
                data: {
                    company_id: user.company_id,
                    plan: planName,
                    status: 'active', // Payment successful, so activate immediately
                    gateway: 'paystack',
                    paystack_plan_code: planCode,
                    paystack_customer_code: transaction.customer?.customer_code || null,
                    amount: planAmount,
                    currency: 'KES',
                    billing_cycle: 'monthly',
                    trial_start_date: trialStartDate,
                    trial_end_date: trialEndDate,
                    start_date: trialStartDate,
                    next_billing_date: trialEndDate,
                    metadata: {
                        customer_email: transaction.customer?.email || metadata.user_email || '',
                        customer_name: metadata.user_name || '',
                        customer_phone: transaction.customer?.phone || metadata.customer_phone || '',
                        transaction_reference: reference,
                        verified_at: new Date().toISOString(),
                        created_from_payment: true,
                        payment_channel: paymentChannel,
                        payment_channel_display: channelDisplay,
                    },
                    created_by: user.user_id,
                },
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
        }
        else {
            // Update existing subscription to ensure it's active and has latest payment info
            if (subscription.status !== 'active' || subscription.paystack_plan_code !== planCode) {
                console.log(`🔄 Updating subscription ${subscription.id} to active status with plan ${planName}`);
                const nextBillingDate = new Date();
                nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                subscription = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: 'active',
                        plan: planName,
                        paystack_plan_code: planCode,
                        amount: planAmount,
                        next_billing_date: nextBillingDate,
                        metadata: {
                            ...(subscription.metadata || {}),
                            verified_at: new Date().toISOString(),
                            transaction_reference: reference,
                            last_payment_date: new Date().toISOString(),
                            payment_channel: paymentChannel,
                            payment_channel_display: channelDisplay,
                        },
                        updated_at: new Date(),
                    },
                    include: {
                        company: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                });
            }
        }
        if (!subscription) {
            return writeError(res, 500, 'Failed to create or retrieve subscription');
        }
        writeSuccess(res, 200, 'Payment verified successfully', {
            plan_name: subscription.plan,
            amount: transaction.amount / 100, // Convert from kobo to KES
            next_payment_date: subscription.next_billing_date,
            status: 'active',
        });
    }
    catch (error) {
        console.error('Error verifying subscription payment:', error);
        const message = error.message || 'Failed to verify subscription payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
