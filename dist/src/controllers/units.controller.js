import { UnitsService } from '../services/units.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new UnitsService();
export const createUnit = async (req, res) => {
    try {
        const user = req.user;
        const unitData = req.body;
        // Validate required fields
        if (!unitData.property_id || !unitData.unit_number || !unitData.unit_type ||
            unitData.rent_amount === undefined || unitData.deposit_amount === undefined) {
            return writeError(res, 400, 'Missing required fields');
        }
        const unit = await service.createUnit(unitData, user);
        writeSuccess(res, 201, 'Unit created successfully', unit);
    }
    catch (error) {
        const message = error.message || 'Failed to create unit';
        const status = message.includes('permissions') ? 403 :
            message.includes('not found') ? 404 :
                message.includes('already exists') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const createUnits = async (req, res) => {
    try {
        const user = req.user;
        const unitsData = req.body;
        if (!unitsData.units || !Array.isArray(unitsData.units) || unitsData.units.length === 0) {
            return writeError(res, 400, 'Units array is required and must not be empty');
        }
        const units = await service.createUnits(unitsData, user);
        writeSuccess(res, 201, 'Units created successfully', units);
    }
    catch (error) {
        const message = error.message || 'Failed to create units';
        const status = message.includes('permissions') ? 403 :
            message.includes('not found') ? 404 :
                message.includes('already exists') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const getUnit = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        const unit = await service.getUnit(id, user);
        writeSuccess(res, 200, 'Unit retrieved successfully', unit);
    }
    catch (error) {
        const message = error.message || 'Failed to get unit';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const getUnitFinancials = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        const financials = await service.getUnitFinancials(id, user);
        writeSuccess(res, 200, 'Unit financials retrieved successfully', financials);
    }
    catch (error) {
        const message = error.message || 'Failed to get unit financials';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const updateUnit = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        const unit = await service.updateUnit(id, updateData, user);
        writeSuccess(res, 200, 'Unit updated successfully', unit);
    }
    catch (error) {
        const message = error.message || 'Failed to update unit';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('already exists') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const deleteUnit = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        await service.deleteUnit(id, user);
        writeSuccess(res, 200, 'Unit deleted successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to delete unit';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('occupied') || message.includes('reserved') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const listUnits = async (req, res) => {
    try {
        const user = req.user;
        // Parse query parameters
        const filters = {
            property_id: req.query.property_id,
            unit_type: req.query.unit_type,
            status: req.query.status,
            condition: req.query.condition,
            furnishing_type: req.query.furnishing_type,
            min_rent: req.query.min_rent ? parseFloat(req.query.min_rent) : undefined,
            max_rent: req.query.max_rent ? parseFloat(req.query.max_rent) : undefined,
            min_bedrooms: req.query.min_bedrooms ? parseInt(req.query.min_bedrooms) : undefined,
            max_bedrooms: req.query.max_bedrooms ? parseInt(req.query.max_bedrooms) : undefined,
            min_bathrooms: req.query.min_bathrooms ? parseInt(req.query.min_bathrooms) : undefined,
            max_bathrooms: req.query.max_bathrooms ? parseInt(req.query.max_bathrooms) : undefined,
            has_ensuite: req.query.has_ensuite ? req.query.has_ensuite === 'true' : undefined,
            has_balcony: req.query.has_balcony ? req.query.has_balcony === 'true' : undefined,
            has_parking: req.query.has_parking ? req.query.has_parking === 'true' : undefined,
            min_size: req.query.min_size ? parseFloat(req.query.min_size) : undefined,
            max_size: req.query.max_size ? parseFloat(req.query.max_size) : undefined,
            amenities: req.query.amenities ? (Array.isArray(req.query.amenities) ? req.query.amenities : [req.query.amenities]) : undefined,
            appliances: req.query.appliances ? (Array.isArray(req.query.appliances) ? req.query.appliances : [req.query.appliances]) : undefined,
            available_from: req.query.available_from,
            lease_type: req.query.lease_type,
            current_tenant_id: req.query.current_tenant_id,
            block_number: req.query.block_number,
            floor_number: req.query.floor_number ? parseInt(req.query.floor_number) : undefined,
            search_query: req.query.search,
            sort_by: req.query.sort_by,
            sort_order: req.query.sort_order,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) :
                req.query.page ? (parseInt(req.query.page) - 1) * (req.query.limit ? parseInt(req.query.limit) : 20) : 0,
        };
        const result = await service.listUnits(filters, user);
        writeSuccess(res, 200, 'Units retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to list units';
        writeError(res, 500, message);
    }
};
export const updateUnitStatus = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { status } = req.body;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        if (!status) {
            return writeError(res, 400, 'Status is required');
        }
        await service.updateUnitStatus(id, status, user);
        writeSuccess(res, 200, 'Unit status updated successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to update unit status';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const assignTenant = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const assignmentData = req.body;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        if (!assignmentData.tenant_id || !assignmentData.lease_start_date ||
            !assignmentData.lease_end_date || !assignmentData.lease_type) {
            return writeError(res, 400, 'Missing required assignment fields');
        }
        const fullRequest = {
            unit_id: id,
            ...assignmentData,
        };
        await service.assignTenant(fullRequest, user);
        writeSuccess(res, 200, 'Tenant assigned successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to assign tenant';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('not available') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const releaseTenant = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Unit ID is required');
        }
        await service.releaseTenant(id, user);
        writeSuccess(res, 200, 'Tenant released successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to release tenant';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('does not have') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const cleanupDuplicateTenantAssignments = async (req, res) => {
    try {
        const user = req.user;
        const result = await service.cleanupDuplicateTenantAssignments(user);
        writeSuccess(res, 200, 'Duplicate tenant assignments cleaned up successfully', {
            tenantsAffected: result.tenantsAffected,
            unitsCleared: result.unitsCleared,
            details: result.details
        });
    }
    catch (error) {
        const message = error.message || 'Failed to cleanup duplicate tenant assignments';
        const status = message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const searchAvailableUnits = async (req, res) => {
    try {
        // Parse query parameters (similar to listUnits but for available units only)
        const filters = {
            property_id: req.query.property_id,
            unit_type: req.query.unit_type,
            min_rent: req.query.min_rent ? parseFloat(req.query.min_rent) : undefined,
            max_rent: req.query.max_rent ? parseFloat(req.query.max_rent) : undefined,
            min_bedrooms: req.query.min_bedrooms ? parseInt(req.query.min_bedrooms) : undefined,
            max_bedrooms: req.query.max_bedrooms ? parseInt(req.query.max_bedrooms) : undefined,
            furnishing_type: req.query.furnishing_type,
            has_parking: req.query.has_parking ? req.query.has_parking === 'true' : undefined,
            has_balcony: req.query.has_balcony ? req.query.has_balcony === 'true' : undefined,
            search_query: req.query.search,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) :
                req.query.page ? (parseInt(req.query.page) - 1) * (req.query.limit ? parseInt(req.query.limit) : 20) : 0,
        };
        const result = await service.searchAvailableUnits(filters);
        writeSuccess(res, 200, 'Available units retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to search available units';
        writeError(res, 500, message);
    }
};
