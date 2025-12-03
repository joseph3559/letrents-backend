-- ============================================================================
-- LetRents Property Management System - Production Database Schema
-- ============================================================================
-- Professional, clean database schema based on Go backend domain models
-- Follows PostgreSQL best practices and naming conventions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'super_admin',
    'agency_admin',
    'landlord',
    'agent',
    'caretaker',
    'tenant'
);

CREATE TYPE user_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending'
);

CREATE TYPE property_type AS ENUM (
    'residential',
    'commercial',
    'industrial',
    'mixed_use',
    'institutional',
    'vacant_land',
    'hospitality',
    'recreational'
);

CREATE TYPE property_status AS ENUM (
    'active',
    'under_construction',
    'renovation',
    'inactive'
);

CREATE TYPE ownership_type AS ENUM (
    'individual',
    'company',
    'joint'
);

CREATE TYPE unit_type AS ENUM (
    'single_room',
    'double_room',
    'bedsitter',
    'studio',
    'one_bedroom',
    'two_bedroom',
    'three_bedroom',
    'four_bedroom',
    'five_plus_bedroom',
    'servant_quarter',
    'maisonette',
    'penthouse',
    'office_space',
    'retail_shop',
    'kiosk',
    'stall',
    'warehouse',
    'restaurant_space',
    'studio_office',
    'coworking_unit',
    'medical_suite'
);

CREATE TYPE unit_status AS ENUM (
    'vacant',
    'occupied',
    'reserved',
    'maintenance',
    'under_repair',
    'arrears'
);

CREATE TYPE unit_condition AS ENUM (
    'new',
    'excellent',
    'good',
    'fair',
    'poor',
    'needs_repairs',
    'renovated'
);

CREATE TYPE furnishing_type AS ENUM (
    'furnished',
    'unfurnished',
    'semi_furnished'
);

CREATE TYPE utility_billing_type AS ENUM (
    'prepaid',
    'postpaid',
    'inclusive'
);

CREATE TYPE maintenance_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE priority_level AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
);

CREATE TYPE notification_status AS ENUM (
    'unread',
    'read',
    'archived'
);

CREATE TYPE message_status AS ENUM (
    'draft',
    'sent',
    'delivered',
    'read',
    'failed'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Companies table for multi-tenancy
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    email VARCHAR(255),
    phone_number VARCHAR(20),
    website VARCHAR(255),
    street VARCHAR(255),
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    max_properties INTEGER DEFAULT 10,
    max_units INTEGER DEFAULT 100,
    max_tenants INTEGER DEFAULT 100,
    max_staff INTEGER DEFAULT 10,
    settings JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agencies table
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    address TEXT,
    status user_status DEFAULT 'active',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role user_role NOT NULL,
    status user_status DEFAULT 'pending',
    company_id UUID,
    agency_id UUID,
    landlord_id UUID,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    account_locked_until TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    CONSTRAINT users_email_or_phone_required CHECK (
        (email IS NOT NULL AND email != '') OR 
        (phone_number IS NOT NULL AND phone_number != '')
    ),
    CONSTRAINT users_password_required_for_email CHECK (
        (email IS NULL) OR (password_hash IS NOT NULL)
    )
);

-- ============================================================================
-- AUTHENTICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- PROPERTY MANAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type property_type NOT NULL,
    description TEXT,
    
    -- Location
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Ownership
    ownership_type ownership_type DEFAULT 'individual',
    owner_id UUID NOT NULL,
    agency_id UUID,
    
    -- Structure
    number_of_units INTEGER DEFAULT 1,
    number_of_blocks INTEGER,
    number_of_floors INTEGER,
    
    -- Financial
    service_charge_rate DECIMAL(10, 2),
    service_charge_type VARCHAR(20),
    
    -- Features
    amenities JSONB DEFAULT '[]',
    access_control VARCHAR(100),
    maintenance_schedule VARCHAR(100),
    
    -- Status
    status property_status DEFAULT 'active',
    year_built INTEGER,
    last_renovation TIMESTAMPTZ,
    
    -- Media
    documents JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    
    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    unit_type unit_type NOT NULL,
    block_number VARCHAR(20),
    floor_number INTEGER,
    
    -- Physical attributes
    size_square_feet DECIMAL(10, 2),
    size_square_meters DECIMAL(10, 2),
    number_of_bedrooms INTEGER,
    number_of_bathrooms INTEGER,
    has_ensuite BOOLEAN DEFAULT FALSE,
    has_balcony BOOLEAN DEFAULT FALSE,
    has_parking BOOLEAN DEFAULT FALSE,
    parking_spaces INTEGER DEFAULT 0,
    
    -- Financial
    rent_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    deposit_amount DECIMAL(12, 2) NOT NULL,
    deposit_months INTEGER DEFAULT 1,
    
    -- Status
    status unit_status DEFAULT 'vacant',
    condition unit_condition DEFAULT 'good',
    furnishing_type furnishing_type DEFAULT 'unfurnished',
    
    -- Utilities
    water_meter_number VARCHAR(50),
    electric_meter_number VARCHAR(50),
    utility_billing_type utility_billing_type DEFAULT 'postpaid',
    
    -- Features
    in_unit_amenities JSONB DEFAULT '[]',
    appliances JSONB DEFAULT '[]',
    
    -- Current lease
    current_tenant_id UUID,
    lease_start_date DATE,
    lease_end_date DATE,
    lease_type VARCHAR(20),
    
    -- Media
    documents JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    
    -- Valuation
    estimated_value DECIMAL(15, 2),
    market_rent_estimate DECIMAL(12, 2),
    last_valuation_date DATE,
    
    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, unit_number)
);

