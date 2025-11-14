import { careteakersService, staffService } from '../services/staff.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
export const staffController = {
    getStaff: async (req, res) => {
        try {
            const user = req.user;
            console.log('🎯 GET /staff controller hit');
            console.log('  JWT User:', user);
            // Parse property_ids (comma-separated) for super-admin filtering
            let propertyIds = undefined;
            if (req.query.property_ids) {
                const propertyIdsParam = req.query.property_ids;
                propertyIds = propertyIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
                console.log('🔍 Parsed property_ids from query:', propertyIds);
            }
            const filters = { ...req.query };
            if (propertyIds) {
                filters.property_ids = propertyIds;
            }
            // Extract company_id from query if provided (for filtering caretakers by property's company)
            if (req.query.company_id) {
                filters.company_id = req.query.company_id;
            }
            const staff = await careteakersService.getCaretakers(user, filters); // Uses the updated method that fetches all staff
            console.log('  Returning:', staff.length, 'staff members');
            writeSuccess(res, 200, 'Staff retrieved successfully', staff);
        }
        catch (error) {
            console.error('❌ Error in getStaff controller:', error);
            writeError(res, 500, error.message);
        }
    },
    createStaff: async (req, res) => {
        try {
            const user = req.user;
            const staffData = req.body;
            // Use staffService directly with role from request body
            const role = staffData.role || 'caretaker'; // Fallback to caretaker if no role specified
            console.log(`📝 Creating staff member with role: ${role}`);
            const staff = await staffService.createStaffMember(user, role, staffData);
            writeSuccess(res, 201, 'Staff member created successfully', staff);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getStaffMember: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const staffMember = await careteakersService.getCaretaker(user, id);
            if (!staffMember) {
                return writeError(res, 404, 'Staff member not found');
            }
            writeSuccess(res, 200, 'Staff member retrieved successfully', staffMember);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    updateStaff: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;
            const staffMember = await careteakersService.updateCaretaker(user, id, updateData);
            writeSuccess(res, 200, 'Staff member updated successfully', staffMember);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    deleteStaff: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            await careteakersService.deleteCaretaker(user, id);
            writeSuccess(res, 200, 'Staff member deleted successfully');
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    inviteStaff: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const result = await careteakersService.inviteCaretaker(user, id);
            writeSuccess(res, 200, 'Staff member invitation sent successfully', result);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    resetPassword: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const result = await careteakersService.resetPassword(user, id);
            writeSuccess(res, 200, 'Password reset initiated successfully', result);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
};
// Keep caretakers controller as backward-compatible alias
export const careteakersController = staffController;
