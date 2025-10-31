import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
/**
 * Paystack Webhook Handler
 * This endpoint is called directly by Paystack when a payment succeeds
 * It processes the payment WITHOUT relying on the frontend
 */
export const handlePaystackWebhook = async (req, res) => {
    try {
        console.log('🔔 Paystack webhook received:', {
            timestamp: new Date().toISOString(),
            event: req.body.event,
            reference: req.body.data?.reference
        });
        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
            .update(JSON.stringify(req.body))
            .digest('hex');
        if (hash !== req.headers['x-paystack-signature']) {
            console.error('❌ Invalid webhook signature');
            return res.status(401).json({
                success: false,
                message: 'Invalid signature'
            });
        }
        const { event, data } = req.body;
        // Only process successful charge events
        if (event !== 'charge.success') {
            console.log(`ℹ️  Ignoring event: ${event}`);
            return res.status(200).json({ success: true, message: 'Event ignored' });
        }
        const { reference, amount, // Amount in kobo (Paystack)
        currency, customer, metadata } = data;
        console.log('💰 Processing successful payment:', {
            reference,
            amount: amount / 100, // Convert kobo to KES
            currency,
            customer_email: customer?.email,
            metadata
        });
        // Extract invoice IDs from metadata
        const invoiceIds = metadata?.invoice_ids || [];
        if (!invoiceIds || invoiceIds.length === 0) {
            console.error('❌ No invoice IDs in metadata');
            return res.status(400).json({
                success: false,
                message: 'No invoice IDs found in payment metadata'
            });
        }
        // Check if payment already processed
        const existingPayment = await prisma.payment.findFirst({
            where: {
                OR: [
                    { transaction_id: reference },
                    { reference_number: reference }
                ]
            }
        });
        if (existingPayment) {
            console.log('⚠️  Payment already processed:', existingPayment.receipt_number);
            return res.status(200).json({
                success: true,
                message: 'Payment already processed',
                payment_id: existingPayment.id
            });
        }
        // Get invoices
        const invoices = await prisma.invoice.findMany({
            where: {
                id: { in: invoiceIds },
                status: { in: ['sent', 'overdue', 'draft'] }
            },
            include: {
                property: true,
                unit: true
            }
        });
        if (invoices.length === 0) {
            console.error('❌ No unpaid invoices found');
            return res.status(404).json({
                success: false,
                message: 'No unpaid invoices found'
            });
        }
        const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const amountPaid = amount / 100; // Convert kobo to KES
        console.log(`💵 Amount verification:`, {
            expected: totalAmount,
            received: amountPaid,
            match: Math.abs(totalAmount - amountPaid) < 1 // Allow 1 KES difference for rounding
        });
        // Process payment in transaction
        const result = await prisma.$transaction(async (tx) => {
            const now = new Date();
            const payments = [];
            const updatedInvoices = [];
            for (const invoice of invoices) {
                // Generate receipt number
                const receiptNumber = `PAY-${now.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                // Delete any PENDING payment records for this invoice
                const deletedPending = await tx.payment.deleteMany({
                    where: {
                        invoice_id: invoice.id,
                        status: 'pending',
                        receipt_number: { startsWith: 'PENDING-' }
                    }
                });
                if (deletedPending.count > 0) {
                    console.log(`🗑️  Deleted ${deletedPending.count} PENDING payment record(s) for invoice ${invoice.invoice_number}`);
                }
                // Create payment record
                const payment = await tx.payment.create({
                    data: {
                        tenant_id: invoice.issued_to,
                        property_id: invoice.property_id,
                        unit_id: invoice.unit_id,
                        invoice_id: invoice.id,
                        company_id: invoice.company_id,
                        created_by: invoice.issued_to,
                        amount: invoice.total_amount,
                        currency: invoice.currency,
                        payment_method: 'online',
                        payment_type: 'rent',
                        payment_date: now,
                        payment_period: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
                        status: 'approved',
                        receipt_number: receiptNumber,
                        transaction_id: reference,
                        reference_number: reference,
                        received_from: `Paystack Payment - ${customer?.email || 'Tenant'}`,
                        receipt_sent: false,
                        notification_sent: false,
                        notes: 'Automatically processed via Paystack webhook',
                        attachments: JSON.stringify([{
                                gateway: 'paystack',
                                reference: reference,
                                status: 'success',
                                processed_via: 'webhook',
                                timestamp: now.toISOString()
                            }])
                    }
                });
                payments.push(payment);
                // Mark invoice as paid
                const updatedInvoice = await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        status: 'paid',
                        paid_date: now,
                        payment_method: 'online',
                        payment_reference: reference
                    }
                });
                updatedInvoices.push(updatedInvoice);
                console.log(`✅ Invoice ${invoice.invoice_number} marked as PAID - Amount: ${invoice.total_amount}, Receipt: ${receiptNumber}`);
            }
            return { payments, updatedInvoices };
        });
        console.log(`💰 Payment Summary:`, {
            reference,
            invoices_paid: result.payments.length,
            total_amount: totalAmount,
            payment_method: 'online',
            receipts: result.payments.map(p => p.receipt_number)
        });
        // Send email receipt (async, don't wait)
        if (result.payments.length > 0 && customer?.email) {
            try {
                const { emailService } = await import('../services/email.service.js');
                const firstPayment = result.payments[0];
                const firstInvoice = invoices[0]; // Use original invoices array which has includes
                await emailService.sendPaymentReceipt({
                    to: customer.email,
                    tenant_name: customer.email,
                    payment_amount: totalAmount,
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'online',
                    receipt_number: firstPayment.receipt_number,
                    property_name: firstInvoice.property?.name || 'Your Property',
                    unit_number: firstInvoice.unit?.unit_number || 'Your Unit',
                });
                console.log(`📧 Payment receipt emailed to: ${customer.email}`);
            }
            catch (emailError) {
                console.error('❌ Failed to send email receipt:', emailError);
            }
        }
        // Send in-app notification (async, don't wait)
        if (result.payments.length > 0 && invoices[0].issued_to) {
            try {
                const { notificationsService } = await import('../services/notifications.service.js');
                const firstPayment = result.payments[0];
                // Get tenant's company_id for notification context
                const tenant = await prisma.user.findUnique({
                    where: { id: invoices[0].issued_to },
                    select: { company_id: true }
                });
                if (tenant) {
                    await notificationsService.createNotification({ user_id: invoices[0].issued_to, company_id: tenant.company_id, role: 'tenant' }, {
                        user_id: invoices[0].issued_to,
                        type: 'payment_receipt',
                        title: 'Payment Successful - Receipt Generated',
                        message: `Your online payment of KSh ${totalAmount.toLocaleString()} has been processed. Receipt: ${firstPayment.receipt_number}`,
                        data: {
                            payment_id: firstPayment.id,
                            amount: firstPayment.amount,
                            receipt_number: firstPayment.receipt_number,
                            payment_date: firstPayment.payment_date,
                            payment_method: 'online',
                            invoices_paid: result.payments.length
                        },
                    });
                    console.log(`🔔 In-app notification sent to tenant: ${invoices[0].issued_to}`);
                }
            }
            catch (notificationError) {
                console.error('❌ Failed to send in-app notification:', notificationError);
            }
        }
        return res.status(200).json({
            success: true,
            message: 'Payment processed successfully',
            data: {
                reference,
                invoices_paid: result.payments.length,
                total_amount: totalAmount,
                receipts: result.payments.map(p => ({
                    invoice_number: result.updatedInvoices.find(inv => inv.id === p.invoice_id)?.invoice_number,
                    receipt_number: p.receipt_number,
                    amount: p.amount
                }))
            }
        });
    }
    catch (error) {
        console.error('❌ Error in Paystack webhook:', {
            message: error.message,
            stack: error.stack,
            error
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to process webhook',
            error: error.message
        });
    }
};
