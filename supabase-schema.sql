-- LetRents Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker', 'tenant'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user status enum
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM (
        'active', 'inactive', 'suspended', 'pending', 'pending_setup'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create company status enum
DO $$ BEGIN
    CREATE TYPE company_status AS ENUM (
        'active', 'inactive', 'suspended', 'trial', 'pending_setup'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create property type enum
DO $$ BEGIN
    CREATE TYPE property_type AS ENUM (
        'residential', 'commercial', 'industrial', 'mixed_use', 'institutional', 'vacant_land', 'hospitality', 'recreational'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ownership type enum
DO $$ BEGIN
    CREATE TYPE ownership_type AS ENUM (
        'individual', 'company', 'joint'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create property status enum
DO $$ BEGIN
    CREATE TYPE property_status AS ENUM (
        'active', 'inactive', 'maintenance', 'sold'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create unit type enum
DO $$ BEGIN
    CREATE TYPE unit_type AS ENUM (
        'single_room', 'double_room', 'bedsitter', 'studio', 'one_bedroom', 'two_bedroom', 
        'three_bedroom', 'four_bedroom', 'five_plus_bedroom', 'servant_quarter', 
        'maisonette', 'penthouse', 'office_space', 'retail_shop', 'kiosk'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create unit status enum
DO $$ BEGIN
    CREATE TYPE unit_status AS ENUM (
        'vacant', 'occupied', 'reserved', 'maintenance', 'under_repair', 'arrears'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create unit condition enum
DO $$ BEGIN
    CREATE TYPE unit_condition AS ENUM (
        'new', 'excellent', 'good', 'fair', 'poor', 'needs_repairs', 'renovated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create furnishing type enum
DO $$ BEGIN
    CREATE TYPE furnishing_type AS ENUM (
        'furnished', 'unfurnished', 'semi_furnished'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create utility billing type enum
DO $$ BEGIN
    CREATE TYPE utility_billing_type AS ENUM (
        'prepaid', 'postpaid', 'inclusive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create lease status enum
DO $$ BEGIN
    CREATE TYPE lease_status AS ENUM (
        'active', 'pending', 'expired', 'terminated', 'renewed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create invoice status enum
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending', 'completed', 'failed', 'refunded', 'reversed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create maintenance status enum
DO $$ BEGIN
    CREATE TYPE maintenance_status AS ENUM (
        'pending', 'in_progress', 'completed', 'cancelled', 'on_hold'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    registration_number VARCHAR(100),
    tax_number VARCHAR(100),
    tax_id VARCHAR(100),
    email VARCHAR(255),
    phone_number VARCHAR(50),
    address TEXT,
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    website VARCHAR(255),
    logo_url VARCHAR(500),
    industry VARCHAR(100),
    company_size VARCHAR(50) DEFAULT 'small',
    status company_status DEFAULT 'active',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_expires_at TIMESTAMPTZ,
    max_properties INTEGER DEFAULT 5,
    max_units INTEGER DEFAULT 50,
    max_tenants INTEGER DEFAULT 100,
    max_agents INTEGER DEFAULT 1,
    max_caretakers INTEGER DEFAULT 1,
    max_staff INTEGER DEFAULT 1,
    max_invoices_monthly INTEGER DEFAULT 50,
    max_reports_monthly INTEGER DEFAULT 10,
    storage_limit_mb INTEGER DEFAULT 1024,
    features JSONB DEFAULT '[]',
    billing_cycle VARCHAR(50) DEFAULT 'monthly',
    next_billing_date TIMESTAMPTZ,
    payment_gateway_customer_id VARCHAR(255),
    payment_gateway_subscription_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    agency_id UUID,
    landlord_id UUID,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    password_hash TEXT,
    role user_role NOT NULL DEFAULT 'tenant',
    status user_status NOT NULL DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    email_verification_expires_at TIMESTAMPTZ,
    phone_verified BOOLEAN DEFAULT false,
    phone_verification_token TEXT,
    phone_verification_expires_at TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    account_locked_until TIMESTAMPTZ,
    profile_image_url VARCHAR(500),
    date_of_birth DATE,
    national_id VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    preferences JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type property_type,
    description TEXT,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    ownership_type ownership_type DEFAULT 'individual',
    owner_id UUID REFERENCES users(id) NOT NULL,
    agency_id UUID,
    number_of_units INTEGER DEFAULT 0,
    number_of_blocks INTEGER,
    number_of_floors INTEGER,
    service_charge_rate DECIMAL(10, 2),
    service_charge_type VARCHAR(50),
    amenities JSONB DEFAULT '[]',
    access_control VARCHAR(100),
    maintenance_schedule VARCHAR(255),
    status property_status DEFAULT 'active',
    year_built INTEGER,
    last_renovation TIMESTAMPTZ,
    documents JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    image_urls TEXT[] DEFAULT '{}',
    size_sqft INTEGER,
    purchase_date DATE,
    purchase_price DECIMAL(18, 2),
    current_value DECIMAL(18, 2),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create units table
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    unit_type unit_type,
    block_number VARCHAR(20),
    floor_number INTEGER,
    size_square_feet DECIMAL(10, 2),
    size_square_meters DECIMAL(10, 2),
    size_sqft INTEGER,
    number_of_bedrooms INTEGER,
    number_of_bathrooms INTEGER,
    bedrooms INTEGER,
    bathrooms INTEGER,
    has_ensuite BOOLEAN DEFAULT false,
    has_balcony BOOLEAN DEFAULT false,
    has_parking BOOLEAN DEFAULT false,
    parking_spaces INTEGER DEFAULT 0,
    rent_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    deposit_amount DECIMAL(12, 2),
    deposit_months INTEGER DEFAULT 1,
    status unit_status DEFAULT 'vacant',
    condition unit_condition DEFAULT 'good',
    furnishing_type furnishing_type DEFAULT 'unfurnished',
    water_meter_number VARCHAR(50),
    electric_meter_number VARCHAR(50),
    utility_billing_type utility_billing_type DEFAULT 'postpaid',
    in_unit_amenities JSONB DEFAULT '[]',
    amenities JSONB DEFAULT '[]',
    appliances JSONB DEFAULT '[]',
    current_tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lease_start_date DATE,
    lease_end_date DATE,
    lease_type VARCHAR(20),
    description TEXT,
    documents JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    image_urls TEXT[] DEFAULT '{}',
    estimated_value DECIMAL(15, 2),
    market_rent_estimate DECIMAL(12, 2),
    last_valuation_date DATE,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (property_id, unit_number)
);

-- Create leases table
CREATE TABLE IF NOT EXISTS leases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rent_amount DECIMAL(18, 2) NOT NULL,
    deposit_amount DECIMAL(18, 2),
    lease_term VARCHAR(50),
    status lease_status DEFAULT 'active',
    document_url VARCHAR(500),
    renewal_terms TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (unit_id, tenant_id, start_date)
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    amount_due DECIMAL(18, 2) NOT NULL,
    status invoice_status DEFAULT 'sent',
    is_paid BOOLEAN DEFAULT false,
    payment_date DATE,
    description TEXT,
    line_items JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(18, 2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    payment_method VARCHAR(100),
    transaction_id VARCHAR(255),
    status payment_status DEFAULT 'completed',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create maintenance_requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'medium',
    status maintenance_status DEFAULT 'pending',
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    completion_date DATE,
    cost DECIMAL(18, 2),
    image_urls TEXT[] DEFAULT '{}',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Essential Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_leases_company_id ON leases(company_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_company_id ON maintenance_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_property_id ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Insert default company if not exists
INSERT INTO companies (name, business_type, email, phone_number, country)
SELECT
    'Default Company',
    'property_management',
    'admin@letrents.com',
    '+254700000000',
    'Kenya'
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

-- Verify setup
SELECT 'Supabase schema created successfully!' as result;
