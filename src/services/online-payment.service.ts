import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

const prisma = getPrisma();

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

function generateReceiptNumber(now: Date): string {
  return `PAY-${now.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;
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
      // Remove placeholder pending payments for this invoice created at invoice generation time
      await tx.payment.deleteMany({
        where: {
          invoice_id: invoice.id,
          status: 'pending',
          receipt_number: { startsWith: 'PENDING-' },
        },
      });

      const receiptNumber = generateReceiptNumber(now);

      const payment = await tx.payment.create({
        data: {
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
          // store gateway info in attachments json column to avoid unknown field errors
          attachments: [
            {
              gateway: 'paystack',
              transaction_id,
              reference_number,
              gateway_response: gateway_response || null,
            },
          ] as any,
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
        invoice_number: invoice.invoice_number,
        receipt_number: payment.receipt_number,
        amount: Number(payment.amount),
      });
    }

    return {
      invoices_paid: invoices.length,
      total_amount: invoices.reduce((s, inv) => s + Number(inv.total_amount), 0),
      receipts: payments,
    };
  });

  return result;
}


