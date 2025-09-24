import { getPrisma } from '../config/prisma.js';
export class PropertiesService {
    prisma = getPrisma();
    async createProperty(req, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to create properties');
        }
        // For non-super-admin users, ensure company scoping
        let companyId = user.company_id;
        if (user.role !== 'super_admin' && !companyId) {
            throw new Error('user must be associated with a company');
        }
        // Create property
        const property = await this.prisma.property.create({
            data: {
                name: req.name,
                type: req.type,
                description: req.description,
                street: req.street,
                city: req.city,
                region: req.region,
                country: req.country,
                postal_code: req.postal_code,
                latitude: req.latitude,
                longitude: req.longitude,
                ownership_type: req.ownership_type,
                owner_id: req.owner_id,
                agency_id: req.agency_id,
                company_id: companyId,
                number_of_units: req.number_of_units,
                number_of_blocks: req.number_of_blocks,
                number_of_floors: req.number_of_floors,
                service_charge_rate: req.service_charge_rate,
                service_charge_type: req.service_charge_type,
                amenities: req.amenities || [],
                access_control: req.access_control,
                maintenance_schedule: req.maintenance_schedule,
                year_built: req.year_built,
                status: 'active',
                created_by: user.user_id,
            },
        });
        return property;
    }
    async getProperty(id, user) {
        const property = await this.prisma.property.findUnique({
            where: { id },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                agency: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        if (!property) {
            throw new Error('property not found');
        }
        // Check access permissions
        if (!this.hasPropertyAccess(property, user)) {
            throw new Error('insufficient permissions to view this property');
        }
        return property;
    }
    async updateProperty(id, req, user) {
        // First check if property exists and user has access
        const existingProperty = await this.getProperty(id, user);
        // Check update permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to update properties');
        }
        // For non-super-admin, ensure they can only update their own company's properties
        if (user.role !== 'super_admin' && existingProperty.company_id !== user.company_id) {
            throw new Error('cannot update properties from other companies');
        }
        const property = await this.prisma.property.update({
            where: { id },
            data: {
                ...(req.name && { name: req.name }),
                ...(req.description !== undefined && { description: req.description }),
                ...(req.street && { street: req.street }),
                ...(req.city && { city: req.city }),
                ...(req.region && { region: req.region }),
                ...(req.country && { country: req.country }),
                ...(req.postal_code !== undefined && { postal_code: req.postal_code }),
                ...(req.latitude !== undefined && { latitude: req.latitude }),
                ...(req.longitude !== undefined && { longitude: req.longitude }),
                ...(req.number_of_blocks !== undefined && { number_of_blocks: req.number_of_blocks }),
                ...(req.number_of_floors !== undefined && { number_of_floors: req.number_of_floors }),
                ...(req.service_charge_rate !== undefined && { service_charge_rate: req.service_charge_rate }),
                ...(req.service_charge_type !== undefined && { service_charge_type: req.service_charge_type }),
                ...(req.amenities && { amenities: req.amenities }),
                ...(req.access_control !== undefined && { access_control: req.access_control }),
                ...(req.maintenance_schedule !== undefined && { maintenance_schedule: req.maintenance_schedule }),
                ...(req.status && { status: req.status }),
                ...(req.year_built !== undefined && { year_built: req.year_built }),
                ...(req.images !== undefined && { images: req.images }),
                updated_at: new Date(),
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        first_name: true,
                        last_name: true,
                    },
                },
                agency: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return property;
    }
    async deleteProperty(id, user, force = false) {
        // First check if property exists and user has access
        const existingProperty = await this.getProperty(id, user);
        // Check delete permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to delete properties');
        }
        // For non-super-admin, ensure they can only delete their own company's properties
        if (user.role !== 'super_admin' && existingProperty.company_id !== user.company_id) {
            throw new Error('cannot delete properties from other companies');
        }
        // Check if property has occupied units (unless force delete)
        if (!force) {
            const occupiedUnits = await this.prisma.unit.count({
                where: {
                    property_id: id,
                    status: 'occupied',
                },
            });
            if (occupiedUnits > 0) {
                throw new Error('cannot delete property with occupied units. Use force delete to override.');
            }
        }
        // Use transaction to ensure all related data is deleted properly
        await this.prisma.$transaction(async (tx) => {
            // Delete related data in correct order to avoid foreign key constraints
            // 1. Delete lease agreements
            await tx.lease.deleteMany({
                where: {
                    unit: {
                        property_id: id
                    }
                }
            });
            // 2. Delete maintenance requests
            await tx.maintenanceRequest.deleteMany({
                where: {
                    property_id: id
                }
            });
            // 3. Delete invoices
            await tx.invoice.deleteMany({
                where: {
                    property_id: id
                }
            });
            // 4. Delete payments
            await tx.payment.deleteMany({
                where: {
                    unit: {
                        property_id: id
                    }
                }
            });
            // 5. Clear tenant assignments from units (set current_tenant_id to null)
            await tx.unit.updateMany({
                where: {
                    property_id: id,
                    current_tenant_id: { not: null }
                },
                data: {
                    current_tenant_id: null,
                    status: 'vacant'
                }
            });
            // 6. Delete units
            await tx.unit.deleteMany({
                where: {
                    property_id: id
                }
            });
            // 7. Finally delete the property
            await tx.property.delete({
                where: { id },
            });
        });
    }
    async listProperties(filters, user) {
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        // Build where clause with company scoping
        const where = {};
        // Company scoping for non-super-admin users
        if (user.role !== 'super_admin' && user.company_id) {
            where.company_id = user.company_id;
        }
        // Apply filters
        if (filters.owner_id)
            where.owner_id = filters.owner_id;
        if (filters.agency_id)
            where.agency_id = filters.agency_id;
        if (filters.company_id && user.role === 'super_admin')
            where.company_id = filters.company_id;
        if (filters.type)
            where.type = filters.type;
        if (filters.status)
            where.status = filters.status;
        if (filters.city)
            where.city = { contains: filters.city, mode: 'insensitive' };
        if (filters.region)
            where.region = { contains: filters.region, mode: 'insensitive' };
        if (filters.country)
            where.country = { contains: filters.country, mode: 'insensitive' };
        if (filters.min_units || filters.max_units) {
            where.number_of_units = {};
            if (filters.min_units)
                where.number_of_units.gte = filters.min_units;
            if (filters.max_units)
                where.number_of_units.lte = filters.max_units;
        }
        if (filters.year_built_min || filters.year_built_max) {
            where.year_built = {};
            if (filters.year_built_min)
                where.year_built.gte = filters.year_built_min;
            if (filters.year_built_max)
                where.year_built.lte = filters.year_built_max;
        }
        if (filters.amenities && filters.amenities.length > 0) {
            where.amenities = {
                hasEvery: filters.amenities,
            };
        }
        if (filters.search_query) {
            where.OR = [
                { name: { contains: filters.search_query, mode: 'insensitive' } },
                { description: { contains: filters.search_query, mode: 'insensitive' } },
                { street: { contains: filters.search_query, mode: 'insensitive' } },
                { city: { contains: filters.search_query, mode: 'insensitive' } },
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
        const [properties, total] = await Promise.all([
            this.prisma.property.findMany({
                where,
                include: {
                    owner: {
                        select: {
                            id: true,
                            email: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                    agency: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    _count: {
                        select: {
                            units: true,
                        },
                    },
                },
                orderBy,
                take: limit,
                skip: offset,
            }),
            this.prisma.property.count({ where }),
        ]);
        // Transform properties to include unit statistics for frontend compatibility
        const transformedProperties = await Promise.all(properties.map(async (property) => {
            // Get accurate unit counts using separate queries to ensure consistency
            const [totalUnits, occupiedUnits, vacantUnits] = await Promise.all([
                this.prisma.unit.count({
                    where: { property_id: property.id }
                }),
                this.prisma.unit.count({
                    where: { property_id: property.id, status: 'occupied' }
                }),
                this.prisma.unit.count({
                    where: { property_id: property.id, status: 'vacant' }
                })
            ]);
            // Calculate monthly revenue from occupied units
            const revenueResult = await this.prisma.unit.aggregate({
                where: {
                    property_id: property.id,
                    status: 'occupied'
                },
                _sum: {
                    rent_amount: true
                }
            });
            const monthlyRevenue = Number(revenueResult._sum.rent_amount || 0);
            return {
                ...property,
                total_units: totalUnits,
                occupied_units: occupiedUnits,
                vacant_units: vacantUnits,
                monthly_revenue: monthlyRevenue,
                occupancy_rate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
            };
        }));
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
        return {
            properties: transformedProperties,
            total,
            page: currentPage,
            per_page: limit,
            total_pages: totalPages,
        };
    }
    async getPropertyAnalytics(propertyId, user) {
        // First check if property exists and user has access
        await this.getProperty(propertyId, user);
        // Get property units with statistics
        const [totalUnits, occupiedUnits, unitsByType, unitsByStatus, revenueData] = await Promise.all([
            this.prisma.unit.count({
                where: { property_id: propertyId },
            }),
            this.prisma.unit.count({
                where: { property_id: propertyId, status: 'occupied' },
            }),
            this.prisma.unit.groupBy({
                by: ['unit_type'],
                where: { property_id: propertyId },
                _count: true,
            }),
            this.prisma.unit.groupBy({
                by: ['status'],
                where: { property_id: propertyId },
                _count: true,
            }),
            this.prisma.unit.aggregate({
                where: { property_id: propertyId },
                _avg: { rent_amount: true },
                _sum: { rent_amount: true },
            }),
        ]);
        const vacantUnits = totalUnits - occupiedUnits;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
        const totalMonthlyRevenue = occupiedUnits > 0 ? Number(revenueData._sum.rent_amount || 0) : 0;
        const potentialRevenue = Number(revenueData._sum.rent_amount || 0);
        const revenueEfficiency = potentialRevenue > 0 ? (totalMonthlyRevenue / potentialRevenue) * 100 : 0;
        return {
            property_id: propertyId,
            total_units: totalUnits,
            occupied_units: occupiedUnits,
            vacant_units: vacantUnits,
            occupancy_rate: Math.round(occupancyRate * 100) / 100,
            total_monthly_revenue: totalMonthlyRevenue,
            potential_revenue: potentialRevenue,
            revenue_efficiency: Math.round(revenueEfficiency * 100) / 100,
            average_rent: Number(revenueData._avg.rent_amount || 0),
            units_by_type: unitsByType.reduce((acc, item) => {
                acc[item.unit_type] = item._count;
                return acc;
            }, {}),
            units_by_status: unitsByStatus.reduce((acc, item) => {
                acc[item.status] = item._count;
                return acc;
            }, {}),
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
    async duplicateProperty(id, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to duplicate properties');
        }
        // Get the original property
        const originalProperty = await this.prisma.property.findUnique({
            where: { id },
            include: {
                units: true
            }
        });
        if (!originalProperty) {
            throw new Error('property not found');
        }
        // Check permissions
        if (user.role !== 'super_admin' && originalProperty.company_id !== user.company_id) {
            throw new Error('insufficient permissions to access this property');
        }
        // Create duplicate property
        const duplicateProperty = await this.prisma.property.create({
            data: {
                name: `${originalProperty.name} (Copy)`,
                type: originalProperty.type,
                description: originalProperty.description,
                street: originalProperty.street,
                city: originalProperty.city,
                region: originalProperty.region,
                country: originalProperty.country,
                postal_code: originalProperty.postal_code,
                latitude: originalProperty.latitude,
                longitude: originalProperty.longitude,
                ownership_type: originalProperty.ownership_type,
                owner_id: originalProperty.owner_id,
                agency_id: originalProperty.agency_id,
                company_id: originalProperty.company_id,
                number_of_units: originalProperty.number_of_units,
                number_of_blocks: originalProperty.number_of_blocks,
                number_of_floors: originalProperty.number_of_floors,
                service_charge_rate: originalProperty.service_charge_rate,
                service_charge_type: originalProperty.service_charge_type,
                amenities: originalProperty.amenities || [],
                access_control: originalProperty.access_control,
                maintenance_schedule: originalProperty.maintenance_schedule,
                year_built: originalProperty.year_built,
                status: 'active',
                images: [], // Don't copy images
                documents: [], // Don't copy documents
                created_by: user.user_id,
            },
        });
        return duplicateProperty;
    }
    async updatePropertyStatus(id, status, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to update property status');
        }
        // Validate status
        const validStatuses = ['active', 'under_construction', 'renovation', 'inactive'];
        if (!validStatuses.includes(status)) {
            throw new Error('invalid status value');
        }
        // Get the property first to check permissions
        const property = await this.prisma.property.findUnique({
            where: { id }
        });
        if (!property) {
            throw new Error('property not found');
        }
        // Check permissions
        if (user.role !== 'super_admin' && property.company_id !== user.company_id) {
            throw new Error('insufficient permissions to access this property');
        }
        // Update property status
        const updatedProperty = await this.prisma.property.update({
            where: { id },
            data: {
                status: status,
                updated_at: new Date()
            },
        });
        return updatedProperty;
    }
    async archiveProperty(id, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to archive properties');
        }
        // Get the property first to check permissions
        const property = await this.prisma.property.findUnique({
            where: { id },
            include: {
                units: {
                    where: {
                        status: 'occupied'
                    }
                }
            }
        });
        if (!property) {
            throw new Error('property not found');
        }
        // Check permissions
        if (user.role !== 'super_admin' && property.company_id !== user.company_id) {
            throw new Error('insufficient permissions to access this property');
        }
        // Check if property has occupied units
        if (property.units.length > 0) {
            throw new Error('cannot archive property with occupied units');
        }
        // Archive property by setting status to inactive
        const archivedProperty = await this.prisma.property.update({
            where: { id },
            data: {
                status: 'inactive',
                updated_at: new Date()
            },
        });
        return archivedProperty;
    }
}
