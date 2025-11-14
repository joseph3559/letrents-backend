import { Router } from 'express';
import { EmergencyContactsController } from '../controllers/emergency-contacts.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
const emergencyContactsController = new EmergencyContactsController();
// Emergency contacts CRUD
router.get('/', rbacResource('emergency', 'read'), emergencyContactsController.getEmergencyContacts);
router.get('/:id', rbacResource('emergency', 'read'), emergencyContactsController.getEmergencyContact);
router.post('/', rbacResource('emergency', 'create'), emergencyContactsController.createEmergencyContact);
router.put('/:id', rbacResource('emergency', 'update'), emergencyContactsController.updateEmergencyContact);
router.delete('/:id', rbacResource('emergency', 'delete'), emergencyContactsController.deleteEmergencyContact);
export default router;
