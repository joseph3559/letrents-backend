import { Router } from 'express';
import { 
  createInvoice, 
  getInvoice, 
  listInvoices, 
  updateInvoice, 
  deleteInvoice,
  sendInvoice,
  markInvoiceAsPaid,
  updateOverdueInvoices,
  linkPaymentToInvoice,
  autoReconcilePayments
} from '../controllers/invoices.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Invoices CRUD
router.post('/', rbacResource('invoices', 'create'), createInvoice);
router.get('/', rbacResource('invoices', 'read'), listInvoices);
router.get('/:id', rbacResource('invoices', 'read'), getInvoice);
router.put('/:id', rbacResource('invoices', 'update'), updateInvoice);
router.delete('/:id', rbacResource('invoices', 'delete'), deleteInvoice);

// Invoice status transitions
router.post('/:id/send', rbacResource('invoices', 'update'), sendInvoice);
router.post('/:id/mark-paid', rbacResource('invoices', 'update'), markInvoiceAsPaid);

// Payment reconciliation
router.post('/link-payment', rbacResource('invoices', 'update'), linkPaymentToInvoice);
router.post('/auto-reconcile', rbacResource('invoices', 'update'), autoReconcilePayments);

// System maintenance (admin only)
router.post('/system/update-overdue', rbacResource('invoices', 'update'), updateOverdueInvoices);

export default router;
