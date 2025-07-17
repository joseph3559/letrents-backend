-- Property & Unit Management Module Migration
-- This migration creates tables for properties, units, documents, inspections, and inventory

-- Create enum types for properties and units
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
    -- Residential types
    'single_room',
    'double_room',
    'bedsitter',
    'studio',
    '1_bedroom',
    '2_bedroom',
    '3_bedroom',
    '4_bedroom',
    '5_plus_bedroom',
    'servant_quarter',
    'maisonette',
    'penthouse',
    -- Commercial types
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
    'under_repair',
    'maintenance'
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

-- Create properties table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type property_type NOT NULL,
    description TEXT,
    
    -- Location details
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Kenya',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Ownership details
    ownership_type ownership_type NOT NULL DEFAULT 'individual',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    
    -- Property structure
    number_of_units INTEGER NOT NULL DEFAULT 1,
    number_of_blocks INTEGER,
    number_of_floors INTEGER,
    
    -- Financial details
    service_charge_rate DECIMAL(10, 2),
    service_charge_type VARCHAR(20), -- monthly, quarterly, annual
    
    -- Property amenities and features (stored as JSON array)
    amenities JSONB DEFAULT '[]'::jsonb,
    access_control VARCHAR(100),
    maintenance_schedule VARCHAR(100),
    
    -- Status and tracking
    status property_status NOT NULL DEFAULT 'active',
    year_built INTEGER,
    last_renovation TIMESTAMP WITH TIME ZONE,
    
    -- Document and media (stored as JSON arrays)
    documents JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create units table
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    unit_type unit_type NOT NULL,
    
    -- Location within property
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
    
    -- Financial details
    rent_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    deposit_amount DECIMAL(12, 2) NOT NULL,
    deposit_months INTEGER NOT NULL DEFAULT 1,
    
    -- Unit status and condition
    status unit_status NOT NULL DEFAULT 'vacant',
    condition unit_condition NOT NULL DEFAULT 'good',
    furnishing_type furnishing_type NOT NULL DEFAULT 'unfurnished',
    
    -- Utility details
    water_meter_number VARCHAR(50),
    electric_meter_number VARCHAR(50),
    utility_billing_type utility_billing_type NOT NULL DEFAULT 'postpaid',
    
    -- Unit amenities and features (stored as JSON arrays)
    in_unit_amenities JSONB DEFAULT '[]'::jsonb,
    appliances JSONB DEFAULT '[]'::jsonb,
    
    -- Current lease information
    current_tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lease_start_date DATE,
    lease_end_date DATE,
    lease_type VARCHAR(20), -- short_term, long_term
    
    -- Document and media (stored as JSON arrays)
    documents JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Valuation and market data
    estimated_value DECIMAL(15, 2),
    market_rent_estimate DECIMAL(12, 2),
    last_valuation_date DATE,
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(property_id, unit_number)
);

-- Create property documents table
CREATE TABLE property_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create property inspections table
CREATE TABLE property_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    inspection_type VARCHAR(20) NOT NULL, -- routine, move_in, move_out, maintenance, emergency
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
    notes TEXT,
    issues JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create property inventory table
CREATE TABLE property_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition VARCHAR(50) NOT NULL DEFAULT 'good',
    purchase_date DATE,
    purchase_price DECIMAL(12, 2),
    serial_number VARCHAR(100),
    warranty_expiry DATE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_agency_id ON properties(agency_id);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_region ON properties(region);
CREATE INDEX idx_properties_created_by ON properties(created_by);

CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_unit_type ON units(unit_type);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_current_tenant_id ON units(current_tenant_id);
CREATE INDEX idx_units_rent_amount ON units(rent_amount);
CREATE INDEX idx_units_created_by ON units(created_by);

CREATE INDEX idx_property_documents_property_id ON property_documents(property_id);
CREATE INDEX idx_property_documents_unit_id ON property_documents(unit_id);
CREATE INDEX idx_property_documents_document_type ON property_documents(document_type);
CREATE INDEX idx_property_documents_uploaded_by ON property_documents(uploaded_by);

CREATE INDEX idx_property_inspections_property_id ON property_inspections(property_id);
CREATE INDEX idx_property_inspections_unit_id ON property_inspections(unit_id);
CREATE INDEX idx_property_inspections_inspector_id ON property_inspections(inspector_id);
CREATE INDEX idx_property_inspections_status ON property_inspections(status);
CREATE INDEX idx_property_inspections_inspection_date ON property_inspections(inspection_date);

CREATE INDEX idx_property_inventory_property_id ON property_inventory(property_id);
CREATE INDEX idx_property_inventory_unit_id ON property_inventory(unit_id);
CREATE INDEX idx_property_inventory_category ON property_inventory(category);
CREATE INDEX idx_property_inventory_created_by ON property_inventory(created_by);

