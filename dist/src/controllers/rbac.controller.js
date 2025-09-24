import { RBACService } from '../services/rbac.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new RBACService();
export const getAllRoles = async (req, res) => {
    try {
        const roles = await service.getAllRoles();
        writeSuccess(res, 200, 'Roles retrieved successfully', roles);
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to get roles');
    }
};
export const getAllPermissions = async (req, res) => {
    try {
        const permissions = await service.getAllPermissions();
        writeSuccess(res, 200, 'Permissions retrieved successfully', permissions);
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to get permissions');
    }
};
export const getCurrentUserPermissions = async (req, res) => {
    try {
        const user = req.user;
        const permissions = await service.getCurrentUserPermissions(user);
        writeSuccess(res, 200, 'User permissions retrieved successfully', { permissions });
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to get user permissions');
    }
};
export const checkCurrentUserPermission = async (req, res) => {
    try {
        const user = req.user;
        const { permission } = req.params;
        if (!permission) {
            return writeError(res, 400, 'Permission parameter is required');
        }
        const hasPermission = await service.checkCurrentUserPermission(permission, user);
        writeSuccess(res, 200, 'Permission check completed', {
            permission,
            has_permission: hasPermission
        });
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to check permission');
    }
};
export const getCurrentUserHierarchy = async (req, res) => {
    try {
        const user = req.user;
        const hierarchy = await service.getCurrentUserHierarchy(user);
        writeSuccess(res, 200, 'User hierarchy retrieved successfully', hierarchy);
    }
    catch (error) {
        writeError(res, 500, error.message || 'Failed to get user hierarchy');
    }
};
