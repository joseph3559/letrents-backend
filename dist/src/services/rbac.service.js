import { buildPermissionMatrix } from '../middleware/rbac.js';
export class RBACService {
    permissionMatrix = buildPermissionMatrix();
    async getAllRoles() {
        const roleDescriptions = {
            super_admin: 'Full system access with all permissions',
            agency_admin: 'Manage agency properties, users, and operations',
            landlord: 'Manage own properties, units, and tenants',
            agent: 'Limited property and tenant management access',
            caretaker: 'Maintenance and basic property access',
            tenant: 'Access to personal information and unit details',
            cleaner: 'Cleaning tasks and basic property access',
            security: 'Security operations with limited access',
            maintenance: 'Maintenance tasks and inspections',
            receptionist: 'Front desk operations and messaging',
            accountant: 'Financial operations and reporting',
            admin: 'Administrative access to daily operations',
            manager: 'Operational management access',
            team_lead: 'Team oversight with limited admin access',
            staff: 'General staff access',
            finance: 'Finance-focused access',
            sales: 'Sales and tenant onboarding access',
            marketing: 'Marketing and communications access',
            support: 'Support operations access',
            hr: 'Staff management and HR operations',
            auditor: 'Read-only audit access',
        };
        const toDisplayName = (role) => role
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        const roles = Object.keys(this.permissionMatrix).map((role) => ({
            name: role,
            display_name: toDisplayName(role),
            description: roleDescriptions[role] || `Standard access for ${toDisplayName(role)}`,
            permissions: this.getRolePermissions(role),
        }));
        return roles;
    }
    async getAllPermissions() {
        const permissions = [];
        // Define all resources and their actions
        const resourceActions = {
            property: {
                actions: ['create', 'read', 'update', 'delete', 'analytics', 'archive', 'duplicate'],
                description: 'Property management operations',
            },
            units: {
                actions: ['create', 'read', 'update', 'delete', 'assign', 'release', 'status'],
                description: 'Unit management operations',
            },
            tenants: {
                actions: ['create', 'read', 'update', 'delete', 'assign', 'release'],
                description: 'Tenant management operations',
            },
            users: {
                actions: ['create', 'read', 'update', 'delete', 'activate', 'deactivate'],
                description: 'User management operations',
            },
            maintenance: {
                actions: ['create', 'read', 'update', 'delete'],
                description: 'Maintenance request operations',
            },
            invoices: {
                actions: ['create', 'read', 'update', 'delete', 'send', 'mark_paid'],
                description: 'Invoice management operations',
            },
            dashboard: {
                actions: ['read', 'kpis', 'charts'],
                description: 'Dashboard and analytics access',
            },
            communications: {
                actions: ['create', 'read', 'update', 'delete'],
                description: 'Communication and messaging operations',
            },
            notifications: {
                actions: ['read', 'update', 'delete'],
                description: 'Notification management operations',
            },
            reports: {
                actions: ['read', 'generate', 'export'],
                description: 'Report generation and export operations',
            },
            caretakers: {
                actions: ['create', 'read', 'update', 'delete', 'invite'],
                description: 'Caretaker management operations',
            },
            agents: {
                actions: ['create', 'read', 'update', 'delete', 'assign'],
                description: 'Agent management operations',
            },
        };
        // Generate permission list
        for (const [resource, config] of Object.entries(resourceActions)) {
            for (const action of config.actions) {
                permissions.push({
                    resource,
                    action,
                    name: `${resource}:${action}`,
                    description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
                });
            }
        }
        return permissions;
    }
    async getCurrentUserPermissions(user) {
        return this.getRolePermissions(user.role);
    }
    async checkCurrentUserPermission(permission, user) {
        const userPermissions = this.getRolePermissions(user.role);
        return userPermissions.includes(permission);
    }
    async getCurrentUserHierarchy(user) {
        const hierarchies = {
            super_admin: {
                current_role: 'super_admin',
                can_manage_roles: ['super_admin', 'agency_admin', 'landlord', 'agent', 'caretaker', 'tenant'],
                can_create_roles: ['agency_admin', 'landlord', 'agent', 'caretaker', 'tenant'],
                hierarchy_level: 1,
            },
            agency_admin: {
                current_role: 'agency_admin',
                can_manage_roles: ['landlord', 'agent', 'caretaker', 'tenant'],
                can_create_roles: ['landlord', 'agent', 'caretaker', 'tenant'],
                hierarchy_level: 2,
            },
            landlord: {
                current_role: 'landlord',
                can_manage_roles: ['caretaker', 'tenant'],
                can_create_roles: ['caretaker', 'tenant'],
                hierarchy_level: 3,
            },
            agent: {
                current_role: 'agent',
                can_manage_roles: ['tenant'],
                can_create_roles: ['tenant'],
                hierarchy_level: 4,
            },
            caretaker: {
                current_role: 'caretaker',
                can_manage_roles: [],
                can_create_roles: [],
                hierarchy_level: 5,
            },
            tenant: {
                current_role: 'tenant',
                can_manage_roles: [],
                can_create_roles: [],
                hierarchy_level: 6,
            },
        };
        return hierarchies[user.role] || hierarchies.tenant;
    }
    getRolePermissions(role) {
        const rolePermissions = this.permissionMatrix[role];
        if (!rolePermissions)
            return [];
        const permissions = [];
        for (const [resource, actions] of Object.entries(rolePermissions)) {
            for (const action of actions) {
                permissions.push(`${resource}:${action}`);
            }
        }
        return permissions;
    }
}
