import { Request, Response } from 'express';
import { reportsService } from '../services/reports.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export const reportsController = {
  getReports: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { type, period = 'monthly' } = req.query;
      const reports = await reportsService.getReports(user, type as string, period as string);
      writeSuccess(res, 200, 'Reports retrieved successfully', reports);
    } catch (error: any) {
      writeError(res, 500, error.message);
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
      const { type, period = 'monthly' } = req.query;
      const report = await reportsService.getFinancialReport(user, type as string, period as string);
      writeSuccess(res, 200, 'Financial report generated successfully', report);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getOccupancyReport: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { period = 'monthly' } = req.query;
      const report = await reportsService.getOccupancyReport(user, period as string);
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
      const { period = 'monthly', status, priority } = req.query;
      const filters = {
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
      };
      const report = await reportsService.getMaintenanceReport(user, period as string, filters);
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
