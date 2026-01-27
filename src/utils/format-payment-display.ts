/**
 * Format payment references and method for display.
 * - Short, unique ref/txn IDs from long Paystack strings
 * - Human-readable payment channel (Card, M-Pesa, Bank Transfer, etc.)
 */

/** Paystack channel -> display label */
export const PAYSTACK_CHANNEL_MAP: Record<string, string> = {
  card: 'Debit/Credit Card (Visa, Mastercard, Verve)',
  bank: 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  eft: 'Bank Transfer',
  ach: 'Bank Transfer',
  mobile_money: 'Mobile Money (M-Pesa, Airtel Money)',
  mobilemoney: 'Mobile Money (M-Pesa, Airtel Money)',
  mpesa: 'M-Pesa',
  ussd: 'USSD',
  qr: 'QR Code',
};

/**
 * Short, readable reference from long Paystack reference.
 * e.g. rent_c9876a68-885b-4fbd-bdf9-c7577224e05c_1768953861032 -> REF-95861032
 */
export function toShortReference(ref: string | null | undefined): string {
  if (!ref || typeof ref !== 'string') return '—';
  const s = ref.trim();
  if (s.length <= 22) return s;
  const alnum = s.replace(/\W/g, '');
  const tail = (alnum.slice(-8) || s.slice(-8)).toUpperCase();
  return `REF-${tail}`;
}

/**
 * Short, readable transaction ID from Paystack numeric or long id.
 * e.g. 2847982734 -> 2847982734; very long -> TXN-XXXX5678
 */
export function toShortTransactionId(id: string | null | undefined): string {
  if (!id || typeof id !== 'string') return '—';
  const s = id.trim();
  if (s.length <= 14) return s;
  return `TXN-${s.slice(-8)}`;
}

/**
 * Resolve payment method / channel for display.
 * For online: use channel from attachments (Paystack), else "Online".
 */
export function formatPaymentMethodDisplay(payment: {
  payment_method?: string | null;
  attachments?: unknown;
}): string {
  const method = (payment.payment_method || '').toLowerCase();
  if (method !== 'online') {
    if (method === 'cash') return 'Cash';
    if (method === 'mpesa' || method === 'mobile_money') return 'Mobile Money (M-Pesa, Airtel Money)';
    if (method === 'bank_transfer') return 'Bank Transfer';
    return method ? method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ') : '—';
  }

  const att = payment.attachments;
  const arr = Array.isArray(att) ? att : [];
  const first = arr[0];
  if (!first || typeof first !== 'object') return 'Online';

  const obj = first as Record<string, unknown>;
  let ch = (obj.channel as string) || (obj.channel_display as string);
  if (!ch && obj.gateway_response && typeof obj.gateway_response === 'object') {
    const gw = obj.gateway_response as Record<string, unknown>;
    ch = (gw.channel as string) || (gw.data && typeof gw.data === 'object' ? (gw.data as Record<string, unknown>).channel as string : '');
  }
  if (ch && typeof ch === 'string') {
    const key = ch.toLowerCase().replace(/-/g, '_');
    return PAYSTACK_CHANNEL_MAP[key] || ch.replace(/_/g, ' ');
  }
  return 'Online';
}

/**
 * Get channel display from raw Paystack channel (for storing in attachments).
 */
export function getChannelDisplay(channel: string | null | undefined, authorization?: { card_type?: string; bank?: string; brand?: string }): string {
  if (!channel) return 'Online';
  const k = channel.toLowerCase().replace(/-/g, '_');
  if (PAYSTACK_CHANNEL_MAP[k]) return PAYSTACK_CHANNEL_MAP[k];
  if (authorization?.card_type) return `${authorization.card_type} Card`;
  if (authorization?.bank) return `${authorization.bank} Bank`;
  if (authorization?.brand) return `${authorization.brand} Card`;
  return channel.replace(/_/g, ' ');
}
