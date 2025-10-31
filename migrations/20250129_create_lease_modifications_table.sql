-- Migration: Create lease modifications tracking table
-- Date: 2025-01-29
-- Description: Track all changes made to lease agreements for audit trail and tenant visibility

-- Create modification type enum
CREATE TYPE lease_modification_type AS ENUM (
    'rent_change',
    'term_extension',
    'term_reduction',
    'deposit_change',
    'payment_terms',
    'lease_conditions',
    'special_terms',
    'status_change',
    'renewal',
    'termination',
    'other'
);

-- Create lease modifications table
CREATE TABLE IF NOT EXISTS lease_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Modification details
    modification_type lease_modification_type NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    
    -- Context and approval
    reason TEXT,
    description TEXT,
    modified_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    modified_by_role VARCHAR(50), -- Store role at time of modification
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- Tenant acknowledgment
    tenant_notified BOOLEAN DEFAULT FALSE,
    tenant_acknowledged BOOLEAN DEFAULT FALSE,
    tenant_acknowledged_at TIMESTAMPTZ,
    
    -- Audit fields
    effective_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Add constraint to ensure we have modification details
    CONSTRAINT chk_modification_value CHECK (
        old_value IS NOT NULL OR new_value IS NOT NULL
    )
);

-- Create indexes for performance
CREATE INDEX idx_lease_modifications_lease_id ON lease_modifications(lease_id);
CREATE INDEX idx_lease_modifications_company_id ON lease_modifications(company_id);
CREATE INDEX idx_lease_modifications_modified_by ON lease_modifications(modified_by);
CREATE INDEX idx_lease_modifications_created_at ON lease_modifications(created_at DESC);
CREATE INDEX idx_lease_modifications_type ON lease_modifications(modification_type);

-- Create composite indexes for common queries
CREATE INDEX idx_lease_modifications_lease_created ON lease_modifications(lease_id, created_at DESC);
CREATE INDEX idx_lease_modifications_company_lease ON lease_modifications(company_id, lease_id);

-- Add comments for documentation
COMMENT ON TABLE lease_modifications IS 'Comprehensive audit trail of all lease changes for transparency and compliance';
COMMENT ON COLUMN lease_modifications.field_name IS 'Name of the field that was modified (e.g., rent_amount, end_date)';
COMMENT ON COLUMN lease_modifications.old_value IS 'Previous value before modification';
COMMENT ON COLUMN lease_modifications.new_value IS 'New value after modification';
COMMENT ON COLUMN lease_modifications.tenant_notified IS 'Whether tenant has been notified of this change';
COMMENT ON COLUMN lease_modifications.tenant_acknowledged IS 'Whether tenant has acknowledged seeing this change';
COMMENT ON COLUMN lease_modifications.effective_date IS 'Date when the modification takes effect';

-- Create function to automatically log lease modifications
CREATE OR REPLACE FUNCTION log_lease_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_modified_by UUID;
    v_modifier_role VARCHAR(50);
    v_field_name VARCHAR(100);
    v_old_value TEXT;
    v_new_value TEXT;
    v_mod_type lease_modification_type;
BEGIN
    -- Get company_id from the lease
    v_company_id := NEW.company_id;
    
    -- Try to get modified_by from context, otherwise use created_by
    v_modified_by := COALESCE(
        current_setting('app.current_user_id', true)::UUID,
        NEW.created_by
    );
    
    v_modifier_role := COALESCE(
        current_setting('app.current_user_role', true),
        'system'
    );

    -- Check each field that might have changed
    -- Rent amount change
    IF OLD.rent_amount IS DISTINCT FROM NEW.rent_amount THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'rent_change', 'rent_amount',
            OLD.rent_amount::TEXT, NEW.rent_amount::TEXT,
            v_modified_by, v_modifier_role, NEW.start_date
        );
    END IF;

    -- Deposit amount change
    IF OLD.deposit_amount IS DISTINCT FROM NEW.deposit_amount THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'deposit_change', 'deposit_amount',
            OLD.deposit_amount::TEXT, NEW.deposit_amount::TEXT,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- End date change (term extension/reduction)
    IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
        v_mod_type := CASE 
            WHEN NEW.end_date > OLD.end_date THEN 'term_extension'
            ELSE 'term_reduction'
        END;
        
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, v_mod_type, 'end_date',
            OLD.end_date::TEXT, NEW.end_date::TEXT,
            v_modified_by, v_modifier_role, NEW.end_date
        );
    END IF;

    -- Start date change
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'payment_terms', 'start_date',
            OLD.start_date::TEXT, NEW.start_date::TEXT,
            v_modified_by, v_modifier_role, NEW.start_date
        );
    END IF;

    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_mod_type := CASE 
            WHEN NEW.status = 'terminated' THEN 'termination'
            WHEN NEW.status = 'renewed' THEN 'renewal'
            ELSE 'status_change'
        END;
        
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            reason, effective_date
        ) VALUES (
            NEW.id, v_company_id, v_mod_type, 'status',
            OLD.status::TEXT, NEW.status::TEXT,
            v_modified_by, v_modifier_role,
            NEW.termination_reason, CURRENT_DATE
        );
    END IF;

    -- Payment frequency change
    IF OLD.payment_frequency IS DISTINCT FROM NEW.payment_frequency THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'payment_terms', 'payment_frequency',
            OLD.payment_frequency, NEW.payment_frequency,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- Payment day change
    IF OLD.payment_day IS DISTINCT FROM NEW.payment_day THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'payment_terms', 'payment_day',
            OLD.payment_day::TEXT, NEW.payment_day::TEXT,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- Special terms change
    IF OLD.special_terms IS DISTINCT FROM NEW.special_terms THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'special_terms', 'special_terms',
            OLD.special_terms, NEW.special_terms,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- Pets allowed change
    IF OLD.pets_allowed IS DISTINCT FROM NEW.pets_allowed THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'lease_conditions', 'pets_allowed',
            OLD.pets_allowed::TEXT, NEW.pets_allowed::TEXT,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- Smoking allowed change
    IF OLD.smoking_allowed IS DISTINCT FROM NEW.smoking_allowed THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'lease_conditions', 'smoking_allowed',
            OLD.smoking_allowed::TEXT, NEW.smoking_allowed::TEXT,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    -- Subletting allowed change
    IF OLD.subletting_allowed IS DISTINCT FROM NEW.subletting_allowed THEN
        INSERT INTO lease_modifications (
            lease_id, company_id, modification_type, field_name,
            old_value, new_value, modified_by, modified_by_role,
            effective_date
        ) VALUES (
            NEW.id, v_company_id, 'lease_conditions', 'subletting_allowed',
            OLD.subletting_allowed::TEXT, NEW.subletting_allowed::TEXT,
            v_modified_by, v_modifier_role, CURRENT_DATE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log modifications
CREATE TRIGGER trg_log_lease_modifications
    AFTER UPDATE ON leases
    FOR EACH ROW
    EXECUTE FUNCTION log_lease_modification();

-- Grant appropriate permissions
GRANT SELECT ON lease_modifications TO authenticated;
GRANT INSERT ON lease_modifications TO authenticated;
GRANT UPDATE (tenant_acknowledged, tenant_acknowledged_at) ON lease_modifications TO authenticated;

COMMENT ON TRIGGER trg_log_lease_modifications ON leases IS 'Automatically logs all lease modifications for audit trail';

