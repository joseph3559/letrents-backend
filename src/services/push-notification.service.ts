import { getPrisma } from '../config/prisma.js';
import { supabaseRealtimeService } from './supabase-realtime.service.js';
import admin from 'firebase-admin';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const prisma = getPrisma();

// Initialize Firebase Admin SDK with service account
let firebaseAdminInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return;
  }

  try {
    // Check if Firebase Admin is already initialized
    try {
      if (admin.apps && admin.apps.length > 0) {
        console.log(`✅ Firebase Admin SDK already initialized`);
        firebaseAdminInitialized = true;
        return;
      }
    } catch (e) {
      // admin.apps might not be available yet, continue to initialize
    }

    let serviceAccount: any = null;
    let credentialSource: string = '';

    // Method 1: Use GOOGLE_APPLICATION_CREDENTIALS (standard Firebase env var)
    // This is the recommended approach for production
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const fileContent = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
        serviceAccount = JSON.parse(fileContent);
        credentialSource = `GOOGLE_APPLICATION_CREDENTIALS (${process.env.GOOGLE_APPLICATION_CREDENTIALS})`;
      } catch (e) {
        console.warn(`⚠️ Failed to load credentials from GOOGLE_APPLICATION_CREDENTIALS: ${e}`);
      }
    }

    // Method 2: Use FIREBASE_SERVICE_ACCOUNT_KEY (JSON content as env var)
    // Best for production - store JSON content directly in environment variable
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        // Handle both plain JSON string and base64 encoded
        let jsonString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        try {
          // Try base64 decode first (common in CI/CD systems)
          jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
        } catch (e) {
          // Not base64, use as-is
        }
        serviceAccount = JSON.parse(jsonString);
        credentialSource = 'FIREBASE_SERVICE_ACCOUNT_KEY (environment variable)';
      } catch (e) {
        console.warn(`⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${e}`);
      }
    }

    // Method 3: Use FIREBASE_SERVICE_ACCOUNT_PATH (custom path env var)
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      try {
        const fileContent = readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
        serviceAccount = JSON.parse(fileContent);
        credentialSource = `FIREBASE_SERVICE_ACCOUNT_PATH (${process.env.FIREBASE_SERVICE_ACCOUNT_PATH})`;
      } catch (e) {
        console.warn(`⚠️ Failed to load credentials from FIREBASE_SERVICE_ACCOUNT_PATH: ${e}`);
      }
    }

    // Method 4: Try default file paths (for local development)
    if (!serviceAccount) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      const possiblePaths = [
        path.join(__dirname, '../../letrents-firebase-adminsdk-fbsvc-0a3f22a51b.json'), // backend/letrents-firebase-adminsdk...
        path.join(__dirname, '../../../letrents-firebase-adminsdk-fbsvc-0a3f22a51b.json'), // project root
      ];
      
      for (const tryPath of possiblePaths) {
        try {
          const fileContent = readFileSync(tryPath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
          credentialSource = `file path (${tryPath})`;
          break;
        } catch (e) {
          // Continue to next path
          continue;
        }
      }
    }
    
    if (!serviceAccount) {
      throw new Error(
        'Firebase service account credentials not found. ' +
        'Please set one of: GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_KEY, ' +
        'FIREBASE_SERVICE_ACCOUNT_PATH, or place the JSON file in the backend directory.'
      );
    }

    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`✅ Firebase Admin SDK initialized with credentials from: ${credentialSource}`);
    
    firebaseAdminInitialized = true;
  } catch (error: any) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    console.warn('⚠️ FCM push notifications will not work until Firebase Admin SDK is properly configured');
    console.warn('   For production, set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
  }
}

interface PushNotificationData {
  title: string;
  body: string;
  notificationType?: string;
  category?: string;
  priority?: 'high' | 'normal';
  data?: Record<string, any>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  actionUrl?: string;
}

/**
 * Send FCM push notification to a single device token
 * Uses FCM V1 API with Firebase Admin SDK (requires service account JSON)
 */
