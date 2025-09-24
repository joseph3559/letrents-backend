import { Router } from 'express';
import {
  createPaybillSettings,
  getPaybillSettings,
  getTransactions,
  getTransactionStats,
  reconcileTransaction,
  c2bValidation,
  c2bConfirmation
} from '../controllers/mpesa.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Paybill settings management
router.post('/paybill-settings', rbacResource('billing', 'create'), createPaybillSettings);
router.get('/paybill-settings', rbacResource('billing', 'read'), getPaybillSettings);

// Transaction management
router.get('/transactions', rbacResource('billing', 'read'), getTransactions);
router.get('/transactions/stats', rbacResource('billing', 'read'), getTransactionStats);
router.post('/transactions/:id/reconcile', rbacResource('billing', 'update'), reconcileTransaction);

// C2B callback endpoints are handled in the main router (no authentication required)

export default router;
