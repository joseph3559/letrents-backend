import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
	if (!prisma) {
		prisma = new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
			// Disable schema validation to prevent runtime introspection issues
			// The schema is validated at build time via prisma generate
		});
		// Force connection to validate schema
		prisma.$connect().catch((e) => {
			console.error('Prisma connection error:', e);
		});
	}
	return prisma;
};
