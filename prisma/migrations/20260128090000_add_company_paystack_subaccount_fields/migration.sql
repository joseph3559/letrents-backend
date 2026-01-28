-- Add Paystack subaccount fields to companies for marketplace settlement routing.

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "paystack_subaccount_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "paystack_settlement_bank" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "paystack_account_number" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "paystack_account_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "paystack_subaccount_status" VARCHAR(30) NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS "paystack_subaccount_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "paystack_subaccount_updated_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "companies_paystack_subaccount_code_idx"
  ON "companies" ("paystack_subaccount_code");

