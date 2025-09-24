import { getPrisma } from '../config/prisma.js';
import axios from 'axios';
import { buildWhereClause } from '../utils/roleBasedFiltering.js';
export class MpesaService {
    prisma = getPrisma();
    baseURL = 'https://sandbox.safaricom.co.ke'; // Use production URL for live
    accessTokenCache = null;
    /**
     * Get OAuth access token from Safaricom
     */
    async getAccessToken(credentials) {
        // Check cache first
        if (this.accessTokenCache && Date.now() < this.accessTokenCache.expires) {
            return this.accessTokenCache.token;
        }
        try {
            const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');
            const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                },
            });
            const { access_token, expires_in } = response.data;
            // Cache the token (expires_in is in seconds)
            this.accessTokenCache = {
                token: access_token,
                expires: Date.now() + (expires_in * 1000) - 60000, // Subtract 1 minute for safety
            };
            return access_token;
        }
        catch (error) {
            console.error('Error getting M-Pesa access token:', error.response?.data || error.message);
            throw new Error('Failed to get M-Pesa access token');
        }
    }
    /**
     * Register C2B URLs with Safaricom
     */
    async registerC2BURL(credentials, request) {
        try {
            const accessToken = await this.getAccessToken(credentials);
            const response = await axios.post(`${this.baseURL}/mpesa/c2b/v1/registerurl`, {
                ShortCode: request.shortCode,
                ResponseType: request.responseType,
                ConfirmationURL: request.confirmationURL,
                ValidationURL: request.validationURL,
            }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error registering C2B URLs:', error.response?.data || error.message);
            throw new Error('Failed to register C2B URLs');
        }
    }
    /**
     * Create or update paybill settings for a company
     */
    async createPaybillSettings(request, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to manage paybill settings');
        }
        // Encrypt credentials (in production, use proper encryption)
        const encryptedConsumerKey = Buffer.from(request.consumerKey).toString('base64');
        const encryptedConsumerSecret = Buffer.from(request.consumerSecret).toString('base64');
        // Set default URLs if not provided
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:8080';
        const validationUrl = request.validationUrl || `${baseUrl}/api/v1/mpesa/c2b/validation`;
        const confirmationUrl = request.confirmationUrl || `${baseUrl}/api/v1/mpesa/c2b/confirmation`;
        try {
            // Test credentials by getting access token
            await this.getAccessToken({
                consumerKey: request.consumerKey,
                consumerSecret: request.consumerSecret,
            });
            // Register C2B URLs with Safaricom
            await this.registerC2BURL({
                consumerKey: request.consumerKey,
                consumerSecret: request.consumerSecret,
            }, {
                shortCode: request.businessShortcode,
                responseType: 'Completed',
                confirmationURL: confirmationUrl,
                validationURL: validationUrl,
            });
            // Save to database
            const paybillSettings = await this.prisma.paybillSettings.upsert({
                where: { company_id: user.company_id },
                update: {
                    paybill_number: request.paybillNumber,
                    business_shortcode: request.businessShortcode,
                    consumer_key: encryptedConsumerKey,
                    consumer_secret: encryptedConsumerSecret,
                    validation_url: validationUrl,
                    confirmation_url: confirmationUrl,
                    is_active: request.isActive ?? true,
                    auto_reconcile: request.autoReconcile ?? true,
                    updated_at: new Date(),
                },
                create: {
                    company_id: user.company_id,
                    paybill_number: request.paybillNumber,
                    business_shortcode: request.businessShortcode,
                    consumer_key: encryptedConsumerKey,
                    consumer_secret: encryptedConsumerSecret,
                    validation_url: validationUrl,
                    confirmation_url: confirmationUrl,
                    is_active: request.isActive ?? true,
                    auto_reconcile: request.autoReconcile ?? true,
                    created_by: user.user_id,
                },
            });
            return {
                ...paybillSettings,
                consumer_key: '***', // Hide sensitive data
                consumer_secret: '***',
            };
        }
        catch (error) {
            console.error('Error creating paybill settings:', error);
            throw new Error('Failed to create paybill settings: ' + error.message);
        }
    }
    /**
     * Get paybill settings for a company
     */
    async getPaybillSettings(user) {
        if (!user.company_id) {
            throw new Error('user must belong to a company');
        }
        const settings = await this.prisma.paybillSettings.findUnique({
            where: { company_id: user.company_id },
            include: {
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        if (!settings) {
            return null;
        }
        // Hide sensitive data
        return {
            ...settings,
            consumer_key: '***',
            consumer_secret: '***',
        };
    }
    /**
     * Process C2B validation request
     */
    async validateC2BTransaction(data) {
        try {
            console.log('🔍 M-Pesa C2B Validation Request:', data);
            // Find paybill settings by business shortcode
            const paybillSettings = await this.prisma.paybillSettings.findFirst({
                where: {
                    business_shortcode: data.BusinessShortCode,
                    is_active: true,
                },
            });
            if (!paybillSettings) {
                console.log('❌ No paybill settings found for shortcode:', data.BusinessShortCode);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Invalid business shortcode',
                };
            }
            // Validate bill reference number (should be unit number)
            const unit = await this.prisma.unit.findFirst({
                where: {
                    unit_number: data.BillRefNumber,
                    company_id: paybillSettings.company_id,
                },
                include: {
                    current_tenant: true,
                    property: true,
                },
            });
            if (!unit) {
                console.log('❌ No unit found for bill reference:', data.BillRefNumber);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Invalid unit number',
                };
            }
            if (!unit.current_tenant) {
                console.log('❌ Unit has no current tenant:', data.BillRefNumber);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Unit is not occupied',
                };
            }
            // Validate amount (should be at least the rent amount)
            if (data.TransAmount < Number(unit.rent_amount)) {
                console.log('❌ Amount too low:', data.TransAmount, 'vs', unit.rent_amount);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Amount is less than rent amount',
                };
            }
            console.log('✅ M-Pesa transaction validated successfully');
            return {
                ResultCode: 0,
                ResultDesc: 'Success',
            };
        }
        catch (error) {
            console.error('Error validating C2B transaction:', error);
            return {
                ResultCode: 1,
                ResultDesc: 'Validation error',
            };
        }
    }
    /**
     * Process C2B confirmation request
     */
    async confirmC2BTransaction(data) {
        try {
            console.log('🔍 M-Pesa C2B Confirmation Request:', data);
            // Find paybill settings
            const paybillSettings = await this.prisma.paybillSettings.findFirst({
                where: {
                    business_shortcode: data.BusinessShortCode,
                    is_active: true,
                },
            });
            if (!paybillSettings) {
                console.log('❌ No paybill settings found for shortcode:', data.BusinessShortCode);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Invalid business shortcode',
                };
            }
            // Find unit and tenant
            const unit = await this.prisma.unit.findFirst({
                where: {
                    unit_number: data.BillRefNumber,
                    company_id: paybillSettings.company_id,
                },
                include: {
                    current_tenant: true,
                    property: true,
                },
            });
            if (!unit || !unit.current_tenant) {
                console.log('❌ Unit or tenant not found:', data.BillRefNumber);
                return {
                    ResultCode: 1,
                    ResultDesc: 'Unit or tenant not found',
                };
            }
            // Check if transaction already exists
            const existingTransaction = await this.prisma.mpesaTransaction.findUnique({
                where: { trans_id: data.TransID },
            });
            if (existingTransaction) {
                console.log('⚠️ Transaction already exists:', data.TransID);
                return {
                    ResultCode: 0,
                    ResultDesc: 'Transaction already processed',
                };
            }
            // Create M-Pesa transaction record
            const mpesaTransaction = await this.prisma.mpesaTransaction.create({
                data: {
                    company_id: paybillSettings.company_id,
                    paybill_settings_id: paybillSettings.id,
                    transaction_type: data.TransactionType,
                    trans_id: data.TransID,
                    trans_time: data.TransTime,
                    trans_amount: data.TransAmount,
                    msisdn: data.MSISDN,
                    bill_ref_number: data.BillRefNumber,
                    business_short_code: data.BusinessShortCode,
                    invoice_number: data.InvoiceNumber,
                    org_account_balance: data.OrgAccountBalance,
                    tenant_id: unit.current_tenant.id,
                    unit_id: unit.id,
                    property_id: unit.property_id,
                    status: 'confirmed',
                    raw_response: data,
                },
            });
            // Auto-reconcile if enabled
            if (paybillSettings.auto_reconcile) {
                await this.reconcileTransaction(mpesaTransaction.id);
            }
            console.log('✅ M-Pesa transaction confirmed successfully:', data.TransID);
            return {
                ResultCode: 0,
                ResultDesc: 'Success',
            };
        }
        catch (error) {
            console.error('Error confirming C2B transaction:', error);
            return {
                ResultCode: 1,
                ResultDesc: 'Confirmation error',
            };
        }
    }
    /**
     * Reconcile M-Pesa transaction with payment record
     */
    async reconcileTransaction(transactionId, user) {
        const transaction = await this.prisma.mpesaTransaction.findUnique({
            where: { id: transactionId },
            include: {
                tenant: true,
                unit: true,
                property: true,
                paybill_settings: true,
            },
        });
        if (!transaction) {
            throw new Error('M-Pesa transaction not found');
        }
        if (transaction.payment_id) {
            throw new Error('Transaction already reconciled');
        }
        // Create payment record
        const payment = await this.prisma.payment.create({
            data: {
                company_id: transaction.company_id,
                tenant_id: transaction.tenant_id,
                unit_id: transaction.unit_id,
                property_id: transaction.property_id,
                amount: transaction.trans_amount,
                currency: 'KES',
                payment_method: 'mpesa',
                payment_type: 'rent',
                status: 'approved',
                payment_date: new Date(),
                payment_period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                receipt_number: `MPESA-${transaction.trans_id}`,
                transaction_id: transaction.trans_id,
                reference_number: transaction.bill_ref_number,
                received_by: 'M-Pesa Paybill',
                received_from: `${transaction.msisdn} (M-Pesa)`,
                notes: `M-Pesa payment via paybill ${transaction.business_short_code}`,
                processed_by: user?.user_id,
                processed_at: new Date(),
                created_by: transaction.tenant_id,
            },
        });
        // Update M-Pesa transaction with payment link
        await this.prisma.mpesaTransaction.update({
            where: { id: transactionId },
            data: {
                payment_id: payment.id,
                status: 'reconciled',
                processed_at: new Date(),
            },
        });
        return payment;
    }
    /**
     * Get M-Pesa transactions for a company
     */
    async getTransactions(user, page = 1, limit = 10, filters = {}) {
        const skip = (page - 1) * limit;
        const whereClause = buildWhereClause(user, {}, 'mpesa');
        // Add filters
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.start_date || filters.end_date) {
            whereClause.created_at = {};
            if (filters.start_date) {
                whereClause.created_at.gte = new Date(filters.start_date);
            }
            if (filters.end_date) {
                whereClause.created_at.lte = new Date(filters.end_date);
            }
        }
        const [transactions, total] = await Promise.all([
            this.prisma.mpesaTransaction.findMany({
                where: whereClause,
                include: {
                    tenant: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            phone_number: true,
                        },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
                        },
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    payment: {
                        select: {
                            id: true,
                            receipt_number: true,
                            status: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.mpesaTransaction.count({ where: whereClause }),
        ]);
        return {
            transactions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    /**
     * Get M-Pesa transaction statistics
     */
    async getTransactionStats(user, period = 'monthly') {
        const whereClause = buildWhereClause(user, {}, 'mpesa');
        // Get date range based on period
        let startDate;
        const endDate = new Date();
        switch (period) {
            case 'daily':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'monthly':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'yearly':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
        }
        whereClause.created_at = {
            gte: startDate,
            lte: endDate,
        };
        const [totalTransactions, totalAmount, successfulTransactions, pendingTransactions] = await Promise.all([
            this.prisma.mpesaTransaction.count({ where: whereClause }),
            this.prisma.mpesaTransaction.aggregate({
                where: whereClause,
                _sum: { trans_amount: true },
            }),
            this.prisma.mpesaTransaction.count({
                where: { ...whereClause, status: 'reconciled' },
            }),
            this.prisma.mpesaTransaction.count({
                where: { ...whereClause, status: 'pending' },
            }),
        ]);
        return {
            period,
            total_transactions: totalTransactions,
            total_amount: totalAmount._sum.trans_amount || 0,
            successful_transactions: successfulTransactions,
            pending_transactions: pendingTransactions,
            success_rate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0,
        };
    }
}
