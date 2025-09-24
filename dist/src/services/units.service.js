import { getPrisma } from '../config/prisma.js';
import { LeasesService } from './leases.service.js';
// Utility function to map frontend unit type values to database enum values
function mapUnitType(frontendType) {
    const unitTypeMap = {
        '1_bedroom': 'one_bedroom',
        '2_bedroom': 'two_bedroom',
        '3_bedroom': 'three_bedroom',
        '4_bedroom': 'four_bedroom',
        '5_bedroom': 'five_plus_bedroom',
        '5_plus_bedroom': 'five_plus_bedroom',
        // Add other mappings as needed
        'single_room': 'single_room',
        'double_room': 'double_room',
        'bedsitter': 'bedsitter',
        'studio': 'studio',
        'one_bedroom': 'one_bedroom',
        'two_bedroom': 'two_bedroom',
        'three_bedroom': 'three_bedroom',
        'four_bedroom': 'four_bedroom',
        'five_plus_bedroom': 'five_plus_bedroom',
        'servant_quarter': 'servant_quarter',
        'maisonette': 'maisonette',
        'penthouse': 'penthouse',
        'office_space': 'office_space',
        'retail_shop': 'retail_shop',
        'kiosk': 'kiosk',
        'stall': 'stall',
        'warehouse': 'warehouse',
        'restaurant_space': 'restaurant_space',
        'studio_office': 'studio_office',
        'coworking_unit': 'coworking_unit',
        'medical_suite': 'medical_suite'
    };
    return unitTypeMap[frontendType] || frontendType;
}
function mapUtilityBillingType(frontendType) {
    const billingTypeMap = {
        'tenant_pays': 'postpaid',
        'landlord_pays': 'inclusive',
        'prepaid': 'prepaid',
        'postpaid': 'postpaid',
        'inclusive': 'inclusive'
    };
    return billingTypeMap[frontendType] || 'postpaid'; // Default to postpaid
}
function mapUnitCondition(frontendCondition) {
    const conditionMap = {
        'needs_preparation': 'needs_repairs',
        'needs_repair': 'needs_repairs',
        'needs_repairs': 'needs_repairs',
        'new': 'new',
        'excellent': 'excellent',
        'good': 'good',
        'fair': 'fair',
        'poor': 'poor',
        'renovated': 'renovated'
    };
    return conditionMap[frontendCondition] || 'good'; // Default to good
}
export class UnitsService {
    prisma = getPrisma();
    leasesService = new LeasesService();
    async createUnit(req, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to create units');
        }
        // Check if property exists and user has access
        const property = await this.prisma.property.findUnique({
            where: { id: req.property_id },
        });
        if (!property) {
            throw new Error('property not found');
        }
        // Check property access
        if (!this.hasPropertyAccess(property, user)) {
            throw new Error('insufficient permissions to create units in this property');
        }
        // Check for duplicate unit number in the same property
        const existingUnit = await this.prisma.unit.findFirst({
            where: {
                property_id: req.property_id,
                unit_number: req.unit_number,
            },
        });
        if (existingUnit) {
            throw new Error('unit number already exists in this property');
        }
        // Apply defaults
        const unitData = {
            property_id: req.property_id,
            unit_number: req.unit_number,
            unit_type: mapUnitType(req.unit_type),
            block_number: req.block_number,
            floor_number: req.floor_number,
            size_square_feet: req.size_square_feet,
            size_square_meters: req.size_square_meters,
            number_of_bedrooms: req.number_of_bedrooms,
            number_of_bathrooms: req.number_of_bathrooms,
            has_ensuite: req.has_ensuite || false,
            has_balcony: req.has_balcony || false,
            has_parking: req.has_parking || false,
            parking_spaces: req.parking_spaces || 0,
            rent_amount: req.rent_amount,
            currency: req.currency || 'KES',
            deposit_amount: req.deposit_amount,
            deposit_months: req.deposit_months || 1,
            status: 'vacant',
            condition: mapUnitCondition(req.condition || 'good'),
            furnishing_type: (req.furnishing_type || 'unfurnished'),
            water_meter_number: req.water_meter_number,
            electric_meter_number: req.electric_meter_number,
            utility_billing_type: mapUtilityBillingType(req.utility_billing_type || 'postpaid'),
            in_unit_amenities: req.in_unit_amenities || [],
            appliances: req.appliances || [],
            company_id: property.company_id,
            created_by: user.user_id,
        };
        const unit = await this.prisma.unit.create({
            data: unitData,
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                current_tenant: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        return unit;
    }
    async createUnits(req, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to create units');
        }
        const units = [];
        for (const unitReq of req.units) {
            const unit = await this.createUnit(unitReq, user);
            units.push(unit);
        }
        return units;
    }
    async getUnit(id, user) {
        const unit = await this.prisma.unit.findUnique({
            where: { id },
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                        owner_id: true,
                        agency_id: true,
                        company_id: true,
                    },
                },
                current_tenant: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                        phone_number: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                leases: {
                    where: {
                        status: 'active',
                    },
                    select: {
                        id: true,
                        lease_number: true,
                        start_date: true,
                        end_date: true,
                        rent_amount: true,
                        deposit_amount: true,
                        lease_type: true,
                        status: true,
                        special_terms: true,
                        tenant: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                email: true,
                                phone_number: true,
                            },
                        },
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                    take: 1,
                },
            },
        });
        if (!unit) {
            throw new Error('unit not found');
        }
        // Check access permissions
        if (!this.hasUnitAccess(unit, user)) {
            throw new Error('insufficient permissions to view this unit');
        }
        // If we have an active lease, use that tenant info and merge with current_tenant
        if (unit.leases.length > 0) {
            const activeLease = unit.leases[0];
            unit.active_lease = activeLease;
            // If lease tenant differs from current_tenant, use lease tenant
            if (activeLease.tenant) {
                unit.current_tenant = {
                    ...unit.current_tenant,
                    ...activeLease.tenant,
                    ...(activeLease.start_date && { move_in_date: activeLease.start_date }),
                    ...(activeLease.end_date && { lease_end_date: activeLease.end_date }),
                };
            }
        }
        return unit;
    }
    async updateUnit(id, req, user) {
        // First check if unit exists and user has access
        const existingUnit = await this.getUnit(id, user);
        // Check update permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to update units');
        }
        // If unit number is being changed, check for duplicates
        if (req.unit_number && req.unit_number !== existingUnit.unit_number) {
            const duplicateUnit = await this.prisma.unit.findFirst({
                where: {
                    property_id: existingUnit.property_id,
                    unit_number: req.unit_number,
                    id: { not: id },
                },
            });
            if (duplicateUnit) {
                throw new Error('unit number already exists in this property');
            }
        }
        const unit = await this.prisma.unit.update({
            where: { id },
            data: {
                ...(req.unit_number && { unit_number: req.unit_number }),
                ...(req.unit_type && { unit_type: req.unit_type }),
                ...(req.block_number !== undefined && { block_number: req.block_number }),
                ...(req.floor_number !== undefined && { floor_number: req.floor_number }),
                ...(req.size_square_feet !== undefined && { size_square_feet: req.size_square_feet }),
                ...(req.size_square_meters !== undefined && { size_square_meters: req.size_square_meters }),
                ...(req.number_of_bedrooms !== undefined && { number_of_bedrooms: req.number_of_bedrooms }),
                ...(req.number_of_bathrooms !== undefined && { number_of_bathrooms: req.number_of_bathrooms }),
                ...(req.has_ensuite !== undefined && { has_ensuite: req.has_ensuite }),
                ...(req.has_balcony !== undefined && { has_balcony: req.has_balcony }),
                ...(req.has_parking !== undefined && { has_parking: req.has_parking }),
                ...(req.parking_spaces !== undefined && { parking_spaces: req.parking_spaces }),
                ...(req.rent_amount !== undefined && { rent_amount: req.rent_amount }),
                ...(req.currency && { currency: req.currency }),
                ...(req.deposit_amount !== undefined && { deposit_amount: req.deposit_amount }),
                ...(req.deposit_months !== undefined && { deposit_months: req.deposit_months }),
                ...(req.status && { status: req.status }),
                ...(req.condition && { condition: mapUnitCondition(req.condition) }),
                ...(req.furnishing_type && { furnishing_type: req.furnishing_type }),
                ...(req.water_meter_number !== undefined && { water_meter_number: req.water_meter_number }),
                ...(req.electric_meter_number !== undefined && { electric_meter_number: req.electric_meter_number }),
                ...(req.utility_billing_type && { utility_billing_type: mapUtilityBillingType(req.utility_billing_type) }),
                ...(req.in_unit_amenities && { in_unit_amenities: req.in_unit_amenities }),
                ...(req.appliances && { appliances: req.appliances }),
                updated_at: new Date(),
            },
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    },
                },
                current_tenant: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
            },
        });
        return unit;
    }
    async deleteUnit(id, user) {
        // First check if unit exists and user has access
        const existingUnit = await this.getUnit(id, user);
        // Check delete permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to delete units');
        }
        // Check if unit is occupied or reserved
        if (existingUnit.status === 'occupied' || existingUnit.status === 'reserved') {
            throw new Error('cannot delete occupied or reserved unit');
        }
        // Delete unit
        await this.prisma.unit.delete({
            where: { id },
        });
    }
    async listUnits(filters, user) {
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        // Build where clause with company scoping
        const where = {};
        // Company scoping for non-super-admin users
        if (user.role !== 'super_admin' && user.company_id) {
            where.company_id = user.company_id;
        }
        // Apply filters
        if (filters.property_id)
            where.property_id = filters.property_id;
        if (filters.unit_type)
            where.unit_type = filters.unit_type;
        if (filters.status)
            where.status = filters.status;
        if (filters.condition)
            where.condition = filters.condition;
        if (filters.furnishing_type)
            where.furnishing_type = filters.furnishing_type;
        if (filters.current_tenant_id)
            where.current_tenant_id = filters.current_tenant_id;
        if (filters.block_number)
            where.block_number = { contains: filters.block_number, mode: 'insensitive' };
        if (filters.floor_number !== undefined)
            where.floor_number = filters.floor_number;
        if (filters.lease_type)
            where.lease_type = filters.lease_type;
        // Boolean filters
        if (filters.has_ensuite !== undefined)
            where.has_ensuite = filters.has_ensuite;
        if (filters.has_balcony !== undefined)
            where.has_balcony = filters.has_balcony;
        if (filters.has_parking !== undefined)
            where.has_parking = filters.has_parking;
        // Range filters
        if (filters.min_rent || filters.max_rent) {
            where.rent_amount = {};
            if (filters.min_rent)
                where.rent_amount.gte = filters.min_rent;
            if (filters.max_rent)
                where.rent_amount.lte = filters.max_rent;
        }
        if (filters.min_bedrooms || filters.max_bedrooms) {
            where.number_of_bedrooms = {};
            if (filters.min_bedrooms)
                where.number_of_bedrooms.gte = filters.min_bedrooms;
            if (filters.max_bedrooms)
                where.number_of_bedrooms.lte = filters.max_bedrooms;
        }
        if (filters.min_bathrooms || filters.max_bathrooms) {
            where.number_of_bathrooms = {};
            if (filters.min_bathrooms)
                where.number_of_bathrooms.gte = filters.min_bathrooms;
            if (filters.max_bathrooms)
                where.number_of_bathrooms.lte = filters.max_bathrooms;
        }
        if (filters.min_size || filters.max_size) {
            where.size_square_meters = {};
            if (filters.min_size)
                where.size_square_meters.gte = filters.min_size;
            if (filters.max_size)
                where.size_square_meters.lte = filters.max_size;
        }
        // Array filters
        if (filters.amenities && filters.amenities.length > 0) {
            where.in_unit_amenities = {
                hasEvery: filters.amenities,
            };
        }
        if (filters.appliances && filters.appliances.length > 0) {
            where.appliances = {
                hasEvery: filters.appliances,
            };
        }
        // Search query
        if (filters.search_query) {
            where.OR = [
                { unit_number: { contains: filters.search_query, mode: 'insensitive' } },
                { block_number: { contains: filters.search_query, mode: 'insensitive' } },
                { property: { name: { contains: filters.search_query, mode: 'insensitive' } } },
                { property: { street: { contains: filters.search_query, mode: 'insensitive' } } },
            ];
        }
        // Build order by clause
        const orderBy = {};
        if (filters.sort_by) {
            const sortOrder = filters.sort_order === 'desc' ? 'desc' : 'asc';
            orderBy[filters.sort_by] = sortOrder;
        }
        else {
            orderBy.created_at = 'desc';
        }
        // Execute queries
        const [units, total] = await Promise.all([
            this.prisma.unit.findMany({
                where,
                include: {
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                        },
                    },
                    current_tenant: {
                        select: {
                            id: true,
                            email: true,
                            first_name: true,
                            last_name: true,
                            phone_number: true,
                        },
                    },
                },
                orderBy,
                take: limit,
                skip: offset,
            }),
            this.prisma.unit.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
        return {
            units,
            total,
            page: currentPage,
            per_page: limit,
            total_pages: totalPages,
        };
    }
    async updateUnitStatus(unitId, status, user) {
        // First check if unit exists and user has access
        await this.getUnit(unitId, user);
        // Check update permissions
        if (!['super_admin', 'agency_admin', 'landlord', 'caretaker'].includes(user.role)) {
            throw new Error('insufficient permissions to update unit status');
        }
        await this.prisma.unit.update({
            where: { id: unitId },
            data: {
                status: status,
                updated_at: new Date(),
            },
        });
    }
    async assignTenant(req, user) {
        // First check if unit exists and user has access
        const unit = await this.getUnit(req.unit_id, user);
        // Check assign permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to assign tenants');
        }
        // Check if unit is available
        if (unit.status !== 'vacant' && unit.status !== 'available') {
            throw new Error('unit is not available for assignment');
        }
        // Check if tenant/caretaker exists
        const tenant = await this.prisma.user.findUnique({
            where: { id: req.tenant_id },
            select: {
                id: true,
                role: true,
                first_name: true,
                last_name: true,
                email: true,
                company_id: true,
            },
        });
        if (!tenant) {
            throw new Error('tenant/caretaker not found');
        }
        // Validate that user is either tenant or caretaker
        if (!['tenant', 'caretaker'].includes(tenant.role)) {
            throw new Error('user must be a tenant or caretaker to be assigned to a unit');
        }
        // Update unit with tenant assignment
        await this.prisma.unit.update({
            where: { id: req.unit_id },
            data: {
                current_tenant_id: req.tenant_id,
                lease_start_date: new Date(req.lease_start_date),
                lease_end_date: new Date(req.lease_end_date),
                lease_type: req.lease_type,
                status: 'occupied',
                updated_at: new Date(),
            },
        });
        // Automatically create a lease for this assignment
        const leaseData = {
            tenant_id: req.tenant_id,
            unit_id: req.unit_id,
            property_id: unit.property_id,
            lease_type: req.lease_type || 'fixed_term',
            start_date: req.lease_start_date,
            end_date: req.lease_end_date,
            move_in_date: req.lease_start_date, // Default move-in to start date
            rent_amount: Number(unit.rent_amount) || 0,
            deposit_amount: Number(unit.deposit_amount) || Number(unit.rent_amount) || 0, // Default deposit = 1 month rent
            payment_frequency: 'monthly',
            payment_day: 1,
            notice_period_days: 30,
            renewable: true,
            auto_renewal: false,
            pets_allowed: false,
            smoking_allowed: false,
            subletting_allowed: false,
            special_terms: tenant.role === 'caretaker' ? 'Staff accommodation lease agreement' : undefined,
        };
        try {
            await this.leasesService.createLease(leaseData, user);
            console.log(`✅ Auto-created lease for ${tenant.role} ${tenant.first_name} ${tenant.last_name} (${tenant.email}) in unit ${unit.unit_number}`);
        }
        catch (leaseError) {
            console.error(`⚠️ Failed to auto-create lease for tenant assignment:`, leaseError.message);
            // Don't fail the assignment if lease creation fails - log and continue
            // The lease can be created manually later if needed
        }
    }
    async releaseTenant(unitId, user) {
        // First check if unit exists and user has access
        const unit = await this.getUnit(unitId, user);
        // Check release permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to release tenants');
        }
        // Check if unit has a tenant
        if (!unit.current_tenant_id) {
            throw new Error('unit does not have an assigned tenant');
        }
        // Release tenant
        await this.prisma.unit.update({
            where: { id: unitId },
            data: {
                current_tenant_id: null,
                lease_start_date: null,
                lease_end_date: null,
                lease_type: null,
                status: 'vacant',
                updated_at: new Date(),
            },
        });
    }
    async searchAvailableUnits(filters) {
        // Force status to available units only
        const availableFilters = {
            ...filters,
            status: undefined, // Remove status filter to apply our own
        };
        const where = {
            status: { in: ['vacant', 'available'] },
        };
        // Apply other filters (reuse the same logic from listUnits but simplified)
        if (filters.property_id)
            where.property_id = filters.property_id;
        if (filters.unit_type)
            where.unit_type = filters.unit_type;
        if (filters.min_rent || filters.max_rent) {
            where.rent_amount = {};
            if (filters.min_rent)
                where.rent_amount.gte = filters.min_rent;
            if (filters.max_rent)
                where.rent_amount.lte = filters.max_rent;
        }
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        const [units, total] = await Promise.all([
            this.prisma.unit.findMany({
                where,
                include: {
                    property: {
                        select: {
                            id: true,
                            name: true,
                            street: true,
                            city: true,
                            region: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.unit.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
        return {
            units,
            total,
            page: currentPage,
            per_page: limit,
            total_pages: totalPages,
        };
    }
    hasPropertyAccess(property, user) {
        // Super admin has access to all properties
        if (user.role === 'super_admin')
            return true;
        // Company scoping - user can only access properties from their company
        if (user.company_id && property.company_id === user.company_id)
            return true;
        // Owner can access their own properties
        if (property.owner_id === user.user_id)
            return true;
        // Agency admin can access properties from their agency
        if (user.role === 'agency_admin' && user.agency_id && property.agency_id === user.agency_id)
            return true;
        return false;
    }
    hasUnitAccess(unit, user) {
        // Super admin has access to all units
        if (user.role === 'super_admin')
            return true;
        // Company scoping - user can only access units from their company
        if (user.company_id && unit.company_id === user.company_id)
            return true;
        // Property owner can access units in their properties
        if (unit.property && unit.property.owner_id === user.user_id)
            return true;
        // Agency admin can access units from properties in their agency
        if (user.role === 'agency_admin' && user.agency_id && unit.property && unit.property.agency_id === user.agency_id)
            return true;
        // Tenant can access their own unit
        if (user.role === 'tenant' && unit.current_tenant_id === user.user_id)
            return true;
        return false;
    }
}
