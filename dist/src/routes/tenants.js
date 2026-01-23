import { Router } from 'express';
import { createTenant, getTenant, updateTenant, deleteTenant, checkTenantDeletable, listTenants, assignUnit, releaseUnit, terminateTenant, sendInvitation, resetPassword, getTenantPayments, getTenantDocuments, migrateTenant, getTenantActivity, updateRentDetails, getTenantMaintenance, createTenantMaintenance, getTenantPerformance, getTenantNotes, updateTenantNotes } from '../controllers/tenants.controller.js';
import { uploadTenantDocuments, documentUploadMiddleware } from '../controllers/documents.controller.js';
import { createTenantPayment } from '../controllers/payments.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Tenants CRUD
router.post('/', rbacResource('tenants', 'create'), createTenant);
router.get('/', rbacResource('tenants', 'read'), listTenants);
router.get('/:id', rbacResource('tenants', 'read'), getTenant);
router.get('/:id/check-deletable', rbacResource('tenants', 'read'), checkTenantDeletable);
router.put('/:id', rbacResource('tenants', 'update'), updateTenant);
router.delete('/:id', rbacResource('tenants', 'delete'), deleteTenant);
// Tenant unit management
router.post('/:id/assign-unit', rbacResource('tenants', 'update'), assignUnit);
router.post('/:id/release-unit', rbacResource('tenants', 'update'), releaseUnit);
router.post('/:id/migrate', rbacResource('tenants', 'update'), migrateTenant);
// Tenant lifecycle management
router.post('/:id/terminate', rbacResource('tenants', 'update'), terminateTenant);
router.post('/:id/invite', rbacResource('tenants', 'update'), sendInvitation);
router.post('/:id/resend-invitation', rbacResource('tenants', 'update'), sendInvitation);
router.post('/:id/reset-password', rbacResource('tenants', 'update'), resetPassword);
// Tenant data endpoints
router.get('/:id/payments', rbacResource('tenants', 'read'), getTenantPayments);
router.post('/:id/payments', rbacResource('payments', 'create'), createTenantPayment);
router.get('/:id/documents', rbacResource('tenants', 'read'), getTenantDocuments);
router.post('/:id/documents', rbacResource('tenants', 'update'), documentUploadMiddleware, uploadTenantDocuments);
router.get('/:id/activity', rbacResource('tenants', 'read'), getTenantActivity);
router.get('/:id/maintenance', rbacResource('tenants', 'read'), getTenantMaintenance);
router.post('/:id/maintenance', rbacResource('maintenance', 'create'), createTenantMaintenance);
router.get('/:id/performance', rbacResource('tenants', 'read'), getTenantPerformance);
router.get('/:id/notes', rbacResource('tenants', 'read'), getTenantNotes);
router.put('/:id/notes', rbacResource('tenants', 'update'), updateTenantNotes);
// Rent details management
router.put('/:id/rent-details', rbacResource('tenants', 'update'), updateRentDetails);
export default router;
