import { Router } from 'express';
import { LeasesController } from '../controllers/leases.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();
const leasesController = new LeasesController();

// Apply authentication to all routes
router.use(requireAuth);

// Lease CRUD operations
router.post('/', 
  rbacResource('leases', 'create'), 
  leasesController.createLease
);

router.get('/', 
  rbacResource('leases', 'read'), 
  leasesController.listLeases
);

router.get('/:id', 
  rbacResource('leases', 'read'), 
  leasesController.getLease
);

router.put('/:id', 
  rbacResource('leases', 'update'), 
  leasesController.updateLease
);

// Lease management operations
router.post('/:id/terminate', 
  rbacResource('leases', 'update'), 
  leasesController.terminateLease
);

router.post('/:id/renew', 
  rbacResource('leases', 'create'), 
  leasesController.renewLease
);

// Utility endpoints
router.get('/unit/:unit_id/history', 
  rbacResource('leases', 'read'), 
  leasesController.getLeaseHistory
);

router.get('/tenant/:tenant_id/leases', 
  rbacResource('leases', 'read'), 
  leasesController.getTenantLeases
);

router.get('/expiring/list', 
  rbacResource('leases', 'read'), 
  leasesController.getExpiringLeases
);

// Bulk operations
router.post('/create-for-existing-tenants', 
  rbacResource('leases', 'create'), 
  leasesController.createLeasesForExistingTenants
);

export default router;