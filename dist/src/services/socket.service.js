import { Server as SocketIOServer } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { notificationsService } from './notifications.service.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// Typing indicators tracking
const typingUsers = new Map(); // conversationId -> Set of userIds
// Store connected users: userId -> Set of socketIds
const connectedUsers = new Map();
export class SocketService {
    io;
    server;
    constructor(server) {
        this.server = server;
        // Initialize Socket.IO with CORS configuration
        // IMPORTANT: Socket.IO attaches to the server and handles /socket.io/ requests automatically
        this.io = new SocketIOServer(server, {
            path: '/socket.io/',
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || true,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            transports: ['polling', 'websocket'], // Polling first for better compatibility
            allowEIO3: true,
            pingInterval: 25000,
            pingTimeout: 60000,
            connectTimeout: 60000, // 60 seconds for connection timeout
        });
        console.log('✅ Socket.IO server created');
        console.log('   Path: /socket.io/');
        console.log('   Transports: polling, websocket');
        // Set up middleware FIRST, then event handlers
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    /**
     * Socket.IO authentication middleware
     * Validates JWT token from handshake auth or query params
     */
    setupMiddleware() {
        // Authentication middleware - runs AFTER transport handshake but BEFORE connection event
        this.io.use(async (socket, next) => {
            let token;
            try {
                // Get token from multiple sources
                token =
                    socket.handshake.auth?.token ||
                        socket.handshake.query?.token ||
                        (socket.handshake.headers?.authorization || '')?.replace('Bearer ', '');
                if (!token) {
                    console.error('❌ Socket.IO: No token provided');
                    return next(new Error('Authentication token required'));
                }
                // Verify JWT token
                const decoded = jwt.verify(token, env.jwt.secret);
                // Check expiration
                const now = Math.floor(Date.now() / 1000);
                if (decoded.exp && decoded.exp < now) {
                    return next(new Error('Token expired'));
                }
                // Attach user to socket
                socket.user = decoded;
                socket.userId = decoded.user_id;
                console.log('✅ Socket.IO authenticated:', decoded.user_id);
                next();
            }
            catch (error) {
                console.error('Socket authentication error:', error.message);
                console.error('Socket authentication error details:', error);
                console.error('Token received:', token ? `${token.substring(0, 20)}...` : 'none');
                next(new Error(`Authentication failed: ${error.message}`));
            }
        });
    }
    /**
     * Setup Socket.IO event handlers
     */
    setupEventHandlers() {
        // Engine-level error handling
        this.io.engine.on('connection_error', (error) => {
            console.error('❌ Socket.IO engine error:', error.message || error);
        });
        // Log when engine receives a connection request (AFTER transport handshake completes)
        this.io.engine.on('connection', (socket) => {
            console.log('🔌 Socket.IO engine connection established');
            console.log('   Socket ID:', socket.id);
            console.log('   Transport:', socket.transport?.name);
            console.log('   ✅ Transport handshake completed');
        });
        // Connection established event handler (AFTER authentication middleware)
        this.io.on('connection', (socket) => {
            // Type assertion to AuthenticatedSocket (user data is added in middleware)
            const authSocket = socket;
            const userId = authSocket.userId;
            const user = authSocket.user;
            console.log(`✅ User connected via Socket.IO: ${userId} (${user.email})`);
            console.log(`   Socket ID: ${socket.id}`);
            // Track connected user
            if (!connectedUsers.has(userId)) {
                connectedUsers.set(userId, new Set());
            }
            connectedUsers.get(userId).add(authSocket.id);
            // Join user to their personal room for direct messages
            authSocket.join(`user:${userId}`);
            // Join user to their company room for company-wide updates
            if (user.company_id) {
                authSocket.join(`company:${user.company_id}`);
            }
            // ====================================================================
            // CHAT/MESSAGE EVENTS
            // ====================================================================
            /**
             * Send a message
             */
            authSocket.on('sendMessage', async (data) => {
                try {
                    if (!data.recipientId || !data.message) {
                        authSocket.emit('error', { message: 'recipientId and message are required' });
                        return;
                    }
                    // Create notification (message) using existing service
                    const notificationData = {
                        title: data.title || 'New Message',
                        message: data.message,
                        notification_type: data.notification_type || 'message',
                        category: data.category || 'message',
                        priority: data.priority || 'medium',
                        recipientId: data.recipientId,
                        metadata: data.replyTo ? { replyTo: data.replyTo } : {},
                    };
                    const notification = await notificationsService.createNotification(user, notificationData);
                    // Fetch full notification with relations
                    const fullNotification = await notificationsService.getNotification(user, notification.id);
                    // Emit to sender (confirmation)
                    authSocket.emit('messageSent', {
                        messageId: notification.id,
                        notification: fullNotification,
                    });
                    // Emit to recipient (new message)
                    this.io.to(`user:${data.recipientId}`).emit('receiveMessage', {
                        notification: fullNotification,
                    });
                    // Emit conversation update to both users
                    const ids = [userId, data.recipientId].sort();
                    const conversationId = `conv:${ids[0]}:${ids[1]}`;
                    this.io.to(`user:${userId}`).to(`user:${data.recipientId}`).emit('conversationUpdated', {
                        conversationId,
                        notification: fullNotification,
                    });
                    // Update unread count for recipient (includes all notifications including messages)
                    const unreadCount = await notificationsService.getUnreadCount({
                        ...user,
                        user_id: data.recipientId,
                    });
                    this.io.to(`user:${data.recipientId}`).emit('notificationCountUpdate', {
                        userId: data.recipientId,
                        unreadCount,
                    });
                    // Also emit newNotification event for the recipient (for real-time updates)
                    this.io.to(`user:${data.recipientId}`).emit('newNotification', {
                        notification: fullNotification,
                    });
                }
                catch (error) {
                    console.error('Error sending message:', error);
                    authSocket.emit('error', { message: error.message || 'Failed to send message' });
                }
            });
            /**
             * Mark message as delivered
             */
            authSocket.on('messageDelivered', async (data) => {
                try {
                    // This is informational - the message was delivered to the client
                    // We can optionally update message status in DB if needed
                    authSocket.emit('messageDeliveredConfirmed', { messageId: data.messageId });
                }
                catch (error) {
                    console.error('Error marking message as delivered:', error);
                }
            });
            /**
             * Mark message as read
             */
            authSocket.on('messageRead', async (data) => {
                try {
                    await notificationsService.markAsRead(user, data.messageId);
                    // Notify sender that message was read
                    const notification = await notificationsService.getNotification(user, data.messageId);
                    if (notification && notification.sender_id) {
                        this.io.to(`user:${notification.sender_id}`).emit('messageRead', {
                            messageId: data.messageId,
                            readBy: userId,
                            readAt: new Date(),
                        });
                    }
                    authSocket.emit('messageReadConfirmed', { messageId: data.messageId });
                }
                catch (error) {
                    console.error('Error marking message as read:', error);
                    authSocket.emit('error', { message: error.message || 'Failed to mark message as read' });
                }
            });
            /**
             * Typing indicator - user started typing
             */
            authSocket.on('typing', async (data) => {
                const ids = [userId, data.recipientId].sort();
                const conversationId = data.conversationId || `conv:${ids[0]}:${ids[1]}`;
                if (!typingUsers.has(conversationId)) {
                    typingUsers.set(conversationId, new Set());
                }
                typingUsers.get(conversationId).add(userId);
                // Fetch user details for typing indicator
                const userDetails = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { first_name: true, last_name: true },
                });
                const userName = userDetails
                    ? `${userDetails.first_name || ''} ${userDetails.last_name || ''}`.trim()
                    : user.email || 'Someone';
                // Notify recipient
                this.io.to(`user:${data.recipientId}`).emit('typing', {
                    conversationId,
                    userId,
                    userName,
                });
            });
            /**
             * Typing indicator - user stopped typing
             */
            authSocket.on('stopTyping', (data) => {
                const ids = [userId, data.recipientId].sort();
                const conversationId = data.conversationId || `conv:${ids[0]}:${ids[1]}`;
                const users = typingUsers.get(conversationId);
                if (users) {
                    users.delete(userId);
                    if (users.size === 0) {
                        typingUsers.delete(conversationId);
                    }
                }
                // Notify recipient
                this.io.to(`user:${data.recipientId}`).emit('stopTyping', {
                    conversationId,
                    userId,
                });
            });
            // ====================================================================
            // NOTIFICATION EVENTS
            // ====================================================================
            /**
             * Request current unread count
             */
            authSocket.on('getUnreadCount', async () => {
                try {
                    const count = await notificationsService.getUnreadCount(user);
                    authSocket.emit('notificationCountUpdate', { unreadCount: count });
                }
                catch (error) {
                    console.error('Error getting unread count:', error);
                }
            });
            // ====================================================================
            // DISCONNECTION HANDLING
            // ====================================================================
            authSocket.on('disconnect', () => {
                console.log(`❌ User disconnected: ${userId}`);
                // Remove from connected users
                const userSockets = connectedUsers.get(userId);
                if (userSockets) {
                    userSockets.delete(authSocket.id);
                    if (userSockets.size === 0) {
                        connectedUsers.delete(userId);
                    }
                }
                // Clean up typing indicators
                typingUsers.forEach((users, conversationId) => {
                    users.delete(userId);
                    if (users.size === 0) {
                        typingUsers.delete(conversationId);
                    }
                });
            });
        });
    }
    /**
     * Get or create Socket.IO instance
     */
    getIO() {
        return this.io;
    }
    /**
     * Emit notification to a specific user
     * Called from other services (e.g., when creating notifications)
     */
    async emitNotification(userId, notification) {
        this.io.to(`user:${userId}`).emit('newNotification', { notification });
        // Update unread count
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });
            if (user) {
                const unreadCount = await notificationsService.getUnreadCount({
                    user_id: userId,
                    email: user.email || '',
                    phone_number: user.phone_number || '',
                    role: user.role,
                    company_id: user.company_id || undefined,
                    session_id: '',
                    permissions: [],
                    iat: 0,
                    exp: 0,
                    nbf: 0,
                    iss: '',
                    sub: userId,
                });
                this.io.to(`user:${userId}`).emit('notificationCountUpdate', { unreadCount });
            }
        }
        catch (error) {
            console.error('Error updating notification count:', error);
        }
    }
    /**
     * Emit notification to a company
     */
    emitCompanyNotification(companyId, notification) {
        this.io.to(`company:${companyId}`).emit('newNotification', { notification });
    }
    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
    }
    /**
     * Get conversation ID from two user IDs
     * Creates a deterministic conversation ID by sorting user IDs
     */
    getConversationId(userId1, userId2) {
        const ids = [userId1, userId2].sort();
        return `conv:${ids[0]}:${ids[1]}`;
    }
}
// Singleton instance
let socketServiceInstance = null;
export function initializeSocket(server) {
    if (!socketServiceInstance) {
        socketServiceInstance = new SocketService(server);
    }
    return socketServiceInstance;
}
export function getSocketService() {
    return socketServiceInstance;
}
