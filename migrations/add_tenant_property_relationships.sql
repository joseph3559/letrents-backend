-- Migration: Add tenant-property relationships to tenant_profiles table
-- Date: 2024-12-19
-- Description: Add direct relationships between tenant profiles and their current property/unit

-- Add new columns to tenant_profiles table
ALTER TABLE tenant_profiles 
ADD COLUMN current_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
ADD COLUMN current_unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_tenant_profiles_current_property_id ON tenant_profiles(current_property_id);
CREATE INDEX idx_tenant_profiles_current_unit_id ON tenant_profiles(current_unit_id);

-- Add comments for documentation
COMMENT ON COLUMN tenant_profiles.current_property_id IS 'Direct reference to the property where the tenant currently resides';
COMMENT ON COLUMN tenant_profiles.current_unit_id IS 'Direct reference to the unit where the tenant currently resides';

-- Optional: Update existing tenant profiles with current property/unit data
-- This would need to be customized based on existing data structure
-- UPDATE tenant_profiles SET 
--   current_property_id = (SELECT property_id FROM units WHERE current_tenant_id = tenant_profiles.user_id LIMIT 1),
--   current_unit_id = (SELECT id FROM units WHERE current_tenant_id = tenant_profiles.user_id LIMIT 1)
-- WHERE current_property_id IS NULL;
