import { getPrisma } from '../config/prisma.js';
import { getNextReceiptNumber } from '../utils/invoice-number-generator.js';
import { getChannelDisplay } from '../utils/format-payment-display.js';
import { JWTClaims } from '../types/index.js';

const prisma = getPrisma();

// UUID validation regex (supports standard UUID format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

function validateUUIDs(values: (string | null | undefined)[], fieldName: string): void {
  const invalid = values.filter(v => !isValidUUID(v));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid ${fieldName}: Expected valid UUID(s), but received invalid value(s): ${invalid.slice(0, 3).join(', ')}`
    );
  }
}

export interface TenantPaymentRequest {
  invoice_ids: string[];
  transaction_id?: string;
  reference_number?: string;
  payment_method?: 'online' | 'cash' | string;
  gateway_response?: any;
}

function mapInvoiceTypeToPaymentType(invoiceType: string | null | undefined): 'rent' | 'utility' | 'maintenance' | 'other' {
  if (!invoiceType) return 'other';
  if (invoiceType === 'monthly_rent' || invoiceType === 'rent') return 'rent';
  if (invoiceType === 'utility') return 'utility';
  if (invoiceType === 'maintenance') return 'maintenance';
  return 'other';
}

function buildPaymentPeriod(date: Date): string {
  return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
}

async function generateReceiptNumber(companyId: string, tx: any): Promise<string> {
  return getNextReceiptNumber(tx, companyId);
}

/**
 * Clean, single-responsibility payment processor used by both webhook and frontend callback.
 * - Verifies tenant + invoices
 * - Deletes PENDING placeholder payments
 * - Creates approved payment(s)
 * - Marks invoices as PAID atomically
 */
export async function processTenantOnlinePayment(
  user: JWTClaims,
  payload: TenantPaymentRequest
) {
  const { invoice_ids, transaction_id, reference_number, gateway_response } = payload;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    throw new Error('At least one invoice must be selected');
  }

  // Validate UUIDs before querying Prisma
  if (!isValidUUID(user.user_id)) {
    throw new Error(`Invalid user_id: Expected valid UUID, but received: ${user.user_id}`);
  }
  validateUUIDs(invoice_ids, 'invoice_ids');

  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoice_ids },
      issued_to: user.user_id,
      status: { in: ['draft', 'sent', 'overdue'] },
    },
    include: {
      property: true,
      unit: true,
    },
  });

  if (invoices.length === 0) {
    throw new Error('No payable invoices found');
  }

  const unauthorized = invoices.find((inv) => inv.issued_to !== user.user_id);
  if (unauthorized) {
    throw new Error('You are not authorized to pay some of these invoices');
  }

  const now = new Date();
  const paymentPeriod = buildPaymentPeriod(now);

  // Process in one transaction for complete atomicity
  const result = await prisma.$transaction(async (tx) => {
    const payments: any[] = [];
    for (const invoice of invoices) {
      const receiptNumber = await generateReceiptNumber(invoice.company_id, tx);
      const paymentData = {
        company_id: invoice.company_id,
        tenant_id: invoice.issued_to,
        unit_id: invoice.unit_id,
        property_id: invoice.property_id,
        invoice_id: invoice.id,
        amount: invoice.total_amount,
        currency: invoice.currency,
        payment_method: 'online' as any,
        payment_type: mapInvoiceTypeToPaymentType(invoice.invoice_type) as any,
        status: 'approved' as any,
        payment_date: now,
        payment_period: paymentPeriod,
        receipt_number: receiptNumber,
        transaction_id: transaction_id || reference_number || null,
        reference_number: reference_number || transaction_id || null,
        received_from: 'Tenant Portal',
        created_by: user.user_id,
        attachments: [
          {
            gateway: 'paystack',
            transaction_id,
            reference_number,
            gateway_response: gateway_response || null,
            channel: gateway_response?.data?.channel || gateway_response?.channel || null,
            channel_display: getChannelDisplay(
              gateway_response?.data?.channel || gateway_response?.channel,
              gateway_response?.data?.authorization || gateway_response?.authorization
            ),
          },
        ] as any,
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
      await tx.payment.deleteMany({
        where: {
          invoice_id: invoice.id,
          status: 'pending',
          id: { not: payment.id },
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paid_date: now,
          payment_method: 'online',
          payment_reference: reference_number || transaction_id || payment.receipt_number,
        },
      });

      payments.push({
        payment_id: payment.id,
        invoice_id: invoice.id,
        issuer_id: invoice.issued_by,
        invoice_number: invoice.invoice_number,
        receipt_number: payment.receipt_number,
        amount: Number(payment.amount),
        currency: payment.currency || invoice.currency || 'KES',
      });
    }

    return {
      invoices_paid: invoices.length,
      total_amount: invoices.reduce((s, inv) => s + Number(inv.total_amount), 0),
      receipts: payments,
    };
  });

  // Notify invoice issuer(s) (landlord/agency/agent) about received payment
  try {
    const { notificationsService } = await import('./notifications.service.js');
    for (const receipt of result.receipts || []) {
      if (!receipt.issuer_id) continue;
      await notificationsService.createNotification(user, {
        recipientId: receipt.issuer_id,
        type: 'payment_received',
        category: 'payment',
        priority: 'high',
        channels: ['app', 'push'],
        title: 'Payment received',
        message: `Tenant payment received for invoice ${receipt.invoice_number}. Receipt: ${receipt.receipt_number}`,
        action_url: `/landlord/invoices/${receipt.invoice_id}`,
        metadata: {
          payment_id: receipt.payment_id,
          invoice_id: receipt.invoice_id,
          receipt_number: receipt.receipt_number,
          amount: receipt.amount,
          currency: receipt.currency,
        },
      });
    }
  } catch (error) {
    console.error('❌ Failed to send payment notifications to issuer:', error);
  }

  return result;
}


