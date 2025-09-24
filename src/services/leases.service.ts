import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';

export interface LeaseFilters {
  tenant_id?: string;
  unit_id?: string;
  property_id?: string;
  status?: string;
  lease_type?: string;
  start_date_from?: string;
  start_date_to?: string;
  end_date_from?: string;
  end_date_to?: string;
  search_query?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export interface CreateLeaseRequest {
  tenant_id: string;
  unit_id: string;
  property_id: string;
  lease_type: string;
  start_date: string;
  end_date: string;
  move_in_date?: string;
  rent_amount: number;
  deposit_amount: number;
  payment_frequency?: string;
  payment_day?: number;
  notice_period_days?: number;
  renewable?: boolean;
  auto_renewal?: boolean;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  subletting_allowed?: boolean;
  special_terms?: string;
  notes?: string;
}

export interface UpdateLeaseRequest {
  lease_type?: string;
  start_date?: string;
  end_date?: string;
  move_in_date?: string;
  move_out_date?: string;
  rent_amount?: number;
  deposit_amount?: number;
  payment_frequency?: string;
  payment_day?: number;
  notice_period_days?: number;
  renewable?: boolean;
  auto_renewal?: boolean;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  subletting_allowed?: boolean;
  special_terms?: string;
  notes?: string;
  status?: string;
}

export class LeasesService {
  private prisma = getPrisma();


