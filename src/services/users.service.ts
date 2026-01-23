import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import bcrypt from 'bcryptjs';

export interface UserFilters {
  role?: string;
  status?: string;
  company_id?: string;
  agency_id?: string;
  search_query?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: string;
  password?: string;
  agency_id?: string;
  send_invitation?: boolean;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  role?: string;
  status?: string;
  id_number?: string;
  profile_picture_url?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export class UsersService {
  private prisma = getPrisma();

  async createUser(req: CreateUserRequest, user: JWTClaims): Promise<any> {
    // Validate user permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to create users');
    }

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: req.email },
    });

    if (existingUser) {
      throw new Error('user with this email already exists');
    }

    // Validate role permissions
    if (!this.canCreateRole(user.role, req.role)) {
      throw new Error(`insufficient permissions to create user with role: ${req.role}`);
    }

    // Generate password hash if password provided
    let passwordHash = undefined;
    if (req.password && req.send_invitation !== true) {
      passwordHash = await bcrypt.hash(req.password, 10);
    }

    // Create user
    const userData = {
      email: req.email,
      first_name: req.first_name,
      last_name: req.last_name,
      phone_number: req.phone_number,
      role: req.role as any,
      password_hash: passwordHash,
      status: req.send_invitation !== false ? 'pending' as any : 'active' as any,
      email_verified: false,
      company_id: user.company_id,
      agency_id: req.agency_id,
      created_by: user.user_id,
    };

    const newUser = await this.prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        email_verified: true,
        company_id: true,
        agency_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    // TODO: Send invitation email if req.send_invitation is true

    return newUser;
  }

  async getUser(id: string, user: JWTClaims): Promise<any> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        email_verified: true,
        company_id: true,
        agency_id: true,
        created_at: true,
        updated_at: true,
        creator: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        id_number: true,
      },
    });

    if (!targetUser) {
      throw new Error('user not found');
    }

    // Check access permissions
    if (!this.hasUserAccess(targetUser, user)) {
      throw new Error('insufficient permissions to view this user');
    }

    return targetUser;
  }

  async updateUser(id: string, req: UpdateUserRequest, user: JWTClaims): Promise<any> {
    // First check if user exists and user has access
    const existingUser = await this.getUser(id, user);

    // Check update permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to update users');
    }

    // If email is being changed, check for duplicates
    if (req.email && req.email !== existingUser.email) {
      const duplicateUser = await this.prisma.user.findUnique({
        where: { email: req.email },
      });

      if (duplicateUser && duplicateUser.id !== id) {
        throw new Error('user with this email already exists');
      }
    }

    // Validate role change permissions
    if (req.role && req.role !== existingUser.role) {
      if (!this.canUpdateRole(user.role, existingUser.role, req.role)) {
        throw new Error(`insufficient permissions to change user role to: ${req.role}`);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(req.first_name && { first_name: req.first_name }),
        ...(req.last_name && { last_name: req.last_name }),
        ...(req.phone_number !== undefined && { phone_number: req.phone_number }),
        ...(req.email && { email: req.email }),
        ...(req.role && { role: req.role as any }),
        ...(req.status && { status: req.status as any }),
        ...(req.id_number !== undefined && { id_number: req.id_number }),
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        email_verified: true,
        company_id: true,
        agency_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return updatedUser;
  }

  async deleteUser(id: string, user: JWTClaims): Promise<void> {
    // First check if user exists and user has access
    const existingUser = await this.getUser(id, user);

    // Check delete permissions
    if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
      throw new Error('insufficient permissions to delete users');
    }

    // Prevent self-deletion
    if (id === user.user_id) {
      throw new Error('cannot delete your own account');
    }

    // Prevent deleting super admin (unless you are super admin)
    if (existingUser.role === 'super_admin' && user.role !== 'super_admin') {
      throw new Error('insufficient permissions to delete super admin');
    }

    // Check if user has dependencies (properties, units, etc.)
    const [propertiesCount, unitsCount] = await Promise.all([
      this.prisma.property.count({ where: { owner_id: id } }),
      this.prisma.unit.count({ where: { current_tenant_id: id } }),
    ]);

    if (propertiesCount > 0) {
      throw new Error('cannot delete user who owns properties. Please transfer ownership first.');
    }

    if (unitsCount > 0) {
      throw new Error('cannot delete user who is assigned to units. Please release assignments first.');
    }

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async listUsers(filters: UserFilters, user: JWTClaims): Promise<any> {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Build where clause with company scoping
    const where: any = {};

    // Company scoping for non-super-admin users
    if (user.role !== 'super_admin' && user.company_id) {
      where.company_id = user.company_id;
    }

    // Apply filters
    if (filters.role) where.role = filters.role as any;
    if (filters.status) where.status = filters.status as any;
    if (filters.company_id && user.role === 'super_admin') where.company_id = filters.company_id;
    if (filters.agency_id) where.agency_id = filters.agency_id;

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
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          status: true,
          email_verified: true,
          company_id: true,
          agency_id: true,
          created_at: true,
          updated_at: true,
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
      users,
      total,
      page: currentPage,
      per_page: limit,
      total_pages: totalPages,
    };
  }

  async getCurrentUser(user: JWTClaims): Promise<any> {
    return this.getUser(user.user_id, user);
  }

  async updateCurrentUser(req: UpdateUserRequest, user: JWTClaims): Promise<any> {
    // Users can update their own profile (excluding role and status)
    // Note: profile_picture_url is handled separately via upload endpoint
    const allowedFields: UpdateUserRequest = {
      first_name: req.first_name,
      last_name: req.last_name,
      phone_number: req.phone_number,
      email: req.email,
      id_number: req.id_number,
    };

    return this.updateUser(user.user_id, allowedFields, user);
  }

  async changePassword(req: ChangePasswordRequest, user: JWTClaims): Promise<void> {
    // Get current user
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.user_id },
      select: { password_hash: true, status: true },
    });

    if (!currentUser || !currentUser.password_hash) {
      throw new Error('user not found or no password set');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(req.current_password, currentUser.password_hash);
    if (!isValidPassword) {
      throw new Error('current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(req.new_password, 10);

    // Prepare update data
    const updateData: any = {
      password_hash: newPasswordHash,
      updated_at: new Date(),
    };

    // If user is pending_setup, activate them after password change
    if (currentUser.status === 'pending_setup') {
      updateData.status = 'active';
      console.log(`✅ Auto-activating user ${user.user_id} after password change (was pending_setup)`);
    }

    // Update password (and status if needed)
    await this.prisma.user.update({
      where: { id: user.user_id },
      data: updateData,
    });
  }

  async activateUser(id: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin'].includes(user.role)) {
      throw new Error('insufficient permissions to activate users');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'active',
        updated_at: new Date(),
      },
    });
  }

  async deactivateUser(id: string, user: JWTClaims): Promise<void> {
    // Check permissions
    if (!['super_admin', 'agency_admin'].includes(user.role)) {
      throw new Error('insufficient permissions to deactivate users');
    }

    // Prevent self-deactivation
    if (id === user.user_id) {
      throw new Error('cannot deactivate your own account');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'inactive',
        updated_at: new Date(),
      },
    });
  }

  private canCreateRole(userRole: string, targetRole: string): boolean {
    const roleHierarchy = {
      super_admin: ['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker', 'tenant'],
      agency_admin: ['landlord', 'agent', 'caretaker', 'tenant'],
      landlord: ['caretaker', 'tenant'],
    };

    return roleHierarchy[userRole as keyof typeof roleHierarchy]?.includes(targetRole) || false;
  }

  private canUpdateRole(userRole: string, currentRole: string, newRole: string): boolean {
    // Super admin can change any role
    if (userRole === 'super_admin') return true;

    // Agency admin can change roles within their hierarchy
    if (userRole === 'agency_admin') {
      const allowedRoles = ['landlord', 'agent', 'caretaker', 'tenant'];
      return allowedRoles.includes(currentRole) && allowedRoles.includes(newRole);
    }

    // Landlord can only change caretaker and tenant roles
    if (userRole === 'landlord') {
      const allowedRoles = ['caretaker', 'tenant'];
      return allowedRoles.includes(currentRole) && allowedRoles.includes(newRole);
    }

    return false;
  }

  private hasUserAccess(targetUser: any, user: JWTClaims): boolean {
    // Super admin has access to all users
    if (user.role === 'super_admin') return true;

    // Users can access their own profile
    if (targetUser.id === user.user_id) return true;

    // Company scoping - user can only access users from their company
    if (user.company_id && targetUser.company_id === user.company_id) return true;

    // Agency admin can access users from their agency
    if (user.role === 'agency_admin' && user.agency_id && targetUser.agency_id === user.agency_id) return true;

    return false;
  }

  async getCurrentUserPreferences(user: JWTClaims): Promise<any> {
    const prisma = getPrisma();
    
    // Try to get existing preferences
    let preferences = await prisma.userPreferences.findUnique({
      where: { user_id: user.user_id },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          user_id: user.user_id,
          default_rent_due_date: 5,
          auto_rent_invoices: true,
          auto_lease_renewal_reminders: true,
          grace_period: 5,
          default_currency: 'KES',
          units_view_style: 'card',
          attach_signature: false,
          late_rent_reminder_enabled: true,
          late_rent_reminder_date: 15,
          theme: 'light',
        },
      });
    }

    return preferences;
  }

  async updateCurrentUserPreferences(data: any, user: JWTClaims): Promise<any> {
    const prisma = getPrisma();

    // Upsert preferences (create if not exists, update if exists)
    const preferences = await prisma.userPreferences.upsert({
      where: { user_id: user.user_id },
      update: {
        default_rent_due_date: data.default_rent_due_date,
        auto_rent_invoices: data.auto_rent_invoices,
        auto_lease_renewal_reminders: data.auto_lease_renewal_reminders,
        grace_period: data.grace_period,
        default_currency: data.default_currency,
        units_view_style: data.units_view_style,
        attach_signature: data.attach_signature,
        late_rent_reminder_enabled: data.late_rent_reminder_enabled,
        late_rent_reminder_date: data.late_rent_reminder_date,
        theme: data.theme,
        signature: data.signature,
        updated_at: new Date(),
      },
      create: {
        user_id: user.user_id,
        default_rent_due_date: data.default_rent_due_date || 5,
        auto_rent_invoices: data.auto_rent_invoices !== false,
        auto_lease_renewal_reminders: data.auto_lease_renewal_reminders !== false,
        grace_period: data.grace_period || 5,
        default_currency: data.default_currency || 'KES',
        units_view_style: data.units_view_style || 'card',
        attach_signature: data.attach_signature || false,
        late_rent_reminder_enabled: data.late_rent_reminder_enabled !== false,
        late_rent_reminder_date: data.late_rent_reminder_date || 15,
        theme: data.theme || 'light',
        signature: data.signature,
      },
    });

    return preferences;
  }

  async upgradeToAgency(user: JWTClaims) {
    if (user.role !== 'landlord') {
      throw new Error('Only landlords can upgrade to agency accounts');
    }
    if (!user.company_id) {
      throw new Error('Company information is required to upgrade to agency');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.company_id },
      select: { id: true, name: true, email: true, phone_number: true },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    let agency = await this.prisma.agency.findFirst({
      where: { company_id: company.id },
    });

    if (!agency) {
      agency = await this.prisma.agency.create({
        data: {
          company_id: company.id,
          name: `${company.name} Agency`,
          email: company.email || user.email || `${company.name}@agency.local`,
          phone_number: company.phone_number || null,
          status: 'active' as any,
          created_by: user.user_id,
        },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.user_id },
      data: {
        role: 'agency_admin' as any,
        agency_id: agency.id,
        updated_at: new Date(),
      },
    });

    return { agency, user: updatedUser };
  }
}
