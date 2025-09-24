-- ==================== COMPLETE DATABASE SETUP ====================
-- This script creates ALL missing tables for the LetRents application

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CREATE ENUMS ====================

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin',
        'agency_admin',
        'landlord', 
        'agent',
        'caretaker',
        'tenant'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User status enum  
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM (
        'active',
        'inactive',
        'suspended',
        'pending', 
        'pending_setup'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Company status enum
DO $$ BEGIN
    CREATE TYPE company_status AS ENUM (
        'active',
        'inactive',
        'suspended',
        'trial',
        'pending_setup'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Property status enum
DO $$ BEGIN
    CREATE TYPE property_status AS ENUM (
        'active',
        'inactive',
        'maintenance',
        'sold',
        'pending'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Unit status enum
DO $$ BEGIN
    CREATE TYPE unit_status AS ENUM (
        'available',
        'occupied',
        'reserved',
        'maintenance',
        'inactive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Lease status enum
DO $$ BEGIN
    CREATE TYPE lease_status AS ENUM (
        'draft',
        'active',
        'expired',
        'terminated',
        'pending_renewal'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Invoice status enum
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'draft',
        'sent',
        'paid',
        'overdue',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Maintenance status enum
DO $$ BEGIN
    CREATE TYPE maintenance_status AS ENUM (
        'open',
        'in_progress',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'completed',
        'failed',
        'cancelled',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==================== CREATE CORE TABLES ====================

-- Units table
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    unit_type VARCHAR(100),
    floor INTEGER,
    bedrooms INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    area_sqft DECIMAL(10, 2),
    monthly_rent DECIMAL(12, 2) NOT NULL,
    deposit_amount DECIMAL(12, 2),
    status unit_status DEFAULT 'available',
    description TEXT,
    amenities JSONB DEFAULT '[]',
    features JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    furnishing_details JSONB DEFAULT '{}',
    utilities_included JSONB DEFAULT '[]',
    lease_terms JSONB DEFAULT '{}',
    availability_date DATE,
    last_renovated DATE,
    condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, unit_number)
);

-- Leases table
CREATE TABLE IF NOT EXISTS leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    lease_number VARCHAR(100) UNIQUE,
    status lease_status DEFAULT 'draft',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_rent DECIMAL(12, 2) NOT NULL,
    security_deposit DECIMAL(12, 2),
    utilities_deposit DECIMAL(12, 2),
    late_fee_amount DECIMAL(10, 2),
    late_fee_grace_days INTEGER DEFAULT 5,
    notice_period_days INTEGER DEFAULT 30,
    auto_renewal BOOLEAN DEFAULT false,
    terms_and_conditions TEXT,
    special_clauses TEXT,
    lease_document_url VARCHAR(500),
    signed_date DATE,
    witness_name VARCHAR(255),
    witness_contact VARCHAR(100),
    renewal_terms JSONB DEFAULT '{}',
    termination_reason TEXT,
    termination_date DATE,
    move_in_date DATE,
    move_out_date DATE,
    inspection_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    status invoice_status DEFAULT 'draft',
    invoice_type VARCHAR(50) DEFAULT 'rent',
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    paid_date DATE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    late_fee_applied DECIMAL(10, 2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    is_overdue BOOLEAN DEFAULT false,
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMPTZ,
    line_items JSONB DEFAULT '[]',
    payment_instructions TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    payment_reference VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_method VARCHAR(50) NOT NULL,
    status payment_status DEFAULT 'pending',
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB DEFAULT '{}',
    payment_date TIMESTAMPTZ,
    description TEXT,
    fees DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2),
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'medium',
    status maintenance_status DEFAULT 'open',
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    scheduled_date DATE,
    completed_date DATE,
    images JSONB DEFAULT '[]',
    notes TEXT,
    vendor_info JSONB DEFAULT '{}',
    work_details TEXT,
    materials_used JSONB DEFAULT '[]',
    labor_hours DECIMAL(5, 2),
    warranty_info TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    tenant_satisfaction_rating INTEGER CHECK (tenant_satisfaction_rating >= 1 AND tenant_satisfaction_rating <= 5),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(50) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    action_url VARCHAR(500),
    action_text VARCHAR(100),
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property caretakers table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS property_caretakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    caretaker_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    is_primary BOOLEAN DEFAULT false,
    responsibilities JSONB DEFAULT '[]',
    emergency_contact BOOLEAN DEFAULT true,
    contact_hours VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, caretaker_id)
);

-- Property staff table (agents, managers, etc.)
CREATE TABLE IF NOT EXISTS property_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    staff_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    assigned_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '[]',
    commission_rate DECIMAL(5, 2),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, staff_id, role)
);

-- ==================== CREATE INDEXES ====================

-- Properties indexes
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);

-- Units indexes
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_units_company_id ON units(company_id);

-- Leases indexes
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
CREATE INDEX IF NOT EXISTS idx_leases_start_date ON leases(start_date);
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON leases(end_date);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_is_paid ON invoices(is_paid);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- Maintenance requests indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_property_id ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_unit_id ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned_to ON maintenance_requests(assigned_to);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Property relationships indexes
CREATE INDEX IF NOT EXISTS idx_property_caretakers_property_id ON property_caretakers(property_id);
CREATE INDEX IF NOT EXISTS idx_property_caretakers_caretaker_id ON property_caretakers(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_property_id ON property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_staff_id ON property_staff(staff_id);

-- ==================== VERIFICATION ====================

SELECT 
    'COMPLETE DATABASE SETUP FINISHED!' as status,
    (SELECT COUNT(*) FROM companies) as companies_count,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM properties) as properties_count,
    (SELECT COUNT(*) FROM units) as units_count,
    (SELECT COUNT(*) FROM leases) as leases_count,
    (SELECT COUNT(*) FROM invoices) as invoices_count,
    (SELECT COUNT(*) FROM payments) as payments_count,
    (SELECT COUNT(*) FROM maintenance_requests) as maintenance_count,
    (SELECT COUNT(*) FROM notifications) as notifications_count;
