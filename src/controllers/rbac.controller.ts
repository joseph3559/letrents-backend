import { Request, Response } from 'express';
import { RBACService } from '../services/rbac.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new RBACService();

export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const roles = await service.getAllRoles();
    writeSuccess(res, 200, 'Roles retrieved successfully', roles);
  } catch (error: any) {
    writeError(res, 500, error.message || 'Failed to get roles');
  }
};

export const getAllPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await service.getAllPermissions();
    writeSuccess(res, 200, 'Permissions retrieved successfully', permissions);
  } catch (error: any) {
    writeError(res, 500, error.message || 'Failed to get permissions');
  }
};

export const getCurrentUserPermissions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const permissions = await service.getCurrentUserPermissions(user);
    writeSuccess(res, 200, 'User permissions retrieved successfully', { permissions });
  } catch (error: any) {
    writeError(res, 500, error.message || 'Failed to get user permissions');
  }
};

export const checkCurrentUserPermission = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { permission } = req.params;

    if (!permission) {
      return writeError(res, 400, 'Permission parameter is required');
    }

    const hasPermission = await service.checkCurrentUserPermission(permission, user);
    writeSuccess(res, 200, 'Permission check completed', { 
      permission,
      has_permission: hasPermission 
    });
  } catch (error: any) {
    writeError(res, 500, error.message || 'Failed to check permission');
  }
};

export const getCurrentUserHierarchy = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const hierarchy = await service.getCurrentUserHierarchy(user);
    writeSuccess(res, 200, 'User hierarchy retrieved successfully', hierarchy);
  } catch (error: any) {
    writeError(res, 500, error.message || 'Failed to get user hierarchy');
  }
};