-- ============================================================================
-- COMMUNICATIONS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'direct',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    role VARCHAR(20) DEFAULT 'participant',
    
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID,
    sender_id UUID NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    priority priority_level DEFAULT 'medium',
    status message_status DEFAULT 'draft',
    sent_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    parent_message_id UUID,
    thread_id UUID,
    template_id UUID,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(message_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    variables JSONB DEFAULT '[]',
    is_global BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID,
    recipient_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    priority priority_level DEFAULT 'medium',
    status notification_status DEFAULT 'unread',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_required BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    action_data JSONB,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    channels JSONB DEFAULT '["app"]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    channels JSONB DEFAULT '["app"]',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, notification_type)
);

-- ============================================================================
-- MAINTENANCE SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL,
    unit_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority priority_level DEFAULT 'medium',
    status maintenance_status DEFAULT 'pending',
    requested_by UUID NOT NULL,
    assigned_to UUID,
    requested_date DATE DEFAULT CURRENT_DATE,
    scheduled_date DATE,
    completed_date DATE,
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    images JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    notes TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    invoice_type VARCHAR(50) NOT NULL,
    issued_by UUID NOT NULL,
    issued_to UUID NOT NULL,
    property_id UUID,
    unit_id UUID,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date DATE,
    status invoice_status DEFAULT 'draft',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TENANT MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    id_number VARCHAR(50),
    nationality VARCHAR(100) DEFAULT 'Kenyan',
    move_in_date DATE,
    lease_type VARCHAR(50) DEFAULT 'fixed_term',
    lease_start_date DATE,
    lease_end_date DATE,
    rent_amount DECIMAL(10, 2),
    deposit_amount DECIMAL(10, 2),
    payment_frequency VARCHAR(20) DEFAULT 'monthly',
    payment_day INTEGER DEFAULT 1,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    preferred_communication_method VARCHAR(20) DEFAULT 'email',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Users constraints
ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id);
ALTER TABLE users ADD CONSTRAINT fk_users_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
ALTER TABLE users ADD CONSTRAINT fk_users_landlord FOREIGN KEY (landlord_id) REFERENCES users(id);
ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- Agencies constraints
ALTER TABLE agencies ADD CONSTRAINT fk_agencies_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- Auth constraints
ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE email_verification_tokens ADD CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_sessions ADD CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Property constraints
ALTER TABLE properties ADD CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE properties ADD CONSTRAINT fk_properties_agency FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE properties ADD CONSTRAINT fk_properties_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Unit constraints
ALTER TABLE units ADD CONSTRAINT fk_units_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE units ADD CONSTRAINT fk_units_current_tenant FOREIGN KEY (current_tenant_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE units ADD CONSTRAINT fk_units_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Communication constraints
ALTER TABLE conversations ADD CONSTRAINT fk_conversations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE conversation_participants ADD CONSTRAINT fk_conversation_participants_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE conversation_participants ADD CONSTRAINT fk_conversation_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT fk_messages_parent FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE message_recipients ADD CONSTRAINT fk_message_recipients_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE message_recipients ADD CONSTRAINT fk_message_recipients_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE message_templates ADD CONSTRAINT fk_message_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- Notification constraints
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Maintenance constraints
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Invoice constraints
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_issued_by FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_issued_to FOREIGN KEY (issued_to) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
ALTER TABLE invoice_line_items ADD CONSTRAINT fk_invoice_line_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

-- Tenant constraints
ALTER TABLE tenant_profiles ADD CONSTRAINT fk_tenant_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id);

-- Property indexes
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_agency_id ON properties(agency_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);

-- Unit indexes
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_current_tenant_id ON units(current_tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(unit_type);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_is_read ON message_recipients(is_read);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_property_id ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_unit_id ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assigned_to ON maintenance_requests(assigned_to);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_issued_to ON invoices(issued_to);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_profiles_updated_at BEFORE UPDATE ON tenant_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert default company
INSERT INTO companies (id, name, email, phone_number) 
VALUES ('00000000-0000-0000-0000-000000000001', 'LetRents Default Company', 'admin@letrents.com', '+254700000000')
ON CONFLICT (id) DO NOTHING;

-- Insert super admin user
INSERT INTO users (
    id, email, password_hash, first_name, last_name, role, status, email_verified, company_id
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin@letrents.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Super',
    'Admin',
    'super_admin',
    'active',
    true,
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('2024.01.01_production_schema');

-- End of schema
