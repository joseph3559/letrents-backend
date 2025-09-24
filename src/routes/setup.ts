import { Router } from 'express';
import { getPrisma } from '../config/prisma.js';
import { writeSuccess, writeError } from '../utils/response.js';

const router = Router();
const prisma = getPrisma();

// Database setup endpoint - can be called once to create tables
router.post('/database', async (req, res) => {
  try {
    // Check if tables already exist by trying to count users
    let tablesExist = false;
    try {
      await prisma.user.count();
      tablesExist = true;
    } catch (error) {
      // Tables don't exist, which is expected
      tablesExist = false;
    }

    if (tablesExist) {
      return writeSuccess(res, 200, 'Database tables already exist', {
        status: 'already_setup',
        message: 'Database is already configured'
      });
    }

    // Run Prisma push to create tables
    console.log('🔧 Creating database tables...');
    
    // Import and run prisma push programmatically
    const { execSync } = require('child_process');
    
    try {
      // Generate Prisma client first
      execSync('npx prisma generate', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Prisma client generated');
      
      // Push database schema
      execSync('npx prisma db push --force-reset', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Database schema pushed');
      
      // Verify tables were created
      const userCount = await prisma.user.count();
      console.log('✅ Database tables verified');
      
      writeSuccess(res, 200, 'Database setup completed successfully', {
        status: 'setup_complete',
        message: 'All database tables have been created',
        verification: {
          user_table_exists: true,
          initial_user_count: userCount
        }
      });
      
    } catch (execError: any) {
      console.error('❌ Error during database setup:', execError);
      writeError(res, 500, `Database setup failed: ${execError.message}`);
    }
    
  } catch (error: any) {
    console.error('❌ Database setup error:', error);
    writeError(res, 500, `Failed to setup database: ${error.message}`);
  }
});

// Database status check endpoint
router.get('/status', async (req, res) => {
  try {
    let status = {
      database_connected: false,
      tables_exist: false,
      user_count: 0,
      company_count: 0
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      status.database_connected = true;
    } catch (error) {
      console.error('Database connection failed:', error);
    }

    // Check if tables exist
    try {
      const userCount = await prisma.user.count();
      const companyCount = await prisma.company.count();
      
      status.tables_exist = true;
      status.user_count = userCount;
      status.company_count = companyCount;
    } catch (error) {
      console.error('Tables do not exist:', error);
    }

    writeSuccess(res, 200, 'Database status retrieved', status);
  } catch (error: any) {
    writeError(res, 500, `Failed to get database status: ${error.message}`);
  }
});

export default router;
