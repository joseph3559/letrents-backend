export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency || 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency || 'KES'} ${Number(amount ?? 0).toLocaleString('en-KE')}`;
  }
}

export function formatDateTime(isoOrDate: string | Date, timeZone = 'Africa/Nairobi'): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
}

export function formatDate(isoOrDate: string | Date, timeZone = 'Africa/Nairobi'): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone,
  });
}

