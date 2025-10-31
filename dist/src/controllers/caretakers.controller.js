import { careteakersService, staffService } from '../services/staff.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
export const careteakersController = {
    getCaretakers: async (req, res) => {
        try {
            const user = req.user;
            console.log('🎯 GET /caretakers controller hit');
            console.log('  JWT User:', user);
            const filters = req.query;
            const caretakers = await careteakersService.getCaretakers(user, filters);
            console.log('  Returning:', caretakers.length, 'caretakers');
            writeSuccess(res, 200, 'Caretakers retrieved successfully', caretakers);
        }
        catch (error) {
            console.error('❌ Error in getCaretakers controller:', error);
            writeError(res, 500, error.message);
        }
    },
    createCaretaker: async (req, res) => {
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
    getCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const caretaker = await careteakersService.getCaretaker(user, id);
            if (!caretaker) {
                return writeError(res, 404, 'Caretaker not found');
            }
            writeSuccess(res, 200, 'Caretaker retrieved successfully', caretaker);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    updateCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;
            const caretaker = await careteakersService.updateCaretaker(user, id, updateData);
            writeSuccess(res, 200, 'Caretaker updated successfully', caretaker);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    deleteCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            await careteakersService.deleteCaretaker(user, id);
            writeSuccess(res, 200, 'Caretaker deleted successfully');
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    inviteCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const result = await careteakersService.inviteCaretaker(user, id);
            writeSuccess(res, 200, 'Caretaker invitation sent successfully', result);
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
