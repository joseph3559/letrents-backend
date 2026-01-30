#!/usr/bin/env node
/**
 * Drop existing unique indexes on verification_token so Prisma db push can create them.
 * Run once before: npx prisma db push --accept-data-loss
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Dropping existing verification_token unique indexes...');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS invoices_verification_token_key;');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS payments_verification_token_key;');
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
