import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rbacResource } from '../middleware/rbac.js';
import { messagingController } from '../controllers/messaging.controller.js';

const router = Router();

// Apply authentication to all messaging routes
router.use(requireAuth);

// Conversations
router.get('/conversations', rbacResource('messages', 'read'), messagingController.getConversations);
router.post('/conversations', rbacResource('messages', 'create'), messagingController.createConversation);
router.get('/conversations/:id', rbacResource('messages', 'read'), messagingController.getConversation);
router.delete('/conversations/:id', rbacResource('messages', 'delete'), messagingController.deleteConversation);

// Messages
router.get('/conversations/:id/messages', rbacResource('messages', 'read'), messagingController.getMessages);
router.post('/conversations/:id/messages', rbacResource('messages', 'create'), messagingController.createMessage);
router.put('/messages/:id', rbacResource('messages', 'update'), messagingController.updateMessage);
router.delete('/messages/:id', rbacResource('messages', 'delete'), messagingController.deleteMessage);

// Message actions
router.post('/messages/:id/reactions', rbacResource('messages', 'update'), messagingController.addReaction);
router.delete('/messages/:id/reactions/:reactionType', rbacResource('messages', 'update'), messagingController.removeReaction);
router.post('/conversations/:id/pin/:messageId', rbacResource('messages', 'update'), messagingController.pinMessage);
router.delete('/conversations/:id/pin/:messageId', rbacResource('messages', 'update'), messagingController.unpinMessage);

// Search
router.get('/search', rbacResource('messages', 'read'), messagingController.searchMessages);

// Presence & Typing
router.post('/presence', rbacResource('messages', 'update'), messagingController.updatePresence);
router.post('/typing', rbacResource('messages', 'update'), messagingController.updateTypingIndicator);

export default router;

