import { careteakersService } from '../services/caretakers.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
export const careteakersController = {
    getCaretakers: async (req, res) => {
        try {
            const user = req.user;
            const filters = req.query;
            const caretakers = await careteakersService.getCaretakers(user, filters);
            writeSuccess(res, 200, 'Caretakers retrieved successfully', caretakers);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    createCaretaker: async (req, res) => {
        try {
            const user = req.user;
            const caretakerData = req.body;
            const caretaker = await careteakersService.createCaretaker(user, caretakerData);
            writeSuccess(res, 201, 'Caretaker created successfully', caretaker);
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
