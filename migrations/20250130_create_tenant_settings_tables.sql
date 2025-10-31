-- Tenant Settings Migration
-- Creates tables for tenant preferences, notifications, and security settings

-- Tenant Preferences Table
CREATE TABLE IF NOT EXISTS tenant_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Communication Preferences
    enable_email BOOLEAN DEFAULT true,
    enable_sms BOOLEAN DEFAULT true,
    enable_push_notifications BOOLEAN DEFAULT false,
    primary_contact_method VARCHAR(50) DEFAULT 'email',
    
    -- Display Preferences
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(10) DEFAULT 'KES',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    
    -- Payment Preferences
    auto_pay_rent BOOLEAN DEFAULT false,
    payment_reminder_days INTEGER DEFAULT 7,
    default_payment_method VARCHAR(50) DEFAULT 'mpesa',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Tenant Notification Settings Table
CREATE TABLE IF NOT EXISTS tenant_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Email Notifications
    email_payment_reminders BOOLEAN DEFAULT true,
    email_payment_receipts BOOLEAN DEFAULT true,
    email_lease_updates BOOLEAN DEFAULT true,
    email_maintenance_updates BOOLEAN DEFAULT true,
    email_property_announcements BOOLEAN DEFAULT true,
    email_messages_from_landlord BOOLEAN DEFAULT true,
    email_marketing BOOLEAN DEFAULT false,
    
    -- SMS Notifications
    sms_payment_due_alerts BOOLEAN DEFAULT true,
    sms_urgent_maintenance BOOLEAN DEFAULT true,
    sms_security_alerts BOOLEAN DEFAULT true,
    
    -- Notification Frequency
    email_digest_frequency VARCHAR(20) DEFAULT 'instant', -- instant, hourly, daily, weekly
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Security Sessions Table
CREATE TABLE IF NOT EXISTS security_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    device_type VARCHAR(100), -- browser, mobile, tablet
    device_name VARCHAR(255), -- Chrome on Windows, Safari on iPhone
    ip_address VARCHAR(45),
    location VARCHAR(255), -- City, Country
    user_agent TEXT,
    is_current BOOLEAN DEFAULT false,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    UNIQUE(session_id)
);

-- Security Activity Log Table
CREATE TABLE IF NOT EXISTS security_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- login, logout, password_change, 2fa_enabled, etc.
    activity_description TEXT,
    device_type VARCHAR(100),
    device_name VARCHAR(255),
    ip_address VARCHAR(45),
    location VARCHAR(255),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Two-Factor Authentication Table
CREATE TABLE IF NOT EXISTS two_factor_auth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- sms, authenticator_app
    is_enabled BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),
    secret_key VARCHAR(255),
    backup_codes TEXT[], -- Array of backup codes
    enabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, method)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenant_preferences_user_id ON tenant_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_preferences_company_id ON tenant_preferences(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON tenant_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_user_id ON security_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_session_id ON security_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_security_activity_user_id ON security_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_activity_created_at ON security_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user_id ON two_factor_auth(user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_tenant_preferences_updated_at BEFORE UPDATE ON tenant_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_notification_settings_updated_at BEFORE UPDATE ON tenant_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_two_factor_auth_updated_at BEFORE UPDATE ON two_factor_auth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE tenant_preferences IS 'Stores tenant user preferences for communication, display, and payment settings';
COMMENT ON TABLE tenant_notification_settings IS 'Stores tenant notification preferences for email and SMS alerts';
COMMENT ON TABLE security_sessions IS 'Tracks active user sessions across devices for security management';
COMMENT ON TABLE security_activity_log IS 'Logs all security-related activities for audit trail';
COMMENT ON TABLE two_factor_auth IS 'Stores two-factor authentication settings for users';

