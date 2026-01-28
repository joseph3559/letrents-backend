-- Baseline migration to align Prisma migrate history with existing schema.

-- Required extensions for UUID defaults used throughout the schema.
-- Prisma shadow database starts empty, so we must ensure these exist for all subsequent migrations.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
