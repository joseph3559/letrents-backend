-- Add profile_picture column to tenant_profiles table
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add comment
COMMENT ON COLUMN tenant_profiles.profile_picture IS 'URL to the tenant profile picture stored in ImageKit';
