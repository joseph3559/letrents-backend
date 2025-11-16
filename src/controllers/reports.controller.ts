import { Request, Response } from 'express';
import { reportsService } from '../services/reports.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export const reportsController = {
  getReports: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { type, period = 'monthly', property_ids } = req.query;
      
      console.log('📊 getReports - User:', { role: user.role, company_id: user.company_id, user_id: user.user_id });
      console.log('📊 getReports - Query params:', { type, period, property_ids });
      
      // Convert property_ids query param to string array
      let propertyIdsArray: string[] | undefined = undefined;
      if (property_ids) {
        if (typeof property_ids === 'string') {
          propertyIdsArray = property_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
        } else if (Array.isArray(property_ids)) {
          propertyIdsArray = property_ids.map(id => String(id)).filter(id => id.length > 0);
        }
        console.log('📊 Parsed propertyIdsArray:', propertyIdsArray);
      } else {
        console.log('⚠️ No property_ids in query params');
      }
      
      const reports = await reportsService.getReports(user, type as string, period as string, propertyIdsArray);
      writeSuccess(res, 200, 'Reports retrieved successfully', reports);
    } catch (error: any) {
      console.error('❌ Error in getReports:', error);
      console.error('❌ Error stack:', error.stack);
      writeError(res, 500, error.message || 'Failed to retrieve reports');
    }
  },

  getPropertyReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const filters = req.query;
      const report = await reportsService.getPropertyReport(user, filters);
      writeSuccess(res, 200, 'Property report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getFinancialReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { type, period = 'monthly', property_ids } = req.query;
      
      // Convert property_ids query param to string array
      let propertyIdsArray: string[] | undefined = undefined;
      if (property_ids) {
        if (typeof property_ids === 'string') {
          propertyIdsArray = property_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
        } else if (Array.isArray(property_ids)) {
          propertyIdsArray = property_ids.map(id => String(id)).filter(id => id.length > 0);
        }
      }
      
      const report = await reportsService.getFinancialReport(user, type as string, period as string, propertyIdsArray);
      writeSuccess(res, 200, 'Financial report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getOccupancyReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { period = 'monthly', property_ids } = req.query;
      
      // Convert property_ids query param to string array
      let propertyIdsArray: string[] | undefined = undefined;
      if (property_ids) {
        if (typeof property_ids === 'string') {
          propertyIdsArray = property_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
        } else if (Array.isArray(property_ids)) {
          propertyIdsArray = property_ids.map(id => String(id)).filter(id => id.length > 0);
        }
      }
      
      const report = await reportsService.getOccupancyReport(user, period as string, propertyIdsArray);
      writeSuccess(res, 200, 'Occupancy report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getRentCollectionReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const filters = req.query;
      const report = await reportsService.getRentCollectionReport(user, filters);
      writeSuccess(res, 200, 'Rent collection report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getMaintenanceReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { period = 'monthly', status, priority, property_ids } = req.query;
      
      // Convert property_ids query param to string array
      let propertyIdsArray: string[] | undefined = undefined;
      if (property_ids) {
        if (typeof property_ids === 'string') {
          propertyIdsArray = property_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
        } else if (Array.isArray(property_ids)) {
          propertyIdsArray = property_ids.map(id => String(id)).filter(id => id.length > 0);
        }
      }
      
      const filters = {
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
        ...(propertyIdsArray && propertyIdsArray.length > 0 && { property_ids: propertyIdsArray }),
      };
      const report = await reportsService.getMaintenanceReport(user, period as string, filters, propertyIdsArray);
      writeSuccess(res, 200, 'Maintenance report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  exportReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { type } = req.params;
      const { format = 'csv', ...filters } = req.query;
      
      const exportData = await reportsService.exportReport(user, type, format as string, filters);
      
      // Set appropriate headers for file download
      const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      
      res.send(exportData);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },
};
