/**
 * Script to fix staff members with null or incorrect company_id
 * Run this script to ensure all staff members are properly associated with a company
 * 
 * Usage: node scripts/fix-staff-company-ids.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStaffCompanyIds() {
  console.log('🔍 Checking for staff members with company_id issues...\n');

  try {
    // Find all staff roles (caretaker, agent, etc.) with null company_id
    const staffWithNullCompany = await prisma.user.findMany({
      where: {
        role: { in: ['caretaker', 'agent', 'security', 'cleaner', 'maintenance'] },
        company_id: null
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        created_by: true
      }
    });

    console.log(`Found ${staffWithNullCompany.length} staff members with null company_id\n`);

    if (staffWithNullCompany.length === 0) {
      console.log('✅ All staff members have company_id assigned');
      return;
    }

    // Try to fix each one by looking up their creator
    let fixed = 0;
    let cannotFix = 0;

    for (const staff of staffWithNullCompany) {
      console.log(`\n📋 Processing: ${staff.first_name} ${staff.last_name} (${staff.email})`);
      console.log(`   Role: ${staff.role}`);
      console.log(`   Created by: ${staff.created_by || 'Unknown'}`);

      if (!staff.created_by) {
        console.log('   ❌ Cannot fix: No creator information');
        cannotFix++;
        continue;
      }

      // Look up the creator's company
      const creator = await prisma.user.findUnique({
        where: { id: staff.created_by },
        select: { company_id: true, email: true, role: true }
      });

      if (!creator) {
        console.log('   ❌ Cannot fix: Creator not found');
        cannotFix++;
        continue;
      }

      if (!creator.company_id) {
        console.log('   ❌ Cannot fix: Creator has no company_id');
        console.log(`      Creator: ${creator.email} (${creator.role})`);
        cannotFix++;
        continue;
      }

      // Update the staff member with the creator's company_id
      await prisma.user.update({
        where: { id: staff.id },
        data: { company_id: creator.company_id }
      });

      console.log(`   ✅ Fixed: Assigned to company ${creator.company_id}`);
      console.log(`      From creator: ${creator.email} (${creator.role})`);
      fixed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total staff with null company_id: ${staffWithNullCompany.length}`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Cannot fix: ${cannotFix}`);
    console.log('='.repeat(60));

    if (cannotFix > 0) {
      console.log('\n⚠️  Warning: Some staff members could not be fixed.');
      console.log('   These may need manual intervention.');
      console.log('   Contact the system administrator or assign them manually.');
    }

    // Verify the fix
    const remainingNull = await prisma.user.count({
      where: {
        role: { in: ['caretaker', 'agent', 'security', 'cleaner', 'maintenance'] },
        company_id: null
      }
    });

    console.log(`\n🔍 Verification: ${remainingNull} staff members still have null company_id`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixStaffCompanyIds()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

