import { createClient } from '@supabase/supabase-js';
/**
 * Supabase Realtime Service
 * Replaces Firebase Realtime Database and Socket.io for real-time messaging
 */
class SupabaseRealtimeService {
    supabase = null;
    channels = new Map();
    constructor() {
        this.initialize();
    }
    initialize() {
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
            });
            console.log('✅ Supabase Realtime service initialized');
        }
        catch (error) {
            console.error('❌ Error initializing Supabase:', error);
        }
    }
    /**
     * Check if Supabase is initialized
     */
    isInitialized() {
        return this.supabase !== null;
    }
    /**
     * Publish a notification/message update to Supabase Realtime
     * This will trigger real-time updates for subscribed clients
     */
    async publishNotification(notification) {
        if (!this.supabase) {
            console.warn('⚠️ Supabase not initialized. Cannot publish notification.');
            return false;
        }
        try {
            // Use Supabase Realtime to broadcast the notification
            // We'll use the 'notifications' channel
            const channel = this.getOrCreateChannel('notifications');
            await channel.send({
                type: 'broadcast',
                event: 'new_notification',
                payload: notification,
            });
            console.log(`✅ Notification published to Supabase Realtime for user ${notification.recipient_id}`);
            return true;
        }
        catch (error) {
            console.error('Error publishing notification to Supabase:', error);
            return false;
        }
    }
    /**
     * Publish a message update
     */
    async publishMessage(message) {
        if (!this.supabase) {
            console.warn('⚠️ Supabase not initialized. Cannot publish message.');
            return false;
        }
        try {
            const channel = this.getOrCreateChannel('messages');
            await channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: message,
            });
            console.log(`✅ Message published to Supabase Realtime`);
            return true;
        }
        catch (error) {
            console.error('Error publishing message to Supabase:', error);
            return false;
        }
    }
    /**
     * Publish read status update
     */
    async publishReadStatus(senderId, messageId, readBy, readAt) {
        if (!this.supabase) {
            return false;
        }
        try {
            const channel = this.getOrCreateChannel(`read_status:${senderId}`);
            await channel.send({
                type: 'broadcast',
                event: 'message_read',
                payload: {
                    messageId,
                    readBy,
                    readAt: readAt.toISOString(),
                },
            });
            return true;
        }
        catch (error) {
            console.error('Error publishing read status:', error);
            return false;
        }
    }
    /**
     * Get or create a Realtime channel
     */
    getOrCreateChannel(channelName) {
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName);
        }
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        const channel = this.supabase.channel(channelName);
        // Subscribe to the channel before using it
        channel.subscribe();
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
            }
            catch (error) {
                console.error(`Error removing channel ${name}:`, error);
            }
        }
    }
}
// Export singleton instance
export const supabaseRealtimeService = new SupabaseRealtimeService();
