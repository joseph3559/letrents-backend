import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export const getPrisma = (): PrismaClient => {
	if (!prisma) {
		// Get DATABASE_URL and add connection pool parameters if not present
		const databaseUrl = process.env.DATABASE_URL || '';
		let connectionUrl = databaseUrl;
		
		// Add connection pool parameters if not already present
		// This increases the connection pool size from default 5 to 20
		// and increases timeout from default 10s to 30s
		if (connectionUrl && !connectionUrl.includes('connection_limit')) {
			const separator = connectionUrl.includes('?') ? '&' : '?';
			connectionUrl = `${connectionUrl}${separator}connection_limit=20&pool_timeout=30`;
		}
		
		prisma = new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
			// Disable schema validation to prevent runtime introspection issues
			// The schema is validated at build time via prisma generate
			datasources: {
				db: {
					url: connectionUrl,
				},
			},
		});
		// Force connection to validate schema
		prisma.$connect().catch((e) => {
			console.error('Prisma connection error:', e);
		});
	}
	return prisma;
};
