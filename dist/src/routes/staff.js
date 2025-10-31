import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { staffController } from '../controllers/staff.controller.js';
import { requireCompanyContext } from '../middleware/companyContext.js';
const router = Router();
// Apply authentication to all staff routes
router.use(requireAuth);
// CRUD operations for staff (all roles: caretaker, cleaner, security, etc.)
router.get('/', rbacResource('staff', 'read'), staffController.getStaff);
// Require company context for creating staff members
router.post('/', requireCompanyContext, rbacResource('staff', 'create'), staffController.createStaff);
router.get('/:id', rbacResource('staff', 'read'), staffController.getStaffMember);
router.put('/:id', rbacResource('staff', 'update'), staffController.updateStaff);
router.delete('/:id', rbacResource('staff', 'delete'), staffController.deleteStaff);
// Additional actions
router.post('/:id/invite', rbacResource('staff', 'update'), staffController.inviteStaff);
router.post('/:id/reset-password', rbacResource('staff', 'update'), staffController.resetPassword);
export default router;
