-- LetRents Property Management System - Improved Database Schema
-- This schema fixes all the issues that blocked the Node.js implementation
-- and provides a comprehensive, working database structure

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- User roles enum
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'agency_admin', 
    'landlord',
    'agent',
    'caretaker',
    'tenant'
);

-- User status enum
CREATE TYPE user_status AS ENUM (
    'active',
    'inactive', 
    'suspended',
    'pending',
    'pending_setup'
);

-- Property types
CREATE TYPE property_type AS ENUM (
    'residential',
    'commercial',
    'mixed_use',
    'industrial',
    'land'
);

-- Property status
CREATE TYPE property_status AS ENUM (
    'active',
    'inactive',
    'under_construction',
    'maintenance'
);

-- Unit types
CREATE TYPE unit_type AS ENUM (
    'studio',
    'one_bedroom',
    'two_bedroom', 
    'three_bedroom',
    'four_bedroom',
    'five_plus_bedroom',
    'commercial_space',
    'office',
    'warehouse',
    'parking'
);

-- Unit status
CREATE TYPE unit_status AS ENUM (
    'vacant',
    'occupied',
    'reserved',
    'under_repair',
    'maintenance'
);

-- Unit condition
CREATE TYPE unit_condition AS ENUM (
    'excellent',
    'good',
    'fair',
    'poor',
    'needs_renovation'
);

-- Furnishing type
CREATE TYPE furnishing_type AS ENUM (
    'unfurnished',
    'semi_furnished',
    'fully_furnished'
);

-- Utility billing type
CREATE TYPE utility_billing_type AS ENUM (
    'prepaid',
    'postpaid',
    'included'
);

-- Ownership type
CREATE TYPE ownership_type AS ENUM (
    'individual',
    'company',
    'partnership',
    'trust'
);

-- Message status
CREATE TYPE message_status AS ENUM (
    'draft',
    'sent',
    'delivered',
    'read',
    'failed'
);

-- Notification status
CREATE TYPE notification_status AS ENUM (
    'unread',
    'read',
    'archived'
);

-- Priority levels
CREATE TYPE priority_level AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Maintenance status
CREATE TYPE maintenance_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);

