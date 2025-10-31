import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcilePayment() {
  try {
    const invoiceNumber = 'INV-GAP-2025-10-0009';
    const paystackReference = 'rent_8f2270ac-6f7e-477c-bc8e-407b66e9f865_1761875338134';
    const paymentAmount = 72875.00;

    console.log(`🔍 Checking invoice ${invoiceNumber}...`);
    const invoice = await prisma.invoice.findFirst({
      where: { invoice_number: invoiceNumber },
      include: { unit: true, property: true }
    });

    if (!invoice) {
      console.log('❌ Invoice not found!');
      process.exit(1);
    }

    console.log('📄 Invoice Details:', {
      id: invoice.id,
      number: invoice.invoice_number,
      status: invoice.status,
      amount: invoice.total_amount,
      unit: invoice.unit?.unit_number,
      property: invoice.property?.name,
      tenant_id: invoice.issued_to
    });

    console.log(`\n🔍 Checking for existing payment with reference: ${paystackReference}`);
    const existingPayment = await prisma.payment.findFirst({
      where: {
        OR: [
          { transaction_id: paystackReference },
          { receipt_number: paystackReference }
        ]
      }
    });

    if (existingPayment) {
      console.log('⚠️  Payment already exists:', existingPayment);
      console.log('\n✅ Payment record found - checking invoice status...');
      
      if (invoice.status !== 'paid') {
        console.log('🔧 Invoice not marked as paid - updating...');
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'paid',
            paid_date: new Date(),
            payment_method: 'online',
            payment_reference: paystackReference
          }
        });
        console.log('✅ Invoice marked as PAID');
      } else {
        console.log('✅ Invoice already marked as paid');
      }
      
      await prisma.$disconnect();
      return;
    }

    console.log('\n🔧 Creating payment record and marking invoice as paid...');
    
    const result = await prisma.$transaction(async (tx) => {
      // Get next receipt number
      const lastPayment = await tx.payment.findFirst({
        where: {
          receipt_number: { startsWith: 'PAY-' }
        },
        orderBy: { created_at: 'desc' }
      });

      let receiptNumber = 'PAY-' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Delete any PENDING payment records for this invoice
      const deletedPending = await tx.payment.deleteMany({
        where: {
          invoice_id: invoice.id,
          status: 'pending',
          receipt_number: { startsWith: 'PENDING-' }
        }
      });

      if (deletedPending.count > 0) {
        console.log(`🗑️  Deleted ${deletedPending.count} PENDING payment record(s)`);
      }

      // Create the actual payment
      const payment = await tx.payment.create({
        data: {
          tenant_id: invoice.issued_to,
          property_id: invoice.property_id,
          unit_id: invoice.unit_id,
          invoice_id: invoice.id,
          amount: paymentAmount,
          payment_method: 'online',
          payment_date: new Date(),
          status: 'approved',
          receipt_number: receiptNumber,
          transaction_id: paystackReference,
          approved_by: 'system',
          approved_at: new Date(),
          receipt_sent: false,
          gateway_response: JSON.stringify({
            gateway: 'paystack',
            reference: paystackReference,
            status: 'success',
            manually_reconciled: true
          })
        }
      });

      // Mark invoice as paid
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paid_date: new Date(),
          payment_method: 'online',
          payment_reference: paystackReference
        }
      });

      console.log(`✅ Payment created: ${payment.receipt_number}`);
      console.log(`✅ Invoice ${invoice.invoice_number} marked as PAID`);
      
      return { payment, invoice };
    });

    console.log('\n💰 Payment Summary:', {
      invoice: result.invoice.invoice_number,
      amount: paymentAmount,
      receipt: result.payment.receipt_number,
      transaction: paystackReference
    });

    await prisma.$disconnect();
    console.log('\n✅ Payment reconciliation complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

reconcilePayment();

