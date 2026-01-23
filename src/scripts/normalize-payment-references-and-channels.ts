import { PrismaClient } from '@prisma/client';
import { getChannelDisplay } from '../utils/format-payment-display.js';

const prisma = new PrismaClient();

const formatYearMonth = (date: Date) => {
  const shortYear = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${shortYear}${month}`;
};

const formatYearMonthDay = (date: Date) => {
  const shortYear = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${shortYear}${month}${day}`;
};

const buildReceiptNumber = (yearMonth: string, sequence: number) => {
  const seq = String(sequence).padStart(3, '0');
  return `RCT-${yearMonth}-${seq}`;
};

const buildPaymentReference = (yearMonth: string, sequence: number) => {
  const seq = String(sequence).padStart(3, '0');
  return `PAY-${yearMonth}-${seq}`;
};

const buildTransactionReference = (yearMonthDay: string, sequence: number) => {
  const seq = String(sequence).padStart(3, '0');
  return `TXN-${yearMonthDay}-${seq}`;
};

const isInternalReference = (value?: string | null) => {
  if (!value) return true;
  const v = value.toUpperCase();
  return (
    v === 'PENDING' ||
    v.startsWith('PAY-') ||
    v.startsWith('RNT-') ||
    v.startsWith('ADV-') ||
    v.startsWith('RCT-') ||
    v.startsWith('RCP-') ||
    /^[A-Z0-9]{10}$/.test(v)
  );
};

const isInternalTransaction = (value?: string | null) => {
  if (!value) return true;
  const v = value.toUpperCase();
  return v === 'PENDING' || v.startsWith('TXN-');
};

const inferChannelFromMethod = (method?: string | null) => {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m === 'mpesa') return 'mpesa';
  if (m === 'mobile_money') return 'mobile_money';
  if (m === 'bank_transfer') return 'bank_transfer';
  if (m === 'card' || m === 'credit_card' || m === 'debit_card') return 'card';
  return null;
};

const normalizeAttachments = (raw: any) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

async function normalizePayments() {
  const payments = await prisma.payment.findMany({
    orderBy: [
      { payment_date: 'asc' },
      { created_at: 'asc' },
      { id: 'asc' },
    ],
  });

  const monthSequences = new Map<string, number>();
  const daySequences = new Map<string, number>();

  for (const payment of payments) {
    const date = payment.payment_date || payment.created_at;
    const yearMonth = formatYearMonth(date);
    const yearMonthDay = formatYearMonthDay(date);

    const monthKey = `${payment.company_id}-${yearMonth}`;
    const dayKey = `${payment.company_id}-${yearMonthDay}`;

    const monthSeq = (monthSequences.get(monthKey) || 0) + 1;
    monthSequences.set(monthKey, monthSeq);

    const daySeq = (daySequences.get(dayKey) || 0) + 1;
    daySequences.set(dayKey, daySeq);

    const nextReceipt = buildReceiptNumber(yearMonth, monthSeq);
    const nextReference = buildPaymentReference(yearMonth, monthSeq);
    const nextTransaction = buildTransactionReference(yearMonthDay, daySeq);

    const attachments = normalizeAttachments(payment.attachments);
    const first = attachments[0] && typeof attachments[0] === 'object' ? attachments[0] : null;

    let channel: string | null = null;
    if (first) {
      channel =
        (first.channel as string) ||
        (first.channel_display as string) ||
        (first.gateway_response?.channel as string) ||
        (first.gateway_response?.data?.channel as string) ||
        null;
    }
    if (!channel) {
      channel = inferChannelFromMethod(payment.payment_method);
    }

    const updates: any = {};

    if (payment.receipt_number !== nextReceipt) {
      updates.receipt_number = nextReceipt;
    }
    if (isInternalReference(payment.reference_number)) {
      updates.reference_number = nextReference;
    }
    if (isInternalTransaction(payment.transaction_id)) {
      updates.transaction_id = nextTransaction;
    }

    if (channel) {
      const channelDisplay = getChannelDisplay(channel);
      const nextAttachment = {
        ...(first || { gateway: payment.payment_method === 'online' ? 'paystack' : 'manual' }),
        channel,
        channel_display: channelDisplay,
      };
      updates.attachments = [nextAttachment];
    }

    if (Object.keys(updates).length > 0) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: updates,
      });
    }
  }
}

async function main() {
  console.log('🔧 Normalizing payment receipts, references, and channels...');
  await normalizePayments();
  console.log('✅ Payment normalization complete.');
}

main()
  .catch((error) => {
    console.error('❌ Payment normalization failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
