import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFinancialData() {
  try {
    console.log('🌱 Seeding financial data...');

    // Property ID from the URL
    const propertyId = '9d56d054-478c-4723-a3f8-8fb6e5ae4412';
    const companyId = '594e5cb5-ba6d-4311-9c99-733e8cddcf47';
    const landlordId = '0b46a69d-3a0b-4b6f-9c39-b311f111488b';

    // Get some units for this property
    const units = await prisma.unit.findMany({
      where: { property_id: propertyId },
      take: 3
    });

    console.log(`Found ${units.length} units for property`);

    if (units.length === 0) {
      console.log('No units found, skipping financial data seeding');
      return;
    }

    // Get some tenants
    const tenants = await prisma.user.findMany({
      where: { 
        role: 'tenant',
        company_id: companyId
      },
      take: 3
    });

    console.log(`Found ${tenants.length} tenants`);

    if (tenants.length === 0) {
      console.log('No tenants found, skipping financial data seeding');
      return;
    }

    // Create sample payments
    const samplePayments = [
      {
        tenant_id: tenants[0].id,
        unit_id: units[0]?.id,
        property_id: propertyId,
        amount: 25000,
        payment_method: 'mpesa' as const,
        payment_type: 'rent' as const,
        status: 'completed' as const,
        payment_date: new Date('2024-01-15'),
        payment_period: 'January 2024',
        receipt_number: 'RCP-2024-001',
        transaction_id: 'TXN123456789',
        notes: 'Monthly rent payment for January 2024',
        company_id: companyId,
        created_by: landlordId,
      },
      {
        tenant_id: tenants[1]?.id || tenants[0].id,
        unit_id: units[1]?.id || units[0]?.id,
        property_id: propertyId,
        amount: 27000,
        payment_method: 'bank_transfer' as const,
        payment_type: 'rent' as const,
        status: 'completed' as const,
        payment_date: new Date('2024-02-10'),
        payment_period: 'February 2024',
        receipt_number: 'RCP-2024-002',
        transaction_id: 'TXN123456790',
        notes: 'Monthly rent payment for February 2024',
        company_id: companyId,
        created_by: landlordId,
      },
      {
        tenant_id: tenants[0].id,
        unit_id: units[0]?.id,
        property_id: propertyId,
        amount: 5000,
        payment_method: 'mpesa' as const,
        payment_type: 'utility' as const,
        status: 'completed' as const,
        payment_date: new Date('2024-01-20'),
        payment_period: 'January 2024',
        receipt_number: 'RCP-2024-003',
        transaction_id: 'TXN123456791',
        notes: 'Electricity bill payment',
        company_id: companyId,
        created_by: landlordId,
      },
      {
        tenant_id: tenants[1]?.id || tenants[0].id,
        unit_id: units[1]?.id || units[0]?.id,
        property_id: propertyId,
        amount: 3500,
        payment_method: 'cash' as const,
        payment_type: 'utility' as const,
        status: 'completed' as const,
        payment_date: new Date('2024-02-15'),
        payment_period: 'February 2024',
        receipt_number: 'RCP-2024-004',
        notes: 'Water bill payment',
        received_by: 'Property Manager',
        received_from: 'Tenant',
        company_id: companyId,
        created_by: landlordId,
      },
      {
        tenant_id: tenants[0].id,
        unit_id: units[0]?.id,
        property_id: propertyId,
        amount: 25000,
        payment_method: 'mpesa' as const,
        payment_type: 'rent' as const,
        status: 'completed' as const,
        payment_date: new Date('2024-03-12'),
        payment_period: 'March 2024',
        receipt_number: 'RCP-2024-005',
        transaction_id: 'TXN123456792',
        notes: 'Monthly rent payment for March 2024',
        company_id: companyId,
        created_by: landlordId,
      }
    ];

    // Insert payments
    for (const payment of samplePayments) {
      try {
        await prisma.payment.create({
          data: payment
        });
        console.log(`✅ Created payment: ${payment.receipt_number}`);
      } catch (error) {
        console.log(`❌ Failed to create payment ${payment.receipt_number}:`, error);
      }
    }

    // Create sample M-Pesa transactions
    const paybillSettings = await prisma.paybillSettings.findFirst({
      where: { company_id: companyId }
    });

    if (paybillSettings) {
      const sampleMpesaTransactions = [
        {
          company_id: companyId,
          paybill_settings_id: paybillSettings.id,
          transaction_type: 'Pay Bill',
          trans_id: 'QHX7YMNP12',
          trans_time: '20240315143022',
          trans_amount: 25000,
          msisdn: '254792539733',
          bill_ref_number: units[0]?.unit_number || 'A001',
          business_short_code: '174379',
          status: 'completed',
          property_id: propertyId,
          unit_id: units[0]?.id,
          tenant_id: tenants[0].id,
          raw_response: {
            TransactionType: 'Pay Bill',
            TransID: 'QHX7YMNP12',
            TransTime: '20240315143022',
            TransAmount: '25000.00',
            BusinessShortCode: '174379',
            BillRefNumber: units[0]?.unit_number || 'A001',
            MSISDN: '254792539733',
          }
        },
        {
          company_id: companyId,
          paybill_settings_id: paybillSettings.id,
          transaction_type: 'Pay Bill',
          trans_id: 'QHX7YMNP13',
          trans_time: '20240320091545',
          trans_amount: 5000,
          msisdn: '254792539733',
          bill_ref_number: units[0]?.unit_number || 'A001',
          business_short_code: '174379',
          status: 'completed',
          property_id: propertyId,
          unit_id: units[0]?.id,
          tenant_id: tenants[0].id,
          raw_response: {
            TransactionType: 'Pay Bill',
            TransID: 'QHX7YMNP13',
            TransTime: '20240320091545',
            TransAmount: '5000.00',
            BusinessShortCode: '174379',
            BillRefNumber: units[0]?.unit_number || 'A001',
            MSISDN: '254792539733',
          }
        }
      ];

      for (const transaction of sampleMpesaTransactions) {
        try {
          await prisma.mpesaTransaction.create({
            data: transaction
          });
          console.log(`✅ Created M-Pesa transaction: ${transaction.trans_id}`);
        } catch (error) {
          console.log(`❌ Failed to create M-Pesa transaction ${transaction.trans_id}:`, error);
        }
      }
    } else {
      console.log('No paybill settings found, skipping M-Pesa transactions');
    }

    console.log('🎉 Financial data seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding financial data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
seedFinancialData();
