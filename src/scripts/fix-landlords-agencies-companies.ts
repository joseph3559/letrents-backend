/**
 * Script to ensure all landlords and agencies have company_id and company names
 * This script:
 * 1. Finds landlords and agency_admins without company_id
 * 2. Creates companies for them if missing
 * 3. Ensures all companies have proper names
 * 
 * Usage: npx ts-node src/scripts/fix-landlords-agencies-companies.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLandlordsAndAgenciesCompanies() {
  console.log('🔍 Checking for landlords and agencies without company_id...\n');

  try {
    // Find all landlords without company_id
    const landlordsWithoutCompany = await prisma.user.findMany({
      where: {
        role: 'landlord',
        company_id: { equals: null },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        created_at: true,
      },
    });

    // Find all agency_admins without company_id
    const agenciesWithoutCompany = await prisma.user.findMany({
      where: {
        role: 'agency_admin',
        company_id: { equals: null },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        created_at: true,
      },
    });

    console.log(`📋 Found ${landlordsWithoutCompany.length} landlords without company_id`);
    console.log(`📋 Found ${agenciesWithoutCompany.length} agency_admins without company_id\n`);

    let fixedLandlords = 0;
    let fixedAgencies = 0;
    let errors = 0;

    // Fix landlords
    for (const landlord of landlordsWithoutCompany) {
      try {
        console.log(`\n📋 Processing landlord: ${landlord.first_name} ${landlord.last_name} (${landlord.email})`);

        // Generate company name
        const companyName = `${landlord.first_name} ${landlord.last_name} Properties`;

        // Check if company with this name already exists
        const existingCompany = await prisma.company.findFirst({
          where: { name: companyName },
        });

        let companyId: string;

        if (existingCompany) {
          console.log(`   ℹ️  Company "${companyName}" already exists, using it`);
          companyId = existingCompany.id;
        } else {
          // Create new company
          const company = await prisma.company.create({
            data: {
              name: companyName,
              email: landlord.email,
              phone_number: landlord.phone_number || undefined,
              business_type: 'property_management',
              country: 'Kenya',
              industry: 'Property Management',
              company_size: 'small',
              status: 'pending',
              subscription_plan: 'starter',
              max_properties: 100,
              max_units: 1000,
              max_tenants: 1000,
              max_staff: 50,
            },
          });
          companyId = company.id;
          console.log(`   ✅ Created company: "${companyName}" (ID: ${companyId})`);
        }

        // Update landlord with company_id
        await prisma.user.update({
          where: { id: landlord.id },
          data: { company_id: companyId },
        });

        console.log(`   ✅ Assigned company_id to landlord`);
        fixedLandlords++;
      } catch (error: any) {
        console.error(`   ❌ Error processing landlord ${landlord.email}:`, error.message);
        errors++;
      }
    }

    // Fix agency_admins
    for (const agencyAdmin of agenciesWithoutCompany) {
      try {
        console.log(`\n📋 Processing agency_admin: ${agencyAdmin.first_name} ${agencyAdmin.last_name} (${agencyAdmin.email})`);

        // Generate company name
        const companyName = `${agencyAdmin.first_name} ${agencyAdmin.last_name} Agency`;

        // Check if company with this name already exists
        const existingCompany = await prisma.company.findFirst({
          where: { name: companyName },
        });

        let companyId: string;

        if (existingCompany) {
          console.log(`   ℹ️  Company "${companyName}" already exists, using it`);
          companyId = existingCompany.id;
        } else {
          // Create new company
          const company = await prisma.company.create({
            data: {
              name: companyName,
              email: agencyAdmin.email,
              phone_number: agencyAdmin.phone_number || undefined,
              business_type: 'property_management',
              country: 'Kenya',
              industry: 'Property Management',
              company_size: 'small',
              status: 'pending',
              subscription_plan: 'starter',
              max_properties: 100,
              max_units: 1000,
              max_tenants: 1000,
              max_staff: 50,
            },
          });
          companyId = company.id;
          console.log(`   ✅ Created company: "${companyName}" (ID: ${companyId})`);
        }

        // Update agency_admin with company_id
        await prisma.user.update({
          where: { id: agencyAdmin.id },
          data: { company_id: companyId },
        });

        console.log(`   ✅ Assigned company_id to agency_admin`);
        fixedAgencies++;

        // Also check if agency exists and needs company_id
        const agency = await prisma.agency.findFirst({
          where: {
            email: agencyAdmin.email || undefined,
          },
        });

        if (agency && !agency.company_id) {
          await prisma.agency.update({
            where: { id: agency.id },
            data: { company_id: companyId },
          });
          console.log(`   ✅ Updated agency with company_id`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing agency_admin ${agencyAdmin.email}:`, error.message);
        errors++;
      }
    }

    // Check for companies without names (checking for empty strings since name is non-nullable)
    console.log('\n🔍 Checking for companies without names...\n');
    const companiesWithoutName = await prisma.company.findMany({
      where: {
        name: '',
      },
    });

    console.log(`📋 Found ${companiesWithoutName.length} companies without names`);

    let fixedCompanyNames = 0;
    for (const company of companiesWithoutName) {
      try {
        // Find a user associated with this company to derive the name
        const user = await prisma.user.findFirst({
          where: {
            company_id: company.id,
            role: { in: ['landlord', 'agency_admin'] },
          },
        });

        if (user) {
          const companyName = user.role === 'agency_admin'
            ? `${user.first_name} ${user.last_name} Agency`
            : `${user.first_name} ${user.last_name} Properties`;

          await prisma.company.update({
            where: { id: company.id },
            data: { name: companyName },
          });

          console.log(`   ✅ Fixed company name: "${companyName}" (ID: ${company.id})`);
          fixedCompanyNames++;
        } else {
          console.log(`   ⚠️  Company ${company.id} has no associated landlord/agency_admin to derive name from`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error fixing company ${company.id}:`, error.message);
        errors++;
      }
    }

    // Verify fixes
    console.log('\n🔍 Verifying fixes...\n');
    const remainingLandlords = await prisma.user.count({
      where: {
        role: 'landlord',
        company_id: { equals: null },
      },
    });

    const remainingAgencies = await prisma.user.count({
      where: {
        role: 'agency_admin',
        company_id: { equals: null },
      },
    });

    const remainingCompaniesWithoutName = await prisma.company.count({
      where: {
        name: '',
      },
    });

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Landlords fixed: ${fixedLandlords}`);
    console.log(`   Agency admins fixed: ${fixedAgencies}`);
    console.log(`   Company names fixed: ${fixedCompanyNames}`);
    console.log(`   Errors: ${errors}`);
    console.log('');
    console.log('📊 Remaining issues:');
    console.log(`   Landlords without company_id: ${remainingLandlords}`);
    console.log(`   Agency admins without company_id: ${remainingAgencies}`);
    console.log(`   Companies without names: ${remainingCompaniesWithoutName}`);
    console.log('='.repeat(60));

    if (remainingLandlords === 0 && remainingAgencies === 0 && remainingCompaniesWithoutName === 0) {
      console.log('\n✅ All landlords and agencies now have company_id and company names!');
    } else {
      console.log('\n⚠️  Some issues remain. Please review the output above.');
    }
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixLandlordsAndAgenciesCompanies()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

