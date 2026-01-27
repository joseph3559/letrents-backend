import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function getArg(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx === -1)
        return undefined;
    return process.argv[idx + 1];
}
async function main() {
    const tenantId = getArg('--tenant');
    const refsRaw = getArg('--refs');
    const includeAll = process.argv.includes('--all');
    const references = refsRaw
        ? refsRaw.split(',').map((r) => r.trim()).filter(Boolean)
        : [];
    if (!tenantId) {
        throw new Error('Missing --tenant <tenant_id>');
    }
    if (references.length === 0 && !includeAll) {
        throw new Error('Provide --refs ref1,ref2 or use --all');
    }
    const whereClause = {
        status: 'pending',
        tenant_id: tenantId,
    };
    const referenceFilter = references.length > 0
        ? [
            { reference_number: { in: references } },
            { transaction_id: { in: references } },
        ]
        : [];
    const anyRefFilter = [
        { reference_number: { not: null } },
        { transaction_id: { not: null } },
    ];
    if (includeAll && referenceFilter.length > 0) {
        whereClause.OR = [...referenceFilter, ...anyRefFilter];
    }
    else if (referenceFilter.length > 0) {
        whereClause.OR = referenceFilter;
    }
    else if (includeAll) {
        whereClause.OR = anyRefFilter;
    }
    const pending = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { created_at: 'asc' },
    });
    const updated = [];
    for (const payment of pending) {
        // Cancel placeholder if invoice already has approved/completed payments
        if (payment.invoice_id) {
            const approvedCount = await prisma.payment.count({
                where: {
                    invoice_id: payment.invoice_id,
                    status: { in: ['approved', 'completed'] },
                    id: { not: payment.id },
                },
            });
            if (approvedCount > 0) {
                const cancelled = await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: 'cancelled',
                        notes: payment.notes
                            ? `${payment.notes} - Auto-cancelled (approved payment exists)`
                            : 'Auto-cancelled (approved payment exists)',
                        updated_at: new Date(),
                    },
                });
                updated.push(cancelled.id);
                continue;
            }
        }
        let receiptNumber = payment.receipt_number;
        if (!receiptNumber || receiptNumber.startsWith('PENDING-')) {
            receiptNumber = `RCP-${Date.now()}-${payment.id.slice(0, 6)}`;
        }
        const updatedPayment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'approved',
                payment_method: payment.payment_method || 'online',
                payment_date: payment.payment_date || new Date(),
                receipt_number: receiptNumber,
                processed_at: new Date(),
                notes: payment.notes
                    ? `${payment.notes} - Auto-reconciled from pending`
                    : 'Auto-reconciled from pending',
                updated_at: new Date(),
            },
        });
        if (updatedPayment.invoice_id) {
            const invoice = await prisma.invoice.findUnique({
                where: { id: updatedPayment.invoice_id },
                select: { id: true, total_amount: true },
            });
            if (invoice) {
                const totalPayments = await prisma.payment.aggregate({
                    where: {
                        invoice_id: updatedPayment.invoice_id,
                        status: { in: ['approved', 'completed'] },
                    },
                    _sum: { amount: true },
                });
                const totalPaid = Number(totalPayments._sum.amount || 0);
                const invoiceAmount = Number(invoice.total_amount || 0);
                if (totalPaid >= invoiceAmount) {
                    await prisma.invoice.update({
                        where: { id: updatedPayment.invoice_id },
                        data: {
                            status: 'paid',
                            paid_date: new Date(),
                            payment_method: updatedPayment.payment_method,
                            payment_reference: updatedPayment.receipt_number,
                            updated_at: new Date(),
                        },
                    });
                }
            }
        }
        updated.push(updatedPayment.id);
    }
    console.log(`✅ Reconciled ${updated.length} pending payment(s).`);
    if (updated.length > 0) {
        console.log(`Updated IDs: ${updated.join(', ')}`);
    }
}
main()
    .catch((err) => {
    console.error('❌ Reconciliation failed:', err);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
