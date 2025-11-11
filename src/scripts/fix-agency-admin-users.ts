/**
 * Script to fix existing agency_admin users who don't have an agency_id
 * This script creates an agency for each agency_admin user that doesn't have one
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAgencyAdminUsers() {
  try {
    console.log('🔍 Finding agency_admin users without agency_id...');
    
    // Find all agency_admin users without an agency_id
    const usersWithoutAgency = await prisma.user.findMany({
      where: {
        role: 'agency_admin',
        agency_id: null,
        company_id: { not: null },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        company_id: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`📋 Found ${usersWithoutAgency.length} agency_admin users without agency_id`);

    if (usersWithoutAgency.length === 0) {
      console.log('✅ No users to fix!');
      return;
    }

    // Create an agency for each user
    for (const user of usersWithoutAgency) {
      try {
        // Skip users without email or company_id (should not happen, but safety check)
        if (!user.email || !user.company_id) {
          console.log(`\n⚠️  Skipping user ${user.id}: missing email or company_id`);
          continue;
        }

        // After the null check above, TypeScript knows these are non-null
        // Use non-null assertion operator to satisfy TypeScript's type checker
        const userEmail = user.email!;
        const userCompanyId = user.company_id!;

        console.log(`\n🔧 Processing user: ${userEmail} (${user.id})`);

        // Check if an agency with this email already exists
        const existingAgency = await prisma.agency.findUnique({
          where: { email: userEmail },
        });

        if (existingAgency) {
          console.log(`  ⚠️  Agency already exists for ${userEmail}, assigning to user...`);
          // Update the user with the existing agency_id
          await prisma.user.update({
            where: { id: user.id },
            data: { agency_id: existingAgency.id },
          });
          console.log(`  ✅ Assigned existing agency ${existingAgency.id} to user`);
        } else {
          // Create a new agency
          const agencyName = user.company?.name || `${user.first_name || ''} ${user.last_name || ''} Agency`.trim() || 'Agency';
          
          console.log(`  📝 Creating agency: ${agencyName}`);
          
          const agency = await prisma.agency.create({
            data: {
              company_id: userCompanyId,
              name: agencyName,
              email: userEmail,
              phone_number: user.phone_number || undefined,
              address: undefined,
              status: 'pending',
              created_by: user.id,
            },
          });

          console.log(`  ✅ Created agency: ${agency.id} (${agency.name})`);

          // Update the user with the agency_id
          await prisma.user.update({
            where: { id: user.id },
            data: { agency_id: agency.id },
          });

          console.log(`  ✅ Assigned agency ${agency.id} to user ${user.id}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing user ${user.email || user.id}:`, error.message);
      }
    }

    console.log('\n✅ Finished fixing agency_admin users!');
  } catch (error: any) {
    console.error('❌ Error fixing agency_admin users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixAgencyAdminUsers()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

