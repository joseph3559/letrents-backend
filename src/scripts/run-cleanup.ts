/**
 * Manual cleanup script
 * Run with: npm run cleanup
 * or: node dist/scripts/run-cleanup.js
 */

import { CleanupService } from '../services/cleanup.service.js';

async function runCleanup() {
  console.log('🧹 Running cleanup tasks...\n');
  
  const service = new CleanupService();
  
  try {
    const result = await service.runCleanupTasks();
    
    console.log('\n📊 Cleanup Summary:');
    console.log('==================');
    console.log(`Terminated tenants deleted: ${result.results.terminatedTenants.deleted}`);
    
    if (result.results.terminatedTenants.deleted > 0) {
      console.log('\nDeleted tenants:');
      result.results.terminatedTenants.tenants.forEach(tenant => {
        console.log(`  - ${tenant}`);
      });
    }
    
    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

runCleanup();

