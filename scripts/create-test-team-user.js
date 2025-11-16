/**
 * Script to create a test user with a team role for testing /team dashboard
 * Usage: node scripts/create-test-team-user.js [role] [email] [password]
 * 
 * Example:
 *   node scripts/create-test-team-user.js sales sales@test.com password123
 *   node scripts/create-test-team-user.js finance finance@test.com password123
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const TEAM_ROLES = [
  'admin',
  'manager',
  'team_lead',
  'staff',
  'finance',
  'sales',
  'marketing',
  'support',
  'hr',
  'auditor'
];

async function createTestTeamUser(role, email, password) {
  try {
    // Validate role
    if (!TEAM_ROLES.includes(role)) {
      console.error(`❌ Invalid role: ${role}`);
      console.log(`Valid roles: ${TEAM_ROLES.join(', ')}`);
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log(`⚠️  User with email ${email} already exists. Updating role...`);
      const updated = await prisma.user.update({
        where: { email },
        data: {
          role: role,
          status: 'active',
          email_verified: true,
        }
      });
      console.log(`✅ Updated user ${email} to role: ${role}`);
      console.log(`   User ID: ${updated.id}`);
      console.log(`   Role: ${updated.role}`);
      console.log(`   Status: ${updated.status}`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Get or create a test company (team users need a company_id)
    let company = await prisma.company.findFirst({
      where: { name: 'Test Company' }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Test Company',
          email: 'test@company.com',
          country: 'Kenya',
          status: 'active',
          subscription_plan: 'professional',
        }
      });
      console.log(`✅ Created test company: ${company.name} (ID: ${company.id})`);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        first_name: 'Test',
        last_name: role.charAt(0).toUpperCase() + role.slice(1),
        role: role,
        status: 'active',
        email_verified: true,
        company_id: company.id,
      }
    });

    console.log(`✅ Created test user successfully!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Company ID: ${user.company_id}`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n🌐 Test the dashboard at: http://localhost:3000/team`);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const role = process.argv[2] || 'sales';
const email = process.argv[3] || `${role}@test.com`;
const password = process.argv[4] || 'password123';

console.log(`\n🔧 Creating test team user...`);
console.log(`   Role: ${role}`);
console.log(`   Email: ${email}`);
console.log(`   Password: ${password}\n`);

createTestTeamUser(role, email, password);