  // FULL IMPLEMENTATION - PRISMA MIGRATION COMPLETE
  async getLease(id: string, user: JWTClaims): Promise<any> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            unit_type: true,
            size_square_feet: true,
            number_of_bedrooms: true,
            number_of_bathrooms: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true,
            region: true,
            owner_id: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        parent_lease: {
          select: {
            id: true,
            lease_number: true,
            start_date: true,
            end_date: true,
          },
        },
        renewal_leases: {
          select: {
            id: true,
            lease_number: true,
            start_date: true,
            end_date: true,
            status: true,
          },
        },
      },
    });

    if (!lease) {
      throw new Error('lease not found');
    }

    // Check access permissions
    if (!this.hasLeaseAccess(lease, user)) {
      throw new Error('insufficient permissions to view this lease');
    }

    return lease;
  }

  async createLease(req: CreateLeaseRequest, user: JWTClaims): Promise<any> {
    // Validate permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to create lease');
    }

    // Validate tenant exists and is available
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: req.tenant_id,
        role: 'tenant' as any,
      },
    });

    if (!tenant) {
      throw new Error('tenant not found');
    }

    // Validate unit exists and is available
    const unit = await this.prisma.unit.findUnique({
      where: { id: req.unit_id },
      include: { property: true }
    });

    if (!unit) {
      throw new Error('unit not found');
    }

    if (unit.status !== 'vacant') {
      throw new Error('unit is not available for lease');
    }

    // Generate lease number
    const leaseNumber = await this.generateLeaseNumber(user.company_id!);

    // Create lease
    const lease = await this.prisma.lease.create({
      data: {
        lease_number: leaseNumber,
        tenant_id: req.tenant_id,
        unit_id: req.unit_id,
        property_id: req.property_id,
        company_id: user.company_id!,
        lease_type: req.lease_type as any,
        start_date: new Date(req.start_date),
        end_date: req.end_date ? new Date(req.end_date) : new Date(new Date(req.start_date).getTime() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year from start
        move_in_date: req.move_in_date ? new Date(req.move_in_date) : null,
        rent_amount: req.rent_amount,
        deposit_amount: req.deposit_amount,
        payment_frequency: req.payment_frequency as any || 'monthly',
        payment_day: req.payment_day || 1,
        notice_period_days: req.notice_period_days || 30,
        renewable: req.renewable ?? true,
        auto_renewal: req.auto_renewal ?? false,
        pets_allowed: req.pets_allowed ?? false,
        smoking_allowed: req.smoking_allowed ?? false,
        subletting_allowed: req.subletting_allowed ?? false,
        special_terms: req.special_terms,
        status: 'active' as any,
        created_by: user.user_id,
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          }
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            unit_type: true,
          }
        },
        property: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Update unit status to occupied and assign tenant
    await this.prisma.unit.update({
      where: { id: req.unit_id },
      data: {
        status: 'occupied' as any,
        current_tenant_id: req.tenant_id,
        lease_start_date: new Date(req.start_date),
        lease_end_date: req.end_date ? new Date(req.end_date) : null,
        lease_type: req.lease_type as any,
      }
    });

    return lease;
  }

  async updateLease(id: string, req: UpdateLeaseRequest, user: JWTClaims): Promise<any> {
    // First check if lease exists and user has access
    const existingLease = await this.getLease(id, user);

    // Check update permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to update leases');
    }

    const lease = await this.prisma.lease.update({
      where: { id },
      data: {
        ...(req.lease_type && { lease_type: req.lease_type as any }),
        ...(req.start_date && { start_date: new Date(req.start_date) }),
        ...(req.end_date && { end_date: new Date(req.end_date) }),
        ...(req.move_in_date !== undefined && { 
          move_in_date: req.move_in_date ? new Date(req.move_in_date) : null 
        }),
        ...(req.move_out_date !== undefined && { 
          move_out_date: req.move_out_date ? new Date(req.move_out_date) : null 
        }),
        ...(req.rent_amount !== undefined && { rent_amount: req.rent_amount }),
        ...(req.deposit_amount !== undefined && { deposit_amount: req.deposit_amount }),
        ...(req.payment_frequency && { payment_frequency: req.payment_frequency }),
        ...(req.payment_day !== undefined && { payment_day: req.payment_day }),
        ...(req.notice_period_days !== undefined && { notice_period_days: req.notice_period_days }),
        ...(req.renewable !== undefined && { renewable: req.renewable }),
        ...(req.auto_renewal !== undefined && { auto_renewal: req.auto_renewal }),
        ...(req.pets_allowed !== undefined && { pets_allowed: req.pets_allowed }),
        ...(req.smoking_allowed !== undefined && { smoking_allowed: req.smoking_allowed }),
        ...(req.subletting_allowed !== undefined && { subletting_allowed: req.subletting_allowed }),
        ...(req.special_terms !== undefined && { special_terms: req.special_terms }),
        ...(req.notes !== undefined && { notes: req.notes }),
        ...(req.status && { status: req.status as any }),
        updated_at: new Date(),
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            unit_type: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return lease;
  }

  async listLeases(filters: LeaseFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Build where clause with company scoping
    const where: any = {};

    // Company scoping for non-super-admin users
    if (user.role !== 'super_admin' && user.company_id) {
      where.company_id = user.company_id;
    }

    // Apply filters
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.unit_id) where.unit_id = filters.unit_id;
    if (filters.property_id) where.property_id = filters.property_id;
    if (filters.status) where.status = filters.status;
    if (filters.lease_type) where.lease_type = filters.lease_type;

    // Date range filters
    if (filters.start_date_from || filters.start_date_to) {
      where.start_date = {};
      if (filters.start_date_from) where.start_date.gte = new Date(filters.start_date_from);
      if (filters.start_date_to) where.start_date.lte = new Date(filters.start_date_to);
    }

    if (filters.end_date_from || filters.end_date_to) {
      where.end_date = {};
      if (filters.end_date_from) where.end_date.gte = new Date(filters.end_date_from);
      if (filters.end_date_to) where.end_date.lte = new Date(filters.end_date_to);
    }

    // Search query
    if (filters.search_query) {
      where.OR = [
        { lease_number: { contains: filters.search_query, mode: 'insensitive' } },
        { tenant: { first_name: { contains: filters.search_query, mode: 'insensitive' } } },
        { tenant: { last_name: { contains: filters.search_query, mode: 'insensitive' } } },
        { tenant: { email: { contains: filters.search_query, mode: 'insensitive' } } },
        { unit: { unit_number: { contains: filters.search_query, mode: 'insensitive' } } },
        { property: { name: { contains: filters.search_query, mode: 'insensitive' } } },
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
    const [leases, total] = await Promise.all([
      this.prisma.lease.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          unit: {
            select: {
              id: true,
              unit_number: true,
              unit_type: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              street: true,
              city: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.lease.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      leases,
      total,
      page: currentPage,
      per_page: limit,
      total_pages: totalPages,
    };
  }

  async terminateLease(id: string, terminationReason: string, user: JWTClaims): Promise<any> {
    // First check if lease exists and user has access
    const existingLease = await this.getLease(id, user);

    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to terminate leases');
    }

    if (existingLease.status !== 'active') {
      throw new Error('only active leases can be terminated');
    }

    const lease = await this.prisma.lease.update({
      where: { id },
      data: {
        status: 'terminated',
        terminated_at: new Date(),
        termination_reason: terminationReason,
        move_out_date: new Date(),
        updated_at: new Date(),
      },
    });

    // Update unit status to vacant
    await this.prisma.unit.update({
      where: { id: existingLease.unit_id },
      data: {
        status: 'vacant',
        current_tenant_id: null,
        updated_at: new Date(),
      },
    });

    return lease;
  }

  async renewLease(id: string, renewalData: CreateLeaseRequest, user: JWTClaims): Promise<any> {
    // First check if lease exists and user has access
    const existingLease = await this.getLease(id, user);

    // Check permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to renew leases');
    }

    if (!existingLease.renewable) {
      throw new Error('lease is not renewable');
    }

    // Create new lease with parent reference
    const newLeaseData = {
      ...renewalData,
      parent_lease_id: id,
    };

    const newLease = await this.createLease(newLeaseData, user);

    // Mark old lease as renewed
    await this.prisma.lease.update({
      where: { id },
      data: {
        status: 'renewed',
        updated_at: new Date(),
      },
    });

    return newLease;
  }

  private async generateLeaseNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LSE-${year}`;
    
    const lastLease = await this.prisma.lease.findFirst({
      where: {
        company_id: companyId,
        lease_number: {
          startsWith: prefix,
        },
      },
      orderBy: {
        lease_number: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastLease) {
      const lastNumber = parseInt(lastLease.lease_number.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  private hasLeaseAccess(lease: any, user: JWTClaims): boolean {
    // Super admin has access to all leases
    if (user.role === 'super_admin') {
      return true;
    }

    // Company scoping - user must be in the same company
    if (lease.company_id !== user.company_id) {
      return false;
    }

    // Role-based access
    switch (user.role) {
      case 'agency_admin':
        // Agency admin can access leases in their agency
        return lease.property?.agency_id === user.agency_id;
      
      case 'landlord':
        // Landlord can access leases for their properties
        return lease.property?.owner_id === user.user_id;
      
      case 'agent':
        // Agent can access leases for properties they manage
        return lease.property?.owner_id === user.landlord_id;
      
      case 'caretaker':
        // Caretaker can access:
        // 1. Their own leases (staff accommodation)
        // 2. Leases for properties they manage
        return lease.tenant_id === user.user_id || lease.property?.owner_id === user.landlord_id;
      
      case 'tenant':
        // Tenant can only access their own leases
        return lease.tenant_id === user.user_id;
      
      default:
        return false;
    }
  }

  async createLeasesForExistingTenants(user: JWTClaims): Promise<any> {
    console.log('🔍 Finding tenants without leases...');
    
    // Find all units with tenants that don't have corresponding leases
    const unitsWithTenantsWithoutLeases = await this.prisma.unit.findMany({
      where: {
        current_tenant_id: { not: null },
        // Apply company scoping
        ...(user.role !== 'super_admin' && user.company_id ? { company_id: user.company_id } : {}),
        // Apply landlord scoping
        ...(user.role === 'landlord' ? { property: { owner_id: user.user_id } } : {}),
      },
      include: {
        current_tenant: {
          select: {
            id: true,
            role: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        },
        property: {
          select: {
            id: true,
            name: true,
            owner_id: true,
            company_id: true,
          }
        },
        leases: {
          where: {
            status: { in: ['active', 'draft'] },
          },
          select: {
            id: true,
          }
        }
      }
    });

    // Filter out units that already have active leases
    const unitsWithoutLeases = unitsWithTenantsWithoutLeases.filter(unit => 
      unit.leases.length === 0
    );

    console.log(`📋 Found ${unitsWithoutLeases.length} tenants without leases`);

    if (unitsWithoutLeases.length === 0) {
      return {
        message: 'No tenants found without leases',
        created_leases: 0,
        tenants_processed: 0,
        details: []
      };
    }

    const createdLeases: any[] = [];
    const errors: any[] = [];

    // Create leases for each tenant
    for (const unit of unitsWithoutLeases) {
      try {
        const tenant = unit.current_tenant;
        if (!tenant) continue;

        // Calculate lease dates - use unit's lease dates if available, otherwise default
        const startDate = unit.lease_start_date || new Date();
        const endDate = unit.lease_end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

        const leaseData: CreateLeaseRequest = {
          tenant_id: tenant.id,
          unit_id: unit.id,
          property_id: unit.property_id,
          lease_type: (unit.lease_type as any) || 'fixed_term',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          move_in_date: startDate.toISOString().split('T')[0],
          rent_amount: Number(unit.rent_amount) || 0,
          deposit_amount: Number(unit.deposit_amount) || Number(unit.rent_amount) || 0,
          payment_frequency: 'monthly',
          payment_day: 1,
          notice_period_days: 30,
          renewable: true,
          auto_renewal: false,
          pets_allowed: false,
          smoking_allowed: false,
          subletting_allowed: false,
          special_terms: tenant.role === 'caretaker' ? 'Staff accommodation lease agreement - Created for existing tenant' : 'Created for existing tenant',
        };

        const lease = await this.createLeaseForExistingTenant(leaseData, user);
        
        createdLeases.push({
          lease_id: lease.id,
          tenant_name: `${tenant.first_name} ${tenant.last_name}`,
          tenant_email: tenant.email,
          tenant_role: tenant.role,
          unit_number: unit.unit_number,
          property_name: unit.property.name,
          rent_amount: Number(unit.rent_amount) || 0,
        });

        console.log(`✅ Created lease for ${tenant.role} ${tenant.first_name} ${tenant.last_name} in unit ${unit.unit_number}`);

      } catch (error: any) {
        console.error(`❌ Failed to create lease for tenant ${unit.current_tenant?.email}:`, error.message);
        errors.push({
          tenant_id: unit.current_tenant?.id,
          tenant_name: `${unit.current_tenant?.first_name} ${unit.current_tenant?.last_name}`,
          unit_number: unit.unit_number,
          error: error.message,
        });
      }
    }

    const result = {
      message: `Successfully created ${createdLeases.length} leases for existing tenants`,
      created_leases: createdLeases.length,
      tenants_processed: unitsWithoutLeases.length,
      errors: errors.length,
      details: {
        successful_leases: createdLeases,
        failed_leases: errors,
      }
    };

    console.log(`🎉 Bulk lease creation completed: ${createdLeases.length} successful, ${errors.length} failed`);
    return result;
  }

  async createLeaseForExistingTenant(req: CreateLeaseRequest, user: JWTClaims): Promise<any> {
    // This method is specifically for creating leases for existing tenants
    // It bypasses the unit availability check since the tenant is already in the unit
    
    // Validate tenant exists
    const tenant = await this.prisma.user.findUnique({
      where: { 
        id: req.tenant_id,
        role: 'tenant' as any,
      },
    });

    if (!tenant) {
      throw new Error('tenant not found');
    }

    // Validate unit exists (but don't check if it's vacant since tenant is already there)
    const unit = await this.prisma.unit.findUnique({
      where: { id: req.unit_id },
      include: { property: true }
    });

    if (!unit) {
      throw new Error('unit not found');
    }

    // Generate lease number
    const leaseNumber = await this.generateLeaseNumber(user.company_id!);

    // Create the lease without updating unit status (since tenant is already there)
    const lease = await this.prisma.lease.create({
      data: {
        lease_number: leaseNumber,
        tenant_id: req.tenant_id,
        unit_id: req.unit_id,
        property_id: req.property_id,
        lease_type: req.lease_type as any,
        status: 'active' as any,
        start_date: new Date(req.start_date),
        end_date: req.end_date ? new Date(req.end_date) : new Date(new Date(req.start_date).getTime() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year from start
        move_in_date: req.move_in_date ? new Date(req.move_in_date) : new Date(req.start_date),
        rent_amount: req.rent_amount,
        deposit_amount: req.deposit_amount,
        payment_frequency: req.payment_frequency as any,
        payment_day: req.payment_day,
        notice_period_days: req.notice_period_days,
        renewable: req.renewable,
        auto_renewal: req.auto_renewal,
        pets_allowed: req.pets_allowed,
        smoking_allowed: req.smoking_allowed,
        subletting_allowed: req.subletting_allowed,
        special_terms: req.special_terms,
        created_by: user.user_id,
        company_id: user.company_id!,
      },
      include: {
        tenant: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          }
        },
        unit: {
          select: {
            id: true,
            unit_number: true,
            unit_type: true,
          }
        },
        property: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Don't update unit status since the tenant is already there and unit is already occupied
    
    return lease;
  }

}