async function sendFCMNotification(
  token: string,
  platform: string,
  notification: PushNotificationData
): Promise<boolean> {
  try {
    // Initialize Firebase Admin SDK if not already initialized
    initializeFirebaseAdmin();
    
    // Check if Firebase Admin is initialized
    if (!admin.apps || admin.apps.length === 0) {
      console.warn('⚠️ Firebase Admin SDK not initialized - skipping FCM push notification');
      console.warn('   This usually means the service account JSON file was not found or is invalid');
      return false;
    }
    
    console.log(`📤 Attempting to send FCM notification to ${platform} device...`);
    console.log(`   Token prefix: ${token.substring(0, 30)}...`);

    // Prepare data payload (all values must be strings for FCM)
    const dataPayload: Record<string, string> = {
      notification_type: notification.notificationType || 'push',
      category: notification.category || 'general',
      action_url: notification.actionUrl || '',
    };

    // Add any additional data (convert all values to strings)
    if (notification.data) {
      Object.keys(notification.data).forEach(key => {
        const value = notification.data![key];
        dataPayload[key] = typeof value === 'string' ? value : JSON.stringify(value);
      });
    }
    
    // Ensure we include notification ID if available
    if (notification.data?.notificationId) {
      dataPayload['id'] = notification.data.notificationId;
    }
    
    // Ensure we include sender_id and recipient_id for messages
    if (notification.data?.sender_id) {
      dataPayload['sender_id'] = notification.data.sender_id;
    }
    if (notification.data?.recipient_id) {
      dataPayload['recipient_id'] = notification.data.recipient_id;
    }

    // Build FCM V1 message
    const message: admin.messaging.Message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataPayload,
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: notification.sound || 'default',
          channelId: 'default', // You may want to create a custom channel
          priority: notification.priority === 'high' ? 'high' : 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': notification.priority === 'high' ? '10' : '5',
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: notification.sound || 'default',
            badge: notification.badge,
            contentAvailable: true,
          },
        },
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.imageUrl || '/icon-192x192.png',
          badge: '/badge-72x72.png',
        },
      },
    };

    // Send using FCM V1 API
    const response = await admin.messaging().send(message);
    
    console.log(`✅ FCM V1 notification sent successfully to ${platform} device: ${response}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error sending FCM V1 notification:`, error);
    console.error(`   Error code: ${error.code || 'unknown'}`);
    console.error(`   Error message: ${error.message || 'unknown'}`);
    console.error(`   Platform: ${platform}`);
    console.error(`   Token prefix: ${token.substring(0, 30)}...`);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.warn(`⚠️ Invalid or unregistered token: ${token.substring(0, 20)}...`);
      // You might want to mark this token as invalid in the database
    } else if (error.code === 'messaging/invalid-argument') {
      console.error(`⚠️ Invalid argument in FCM message. Check notification payload.`);
    } else if (error.code === 'app/invalid-credential') {
      console.error(`⚠️ Firebase Admin SDK credential is invalid. Check service account JSON.`);
    } else if (error.code === 'app/no-app') {
      console.error(`⚠️ Firebase Admin SDK not initialized.`);
    }
    
    return false;
  }
}

/**
 * Supabase Push Notification Service
 * Uses Supabase Realtime for push notifications + FCM for background
 * 
 * For web: Uses Supabase Realtime channels + Browser Push API (handled by client)
 * For mobile: Uses FCM/APNs for background + Supabase Realtime when app is open
 * 
 * Background push notifications are handled via FCM/APNs.
 * In-app notifications are handled via Supabase Realtime broadcasting.
 */
