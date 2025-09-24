import { Request, Response } from 'express';

// Extend Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
import { LeasesService, CreateLeaseRequest, UpdateLeaseRequest, LeaseFilters } from '../services/leases.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export class LeasesController {
  private leasesService = new LeasesService();

  createLease = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const leaseData: CreateLeaseRequest = req.body;

      // Validate required fields
      const requiredFields = ['tenant_id', 'unit_id', 'property_id', 'start_date', 'end_date', 'rent_amount', 'deposit_amount'];
      const missingFields = requiredFields.filter(field => !leaseData[field as keyof CreateLeaseRequest]);
      
      if (missingFields.length > 0) {
        writeError(res, 400, `Missing required fields: ${missingFields.join(', ')}`);
        return;
      }

      const lease = await this.leasesService.createLease(leaseData, user);
      writeSuccess(res, 201, 'Lease created successfully', lease);
    } catch (error: any) {
      console.error('Error creating lease:', error);
      writeError(res, 400, error.message || 'Failed to create lease');
    }
  };

  getLease = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { id } = req.params;

      if (!id) {
        writeError(res, 400, 'Lease ID is required');
        return;
      }

      const lease = await this.leasesService.getLease(id, user);
      writeSuccess(res, 200, 'Lease retrieved successfully', lease);
    } catch (error: any) {
      console.error('Error getting lease:', error);
      if (error.message === 'lease not found') {
        writeError(res, 404, 'Lease not found');
      } else if (error.message.includes('insufficient permissions')) {
        writeError(res, 403, error.message);
      } else {
        writeError(res, 500, 'Failed to retrieve lease');
      }
    }
  };

  updateLease = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { id } = req.params;
      const updateData: UpdateLeaseRequest = req.body;

      if (!id) {
        writeError(res, 400, 'Lease ID is required');
        return;
      }

      const lease = await this.leasesService.updateLease(id, updateData, user);
      writeSuccess(res, 200, 'Lease updated successfully', lease);
    } catch (error: any) {
      console.error('Error updating lease:', error);
      if (error.message === 'lease not found') {
        writeError(res, 404, 'Lease not found');
      } else if (error.message.includes('insufficient permissions')) {
        writeError(res, 403, error.message);
      } else {
        writeError(res, 400, error.message || 'Failed to update lease');
      }
    }
  };

  listLeases = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      
      // Parse query parameters
      const filters: LeaseFilters = {
        tenant_id: req.query.tenant_id as string,
        unit_id: req.query.unit_id as string,
        property_id: req.query.property_id as string,
        status: req.query.status as string,
        lease_type: req.query.lease_type as string,
        start_date_from: req.query.start_date_from as string,
        start_date_to: req.query.start_date_to as string,
        end_date_from: req.query.end_date_from as string,
        end_date_to: req.query.end_date_to as string,
        search_query: req.query.search_query as string,
        sort_by: req.query.sort_by as string,
        sort_order: req.query.sort_order as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof LeaseFilters] === undefined) {
          delete filters[key as keyof LeaseFilters];
        }
      });

      const result = await this.leasesService.listLeases(filters, user);
      writeSuccess(res, 200, 'Leases retrieved successfully', result);
    } catch (error: any) {
      console.error('Error listing leases:', error);
      writeError(res, 500, 'Failed to retrieve leases');
    }
  };

  terminateLease = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { id } = req.params;
      const { termination_reason } = req.body;

      if (!id) {
        writeError(res, 400, 'Lease ID is required');
        return;
      }

      if (!termination_reason) {
        writeError(res, 400, 'Termination reason is required');
        return;
      }

      const lease = await this.leasesService.terminateLease(id, termination_reason, user);
      writeSuccess(res, 200, 'Lease terminated successfully', lease);
    } catch (error: any) {
      console.error('Error terminating lease:', error);
      if (error.message === 'lease not found') {
        writeError(res, 404, 'Lease not found');
      } else if (error.message.includes('insufficient permissions')) {
        writeError(res, 403, error.message);
      } else {
        writeError(res, 400, error.message || 'Failed to terminate lease');
      }
    }
  };

  renewLease = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { id } = req.params;
      const renewalData: CreateLeaseRequest = req.body;

      if (!id) {
        writeError(res, 400, 'Lease ID is required');
        return;
      }

      // Validate required fields for renewal
      const requiredFields = ['start_date', 'end_date', 'rent_amount', 'deposit_amount'];
      const missingFields = requiredFields.filter(field => !renewalData[field as keyof CreateLeaseRequest]);
      
      if (missingFields.length > 0) {
        writeError(res, 400, `Missing required fields for renewal: ${missingFields.join(', ')}`);
        return;
      }

      const newLease = await this.leasesService.renewLease(id, renewalData, user);
      writeSuccess(res, 201, 'Lease renewed successfully', newLease);
    } catch (error: any) {
      console.error('Error renewing lease:', error);
      if (error.message === 'lease not found') {
        writeError(res, 404, 'Lease not found');
      } else if (error.message.includes('insufficient permissions')) {
        writeError(res, 403, error.message);
      } else {
        writeError(res, 400, error.message || 'Failed to renew lease');
      }
    }
  };

  // Additional utility endpoints

  getLeaseHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { unit_id } = req.params;

      if (!unit_id) {
        writeError(res, 400, 'Unit ID is required');
        return;
      }

      const filters: LeaseFilters = {
        unit_id,
        sort_by: 'start_date',
        sort_order: 'desc',
      };

      const result = await this.leasesService.listLeases(filters, user);
      writeSuccess(res, 200, 'Lease history retrieved successfully', result);
    } catch (error: any) {
      console.error('Error getting lease history:', error);
      writeError(res, 500, 'Failed to retrieve lease history');
    }
  };

  getTenantLeases = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const { tenant_id } = req.params;

      if (!tenant_id) {
        writeError(res, 400, 'Tenant ID is required');
        return;
      }

      const filters: LeaseFilters = {
        tenant_id,
        sort_by: 'start_date',
        sort_order: 'desc',
      };

      const result = await this.leasesService.listLeases(filters, user);
      writeSuccess(res, 200, 'Tenant leases retrieved successfully', result);
    } catch (error: any) {
      console.error('Error getting tenant leases:', error);
      writeError(res, 500, 'Failed to retrieve tenant leases');
    }
  };

  getExpiringLeases = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      const daysAhead = req.query.days ? parseInt(req.query.days as string) : 30;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);

      const filters: LeaseFilters = {
        status: 'active',
        end_date_to: endDate.toISOString().split('T')[0],
        sort_by: 'end_date',
        sort_order: 'asc',
      };

      const result = await this.leasesService.listLeases(filters, user);
      writeSuccess(res, 200, 'Expiring leases retrieved successfully', result);
    } catch (error: any) {
      console.error('Error getting expiring leases:', error);
      writeError(res, 500, 'Failed to retrieve expiring leases');
    }
  };

  createLeasesForExistingTenants = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user as JWTClaims;
      
      // Check permissions - only landlords and above can create bulk leases
      if (!['super_admin', 'agency_admin', 'landlord'].includes(user.role)) {
        return writeError(res, 403, 'Insufficient permissions to create leases for existing tenants');
      }

      const result = await this.leasesService.createLeasesForExistingTenants(user);
      writeSuccess(res, 200, 'Leases created for existing tenants successfully', result);
    } catch (error: any) {
      console.error('Error creating leases for existing tenants:', error);
      const message = error.message || 'Failed to create leases for existing tenants';
      writeError(res, 500, message);
    }
  };
}