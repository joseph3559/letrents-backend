-- Add account_balance field to tenant_profiles for advance payment tracking
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS account_balance DECIMAL(12,2) DEFAULT 0.00;

-- Add comment to explain the field
COMMENT ON COLUMN tenant_profiles.account_balance IS 'Prepaid/advance payment balance that can be used for future rent and utilities';

-- Create index for quick balance lookups
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_account_balance ON tenant_profiles(account_balance) WHERE account_balance > 0;

