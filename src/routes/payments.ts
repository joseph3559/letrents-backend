import { Router } from 'express';
import { 
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  approvePayment,
  deletePayment
} from '../controllers/payments.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Payments CRUD
router.post('/', rbacResource('payments', 'create'), createPayment);
router.get('/', rbacResource('payments', 'read'), listPayments);
router.get('/:id', rbacResource('payments', 'read'), getPayment);
router.put('/:id', rbacResource('payments', 'update'), updatePayment);
router.delete('/:id', rbacResource('payments', 'delete'), deletePayment);

// Payment approval
router.post('/:id/approve', rbacResource('payments', 'approve'), approvePayment);

export default router;