-- Invoice status
CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Companies table for multi-tenancy
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    address TEXT,
    website VARCHAR(255),
    logo_url VARCHAR(500),
    settings JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agencies table
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    address TEXT,
    license_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table with comprehensive authentication support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    status user_status DEFAULT 'pending',
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Authentication fields
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    
    -- Profile fields
    avatar_url VARCHAR(500),
    date_of_birth DATE,
    gender VARCHAR(10),
    nationality VARCHAR(100),
    id_number VARCHAR(50),
    
    -- Preferences
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Invitation fields
    invitation_status VARCHAR(20) DEFAULT 'pending',
    invitation_sent_at TIMESTAMPTZ,
    invitation_accepted_at TIMESTAMPTZ,
    invitation_token VARCHAR(255),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
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

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Properties table (FIXED: Uses consistent field names)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    property_type property_type NOT NULL,  -- FIXED: Consistent naming
    description TEXT,
    
    -- Location details (FIXED: Consistent field names)
    address VARCHAR(255) NOT NULL,         -- FIXED: Was 'street'
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,           -- FIXED: Was 'region'
    country VARCHAR(100) NOT NULL DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Ownership details
    ownership_type ownership_type DEFAULT 'individual',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    
    -- Property structure
    total_units INTEGER DEFAULT 1,         -- FIXED: Was 'number_of_units'
    number_of_blocks INTEGER,
    number_of_floors INTEGER,
    year_built INTEGER,
    last_renovation TIMESTAMPTZ,
    
    -- Size and area
    lot_size DECIMAL(12, 2),              -- FIXED: Added missing field
    building_size DECIMAL(12, 2),         -- FIXED: Added missing field
    
    -- Financial details
    service_charge_rate DECIMAL(10, 2),
    service_charge_type VARCHAR(20),
    
    -- Property features (FIXED: Added missing fields)
    amenities JSONB DEFAULT '[]'::jsonb,
    parking_spaces INTEGER DEFAULT 0,      -- FIXED: Added missing field
    laundry_facilities VARCHAR(100),       -- FIXED: Added missing field
    pet_policy TEXT,                       -- FIXED: Added missing field
    smoking_policy VARCHAR(50),            -- FIXED: Added missing field
    lease_terms TEXT,                      -- FIXED: Added missing field
    utilities_included JSONB DEFAULT '[]'::jsonb, -- FIXED: Added missing field
    
    -- Management
    access_control VARCHAR(100),
    maintenance_schedule VARCHAR(100),
    
    -- Status and tracking
    status property_status DEFAULT 'active',
    
    -- Document and media
    documents JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units table
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    unit_type unit_type NOT NULL,
    block_number VARCHAR(20),
    floor_number INTEGER,
    
    -- Size details
    size_square_feet DECIMAL(10, 2),
    size_square_meters DECIMAL(10, 2),
    number_of_bedrooms INTEGER,
    number_of_bathrooms INTEGER,
    
    -- Features
    has_ensuite BOOLEAN DEFAULT FALSE,
    has_balcony BOOLEAN DEFAULT FALSE,
    has_parking BOOLEAN DEFAULT FALSE,
    parking_spaces INTEGER DEFAULT 0,
    
    -- Financial details
    rent_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    deposit_amount DECIMAL(12, 2) NOT NULL,
    deposit_months INTEGER DEFAULT 1,
    
    -- Status and condition
    status unit_status DEFAULT 'vacant',
    condition unit_condition DEFAULT 'good',
    furnishing_type furnishing_type DEFAULT 'unfurnished',
    
    -- Utilities
    water_meter_number VARCHAR(50),
    electric_meter_number VARCHAR(50),
    utility_billing_type utility_billing_type DEFAULT 'postpaid',
    
    -- Features and amenities
    in_unit_amenities JSONB DEFAULT '[]'::jsonb,
    appliances JSONB DEFAULT '[]'::jsonb,
    
    -- Current tenant
    current_tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lease_start_date DATE,
    lease_end_date DATE,
    lease_type VARCHAR(20),
    
    -- Documents and media
    documents JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Valuation
    estimated_value DECIMAL(15, 2),
    market_rent_estimate DECIMAL(12, 2),
    last_valuation_date DATE,
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, unit_number)
);

-- ============================================================================
-- COMMUNICATIONS SYSTEM (FIXED)
-- ============================================================================

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'broadcast')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('admin', 'participant')),
    
    UNIQUE(conversation_id, user_id)
);

-- Messages table (FIXED: Added recipient tracking)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Sender and recipients (FIXED: Added proper recipient tracking)
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    
    -- Status and priority
    priority priority_level DEFAULT 'medium',
    status message_status DEFAULT 'draft',
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    
    -- Threading
    parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    thread_id UUID,
    
    -- Template and AI
    template_id UUID,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    
    -- Metadata
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message recipients (FIXED: Proper recipient tracking with read status)
CREATE TABLE message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Read status (FIXED: Individual read tracking per recipient)
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Recipient-specific settings
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(message_id, recipient_id)
);

-- Message templates
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_global BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS SYSTEM (FIXED)
-- ============================================================================

-- Notifications table (FIXED: Proper structure with sender/recipient)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Sender and recipient (FIXED: Added proper sender/recipient tracking)
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    priority priority_level DEFAULT 'medium',
    
    -- Status and interaction (FIXED: Proper read status)
    status notification_status DEFAULT 'unread',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Action and navigation
    action_required BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    action_data JSONB,
    
    -- Related entity
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    
    -- Delivery channels
    channels JSONB DEFAULT '["app"]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    channels JSONB DEFAULT '["app"]'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, notification_type)
);

-- ============================================================================
-- MAINTENANCE SYSTEM
-- ============================================================================

