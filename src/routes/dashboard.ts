import { Router } from 'express';
import { 
  getDashboardStats,
  getOnboardingStatus
} from '../controllers/dashboard.controller.js';
import { rbacResource } from '../middleware/rbac.js';

const router = Router();

// Super Admin Dashboard (system-wide)
router.get('/', async (req, res) => {
  const user = (req as any).user;
  
  if (user?.role === 'super_admin') {
    const { getDashboardData } = await import('../controllers/super-admin.controller.js');
    await getDashboardData(req, res);
  } else {
    // Regular dashboard stats for other roles
    await getDashboardStats(req, res);
  }
});

// Dashboard stats
router.get('/stats', rbacResource('dashboard', 'read'), getDashboardStats);

// Onboarding status
router.get('/onboarding/status', rbacResource('dashboard', 'read'), getOnboardingStatus);

export default router;
