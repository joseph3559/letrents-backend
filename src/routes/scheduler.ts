import { Router } from 'express';
import { SchedulerService } from '../services/scheduler.service.js';
import { writeSuccess } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();
const scheduler = SchedulerService.getInstance();

// Get scheduler status (super admin only)
router.get('/status', 
  requireAuth, 
  rbacResource('system', 'read'), 
  async (req, res) => {
    try {
      const status = scheduler.getTasksStatus();
      writeSuccess(res, 200, 'Scheduler status retrieved', {
        tasks: status,
        environment: process.env.NODE_ENV,
        schedulerEnabled: process.env.NODE_ENV === 'production'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;
