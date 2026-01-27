-- Add verification fields to invoices and payments tables
-- This migration adds support for QR code-based document verification

-- Add verification fields to invoices table
ALTER TABLE "invoices" 
ADD COLUMN IF NOT EXISTS "verification_token" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "qr_url" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ(6);

-- Add verification fields to payments table  
ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "verification_token" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "qr_url" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ(6);

-- Create unique indexes on verification_token (only for non-null values)
-- Note: PostgreSQL unique constraints allow multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_verification_token_key" 
ON "invoices" ("verification_token") 
WHERE "verification_token" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_verification_token_key" 
ON "payments" ("verification_token") 
WHERE "verification_token" IS NOT NULL;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS "invoices_verification_token_idx" 
ON "invoices" ("verification_token") 
WHERE "verification_token" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "payments_verification_token_idx" 
ON "payments" ("verification_token") 
WHERE "verification_token" IS NOT NULL;
