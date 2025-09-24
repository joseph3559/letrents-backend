import { Request, Response } from 'express';
import { 
  MaintenanceService, 
  MaintenanceFilters, 
  CreateMaintenanceRequest, 
  UpdateMaintenanceRequest 
} from '../services/maintenance.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new MaintenanceService();

export const createMaintenanceRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const requestData: CreateMaintenanceRequest = req.body;

    // Validate required fields
    if (!requestData.title || !requestData.description) {
      return writeError(res, 400, 'Title and description are required');
    }

    const maintenanceRequest = await service.createMaintenanceRequest(requestData, user);
    writeSuccess(res, 201, 'Maintenance request created successfully', maintenanceRequest);
  } catch (error: any) {
    const message = error.message || 'Failed to create maintenance request';
    writeError(res, 500, message);
  }
};

export const getMaintenanceRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Maintenance request ID is required');
    }

    const maintenanceRequest = await service.getMaintenanceRequest(id, user);
    writeSuccess(res, 200, 'Maintenance request retrieved successfully', maintenanceRequest);
  } catch (error: any) {
    const message = error.message || 'Failed to get maintenance request';
    const status = message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const listMaintenanceRequests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    // Parse query parameters
    const filters: MaintenanceFilters = {
      property_id: req.query.property_id as string,
      unit_id: req.query.unit_id as string,
      tenant_id: req.query.tenant_id as string,
      category: req.query.category as string,
      priority: req.query.priority as string,
      status: req.query.status as string,
      search_query: req.query.search as string,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as string,
      limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 
              req.query.page ? (parseInt(req.query.page as string) - 1) * (req.query.limit ? parseInt(req.query.limit as string) : 20) : 0,
    };

    const result = await service.listMaintenanceRequests(filters, user);
    writeSuccess(res, 200, 'Maintenance requests retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to list maintenance requests';
    writeError(res, 500, message);
  }
};

export const updateMaintenanceRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const updateData: UpdateMaintenanceRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Maintenance request ID is required');
    }

    const maintenanceRequest = await service.updateMaintenanceRequest(id, updateData, user);
    writeSuccess(res, 200, 'Maintenance request updated successfully', maintenanceRequest);
  } catch (error: any) {
    const message = error.message || 'Failed to update maintenance request';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const deleteMaintenanceRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Maintenance request ID is required');
    }

    await service.deleteMaintenanceRequest(id, user);
    writeSuccess(res, 200, 'Maintenance request deleted successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to delete maintenance request';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getMaintenanceOverview = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const overview = await service.getMaintenanceOverview(user);
    writeSuccess(res, 200, 'Maintenance overview retrieved successfully', overview);
  } catch (error: any) {
    const message = error.message || 'Failed to get maintenance overview';
    writeError(res, 500, message);
  }
};
