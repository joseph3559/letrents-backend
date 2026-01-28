import { PaymentsService } from '../services/payments.service.js';
import { PaystackService } from '../services/paystack.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { getPrisma } from '../config/prisma.js';
const service = new PaymentsService();
const paystackService = new PaystackService();
const prisma = getPrisma();
export const listPayments = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, ...filters } = req.query;
        const result = await service.listPayments(filters, user, Number(page), Number(limit));
        writeSuccess(res, 200, 'Payments retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve payments';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const getPayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Payment ID is required');
        }
        const payment = await service.getPayment(id, user);
        writeSuccess(res, 200, 'Payment retrieved successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const createPayment = async (req, res) => {
    try {
        const user = req.user;
        const paymentData = req.body;
        // Validate required fields
        if (!paymentData.tenant_id || !paymentData.amount || !paymentData.payment_method || !paymentData.payment_type) {
            return writeError(res, 400, 'Tenant ID, amount, payment method, and payment type are required');
        }
        const payment = await service.createPayment(paymentData, user);
        writeSuccess(res, 201, 'Payment created successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to create payment';
        const status = message.includes('permissions') ? 403 :
            message.includes('not found') ? 404 : 500;
        writeError(res, status, message);
    }
};
export const updatePayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            return writeError(res, 400, 'Payment ID is required');
        }
        const payment = await service.updatePayment(id, updateData, user);
        writeSuccess(res, 200, 'Payment updated successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to update payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const approvePayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { approval_notes } = req.body;
        if (!id) {
            return writeError(res, 400, 'Payment ID is required');
        }
        const payment = await service.approvePayment(id, { approval_notes }, user);
        writeSuccess(res, 200, 'Payment approved successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to approve payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('only pending') ? 400 : 500;
        writeError(res, status, message);
    }
};
/**
 * Reconcile pending payments by reference/tenant (one-time fix)
 */
