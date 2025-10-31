import { Request, Response } from 'express';
import { 
  TenantsService, 
  TenantFilters, 
  CreateTenantRequest, 
  UpdateTenantRequest,
  AssignUnitRequest,
  TenantInvitationRequest,
  TenantMigrationRequest
} from '../services/tenants.service.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const service = new TenantsService();

export const createTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const tenantData: CreateTenantRequest = req.body;

    // Validate required fields
    if (!tenantData.email || !tenantData.first_name || !tenantData.last_name) {
      return writeError(res, 400, 'Email, first name, and last name are required');
    }

    const tenant = await service.createTenant(tenantData, user);
    writeSuccess(res, 201, 'Tenant created successfully', tenant);
  } catch (error: any) {
    const message = error.message || 'Failed to create tenant';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 :
                  message.includes('already exists') ? 409 :
                  message.includes('not available') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const getTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const tenant = await service.getTenant(id, user);
    writeSuccess(res, 200, 'Tenant retrieved successfully', tenant);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const updateData: UpdateTenantRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const tenant = await service.updateTenant(id, updateData, user);
    writeSuccess(res, 200, 'Tenant updated successfully', tenant);
  } catch (error: any) {
    const message = error.message || 'Failed to update tenant';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('already exists') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const checkTenantDeletable = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const result = await service.checkDeletable(id, user);
    writeSuccess(res, 200, 'Tenant deletion check completed', result);
  } catch (error: any) {
    const message = error.message || 'Failed to check tenant deletion eligibility';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 : 500;
    writeError(res, status, message);
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await service.deleteTenant(id, user);
    writeSuccess(res, 200, 'Tenant deleted successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to delete tenant';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('assigned to units') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const listTenants = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    
    // Parse query parameters
    const filters: TenantFilters = {
      property_id: req.query.property_id as string,
      unit_id: req.query.unit_id as string,
      status: req.query.status as string,
      search_query: req.query.search as string,
      sort_by: req.query.sort_by as string,
      sort_order: req.query.sort_order as string,
      limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 
              req.query.page ? (parseInt(req.query.page as string) - 1) * (req.query.limit ? parseInt(req.query.limit as string) : 20) : 0,
    };

    const result = await service.listTenants(filters, user);
    
    // Format response to match Go backend structure
    const response = {
      success: true,
      message: 'Tenants retrieved successfully',
      data: result.tenants,
      pagination: {
        page: result.page,
        per_page: result.per_page,
        total: result.total,
        total_pages: result.total_pages,
      },
    };

    res.json(response);
  } catch (error: any) {
    const message = error.message || 'Failed to list tenants';
    writeError(res, 500, message);
  }
};

export const assignUnit = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const assignmentData: AssignUnitRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    if (!assignmentData.unit_id || !assignmentData.lease_start_date || 
        !assignmentData.lease_end_date || !assignmentData.lease_type) {
      return writeError(res, 400, 'Unit ID, lease start date, lease end date, and lease type are required');
    }

    await service.assignUnit(id, assignmentData, user);
    writeSuccess(res, 200, 'Unit assigned to tenant successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to assign unit to tenant';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('not available') || message.includes('already') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const releaseUnit = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await service.releaseUnit(id, user);
    writeSuccess(res, 200, 'Tenant released from unit successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to release tenant from unit';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('not currently assigned') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const terminateTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await service.terminateTenant(id, user);
    writeSuccess(res, 200, 'Tenant terminated successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to terminate tenant';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const sendInvitation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await service.sendInvitation(id, user);
    writeSuccess(res, 200, 'Invitation sent successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to send invitation';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    await service.resetPassword(id, user);
    writeSuccess(res, 200, 'Password reset initiated successfully');
  } catch (error: any) {
    const message = error.message || 'Failed to reset password';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getTenantPayments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id: tenantId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!tenantId) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    // Use the payments service directly
    const { PaymentsService } = await import('../services/payments.service.js');
    const paymentsService = new PaymentsService();
    
    const filters = { tenant_id: tenantId };
    const result = await paymentsService.listPayments(filters, user, Number(page), Number(limit));

    writeSuccess(res, 200, 'Tenant payments retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant payments';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getTenantDocuments = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    // TODO: Implement document retrieval logic
    // For now, return empty array as placeholder
    const documents: any[] = [];

    writeSuccess(res, 200, 'Tenant documents retrieved successfully', documents);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant documents';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const migrateTenant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const migrationData: TenantMigrationRequest = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    if (!migrationData.new_unit_id) {
      return writeError(res, 400, 'New unit ID is required');
    }

    await service.migrateTenant(id, migrationData, user);
    writeSuccess(res, 200, 'Tenant migrated successfully', null);
  } catch (error: any) {
    const message = error.message || 'Failed to migrate tenant';
    const status = message.includes('permissions') ? 403 :
                  message.includes('not found') ? 404 :
                  message.includes('not available') ? 409 : 500;
    writeError(res, status, message);
  }
};

export const getTenantActivity = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { dateRange, startDate, endDate, limit, offset } = req.query;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const options = {
      dateRange: dateRange as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await service.getTenantActivity(id, user, options);
    writeSuccess(res, 200, 'Tenant activity retrieved successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant activity';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const updateRentDetails = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { baseRent, utilities, totalRent, generateLease } = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    if (!baseRent || typeof baseRent !== 'number') {
      return writeError(res, 400, 'Valid base rent amount is required');
    }

    const result = await service.updateRentDetails(id, {
      baseRent,
      utilities: utilities || [],
      totalRent: totalRent || baseRent,
      generateLease: generateLease === true
    }, user);

    writeSuccess(res, 200, result.message, result.data);
  } catch (error: any) {
    const message = error.message || 'Failed to update rent details';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 :
                  message.includes('no active lease') ? 400 : 500;
    writeError(res, status, message);
  }
};

export const getTenantMaintenance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const maintenance = await service.getTenantMaintenance(id, user);
    writeSuccess(res, 200, 'Maintenance requests retrieved successfully', maintenance);
  } catch (error: any) {
    const message = error.message || 'Failed to get maintenance requests';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const createTenantMaintenance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const maintenanceData = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    if (!maintenanceData.title || !maintenanceData.description) {
      return writeError(res, 400, 'Title and description are required');
    }

    const maintenance = await service.createTenantMaintenance(id, maintenanceData, user);
    writeSuccess(res, 201, 'Maintenance request created successfully', maintenance);
  } catch (error: any) {
    const message = error.message || 'Failed to create maintenance request';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getTenantPerformance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const performance = await service.getTenantPerformance(id, user);
    writeSuccess(res, 200, 'Tenant performance retrieved successfully', performance);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant performance';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const getTenantNotes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const notes = await service.getTenantNotes(id, user);
    writeSuccess(res, 200, 'Tenant notes retrieved successfully', notes);
  } catch (error: any) {
    const message = error.message || 'Failed to get tenant notes';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};

export const updateTenantNotes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTClaims;
    const { id } = req.params;
    const { notes } = req.body;

    if (!id) {
      return writeError(res, 400, 'Tenant ID is required');
    }

    const result = await service.updateTenantNotes(id, notes || '', user);
    writeSuccess(res, 200, 'Tenant notes updated successfully', result);
  } catch (error: any) {
    const message = error.message || 'Failed to update tenant notes';
    const status = message.includes('not found') ? 404 :
                  message.includes('permissions') ? 403 : 500;
    writeError(res, status, message);
  }
};
