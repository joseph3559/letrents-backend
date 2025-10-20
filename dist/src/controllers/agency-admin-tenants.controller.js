import { getPrisma } from '../config/prisma.js';
const prisma = getPrisma();
// Get tenant details for agency admin
export const getAgencyTenant = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = req.params.id;
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }
        // Get tenant with full profile and property information
        const tenant = await prisma.user.findUnique({
            where: { id: tenantId },
            include: {
                tenant_profile: {
                    include: {
                        current_unit: {
                            include: {
                                property: true
                            }
                        },
                        current_property: true
                    }
                }
            }
        });
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }
        // Get active lease information
        const activeLease = await prisma.lease.findFirst({
            where: {
                tenant_id: tenantId,
                status: 'active'
            },
            include: {
                unit: {
                    include: {
                        property: true
                    }
                },
                property: true
            }
        });
        // Get payment summary
        const payments = await prisma.payment.findMany({
            where: {
                tenant_id: tenantId
            },
            orderBy: {
                payment_date: 'desc'
            },
            take: 5
        });
        const totalPaid = await prisma.payment.aggregate({
            where: {
                tenant_id: tenantId,
                status: 'completed'
            },
            _sum: {
                amount: true
            }
        });
        const pendingPayments = await prisma.payment.count({
            where: {
                tenant_id: tenantId,
                status: 'pending'
            }
        });
        // Get maintenance requests count
        const maintenanceCount = await prisma.maintenanceRequest.count({
            where: {
                requested_by: tenantId
            }
        });
        const activeMaintenance = await prisma.maintenanceRequest.count({
            where: {
                requested_by: tenantId,
                status: { in: ['pending', 'in_progress'] }
            }
        });
        // Calculate balance (simplified - in real app would be more complex)
        const balance = pendingPayments > 0 ? (activeLease?.rent_amount ? Number(activeLease.rent_amount) : 0) : 0;
        // Format response for agency admin
        const tenantData = {
            id: tenant.id,
            first_name: tenant.first_name,
            last_name: tenant.last_name,
            email: tenant.email,
            phone_number: tenant.phone_number,
            status: tenant.status,
            created_at: tenant.created_at,
            // Property and unit information
            property_name: tenant.tenant_profile?.current_property?.name || activeLease?.property?.name || 'No Property Assigned',
            unit_number: tenant.tenant_profile?.current_unit?.unit_number || activeLease?.unit?.unit_number || 'No Unit Assigned',
            // Lease information
            lease_start: activeLease?.start_date?.toISOString() || tenant.tenant_profile?.lease_start_date?.toISOString(),
            lease_end: activeLease?.end_date?.toISOString() || tenant.tenant_profile?.lease_end_date?.toISOString(),
            rent_amount: Number(activeLease?.rent_amount || tenant.tenant_profile?.rent_amount || 0),
            // Payment information
            total_paid: Number(totalPaid._sum.amount || 0),
            pending_payments: pendingPayments,
            balance: balance,
            last_payment_date: payments.length > 0 ? payments[0].payment_date : null,
            // Maintenance information
            total_maintenance_requests: maintenanceCount,
            active_maintenance_requests: activeMaintenance,
            // Emergency contact
            emergency_contact: {
                name: tenant.tenant_profile?.emergency_contact_name || '',
                phone: tenant.tenant_profile?.emergency_contact_phone || '',
                relationship: tenant.tenant_profile?.emergency_contact_relationship || '',
                email: '' // Not stored in current schema
            },
            // Additional profile information
            move_in_date: tenant.tenant_profile?.move_in_date?.toISOString(),
            payment_frequency: tenant.tenant_profile?.payment_frequency || 'monthly',
            payment_day: tenant.tenant_profile?.payment_day || 1,
            preferred_communication_method: tenant.tenant_profile?.preferred_communication_method || 'email',
            // Unit details if available
            unit_details: tenant.tenant_profile?.current_unit ? {
                id: tenant.tenant_profile.current_unit.id,
                unit_type: tenant.tenant_profile.current_unit.unit_type,
                bedrooms: tenant.tenant_profile.current_unit.number_of_bedrooms,
                bathrooms: tenant.tenant_profile.current_unit.number_of_bathrooms,
                size_sqft: tenant.tenant_profile.current_unit.size_square_feet,
                amenities: tenant.tenant_profile.current_unit.in_unit_amenities || []
            } : null,
            // Property details if available
            property_details: tenant.tenant_profile?.current_property ? {
                id: tenant.tenant_profile.current_property.id,
                address: `${tenant.tenant_profile.current_property.street}, ${tenant.tenant_profile.current_property.city}`,
                city: tenant.tenant_profile.current_property.city,
                region: tenant.tenant_profile.current_property.region,
                amenities: tenant.tenant_profile.current_property.amenities || []
            } : null
        };
        res.json({
            success: true,
            message: 'Tenant details retrieved successfully',
            data: tenantData
        });
    }
    catch (error) {
        console.error('Error getting agency tenant details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tenant details'
        });
    }
};
// Get tenant payments for agency admin
export const getAgencyTenantPayments = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const offset = (page - 1) * limit;
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where: {
                    tenant_id: tenantId
                },
                include: {
                    unit: {
                        include: {
                            property: true
                        }
                    },
                    property: true,
                    lease: true
                },
                orderBy: {
                    payment_date: 'desc'
                },
                skip: offset,
                take: limit
            }),
            prisma.payment.count({
                where: {
                    tenant_id: tenantId
                }
            })
        ]);
        res.json({
            success: true,
            message: 'Tenant payments retrieved successfully',
            data: {
                payments,
                pagination: {
                    page,
                    per_page: limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Error getting agency tenant payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tenant payments'
        });
    }
};
// Get tenant maintenance requests for agency admin
export const getAgencyTenantMaintenance = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const offset = (page - 1) * limit;
        const [maintenanceRequests, total] = await Promise.all([
            prisma.maintenanceRequest.findMany({
                where: {
                    requested_by: tenantId
                },
                include: {
                    property: true,
                    unit: true,
                    assignee: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    created_at: 'desc'
                },
                skip: offset,
                take: limit
            }),
            prisma.maintenanceRequest.count({
                where: {
                    requested_by: tenantId
                }
            })
        ]);
        res.json({
            success: true,
            message: 'Tenant maintenance requests retrieved successfully',
            data: {
                maintenance_requests: maintenanceRequests,
                pagination: {
                    page,
                    per_page: limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        console.error('Error getting agency tenant maintenance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tenant maintenance requests'
        });
    }
};