export const pushNotificationService = {
  /**
   * Register push token for a user
   * Token format depends on platform:
   * - web: Web Push subscription JSON (for browser Push API)
   * - ios: APNs token (handled by client when listening to Supabase channels)
   * - android: Push token (handled by client when listening to Supabase channels)
   */
  async registerToken(
    userId: string,
    token: string,
    platform: 'web' | 'ios' | 'android',
    deviceId?: string,
    deviceInfo?: any
  ): Promise<boolean> {
    try {
      await prisma.$executeRaw`
        INSERT INTO push_notification_tokens (
          user_id, token, platform, device_id, device_info, is_active, last_used_at, updated_at
        )
        VALUES (
          ${userId}::uuid,
          ${token},
          ${platform},
          ${deviceId || null},
          ${deviceInfo ? JSON.stringify(deviceInfo) : null}::jsonb,
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, token) DO UPDATE
        SET platform = ${platform},
            device_id = COALESCE(${deviceId || null}, push_notification_tokens.device_id),
            device_info = COALESCE(${deviceInfo ? JSON.stringify(deviceInfo) : null}::jsonb, push_notification_tokens.device_info),
            is_active = true,
            last_used_at = NOW(),
            updated_at = NOW()
      `;
      console.log(`✅ Push token registered for user ${userId} (${platform}) via Supabase`);
      return true;
    } catch (error) {
      console.error(`Error registering push token for user ${userId}:`, error);
      return false;
    }
  },

  /**
   * Unregister push token for a user
   */
  async unregisterToken(userId: string, token?: string): Promise<boolean> {
    try {
      if (token) {
        await prisma.$executeRaw`
          UPDATE push_notification_tokens
          SET is_active = false, updated_at = NOW()
          WHERE user_id = ${userId}::uuid AND token = ${token}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE push_notification_tokens
          SET is_active = false, updated_at = NOW()
          WHERE user_id = ${userId}::uuid
        `;
      }
      console.log(`✅ Push token unregistered for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error unregistering push token for user ${userId}:`, error);
      return false;
    }
  },

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId: string): Promise<Array<{ token: string; platform: string; device_id?: string }>> {
    try {
      const tokens = await prisma.$queryRaw<Array<{ token: string; platform: string; device_id?: string }>>`
        SELECT token, platform, device_id
        FROM push_notification_tokens
        WHERE user_id = ${userId}::uuid AND is_active = true
        ORDER BY last_used_at DESC
      `;
      return tokens || [];
    } catch (error) {
      console.error(`Error getting tokens for user ${userId}:`, error);
      return [];
    }
  },

  /**
   * Send push notification to a user via Supabase Realtime
   * 
   * This broadcasts the notification to the user's notification channel.
   * The client (web/mobile) listens to this channel and displays native
   * notifications when the app is in background/closed.
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData
  ): Promise<{ success: boolean; sent: number; failed: number; errors?: string[] }> {
    try {
      // Check if user has push notifications enabled for this category
      const shouldSend = await this.shouldSendNotification(
        userId,
        notification.category || 'general',
        notification.priority === 'high' ? 'high' : notification.priority || 'medium'
      );

      if (!shouldSend) {
        console.log(`Push notification disabled for user ${userId} (category: ${notification.category || 'general'})`);
        return { success: false, sent: 0, failed: 0 };
      }

      // Get user's tokens for FCM/APNs push notifications
      const tokens = await this.getUserTokens(userId);
      
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      
      // Send FCM push notifications to all registered tokens
      if (tokens.length > 0) {
        for (const tokenInfo of tokens) {
          try {
            const sent = await sendFCMNotification(tokenInfo.token, tokenInfo.platform, notification);
            if (sent) {
              sentCount++;
            } else {
              failedCount++;
              errors.push(`Failed to send to ${tokenInfo.platform} device (check backend logs for details)`);
            }
          } catch (error: any) {
            console.error(`❌ Error sending FCM to token ${tokenInfo.token.substring(0, 30)}...:`, error);
            console.error(`   Error code: ${error.code || 'unknown'}`);
            console.error(`   Error message: ${error.message || 'unknown'}`);
            failedCount++;
            const errorMsg = error.code ? `${error.code}: ${error.message}` : error.message || 'Unknown error';
            errors.push(`Error sending to ${tokenInfo.platform}: ${errorMsg}`);
          }
        }
        console.log(`📱 FCM: Sent ${sentCount}, Failed ${failedCount} for user ${userId}`);
        if (errors.length > 0) {
          console.error(`📱 FCM Errors:`, errors);
        }
      } else {
        console.log(`No active push tokens for user ${userId} - will use Supabase Realtime only`);
      }

      // Always broadcast via Supabase Realtime for in-app notifications (when app is open)
      // This ensures notifications work even if FCM fails or app is open
      const published = await supabaseRealtimeService.publishNotification({
        recipient_id: userId,
        id: notification.data?.notificationId || `push_${Date.now()}`,
        title: notification.title,
        message: notification.body,
        notification_type: notification.notificationType || 'push',
        category: notification.category || 'general',
        priority: notification.priority || 'normal',
        data: notification.data || {},
        image_url: notification.imageUrl,
        sound: notification.sound,
        badge: notification.badge,
        action_url: notification.actionUrl,
        timestamp: new Date().toISOString(),
        push: true, // Flag to indicate this should trigger native push notification
      });

      // Consider successful if FCM sent or Supabase Realtime published
      if (sentCount > 0 || published) {
        const totalSent = sentCount > 0 ? sentCount : (published ? 1 : 0);
        console.log(`✅ Push notification sent to user ${userId} (FCM: ${sentCount}, Supabase: ${published ? 'yes' : 'no'})`);
        return { success: true, sent: totalSent, failed: failedCount, errors: errors.length > 0 ? errors : undefined };
      } else {
        console.warn(`⚠️ Failed to send push notification to user ${userId} (no tokens, Supabase: ${published ? 'yes' : 'no'})`);
        return { success: false, sent: 0, failed: failedCount + (published ? 0 : 1), errors: errors.length > 0 ? errors : undefined };
      }
    } catch (error: any) {
      console.error(`Error sending push notification to user ${userId}:`, error);
      return { success: false, sent: 0, failed: 1, errors: [error.message || 'Unknown error'] };
    }
  },

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData
  ): Promise<{ totalSent: number; totalFailed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    // Send to all users in parallel
    const promises = userIds.map(userId => this.sendToUser(userId, notification));
    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        totalSent += result.value.sent;
        totalFailed += result.value.failed;
      } else {
        totalFailed += 1;
      }
    });

    return { totalSent, totalFailed };
  },

  /**
   * Send push notification based on targeting rules
   */
  async sendToTargets(
    targets: {
      roles?: string[];
      propertyIds?: string[];
      unitIds?: string[];
      userIds?: string[];
      all?: boolean;
    },
    notification: PushNotificationData
  ): Promise<{ totalSent: number; totalFailed: number }> {
    let userIds: string[] = [];

    // Build user query based on targets
    if (targets.all) {
      // Get all active users
      const users = await prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
      userIds = users.map(u => u.id);
    } else {
      const whereClause: any = { status: 'active' };

      if (targets.roles && targets.roles.length > 0) {
        whereClause.role = { in: targets.roles };
      }

      if (targets.propertyIds && targets.propertyIds.length > 0) {
        // Get users associated with properties via staff assignments
        const staffAssignments = await prisma.staffPropertyAssignment.findMany({
          where: {
            property_id: { in: targets.propertyIds },
            status: 'active',
          },
          select: { staff_id: true },
        });
        
        const propertyUserIds = staffAssignments.map(a => a.staff_id);
        
        if (userIds.length > 0) {
          userIds = userIds.filter(id => propertyUserIds.includes(id));
        } else {
          userIds = propertyUserIds;
        }
      }

      if (targets.unitIds && targets.unitIds.length > 0) {
        // Get users associated with units (tenants)
        const unitUsers = await prisma.user.findMany({
          where: {
            assigned_units: {
              some: {
                id: { in: targets.unitIds },
              },
            },
          },
          select: { id: true },
        });
        const unitUserIds = unitUsers.map(u => u.id);
        
        if (userIds.length > 0) {
          userIds = userIds.filter(id => unitUserIds.includes(id));
        } else {
          userIds = unitUserIds;
        }
      }

      if (targets.userIds && targets.userIds.length > 0) {
        if (userIds.length > 0) {
          userIds = userIds.filter(id => targets.userIds!.includes(id));
        } else {
          userIds = targets.userIds;
        }
      }

      // If no specific filters, get users matching base where clause
      if (userIds.length === 0 && Object.keys(whereClause).length > 1) {
        const users = await prisma.user.findMany({
          where: whereClause,
          select: { id: true },
        });
        userIds = users.map(u => u.id);
      }
    }

    if (userIds.length === 0) {
      console.log('No users found for targeting rules');
      return { totalSent: 0, totalFailed: 0 };
    }

    return this.sendToUsers(userIds, notification);
  },

  /**
   * Check user notification preferences before sending
   */
  async shouldSendNotification(
    userId: string,
    category: string,
    priority: string = 'medium'
  ): Promise<boolean> {
    try {
      const preference = await prisma.$queryRaw<Array<{
        enabled: boolean;
        channels: string[];
        priority_threshold: string;
      }>>`
        SELECT enabled, channels, priority_threshold
        FROM notification_category_preferences
        WHERE user_id = ${userId}::uuid AND category = ${category}
      `;

      if (!preference || preference.length === 0) {
        // Default: send if enabled
        return true;
      }

      const prefs = preference[0];

      if (!prefs.enabled) {
        return false;
      }

      // Check if push is enabled for this category
      if (!prefs.channels.includes('push')) {
        return false;
      }

      // Check priority threshold
      const priorityLevels = ['low', 'medium', 'high', 'urgent'];
      const priorityIndex = priorityLevels.indexOf(priority.toLowerCase());
      const thresholdIndex = priorityLevels.indexOf(prefs.priority_threshold?.toLowerCase() || 'medium');

      if (priorityIndex < thresholdIndex) {
        return false;
      }

      return true;
    } catch (error: any) {
      // If table doesn't exist or other DB error, default to sending notifications
      if (error?.meta?.code === '42P01') {
        // Table doesn't exist - this is OK, we'll default to sending
        console.log(`⚠️ Notification preferences table not found - defaulting to send notifications`);
      } else {
        console.error(`Error checking notification preferences for user ${userId}:`, error);
      }
      return true; // Default to sending if error
    }
  },

  /**
   * Log notification delivery
   */
  async logDelivery(
    notificationId: string,
    userId: string,
    channel: 'app' | 'email' | 'sms' | 'push',
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed',
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO notification_delivery_log (
          notification_id, user_id, channel, status, metadata, created_at
        )
        VALUES (
          ${notificationId}::uuid,
          ${userId}::uuid,
          ${channel},
          ${status},
          ${metadata ? JSON.stringify(metadata) : null}::jsonb,
          NOW()
        )
      `;
    } catch (error) {
      console.error('Error logging notification delivery:', error);
    }
  },
};
