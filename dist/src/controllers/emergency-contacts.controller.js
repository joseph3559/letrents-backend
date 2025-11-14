import { EmergencyContactsService } from '../services/emergency-contacts.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
const emergencyContactsService = new EmergencyContactsService();
export class EmergencyContactsController {
    /**
     * GET /api/v1/emergency-contacts
     * Get all emergency contacts
     */
    getEmergencyContacts = async (req, res) => {
        try {
            const user = req.user;
            const filters = {
                agencyId: req.query.agencyId,
                property_id: req.query.property_id,
                search: req.query.search
            };
            const contacts = await emergencyContactsService.getEmergencyContacts(user, filters);
            writeSuccess(res, 200, 'Emergency contacts retrieved successfully', contacts);
        }
        catch (error) {
            console.error('❌ Error getting emergency contacts:', error);
            writeError(res, 500, error.message || 'Failed to retrieve emergency contacts');
        }
    };
    /**
     * GET /api/v1/emergency-contacts/:id
     * Get a single emergency contact by ID
     */
    getEmergencyContact = async (req, res) => {
        try {
            const user = req.user;
            const contact = await emergencyContactsService.getEmergencyContact(req.params.id, user);
            writeSuccess(res, 200, 'Emergency contact retrieved successfully', contact);
        }
        catch (error) {
            console.error('❌ Error getting emergency contact:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 500;
            writeError(res, statusCode, error.message || 'Failed to retrieve emergency contact');
        }
    };
    /**
     * POST /api/v1/emergency-contacts
     * Create a new emergency contact
     */
    createEmergencyContact = async (req, res) => {
        try {
            const user = req.user;
            const contact = await emergencyContactsService.createEmergencyContact(req.body, user);
            writeSuccess(res, 201, 'Emergency contact created successfully', contact);
        }
        catch (error) {
            console.error('❌ Error creating emergency contact:', error);
            const statusCode = error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to create emergency contact');
        }
    };
    /**
     * PUT /api/v1/emergency-contacts/:id
     * Update an emergency contact
     */
    updateEmergencyContact = async (req, res) => {
        try {
            const user = req.user;
            const contact = await emergencyContactsService.updateEmergencyContact(req.params.id, req.body, user);
            writeSuccess(res, 200, 'Emergency contact updated successfully', contact);
        }
        catch (error) {
            console.error('❌ Error updating emergency contact:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to update emergency contact');
        }
    };
    /**
     * DELETE /api/v1/emergency-contacts/:id
     * Delete an emergency contact
     */
    deleteEmergencyContact = async (req, res) => {
        try {
            const user = req.user;
            await emergencyContactsService.deleteEmergencyContact(req.params.id, user);
            writeSuccess(res, 200, 'Emergency contact deleted successfully', null);
        }
        catch (error) {
            console.error('❌ Error deleting emergency contact:', error);
            const statusCode = error.message.includes('not found') ? 404 : error.message.includes('permissions') ? 403 : 400;
            writeError(res, statusCode, error.message || 'Failed to delete emergency contact');
        }
    };
}
