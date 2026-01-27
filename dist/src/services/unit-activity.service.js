import { getPrisma } from '../config/prisma.js';
export class UnitActivityService {
    prisma = getPrisma();
    async logActivity(input) {
        return this.prisma.unitActivityLog.create({
            data: {
                unit_id: input.unit_id,
                company_id: input.company_id,
                actor_id: input.actor_id || null,
                event_type: input.event_type,
                title: input.title,
                description: input.description || null,
                metadata: input.metadata || {},
            },
        });
    }
    async listUnitActivity(unitId, user, limit = 50) {
        const where = {
            unit_id: unitId,
        };
        if (user.company_id) {
            where.company_id = user.company_id;
        }
        return this.prisma.unitActivityLog.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take: limit,
            include: {
                actor: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    },
                },
            },
        });
    }
}
