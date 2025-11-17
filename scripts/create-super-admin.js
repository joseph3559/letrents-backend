#!/usr/bin/env node

/**
 * Create Super Admin User Script
 * Creates a super admin user in the database
 * 
 * Usage:
 *   node scripts/create-super-admin.js [email] [password] [first_name] [last_name]
 * 
 * Example:
 *   node scripts/create-super-admin.js scottjoe3559@gmail.com "Scott@2030?" "Scott" "Joe"
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  dotenv.config({ path: envPath });
} catch (error) {
  console.log('No .env file found, using environment variables');
}

const prisma = new PrismaClient();

async function createSuperAdmin(email, password, firstName = 'Super', lastName = 'Admin') {
  try {
    console.log(`\n🔐 Creating super admin user...`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log(`\n⚠️  User with email ${email} already exists!`);
      console.log(`   Updating existing user to super_admin...`);
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Get or create a default company for super admin
      let company = await prisma.company.findFirst({
        where: { name: 'LetRents Platform' }
      });
      
      if (!company) {
        company = await prisma.company.create({
          data: {
            name: 'LetRents Platform',
            email: 'admin@letrents.com',
            country: 'Kenya',
            status: 'active',
            subscription_plan: 'enterprise',
            max_properties: 999999,
            max_units: 999999,
            max_tenants: 999999,
            max_staff: 999999,
          }
        });
        console.log(`   ✅ Created company: ${company.name}`);
      }
      
      // Update user to super_admin
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role: 'super_admin',
          status: 'active',
          email_verified: true,
          company_id: company.id,
          updated_at: new Date(),
        }
      });
      
      console.log(`\n✅ Successfully updated user to super_admin!`);
      console.log(`   User ID: ${updatedUser.id}`);
      console.log(`   Company ID: ${updatedUser.company_id}`);
      return updatedUser;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Get or create a default company for super admin
    let company = await prisma.company.findFirst({
      where: { name: 'LetRents Platform' }
    });
    
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'LetRents Platform',
          email: 'admin@letrents.com',
          country: 'Kenya',
          status: 'active',
          subscription_plan: 'enterprise',
          max_properties: 999999,
          max_units: 999999,
          max_tenants: 999999,
          max_staff: 999999,
        }
      });
      console.log(`   ✅ Created company: ${company.name}`);
    }
    
    // Create super admin user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'super_admin',
        status: 'active',
        email_verified: true,
        company_id: company.id,
      }
    });
    
    console.log(`\n✅ Successfully created super admin user!`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Company ID: ${user.company_id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    
    return user;
  } catch (error) {
    console.error(`\n❌ Error creating super admin:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const email = args[0] || 'scottjoe3559@gmail.com';
  const password = args[1] || 'Scott@2030?';
  const firstName = args[2] || 'Scott';
  const lastName = args[3] || 'Joe';
  
  try {
    await createSuperAdmin(email, password, firstName, lastName);
  } catch (error) {
    console.error('Failed to create super admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

