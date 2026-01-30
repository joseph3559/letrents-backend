#!/usr/bin/env node
/**
 * Drop existing unique indexes on verification_token so Prisma db push can create them.
 * Run once before: npx prisma db push --accept-data-loss
 */

import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Dropping existing verification_token indexes...');
  const indexes = [
    'invoices_verification_token_key',
    'invoices_verification_token_idx',
    'payments_verification_token_key',
    'payments_verification_token_idx',
  ];
  for (const name of indexes) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}";`);
    console.log('Dropped', name);
  }
  console.log('Done. Run: npx prisma db push --accept-data-loss');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