-- GIN indexes for JSONB columns for better search performance
CREATE INDEX idx_properties_amenities_gin ON properties USING GIN (amenities);
CREATE INDEX idx_units_in_unit_amenities_gin ON units USING GIN (in_unit_amenities);
CREATE INDEX idx_units_appliances_gin ON units USING GIN (appliances);

-- Create triggers for updated_at timestamp
CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON properties 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at 
    BEFORE UPDATE ON units 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_inspections_updated_at 
    BEFORE UPDATE ON property_inspections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_inventory_updated_at 
    BEFORE UPDATE ON property_inventory 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO properties (
    name, type, description, street, city, region, country,
    ownership_type, owner_id, agency_id, number_of_units,
    number_of_blocks, number_of_floors, service_charge_rate,
    service_charge_type, amenities, access_control, status,
    year_built, created_by
) VALUES 
(
    'Greenview Apartments',
    'residential',
    'Modern residential complex with excellent amenities',
    'Kileleshwa Road',
    'Nairobi',
    'Nairobi County',
    'Kenya',
    'company',
    (SELECT id FROM users WHERE role = 'landlord' LIMIT 1),
    (SELECT id FROM agencies LIMIT 1),
    24,
    2,
    6,
    1500.00,
    'monthly',
    '["parking", "elevator", "generator", "borehole", "security_guard", "cctv"]'::jsonb,
    'Security guard with biometric access',
    'active',
    2020,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
),
(
    'Westlands Commercial Plaza',
    'commercial',
    'Prime commercial space in Westlands business district',
    'Waiyaki Way',
    'Nairobi',
    'Nairobi County',
    'Kenya',
    'individual',
    (SELECT id FROM users WHERE role = 'landlord' LIMIT 1),
    (SELECT id FROM agencies LIMIT 1),
    12,
    1,
    4,
    2000.00,
    'monthly',
    '["parking", "elevator", "generator", "backup_water", "conference_room"]'::jsonb,
    'Card access system',
    'active',
    2018,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
);

-- Insert sample units
INSERT INTO units (
    property_id, unit_number, unit_type, block_number, floor_number,
    size_square_feet, number_of_bedrooms, number_of_bathrooms,
    has_ensuite, has_balcony, has_parking, parking_spaces,
    rent_amount, currency, deposit_amount, deposit_months,
    status, condition, furnishing_type, utility_billing_type,
    in_unit_amenities, appliances, created_by
) VALUES 
-- Residential units for Greenview Apartments
(
    (SELECT id FROM properties WHERE name = 'Greenview Apartments'),
    'A101',
    '2_bedroom',
    'Block A',
    1,
    850.00,
    2,
    2,
    true,
    true,
    true,
    1,
    35000.00,
    'KES',
    70000.00,
    2,
    'vacant',
    'excellent',
    'unfurnished',
    'postpaid',
    '["wifi", "balcony", "ensuite", "storage"]'::jsonb,
    '["refrigerator", "microwave", "water_heater"]'::jsonb,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
),
(
    (SELECT id FROM properties WHERE name = 'Greenview Apartments'),
    'A102',
    '3_bedroom',
    'Block A',
    1,
    1200.00,
    3,
    3,
    true,
    true,
    true,
    2,
    45000.00,
    'KES',
    90000.00,
    2,
    'occupied',
    'good',
    'semi_furnished',
    'postpaid',
    '["wifi", "balcony", "ensuite", "storage", "study_room"]'::jsonb,
    '["refrigerator", "microwave", "water_heater", "washing_machine"]'::jsonb,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
),
-- Commercial units for Westlands Commercial Plaza
(
    (SELECT id FROM properties WHERE name = 'Westlands Commercial Plaza'),
    'G01',
    'office_space',
    NULL,
    0,
    600.00,
    NULL,
    1,
    false,
    false,
    true,
    2,
    85000.00,
    'KES',
    170000.00,
    2,
    'vacant',
    'excellent',
    'furnished',
    'inclusive',
    '["wifi", "air_conditioning", "conference_room"]'::jsonb,
    '["internet_router", "air_conditioner", "security_system"]'::jsonb,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
),
(
    (SELECT id FROM properties WHERE name = 'Westlands Commercial Plaza'),
    'G02',
    'retail_shop',
    NULL,
    0,
    400.00,
    NULL,
    1,
    false,
    false,
    false,
    0,
    55000.00,
    'KES',
    110000.00,
    2,
    'occupied',
    'good',
    'unfurnished',
    'postpaid',
    '["wifi", "storage"]'::jsonb,
    '["security_system"]'::jsonb,
    (SELECT id FROM users WHERE email = 'admin@letrents.com')
);