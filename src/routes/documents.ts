import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { pdfDocumentsController } from '../controllers/pdf-documents.controller.js';

const router = Router();

router.use(requireAuth);

// Financial/legal documents (centralized PDFs)
router.get('/invoices/:invoiceId.pdf', rbacResource('documents', 'read'), pdfDocumentsController.invoicePdf);
router.get('/payments/:paymentId/receipt.pdf', rbacResource('documents', 'read'), pdfDocumentsController.paymentReceiptPdf);
router.get('/payments/:paymentId/refund.pdf', rbacResource('documents', 'read'), pdfDocumentsController.refundReceiptPdf);
router.get('/leases/:leaseId.pdf', rbacResource('documents', 'read'), pdfDocumentsController.leasePdf);
router.get('/statements/tenants/:tenantId.pdf', rbacResource('documents', 'read'), pdfDocumentsController.tenantStatementPdf);

// Report exports (PDF)
router.get('/reports/:type.pdf', rbacResource('documents', 'read'), pdfDocumentsController.reportPdf);
router.post('/reports/render.pdf', rbacResource('documents', 'read'), pdfDocumentsController.renderReportPdf);

export default router;

