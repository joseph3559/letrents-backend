import { getPrisma } from '../config/prisma.js';
export class DashboardService {
    prisma = getPrisma();
    async getDashboardStats(user) {
        // Initialize default stats
        let stats = {
            total_properties: 0,
            total_units: 0,
            occupied_units: 0,
            vacant_units: 0,
            occupancy_rate: 0,
            total_tenants: 0,
            active_tenants: 0,
            monthly_revenue: 0,
            annual_revenue: 0,
            pending_maintenance: 0,
            pending_inspections: 0,
            overdue_payments: 0,
            expiring_leases: 0,
        };
        try {
            // Build where clause based on user role and company
            const whereClause = {};
            if (user.role !== 'super_admin') {
                if (user.company_id) {
                    whereClause.company_id = user.company_id;
                }
                // For landlords, only show their own properties
                if (user.role === 'landlord') {
                    whereClause.owner_id = user.user_id;
                }
            }
            // Count properties
            const totalProperties = await this.prisma.property.count({
                where: whereClause,
            });
            // Count units and calculate occupancy
            const unitsStats = await this.prisma.unit.aggregate({
                where: {
                    property: whereClause,
                },
                _count: {
                    id: true,
                },
                _sum: {
                    rent_amount: true,
                },
            });
            const occupiedUnitsCount = await this.prisma.unit.count({
                where: {
                    property: whereClause,
                    status: 'occupied',
                },
            });
            const occupiedUnitsRevenue = await this.prisma.unit.aggregate({
                where: {
                    property: whereClause,
                    status: 'occupied',
                },
                _sum: {
                    rent_amount: true,
                },
            });
            // Count active tenants
            const activeTenants = await this.prisma.unit.count({
                where: {
                    property: whereClause,
                    current_tenant_id: { not: null },
                },
            });
            // Calculate stats
            const totalUnits = unitsStats._count?.id || 0;
            const occupiedUnits = occupiedUnitsCount || 0;
            const vacantUnits = totalUnits - occupiedUnits;
            const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
            const monthlyRevenue = Number(occupiedUnitsRevenue._sum.rent_amount || 0);
            const annualRevenue = monthlyRevenue * 12;
            stats = {
                total_properties: totalProperties,
                total_units: totalUnits,
                occupied_units: occupiedUnits,
                vacant_units: vacantUnits,
                occupancy_rate: Math.round(occupancyRate * 100) / 100, // Round to 2 decimal places
                total_tenants: activeTenants,
                active_tenants: activeTenants,
                monthly_revenue: monthlyRevenue,
                annual_revenue: annualRevenue,
                pending_maintenance: 0, // TODO: Implement when maintenance table exists
                pending_inspections: 0, // TODO: Implement when inspections table exists
                overdue_payments: 0, // TODO: Implement when payments table exists
                expiring_leases: 0, // TODO: Implement lease expiration logic
            };
        }
        catch (error) {
            console.error('Error calculating dashboard stats:', error);
            // Return default stats on error
        }
        return stats;
    }
    async getOnboardingStatus(user) {
        try {
            // Check if user has properties
            const propertiesCount = await this.prisma.property.count({
                where: {
                    owner_id: user.user_id,
                },
            });
            // Check if user has units
            const unitsCount = await this.prisma.unit.count({
                where: {
                    property: {
                        owner_id: user.user_id,
                    },
                },
            });
            // Check if user has tenants
            const tenantsCount = await this.prisma.user.count({
                where: {
                    role: 'tenant',
                    company_id: user.company_id,
                },
            });
            // Calculate completion steps
            const steps = {
                email_verified: true, // Assume verified if they're logged in
                first_property: propertiesCount > 0,
                add_units: unitsCount > 0,
                invite_tenants: tenantsCount > 0,
                setup_caretaker: false, // TODO: Check for caretakers when implemented
            };
            // Calculate completion percentage
            const completedSteps = Object.values(steps).filter(Boolean).length;
            const totalSteps = Object.keys(steps).length;
            const completionPercentage = Math.round((completedSteps / totalSteps) * 100);
            // Determine next step
            let nextStep = 'complete';
            if (!steps.first_property) {
                nextStep = 'create_property';
            }
            else if (!steps.add_units) {
                nextStep = 'add_units';
            }
            else if (!steps.invite_tenants) {
                nextStep = 'invite_tenants';
            }
            else if (!steps.setup_caretaker) {
                nextStep = 'setup_caretaker';
            }
            return {
                onboarding_complete: completionPercentage === 100,
                next_step: nextStep,
                completion_percentage: completionPercentage,
                steps,
            };
        }
        catch (error) {
            console.error('Error calculating onboarding status:', error);
            // Return default onboarding status on error
            return {
                onboarding_complete: false,
                next_step: 'create_property',
                completion_percentage: 20,
                steps: {
                    email_verified: true,
                    first_property: false,
                    add_units: false,
                    invite_tenants: false,
                    setup_caretaker: false,
                },
            };
        }
    }
}
