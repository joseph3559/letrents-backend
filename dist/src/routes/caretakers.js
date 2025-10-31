import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { careteakersController } from '../controllers/caretakers.controller.js';
import { requireCompanyContext } from '../middleware/companyContext.js';
const router = Router();
// Apply authentication to all caretaker routes
router.use(requireAuth);
// CRUD operations
router.get('/', rbacResource('caretakers', 'read'), careteakersController.getCaretakers);
// Require company context for creating staff members
router.post('/', requireCompanyContext, rbacResource('caretakers', 'create'), careteakersController.createCaretaker);
router.get('/:id', rbacResource('caretakers', 'read'), careteakersController.getCaretaker);
router.put('/:id', rbacResource('caretakers', 'update'), careteakersController.updateCaretaker);
router.delete('/:id', rbacResource('caretakers', 'delete'), careteakersController.deleteCaretaker);
// Additional actions
router.post('/:id/invite', rbacResource('caretakers', 'update'), careteakersController.inviteCaretaker);
router.post('/:id/reset-password', rbacResource('caretakers', 'update'), careteakersController.resetPassword);
export default router;
