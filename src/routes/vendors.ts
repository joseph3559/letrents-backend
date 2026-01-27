import { Router } from 'express';
import * as vendorsController from '../controllers/vendors.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Use maintenance read for list (vendors are used in maintenance)
router.get('/', rbacResource('maintenance', 'read'), vendorsController.listVendors);
router.post('/', rbacResource('maintenance', 'create'), vendorsController.createVendor);
router.put('/:id', rbacResource('maintenance', 'update'), vendorsController.updateVendor);
router.delete('/:id', rbacResource('maintenance', 'delete'), vendorsController.deleteVendor);

export default router;
