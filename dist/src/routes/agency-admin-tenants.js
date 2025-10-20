import { Router } from 'express';
import { getAgencyTenant, getAgencyTenantPayments, getAgencyTenantMaintenance } from '../controllers/agency-admin-tenants.controller.js';
import { rbacResource } from '../middleware/rbac.js';
const router = Router();
// Agency Admin Tenant Routes
// These endpoints provide detailed tenant information for agency admins
// Get tenant details with full property/unit information
router.get('/:id', rbacResource('tenants', 'read'), getAgencyTenant);
// Get tenant payment history
router.get('/:id/payments', rbacResource('tenants', 'read'), getAgencyTenantPayments);
// Get tenant maintenance requests
router.get('/:id/maintenance', rbacResource('tenants', 'read'), getAgencyTenantMaintenance);
export default router;
