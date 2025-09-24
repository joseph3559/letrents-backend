import { Router } from 'express';
import { propertyStaffController } from '../controllers/property-staff.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Property staff management routes
router.get('/:propertyId/staff', rbacResource('staff', 'read'), propertyStaffController.getPropertyStaff);
router.post('/:propertyId/staff', rbacResource('staff', 'create'), propertyStaffController.assignStaffToProperty);
router.put('/:propertyId/staff/:staffId', rbacResource('staff', 'update'), propertyStaffController.updatePropertyStaff);
router.delete('/:propertyId/staff/:staffId', rbacResource('staff', 'delete'), propertyStaffController.removeStaffFromProperty);

export default router;
