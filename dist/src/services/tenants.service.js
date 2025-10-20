import { getPrisma } from '../config/prisma.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LeasesService } from './leases.service.js';
export class TenantsService {
    prisma = getPrisma();
    leasesService = new LeasesService();
    async createTenant(req, user) {
        // Validate user permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to create tenants');
        }
        // Check if user with email already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: req.email },
        });
        if (existingUser) {
            throw new Error('user with this email already exists');
        }
        // If unit_id is provided, validate the unit exists and is available
        let unit = null;
        if (req.unit_id) {
            unit = await this.prisma.unit.findUnique({
                where: { id: req.unit_id },
                include: {
                    property: {
                        select: {
                            id: true,
                            name: true,
                            owner_id: true,
                            agency_id: true,
                            company_id: true,
                        },
                    },
                },
            });
            if (!unit) {
                throw new Error('unit not found');
            }
            // Check if user has access to this unit's property
            if (!this.hasPropertyAccess(unit.property, user)) {
                throw new Error('insufficient permissions to assign tenant to this unit');
            }
            // Check if unit is available
            if (unit.status !== 'vacant') {
                throw new Error('unit is not available for tenant assignment');
            }
            // Check if unit already has a tenant
            if (unit.current_tenant_id) {
                throw new Error('unit already has an assigned tenant');
            }
        }
        // Create tenant user account
        const tenantData = {
            email: req.email,
            first_name: req.first_name,
            last_name: req.last_name,
            phone_number: req.phone_number,
            role: 'tenant',
            status: req.send_invitation !== false ? 'pending' : 'active',
            email_verified: false,
            company_id: user.company_id,
            created_by: user.user_id,
            // Don't set password_hash if sending invitation - they'll set it up later
            ...(req.send_invitation === false && { password_hash: await bcrypt.hash('temporary123', 10) }),
        };
        const tenant = await this.prisma.user.create({
            data: tenantData,
        });
        // If unit is provided, assign tenant to unit
        if (req.unit_id && unit) {
            // Auto-generate lease agreement BEFORE assigning tenant to unit
            let leaseId = null;
            try {
                const { LeasesService } = await import('./leases.service.js');
                const leasesService = new LeasesService();
                const rentAmount = Number(unit.rent_amount) || 0;
                const securityDeposit = rentAmount * 2; // 2 months security deposit
                const leaseData = {
                    tenant_id: tenant.id,
                    property_id: unit.property.id,
                    unit_id: req.unit_id,
                    lease_type: req.lease_type || 'fixed_term',
                    start_date: req.lease_start_date || new Date().toISOString().split('T')[0],
                    end_date: req.lease_end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
                    rent_amount: rentAmount,
                    deposit_amount: securityDeposit,
                    payment_day: 5, // 5th of each month
                    special_terms: `
This lease agreement is automatically generated for the property unit ${unit.unit_number} at ${unit.property.name}.

TERMS AND CONDITIONS:
1. Rent is due on the 5th of each month
2. Late fee of KES 500 applies after 5 days grace period
3. Security deposit of KES ${securityDeposit} is required
4. Tenant is responsible for utilities unless otherwise specified
5. Property must be maintained in good condition
6. No subletting without written permission
7. 30 days notice required for termination

This agreement is subject to the laws of Kenya and any disputes shall be resolved through arbitration.
          `.trim(),
                };
                const lease = await leasesService.createLease(leaseData, user);
                leaseId = lease.id;
                console.log(`✅ Auto-generated lease agreement for tenant ${tenant.first_name} ${tenant.last_name} - Lease ID: ${lease.id}`);
            }
            catch (leaseError) {
                console.error('❌ Failed to auto-generate lease:', leaseError);
                // Don't fail tenant creation if lease creation fails
            }
            // Now assign tenant to unit
            await this.prisma.unit.update({
                where: { id: req.unit_id },
                data: {
                    current_tenant_id: tenant.id,
                    lease_start_date: req.lease_start_date ? new Date(req.lease_start_date) : null,
                    lease_end_date: req.lease_end_date ? new Date(req.lease_end_date) : null,
                    lease_type: req.lease_type,
                    status: 'occupied',
                    updated_at: new Date(),
                },
            });
            // Create pending payment record for the first month's rent
            try {
                const currentDate = new Date();
                const paymentPeriod = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                await this.prisma.payment.create({
                    data: {
                        company_id: user.company_id || unit.property.company_id,
                        tenant_id: tenant.id,
                        unit_id: req.unit_id,
                        property_id: unit.property.id,
                        lease_id: leaseId, // Link to the auto-generated lease
                        amount: Number(unit.rent_amount) || 0,
                        currency: 'KES',
                        payment_method: 'cash', // Default method, will be updated when actual payment is made
                        payment_type: 'rent',
                        status: 'pending',
                        payment_date: new Date(),
                        payment_period: paymentPeriod,
                        receipt_number: `PENDING-${Date.now()}`,
                        received_from: `${tenant.first_name} ${tenant.last_name}`,
                        notes: 'Initial rent payment - pending after tenant onboarding',
                        created_by: user.user_id,
                    },
                });
                console.log(`✅ Created pending payment record for tenant ${tenant.first_name} ${tenant.last_name} - Amount: ${unit.rent_amount} KES`);
            }
            catch (paymentError) {
                console.error('❌ Failed to create pending payment record:', paymentError);
                // Don't fail tenant creation if payment creation fails
            }
        }
        // Send invitation email if requested (default is true)
        if (req.send_invitation !== false) {
            try {
                await this.sendInvitation(tenant.id, user);
                console.log(`✅ Invitation email sent to tenant ${tenant.first_name} ${tenant.last_name} at ${tenant.email}`);
            }
            catch (invitationError) {
                console.error('❌ Failed to send invitation email:', invitationError);
                // Don't fail tenant creation if invitation fails
            }
        }
        // Return tenant with unit info if assigned
        const tenantWithUnit = await this.prisma.user.findUnique({
            where: { id: tenant.id },
            include: {
                assigned_units: {
                    select: {
                        id: true,
                        unit_number: true,
                        property_id: true,
                        rent_amount: true,
                        property: {
                            select: {
                                id: true,
                                name: true,
                                street: true,
                                city: true,
                            },
                        },
                    },
                },
            },
        });
        return {
            ...tenantWithUnit,
            password_hash: undefined, // Don't return password hash
        };
    }
    async getTenant(id, user) {
        const tenant = await this.prisma.user.findUnique({
            where: {
                id,
                role: 'tenant',
            },
            include: {
                assigned_units: {
                    select: {
                        id: true,
                        unit_number: true,
                        property_id: true,
                        rent_amount: true,
                        lease_start_date: true,
                        lease_end_date: true,
                        lease_type: true,
                        status: true,
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
                },
                tenant_profile: {
                    include: {
                        current_unit: {
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
                        },
                        current_property: {
                            select: {
                                id: true,
                                name: true,
                                street: true,
                                city: true,
                                region: true,
                            },
                        },
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
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check access permissions
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to view this tenant');
        }
        // Create unified property and unit information
        // Priority: tenant_profile data over assigned_units data
        const currentUnit = tenant.tenant_profile?.current_unit || tenant.assigned_units?.[0];
        const currentProperty = tenant.tenant_profile?.current_property ||
            tenant.tenant_profile?.current_unit?.property ||
            tenant.assigned_units?.[0]?.property;
        return {
            ...tenant,
            password_hash: undefined, // Don't return password hash
            // Unified property and unit information for all admin interfaces
            property_name: currentProperty?.name || 'No Property Assigned',
            unit_number: currentUnit?.unit_number || 'No Unit Assigned',
            unit_id: currentUnit?.id,
            property_id: currentProperty?.id,
            // Lease information from tenant_profile or assigned_units
            rent_amount: tenant.tenant_profile?.rent_amount || currentUnit?.rent_amount || 0,
            lease_start: tenant.tenant_profile?.lease_start_date || currentUnit?.lease_start_date,
            lease_end: tenant.tenant_profile?.lease_end_date || currentUnit?.lease_end_date,
            move_in_date: tenant.tenant_profile?.move_in_date,
            // Additional tenant profile information
            emergency_contact: tenant.tenant_profile ? {
                name: tenant.tenant_profile.emergency_contact_name || '',
                phone: tenant.tenant_profile.emergency_contact_phone || '',
                relationship: tenant.tenant_profile.emergency_contact_relationship || '',
                email: '', // Not stored in current schema
            } : null,
            // Keep original assigned_units for backward compatibility
            assigned_units: tenant.assigned_units,
            tenant_profile: tenant.tenant_profile,
        };
    }
    async updateTenant(id, req, user) {
        // First check if tenant exists and user has access
        const existingTenant = await this.getTenant(id, user);
        // Check update permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to update tenants');
        }
        // Parse name field if provided (frontend sends "name" instead of first_name/last_name)
        let firstName = req.first_name;
        let lastName = req.last_name;
        if (req.name && !firstName && !lastName) {
            const nameParts = req.name.trim().split(' ');
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
        }
        // Parse phone field if provided (frontend sends "phone" instead of phone_number)
        const phoneNumber = req.phone_number || req.phone;
        // If email is being changed, check for duplicates
        if (req.email && req.email !== existingTenant.email) {
            const duplicateUser = await this.prisma.user.findUnique({
                where: { email: req.email },
            });
            if (duplicateUser && duplicateUser.id !== id) {
                throw new Error('user with this email already exists');
            }
        }
        // Update user basic info
        const tenant = await this.prisma.user.update({
            where: { id },
            data: {
                ...(firstName && { first_name: firstName }),
                ...(lastName && { last_name: lastName }),
                ...(phoneNumber !== undefined && { phone_number: phoneNumber }),
                ...(req.email && { email: req.email }),
                ...(req.status && { status: req.status }),
                updated_at: new Date(),
            },
            include: {
                assigned_units: {
                    select: {
                        id: true,
                        unit_number: true,
                        property_id: true,
                        rent_amount: true,
                        property: {
                            select: {
                                id: true,
                                name: true,
                                street: true,
                                city: true,
                            },
                        },
                    },
                },
                tenant_profile: true,
            },
        });
        // Handle tenant profile updates
        const profileUpdates = {};
        // Handle ID number from different possible field names
        if (req.id_number !== undefined) {
            profileUpdates.id_number = req.id_number;
        }
        else if (req.idNumber !== undefined) {
            profileUpdates.id_number = req.idNumber;
        }
        // Handle emergency contact from different possible formats
        if (req.emergencyContact) {
            if (req.emergencyContact.name !== undefined) {
                profileUpdates.emergency_contact_name = req.emergencyContact.name;
            }
            if (req.emergencyContact.phone !== undefined) {
                profileUpdates.emergency_contact_phone = req.emergencyContact.phone;
            }
            if (req.emergencyContact.relationship !== undefined) {
                profileUpdates.emergency_contact_relationship = req.emergencyContact.relationship;
            }
        }
        // Handle direct emergency contact fields
        if (req.emergency_contact_name !== undefined) {
            profileUpdates.emergency_contact_name = req.emergency_contact_name;
        }
        if (req.emergency_contact_phone !== undefined) {
            profileUpdates.emergency_contact_phone = req.emergency_contact_phone;
        }
        if (req.emergency_contact_relationship !== undefined) {
            profileUpdates.emergency_contact_relationship = req.emergency_contact_relationship;
        }
        // Update tenant profile if there are profile updates
        if (Object.keys(profileUpdates).length > 0) {
            await this.prisma.tenantProfile.upsert({
                where: { user_id: id },
                update: profileUpdates,
                create: {
                    user_id: id,
                    ...profileUpdates,
                },
            });
        }
        // Return updated tenant with profile data
        return this.getTenant(id, user);
    }
    async deleteTenant(id, user) {
        // First check if tenant exists and user has access
        const existingTenant = await this.getTenant(id, user);
        // Check delete permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to delete tenants');
        }
        // Check if tenant is currently assigned to any units
        const assignedUnits = await this.prisma.unit.findMany({
            where: { current_tenant_id: id },
        });
        if (assignedUnits.length > 0) {
            throw new Error('cannot delete tenant who is currently assigned to units. Please release tenant from units first.');
        }
        // Delete tenant
        await this.prisma.user.delete({
            where: { id },
        });
    }
    async listTenants(filters, user) {
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        // Build where clause with company scoping
        const where = {
            role: 'tenant',
        };
        // Company scoping for non-super-admin users
        if (user.role !== 'super_admin' && user.company_id) {
            where.company_id = user.company_id;
        }
        // Apply filters
        if (filters.status)
            where.status = filters.status;
        // Property/Unit filtering
        if (filters.property_id || filters.unit_id) {
            where.assigned_units = {};
            if (filters.unit_id) {
                where.assigned_units.id = filters.unit_id;
            }
            if (filters.property_id) {
                where.assigned_units.property_id = filters.property_id;
            }
        }
        // Search query
        if (filters.search_query) {
            where.OR = [
                { first_name: { contains: filters.search_query, mode: 'insensitive' } },
                { last_name: { contains: filters.search_query, mode: 'insensitive' } },
                { email: { contains: filters.search_query, mode: 'insensitive' } },
                { phone_number: { contains: filters.search_query, mode: 'insensitive' } },
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
        // Execute queries - include both assigned_units AND tenant_profile for consistency
        const [tenants, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                include: {
                    assigned_units: {
                        select: {
                            id: true,
                            unit_number: true,
                            property_id: true,
                            rent_amount: true,
                            lease_start_date: true,
                            lease_end_date: true,
                            lease_type: true,
                            status: true,
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
                    },
                    tenant_profile: {
                        include: {
                            current_unit: {
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
                            },
                            current_property: {
                                select: {
                                    id: true,
                                    name: true,
                                    street: true,
                                    city: true,
                                    region: true,
                                },
                            },
                        },
                    },
                },
                orderBy,
                take: limit,
                skip: offset,
            }),
            this.prisma.user.count({ where }),
        ]);
        // Format tenants using unified logic (same as getTenant method)
        const formattedTenants = tenants.map(tenant => {
            // Create unified property and unit information
            // Priority: tenant_profile data over assigned_units data
            const currentUnit = tenant.tenant_profile?.current_unit || tenant.assigned_units?.[0];
            const currentProperty = tenant.tenant_profile?.current_property ||
                tenant.tenant_profile?.current_unit?.property ||
                tenant.assigned_units?.[0]?.property;
            return {
                ...tenant,
                password_hash: undefined, // Don't return password hash
                // Unified property and unit information for consistency with getTenant
                property_name: currentProperty?.name || 'No Property Assigned',
                unit_number: currentUnit?.unit_number || 'No Unit Assigned',
                unit_id: currentUnit?.id,
                property_id: currentProperty?.id,
                // Lease information from tenant_profile or assigned_units
                rent_amount: tenant.tenant_profile?.rent_amount || currentUnit?.rent_amount || 0,
                lease_start: tenant.tenant_profile?.lease_start_date || currentUnit?.lease_start_date,
                lease_end: tenant.tenant_profile?.lease_end_date || currentUnit?.lease_end_date,
                // Legacy unit_info structure for backward compatibility
                unit_info: currentUnit ? {
                    unit_id: currentUnit.id,
                    unit_number: currentUnit.unit_number,
                    property_id: currentProperty?.id,
                    property_name: currentProperty?.name || 'No Property',
                    rent_amount: Number(tenant.tenant_profile?.rent_amount || currentUnit.rent_amount || 0),
                    lease_start_date: tenant.tenant_profile?.lease_start_date || currentUnit.lease_start_date,
                    lease_end_date: tenant.tenant_profile?.lease_end_date || currentUnit.lease_end_date,
                    lease_type: currentUnit.lease_type,
                    status: currentUnit.status,
                } : {
                    unit_id: null,
                    unit_number: 'No Unit Assigned',
                    property_id: null,
                    property_name: 'No Property Assigned',
                    rent_amount: 0,
                },
                // Frontend compatibility fields (using unified data)
                propertyName: currentProperty?.name || 'No Property Assigned',
                unitNumber: currentUnit?.unit_number || 'No Unit Assigned',
                // Data source indicator
                source: currentUnit ? (tenant.tenant_profile?.current_unit ? 'tenant_profile' : 'unit_assignment') : 'user_account',
                // Keep original data for debugging but remove from response
                assigned_units: undefined,
                tenant_profile: undefined,
            };
        });
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.floor(offset / limit) + 1;
        return {
            tenants: formattedTenants,
            total,
            page: currentPage,
            per_page: limit,
            total_pages: totalPages,
        };
    }
    async assignUnit(tenantId, req, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to assign units to tenants');
        }
        // Check if tenant/caretaker exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: { in: ['tenant', 'caretaker'] },
            },
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
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant/caretaker');
        }
        // Check if unit exists and is available
        const unit = await this.prisma.unit.findUnique({
            where: { id: req.unit_id },
            include: {
                property: {
                    select: {
                        id: true,
                        owner_id: true,
                        agency_id: true,
                        company_id: true,
                    },
                },
            },
        });
        if (!unit) {
            throw new Error('unit not found');
        }
        // Check property access
        if (!this.hasPropertyAccess(unit.property, user)) {
            throw new Error('insufficient permissions to assign tenant to this unit');
        }
        // Check if unit is available
        if (unit.status !== 'vacant') {
            throw new Error('unit is not available for tenant assignment');
        }
        // Check if unit already has a tenant
        if (unit.current_tenant_id) {
            throw new Error('unit already has an assigned tenant');
        }
        // Check if tenant is already assigned to another unit
        const currentUnit = await this.prisma.unit.findFirst({
            where: { current_tenant_id: tenantId },
        });
        if (currentUnit) {
            throw new Error('tenant is already assigned to another unit. Please release them first.');
        }
        // Assign tenant to unit
        await this.prisma.unit.update({
            where: { id: req.unit_id },
            data: {
                current_tenant_id: tenantId,
                lease_start_date: new Date(req.lease_start_date),
                lease_end_date: new Date(req.lease_end_date),
                lease_type: req.lease_type,
                status: 'occupied',
                updated_at: new Date(),
            },
        });
        // Automatically create a lease for this assignment
        const leaseData = {
            tenant_id: tenantId,
            unit_id: req.unit_id,
            property_id: unit.property.id,
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
        let leaseId = null;
        try {
            const lease = await this.leasesService.createLease(leaseData, user);
            leaseId = lease.id;
            console.log(`✅ Auto-created lease for ${tenant.role} ${tenant.first_name} ${tenant.last_name} (${tenant.email}) in unit ${unit.unit_number}`);
        }
        catch (leaseError) {
            console.error(`⚠️ Failed to auto-create lease for tenant assignment:`, leaseError.message);
            // Don't fail the assignment if lease creation fails - log and continue
            // The lease can be created manually later if needed
        }
        // Create pending payment record for the first month's rent (only for tenants, not caretakers)
        if (tenant.role === 'tenant') {
            try {
                const currentDate = new Date();
                const paymentPeriod = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                await this.prisma.payment.create({
                    data: {
                        company_id: user.company_id || unit.property.company_id,
                        tenant_id: tenantId,
                        unit_id: req.unit_id,
                        property_id: unit.property.id,
                        lease_id: leaseId, // Link to the auto-generated lease
                        amount: Number(unit.rent_amount) || 0,
                        currency: 'KES',
                        payment_method: 'cash', // Default method, will be updated when actual payment is made
                        payment_type: 'rent',
                        status: 'pending',
                        payment_date: new Date(),
                        payment_period: paymentPeriod,
                        receipt_number: `PENDING-${Date.now()}`,
                        received_from: `${tenant.first_name} ${tenant.last_name}`,
                        notes: 'Initial rent payment - pending after unit assignment',
                        created_by: user.user_id,
                    },
                });
                console.log(`✅ Created pending payment record for tenant ${tenant.first_name} ${tenant.last_name} - Amount: ${unit.rent_amount} KES`);
            }
            catch (paymentError) {
                console.error('❌ Failed to create pending payment record:', paymentError);
                // Don't fail unit assignment if payment creation fails
            }
        }
    }
    async releaseUnit(tenantId, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to release tenants from units');
        }
        // Check if tenant exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: 'tenant',
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant');
        }
        // Find tenant's current unit
        const currentUnit = await this.prisma.unit.findFirst({
            where: { current_tenant_id: tenantId },
            include: {
                property: {
                    select: {
                        id: true,
                        owner_id: true,
                        agency_id: true,
                        company_id: true,
                    },
                },
            },
        });
        if (!currentUnit) {
            throw new Error('tenant is not currently assigned to any unit');
        }
        // Check property access
        if (!this.hasPropertyAccess(currentUnit.property, user)) {
            throw new Error('insufficient permissions to release tenant from this unit');
        }
        // Release tenant from unit
        await this.prisma.unit.update({
            where: { id: currentUnit.id },
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
    async terminateTenant(tenantId, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to terminate tenants');
        }
        // Check if tenant exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: 'tenant',
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant');
        }
        // Release tenant from any assigned units
        await this.releaseUnit(tenantId, user);
        // Deactivate tenant account
        await this.prisma.user.update({
            where: { id: tenantId },
            data: {
                status: 'inactive',
                updated_at: new Date(),
            },
        });
    }
    async sendInvitation(tenantId, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to send tenant invitations');
        }
        // Check if tenant exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: 'tenant',
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant');
        }
        // Send invitation email
        try {
            const { emailService } = await import('./email.service.js');
            // Generate invitation link using the existing tenant-register route
            const invitationLink = `${process.env.APP_URL || 'http://localhost:3000'}/tenant-register?email=${encodeURIComponent(tenant.email)}&first_name=${encodeURIComponent(tenant.first_name || '')}&last_name=${encodeURIComponent(tenant.last_name || '')}&token=invitation-${tenant.id}`;
            const emailResult = await emailService.sendEmail({
                to: tenant.email,
                subject: 'Welcome to LetRents - Complete Your Tenant Setup',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to LetRents!</h2>
            
            <p>Hello ${tenant.first_name} ${tenant.last_name},</p>
            
            <p>You've been invited to join LetRents as a tenant. Please complete your account setup to access your tenant portal.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">What you can do with your tenant portal:</h3>
              <ul style="color: #6b7280;">
                <li>View your lease information</li>
                <li>Submit maintenance requests</li>
                <li>Make rent payments online</li>
                <li>View payment history</li>
                <li>Communicate with property management</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Complete Account Setup
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              If you have any questions, please contact your property management team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              This email was sent by LetRents Property Management System
            </p>
          </div>
        `,
                text: `
Welcome to LetRents!

Hello ${tenant.first_name} ${tenant.last_name},

You've been invited to join LetRents as a tenant. Please complete your account setup to access your tenant portal.

Complete your setup here: ${invitationLink}

What you can do with your tenant portal:
- View your lease information
- Submit maintenance requests  
- Make rent payments online
- View payment history
- Communicate with property management

If you have any questions, please contact your property management team.
        `,
            });
            if (!emailResult.success) {
                console.error('Failed to send tenant invitation email:', emailResult.error);
                throw new Error('Failed to send invitation email');
            }
            console.log(`✅ Tenant invitation email sent successfully to ${tenant.email}`);
        }
        catch (emailError) {
            console.error('Error sending tenant invitation email:', emailError);
            throw new Error('Failed to send invitation email');
        }
        // Update tenant status to pending
        await this.prisma.user.update({
            where: { id: tenantId },
            data: {
                status: 'pending',
                updated_at: new Date(),
            },
        });
    }
    async resetPassword(tenantId, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to reset tenant passwords');
        }
        // Check if tenant exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: 'tenant',
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant');
        }
        if (!tenant.email) {
            throw new Error('tenant email not found');
        }
        // Generate reset token
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Store reset token
        await this.prisma.passwordResetToken.create({
            data: {
                user_id: tenant.id,
                token_hash: tokenHash,
                expires_at: expiresAt,
                is_used: false,
            },
        });
        // Send password reset email
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${raw}`;
        try {
            const { emailService } = await import('./email.service.js');
            const emailResult = await emailService.sendPasswordResetEmail(tenant.email, resetUrl, `${tenant.first_name} ${tenant.last_name}`);
            if (!emailResult.success) {
                console.error('Failed to send tenant password reset email:', emailResult.error);
                throw new Error('Failed to send password reset email');
            }
            else {
                console.log(`✅ Tenant password reset email sent successfully to ${tenant.email}`);
            }
        }
        catch (error) {
            console.error('Error sending tenant password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }
    async migrateTenant(tenantId, req, user) {
        // Check permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to migrate tenants');
        }
        // Check if tenant exists
        const tenant = await this.prisma.user.findUnique({
            where: {
                id: tenantId,
                role: 'tenant',
            },
            select: {
                id: true,
                role: true,
                first_name: true,
                last_name: true,
                email: true,
                company_id: true,
                assigned_units: {
                    select: {
                        id: true,
                        property_id: true,
                        unit_number: true,
                        status: true,
                    },
                },
            },
        });
        if (!tenant) {
            throw new Error('tenant not found');
        }
        // Check tenant access
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('insufficient permissions to manage this tenant');
        }
        // Check if new unit exists and is available
        const newUnit = await this.prisma.unit.findUnique({
            where: { id: req.new_unit_id },
            include: {
                property: {
                    select: {
                        id: true,
                        owner_id: true,
                        agency_id: true,
                        company_id: true,
                    },
                },
            },
        });
        if (!newUnit) {
            throw new Error('new unit not found');
        }
        // Check property access
        if (!this.hasPropertyAccess(newUnit.property, user)) {
            throw new Error('insufficient permissions to access this property');
        }
        // Check if new unit is available
        if (newUnit.status !== 'vacant') {
            throw new Error('new unit is not available for assignment');
        }
        // Release current unit if any
        if (tenant.assigned_units.length > 0) {
            const currentUnit = tenant.assigned_units[0];
            // Update current unit status to vacant
            await this.prisma.unit.update({
                where: { id: currentUnit.id },
                data: {
                    status: 'vacant',
                    current_tenant_id: null,
                    lease_end_date: req.move_out_date ? new Date(req.move_out_date) : new Date(),
                },
            });
            // Terminate existing lease if requested
            if (req.terminate_old) {
                await this.prisma.lease.updateMany({
                    where: {
                        tenant_id: tenantId,
                        unit_id: currentUnit.id,
                        status: 'active',
                    },
                    data: {
                        status: 'terminated',
                        end_date: req.move_out_date ? new Date(req.move_out_date) : new Date(),
                        updated_at: new Date(),
                    },
                });
            }
        }
        // Assign new unit
        await this.prisma.unit.update({
            where: { id: req.new_unit_id },
            data: {
                status: 'occupied',
                current_tenant_id: tenantId,
                lease_start_date: req.move_in_date ? new Date(req.move_in_date) : new Date(),
            },
        });
        // Create new lease for the new unit
        const newLease = await this.leasesService.createLease({
            tenant_id: tenantId,
            unit_id: req.new_unit_id,
            property_id: newUnit.property_id,
            start_date: req.move_in_date || new Date().toISOString(),
            end_date: req.move_out_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
            rent_amount: Number(newUnit.rent_amount),
            deposit_amount: Number(newUnit.deposit_amount),
            lease_type: 'fixed_term',
            special_terms: req.notes || `Migrated from previous unit on ${new Date().toISOString()}`,
        }, user);
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
    hasTenantAccess(tenant, user) {
        // Super admin has access to all tenants
        if (user.role === 'super_admin')
            return true;
        // Company scoping - user can only access tenants from their company
        if (user.company_id && tenant.company_id === user.company_id)
            return true;
        // Tenant can access their own profile
        if (user.role === 'tenant' && tenant.id === user.user_id)
            return true;
        return false;
    }
}
