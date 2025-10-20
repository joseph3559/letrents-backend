const { PrismaClient } = require('@prisma/client');

async function createSampleData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== CREATING SAMPLE DATA ===\n');
    
    // Get the existing company ID
    const company = await prisma.$queryRaw`SELECT id FROM companies LIMIT 1`;
    const companyId = company[0]?.id;
    
    if (!companyId) {
      console.log('❌ No company found. Creating one first...');
      return;
    }
    
    console.log('✅ Using company ID:', companyId);
    
    // 1. Create some agencies
    console.log('\n1. Creating agencies...');
    const agency1 = await prisma.$queryRaw`
      INSERT INTO agencies (id, name, email, phone_number, address, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), 'Prime Property Agency', 'contact@primeproperty.com', '+254700123456', 'Nairobi, Kenya', 'active', NOW(), NOW())
      RETURNING id, name
    `;
    
    const agency2 = await prisma.$queryRaw`
      INSERT INTO agencies (id, name, email, phone_number, address, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), 'Elite Realty Services', 'info@eliterealty.com', '+254700789012', 'Mombasa, Kenya', 'active', NOW(), NOW())
      RETURNING id, name
    `;
    
    console.log('✅ Created agencies:', agency1[0]?.name, 'and', agency2[0]?.name);
    
    // 2. Create some agency admins
    console.log('\n2. Creating agency admins...');
    const agencyAdmin1 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'admin@primeproperty.com', 'John', 'Manager', 'agency_admin', 'active', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    const agencyAdmin2 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'admin@eliterealty.com', 'Sarah', 'Wilson', 'agency_admin', 'pending', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    console.log('✅ Created agency admins:', agencyAdmin1[0]?.email, 'and', agencyAdmin2[0]?.email);
    
    // 3. Create some landlords
    console.log('\n3. Creating more landlords...');
    const landlord1 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'landlord1@example.com', 'Michael', 'Smith', 'landlord', 'active', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    const landlord2 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'landlord2@example.com', 'Emma', 'Johnson', 'landlord', 'suspended', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    console.log('✅ Created landlords:', landlord1[0]?.email, 'and', landlord2[0]?.email);
    
    // 4. Create some tenants
    console.log('\n4. Creating tenants...');
    const tenant1 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'tenant1@example.com', 'David', 'Brown', 'tenant', 'active', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    const tenant2 = await prisma.$queryRaw`
      INSERT INTO users (id, company_id, email, first_name, last_name, role, status, created_at, updated_at)
      VALUES (uuid_generate_v4(), ${companyId}, 'tenant2@example.com', 'Lisa', 'Davis', 'tenant', 'active', NOW(), NOW())
      RETURNING email, first_name, last_name
    `;
    
    console.log('✅ Created tenants:', tenant1[0]?.email, 'and', tenant2[0]?.email);
    
    console.log('\n=== SAMPLE DATA CREATED SUCCESSFULLY ===');
    console.log('🏢 Agencies: 2 (both active)');
    console.log('👔 Agency Admins: 2 (1 active, 1 pending)');
    console.log('🏠 Landlords: 3 total (1 pending from before + 1 active + 1 suspended)');
    console.log('👥 Tenants: 2 (both active)');
    
  } catch (error) {
    console.error('Error creating sample data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleData();
