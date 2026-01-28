import { Router } from 'express';
import { 
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  approvePayment,
  reconcilePendingPayments,
  deletePayment,
  sendPaymentReceipt,
  verifyRentPayment,
  updatePendingPayment,
  verifyAdvancePayment,
  getCompanySubaccount,
  upsertCompanySubaccount,
  resolvePaystackAccount,
  getRentRoutingContext
} from '../controllers/payments.controller.js';
import { rbacResource } from '../middleware/rbac.js';
import { requireSubscription } from '../middleware/subscriptionValidation.js';

const router = Router();

// Paystack subaccounts (landlord/agency) + rent routing context (tenant)
// IMPORTANT: must be defined before '/:id' routes.
router.get('/subaccount', requireSubscription, getCompanySubaccount);
router.post('/subaccount', requireSubscription, upsertCompanySubaccount);
router.get('/subaccount/resolve', requireSubscription, resolvePaystackAccount);
router.post('/rent-routing', getRentRoutingContext); // Tenant endpoint, no subscription required

// Payments CRUD
router.post('/', rbacResource('payments', 'create'), createPayment);
router.get('/', rbacResource('payments', 'read'), listPayments);
router.get('/:id', rbacResource('payments', 'read'), getPayment);
router.put('/:id', rbacResource('payments', 'update'), updatePayment);
router.delete('/:id', rbacResource('payments', 'delete'), deletePayment);

// Payment approval
router.post('/:id/approve', rbacResource('payments', 'approve'), approvePayment);

// One-time reconciliation for pending payments
router.post('/reconcile-pending', rbacResource('payments', 'update'), reconcilePendingPayments);

// Send payment receipt
router.post('/:id/send-receipt', rbacResource('payments', 'read'), sendPaymentReceipt);

// Verify rent payment (Paystack)
router.post('/verify-rent', verifyRentPayment);

// Verify advance payment (Paystack)
router.post('/verify-advance', verifyAdvancePayment);

// Update/cleanup pending payment
router.post('/:id/update-pending', rbacResource('payments', 'update'), updatePendingPayment);

export default router;
