#!/usr/bin/env node

/**
 * Cleanup Script: Permanently Delete Soft-Deleted Messages
 * 
 * This script permanently deletes all notifications that were previously
 * soft-deleted (have entries in deleted_by_users array).
 * 
 * Usage: 
 *   npm run cleanup:soft-deleted
 *   or: node scripts/cleanup-soft-deleted-messages.js
 */

import { PrismaClient } from '@prisma/client';
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

async function cleanupSoftDeletedMessages() {
  try {
    console.log('🧹 Starting cleanup of soft-deleted messages...\n');
    
    // Find all notifications that have deleted_by_users array with entries
    const softDeletedNotifications = await prisma.notification.findMany({
      where: {
        deleted_by_users: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        deleted_by_users: true,
        created_at: true,
        sender_id: true,
        recipient_id: true,
      },
    });

    // Filter to only those that actually have user IDs in the array
    const toDelete = softDeletedNotifications.filter(notif => {
      let deletedByUsers = [];
      if (notif.deleted_by_users) {
        if (Array.isArray(notif.deleted_by_users)) {
          deletedByUsers = notif.deleted_by_users;
        } else if (typeof notif.deleted_by_users === 'string') {
          try {
            deletedByUsers = JSON.parse(notif.deleted_by_users);
          } catch {
            deletedByUsers = [];
          }
        }
      }
      return Array.isArray(deletedByUsers) && deletedByUsers.length > 0;
    });

    console.log(`📊 Found ${toDelete.length} soft-deleted notifications to permanently delete\n`);

    if (toDelete.length === 0) {
      console.log('✅ No soft-deleted messages to clean up');
      await prisma.$disconnect();
      return { deleted: 0 };
    }

    // Show preview of what will be deleted
    console.log('📋 Preview of notifications to be deleted:');
    toDelete.slice(0, 10).forEach((notif, index) => {
      let deletedByUsers = [];
      if (notif.deleted_by_users) {
        if (Array.isArray(notif.deleted_by_users)) {
          deletedByUsers = notif.deleted_by_users;
        } else if (typeof notif.deleted_by_users === 'string') {
          try {
            deletedByUsers = JSON.parse(notif.deleted_by_users);
          } catch {
            deletedByUsers = [];
          }
        }
      }
      console.log(`  ${index + 1}. ID: ${notif.id}, Title: ${notif.title || 'N/A'}, Created: ${new Date(notif.created_at).toLocaleString()}, Deleted by: ${deletedByUsers.length} user(s)`);
    });
    if (toDelete.length > 10) {
      console.log(`  ... and ${toDelete.length - 10} more`);
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete these notifications from the database!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get IDs to delete
    const idsToDelete = toDelete.map(n => n.id);

    // Delete all soft-deleted notifications
    const deleteResult = await prisma.notification.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    console.log(`\n✅ Successfully permanently deleted ${deleteResult.count} soft-deleted notifications`);
    console.log('🎉 Cleanup completed!');

    return { deleted: deleteResult.count };

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupSoftDeletedMessages()
  .then((result) => {
    console.log(`\n✨ Script execution completed. Deleted ${result.deleted} notifications.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });

