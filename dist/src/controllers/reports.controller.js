import { reportsService } from '../services/reports.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
export const reportsController = {
    getReports: async (req, res) => {
        try {
            const user = req.user;
            const { type, period = 'monthly' } = req.query;
            const reports = await reportsService.getReports(user, type, period);
            writeSuccess(res, 200, 'Reports retrieved successfully', reports);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getPropertyReport: async (req, res) => {
        try {
            const user = req.user;
            const filters = req.query;
            const report = await reportsService.getPropertyReport(user, filters);
            writeSuccess(res, 200, 'Property report generated successfully', report);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getFinancialReport: async (req, res) => {
        try {
            const user = req.user;
            const { type, period = 'monthly' } = req.query;
            const report = await reportsService.getFinancialReport(user, type, period);
            writeSuccess(res, 200, 'Financial report generated successfully', report);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getOccupancyReport: async (req, res) => {
        try {
            const user = req.user;
            const { period = 'monthly' } = req.query;
            const report = await reportsService.getOccupancyReport(user, period);
            writeSuccess(res, 200, 'Occupancy report generated successfully', report);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getRentCollectionReport: async (req, res) => {
        try {
            const user = req.user;
            const filters = req.query;
            const report = await reportsService.getRentCollectionReport(user, filters);
            writeSuccess(res, 200, 'Rent collection report generated successfully', report);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getMaintenanceReport: async (req, res) => {
        try {
            const user = req.user;
            const { period = 'monthly', status, priority } = req.query;
            const filters = {
                ...(status && { status: status }),
                ...(priority && { priority: priority }),
            };
            const report = await reportsService.getMaintenanceReport(user, period, filters);
            writeSuccess(res, 200, 'Maintenance report generated successfully', report);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    exportReport: async (req, res) => {
        try {
            const user = req.user;
            const { type } = req.params;
            const { format = 'csv', ...filters } = req.query;
            const exportData = await reportsService.exportReport(user, type, format, filters);
            // Set appropriate headers for file download
            const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.${format}`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
            res.send(exportData);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
};
