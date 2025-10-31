import { Router } from 'express';
import { listPayments, getPayment, createPayment, updatePayment, approvePayment, deletePayment, sendPaymentReceipt, verifyRentPayment, updatePendingPayment, verifyAdvancePayment } from '../controllers/payments.controller.js';
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
// Send payment receipt
router.post('/:id/send-receipt', rbacResource('payments', 'read'), sendPaymentReceipt);
// Verify rent payment (Paystack)
router.post('/verify-rent', verifyRentPayment);
// Verify advance payment (Paystack)
router.post('/verify-advance', verifyAdvancePayment);
// Update/cleanup pending payment
router.post('/:id/update-pending', rbacResource('payments', 'update'), updatePendingPayment);
export default router;
