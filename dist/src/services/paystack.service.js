import { getPrisma } from '../config/prisma.js';
import axios from 'axios';
export class PaystackService {
    prisma = getPrisma();
    baseURL = 'https://api.paystack.co';
    config;
    // Plan configurations from Paystack
    plans = {
        starter: {
            plan_code: 'PLN_o3ryf9smw5vhppd',
            amount: 250000, // KES 2,500 in kobo
            name: 'Starter Plan',
        },
        professional: {
            plan_code: 'PLN_5hpqovvz3chh7gn',
            amount: 500000, // KES 5,000 in kobo
            name: 'Professional Plan',
        },
        enterprise: {
            plan_code: 'PLN_klg59ghnitsonct',
            amount: 1200000, // KES 12,000 in kobo
            name: 'Enterprise Plan',
        },
    };
    constructor() {
        this.config = {
            secretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_d3829a1a9e2b62e6314b12f5f38ec1afd22599f7',
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_021559fc9f5195aaac5352a6ed1cc3d8c09e1252',
        };
    }
    /**
     * Make authenticated request to Paystack API
     */
    async makeRequest(method, endpoint, data) {
        try {
            const response = await axios({
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                data,
            });
            return response.data;
        }
        catch (error) {
            console.error('Paystack API Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Paystack API request failed');
        }
    }
    /**
     * Create or get Paystack customer
     */
    async createCustomer(email, firstName, lastName, phone) {
        try {
            // First, try to get existing customer
            const existingCustomer = await this.makeRequest('GET', `/customer/${email}`);
            if (existingCustomer.status) {
                return existingCustomer.data;
            }
        }
        catch (error) {
            // Customer doesn't exist, create new one
        }
        const customerData = {
            email,
            first_name: firstName,
            last_name: lastName,
            phone,
        };
        const response = await this.makeRequest('POST', '/customer', customerData);
        return response.data;
    }
    /**
     * Create subscription
     */
    async createSubscription(request, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to create subscription');
        }
        if (!user.company_id) {
            throw new Error('user must belong to a company');
        }
        // Check if company already has an active subscription
        const existingSubscription = await this.prisma.subscription.findFirst({
            where: {
                company_id: user.company_id,
                status: { in: ['trial', 'active'] },
            },
        });
        if (existingSubscription) {
            throw new Error('company already has an active subscription');
        }
        const planConfig = this.plans[request.plan];
        if (!planConfig) {
            throw new Error('invalid subscription plan');
        }
        try {
            // Create Paystack customer
            const customer = await this.createCustomer(request.customerEmail, request.customerName.split(' ')[0], request.customerName.split(' ').slice(1).join(' '), request.customerPhone);
            // Create Paystack subscription
            const subscriptionData = {
                customer: customer.customer_code,
                plan: planConfig.plan_code,
                start_date: new Date().toISOString(),
            };
            const paystackSubscription = await this.makeRequest('POST', '/subscription', subscriptionData);
            // Calculate trial period (30 days)
            const trialStartDate = new Date();
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            // Create subscription in database
            const subscription = await this.prisma.subscription.create({
                data: {
                    company_id: user.company_id,
                    plan: request.plan,
                    status: 'trial',
                    gateway: 'paystack',
                    paystack_plan_code: planConfig.plan_code,
                    paystack_subscription_code: paystackSubscription.data.subscription_code,
                    paystack_customer_code: customer.customer_code,
                    amount: planConfig.amount / 100, // Convert from kobo to KES
                    currency: 'KES',
                    billing_cycle: 'monthly',
                    trial_start_date: trialStartDate,
                    trial_end_date: trialEndDate,
                    start_date: trialStartDate,
                    next_billing_date: trialEndDate,
                    metadata: {
                        customer_email: request.customerEmail,
                        customer_name: request.customerName,
                        customer_phone: request.customerPhone,
                        paystack_subscription_id: paystackSubscription.data.id,
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
            return {
                subscription,
                paystack_data: paystackSubscription.data,
                customer,
            };
        }
        catch (error) {
            console.error('Error creating subscription:', error);
            throw new Error('Failed to create subscription: ' + error.message);
        }
    }
    /**
     * Get company subscription
     */
    async getCompanySubscription(user) {
        if (!user.company_id) {
            throw new Error('user must belong to a company');
        }
        const subscription = await this.prisma.subscription.findFirst({
            where: { company_id: user.company_id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                billing_invoices: {
                    orderBy: { created_at: 'desc' },
                    take: 5,
                },
            },
            orderBy: { created_at: 'desc' },
        });
        if (!subscription) {
            return null;
        }
        // Get latest Paystack subscription data
        let paystackData = null;
        if (subscription.paystack_subscription_code) {
            try {
                const response = await this.makeRequest('GET', `/subscription/${subscription.paystack_subscription_code}`);
                paystackData = response.data;
            }
            catch (error) {
                console.warn('Failed to fetch Paystack subscription data:', error);
            }
        }
        return {
            ...subscription,
            paystack_data: paystackData,
            plan_config: this.plans[subscription.plan],
        };
    }
    /**
     * Cancel subscription
     */
    async cancelSubscription(user, reason) {
        if (!user.company_id) {
            throw new Error('user must belong to a company');
        }
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                company_id: user.company_id,
                status: { in: ['trial', 'active'] },
            },
        });
        if (!subscription) {
            throw new Error('no active subscription found');
        }
        try {
            // Cancel Paystack subscription
            if (subscription.paystack_subscription_code) {
                await this.makeRequest('POST', `/subscription/disable`, {
                    code: subscription.paystack_subscription_code,
                    token: subscription.paystack_subscription_code,
                });
            }
            // Update subscription in database
            const updatedSubscription = await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'canceled',
                    canceled_at: new Date(),
                    metadata: {
                        ...subscription.metadata,
                        cancellation_reason: reason,
                        canceled_by: user.user_id,
                    },
                },
            });
            return updatedSubscription;
        }
        catch (error) {
            console.error('Error canceling subscription:', error);
            throw new Error('Failed to cancel subscription: ' + error.message);
        }
    }
    /**
     * Handle Paystack webhook
     */
    async handleWebhook(event) {
        console.log('🔍 Paystack webhook received:', event.event);
        try {
            switch (event.event) {
                case 'subscription.create':
                    await this.handleSubscriptionCreated(event.data);
                    break;
                case 'subscription.disable':
                    await this.handleSubscriptionDisabled(event.data);
                    break;
                case 'invoice.create':
                    await this.handleInvoiceCreated(event.data);
                    break;
                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event.data);
                    break;
                case 'invoice.update':
                    await this.handleInvoiceUpdated(event.data);
                    break;
                default:
                    console.log('🔄 Unhandled webhook event:', event.event);
            }
            return { status: 'success' };
        }
        catch (error) {
            console.error('Error handling webhook:', error);
            throw error;
        }
    }
    async handleSubscriptionCreated(data) {
        console.log('✅ Subscription created:', data.subscription_code);
        const subscription = await this.prisma.subscription.findFirst({
            where: { paystack_subscription_code: data.subscription_code },
        });
        if (subscription) {
            await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'active',
                    metadata: {
                        ...subscription.metadata,
                        paystack_subscription_id: data.id,
                    },
                },
            });
        }
    }
    async handleSubscriptionDisabled(data) {
        console.log('❌ Subscription disabled:', data.subscription_code);
        const subscription = await this.prisma.subscription.findFirst({
            where: { paystack_subscription_code: data.subscription_code },
        });
        if (subscription) {
            await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'canceled',
                    canceled_at: new Date(),
                },
            });
        }
    }
    async handleInvoiceCreated(data) {
        console.log('📄 Invoice created:', data.id);
        if (data.subscription && data.subscription.subscription_code) {
            const subscription = await this.prisma.subscription.findFirst({
                where: { paystack_subscription_code: data.subscription.subscription_code },
            });
            if (subscription) {
                await this.prisma.billingInvoice.create({
                    data: {
                        company_id: subscription.company_id,
                        subscription_id: subscription.id,
                        invoice_number: `INV-${data.id}`,
                        amount: data.amount / 100, // Convert from kobo
                        currency: 'KES',
                        status: 'pending',
                        gateway: 'paystack',
                        gateway_reference: data.id.toString(),
                        gateway_invoice_id: data.id.toString(),
                        billing_period_start: new Date(data.period_start),
                        billing_period_end: new Date(data.period_end),
                        due_date: new Date(data.due_date),
                        description: `${subscription.plan} plan - ${new Date(data.period_start).toLocaleDateString()} to ${new Date(data.period_end).toLocaleDateString()}`,
                    },
                });
            }
        }
    }
    async handleInvoicePaymentFailed(data) {
        console.log('💸 Invoice payment failed:', data.id);
        const invoice = await this.prisma.billingInvoice.findFirst({
            where: { gateway_invoice_id: data.id.toString() },
            include: { subscription: true },
        });
        if (invoice) {
            await this.prisma.billingInvoice.update({
                where: { id: invoice.id },
                data: { status: 'failed' },
            });
            // Update subscription status
            await this.prisma.subscription.update({
                where: { id: invoice.subscription_id },
                data: { status: 'past_due' },
            });
        }
    }
    async handleInvoiceUpdated(data) {
        console.log('📝 Invoice updated:', data.id, 'Status:', data.status);
        const invoice = await this.prisma.billingInvoice.findFirst({
            where: { gateway_invoice_id: data.id.toString() },
            include: { subscription: true },
        });
        if (invoice) {
            const updateData = {
                status: data.status === 'success' ? 'paid' : data.status,
            };
            if (data.status === 'success' && data.paid_at) {
                updateData.paid_at = new Date(data.paid_at);
            }
            await this.prisma.billingInvoice.update({
                where: { id: invoice.id },
                data: updateData,
            });
            // Update subscription status if payment successful
            if (data.status === 'success') {
                await this.prisma.subscription.update({
                    where: { id: invoice.subscription_id },
                    data: {
                        status: 'active',
                        next_billing_date: new Date(data.subscription?.next_payment_date || Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                });
            }
        }
    }
    /**
     * Get subscription statistics
     */
    async getSubscriptionStats(user) {
        // Only super admins can see all subscription stats
        if (user.role !== 'super_admin') {
            throw new Error('insufficient permissions');
        }
        const [totalSubscriptions, activeSubscriptions, trialSubscriptions, revenue] = await Promise.all([
            this.prisma.subscription.count(),
            this.prisma.subscription.count({ where: { status: 'active' } }),
            this.prisma.subscription.count({ where: { status: 'trial' } }),
            this.prisma.billingInvoice.aggregate({
                where: { status: 'paid' },
                _sum: { amount: true },
            }),
        ]);
        const planBreakdown = await this.prisma.subscription.groupBy({
            by: ['plan'],
            _count: { plan: true },
        });
        return {
            total_subscriptions: totalSubscriptions,
            active_subscriptions: activeSubscriptions,
            trial_subscriptions: trialSubscriptions,
            total_revenue: revenue._sum.amount || 0,
            plan_breakdown: planBreakdown,
            plans: this.plans,
        };
    }
    /**
     * Get available plans
     */
    getPlans() {
        return Object.entries(this.plans).map(([key, plan]) => ({
            id: key,
            name: plan.name,
            amount: plan.amount / 100, // Convert to KES
            plan_code: plan.plan_code,
            currency: 'KES',
            interval: 'monthly',
            features: this.getPlanFeatures(key),
        }));
    }
    /**
     * Get plan features
     */
    getPlanFeatures(plan) {
        const features = {
            starter: [
                'Up to 50 units',
                'Basic tenant management',
                'Payment tracking',
                'Basic reports',
                'Email support',
            ],
            professional: [
                'Up to 200 units',
                'Advanced tenant management',
                'M-Pesa integration',
                'Advanced reports & analytics',
                'Maintenance management',
                'Priority support',
            ],
            enterprise: [
                'Unlimited units',
                'Multi-property management',
                'Custom integrations',
                'Advanced analytics & insights',
                'Dedicated account manager',
                '24/7 phone support',
                'Custom branding',
            ],
        };
        return features[plan] || [];
    }
}
