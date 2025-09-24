-- =============================================================================
-- DIRECT SQL SETUP FOR LETRENTS DATABASE
-- Run this directly in your Render PostgreSQL dashboard query interface
-- =============================================================================

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user role enum
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

-- Create user status enum  
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

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    registration_number VARCHAR(100),
    tax_number VARCHAR(100),
    email VARCHAR(255),
    phone_number VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    website VARCHAR(255),
    logo_url VARCHAR(500),
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_expires_at TIMESTAMPTZ,
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
    password_reset_token TEXT,
    password_reset_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Insert default company
INSERT INTO companies (name, business_type, email, phone_number, country)
SELECT 
    'Default Company',
    'property_management',
    'admin@letrents.com',
    '+254700000000',
    'Kenya'
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

-- Verify setup
SELECT 
    'Setup Complete!' as status,
    (SELECT COUNT(*) FROM companies) as companies_count,
    (SELECT COUNT(*) FROM users) as users_count;