-- Maintenance requests
CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    
    -- Request details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority priority_level DEFAULT 'medium',
    status maintenance_status DEFAULT 'pending',
    
    -- People involved
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Scheduling
    requested_date DATE DEFAULT CURRENT_DATE,
    scheduled_date DATE,
    completed_date DATE,
    
    -- Cost tracking
    estimated_cost DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    
    -- Media and documentation
    images JSONB DEFAULT '[]'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    
    -- Notes and updates
    notes TEXT,
    internal_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL SYSTEM
-- ============================================================================

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    
    -- Invoice details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    invoice_type VARCHAR(50) NOT NULL,
    
    -- Parties
    issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    issued_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Related entities
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    
    -- Financial details
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Dates
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date DATE,
    
    -- Status
    status invoice_status DEFAULT 'draft',
    
    -- Payment tracking
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Item details
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TENANT MANAGEMENT
-- ============================================================================

-- Tenant profiles (additional tenant-specific information)
CREATE TABLE tenant_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Personal details
    id_number VARCHAR(50),
    nationality VARCHAR(100) DEFAULT 'Kenyan',
    
    -- Lease details
    move_in_date DATE,
    lease_type VARCHAR(50) DEFAULT 'fixed_term',
    lease_start_date DATE,
    lease_end_date DATE,
    
    -- Financial details
    rent_amount DECIMAL(10, 2),
    deposit_amount DECIMAL(10, 2),
    payment_frequency VARCHAR(20) DEFAULT 'monthly',
    payment_day INTEGER DEFAULT 1,
    
    -- Emergency contact
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    
    -- Preferences
    preferred_communication_method VARCHAR(20) DEFAULT 'email',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_agency_id ON users(agency_id);

-- Property indexes
CREATE INDEX idx_properties_company_id ON properties(company_id);
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_agency_id ON properties(agency_id);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_property_type ON properties(property_type);
CREATE INDEX idx_properties_status ON properties(status);

-- Unit indexes
CREATE INDEX idx_units_company_id ON units(company_id);
CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_current_tenant_id ON units(current_tenant_id);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_unit_type ON units(unit_type);

-- Message indexes
CREATE INDEX idx_messages_company_id ON messages(company_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX idx_message_recipients_is_read ON message_recipients(is_read);

-- Notification indexes
CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Maintenance indexes
CREATE INDEX idx_maintenance_requests_company_id ON maintenance_requests(company_id);
CREATE INDEX idx_maintenance_requests_property_id ON maintenance_requests(property_id);
CREATE INDEX idx_maintenance_requests_unit_id ON maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_assigned_to ON maintenance_requests(assigned_to);

-- Invoice indexes
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_issued_to ON invoices(issued_to);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
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
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert a default company
INSERT INTO companies (id, name, email, phone_number) 
VALUES ('00000000-0000-0000-0000-000000000001', 'LetRents Default Company', 'admin@letrents.com', '+254700000000')
ON CONFLICT (id) DO NOTHING;

-- Insert super admin user
INSERT INTO users (
    id, company_id, email, password_hash, first_name, last_name, role, status, email_verified
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin@letrents.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
    'Super',
    'Admin',
    'super_admin',
    'active',
    true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE companies IS 'Multi-tenant companies for SaaS deployment';
COMMENT ON TABLE users IS 'All system users with comprehensive authentication support';
COMMENT ON TABLE properties IS 'Property listings with consistent field naming';
COMMENT ON TABLE units IS 'Individual units within properties';
COMMENT ON TABLE messages IS 'Messages with proper sender/recipient tracking';
COMMENT ON TABLE message_recipients IS 'Individual recipient tracking with read status';
COMMENT ON TABLE notifications IS 'System notifications with proper sender/recipient fields';
COMMENT ON TABLE maintenance_requests IS 'Property maintenance request tracking';
COMMENT ON TABLE invoices IS 'Financial invoicing system';

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('2024.01.01_improved_schema');

-- End of improved schema
