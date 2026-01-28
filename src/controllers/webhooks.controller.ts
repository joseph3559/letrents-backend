import { Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient, PaymentMethod, PaymentType, PaymentStatus } from '@prisma/client';
import { getNextReceiptNumber } from '../utils/invoice-number-generator.js';

const prisma = new PrismaClient();

/**
 * Get human-readable display name for payment channel
 */
function getChannelDisplayName(channel: string, authorization?: any): string {
  if (!channel) return 'Online Payment';
  
  const channelLower = channel.toLowerCase();
  
  // Map Paystack channels to display names
  const channelMap: { [key: string]: string } = {
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

/**
 * Paystack Webhook Handler
 * This endpoint is called directly by Paystack when a payment succeeds
 * It processes the payment WITHOUT relying on the frontend
 */
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    console.log('🔔 Paystack webhook received:', {
      timestamp: new Date().toISOString(),
      event: req.body.event,
      reference: req.body.data?.reference
    });

    // Verify webhook signature
    const secretKey =
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYSTACK_LIVE_SECRET_KEY ||
      process.env.PAYSTACK_TEST_SECRET_KEY ||
      '';
    if (!secretKey) {
      console.error('❌ Paystack secret key not configured');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    }

    const hash = crypto
      .createHmac('sha512', secretKey)
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

    const {
      reference,
      amount, // Amount in kobo (Paystack)
      currency,
      customer,
      metadata,
      channel, // Payment channel: card, bank, ussd, qr, mobile_money, etc.
      authorization // Authorization details with card_type, bank, etc.
    } = data;

    // Extract payment channel information
    const paymentChannel = channel || authorization?.channel || 'unknown';
    const channelDisplay = getChannelDisplayName(paymentChannel, authorization);

    console.log('💰 Processing successful payment:', {
      reference,
      amount: amount / 100, // Convert kobo to KES
      currency,
      customer_email: customer?.email,
      channel: paymentChannel,
      channel_display: channelDisplay,
      metadata
    });

    // Extract invoice IDs from metadata (preferred).
    // If missing, fallback to unit-number based reconciliation.
    let invoiceIds: string[] = Array.isArray(metadata?.invoice_ids)
      ? metadata.invoice_ids
      : Array.isArray(metadata?.invoiceIds)
        ? metadata.invoiceIds
        : [];

    if (!invoiceIds || invoiceIds.length === 0) {
      const tenantId = metadata?.tenant_id || metadata?.tenantId || null;
      const unitNumberRaw = metadata?.unit_number || metadata?.unitNumber || null;
      const unitNumber = typeof unitNumberRaw === 'string' ? unitNumberRaw.trim() : null;

      if (tenantId && unitNumber) {
        try {
          // Find unit by unit_number (scoped by tenant's company via invoice lookup)
          const candidateInvoices = await prisma.invoice.findMany({
            where: {
              issued_to: tenantId,
              status: { in: ['sent', 'overdue', 'draft'] },
            },
            include: { unit: true },
            orderBy: { created_at: 'asc' },
            take: 50,
          });

          const matches = candidateInvoices.filter((inv) => inv.unit?.unit_number?.trim() === unitNumber);
          if (matches.length > 0) {
            // Prefer oldest unpaid invoice for that unit (safe default)
            invoiceIds = [matches[0].id];
            console.warn('⚠️ invoice_ids missing; reconciled by unit_number fallback', {
              unitNumber,
              invoiceId: matches[0].id,
              invoiceNumber: (matches[0] as any).invoice_number,
            });
          }
        } catch (e) {
          console.error('❌ Unit-number reconciliation fallback failed:', e);
        }
      }

      if (!invoiceIds || invoiceIds.length === 0) {
        console.error('❌ No invoice IDs in metadata and no unit-number match found');
        return res.status(400).json({
          success: false,
          message: 'No invoice IDs found in payment metadata'
        });
      }
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
        const receiptNumber = await getNextReceiptNumber(tx, invoice.company_id);

        const paymentData = {
          tenant_id: invoice.issued_to,
          property_id: invoice.property_id,
          unit_id: invoice.unit_id,
          invoice_id: invoice.id,
          company_id: invoice.company_id,
          created_by: invoice.issued_to,
          amount: invoice.total_amount,
          currency: invoice.currency,
          payment_method: 'online' as PaymentMethod,
          payment_type: 'rent' as PaymentType,
          payment_date: now,
          payment_period: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
          status: 'approved' as PaymentStatus,
          receipt_number: receiptNumber,
          transaction_id: reference,
          reference_number: reference,
          received_from: `Paystack Payment - ${customer?.email || 'Tenant'}`,
          receipt_sent: false,
          notification_sent: false,
          notes: 'Automatically processed via Paystack webhook',
          attachments: [{
            gateway: 'paystack',
            reference: reference,
            status: 'success',
            processed_via: 'webhook',
            timestamp: now.toISOString(),
            channel: paymentChannel,
            channel_display: channelDisplay,
            authorization: authorization ? {
              card_type: authorization.card_type,
              bank: authorization.bank,
              brand: authorization.brand,
              last4: authorization.last4
            } : null
          }] as any
        };

        const existingPending = await tx.payment.findFirst({
          where: {
            invoice_id: invoice.id,
            status: 'pending',
          },
          orderBy: { created_at: 'desc' },
        });

        const payment = existingPending
          ? await tx.payment.update({
              where: { id: existingPending.id },
              data: paymentData,
            })
          : await tx.payment.create({
              data: paymentData,
            });

        // Clean up any other placeholder pending payments for this invoice
        const deletedPending = await tx.payment.deleteMany({
          where: {
            invoice_id: invoice.id,
            status: 'pending',
            id: { not: payment.id }
          }
        });

        if (deletedPending.count > 0) {
          console.log(`🗑️  Deleted ${deletedPending.count} extra pending payment record(s) for invoice ${invoice.invoice_number}`);
        }

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

    // Notify invoice issuer(s) about received payment
    try {
      const { notificationsService } = await import('../services/notifications.service.js');
      for (const invoice of invoices) {
        if (!invoice.issued_by) continue;
        const payment = result.payments.find((p: any) => p.invoice_id === invoice.id);
        if (!payment) continue;
        await notificationsService.createNotification(
          {
            user_id: invoice.issued_to,
            company_id: invoice.company_id,
            role: 'tenant',
          } as any,
          {
            recipientId: invoice.issued_by,
            type: 'payment_received',
            category: 'payment',
            priority: 'high',
            channels: ['app', 'push'],
            title: 'Payment received',
            message: `Tenant payment received for invoice ${invoice.invoice_number}. Receipt: ${payment.receipt_number}`,
            metadata: {
              payment_id: payment.id,
              invoice_id: invoice.id,
              receipt_number: payment.receipt_number,
              amount: payment.amount,
              currency: payment.currency,
              reference: reference,
            },
          }
        );
      }
    } catch (error) {
      console.error('❌ Failed to send issuer payment notification:', error);
    }

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
      } catch (emailError) {
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
          await notificationsService.createNotification(
            { user_id: invoices[0].issued_to, company_id: tenant.company_id, role: 'tenant' } as any,
            {
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
            }
          );
          console.log(`🔔 In-app notification sent to tenant: ${invoices[0].issued_to}`);
        }
      } catch (notificationError) {
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

  } catch (error: any) {
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

