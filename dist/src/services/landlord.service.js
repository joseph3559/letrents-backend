import { getPrisma } from '../config/prisma.js';
const prisma = getPrisma();
export const landlordService = {
    // Dashboard services
    getDashboard: async (user) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        const [properties, units, tenants, maintenanceRequests] = await Promise.all([
            prisma.property.count({ where: whereClause }),
            prisma.unit.count({ where: whereClause }),
            prisma.user.count({
                where: {
                    ...whereClause,
                    role: 'tenant'
                }
            }),
            prisma.maintenanceRequest.count({
                where: {
                    ...whereClause,
                    status: 'pending'
                }
            }),
        ]);
        const occupiedUnits = await prisma.unit.count({
            where: {
                ...whereClause,
                status: 'occupied'
            }
        });
        const vacantUnits = units - occupiedUnits;
        const occupancyRate = units > 0 ? (occupiedUnits / units) * 100 : 0;
        // Calculate monthly revenue from occupied units only
        const monthlyRevenue = await prisma.unit.aggregate({
            where: {
                ...whereClause,
                status: 'occupied'
            },
            _sum: {
                rent_amount: true
            }
        });
        const monthlyRevenueAmount = Number(monthlyRevenue._sum.rent_amount || 0);
        return {
            total_properties: properties,
            total_units: units,
            occupied_units: occupiedUnits,
            vacant_units: vacantUnits,
            occupancy_rate: Math.round(occupancyRate * 100) / 100, // More precise rounding
            total_tenants: tenants,
            active_tenants: tenants,
            monthly_revenue: monthlyRevenueAmount,
            annual_revenue: monthlyRevenueAmount * 12,
            pending_maintenance: maintenanceRequests,
            pending_inspections: 0, // TODO: Implement inspections
            overdue_payments: 0, // TODO: Implement payments tracking
            expiring_leases: 0, // TODO: Implement lease tracking
        };
    },
    getDashboardStats: async (user) => {
        return await landlordService.getDashboard(user);
    },
    // Properties services
    getProperties: async (user, filters) => {
        console.log('🔍 landlordService.getProperties - User:', { role: user.role, user_id: user.user_id });
        // 🔒 CRITICAL: Landlord must ONLY see THEIR OWN properties
        const whereClause = { owner_id: user.user_id };
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.search_query) {
            whereClause.OR = [
                { name: { contains: filters.search_query, mode: 'insensitive' } },
                { street: { contains: filters.search_query, mode: 'insensitive' } },
                { city: { contains: filters.search_query, mode: 'insensitive' } },
            ];
        }
        console.log('✅ Landlord properties filter applied - owner_id:', user.user_id);
        const properties = await prisma.property.findMany({
            where: whereClause,
            include: {
                owner: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                },
                agency: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                units: {
                    select: {
                        id: true,
                        unit_number: true,
                        status: true,
                        rent_amount: true,
                    }
                },
                _count: {
                    select: {
                        units: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters.limit ? Number(filters.limit) : undefined,
            skip: filters.offset ? Number(filters.offset) : undefined,
        });
        // Transform properties to match frontend expectations with proper calculations
        const transformedProperties = await Promise.all(properties.map(async (property) => {
            // Get accurate unit counts using separate queries to ensure consistency
            const [totalUnits, occupiedUnits, vacantUnits] = await Promise.all([
                prisma.unit.count({
                    where: { property_id: property.id }
                }),
                prisma.unit.count({
                    where: { property_id: property.id, status: 'occupied' }
                }),
                prisma.unit.count({
                    where: { property_id: property.id, status: 'vacant' }
                })
            ]);
            // Calculate monthly revenue from occupied units
            const revenueResult = await prisma.unit.aggregate({
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
        return {
            properties: transformedProperties,
            total: transformedProperties.length,
        };
    },
    // Units services
    getUnits: async (user, filters) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        if (filters.property_id) {
            whereClause.property_id = filters.property_id;
        }
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.unit_type) {
            whereClause.unit_type = filters.unit_type;
        }
        const units = await prisma.unit.findMany({
            where: whereClause,
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        street: true,
                        city: true,
                    }
                },
                current_tenant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone_number: true,
                    }
                },
                creator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters.limit ? Number(filters.limit) : undefined,
            skip: filters.offset ? Number(filters.offset) : undefined,
        });
        return {
            units,
            total: units.length,
        };
    },
    // Tenants services
    getTenants: async (user, filters) => {
        console.log('🔍 landlordService.getTenants - User:', { role: user.role, user_id: user.user_id });
        // 🔒 CRITICAL: Landlord must ONLY see tenants from THEIR OWN properties
        const landlordProperties = await prisma.property.findMany({
            where: { owner_id: user.user_id },
            select: {
                id: true,
                name: true,
                units: { select: { id: true, unit_number: true, current_tenant_id: true } },
            },
        });
        console.log(`📊 Found ${landlordProperties.length} properties for landlord:`, landlordProperties.map(p => ({ id: p.id, name: p.name, units: p.units.length })));
        const propertyIds = landlordProperties.map(p => p.id);
        const directTenantIds = landlordProperties.flatMap(p => p.units.map(u => u.current_tenant_id)).filter(id => id !== null);
        console.log(`👥 Units with tenants:`, landlordProperties.flatMap(p => p.units.filter(u => u.current_tenant_id).map(u => ({ unit: u.unit_number, tenant_id: u.current_tenant_id }))));
        if (propertyIds.length === 0) {
            console.log('⚠️ Landlord has no properties - returning empty result');
            return { tenants: [], total: 0 };
        }
        // ✅ SIMPLIFIED: Just filter by tenant IDs found in units + leases
        let allTenantIds = [];
        if (directTenantIds.length === 0 && propertyIds.length > 0) {
            // Check if there are any leases for these properties
            const leases = await prisma.lease.findMany({
                where: { property_id: { in: propertyIds } },
                select: { tenant_id: true },
            });
            const leaseTenantIds = [...new Set(leases.map((l) => l.tenant_id))];
            if (leaseTenantIds.length === 0) {
                console.log('⚠️ Landlord has no tenants (no units occupied, no leases) - returning empty result');
                return { tenants: [], total: 0 };
            }
            allTenantIds = leaseTenantIds;
            console.log('✅ Landlord filter applied (leases only) - tenant_ids:', leaseTenantIds.length);
        }
        else {
            // Get additional tenant IDs from leases
            const leases = await prisma.lease.findMany({
                where: { property_id: { in: propertyIds } },
                select: { tenant_id: true },
            });
            const leaseTenantIds = leases.map((l) => l.tenant_id);
            allTenantIds = [...new Set([...directTenantIds, ...leaseTenantIds])];
            console.log('✅ Landlord filter applied - tenant_ids:', allTenantIds.length, '(from units:', directTenantIds.length, ', from leases:', leaseTenantIds.length, ')');
        }
        const whereClause = {
            role: 'tenant',
            id: { in: allTenantIds },
        };
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.search_query) {
            whereClause.OR = [
                { first_name: { contains: filters.search_query, mode: 'insensitive' } },
                { last_name: { contains: filters.search_query, mode: 'insensitive' } },
                { email: { contains: filters.search_query, mode: 'insensitive' } },
            ];
        }
        const tenants = await prisma.user.findMany({
            where: whereClause,
            include: {
                assigned_units: {
                    include: {
                        property: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters.limit ? Number(filters.limit) : undefined,
            skip: filters.offset ? Number(filters.offset) : undefined,
        });
        return {
            tenants,
            total: tenants.length,
        };
    },
    // Financial services
    getFinancialOverview: async (user) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        const totalRevenue = await prisma.unit.aggregate({
            where: {
                ...whereClause,
                status: 'occupied'
            },
            _sum: {
                rent_amount: true
            }
        });
        const totalUnits = await prisma.unit.count({ where: whereClause });
        const occupiedUnits = await prisma.unit.count({
            where: {
                ...whereClause,
                status: 'occupied'
            }
        });
        return {
            monthly_revenue: Number(totalRevenue._sum.rent_amount || 0),
            annual_revenue: Number(totalRevenue._sum.rent_amount || 0) * 12,
            total_units: totalUnits,
            occupied_units: occupiedUnits,
            occupancy_rate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
            collection_rate: 95, // TODO: Calculate from actual payments
            outstanding_amount: 0, // TODO: Calculate from invoices
        };
    },
    getPaymentHistory: async (user, filters) => {
        // TODO: Implement payment history when payment system is ready
        return {
            payments: [],
            total: 0,
        };
    },
    getRentCollectionStats: async (user, period) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        const totalRevenue = await prisma.unit.aggregate({
            where: {
                ...whereClause,
                status: 'occupied'
            },
            _sum: {
                rent_amount: true
            }
        });
        return {
            period,
            total_expected: Number(totalRevenue._sum.rent_amount || 0),
            total_collected: Number(totalRevenue._sum.rent_amount || 0) * 0.95, // 95% collection rate
            collection_rate: 95,
            outstanding: Number(totalRevenue._sum.rent_amount || 0) * 0.05,
        };
    },
    // Maintenance services
    getMaintenanceOverview: async (user) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        const [total, pending, inProgress, completed] = await Promise.all([
            prisma.maintenanceRequest.count({ where: whereClause }),
            prisma.maintenanceRequest.count({
                where: { ...whereClause, status: 'pending' }
            }),
            prisma.maintenanceRequest.count({
                where: { ...whereClause, status: 'in_progress' }
            }),
            prisma.maintenanceRequest.count({
                where: { ...whereClause, status: 'completed' }
            }),
        ]);
        return {
            total_requests: total,
            pending_requests: pending,
            in_progress_requests: inProgress,
            completed_requests: completed,
            average_resolution_time: 3.5, // TODO: Calculate from actual data
        };
    },
    getMaintenanceRequests: async (user, filters) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.priority) {
            whereClause.priority = filters.priority;
        }
        if (filters.category) {
            whereClause.category = filters.category;
        }
        const requests = await prisma.maintenanceRequest.findMany({
            where: whereClause,
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    }
                },
                requester: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    }
                },
                assignee: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters.limit ? Number(filters.limit) : undefined,
            skip: filters.offset ? Number(filters.offset) : undefined,
        });
        return {
            maintenance: requests,
            total: requests.length,
        };
    },
    // Inspection services (placeholder)
    getInspectionOverview: async (user) => {
        return {
            total_inspections: 0,
            scheduled_inspections: 0,
            completed_inspections: 0,
            overdue_inspections: 0,
        };
    },
    getInspectionSchedule: async (user, filters) => {
        return {
            inspections: [],
            total: 0,
        };
    },
    // Communication services (placeholder)
    getCommunicationOverview: async (user) => {
        return {
            total_messages: 0,
            unread_messages: 0,
            sent_messages: 0,
            received_messages: 0,
        };
    },
    getMessages: async (user, filters) => {
        return {
            messages: [],
            total: 0,
        };
    },
    // Reports services
    getReports: async (user, reportType, period = 'monthly') => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        const [properties, units, tenants] = await Promise.all([
            prisma.property.count({ where: whereClause }),
            prisma.unit.count({ where: whereClause }),
            prisma.user.count({
                where: {
                    ...whereClause,
                    role: 'tenant'
                }
            }),
        ]);
        return {
            period,
            report_type: reportType || 'overview',
            data: {
                properties,
                units,
                tenants,
                occupancy_rate: 85, // TODO: Calculate actual rate
                revenue: 0, // TODO: Calculate from payments
            },
            generated_at: new Date().toISOString(),
        };
    },
    generatePropertyReport: async (user, params) => {
        return await landlordService.getReports(user, 'property', params.period);
    },
    generateFinancialReport: async (user, params) => {
        return await landlordService.getReports(user, 'financial', params.period);
    },
    generateOccupancyReport: async (user, period) => {
        return await landlordService.getReports(user, 'occupancy', period);
    },
    getRentCollectionDetails: async (user, filters) => {
        return await landlordService.getRentCollectionStats(user, filters.period || 'monthly');
    },
    // Notifications services (placeholder)
    getNotifications: async (user, limit, offset, category, status) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        if (category && category !== 'all') {
            whereClause.category = category;
        }
        if (status && status !== 'all') {
            whereClause.status = status;
        }
        const notifications = await prisma.notification.findMany({
            where: whereClause,
            include: {
                sender: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: limit,
            skip: offset,
        });
        return {
            notifications,
            total: notifications.length,
        };
    },
    markNotificationAsRead: async (user, notificationId) => {
        await prisma.notification.update({
            where: {
                id: notificationId,
                ...(user.company_id ? { company_id: user.company_id } : {})
            },
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });
    },
    getUnreadNotificationCount: async (user) => {
        const whereClause = {
            is_read: false,
            recipient_id: user.user_id,
        };
        if (user.company_id) {
            whereClause.company_id = user.company_id;
        }
        return await prisma.notification.count({ where: whereClause });
    },
    markAllNotificationsAsRead: async (user) => {
        const whereClause = {
            is_read: false,
            recipient_id: user.user_id,
        };
        if (user.company_id) {
            whereClause.company_id = user.company_id;
        }
        await prisma.notification.updateMany({
            where: whereClause,
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });
    },
    deleteNotification: async (user, notificationId) => {
        await prisma.notification.delete({
            where: {
                id: notificationId,
                ...(user.company_id ? { company_id: user.company_id } : {})
            }
        });
    },
    // Caretaker services (placeholder - will use user table with role 'caretaker')
    getCaretakers: async (user, filters) => {
        const whereClause = {
            role: 'caretaker',
        };
        if (user.company_id) {
            whereClause.company_id = user.company_id;
        }
        const caretakers = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                status: true,
                created_at: true,
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return {
            caretakers,
            total: caretakers.length,
        };
    },
    createCaretaker: async (user, caretakerData) => {
        const caretaker = await prisma.user.create({
            data: {
                first_name: caretakerData.first_name,
                last_name: caretakerData.last_name,
                email: caretakerData.email,
                phone_number: caretakerData.phone_number,
                role: 'caretaker',
                status: 'active',
                company_id: user.company_id,
                created_by: user.user_id,
            }
        });
        return caretaker;
    },
    getCaretakerDetails: async (user, caretakerId) => {
        const caretaker = await prisma.user.findFirst({
            where: {
                id: caretakerId,
                role: 'caretaker',
                ...(user.company_id ? { company_id: user.company_id } : {})
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                status: true,
                created_at: true,
                updated_at: true,
            }
        });
        if (!caretaker) {
            throw new Error('Caretaker not found');
        }
        return caretaker;
    },
    updateCaretaker: async (user, caretakerId, updateData) => {
        const caretaker = await prisma.user.update({
            where: {
                id: caretakerId,
                ...(user.company_id ? { company_id: user.company_id } : {})
            },
            data: {
                first_name: updateData.first_name,
                last_name: updateData.last_name,
                email: updateData.email,
                phone_number: updateData.phone_number,
                status: updateData.status,
                updated_at: new Date(),
            }
        });
        return caretaker;
    },
    deleteCaretaker: async (user, caretakerId) => {
        await prisma.user.delete({
            where: {
                id: caretakerId,
                ...(user.company_id ? { company_id: user.company_id } : {})
            }
        });
    },
    // Invoice services (placeholder)
    getInvoices: async (user, filters) => {
        const whereClause = user.company_id ? { company_id: user.company_id } : {};
        if (filters.status) {
            whereClause.status = filters.status;
        }
        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: {
                recipient: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters.limit ? Number(filters.limit) : undefined,
            skip: filters.offset ? Number(filters.offset) : undefined,
        });
        return {
            invoices,
            total: invoices.length,
        };
    },
};
