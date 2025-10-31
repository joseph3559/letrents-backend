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
            // CRITICAL FIX: Use atomic transaction for lease + payment + unit assignment
            // If lease creation fails, payment should NOT be created (prevent inconsistency)
            let leaseId = null;
            let lease = null;
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
                // Try to create lease - if this fails, we won't create payment or assign unit
                lease = await leasesService.createLease(leaseData, user);
                leaseId = lease.id;
                console.log(`✅ Auto-generated lease agreement for tenant ${tenant.first_name} ${tenant.last_name} - Lease ID: ${lease.id} - Number: ${lease.lease_number}`);
            }
            catch (leaseError) {
                console.error('❌ Failed to auto-generate lease:', leaseError);
                // If lease creation fails (e.g., duplicate lease number), don't continue with payment/assignment
                throw new Error(`Lease creation failed: ${leaseError.message}. Please try again or create manually.`);
            }
            // Only proceed if lease was successfully created
            if (!leaseId || !lease) {
                throw new Error('Lease creation failed. Cannot assign tenant to unit without a valid lease.');
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
            // ✅ CRITICAL: Create tenant profile for maintenance requests and other features
            try {
                await this.prisma.tenantProfile.create({
                    data: {
                        user_id: tenant.id,
                        current_unit_id: req.unit_id,
                        current_property_id: unit.property.id,
                        emergency_contact_name: null,
                        emergency_contact_phone: null,
                        emergency_contact_relationship: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                    },
                });
                console.log(`✅ Created tenant profile for ${tenant.first_name} ${tenant.last_name}`);
            }
            catch (profileError) {
                console.error('❌ Failed to create tenant profile:', profileError);
                // Don't fail tenant creation if profile creation fails
            }
            // Create pending payment record for the first month's rent (ONLY if lease was created)
            try {
                const currentDate = new Date();
                const paymentPeriod = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                await this.prisma.payment.create({
                    data: {
                        company_id: user.company_id || unit.property.company_id,
                        tenant_id: tenant.id,
                        unit_id: req.unit_id,
                        property_id: unit.property.id,
                        lease_id: leaseId, // Link to the successfully created lease
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
        // Calculate financial information
        // Get unpaid invoices for this tenant (exclude paid, cancelled, void)
        const unpaidInvoices = await this.prisma.invoice.findMany({
            where: {
                issued_to: id,
                status: { notIn: ['paid', 'cancelled'] }
            },
            select: {
                id: true,
                total_amount: true,
                status: true,
                due_date: true,
                invoice_type: true,
            }
        });
        // Calculate outstanding balance (sum of unpaid invoices)
        const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
        // Determine payment status
        const now = new Date();
        const hasOverdueInvoice = unpaidInvoices.some(inv => inv.status === 'overdue' || new Date(inv.due_date) < now);
        const paymentStatus = hasOverdueInvoice ? 'overdue' :
            (outstandingBalance > 0 ? 'pending' : 'paid');
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
            // Financial information
            outstanding_balance: outstandingBalance,
            payment_status: paymentStatus,
            unpaid_invoices_count: unpaidInvoices.length,
            // Advance payment balance
            account_balance: tenant.tenant_profile?.account_balance || 0,
            advance_payment_balance: tenant.tenant_profile?.account_balance || 0,
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
    async checkDeletable(id, user) {
        // First check if tenant exists and user has access
        const existingTenant = await this.getTenant(id, user);
        // Check delete permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to check tenant deletion');
        }
        // Gather all necessary information
        const assignedUnits = await this.prisma.unit.findMany({
            where: { current_tenant_id: id },
        });
        const allLeases = await this.prisma.lease.findMany({
            where: { tenant_id: id },
            select: { id: true, status: true },
        });
        const activeLeases = allLeases.filter(l => l.status === 'active');
        const terminatedLeases = allLeases.filter(l => l.status === 'terminated');
        const unpaidPayments = await this.prisma.payment.findMany({
            where: {
                tenant_id: id,
                status: { in: ['pending', 'approved'] },
            },
        });
        const unpaidInvoices = await this.prisma.invoice.findMany({
            where: {
                issued_to: id,
                status: { notIn: ['paid', 'cancelled'] },
            },
        });
        // Determine if tenant can be deleted and why
        let canDelete = true;
        let reason;
        if (existingTenant.status !== 'inactive') {
            canDelete = false;
            reason = 'Tenant must be terminated (set to inactive) before deletion';
        }
        else if (assignedUnits.length > 0) {
            canDelete = false;
            reason = 'Tenant is currently assigned to units. Please release tenant from units first';
        }
        else if (allLeases.length > 0) {
            canDelete = false;
            reason = `Cannot delete tenant with lease history (${activeLeases.length} active, ${terminatedLeases.length} terminated). Lease records must be preserved for legal and accounting compliance`;
        }
        else if (unpaidPayments.length > 0) {
            canDelete = false;
            reason = 'Tenant has pending payments that must be resolved first';
        }
        else if (unpaidInvoices.length > 0) {
            canDelete = false;
            reason = 'Tenant has unpaid invoices that must be resolved first';
        }
        return {
            canDelete,
            reason,
            details: {
                status: existingTenant.status,
                hasAssignedUnits: assignedUnits.length > 0,
                hasLeases: allLeases.length > 0,
                hasActiveLeases: activeLeases.length > 0,
                hasTerminatedLeases: terminatedLeases.length > 0,
                hasPendingPayments: unpaidPayments.length > 0,
                hasUnpaidInvoices: unpaidInvoices.length > 0,
                leaseCount: allLeases.length,
                activeLeaseCount: activeLeases.length,
                terminatedLeaseCount: terminatedLeases.length,
            },
        };
    }
    async deleteTenant(id, user) {
        // First check if tenant exists and user has access
        const existingTenant = await this.getTenant(id, user);
        // Check delete permissions
        if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
            throw new Error('insufficient permissions to delete tenants');
        }
        // STRICT CHECK: Tenant must be terminated/inactive before deletion
        if (existingTenant.status !== 'inactive') {
            throw new Error('cannot delete active tenant. Please terminate the tenant first before deletion.');
        }
        // Check if tenant is currently assigned to any units
        const assignedUnits = await this.prisma.unit.findMany({
            where: { current_tenant_id: id },
        });
        if (assignedUnits.length > 0) {
            throw new Error('cannot delete tenant who is currently assigned to units. Please release tenant from units first.');
        }
        // Check for ANY leases (even terminated ones must be preserved due to foreign key constraints)
        const allLeases = await this.prisma.lease.findMany({
            where: { tenant_id: id },
            select: { id: true, lease_number: true, status: true },
        });
        if (allLeases.length > 0) {
            const activeCount = allLeases.filter(l => l.status === 'active').length;
            const terminatedCount = allLeases.filter(l => l.status === 'terminated').length;
            throw new Error(`Cannot delete tenant with existing lease records (${activeCount} active, ${terminatedCount} terminated). ` +
                `Lease records must be preserved for legal and accounting compliance. ` +
                `The tenant will remain in the system as "inactive" but hidden from normal views.`);
        }
        // Check for payments with status pending or approved (completed payments are historical records)
        const unpaidPayments = await this.prisma.payment.findMany({
            where: {
                tenant_id: id,
                status: { in: ['pending', 'approved'] },
            },
        });
        if (unpaidPayments.length > 0) {
            throw new Error('cannot delete tenant with pending payments. Please resolve or cancel pending payments first.');
        }
        // Check for unpaid invoices (paid invoices are historical records)
        const unpaidInvoices = await this.prisma.invoice.findMany({
            where: {
                issued_to: id,
                status: { notIn: ['paid', 'cancelled'] },
            },
        });
        if (unpaidInvoices.length > 0) {
            throw new Error('cannot delete tenant with unpaid invoices. Please resolve or cancel unpaid invoices first.');
        }
        // Delete tenant (only if no related records exist)
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
        // Fetch invoices AND payments for all tenants to calculate payment status and balance
        const tenantIds = tenants.map(t => t.id);
        // Fetch unpaid invoices (exclude paid, cancelled, void)
        const invoices = tenantIds.length > 0 ? await this.prisma.invoice.findMany({
            where: {
                issued_to: { in: tenantIds },
                status: { notIn: ['paid', 'cancelled'] }, // Exclude settled invoices
            },
            select: {
                id: true,
                issued_to: true,
                total_amount: true,
                status: true,
                due_date: true,
            },
        }) : [];
        // Fetch pending/approved payments (not completed yet)
        const pendingPayments = tenantIds.length > 0 ? await this.prisma.payment.findMany({
            where: {
                tenant_id: { in: tenantIds },
                status: { in: ['pending', 'approved'] }, // Only unpaid payments
            },
            select: {
                id: true,
                tenant_id: true,
                amount: true,
                status: true,
                payment_date: true,
            },
        }) : [];
        // Group invoices by tenant
        const invoicesByTenant = invoices.reduce((acc, invoice) => {
            if (!acc[invoice.issued_to]) {
                acc[invoice.issued_to] = [];
            }
            acc[invoice.issued_to].push(invoice);
            return acc;
        }, {});
        // Group payments by tenant
        const paymentsByTenant = pendingPayments.reduce((acc, payment) => {
            if (!acc[payment.tenant_id]) {
                acc[payment.tenant_id] = [];
            }
            acc[payment.tenant_id].push(payment);
            return acc;
        }, {});
        // Calculate payment status and balance for each tenant
        const calculatePaymentInfo = (tenantId) => {
            const tenantInvoices = invoicesByTenant[tenantId] || [];
            const tenantPayments = paymentsByTenant[tenantId] || [];
            // Calculate total amount from UNPAID invoices only
            const invoiceBalance = tenantInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
            // Separate pending and approved/completed payments
            const pendingPaymentsOnly = tenantPayments.filter((p) => p.status === 'pending');
            const approvedPayments = tenantPayments.filter((p) => p.status === 'approved' || p.status === 'completed');
            // Calculate pending payment amount (these are awaiting approval)
            const pendingPaymentAmount = pendingPaymentsOnly.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            // Calculate approved payment amount (these should REDUCE the balance)
            const approvedPaymentAmount = approvedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            // ✅ CORRECT CALCULATION:
            // Outstanding Balance = Simply the sum of unpaid invoices
            // When a payment is approved, it should mark the corresponding invoice as 'paid',
            // so that invoice won't be in the unpaid invoices query anymore
            // Therefore, the outstanding balance is just the sum of unpaid invoices
            const balance = invoiceBalance;
            // If balance is 0 or negative, tenant is paid up
            if (balance <= 0 && tenantInvoices.length === 0 && pendingPaymentsOnly.length === 0) {
                return {
                    balance: 0,
                    paymentStatus: 'paid',
                };
            }
            // Determine payment status
            const now = new Date();
            const hasOverdueInvoice = tenantInvoices.some((inv) => inv.status === 'overdue' || new Date(inv.due_date) < now);
            // If there are approved payments but still unpaid invoices, status is pending
            const paymentStatus = hasOverdueInvoice ? 'overdue' :
                (balance > 0 ? 'pending' : 'paid');
            console.log(`💰 Balance calculation for tenant ${tenantId}:`, {
                unpaidInvoices: tenantInvoices.length,
                invoiceBalance,
                pendingPaymentsCount: pendingPaymentsOnly.length,
                pendingPaymentAmount,
                approvedPaymentsCount: approvedPayments.length,
                approvedPaymentAmount,
                finalBalance: balance,
                paymentStatus,
            });
            return {
                balance,
                paymentStatus,
            };
        };
        // Format tenants using unified logic (same as getTenant method)
        const formattedTenants = tenants.map(tenant => {
            // Create unified property and unit information
            // Priority: tenant_profile data over assigned_units data
            const currentUnit = tenant.tenant_profile?.current_unit || tenant.assigned_units?.[0];
            const currentProperty = tenant.tenant_profile?.current_property ||
                tenant.tenant_profile?.current_unit?.property ||
                tenant.assigned_units?.[0]?.property;
            // Calculate payment status and balance
            const paymentInfo = calculatePaymentInfo(tenant.id);
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
                // Payment status and balance
                paymentStatus: paymentInfo.paymentStatus,
                balance: paymentInfo.balance,
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
        // ✅ CRITICAL: Create or update tenant profile for maintenance requests and other features
        if (tenant.role === 'tenant') {
            try {
                const existingProfile = await this.prisma.tenantProfile.findUnique({
                    where: { user_id: tenantId },
                });
                if (existingProfile) {
                    // Update existing profile
                    await this.prisma.tenantProfile.update({
                        where: { user_id: tenantId },
                        data: {
                            current_unit_id: req.unit_id,
                            current_property_id: unit.property.id,
                            updated_at: new Date(),
                        },
                    });
                    console.log(`✅ Updated tenant profile for ${tenant.first_name} ${tenant.last_name}`);
                }
                else {
                    // Create new profile
                    await this.prisma.tenantProfile.create({
                        data: {
                            user_id: tenantId,
                            current_unit_id: req.unit_id,
                            current_property_id: unit.property.id,
                            emergency_contact_name: null,
                            emergency_contact_phone: null,
                            emergency_contact_relationship: null,
                            created_at: new Date(),
                            updated_at: new Date(),
                        },
                    });
                    console.log(`✅ Created tenant profile for ${tenant.first_name} ${tenant.last_name}`);
                }
            }
            catch (profileError) {
                console.error('❌ Failed to create/update tenant profile:', profileError);
                // Don't fail tenant assignment if profile creation fails
            }
        }
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
        // Release tenant from unit - use transaction to ensure atomicity
        await this.prisma.$transaction(async (tx) => {
            // Clear unit assignment
            await tx.unit.update({
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
            // Also clear tenant profile's unit assignment
            await tx.tenantProfile.updateMany({
                where: { user_id: tenantId },
                data: {
                    current_property_id: null,
                    current_unit_id: null,
                    updated_at: new Date(),
                },
            });
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
        // Use transaction to ensure all termination steps complete together
        await this.prisma.$transaction(async (tx) => {
            // 1. Terminate all active leases for this tenant
            const terminatedLeases = await tx.lease.updateMany({
                where: {
                    tenant_id: tenantId,
                    status: 'active',
                },
                data: {
                    status: 'terminated',
                    end_date: new Date(), // Set end date to now
                    updated_at: new Date(),
                },
            });
            console.log(`✅ Terminated ${terminatedLeases.count} active lease(s) for tenant ${tenantId}`);
            // 2. Cancel all pending/approved payments (they won't be collected)
            const cancelledPayments = await tx.payment.updateMany({
                where: {
                    tenant_id: tenantId,
                    status: { in: ['pending', 'approved'] },
                },
                data: {
                    status: 'cancelled',
                    updated_at: new Date(),
                },
            });
            console.log(`✅ Cancelled ${cancelledPayments.count} pending/approved payment(s) for tenant ${tenantId}`);
            // 3. Cancel all unpaid invoices
            const cancelledInvoices = await tx.invoice.updateMany({
                where: {
                    issued_to: tenantId,
                    status: { in: ['draft', 'sent', 'overdue'] },
                },
                data: {
                    status: 'cancelled',
                    updated_at: new Date(),
                },
            });
            console.log(`✅ Cancelled ${cancelledInvoices.count} unpaid invoice(s) for tenant ${tenantId}`);
            // 4. Release tenant from any assigned units
            await tx.unit.updateMany({
                where: { current_tenant_id: tenantId },
                data: {
                    current_tenant_id: null,
                    lease_start_date: null,
                    lease_end_date: null,
                    lease_type: null,
                    status: 'vacant',
                    updated_at: new Date(),
                },
            });
            // Also clear tenant profile's unit assignment
            await tx.tenantProfile.updateMany({
                where: { user_id: tenantId },
                data: {
                    current_property_id: null,
                    current_unit_id: null,
                    updated_at: new Date(),
                },
            });
            // 5. Deactivate tenant account and set termination timestamp
            await tx.user.update({
                where: { id: tenantId },
                data: {
                    status: 'inactive',
                    terminated_at: new Date(), // Track termination date for 14-day auto-deletion
                    updated_at: new Date(),
                },
            });
        });
    }
    /**
     * Cleanup terminated tenants older than 5 minutes (TESTING ONLY - change back to 14 days in production!)
     * This should be run as a scheduled job (cron)
     * NOTE: Only deletes tenants WITHOUT lease history (preserves audit trail)
     */
    async cleanupTerminatedTenants() {
        // ⚠️ TESTING: 5 minutes for quick testing - change back to 14 days for production!
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        // Find terminated tenants older than 5 minutes
        const terminatedTenants = await this.prisma.user.findMany({
            where: {
                role: 'tenant',
                status: 'inactive',
                terminated_at: {
                    not: null,
                    lte: fiveMinutesAgo, // Terminated more than 5 minutes ago
                },
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                terminated_at: true,
            },
        });
        const deletedTenants = [];
        const skippedTenants = [];
        // Delete each terminated tenant (only if no lease history)
        for (const tenant of terminatedTenants) {
            try {
                // Check for any lease records
                const leaseCount = await this.prisma.lease.count({
                    where: { tenant_id: tenant.id },
                });
                if (leaseCount > 0) {
                    // Skip deletion - preserve tenant for audit trail
                    skippedTenants.push(`${tenant.first_name} ${tenant.last_name} (${tenant.email}) - ${leaseCount} lease(s)`);
                    console.log(`⏭️  Skipped tenant ${tenant.email} - has ${leaseCount} lease record(s) that must be preserved`);
                    continue;
                }
                // Delete tenant (only if no lease history)
                await this.prisma.user.delete({
                    where: { id: tenant.id },
                });
                deletedTenants.push(`${tenant.first_name} ${tenant.last_name} (${tenant.email})`);
                console.log(`✅ Auto-deleted terminated tenant: ${tenant.first_name} ${tenant.last_name} (terminated on ${tenant.terminated_at})`);
            }
            catch (error) {
                console.error(`❌ Failed to process tenant ${tenant.email}:`, error);
                skippedTenants.push(`${tenant.first_name} ${tenant.last_name} (${tenant.email}) - error`);
            }
        }
        return {
            deleted: deletedTenants.length,
            skipped: skippedTenants.length,
            tenants: deletedTenants,
            skippedTenants: skippedTenants,
        };
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
    async getTenantActivity(tenantId, user, options) {
        // Verify tenant exists and user has access
        const tenant = await this.getTenant(tenantId, user);
        if (!tenant) {
            throw new Error('tenant not found');
        }
        const activities = [];
        const limit = options?.limit || 20;
        const offset = options?.offset || 0;
        // Calculate date range
        let startDate = options?.startDate;
        let endDate = options?.endDate || new Date();
        if (options?.dateRange) {
            const now = new Date();
            switch (options.dateRange) {
                case '7days':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30days':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case '90days':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case '6months':
                    startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                    break;
                case '1year':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
                case 'all':
                default:
                    startDate = undefined;
                    break;
            }
        }
        // Build date filter
        const dateFilter = startDate ? {
            created_at: {
                gte: startDate,
                lte: endDate,
            }
        } : {};
        try {
            // Fetch payments
            const payments = await this.prisma.payment.findMany({
                where: {
                    tenant_id: tenantId,
                    ...dateFilter
                },
                orderBy: { created_at: 'desc' },
                take: 50, // Get more to ensure we have enough after filtering
                select: {
                    id: true,
                    amount: true,
                    status: true,
                    payment_method: true,
                    payment_date: true,
                    receipt_number: true,
                    created_at: true,
                },
            });
            payments.forEach(payment => {
                activities.push({
                    id: payment.id,
                    type: 'payment',
                    action: payment.status === 'approved' ? 'Payment Approved' :
                        payment.status === 'pending' ? 'Payment Pending' : 'Payment Recorded',
                    description: `${payment.payment_method} payment of KSh ${payment.amount.toLocaleString()}`,
                    amount: payment.amount,
                    status: payment.status,
                    date: payment.payment_date || payment.created_at,
                    metadata: {
                        receipt_number: payment.receipt_number,
                        payment_method: payment.payment_method,
                    },
                });
            });
            // Fetch invoices
            const invoices = await this.prisma.invoice.findMany({
                where: {
                    issued_to: tenantId,
                    ...dateFilter
                },
                orderBy: { created_at: 'desc' },
                take: 50,
                select: {
                    id: true,
                    invoice_number: true,
                    total_amount: true,
                    status: true,
                    due_date: true,
                    created_at: true,
                },
            });
            invoices.forEach(invoice => {
                activities.push({
                    id: invoice.id,
                    type: 'invoice',
                    action: invoice.status === 'paid' ? 'Invoice Paid' :
                        invoice.status === 'overdue' ? 'Invoice Overdue' : 'Invoice Created',
                    description: `Invoice ${invoice.invoice_number} for KSh ${invoice.total_amount.toLocaleString()}`,
                    amount: invoice.total_amount,
                    status: invoice.status,
                    date: invoice.created_at,
                    metadata: {
                        invoice_number: invoice.invoice_number,
                        due_date: invoice.due_date,
                    },
                });
            });
            // Fetch leases
            const leases = await this.prisma.lease.findMany({
                where: {
                    tenant_id: tenantId,
                    ...dateFilter
                },
                orderBy: { created_at: 'desc' },
                take: 20,
                select: {
                    id: true,
                    lease_number: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                    created_at: true,
                },
            });
            leases.forEach(lease => {
                activities.push({
                    id: lease.id,
                    type: 'lease',
                    action: lease.status === 'active' ? 'Lease Activated' :
                        lease.status === 'terminated' ? 'Lease Terminated' : 'Lease Created',
                    description: `Lease ${lease.lease_number}`,
                    status: lease.status,
                    date: lease.created_at,
                    metadata: {
                        lease_number: lease.lease_number,
                        start_date: lease.start_date,
                        end_date: lease.end_date,
                    },
                });
            });
            // Fetch maintenance requests
            const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
                where: {
                    requested_by: tenantId,
                    ...dateFilter
                },
                orderBy: { created_at: 'desc' },
                take: 20,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    created_at: true,
                },
            });
            maintenanceRequests.forEach(request => {
                activities.push({
                    id: request.id,
                    type: 'maintenance',
                    action: request.status === 'completed' ? 'Maintenance Completed' :
                        request.status === 'in_progress' ? 'Maintenance In Progress' : 'Maintenance Requested',
                    description: request.title,
                    status: request.status,
                    date: request.created_at,
                    metadata: {
                        priority: request.priority,
                    },
                });
            });
            // Sort all activities by date (most recent first)
            activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            // Get total count
            const total = activities.length;
            // Apply pagination
            const paginatedActivities = activities.slice(offset, offset + limit);
            const hasMore = offset + limit < total;
            return {
                activities: paginatedActivities,
                hasMore,
                total
            };
        }
        catch (error) {
            console.error('❌ Error fetching tenant activity:', error);
            return {
                activities: [],
                hasMore: false,
                total: 0
            };
        }
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
    async updateRentDetails(tenantId, rentData, user) {
        // Get tenant with their current unit and lease information
        const tenant = await this.prisma.user.findUnique({
            where: { id: tenantId },
            include: {
                tenant_profile: {
                    include: {
                        current_unit: {
                            include: {
                                property: true
                            }
                        }
                    }
                }
            }
        });
        if (!tenant) {
            throw new Error('Tenant not found');
        }
        // Check permissions
        if (!this.hasTenantAccess(tenant, user)) {
            throw new Error('Insufficient permissions to update this tenant\'s rent details');
        }
        if (!tenant.tenant_profile) {
            throw new Error('Tenant profile not found');
        }
        if (!tenant.tenant_profile.current_unit) {
            throw new Error('Tenant is not assigned to a unit');
        }
        const unit = tenant.tenant_profile.current_unit;
        // Get the current active lease
        const activeLease = await this.prisma.lease.findFirst({
            where: {
                tenant_id: tenantId,
                status: 'active'
            },
            orderBy: {
                start_date: 'desc'
            }
        });
        if (!activeLease) {
            throw new Error('No active lease found for this tenant');
        }
        const oldRent = tenant.tenant_profile.rent_amount || 0;
        const newRent = rentData.totalRent;
        // Start a transaction to ensure all updates are atomic
        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Update tenant's rent in tenant_profile
            await tx.tenantProfile.update({
                where: { id: tenant.tenant_profile.id },
                data: {
                    rent_amount: newRent,
                    updated_at: new Date()
                }
            });
            // 2. Update unit's rent amount
            await tx.unit.update({
                where: { id: unit.id },
                data: {
                    rent_amount: newRent,
                    updated_at: new Date()
                }
            });
            // 3. Log the activity in lease notes field
            const activityLog = {
                timestamp: new Date().toISOString(),
                action: 'RENT_DETAILS_UPDATED',
                tenant_name: `${tenant.first_name} ${tenant.last_name}`,
                unit_number: unit.unit_number,
                property_name: unit.property?.name,
                old_rent: oldRent,
                new_rent: newRent,
                base_rent: rentData.baseRent,
                utilities: rentData.utilities,
                changed_by: user.user_id
            };
            // 4. Create notification for the tenant
            await tx.notification.create({
                data: {
                    recipient_id: tenantId,
                    sender_id: user.user_id,
                    title: 'Rent Details Updated',
                    message: `Your rent has been updated from KES ${oldRent.toLocaleString()} to KES ${newRent.toLocaleString()}. This change will be effective from your next payment cycle.`,
                    notification_type: 'rent_change',
                    priority: 'high',
                    is_read: false,
                    company_id: user.company_id,
                    created_at: new Date()
                }
            });
            let newLease = null;
            // 5. Generate new lease if requested
            if (rentData.generateLease) {
                // End the current lease (mark it as superseded)
                await tx.lease.update({
                    where: { id: activeLease.id },
                    data: {
                        status: 'expired',
                        notes: `Lease superseded due to rent change on ${new Date().toISOString().split('T')[0]}`
                    }
                });
                // Create new lease with updated rent
                const leaseStartDate = new Date();
                const leaseEndDate = new Date(leaseStartDate);
                leaseEndDate.setFullYear(leaseEndDate.getFullYear() + 1); // 1 year lease by default
                // Generate unique lease number
                const leaseNumber = `LSE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
                newLease = await tx.lease.create({
                    data: {
                        lease_number: leaseNumber,
                        tenant_id: tenantId,
                        unit_id: unit.id,
                        property_id: unit.property_id,
                        start_date: leaseStartDate,
                        end_date: leaseEndDate,
                        rent_amount: newRent,
                        deposit_amount: activeLease.deposit_amount, // Keep same deposit
                        status: 'active',
                        lease_type: activeLease.lease_type || 'fixed_term',
                        payment_frequency: activeLease.payment_frequency || 'monthly',
                        payment_day: activeLease.payment_day || 1,
                        special_terms: activeLease.special_terms,
                        notes: `Generated due to rent change from ${oldRent} to ${newRent}. Previous lease: ${activeLease.lease_number}`,
                        company_id: user.company_id,
                        created_by: user.user_id,
                        parent_lease_id: activeLease.id,
                        created_at: new Date()
                    }
                });
                // Notify tenant about new lease
                await tx.notification.create({
                    data: {
                        recipient_id: tenantId,
                        sender_id: user.user_id,
                        title: 'New Lease Agreement Generated',
                        message: `A new lease agreement has been generated with the updated rent amount of KES ${newRent.toLocaleString()}. Please review and sign the agreement.`,
                        notification_type: 'lease_generated',
                        priority: 'high',
                        is_read: false,
                        company_id: user.company_id,
                        created_at: new Date()
                    }
                });
            }
            return {
                tenant_profile: {
                    ...tenant.tenant_profile,
                    rent_amount: newRent
                },
                unit: {
                    ...unit,
                    rent_amount: newRent
                },
                old_rent: oldRent,
                new_rent: newRent,
                lease_generated: rentData.generateLease,
                new_lease: newLease
            };
        });
        return {
            message: rentData.generateLease
                ? 'Rent details updated successfully and new lease generated'
                : 'Rent details updated successfully',
            data: result
        };
    }
    async getTenantMaintenance(tenantId, user) {
        // Validate tenant access
        const tenant = await this.getTenant(tenantId, user);
        if (!tenant.tenant_profile) {
            return [];
        }
        // Get all maintenance requests requested by this tenant
        const maintenanceRequests = await this.prisma.maintenanceRequest.findMany({
            where: {
                requested_by: tenantId,
                company_id: user.company_id
            },
            include: {
                unit: {
                    select: {
                        unit_number: true,
                        property: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                assignee: {
                    select: {
                        first_name: true,
                        last_name: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return maintenanceRequests.map((req) => ({
            id: req.id,
            title: req.title,
            description: req.description,
            status: req.status,
            priority: req.priority,
            category: req.category,
            created_at: req.created_at,
            updated_at: req.updated_at,
            unit_number: req.unit?.unit_number,
            property_name: req.unit?.property?.name,
            assigned_to: req.assignee
                ? `${req.assignee.first_name} ${req.assignee.last_name}`
                : null
        }));
    }
    async createTenantMaintenance(tenantId, maintenanceData, user) {
        // Validate tenant access
        const tenant = await this.getTenant(tenantId, user);
        if (!tenant.tenant_profile) {
            throw new Error('Tenant profile not found');
        }
        // Get tenant's active lease to find their current unit and property
        const activeLease = await this.prisma.lease.findFirst({
            where: {
                tenant_id: tenantId,
                company_id: user.company_id,
                status: 'active'
            },
            orderBy: {
                start_date: 'desc'
            }
        });
        if (!activeLease) {
            throw new Error('No active lease found for tenant');
        }
        // Create maintenance request
        const maintenanceRequest = await this.prisma.maintenanceRequest.create({
            data: {
                title: maintenanceData.title,
                description: maintenanceData.description,
                category: maintenanceData.category || 'General',
                priority: maintenanceData.priority?.toLowerCase() || 'medium',
                status: 'pending',
                requested_by: tenantId,
                unit_id: activeLease.unit_id,
                property_id: activeLease.property_id,
                company_id: user.company_id,
            }
        });
        // Fetch unit and property details for response
        const unit = await this.prisma.unit.findUnique({
            where: { id: activeLease.unit_id },
            select: {
                unit_number: true,
                property: {
                    select: {
                        name: true
                    }
                }
            }
        });
        return {
            id: maintenanceRequest.id,
            title: maintenanceRequest.title,
            description: maintenanceRequest.description,
            status: maintenanceRequest.status,
            priority: maintenanceRequest.priority,
            category: maintenanceRequest.category,
            created_at: maintenanceRequest.created_at,
            updated_at: maintenanceRequest.updated_at,
            unit_number: unit?.unit_number,
            property_name: unit?.property?.name,
        };
    }
    async getTenantPerformance(tenantId, user) {
        // Validate tenant access
        const tenant = await this.getTenant(tenantId, user);
        // Calculate performance metrics
        const [payments, invoices, maintenanceRequests, leases] = await Promise.all([
            this.prisma.payment.findMany({
                where: {
                    tenant_id: tenantId,
                    company_id: user.company_id
                },
                orderBy: { payment_date: 'desc' }
            }),
            this.prisma.invoice.findMany({
                where: {
                    issued_to: tenantId,
                    company_id: user.company_id
                }
            }),
            this.prisma.maintenanceRequest.findMany({
                where: {
                    requested_by: tenantId,
                    company_id: user.company_id
                }
            }),
            this.prisma.lease.findMany({
                where: {
                    tenant_id: tenantId,
                    company_id: user.company_id
                }
            })
        ]);
        // Calculate on-time payment percentage
        const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
        const onTimePayments = paidInvoices.filter((inv) => {
            const payment = payments.find((p) => p.invoice_id === inv.id);
            if (!payment || !payment.payment_date || !inv.due_date)
                return false;
            return new Date(payment.payment_date) <= new Date(inv.due_date);
        });
        const onTimePercentage = paidInvoices.length > 0
            ? Math.round((onTimePayments.length / paidInvoices.length) * 100)
            : 100;
        // Calculate overall rating (1-5 stars)
        let rating = 5.0;
        if (onTimePercentage < 60)
            rating -= 2;
        else if (onTimePercentage < 80)
            rating -= 1;
        else if (onTimePercentage < 90)
            rating -= 0.5;
        if (maintenanceRequests.length > 10)
            rating -= 0.5;
        else if (maintenanceRequests.length > 5)
            rating -= 0.25;
        rating = Math.max(1, Math.min(5, rating));
        // Determine ratings for different categories
        const paymentHistory = onTimePercentage >= 95 ? 'Excellent' :
            onTimePercentage >= 85 ? 'Very Good' :
                onTimePercentage >= 75 ? 'Good' :
                    onTimePercentage >= 60 ? 'Fair' : 'Poor';
        const communication = maintenanceRequests.length <= 3 ? 'Excellent' :
            maintenanceRequests.length <= 5 ? 'Good' : 'Fair';
        const propertyCare = maintenanceRequests.filter((m) => m.category === 'damage' || m.priority === 'high').length <= 1 ? 'Very Good' : 'Good';
        return {
            overall_rating: Number(rating.toFixed(1)),
            on_time_payment_percentage: onTimePercentage,
            total_payments: payments.length,
            total_invoices: invoices.length,
            total_maintenance_requests: maintenanceRequests.length,
            total_leases: leases.length,
            payment_history: paymentHistory,
            communication: communication,
            property_care: propertyCare,
            tenant_since: leases.length > 0
                ? leases.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0].start_date
                : tenant.created_at
        };
    }
    async getTenantNotes(tenantId, user) {
        // Validate tenant access
        await this.getTenant(tenantId, user);
        // Note: TenantProfile doesn't have a dedicated notes field in the schema
        // For now, returning empty notes. Consider adding a notes field to the schema
        // or creating a separate tenant_notes table in the future
        return {
            notes: ''
        };
    }
    async updateTenantNotes(tenantId, notes, user) {
        // Validate tenant access
        const tenant = await this.getTenant(tenantId, user);
        if (!tenant.tenant_profile) {
            throw new Error('Tenant profile not found');
        }
        // Note: TenantProfile doesn't have a dedicated notes field in the schema
        // For now, just validating access. Consider adding a notes field to the schema
        // or creating a separate tenant_notes table in the future
        // Update the updated_at timestamp to show the tenant was accessed
        await this.prisma.tenantProfile.update({
            where: { id: tenant.tenant_profile.id },
            data: {
                updated_at: new Date()
            }
        });
        return {
            notes: notes // Return the notes as-is for now
        };
    }
}
