import { Router } from 'express';
import multer from 'multer';
import {
  getTenantDashboard,
  getTenantProfile,
  getTenantLeases,
  getTenantPayments,
  getTenantPaymentById,
  getTenantInvoices,
  getTenantPendingPayables,
  processTenantPayment,
  getTenantMaintenance,
  getTenantNotifications,
  createMaintenanceRequest,
  updateTenantProfile,
  uploadTenantProfilePicture,
  submitLeaseEditRequest,
  getTenantLeaseModifications,
  getTenantAllModifications,
  acknowledgeTenantLeaseModification,
  getTenantUnacknowledgedModifications,
  getTenantLeaseModificationStats,
  cancelTenantPendingPayment,
  cleanupDuplicatePayment
} from '../controllers/tenant-portal.controller.js';

import {
  getTenantPreferences,
  updateTenantPreferences,
  getNotificationSettings,
  updateNotificationSettings,
  changePassword,
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  getSecurityActivity,
  get2FASettings,
  enable2FA,
  disable2FA
} from '../controllers/tenant-settings.controller.js';

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
router.post('/leases/edit-request', submitLeaseEditRequest);

// Lease Modifications
router.get('/leases/:leaseId/modifications', getTenantLeaseModifications);
router.get('/leases/:leaseId/modifications/stats', getTenantLeaseModificationStats);
router.get('/modifications', getTenantAllModifications);
router.get('/modifications/unacknowledged', getTenantUnacknowledgedModifications);
router.post('/modifications/:modificationId/acknowledge', acknowledgeTenantLeaseModification);

// Payments
router.get('/payments', getTenantPayments);
router.get('/payments/:id', getTenantPaymentById); // Get single payment details
router.post('/payments/process', processTenantPayment); // Process payment for selected invoices
router.delete('/payments/:id', cancelTenantPendingPayment); // Cancel pending payment
router.post('/payments/:id/cleanup', cleanupDuplicatePayment); // Cleanup duplicate/erroneous payment

// Invoices
router.get('/invoices', getTenantInvoices);
router.get('/pending-payables', getTenantPendingPayables);

// Maintenance requests
router.get('/maintenance', getTenantMaintenance);
router.post('/maintenance', createMaintenanceRequest);

// Notifications/Notices
router.get('/notifications', getTenantNotifications);
router.get('/notices', getTenantNotifications); // Alias for notifications

// Settings - Preferences
router.get('/settings/preferences', getTenantPreferences);
router.put('/settings/preferences', updateTenantPreferences);

// Settings - Notifications
router.get('/settings/notifications', getNotificationSettings);
router.put('/settings/notifications', updateNotificationSettings);

// Settings - Security
router.post('/settings/security/change-password', changePassword);
router.get('/settings/security/sessions', getActiveSessions);
router.delete('/settings/security/sessions/:sessionId', revokeSession);
router.post('/settings/security/sessions/revoke-all', revokeAllOtherSessions);
router.get('/settings/security/activity', getSecurityActivity);

// Settings - Two-Factor Authentication
router.get('/settings/security/2fa', get2FASettings);
router.post('/settings/security/2fa/enable', enable2FA);
router.post('/settings/security/2fa/disable', disable2FA);

export default router;
