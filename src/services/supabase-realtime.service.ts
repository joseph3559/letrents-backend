import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Enhanced Supabase Realtime Service
 * Handles all real-time communication for messaging and notifications
 * 
 * Features:
 * - Message broadcasting
 * - Presence tracking
 * - Typing indicators
 * - Read receipts
 * - Notification delivery
 * - Typing status updates
 */
class SupabaseRealtimeService {
  private supabase: SupabaseClient | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelSubscribers: Map<string, Set<() => void>> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ Supabase credentials not found. Realtime features will be disabled.');
      console.warn('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      console.log('✅ Supabase Realtime service initialized');
    } catch (error) {
      console.error('❌ Error initializing Supabase:', error);
    }
  }

  /**
   * Check if Supabase is initialized
   */
  isInitialized(): boolean {
    return this.supabase !== null;
  }

  /**
   * Get or create a Realtime channel
   */
  private getOrCreateChannel(channelName: string): RealtimeChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    const channel = this.supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: '' },
      },
    });

    // Subscribe to the channel
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Channel ${channelName} subscribed`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Channel ${channelName} error`);
      }
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Cleanup channels
   */
  async cleanup() {
    for (const [name, channel] of this.channels) {
      try {
        await this.supabase?.removeChannel(channel);
        this.channels.delete(name);
        this.channelSubscribers.delete(name);
      } catch (error) {
        console.error(`Error removing channel ${name}:`, error);
      }
    }
  }

  // ============================================================================
  // MESSAGING METHODS
  // ============================================================================

  /**
   * Publish a new message
   */
  async publishMessage(message: any): Promise<boolean> {
    if (!this.supabase) {
      console.warn('⚠️ Supabase not initialized. Cannot publish message.');
      return false;
    }

    try {
      const recipients = message.recipients || [];
      
      // Publish to each recipient's channel
      for (const recipientId of recipients) {
        const channel = this.getOrCreateChannel(`messages:${recipientId}`);
        
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            ...message,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Also publish to conversation channel if exists
      if (message.conversation_id) {
        const conversationChannel = this.getOrCreateChannel(`conversation:${message.conversation_id}`);
        await conversationChannel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            ...message,
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Message published to Supabase Realtime`);
      return true;
    } catch (error) {
      console.error('Error publishing message to Supabase:', error);
      return false;
    }
  }

  /**
   * Publish message update (edit)
   */
  async publishMessageUpdate(message: any): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      if (message.conversation_id) {
        const channel = this.getOrCreateChannel(`conversation:${message.conversation_id}`);
        await channel.send({
          type: 'broadcast',
          event: 'message_updated',
          payload: {
            ...message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return true;
    } catch (error) {
      console.error('Error publishing message update:', error);
      return false;
    }
  }

  /**
   * Publish message deletion
   */
  async publishMessageDeletion(messageId: string, conversationId: string, deletedForEveryone: boolean): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      if (conversationId) {
        const channel = this.getOrCreateChannel(`conversation:${conversationId}`);
        await channel.send({
          type: 'broadcast',
          event: 'message_deleted',
          payload: {
            messageId,
            deletedForEveryone,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return true;
    } catch (error) {
      console.error('Error publishing message deletion:', error);
      return false;
    }
  }

  /**
   * Publish read receipt
   */
  async publishReadStatus(senderId: string, messageId: string, readBy: string, readAt: Date): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const channel = this.getOrCreateChannel(`read_status:${senderId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'message_read',
        payload: {
          messageId,
          readBy,
          readAt: readAt.toISOString(),
          timestamp: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error publishing read status:', error);
      return false;
    }
  }

  /**
   * Publish message reaction
   */
  async publishReaction(messageId: string, conversationId: string, reactionType: string, userId: string, added: boolean): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      if (conversationId) {
        const channel = this.getOrCreateChannel(`conversation:${conversationId}`);
        await channel.send({
          type: 'broadcast',
          event: added ? 'reaction_added' : 'reaction_removed',
          payload: {
            messageId,
            reactionType,
            userId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return true;
    } catch (error) {
      console.error('Error publishing reaction:', error);
      return false;
    }
  }

  // ============================================================================
  // PRESENCE METHODS
  // ============================================================================

  /**
   * Publish presence update
   */
  async publishPresenceUpdate(userId: string, status: string, message?: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // Publish to user's presence channel
      const channel = this.getOrCreateChannel(`presence:${userId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'presence_updated',
        payload: {
          userId,
          status,
          message,
          lastSeenAt: status === 'offline' ? new Date().toISOString() : null,
          timestamp: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error publishing presence update:', error);
      return false;
    }
  }

  // ============================================================================
  // TYPING INDICATOR METHODS
  // ============================================================================

  /**
   * Publish typing indicator
   */
  async publishTypingIndicator(
    conversationId: string,
    userId: string,
    recipientIds: string[],
    isTyping: boolean
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // Publish to each recipient's typing channel
      for (const recipientId of recipientIds) {
        const channel = this.getOrCreateChannel(`typing:${recipientId}`);
        
        await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            conversationId,
            userId,
            isTyping,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Error publishing typing indicator:', error);
      return false;
    }
  }

  // ============================================================================
  // NOTIFICATION METHODS
  // ============================================================================

  /**
   * Publish a notification
   */
  async publishNotification(notification: any): Promise<boolean> {
    if (!this.supabase) {
      console.warn('⚠️ Supabase not initialized. Cannot publish notification.');
      return false;
    }

    try {
      const channel = this.getOrCreateChannel(`notifications:${notification.recipient_id}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'new_notification',
        payload: {
          ...notification,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`✅ Notification published to Supabase Realtime for user ${notification.recipient_id}`);
      return true;
    } catch (error) {
      console.error('Error publishing notification to Supabase:', error);
      return false;
    }
  }

  /**
   * Publish notification count update
   */
  async publishNotificationCount(recipientId: string, unreadCount: number): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const channel = this.getOrCreateChannel(`notifications:${recipientId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'notification_count_updated',
        payload: {
          unreadCount,
          timestamp: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Error publishing notification count:', error);
      return false;
    }
  }

  /**
   * Publish notification read status
   */
  async publishNotificationRead(notificationId: string, recipientId: string, senderId?: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // Notify recipient
      const recipientChannel = this.getOrCreateChannel(`notifications:${recipientId}`);
      await recipientChannel.send({
        type: 'broadcast',
        event: 'notification_read',
        payload: {
          notificationId,
          timestamp: new Date().toISOString(),
        },
      });

      // Notify sender if exists
      if (senderId) {
        const senderChannel = this.getOrCreateChannel(`notifications:${senderId}`);
        await senderChannel.send({
          type: 'broadcast',
          event: 'notification_read_by_recipient',
          payload: {
            notificationId,
            readBy: recipientId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Error publishing notification read status:', error);
      return false;
    }
  }

  /**
   * Publish conversation update
   */
  async publishConversationUpdate(conversationId: string, participants: string[], data: any): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const channel = this.getOrCreateChannel(`conversation:${conversationId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'conversation_updated',
        payload: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      });

      // Also notify each participant
      for (const participantId of participants) {
        const participantChannel = this.getOrCreateChannel(`conversations:${participantId}`);
        await participantChannel.send({
          type: 'broadcast',
          event: 'conversation_updated',
          payload: {
            conversationId,
            ...data,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Error publishing conversation update:', error);
      return false;
    }
  }
}

// Export singleton instance
export const supabaseRealtimeService = new SupabaseRealtimeService();
