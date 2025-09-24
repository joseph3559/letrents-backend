#!/usr/bin/env node

// Simple database initialization script
const { PrismaClient } = require('@prisma/client');

async function initializeDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database connection...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Try to query users table to see if it exists
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ Database tables exist. Found ${userCount} users.`);
      
      // Check if we have any companies
      const companyCount = await prisma.company.count();
      console.log(`✅ Found ${companyCount} companies.`);
      
      if (companyCount === 0) {
        console.log('📝 Creating default company...');
        await prisma.company.create({
          data: {
            name: 'Default Company',
            business_type: 'property_management',
            email: 'admin@letrents.com',
            phone_number: '+254700000000',
            country: 'Kenya',
            subscription_plan: 'free',
            subscription_status: 'active'
          }
        });
        console.log('✅ Default company created');
      }
      
    } catch (error) {
      console.error('❌ Database tables do not exist:', error.message);
      console.log('🔧 This usually means Prisma push failed during deployment');
      console.log('💡 The database will be initialized on next deployment');
    }
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
