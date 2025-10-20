import { Router } from 'express';
import multer from 'multer';
import {
  getTenantDashboard,
  getTenantProfile,
  getTenantLeases,
  getTenantPayments,
  getTenantMaintenance,
  getTenantNotifications,
  createMaintenanceRequest,
  updateTenantProfile,
  uploadTenantProfilePicture
} from '../controllers/tenant-portal.controller.js';

// Configure multer for profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

// Tenant Portal Routes - All require tenant role authentication
// These are specifically for the logged-in tenant to access their own data

// Dashboard summary
router.get('/dashboard', getTenantDashboard);

// Profile management
router.get('/profile', getTenantProfile);
router.put('/profile', updateTenantProfile);
router.post('/profile/photo', upload.single('file'), uploadTenantProfilePicture);

// Leases
router.get('/leases', getTenantLeases);

// Payments
router.get('/payments', getTenantPayments);

// Maintenance requests
router.get('/maintenance', getTenantMaintenance);
router.post('/maintenance', createMaintenanceRequest);

// Notifications/Notices
router.get('/notifications', getTenantNotifications);
router.get('/notices', getTenantNotifications); // Alias for notifications

export default router;
