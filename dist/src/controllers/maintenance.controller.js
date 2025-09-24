import { MaintenanceService } from '../services/maintenance.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new MaintenanceService();
export const createMaintenanceRequest = async (req, res) => {
    try {
        const user = req.user;
        const requestData = req.body;
        // Validate required fields
        if (!requestData.title || !requestData.description) {
            return writeError(res, 400, 'Title and description are required');
        }
        const maintenanceRequest = await service.createMaintenanceRequest(requestData, user);
        writeSuccess(res, 201, 'Maintenance request created successfully', maintenanceRequest);
    }
    catch (error) {
        const message = error.message || 'Failed to create maintenance request';
        writeError(res, 500, message);
    }
};
export const getMaintenanceRequest = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Maintenance request ID is required');
        }
        const maintenanceRequest = await service.getMaintenanceRequest(id, user);
        writeSuccess(res, 200, 'Maintenance request retrieved successfully', maintenanceRequest);
    }
    catch (error) {
        const message = error.message || 'Failed to get maintenance request';
        const status = message.includes('not found') ? 404 : 500;
        writeError(res, status, message);
    }
};
export const listMaintenanceRequests = async (req, res) => {
    try {
        const user = req.user;
        // Parse query parameters
        const filters = {
            property_id: req.query.property_id,
            unit_id: req.query.unit_id,
            tenant_id: req.query.tenant_id,
            category: req.query.category,
            priority: req.query.priority,
            status: req.query.status,
            search_query: req.query.search,
            sort_by: req.query.sort_by,
            sort_order: req.query.sort_order,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) :
                req.query.page ? (parseInt(req.query.page) - 1) * (req.query.limit ? parseInt(req.query.limit) : 20) : 0,
        };
        const result = await service.listMaintenanceRequests(filters, user);
        writeSuccess(res, 200, 'Maintenance requests retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to list maintenance requests';
        writeError(res, 500, message);
    }
};
export const updateMaintenanceRequest = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            return writeError(res, 400, 'Maintenance request ID is required');
        }
        const maintenanceRequest = await service.updateMaintenanceRequest(id, updateData, user);
        writeSuccess(res, 200, 'Maintenance request updated successfully', maintenanceRequest);
    }
    catch (error) {
        const message = error.message || 'Failed to update maintenance request';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const deleteMaintenanceRequest = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Maintenance request ID is required');
        }
        await service.deleteMaintenanceRequest(id, user);
        writeSuccess(res, 200, 'Maintenance request deleted successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to delete maintenance request';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const getMaintenanceOverview = async (req, res) => {
    try {
        const user = req.user;
        const overview = await service.getMaintenanceOverview(user);
        writeSuccess(res, 200, 'Maintenance overview retrieved successfully', overview);
    }
    catch (error) {
        const message = error.message || 'Failed to get maintenance overview';
        writeError(res, 500, message);
    }
};
