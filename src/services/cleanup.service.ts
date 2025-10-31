import { getPrisma } from '../config/prisma.js';
import { TenantsService } from './tenants.service.js';

export class CleanupService {
  private prisma = getPrisma();
  private tenantsService = new TenantsService();

  /**
   * Run all cleanup tasks
   * Should be called by cron job or scheduler
   */
  async runCleanupTasks(): Promise<{
    success: boolean;
    results: {
      terminatedTenants: { deleted: number; tenants: string[] };
    };
  }> {
    console.log('🧹 Starting scheduled cleanup tasks...');
    
    const results = {
      terminatedTenants: { deleted: 0, tenants: [] as string[] },
    };

    try {
      // Cleanup 1: Delete terminated tenants older than 5 minutes (TESTING - change to 14 days for production!)
      console.log('📋 Checking for terminated tenants older than 5 minutes (TESTING MODE)...');
      const tenantCleanup = await this.tenantsService.cleanupTerminatedTenants();
      results.terminatedTenants = tenantCleanup;
      
      if (tenantCleanup.deleted > 0) {
        console.log(`✅ Deleted ${tenantCleanup.deleted} terminated tenant(s)`);
      } else {
        console.log('ℹ️  No terminated tenants to delete');
      }

      // Add more cleanup tasks here in the future
      // - Cleanup old logs
      // - Cleanup expired tokens
      // - Cleanup orphaned records
      // etc.

      console.log('✅ Cleanup tasks completed successfully\n');
      
      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cleanup status (what will be cleaned up)
   */
  async getCleanupStatus(): Promise<{
    terminatedTenantsToDelete: number;
    oldestTermination: Date | null;
  }> {
    // ⚠️ TESTING: 5 minutes for quick testing - change back to 14 days for production!
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const terminatedTenants = await this.prisma.user.findMany({
      where: {
        role: 'tenant' as any,
        status: 'inactive',
        terminated_at: {
          not: null,
          lte: fiveMinutesAgo,
        },
      },
      select: {
        terminated_at: true,
      },
      orderBy: {
        terminated_at: 'asc',
      },
    });

    return {
      terminatedTenantsToDelete: terminatedTenants.length,
      oldestTermination: terminatedTenants.length > 0 
        ? terminatedTenants[0].terminated_at 
        : null,
    };
  }
}

