import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;

// Supabase credentials
const SUPABASE_URL = 'https://sxseepxijyxycocssyfq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c2VlcHhpanl4eWNvY3NzeWZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0ODQ5OSwiZXhwIjoyMDc0MzI0NDk5fQ.0By5_o9duyF4eFFSGvwFj8lD08q3zZL5BxdKvHTfPWE';

// Current Render database
const RENDER_DB_URL = 'postgresql://letrents_db_user:meXfl7uVGNxEGETEmS3Bim6Nxp5EtQl0@dpg-d3a37s6mcj7s73e3lk60-a.oregon-postgres.render.com/letrents_db';

console.log('🚀 Starting LetRents migration to Supabase...');

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSupabaseSchema() {
  console.log('📊 Creating database schema in Supabase...');
  
  // Create schema using Supabase's SQL editor
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
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
CREATE TYPE property_type AS ENUM (
    'residential', 'commercial', 'industrial', 'mixed_use', 'institutional', 'vacant_land', 'hospitality', 'recreational'
);

-- Create ownership type enum
CREATE TYPE ownership_type AS ENUM (
    'individual', 'company', 'joint'
);

-- Create property status enum
CREATE TYPE property_status AS ENUM (
    'active', 'inactive', 'maintenance', 'sold'
);

-- Create unit type enum
CREATE TYPE unit_type AS ENUM (
    'single_room', 'double_room', 'bedsitter', 'studio', 'one_bedroom', 'two_bedroom', 
    'three_bedroom', 'four_bedroom', 'five_plus_bedroom', 'servant_quarter', 
    'maisonette', 'penthouse', 'office_space', 'retail_shop', 'kiosk'
);

-- Create unit status enum
CREATE TYPE unit_status AS ENUM (
    'vacant', 'occupied', 'reserved', 'maintenance', 'under_repair', 'arrears'
);

-- Create unit condition enum
CREATE TYPE unit_condition AS ENUM (
    'new', 'excellent', 'good', 'fair', 'poor', 'needs_repairs', 'renovated'
);

-- Create furnishing type enum
CREATE TYPE furnishing_type AS ENUM (
    'furnished', 'unfurnished', 'semi_furnished'
);

-- Create utility billing type enum
CREATE TYPE utility_billing_type AS ENUM (
    'prepaid', 'postpaid', 'inclusive'
);

-- Create lease status enum
CREATE TYPE lease_status AS ENUM (
    'active', 'pending', 'expired', 'terminated', 'renewed'
);

-- Create invoice status enum
CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'
);

-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'reversed'
);

-- Create maintenance status enum
CREATE TYPE maintenance_status AS ENUM (
    'pending', 'in_progress', 'completed', 'cancelled', 'on_hold'
);

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
    property_type VARCHAR(100),
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

-- Insert default company if not exists
INSERT INTO companies (name, business_type, email, phone_number, country)
SELECT
    'Default Company',
    'property_management',
    'admin@letrents.com',
    '+254700000000',
    'Kenya'
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

SELECT 'Supabase schema created successfully!' as result;
    `
  });

  if (error) {
    console.error('❌ Error creating schema:', error);
    throw error;
  }

  console.log('✅ Database schema created successfully!');
  return data;
}

async function exportRenderData() {
  console.log('📤 Exporting data from Render PostgreSQL...');
  
  const renderClient = new Client({
    connectionString: RENDER_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await renderClient.connect();
    console.log('✅ Connected to Render database');

    // Export companies
    const companiesResult = await renderClient.query('SELECT * FROM companies ORDER BY created_at');
    console.log(`📊 Found ${companiesResult.rows.length} companies`);

    // Export users
    const usersResult = await renderClient.query('SELECT * FROM users ORDER BY created_at');
    console.log(`👥 Found ${usersResult.rows.length} users`);

    // Export properties
    const propertiesResult = await renderClient.query('SELECT * FROM properties ORDER BY created_at');
    console.log(`🏠 Found ${propertiesResult.rows.length} properties`);

    // Export units
    const unitsResult = await renderClient.query('SELECT * FROM units ORDER BY created_at');
    console.log(`🏢 Found ${unitsResult.rows.length} units`);

    await renderClient.end();

    return {
      companies: companiesResult.rows,
      users: usersResult.rows,
      properties: propertiesResult.rows,
      units: unitsResult.rows
    };

  } catch (error) {
    console.error('❌ Error exporting data:', error);
    await renderClient.end();
    throw error;
  }
}

async function importToSupabase(data) {
  console.log('📥 Importing data to Supabase...');

  try {
    // Import companies first (dependencies)
    if (data.companies.length > 0) {
      const { error: companiesError } = await supabase
        .from('companies')
        .insert(data.companies);
      
      if (companiesError && !companiesError.message.includes('duplicate key')) {
        console.error('❌ Error importing companies:', companiesError);
        throw companiesError;
      }
      console.log(`✅ Imported ${data.companies.length} companies`);
    }

    // Import users (depends on companies)
    if (data.users.length > 0) {
      const { error: usersError } = await supabase
        .from('users')
        .insert(data.users);
      
      if (usersError && !usersError.message.includes('duplicate key')) {
        console.error('❌ Error importing users:', usersError);
        throw usersError;
      }
      console.log(`✅ Imported ${data.users.length} users`);
    }

    // Import properties (depends on companies and users)
    if (data.properties.length > 0) {
      const { error: propertiesError } = await supabase
        .from('properties')
        .insert(data.properties);
      
      if (propertiesError && !propertiesError.message.includes('duplicate key')) {
        console.error('❌ Error importing properties:', propertiesError);
        throw propertiesError;
      }
      console.log(`✅ Imported ${data.properties.length} properties`);
    }

    // Import units (depends on properties)
    if (data.units.length > 0) {
      const { error: unitsError } = await supabase
        .from('units')
        .insert(data.units);
      
      if (unitsError && !unitsError.message.includes('duplicate key')) {
        console.error('❌ Error importing units:', unitsError);
        throw unitsError;
      }
      console.log(`✅ Imported ${data.units.length} units`);
    }

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...');

  try {
    const { data: companies } = await supabase.from('companies').select('count', { count: 'exact' });
    const { data: users } = await supabase.from('users').select('count', { count: 'exact' });
    const { data: properties } = await supabase.from('properties').select('count', { count: 'exact' });
    const { data: units } = await supabase.from('units').select('count', { count: 'exact' });

    console.log('\n📊 Migration Summary:');
    console.log(`  Companies: ${companies?.length || 0}`);
    console.log(`  Users: ${users?.length || 0}`);
    console.log(`  Properties: ${properties?.length || 0}`);
    console.log(`  Units: ${units?.length || 0}`);

    console.log('\n🎉 Migration verification complete!');
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  }
}

// Main migration function
async function migrate() {
  try {
    console.log('\n🚀 Starting LetRents migration to Supabase...\n');

    // Step 1: Create schema
    await createSupabaseSchema();
    
    // Step 2: Export data
    const data = await exportRenderData();
    
    // Step 3: Import data
    await importToSupabase(data);
    
    // Step 4: Verify
    await verifyMigration();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Update frontend to use Supabase client');
    console.log('  2. Set up Row Level Security policies');
    console.log('  3. Configure authentication');
    console.log('  4. Test the application');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
