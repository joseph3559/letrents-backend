import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import axios from 'axios';
import { buildWhereClause } from '../utils/roleBasedFiltering.js';

export interface PaystackConfig {
  secretKey: string;
  publicKey: string;
}

export interface CreateSubscriptionRequest {
  plan: 'starter' | 'professional' | 'enterprise';
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
}

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface PaystackSubscription {
  id: number;
  subscription_code: string;
  status: string;
  amount: number;
  plan: {
    id: number;
    plan_code: string;
    name: string;
    amount: number;
  };
  customer: PaystackCustomer;
  next_payment_date: string;
}

export class PaystackService {
  private prisma = getPrisma();
  private baseURL = 'https://api.paystack.co';
  private config: PaystackConfig;
  private rentConfig: PaystackConfig;

  // Plan configurations from Paystack
  private plans = {
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
    // SaaS subscription credentials
    this.config = {
      secretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_d3829a1a9e2b62e6314b12f5f38ec1afd22599f7',
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_021559fc9f5195aaac5352a6ed1cc3d8c09e1252',
    };

    // Rent collection credentials
    this.rentConfig = {
      secretKey: process.env.RENT_PAYSTACK_SECRET_KEY || 'sk_test_612601ba9ec40de3806d6f37b810c8bd87605bf3',
      publicKey: process.env.RENT_PAYSTACK_PUBLIC_KEY || 'pk_test_4cedd79cc84483ab217f8d7edb18d4b01af474a2',
    };
  }

  /**
   * Make authenticated request to Paystack API
   */
  private async makeRequest(method: 'GET' | 'POST' | 'PUT', endpoint: string, data?: any, useRentCredentials = false) {
    try {
      const secretKey = useRentCredentials ? this.rentConfig.secretKey : this.config.secretKey;

      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      return response.data;
    } catch (error: any) {
      console.error('Paystack API Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Paystack API request failed');
    }
  }

