import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { messagesController } from '../controllers/messages.controller.js';

const router = Router();

// Apply authentication to all message routes
router.use(requireAuth);

// Get messages (for all roles - landlord, agent, agency_admin, caretaker, super_admin, etc.)
router.get('/', rbacResource('messages', 'read'), messagesController.getMessages);

// Get a specific message
router.get('/:id', rbacResource('messages', 'read'), messagesController.getMessage);

// Mark message as read
router.post('/:id/read', rbacResource('messages', 'update'), messagesController.markAsRead);

// Delete message
router.delete('/:id', rbacResource('messages', 'delete'), messagesController.deleteMessage);

export default router;


