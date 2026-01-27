import { PrismaClient } from '@prisma/client';
import { generatePropertyCode } from '../utils/invoice-number-generator.js';
const prisma = new PrismaClient();
const formatYearMonth = (date) => {
    const shortYear = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${shortYear}${month}`;
};
const formatYearMonthDay = (date) => {
    const shortYear = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${shortYear}${month}${day}`;
};
const buildInvoiceNumber = (yearMonth, sequence, propertyName) => {
    const seq = String(sequence).padStart(3, '0');
    if (propertyName) {
        const propCode = generatePropertyCode(propertyName);
        return `INV-${propCode}-${yearMonth}-${seq}`;
    }
    return `INV-${yearMonth}-${seq}`;
};
const buildReceiptNumber = (yearMonth, sequence) => {
    const seq = String(sequence).padStart(3, '0');
    return `RCT-${yearMonth}-${seq}`;
};
const buildPaymentReference = (yearMonth, sequence) => {
    const seq = String(sequence).padStart(3, '0');
    return `PAY-${yearMonth}-${seq}`;
};
const buildTransactionReference = (yearMonthDay, sequence) => {
    const seq = String(sequence).padStart(3, '0');
    return `TXN-${yearMonthDay}-${seq}`;
};
const isInternalReference = (value) => {
    if (!value)
        return true;
    return /^[A-Z0-9]{10}$/.test(value) || /^PAY-/.test(value);
};
const isInternalTransaction = (value) => {
    if (!value)
        return true;
    return /^TXN-/.test(value);
};
async function normalizeInvoices() {
    const invoices = await prisma.invoice.findMany({
        include: {
            property: { select: { name: true } },
        },
        orderBy: [
            { issue_date: 'asc' },
            { created_at: 'asc' },
            { id: 'asc' },
        ],
    });
    const usedNumbers = new Set();
    const sequences = new Map();
    for (const invoice of invoices) {
        const date = invoice.issue_date || invoice.created_at;
        const yearMonth = formatYearMonth(date);
        const key = `${invoice.company_id}-${yearMonth}`;
        const current = sequences.get(key) || 0;
        let sequence = current + 1;
        let newNumber = buildInvoiceNumber(yearMonth, sequence, invoice.property?.name);
        while (usedNumbers.has(newNumber)) {
            sequence += 1;
            newNumber = buildInvoiceNumber(yearMonth, sequence, invoice.property?.name);
        }
        sequences.set(key, sequence);
        usedNumbers.add(newNumber);
        if (invoice.invoice_number !== newNumber) {
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: { invoice_number: newNumber },
            });
        }
    }
}
async function normalizePayments() {
    const payments = await prisma.payment.findMany({
        orderBy: [
            { payment_date: 'asc' },
            { created_at: 'asc' },
            { id: 'asc' },
        ],
    });
    const monthSequences = new Map();
    const daySequences = new Map();
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
        const receiptNumber = buildReceiptNumber(yearMonth, monthSeq);
        const paymentReference = buildPaymentReference(yearMonth, monthSeq);
        const transactionReference = buildTransactionReference(yearMonthDay, daySeq);
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                receipt_number: receiptNumber,
                ...(isInternalReference(payment.reference_number)
                    ? { reference_number: paymentReference }
                    : {}),
                ...(isInternalTransaction(payment.transaction_id)
                    ? { transaction_id: transactionReference }
                    : {}),
            },
        });
    }
}
async function normalizeLeases() {
    const leases = await prisma.lease.findMany({
        orderBy: [
            { start_date: 'asc' },
            { created_at: 'asc' },
            { id: 'asc' },
        ],
    });
    const sequences = new Map();
    for (const lease of leases) {
        const date = lease.start_date || lease.created_at;
        const yearMonth = formatYearMonth(date);
        const key = `${lease.company_id}-${yearMonth}`;
        const current = sequences.get(key) || 0;
        const next = current + 1;
        const leaseNumber = `LSE-${yearMonth}-${String(next).padStart(3, '0')}`;
        sequences.set(key, next);
        if (lease.lease_number !== leaseNumber) {
            await prisma.lease.update({
                where: { id: lease.id },
                data: { lease_number: leaseNumber },
            });
        }
    }
}
async function syncInvoicePaymentReferences() {
    const payments = await prisma.payment.findMany({
        where: { invoice_id: { not: null } },
        orderBy: [
            { payment_date: 'desc' },
            { created_at: 'desc' },
        ],
    });
    const latestPaymentByInvoice = new Map();
    for (const payment of payments) {
        if (!payment.invoice_id)
            continue;
        if (!latestPaymentByInvoice.has(payment.invoice_id)) {
            latestPaymentByInvoice.set(payment.invoice_id, payment.receipt_number);
        }
    }
    for (const [invoiceId, receiptNumber] of latestPaymentByInvoice.entries()) {
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { payment_reference: receiptNumber },
        });
    }
}
async function main() {
    console.log('🔧 Normalizing invoice, payment, and lease references...');
    await normalizeInvoices();
    await normalizePayments();
    await normalizeLeases();
    await syncInvoicePaymentReferences();
    console.log('✅ Reference normalization complete.');
}
main()
    .catch((error) => {
    console.error('❌ Reference normalization failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