export const reconcilePendingPayments = async (req, res) => {
    try {
        const user = req.user;
        const { references, tenant_id, include_all_pending } = req.body || {};
        const result = await service.reconcilePendingPayments({
            references,
            tenant_id,
            include_all_pending,
        }, user);
        writeSuccess(res, 200, 'Pending payments reconciled successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to reconcile pending payments';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const deletePayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Payment ID is required');
        }
        await service.deletePayment(id, user);
        writeSuccess(res, 200, 'Payment deleted successfully', null);
    }
    catch (error) {
        const message = error.message || 'Failed to delete payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('cannot delete') ? 400 : 500;
        writeError(res, status, message);
    }
};
// Tenant-specific payment endpoints
export const getTenantPayments = async (req, res) => {
    try {
        const user = req.user;
        const { id: tenantId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        if (!tenantId) {
            return writeError(res, 400, 'Tenant ID is required');
        }
        const filters = { tenant_id: tenantId };
        const result = await service.listPayments(filters, user, Number(page), Number(limit));
        writeSuccess(res, 200, 'Tenant payments retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to retrieve tenant payments';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const createTenantPayment = async (req, res) => {
    try {
        const user = req.user;
        const { id: tenantId } = req.params;
        const paymentData = { ...req.body, tenant_id: tenantId };
        if (!tenantId) {
            return writeError(res, 400, 'Tenant ID is required');
        }
        // Validate required fields
        if (!paymentData.amount || !paymentData.payment_method || !paymentData.payment_type) {
            return writeError(res, 400, 'Amount, payment method, and payment type are required');
        }
        const payment = await service.createPayment(paymentData, user);
        writeSuccess(res, 201, 'Tenant payment created successfully', payment);
    }
    catch (error) {
        const message = error.message || 'Failed to create tenant payment';
        const status = message.includes('permissions') ? 403 :
            message.includes('not found') ? 404 : 500;
        writeError(res, status, message);
    }
};
export const sendPaymentReceipt = async (req, res) => {
    try {
        const user = req.user;
        const { id: paymentId } = req.params;
        const { tenant_id, tenant_email, tenant_name, send_email = true, send_in_app = true } = req.body;
        if (!paymentId) {
            return writeError(res, 400, 'Payment ID is required');
        }
        // Get the payment details
        const payment = await service.getPayment(paymentId, user);
        if (!payment) {
            return writeError(res, 404, 'Payment not found');
        }
        // Send email receipt if requested
        if (send_email && tenant_email) {
            const { emailService } = await import('../services/email.service.js');
            await emailService.sendPaymentReceipt({
                to: tenant_email,
                tenant_name: tenant_name || 'Valued Tenant',
                payment_amount: Number(payment.amount),
                payment_date: payment.payment_date.toISOString().split('T')[0],
                payment_method: payment.payment_method,
                receipt_number: payment.receipt_number || `RCP-${payment.id.substring(0, 8)}`,
                property_name: payment.property?.name || 'Your Property',
                unit_number: payment.unit?.unit_number || 'Your Unit',
            });
        }
        // Send in-app notification if requested
        if (send_in_app && tenant_id) {
            const { notificationsService } = await import('../services/notifications.service.js');
            await notificationsService.createNotification(user, {
                user_id: tenant_id,
                type: 'payment_receipt',
                title: 'Payment Receipt',
                message: `Receipt for your payment of KSh ${Number(payment.amount).toLocaleString()} has been generated.`,
                data: {
                    payment_id: payment.id,
                    amount: payment.amount,
                    receipt_number: payment.receipt_number,
                    payment_date: payment.payment_date,
                },
            });
        }
        writeSuccess(res, 200, 'Receipt sent successfully', { sent: true });
    }
    catch (error) {
        console.error('Error sending payment receipt:', error);
        const message = error.message || 'Failed to send payment receipt';
        writeError(res, 500, message);
    }
};
/**
 * Verify rent payment with Paystack
 */
export const verifyRentPayment = async (req, res) => {
    try {
        const user = req.user;
        const { reference } = req.body;
        if (!reference) {
            return writeError(res, 400, 'Payment reference is required');
        }
        const result = await paystackService.verifyRentPayment(reference, user);
        writeSuccess(res, 200, 'Payment verified successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to verify rent payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
/**
 * Cleanup or manually update a pending payment
 */
export const updatePendingPayment = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { action } = req.body; // 'complete', 'cancel', or 'delete'
        if (!id) {
            return writeError(res, 400, 'Payment ID is required');
        }
        if (!action || !['complete', 'cancel', 'delete'].includes(action)) {
            return writeError(res, 400, 'Valid action is required: complete, cancel, or delete');
        }
        const payment = await service.getPayment(id, user);
        if (!payment) {
            return writeError(res, 404, 'Payment not found');
        }
        if (payment.status !== 'pending') {
            return writeError(res, 400, 'Only pending payments can be updated');
        }
        let updatedPayment;
        if (action === 'delete') {
            await service.deletePayment(id, user);
            return writeSuccess(res, 200, 'Pending payment deleted successfully', { id });
        }
        else if (action === 'complete') {
            updatedPayment = await service.updatePayment(id, {
                status: 'completed',
                payment_date: new Date().toISOString(),
                processed_by: user.user_id,
                processed_at: new Date().toISOString(),
                notes: payment.notes ? `${payment.notes} - Manually marked as completed` : 'Manually marked as completed',
            }, user);
        }
        else if (action === 'cancel') {
            updatedPayment = await service.updatePayment(id, {
                status: 'cancelled',
                notes: payment.notes ? `${payment.notes} - Cancelled` : 'Cancelled',
            }, user);
        }
        writeSuccess(res, 200, `Payment ${action}d successfully`, updatedPayment);
    }
    catch (error) {
        const message = error.message || 'Failed to update payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
/**
 * Verify advance payment with Paystack
 */
export const verifyAdvancePayment = async (req, res) => {
    try {
        const user = req.user;
        const { reference } = req.body;
        if (!reference) {
            return writeError(res, 400, 'Payment reference is required');
        }
        const result = await paystackService.processAdvancePayment(reference, user);
        writeSuccess(res, 200, 'Advance payment verified and processed successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to verify advance payment';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
/**
 * Get current company's Paystack subaccount (for landlord/agency).
 */
export const getCompanySubaccount = async (req, res) => {
    try {
        const user = req.user;
        if (!user?.company_id)
            return writeError(res, 400, 'User must belong to a company');
        if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
            return writeError(res, 403, 'Only landlords/agencies can view subaccount settings');
        }
        const company = await prisma.company.findUnique({
            where: { id: user.company_id },
            select: {
                id: true,
                name: true,
                paystack_subaccount_code: true,
                paystack_settlement_bank: true,
                paystack_account_number: true,
                paystack_account_name: true,
                paystack_subaccount_status: true,
                paystack_subaccount_metadata: true,
                paystack_subaccount_updated_at: true,
            },
        });
        if (!company)
            return writeError(res, 404, 'Company not found');
        writeSuccess(res, 200, 'Subaccount retrieved successfully', company);
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to retrieve subaccount');
    }
};
/**
 * Create or update the company's Paystack subaccount (for landlord/agency).
 * Creates on Paystack and stores subaccount_code + settlement info on Company.
 */
export const upsertCompanySubaccount = async (req, res) => {
    try {
        const user = req.user;
        if (!user?.company_id)
            return writeError(res, 400, 'User must belong to a company');
        if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
            return writeError(res, 403, 'Only landlords/agencies can configure subaccounts');
        }
        const { business_name, settlement_bank, account_number, percentage_charge = 2.5, description, primary_contact_email, primary_contact_name, primary_contact_phone, metadata, } = req.body || {};
        if (!business_name || !settlement_bank || !account_number) {
            return writeError(res, 400, 'business_name, settlement_bank, and account_number are required');
        }
        // Load current company
        const company = await prisma.company.findUnique({
            where: { id: user.company_id },
            select: { id: true, name: true, paystack_subaccount_code: true },
        });
        if (!company)
            return writeError(res, 404, 'Company not found');
        const payload = {
            business_name,
            settlement_bank,
            account_number,
            percentage_charge: Number(percentage_charge),
            description: description || `Subaccount for ${business_name}`,
            primary_contact_email,
            primary_contact_name,
            primary_contact_phone,
            metadata: {
                ...(metadata || {}),
                company_id: company.id,
                company_name: company.name,
                configured_by: user.user_id,
            },
        };
        let paystackResult;
        if (company.paystack_subaccount_code) {
            paystackResult = await paystackService.updateSubaccount(company.paystack_subaccount_code, payload);
        }
        else {
            paystackResult = await paystackService.createSubaccount(payload);
        }
        if (!paystackResult?.status || !paystackResult?.data?.subaccount_code) {
            return writeError(res, 400, paystackResult?.message || 'Failed to create/update Paystack subaccount');
        }
        const sub = paystackResult.data;
        const status = sub.active ? 'active' : 'pending';
        const updated = await prisma.company.update({
            where: { id: company.id },
            data: {
                paystack_subaccount_code: sub.subaccount_code,
                paystack_settlement_bank: sub.settlement_bank || settlement_bank,
                paystack_account_number: sub.account_number || account_number,
                paystack_account_name: sub.business_name || business_name,
                paystack_subaccount_status: status,
                paystack_subaccount_metadata: {
                    ...(paystackResult || {}),
                    // Store form fields for retrieval
                    percentage_charge: Number(percentage_charge) || 2.5,
                    primary_contact_email: primary_contact_email || '',
                    primary_contact_name: primary_contact_name || '',
                    primary_contact_phone: primary_contact_phone || '',
                    business_name: business_name,
                    settlement_bank: settlement_bank,
                    account_number: account_number,
                },
                paystack_subaccount_updated_at: new Date(),
                updated_at: new Date(),
            },
            select: {
                id: true,
                name: true,
                paystack_subaccount_code: true,
                paystack_settlement_bank: true,
                paystack_account_number: true,
                paystack_account_name: true,
                paystack_subaccount_status: true,
                paystack_subaccount_metadata: true,
                paystack_subaccount_updated_at: true,
            },
        });
        writeSuccess(res, 200, 'Subaccount saved successfully', { company: updated, paystack: sub });
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to save subaccount');
    }
};
/**
 * Resolve account number (Paystack /bank/resolve) for subaccount setup.
 */
export const resolvePaystackAccount = async (req, res) => {
    try {
        const user = req.user;
        if (!['landlord', 'agency_admin', 'super_admin'].includes(user.role)) {
            return writeError(res, 403, 'Only landlords/agencies can resolve bank accounts');
        }
        const account_number = String(req.query.account_number || '');
        const bank_code = String(req.query.bank_code || '');
        if (!account_number || !bank_code)
            return writeError(res, 400, 'account_number and bank_code are required');
        const result = await paystackService.resolveBankAccount(account_number, bank_code);
        writeSuccess(res, 200, 'Account resolved successfully', result?.data || result);
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to resolve account');
    }
};
/**
 * Tenant-facing: fetch routing context for a rent payment (subaccount + transaction_charge).
 * Used to ensure tenant payments settle directly into landlord subaccount with platform commission.
 */
export const getRentRoutingContext = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'tenant')
            return writeError(res, 403, 'Tenant role required');
        const { invoice_ids } = req.body || {};
        if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
            return writeError(res, 400, 'invoice_ids is required');
        }
        const invoices = await prisma.invoice.findMany({
            where: { id: { in: invoice_ids }, issued_to: user.user_id },
            select: { id: true, company_id: true, total_amount: true, unit: { select: { unit_number: true } } },
        });
        if (invoices.length === 0)
            return writeError(res, 404, 'No invoices found for tenant');
        const companyIds = Array.from(new Set(invoices.map((i) => i.company_id)));
        if (companyIds.length !== 1)
            return writeError(res, 400, 'Invoices must belong to a single landlord/company');
        const companyId = companyIds[0];
        const subaccountCode = await paystackService.getLandlordSubaccount(companyId);
        if (!subaccountCode) {
            return writeError(res, 409, 'This landlord has not configured a Paystack receiving account yet. Please ask them to complete Subaccount Setup in Settings.');
        }
        const rentAmountKES = invoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
        const commissionKES = Math.ceil(rentAmountKES * 0.025); // 2.5% commission (rounded up)
        writeSuccess(res, 200, 'Rent routing context retrieved', {
            company_id: companyId,
            subaccount: subaccountCode,
            rent_amount_kes: rentAmountKES,
            commission_kes: commissionKES,
            total_amount_kes: rentAmountKES + commissionKES,
            transaction_charge_kobo: commissionKES * 100,
            bearer: 'account',
        });
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to get routing context');
    }
};
