import { getPrisma } from '../config/prisma.js';
import bcrypt from 'bcrypt';
export class UsersService {
    prisma = getPrisma();
    async createUser(req, user) {
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
            role: req.role,
            password_hash: passwordHash,
            status: req.send_invitation !== false ? 'pending' : 'active',
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
    async getUser(id, user) {
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
    async updateUser(id, req, user) {
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
                ...(req.role && { role: req.role }),
                ...(req.status && { status: req.status }),
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
    async deleteUser(id, user) {
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
    async listUsers(filters, user) {
        const limit = Math.min(filters.limit || 20, 100);
        const offset = filters.offset || 0;
        // Build where clause with company scoping
        const where = {};
        // Company scoping for non-super-admin users
        if (user.role !== 'super_admin' && user.company_id) {
            where.company_id = user.company_id;
        }
        // Apply filters
        if (filters.role)
            where.role = filters.role;
        if (filters.status)
            where.status = filters.status;
        if (filters.company_id && user.role === 'super_admin')
            where.company_id = filters.company_id;
        if (filters.agency_id)
            where.agency_id = filters.agency_id;
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
    async getCurrentUser(user) {
        return this.getUser(user.user_id, user);
    }
    async updateCurrentUser(req, user) {
        // Users can update their own profile (excluding role and status)
        const allowedFields = {
            first_name: req.first_name,
            last_name: req.last_name,
            phone_number: req.phone_number,
            email: req.email,
        };
        return this.updateUser(user.user_id, allowedFields, user);
    }
    async changePassword(req, user) {
        // Get current user
        const currentUser = await this.prisma.user.findUnique({
            where: { id: user.user_id },
            select: { password_hash: true },
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
        // Update password
        await this.prisma.user.update({
            where: { id: user.user_id },
            data: {
                password_hash: newPasswordHash,
                updated_at: new Date(),
            },
        });
    }
    async activateUser(id, user) {
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
    async deactivateUser(id, user) {
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
    canCreateRole(userRole, targetRole) {
        const roleHierarchy = {
            super_admin: ['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker', 'tenant'],
            agency_admin: ['landlord', 'agent', 'caretaker', 'tenant'],
            landlord: ['caretaker', 'tenant'],
        };
        return roleHierarchy[userRole]?.includes(targetRole) || false;
    }
    canUpdateRole(userRole, currentRole, newRole) {
        // Super admin can change any role
        if (userRole === 'super_admin')
            return true;
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
    hasUserAccess(targetUser, user) {
        // Super admin has access to all users
        if (user.role === 'super_admin')
            return true;
        // Users can access their own profile
        if (targetUser.id === user.user_id)
            return true;
        // Company scoping - user can only access users from their company
        if (user.company_id && targetUser.company_id === user.company_id)
            return true;
        // Agency admin can access users from their agency
        if (user.role === 'agency_admin' && user.agency_id && targetUser.agency_id === user.agency_id)
            return true;
        return false;
    }
}
