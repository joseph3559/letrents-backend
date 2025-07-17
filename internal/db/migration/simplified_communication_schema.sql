-- Simplified Communication System Database Schema
-- This schema works with existing tables and creates only what's needed

-- Create properties table if it doesn't exist (simplified)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create units table if it doesn't exist (simplified)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    unit_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'support')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'muted')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Participants Table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    UNIQUE(conversation_id, user_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('individual', 'group', 'broadcast')),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'delivered', 'read', 'failed')),
    sent_via JSONB DEFAULT '["app"]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    thread_id UUID,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Recipients Table
CREATE TABLE IF NOT EXISTS message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (recipient_type IN ('user', 'group', 'role')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    delivery_channel VARCHAR(20) NOT NULL CHECK (delivery_channel IN ('email', 'sms', 'app', 'whatsapp')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Message Attachments Table
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    thumbnail_url TEXT,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Generated Content Table
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('reply_suggestion', 'summary', 'translation', 'sentiment')),
    original_content TEXT,
    generated_content TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    model_used VARCHAR(100),
    prompt_used TEXT,
    user_feedback VARCHAR(20) CHECK (user_feedback IN ('helpful', 'not_helpful', 'inappropriate')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update message_templates to remove foreign key constraint issue
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_created_by_fkey;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS created_by UUID;

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_status ON message_recipients(status);

CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_unit_id ON conversations(unit_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_usage_count ON message_templates(usage_count);

-- Insert a system user for templates if it doesn't exist
INSERT INTO users (id, email, first_name, last_name, role, status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system@letrents.com',
    'System',
    'User',
    'system',
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add some default system templates
DELETE FROM message_templates WHERE is_system_template = TRUE;

INSERT INTO message_templates (name, subject, content, category, variables, created_by, is_system_template, usage_count) VALUES
(
    'Rent Payment Reminder',
    'Rent Payment Reminder - {{property_name}} Unit {{unit_number}}',
    'Dear {{tenant_name}},

This is a friendly reminder that your rent payment for {{property_name}} Unit {{unit_number}} is due on {{due_date}}.

Amount Due: {{rent_amount}}
Payment Methods: {{payment_methods}}

Please contact us if you have any questions or concerns.

Best regards,
{{sender_name}}
{{company_name}}',
    'rent_reminder',
    '["tenant_name", "property_name", "unit_number", "due_date", "rent_amount", "payment_methods", "sender_name", "company_name"]'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    TRUE,
    0
),
(
    'Maintenance Request Acknowledgment',
    'Maintenance Request Received - {{property_name}} Unit {{unit_number}}',
    'Dear {{tenant_name}},

We have received your maintenance request for {{property_name}} Unit {{unit_number}}.

Request Details:
- Issue: {{issue_description}}
- Priority: {{priority_level}}
- Submitted: {{submission_date}}

Our maintenance team will address this within {{estimated_timeline}}. We will keep you updated on the progress.

Thank you for reporting this issue.

Best regards,
{{sender_name}}
{{company_name}}',
    'maintenance',
    '["tenant_name", "property_name", "unit_number", "issue_description", "priority_level", "submission_date", "estimated_timeline", "sender_name", "company_name"]'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    TRUE,
    0
),
(
    'Welcome New Tenant',
    'Welcome to {{property_name}} - Important Information',
    'Dear {{tenant_name}},

Welcome to {{property_name}}! We are excited to have you as our tenant.

Your Unit: {{unit_number}}
Move-in Date: {{move_in_date}}
Lease Start Date: {{lease_start_date}}

Important Contacts:
- Property Manager: {{property_manager_name}} - {{property_manager_phone}}
- Emergency Maintenance: {{emergency_phone}}
- Office Hours: {{office_hours}}

Please don''t hesitate to reach out if you have any questions or need assistance.

Welcome home!

{{sender_name}}
{{company_name}}',
    'welcome',
    '["tenant_name", "property_name", "unit_number", "move_in_date", "lease_start_date", "property_manager_name", "property_manager_phone", "emergency_phone", "office_hours", "sender_name", "company_name"]'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    TRUE,
    0
);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 