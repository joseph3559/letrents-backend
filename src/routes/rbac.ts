import { Router } from 'express';
import { 
  getAllRoles,
  getAllPermissions,
  getCurrentUserPermissions,
  checkCurrentUserPermission,
  getCurrentUserHierarchy
} from '../controllers/rbac.controller.js';

const router = Router();

// RBAC information endpoints - no additional RBAC needed as these are informational
router.get('/roles', getAllRoles);
router.get('/permissions', getAllPermissions);
router.get('/me/permissions', getCurrentUserPermissions);
router.get('/me/check/:permission', checkCurrentUserPermission);
router.get('/me/hierarchy', getCurrentUserHierarchy);

export default router;
