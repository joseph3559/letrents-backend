import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvoice() {
  try {
    // First, find the payment
    const payment = await prisma.payment.findUnique({
      where: { id: 'c125f174-7664-4e46-9a03-dac259329781' },
      select: {
        id: true,
        receipt_number: true,
        invoice_id: true,
        amount: true
      }
    });

    console.log('📋 Payment found:', payment);

    if (payment?.invoice_id) {
      // Check if invoice exists
      const invoice = await prisma.invoice.findUnique({
        where: { id: payment.invoice_id },
        select: {
          id: true,
          invoice_number: true,
          description: true
        }
      });

      console.log('📄 Invoice found:', invoice);

      // Check line items separately
      const lineItems = await prisma.invoiceLineItem.findMany({
        where: { invoice_id: payment.invoice_id },
        select: {
          id: true,
          description: true,
          quantity: true,
          unit_price: true,
          total_price: true,
          metadata: true
        }
      });

      console.log('📝 Line items found:', lineItems.length);
      console.log('📦 Line items data:', JSON.stringify(lineItems, null, 2));

      // Now try the full query with relation
      const invoiceWithItems = await prisma.invoice.findUnique({
        where: { id: payment.invoice_id },
        include: {
          line_items: true
        }
      });

      console.log('🔗 Invoice with line_items relation:', {
        id: invoiceWithItems?.id,
        line_items_count: invoiceWithItems?.line_items?.length || 0
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInvoice();

