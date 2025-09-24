import { PropertiesService } from '../services/properties.service.js';
import { UnitsService } from '../services/units.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const service = new PropertiesService();
const unitsService = new UnitsService();
export const createProperty = async (req, res) => {
    try {
        const user = req.user;
        const propertyData = req.body;
        // Validate required fields
        if (!propertyData.name || !propertyData.type || !propertyData.street || !propertyData.city ||
            !propertyData.region || !propertyData.country || !propertyData.ownership_type ||
            !propertyData.owner_id || propertyData.number_of_units === undefined) {
            return writeError(res, 400, 'Missing required fields');
        }
        const property = await service.createProperty(propertyData, user);
        writeSuccess(res, 201, 'Property created successfully', property);
    }
    catch (error) {
        const message = error.message || 'Failed to create property';
        const status = message.includes('permissions') ? 403 :
            message.includes('company') ? 400 : 500;
        writeError(res, status, message);
    }
};
export const getProperty = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const property = await service.getProperty(id, user);
        writeSuccess(res, 200, 'Property retrieved successfully', property);
    }
    catch (error) {
        const message = error.message || 'Failed to get property';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const updateProperty = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const property = await service.updateProperty(id, updateData, user);
        writeSuccess(res, 200, 'Property updated successfully', property);
    }
    catch (error) {
        const message = error.message || 'Failed to update property';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const deleteProperty = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const { force } = req.query;
        await service.deleteProperty(id, user, force === 'true');
        writeSuccess(res, 200, 'Property deleted successfully');
    }
    catch (error) {
        const message = error.message || 'Failed to delete property';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('occupied units') ? 409 : 500;
        writeError(res, status, message);
    }
};
export const listProperties = async (req, res) => {
    try {
        const user = req.user;
        // Parse query parameters
        const filters = {
            owner_id: req.query.owner_id,
            agency_id: req.query.agency_id,
            company_id: req.query.company_id,
            type: req.query.type,
            status: req.query.status,
            city: req.query.city,
            region: req.query.region,
            country: req.query.country,
            min_units: req.query.min_units ? parseInt(req.query.min_units) : undefined,
            max_units: req.query.max_units ? parseInt(req.query.max_units) : undefined,
            year_built_min: req.query.year_built_min ? parseInt(req.query.year_built_min) : undefined,
            year_built_max: req.query.year_built_max ? parseInt(req.query.year_built_max) : undefined,
            amenities: req.query.amenities ? (Array.isArray(req.query.amenities) ? req.query.amenities : [req.query.amenities]) : undefined,
            search_query: req.query.search,
            sort_by: req.query.sort_by,
            sort_order: req.query.sort_order,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) :
                req.query.page ? (parseInt(req.query.page) - 1) * (req.query.limit ? parseInt(req.query.limit) : 20) : 0,
        };
        const result = await service.listProperties(filters, user);
        writeSuccess(res, 200, 'Properties retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to list properties';
        writeError(res, 500, message);
    }
};
export const getPropertyUnits = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        // Parse query parameters for units filtering
        const filters = {
            property_id: id,
            status: req.query.status,
            unit_type: req.query.unit_type,
            condition: req.query.condition,
            furnishing_type: req.query.furnishing_type,
            min_rent: req.query.min_rent ? parseFloat(req.query.min_rent) : undefined,
            max_rent: req.query.max_rent ? parseFloat(req.query.max_rent) : undefined,
            min_bedrooms: req.query.min_bedrooms ? parseInt(req.query.min_bedrooms) : undefined,
            max_bedrooms: req.query.max_bedrooms ? parseInt(req.query.max_bedrooms) : undefined,
            has_parking: req.query.has_parking ? req.query.has_parking === 'true' : undefined,
            has_balcony: req.query.has_balcony ? req.query.has_balcony === 'true' : undefined,
            search_query: req.query.search,
            sort_by: req.query.sort_by,
            sort_order: req.query.sort_order,
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) :
                req.query.page ? (parseInt(req.query.page) - 1) * (req.query.limit ? parseInt(req.query.limit) : 20) : 0,
        };
        const result = await unitsService.listUnits(filters, user);
        writeSuccess(res, 200, 'Property units retrieved successfully', result);
    }
    catch (error) {
        const message = error.message || 'Failed to get property units';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const getPropertyAnalytics = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const analytics = await service.getPropertyAnalytics(id, user);
        writeSuccess(res, 200, 'Property analytics retrieved successfully', analytics);
    }
    catch (error) {
        const message = error.message || 'Failed to get property analytics';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const duplicateProperty = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const duplicatedProperty = await service.duplicateProperty(id, user);
        writeSuccess(res, 201, 'Property duplicated successfully', duplicatedProperty);
    }
    catch (error) {
        const message = error.message || 'Failed to duplicate property';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 : 500;
        writeError(res, status, message);
    }
};
export const updatePropertyStatus = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { status } = req.body;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        if (!status) {
            return writeError(res, 400, 'Status is required');
        }
        const updatedProperty = await service.updatePropertyStatus(id, status, user);
        writeSuccess(res, 200, 'Property status updated successfully', updatedProperty);
    }
    catch (error) {
        const message = error.message || 'Failed to update property status';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('invalid status') ? 400 : 500;
        writeError(res, status, message);
    }
};
export const archiveProperty = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!id) {
            return writeError(res, 400, 'Property ID is required');
        }
        const archivedProperty = await service.archiveProperty(id, user);
        writeSuccess(res, 200, 'Property archived successfully', archivedProperty);
    }
    catch (error) {
        const message = error.message || 'Failed to archive property';
        const status = message.includes('not found') ? 404 :
            message.includes('permissions') ? 403 :
                message.includes('occupied units') ? 409 : 500;
        writeError(res, status, message);
    }
};