  /**
   * Create or get Paystack customer
   */
  async createCustomer(email: string, firstName?: string, lastName?: string, phone?: string): Promise<PaystackCustomer> {
    try {
      // First, try to get existing customer
      const existingCustomer = await this.makeRequest('GET', `/customer/${email}`);
      if (existingCustomer.status) {
        return existingCustomer.data;
      }
    } catch (error) {
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
  async createSubscription(request: CreateSubscriptionRequest, user: JWTClaims) {
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
      const customer = await this.createCustomer(
        request.customerEmail,
        request.customerName.split(' ')[0],
        request.customerName.split(' ').slice(1).join(' '),
        request.customerPhone
      );

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
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription: ' + error.message);
    }
  }

  /**
   * Get company subscription
   */
  async getCompanySubscription(user: JWTClaims) {
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
      } catch (error) {
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
  async cancelSubscription(user: JWTClaims, reason?: string) {
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
            ...(subscription.metadata as object),
            cancellation_reason: reason,
            canceled_by: user.user_id,
          },
        },
      });

      return updatedSubscription;
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription: ' + error.message);
    }
  }

  /**
   * Handle Paystack webhook
   */
  async handleWebhook(event: any) {
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
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(data: any) {
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
            ...(subscription.metadata as object),
            paystack_subscription_id: data.id,
          },
        },
      });
    }
  }

  private async handleSubscriptionDisabled(data: any) {
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

  private async handleInvoiceCreated(data: any) {
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

  private async handleInvoicePaymentFailed(data: any) {
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

  private async handleInvoiceUpdated(data: any) {
    console.log('📝 Invoice updated:', data.id, 'Status:', data.status);
    
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { gateway_invoice_id: data.id.toString() },
      include: { subscription: true },
    });

    if (invoice) {
      const updateData: any = {
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
  async getSubscriptionStats(user: JWTClaims) {
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
      features: this.getPlanFeatures(key as any),
    }));
  }

  /**
   * Get plan features
   */
  private getPlanFeatures(plan: 'starter' | 'professional' | 'enterprise') {
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

  /**
   * Verify rent payment transaction
   */
  async verifyRentPayment(reference: string, user: JWTClaims) {
    try {
      // Verify transaction with Paystack using rent credentials
      const verificationResponse = await this.makeRequest('GET', `/transaction/verify/${reference}`, undefined, true);

      if (!verificationResponse.status || !verificationResponse.data) {
        throw new Error('Payment verification failed');
      }

      const transaction = verificationResponse.data;

      // Check if payment was successful
      if (transaction.status !== 'success') {
        throw new Error(`Payment status: ${transaction.status}`);
      }

      // Extract metadata
      const metadata = transaction.metadata || {};
      const tenantId = metadata.tenant_id;
      const propertyId = metadata.property_id;
      const unitNumber = metadata.unit_number;
      const paymentPeriod = metadata.payment_period;

      if (!tenantId) {
        throw new Error('Invalid payment: tenant ID not found in transaction metadata');
      }

      // Get tenant and unit information
      const tenantProfile = await this.prisma.tenantProfile.findUnique({
        where: { user_id: tenantId },
        include: {
          current_unit: {
            include: {
              property: true,
            },
          },
          user: true,
        },
      });

      if (!tenantProfile) {
        throw new Error('Tenant not found');
      }

      // Check permissions
      if (!user.company_id) {
        throw new Error('User must belong to a company');
      }

      // Calculate amount in KES (Paystack returns amount in kobo)
      const amountKES = transaction.amount / 100;

      // Check if payment already exists for this transaction reference
      const existingPaymentByRef = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { transaction_id: reference },
            { reference_number: transaction.reference },
          ],
        },
      });

      if (existingPaymentByRef) {
        console.log(`⚠️  Payment already exists for this transaction: ${existingPaymentByRef.receipt_number}`);
        return {
          payment: existingPaymentByRef,
          transaction: {
            reference: transaction.reference,
            amount: amountKES,
            status: transaction.status,
            paid_at: transaction.paid_at,
            channel: transaction.channel,
            subaccount: transaction.subaccount,
          },
        };
      }

      // Check if there's an existing pending payment for this tenant and period
      const existingPendingPayment = await this.prisma.payment.findFirst({
        where: {
          tenant_id: tenantId,
          payment_period: paymentPeriod,
          status: 'pending',
        },
        orderBy: { created_at: 'desc' },
      });

      let payment;
      if (existingPendingPayment) {
        // Update existing pending payment
        payment = await this.prisma.payment.update({
          where: { id: existingPendingPayment.id },
          data: {
            status: 'completed',
            payment_method: 'online',
            payment_date: new Date(),
            transaction_id: transaction.id.toString(), // Convert to string
            reference_number: transaction.reference,
            notes: `Online rent payment via Paystack - ${paymentPeriod}. Service fee included in total.`,
            processed_by: user.user_id,
            processed_at: new Date(),
            received_from: `${tenantProfile.user.first_name} ${tenantProfile.user.last_name}`,
          },
        });
        console.log(`✅ Updated existing pending payment: ${payment.receipt_number}`);
      } else {
        // Create new payment record if no pending payment exists
        payment = await this.prisma.payment.create({
          data: {
            company_id: user.company_id,
            tenant_id: tenantId,
            unit_id: tenantProfile.current_unit_id,
            property_id: propertyId || tenantProfile.current_property_id,
            amount: amountKES,
            currency: transaction.currency || 'KES',
            payment_method: 'online',
            payment_type: 'rent',
            status: 'completed',
            payment_date: new Date(),
            payment_period: paymentPeriod,
            receipt_number: `RNT-${Date.now()}-${reference.substring(0, 6).toUpperCase()}`,
            transaction_id: transaction.id.toString(), // Convert to string
            reference_number: transaction.reference,
            notes: `Online rent payment via Paystack - ${paymentPeriod}. Service fee included in total.`,
            processed_by: user.user_id,
            processed_at: new Date(),
            received_from: `${tenantProfile.user.first_name} ${tenantProfile.user.last_name}`,
            created_by: user.user_id,
          },
        });
        console.log(`✅ Created new payment record: ${payment.receipt_number}`);
      }

      console.log(`✅ Rent payment verified and recorded: ${payment.receipt_number} - Amount: KES ${amountKES}`);

      return {
        payment,
        transaction: {
          reference: transaction.reference,
          amount: amountKES,
          status: transaction.status,
          paid_at: transaction.paid_at,
          channel: transaction.channel,
          subaccount: transaction.subaccount,
        },
      };
    } catch (error: any) {
      console.error('❌ Rent payment verification error:', error.message);
      throw new Error(error.message || 'Failed to verify rent payment');
    }
  }

  /**
   * Get landlord's Paystack subaccount code
   */
  async getLandlordSubaccount(companyId: string): Promise<string | null> {
    try {
      // TODO: Implement subaccount retrieval from database
      // For now, return null (payments will go directly to platform account)
      return null;
    } catch (error: any) {
      console.error('Error getting landlord subaccount:', error.message);
      return null;
    }
  }

  /**
   * Process advance payment for multiple months
   * Creates a payment record and updates tenant's account balance
   */
  async processAdvancePayment(
    reference: string,
    user: JWTClaims
  ): Promise<any> {
    try {
      console.log(`🔍 Verifying advance payment: ${reference}`);

      // Verify transaction with Paystack
      console.log(`📡 Calling Paystack API: GET /transaction/verify/${reference}`);
      console.log(`🔑 Using rent credentials: ${this.rentConfig.publicKey.substring(0, 20)}...`);
      
      const response = await this.makeRequest(
        'GET',
        `/transaction/verify/${reference}`,
        undefined,
        true // Use rent credentials
      );

      console.log('📦 Paystack response structure:', {
        hasData: !!response.data,
        hasStatus: !!response.status,
        status: response.status,
        dataKeys: response.data ? Object.keys(response.data) : 'NO DATA',
        fullResponse: JSON.stringify(response, null, 2)
      });

      if (!response || !response.status) {
        console.error('❌ Invalid Paystack response structure:', response);
        throw new Error('Invalid response from Paystack');
      }

      if (!response.status) {
        console.error('❌ Transaction not successful. Status:', response.status);
        throw new Error('Transaction not successful');
      }

      const transaction = response.data;  // Axios already unwraps the outer 'data'
      
      if (!transaction) {
        console.error('❌ No transaction data in response. Response:', response);
        throw new Error('Transaction data not found in Paystack response');
      }

      console.log('✅ Transaction data found:', {
        id: transaction.id,
        hasAmount: !!transaction.amount,
        amount: transaction.amount,
        hasMetadata: !!transaction.metadata,
        metadataKeys: transaction.metadata ? Object.keys(transaction.metadata) : 'NO METADATA'
      });

      const amountKobo = transaction.amount;
      
      if (!amountKobo || amountKobo === 0) {
        console.error('❌ Invalid transaction amount:', amountKobo);
        throw new Error('Invalid transaction amount');
      }

      const amountKES = amountKobo / 100;

      // Get metadata from transaction
      const metadata = transaction.metadata || {};
      const months = metadata.months || 1;
      const rentPerMonth = metadata.rent_per_month || 0;
      const monthsList = metadata.months_list || '';
      const paymentPeriod = metadata.payment_period || `Advance Payment - ${months} months`;

      console.log(`💰 Advance payment: ${months} months × KES ${rentPerMonth} = KES ${amountKES}`);
      console.log(`📅 Payment period: ${paymentPeriod}`);
      console.log(`📋 Months covered: ${monthsList}`);

      // Get tenant profile with relations
      const tenantProfile = await this.prisma.tenantProfile.findUnique({
        where: { user_id: user.user_id },
        include: {
          user: true,
          current_property: true,
          current_unit: true,
        },
      });

      if (!tenantProfile) {
        throw new Error('Tenant profile not found');
      }

      // Create a payment record for the advance payment
      const payment = await this.prisma.payment.create({
        data: {
          company_id: tenantProfile.current_property?.company_id || user.company_id!,
          property_id: tenantProfile.current_property?.id,
          unit_id: tenantProfile.current_unit?.id,
          tenant_id: user.user_id,
          amount: amountKES,
          payment_method: 'online',
          payment_type: 'rent',
          payment_date: new Date().toISOString(),
          payment_period: paymentPeriod, // Use the period from metadata
          transaction_id: transaction.id.toString(), // Convert to string
          reference_number: transaction.reference,
          receipt_number: `ADV-${Date.now()}-${transaction.reference.substring(0, 6).toUpperCase()}`,
          received_from: `${tenantProfile.user.first_name} ${tenantProfile.user.last_name}`,
          status: 'completed',
          notes: `Advance payment for ${months} months${monthsList ? ` (${monthsList})` : ''}. Total amount credited to account balance.`,
          created_by: user.user_id,
        },
        include: {
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
            },
          },
        },
      });

      // 📧 SEND EMAIL RECEIPT TO TENANT FOR ADVANCE PAYMENT
      try {
        if (tenantProfile.user.email) {
          const { emailService } = await import('./email.service.js');
          
          // Format payment date
          const paymentDate = new Date().toISOString().split('T')[0];
          
          await emailService.sendPaymentReceipt({
            to: tenantProfile.user.email,
            tenant_name: `${tenantProfile.user.first_name} ${tenantProfile.user.last_name}`,
            payment_amount: amountKES,
            payment_date: paymentDate,
            payment_method: 'online',
            receipt_number: payment.receipt_number,
            reference_number: transaction.reference,
            transaction_id: transaction.id.toString(),
            property_name: tenantProfile.current_property?.name || 'Your Property',
            unit_number: tenantProfile.current_unit?.unit_number || 'Your Unit',
            payment_period: `Advance Payment - ${months} Month${months > 1 ? 's' : ''}${monthsList ? ` (${monthsList})` : ''}`,
          });

          // Mark receipt as sent
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { receipt_sent: true },
          });

          console.log(`📧 Advance payment receipt emailed to tenant: ${tenantProfile.user.email}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send advance payment receipt email:', emailError);
        // Don't fail the payment if email fails
      }

      // 🔔 SEND IN-APP NOTIFICATION TO TENANT
      try {
        const { notificationsService } = await import('./notifications.service.js');
        await notificationsService.createNotification(user, {
          user_id: user.user_id,
          type: 'payment_receipt',
          category: 'payment',
          priority: 'high',
          title: '✅ Advance Payment Received',
          message: `Your advance payment of KES ${amountKES.toLocaleString()} for ${months} month${months > 1 ? 's' : ''} has been processed successfully. Amount credited to your account balance.`,
          action_required: false,
          action_url: `/tenant/payments/${payment.id}`,
          related_entity_type: 'payment',
          related_entity_id: payment.id,
        });

        console.log(`🔔 Advance payment notification sent to tenant: ${user.user_id}`);
      } catch (notificationError) {
        console.error('❌ Failed to send advance payment notification:', notificationError);
        // Don't fail the payment if notification fails
      }

      // Update tenant's account balance
      await this.prisma.tenantProfile.update({
        where: { user_id: user.user_id },
        data: {
          account_balance: {
            increment: amountKES,
          },
        },
      });

      console.log(`✅ Advance payment processed: ${payment.receipt_number} - Balance updated with KES ${amountKES}`);

      return {
        payment,
        balance_added: amountKES,
        months_covered: months,
        transaction: {
          reference: transaction.reference,
          amount: amountKES,
          status: transaction.status,
          paid_at: transaction.paid_at,
          channel: transaction.channel,
        },
      };
    } catch (error: any) {
      console.error('❌ Advance payment error:', error.message);
      throw new Error(error.message || 'Failed to process advance payment');
    }
  }
}
