import { Router } from 'express';
import { propertyCaretakersController } from '../controllers/property-caretakers.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Get caretaker assigned to a property
router.get('/:propertyId/caretaker', rbacResource('properties', 'read'), propertyCaretakersController.getPropertyCaretaker);

// Assign caretaker to a property
router.post('/:propertyId/caretaker', rbacResource('properties', 'update'), propertyCaretakersController.assignCaretakerToProperty);

// Remove caretaker from property
router.delete('/:propertyId/caretaker', rbacResource('properties', 'update'), propertyCaretakersController.removeCaretakerFromProperty);

export default router;
