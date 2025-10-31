import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { notificationsController } from '../controllers/notifications.controller.js';

const router = Router();

// Apply authentication to all notification routes
router.use(requireAuth);

// Specific routes (must come before parameterized routes)
router.get('/unread-count', rbacResource('notifications', 'read'), notificationsController.getUnreadCount);
router.post('/mark-all-read', rbacResource('notifications', 'update'), notificationsController.markAllAsRead);
router.post('/bulk', rbacResource('notifications', 'update'), notificationsController.bulkUpdateNotifications);

// CRUD operations
router.get('/', rbacResource('notifications', 'read'), notificationsController.getNotifications);
router.post('/', rbacResource('notifications', 'create'), notificationsController.createNotification);
router.get('/:id', rbacResource('notifications', 'read'), notificationsController.getNotification);
router.put('/:id', rbacResource('notifications', 'update'), notificationsController.updateNotification);
router.delete('/:id', rbacResource('notifications', 'delete'), notificationsController.deleteNotification);

// Notification actions
router.post('/:id/read', rbacResource('notifications', 'update'), notificationsController.markAsRead);
router.post('/:id/archive', rbacResource('notifications', 'update'), notificationsController.archiveNotification);

export default router;
