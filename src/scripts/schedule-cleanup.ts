/**
 * Scheduled cleanup job
 * ⚠️ TESTING MODE: Runs every 2 minutes to clean up terminated tenants older than 5 minutes
 * 🔧 PRODUCTION: Change to '0 2 * * *' (daily at 2 AM) and update service to 14 days
 * 
 * To enable this, install node-cron:
 * npm install node-cron @types/node-cron
 * 
 * Then uncomment the route in routes/scheduler.ts
 */

import cron from 'node-cron';
import { CleanupService } from '../services/cleanup.service.js';

const service = new CleanupService();

// ⚠️ TESTING: Schedule cleanup to run every 2 minutes for testing
// 🔧 PRODUCTION: Change to '0 2 * * *' for daily at 2:00 AM
const scheduleCleanup = () => {
  console.log('📅 [TESTING MODE] Scheduling cleanup job every 2 minutes...');
  
  // Cron expression: minute hour day month day-of-week
  // '*/2 * * * *' = Run every 2 minutes (TESTING)
  // '0 2 * * *' = Run at 2:00 AM every day (PRODUCTION)
  cron.schedule('*/2 * * * *', async () => {
    console.log('\n⏰ [TESTING] Scheduled cleanup job triggered at', new Date().toISOString());
    
    try {
      const result = await service.runCleanupTasks();
      console.log(`✅ Cleanup completed: ${result.results.terminatedTenants.deleted} tenant(s) deleted\n`);
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  });

  console.log('✅ [TESTING MODE] Cleanup job scheduled to run every 2 minutes!\n');
};

export default scheduleCleanup;

