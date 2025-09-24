import { JWTClaims } from '../types/index.js';
import { buildPermissionMatrix } from '../middleware/rbac.js';

export interface RoleInfo {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
}

export interface PermissionInfo {
  resource: string;
  action: string;
  name: string;
  description: string;
}

export interface UserHierarchy {
  current_role: string;
  can_manage_roles: string[];
  can_create_roles: string[];
  hierarchy_level: number;
}

export class RBACService {
  private permissionMatrix = buildPermissionMatrix();

  async getAllRoles(): Promise<RoleInfo[]> {
    const roles: RoleInfo[] = [
      {
        name: 'super_admin',
        display_name: 'Super Administrator',
        description: 'Full system access with all permissions',
        permissions: this.getRolePermissions('super_admin'),
      },
      {
        name: 'agency_admin',
        display_name: 'Agency Administrator',
        description: 'Manage agency properties, users, and operations',
        permissions: this.getRolePermissions('agency_admin'),
      },
      {
        name: 'landlord',
        display_name: 'Landlord',
        description: 'Manage own properties, units, and tenants',
        permissions: this.getRolePermissions('landlord'),
      },
      {
        name: 'agent',
        display_name: 'Agent',
        description: 'Limited property and tenant management access',
        permissions: this.getRolePermissions('agent'),
      },
      {
        name: 'caretaker',
        display_name: 'Caretaker',
        description: 'Maintenance and basic property access',
        permissions: this.getRolePermissions('caretaker'),
      },
      {
        name: 'tenant',
        display_name: 'Tenant',
        description: 'Access to personal information and unit details',
        permissions: this.getRolePermissions('tenant'),
      },
    ];

    return roles;
  }

  async getAllPermissions(): Promise<PermissionInfo[]> {
    const permissions: PermissionInfo[] = [];

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
      for (const action of config.actions as string[]) {
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

  async getCurrentUserPermissions(user: JWTClaims): Promise<string[]> {
    return this.getRolePermissions(user.role);
  }

  async checkCurrentUserPermission(permission: string, user: JWTClaims): Promise<boolean> {
    const userPermissions = this.getRolePermissions(user.role);
    return userPermissions.includes(permission);
  }

  async getCurrentUserHierarchy(user: JWTClaims): Promise<UserHierarchy> {
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

    return hierarchies[user.role as keyof typeof hierarchies] || hierarchies.tenant;
  }

  private getRolePermissions(role: string): string[] {
    const rolePermissions = this.permissionMatrix[role as keyof typeof this.permissionMatrix];
    if (!rolePermissions) return [];

    const permissions: string[] = [];
    for (const [resource, actions] of Object.entries(rolePermissions)) {
      for (const action of actions as string[]) {
        permissions.push(`${resource}:${action}`);
      }
    }

    return permissions;
  }
}
