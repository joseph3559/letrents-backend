import { Router } from 'express';
import { runCleanup, getCleanupStatus } from '../controllers/cleanup.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Cleanup routes (super admin only)
router.post('/run', rbacResource('system', 'manage'), runCleanup);
router.get('/status', rbacResource('system', 'manage'), getCleanupStatus);

export default router;

