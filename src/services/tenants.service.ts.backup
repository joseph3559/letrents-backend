import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { LeasesService, CreateLeaseRequest } from './leases.service.js';

export interface TenantFilters {
  property_id?: string;
  unit_id?: string;
  status?: string;
  search_query?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export interface CreateTenantRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  unit_id?: string;
  property_id?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  lease_type?: string;
  send_invitation?: boolean;
}

export interface UpdateTenantRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  status?: string;
}

export interface AssignUnitRequest {
  unit_id: string;
  lease_start_date: string;
  lease_end_date: string;
  lease_type: string;
}

export interface TenantInvitationRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  unit_id?: string;
  property_id?: string;
}

export interface TenantMigrationRequest {
  new_unit_id: string;
  move_in_date?: string;
  move_out_date?: string;
  notes?: string;
  terminate_old?: boolean;
}

export class TenantsService {
  private prisma = getPrisma();
  private leasesService = new LeasesService();

  async createTenant(req: CreateTenantRequest, user: JWTClaims): Promise<any> {
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
      role: 'tenant' as any,
      status: req.send_invitation !== false ? 'pending' as any : 'active' as any,
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
    }

    // TODO: Send invitation email if req.send_invitation is true
    // This would integrate with the email service

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

  async getTenant(id: string, user: JWTClaims): Promise<any> {
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id,
        role: 'tenant' as any,
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

    return {
      ...tenant,
      password_hash: undefined, // Don't return password hash
    };
  }

  async updateTenant(id: string, req: UpdateTenantRequest, user: JWTClaims): Promise<any> {
    // First check if tenant exists and user has access
    const existingTenant = await this.getTenant(id, user);

    // Check update permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to update tenants');
    }

    // If email is being changed, check for duplicates
    if (req.email && req.email !== existingTenant.email) {
      const duplicateUser = await this.prisma.user.findUnique({
        where: { email: req.email },
      });

      if (duplicateUser && duplicateUser.id !== id) {
        throw new Error('user with this email already exists');
      }
    }

    const tenant = await this.prisma.user.update({
      where: { id },
      data: {
        ...(req.first_name && { first_name: req.first_name }),
        ...(req.last_name && { last_name: req.last_name }),
        ...(req.phone_number !== undefined && { phone_number: req.phone_number }),
        ...(req.email && { email: req.email }),
        ...(req.status && { status: req.status as any }),
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
      },
    });

    return {
      ...tenant,
      password_hash: undefined, // Don't return password hash
    };
  }

  async deleteTenant(id: string, user: JWTClaims): Promise<void> {
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

  async listTenants(filters: TenantFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Build where clause with company scoping
    const where: any = {
      role: 'tenant' as any,
    };

    // Company scoping for non-super-admin users
    if (user.role !== 'super_admin' && user.company_id) {
      where.company_id = user.company_id;
    }

    // Apply filters
    if (filters.status) where.status = filters.status;

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
    const orderBy: any = {};
    if (filters.sort_by) {
      const sortOrder = filters.sort_order === 'desc' ? 'desc' : 'asc';
      orderBy[filters.sort_by] = sortOrder;
    } else {
      orderBy.created_at = 'desc';
    }

    // Execute queries
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
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Format tenants to match Go backend response
    const formattedTenants = tenants.map(tenant => {
      const unitInfo = tenant.assigned_units[0] || null;
      return {
        ...tenant,
        password_hash: undefined, // Don't return password hash
        unit_info: unitInfo ? {
          unit_id: unitInfo.id,
          unit_number: unitInfo.unit_number,
          property_id: unitInfo.property_id,
          property_name: unitInfo.property?.name || 'No Property',
          rent_amount: Number(unitInfo.rent_amount),
          lease_start_date: unitInfo.lease_start_date,
          lease_end_date: unitInfo.lease_end_date,
          lease_type: unitInfo.lease_type,
          status: unitInfo.status,
        } : {
          unit_id: null,
          unit_number: 'No Unit',
          property_id: null,
          property_name: 'No Property',
          rent_amount: 0,
        },
        // Frontend compatibility fields
        propertyName: unitInfo?.property?.name || 'No Property',
        unitNumber: unitInfo?.unit_number || 'No Unit',
        property_name: unitInfo?.property?.name || 'No Property',
        unit_number: unitInfo?.unit_number || 'No Unit',
        source: unitInfo ? 'unit_assignment' : 'user_account',
        assigned_units: undefined, // Remove the include field
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

  async assignUnit(tenantId: string, req: AssignUnitRequest, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to assign units to tenants');
    }

    // Check if tenant/caretaker exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: { in: ['tenant', 'caretaker'] } as any,
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
    const leaseData: CreateLeaseRequest = {
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

    try {
      await this.leasesService.createLease(leaseData, user);
      console.log(`✅ Auto-created lease for ${tenant.role} ${tenant.first_name} ${tenant.last_name} (${tenant.email}) in unit ${unit.unit_number}`);
    } catch (leaseError: any) {
      console.error(`⚠️ Failed to auto-create lease for tenant assignment:`, leaseError.message);
      // Don't fail the assignment if lease creation fails - log and continue
      // The lease can be created manually later if needed
    }
  }

  async releaseUnit(tenantId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to release tenants from units');
    }

    // Check if tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: 'tenant' as any,
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

  async terminateTenant(tenantId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to terminate tenants');
    }

    // Check if tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: 'tenant' as any,
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

  async sendInvitation(tenantId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to send tenant invitations');
    }

    // Check if tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: 'tenant' as any,
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
      const invitationLink = `${process.env.APP_URL || 'http://localhost:3000'}/tenant-register?email=${encodeURIComponent(tenant.email!)}&first_name=${encodeURIComponent(tenant.first_name || '')}&last_name=${encodeURIComponent(tenant.last_name || '')}&token=invitation-${tenant.id}`;
      
      const emailResult = await emailService.sendEmail({
        to: tenant.email!,
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
    } catch (emailError) {
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

  async resetPassword(tenantId: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to reset tenant passwords');
    }

    // Check if tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: 'tenant' as any,
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
      const emailResult = await emailService.sendPasswordResetEmail(
        tenant.email,
        resetUrl,
        `${tenant.first_name} ${tenant.last_name}`
      );
      
      if (!emailResult.success) {
        console.error('Failed to send tenant password reset email:', emailResult.error);
        throw new Error('Failed to send password reset email');
      } else {
        console.log(`✅ Tenant password reset email sent successfully to ${tenant.email}`);
      }
    } catch (error) {
      console.error('Error sending tenant password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async migrateTenant(tenantId: string, req: TenantMigrationRequest, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to migrate tenants');
    }

    // Check if tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: tenantId,
        role: 'tenant' as any,
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

  private hasPropertyAccess(property: any, user: JWTClaims): boolean {
    // Super admin has access to all properties
    if (user.role === 'super_admin') return true;

    // Company scoping - user can only access properties from their company
    if (user.company_id && property.company_id === user.company_id) return true;

    // Owner can access their own properties
    if (property.owner_id === user.user_id) return true;

    // Agency admin can access properties from their agency
    if (user.role === 'agency_admin' && user.agency_id && property.agency_id === user.agency_id) return true;

    return false;
  }

  private hasTenantAccess(tenant: any, user: JWTClaims): boolean {
    // Super admin has access to all tenants
    if (user.role === 'super_admin') return true;

    // Company scoping - user can only access tenants from their company
    if (user.company_id && tenant.company_id === user.company_id) return true;

    // Tenant can access their own profile
    if (user.role === 'tenant' && tenant.id === user.user_id) return true;

    return false;
  }
}
