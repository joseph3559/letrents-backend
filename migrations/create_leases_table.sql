-- Migration: Create dedicated leases table
-- Date: 2024-12-19
-- Description: Create a comprehensive leases table to replace virtual lease management

-- Create lease status enum
CREATE TYPE lease_status AS ENUM (
    'draft',
    'active',
    'expired',
    'terminated',
    'renewed'
);

-- Create lease type enum
CREATE TYPE lease_type AS ENUM (
    'fixed_term',
    'month_to_month',
    'periodic',
    'commercial',
    'residential'
);

-- Create leases table
CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    
    -- Lease details
    lease_number VARCHAR(50) UNIQUE NOT NULL,
    lease_type lease_type DEFAULT 'fixed_term',
    status lease_status DEFAULT 'draft',
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    move_in_date DATE,
    move_out_date DATE,
    notice_period_days INTEGER DEFAULT 30,
    
    -- Financial terms
    rent_amount DECIMAL(12, 2) NOT NULL,
    deposit_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_frequency VARCHAR(20) DEFAULT 'monthly',
    payment_day INTEGER DEFAULT 1,
    late_fee_amount DECIMAL(10, 2),
    late_fee_grace_days INTEGER DEFAULT 5,
    
    -- Lease terms
    renewable BOOLEAN DEFAULT TRUE,
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_notice_days INTEGER DEFAULT 60,
    pets_allowed BOOLEAN DEFAULT FALSE,
    smoking_allowed BOOLEAN DEFAULT FALSE,
    subletting_allowed BOOLEAN DEFAULT FALSE,
    
    -- Additional terms
    special_terms TEXT,
    notes TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    signed_at TIMESTAMPTZ,
    terminated_at TIMESTAMPTZ,
    termination_reason VARCHAR(255),
    
    -- Lease history and renewals
    parent_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_leases_company_id ON leases(company_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX idx_leases_unit_id ON leases(unit_id);
CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_leases_start_date ON leases(start_date);
CREATE INDEX idx_leases_end_date ON leases(end_date);
CREATE INDEX idx_leases_lease_number ON leases(lease_number);
CREATE INDEX idx_leases_parent_lease_id ON leases(parent_lease_id);

-- Create composite indexes for common queries
CREATE INDEX idx_leases_company_status ON leases(company_id, status);
CREATE INDEX idx_leases_property_status ON leases(property_id, status);
CREATE INDEX idx_leases_tenant_status ON leases(tenant_id, status);

-- Create trigger for updated_at
CREATE TRIGGER update_leases_updated_at 
    BEFORE UPDATE ON leases 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE leases IS 'Comprehensive lease management table replacing virtual lease fields';
COMMENT ON COLUMN leases.lease_number IS 'Unique lease identifier for reference';
COMMENT ON COLUMN leases.parent_lease_id IS 'Reference to previous lease for renewals and history tracking';
COMMENT ON COLUMN leases.special_terms IS 'Custom lease terms and conditions';
COMMENT ON COLUMN leases.documents IS 'JSON array of lease documents and attachments';

-- Optional: Migrate existing lease data from units and tenant_profiles
-- This would need to be customized based on existing data structure
/*
INSERT INTO leases (
    company_id,
    tenant_id,
    unit_id,
    property_id,
    lease_number,
    lease_type,
    status,
    start_date,
    end_date,
    move_in_date,
    rent_amount,
    deposit_amount,
    created_by,
    created_at
)
SELECT 
    u.company_id,
    u.current_tenant_id,
    u.id,
    u.property_id,
    CONCAT('MIGRATED-', u.id),
    COALESCE(u.lease_type, 'fixed_term')::lease_type,
    CASE 
        WHEN u.status = 'occupied' THEN 'active'::lease_status
        ELSE 'draft'::lease_status
    END,
    COALESCE(u.lease_start_date, CURRENT_DATE),
    COALESCE(u.lease_end_date, CURRENT_DATE + INTERVAL '1 year'),
    u.lease_start_date,
    u.rent_amount,
    u.deposit_amount,
    u.created_by,
    u.created_at
FROM units u
WHERE u.current_tenant_id IS NOT NULL
  AND u.lease_start_date IS NOT NULL;
*/
