import { Router } from 'express';
import { createTenant, getTenant, updateTenant, deleteTenant, listTenants, assignUnit, releaseUnit, terminateTenant, sendInvitation, resetPassword, getTenantPayments, getTenantDocuments, migrateTenant } from '../controllers/tenants.controller.js';
import { createTenantPayment } from '../controllers/payments.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Tenants CRUD
router.post('/', rbacResource('tenants', 'create'), createTenant);
router.get('/', rbacResource('tenants', 'read'), listTenants);
router.get('/:id', rbacResource('tenants', 'read'), getTenant);
router.put('/:id', rbacResource('tenants', 'update'), updateTenant);
router.delete('/:id', rbacResource('tenants', 'delete'), deleteTenant);
// Tenant unit management
router.post('/:id/assign-unit', rbacResource('tenants', 'assign'), assignUnit);
router.post('/:id/release-unit', rbacResource('tenants', 'release'), releaseUnit);
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
export default router;
