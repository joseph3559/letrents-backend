#!/usr/bin/env node
/**
 * Fix duplicate verification_token values in invoices and payments
 * so that Prisma db push can add the unique constraint safely.
 * Keeps one row per token value, sets duplicates to NULL (app can regenerate later).
 */

import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for duplicate verification_token values...');

  // Fix invoices: set verification_token to NULL for duplicate rows (keep first per value)
  const invoicesResult = await prisma.$executeRawUnsafe(`
    WITH dup AS (
      SELECT id, verification_token,
             ROW_NUMBER() OVER (PARTITION BY verification_token ORDER BY created_at) AS rn
      FROM invoices
      WHERE verification_token IS NOT NULL AND verification_token != ''
    )
    UPDATE invoices i
    SET verification_token = NULL, updated_at = NOW()
    FROM dup d
    WHERE i.id = d.id AND d.rn > 1
  `);
  console.log('Invoices: cleared', invoicesResult, 'duplicate verification_token(s)');

  // Fix payments: same
  const paymentsResult = await prisma.$executeRawUnsafe(`
    WITH dup AS (
      SELECT id, verification_token,
             ROW_NUMBER() OVER (PARTITION BY verification_token ORDER BY created_at) AS rn
      FROM payments
      WHERE verification_token IS NOT NULL AND verification_token != ''
    )
    UPDATE payments p
    SET verification_token = NULL, updated_at = NOW()
    FROM dup d
    WHERE p.id = d.id AND d.rn > 1
  `);
  console.log('Payments: cleared', paymentsResult, 'duplicate verification_token(s)');

  console.log('Done. You can now run: npx prisma db push --accept-data-loss');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
