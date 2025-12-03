-- ============================================================================
-- Enhanced Messaging + Notification System Migration
-- ============================================================================
-- This migration adds comprehensive tables and features for a modern
-- messaging and notification system with presence, typing, reactions, etc.

-- ============================================================================
-- 1. ENHANCED MESSAGING TABLES
-- ============================================================================

-- Add presence status to users table (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS presence_status VARCHAR(20) DEFAULT 'offline';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS presence_message VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS typing_conversation_id UUID;

-- Create presence tracking table
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'offline',
    message VARCHAR(255),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_user_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction_type VARCHAR(50) NOT NULL, -- 'like', 'love', 'laugh', 'wow', 'sad', 'angry', 'thumbs_up', 'thumbs_down', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_message_reactions_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Pinned messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    message_id UUID NOT NULL,
    pinned_by UUID NOT NULL,
    pinned_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,
    
    CONSTRAINT fk_pinned_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_pinned_messages_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_pinned_messages_user FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_conversation_id ON pinned_messages(conversation_id);

-- Message delivery tracking
CREATE TABLE IF NOT EXISTS message_delivery_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    CONSTRAINT fk_message_delivery_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_delivery_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_message_id ON message_delivery_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_delivery_recipient_id ON message_delivery_status(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_delivery_status ON message_delivery_status(status);

-- Typing indicators table (for persistence/debouncing)
CREATE TABLE IF NOT EXISTS typing_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    is_typing BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_typing_indicators_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_typing_indicators_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation_id ON typing_indicators(conversation_id);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_user_id ON typing_indicators(user_id);

-- Conversation metadata (unread counts, last message, etc.)
CREATE TABLE IF NOT EXISTS conversation_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    unread_count INTEGER DEFAULT 0,
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_conversation_metadata_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_metadata_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_metadata_conversation_id ON conversation_metadata(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_user_id ON conversation_metadata(user_id);

-- Message edit history (track edits)
CREATE TABLE IF NOT EXISTS message_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    edited_content TEXT NOT NULL,
    edited_at TIMESTAMPTZ DEFAULT NOW(),
    edited_by UUID NOT NULL,
    
    CONSTRAINT fk_message_edit_history_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_edit_history_user FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id ON message_edit_history(message_id);

-- Add edit tracking to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID;

-- Add reply constraint
ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS fk_messages_reply_to FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. ENHANCED NOTIFICATION TABLES
-- ============================================================================

-- Notification categories enum (extend existing if needed)
-- Categories: Financial, Maintenance, Leasing, Legal, Operations, System, Messages, Activity/Events

-- Notification preferences per category
CREATE TABLE IF NOT EXISTS notification_category_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    channels JSONB DEFAULT '["app"]', -- ["app", "email", "sms", "push"]
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    priority_threshold VARCHAR(20) DEFAULT 'medium', -- Only notify for this priority and above
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_notification_category_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_category_preferences_user_id ON notification_category_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_category_preferences_category ON notification_category_preferences(category);

-- Push notification tokens (for Supabase Realtime push notifications)
CREATE TABLE IF NOT EXISTS push_notification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'web', 'ios', 'android'
    device_id VARCHAR(255),
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_push_notification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_user_id ON push_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_token ON push_notification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_platform ON push_notification_tokens(platform);

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL, -- 'app', 'email', 'sms', 'push'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_notification_delivery_log_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_delivery_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_user_id ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);

-- Notification targeting rules (for system-wide notifications)
CREATE TABLE IF NOT EXISTS notification_targeting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID,
    target_type VARCHAR(50) NOT NULL, -- 'role', 'property', 'unit', 'tenant', 'staff', 'all'
    target_ids JSONB, -- Array of IDs (role names, property IDs, etc.)
    filters JSONB, -- Additional filters
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_notification_targeting_rules_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_targeting_rules_notification_id ON notification_targeting_rules(notification_id);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
    VALUES (NEW.id, COALESCE(NEW.presence_status, 'offline'), NOW(), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = COALESCE(NEW.presence_status, 'offline'),
        last_seen_at = CASE WHEN NEW.presence_status != 'offline' THEN NOW() ELSE user_presence.last_seen_at END,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user presence updates
DROP TRIGGER IF EXISTS trigger_update_user_presence ON users;
CREATE TRIGGER trigger_update_user_presence
    AFTER INSERT OR UPDATE OF presence_status, last_seen_at ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_presence();

-- Function to update conversation metadata when message is created
CREATE OR REPLACE FUNCTION update_conversation_metadata_on_message()
RETURNS TRIGGER AS $$
DECLARE
    participant_record RECORD;
BEGIN
    -- Update metadata for all participants except sender
    FOR participant_record IN 
        SELECT user_id FROM conversation_participants 
        WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
    LOOP
        INSERT INTO conversation_metadata (conversation_id, user_id, unread_count, updated_at)
        VALUES (NEW.conversation_id, participant_record.user_id, 1, NOW())
        ON CONFLICT (conversation_id, user_id)
        DO UPDATE SET
            unread_count = conversation_metadata.unread_count + 1,
            updated_at = NOW();
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for conversation metadata updates
DROP TRIGGER IF EXISTS trigger_update_conversation_metadata ON messages;
CREATE TRIGGER trigger_update_conversation_metadata
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.conversation_id IS NOT NULL)
    EXECUTE FUNCTION update_conversation_metadata_on_message();

-- Function to update message delivery status
CREATE OR REPLACE FUNCTION create_message_delivery_status()
RETURNS TRIGGER AS $$
DECLARE
    recipient_record RECORD;
BEGIN
    -- Create delivery status for all recipients
    FOR recipient_record IN 
        SELECT recipient_id FROM message_recipients WHERE message_id = NEW.id
    LOOP
        INSERT INTO message_delivery_status (message_id, recipient_id, status, sent_at)
        VALUES (NEW.id, recipient_record.recipient_id, 'sent', NEW.sent_at)
        ON CONFLICT (message_id, recipient_id) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message delivery status
DROP TRIGGER IF EXISTS trigger_create_message_delivery_status ON messages;
CREATE TRIGGER trigger_create_message_delivery_status
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.status = 'sent')
    EXECUTE FUNCTION create_message_delivery_status();

-- ============================================================================
-- 4. UPDATE EXISTING TABLES
-- ============================================================================

-- Ensure conversations table has all needed fields
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS group_avatar TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Ensure messages table has all needed fields
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_receipt_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;

-- Add conversation_id index if not exists
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Ensure notifications table has proper category support
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS badge_count INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sound VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_buttons JSONB;

-- ============================================================================
-- 5. INITIAL DATA
-- ============================================================================

-- Create default notification category preferences for existing users
INSERT INTO notification_category_preferences (user_id, category, enabled, channels)
SELECT id, category, true, '["app", "email", "push"]'::jsonb
FROM users
CROSS JOIN (SELECT unnest(ARRAY['Financial', 'Maintenance', 'Leasing', 'Legal', 'Operations', 'System', 'Messages', 'Activity']) AS category) categories
ON CONFLICT (user_id, category) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE user_presence IS 'Tracks user online/offline presence and last seen';
COMMENT ON TABLE message_reactions IS 'User reactions to messages (likes, emojis)';
COMMENT ON TABLE pinned_messages IS 'Pinned messages in conversations';
COMMENT ON TABLE message_delivery_status IS 'Detailed delivery status for each message recipient';
COMMENT ON TABLE typing_indicators IS 'Persistent typing indicators for conversations';
COMMENT ON TABLE conversation_metadata IS 'Per-user conversation metadata (unread counts, mute status, etc.)';
COMMENT ON TABLE message_edit_history IS 'History of message edits';
COMMENT ON TABLE notification_category_preferences IS 'User preferences for notification categories';
COMMENT ON TABLE push_notification_tokens IS 'Push notification tokens for Supabase Realtime push notifications';
COMMENT ON TABLE notification_delivery_log IS 'Delivery tracking for notifications across channels';
COMMENT ON TABLE notification_targeting_rules IS 'Rules for targeting notifications to specific user groups';

