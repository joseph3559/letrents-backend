import { notificationsService } from '../services/notifications.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
export const notificationsController = {
    getNotifications: async (req, res) => {
        try {
            const user = req.user;
            const { limit = 10, offset = 0, category, status, priority, property_ids } = req.query;
            // Parse property_ids (comma-separated) for super-admin filtering
            let propertyIds = undefined;
            if (property_ids) {
                const propertyIdsParam = property_ids;
                propertyIds = propertyIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
                console.log('🔔 Parsed property_ids from query:', propertyIds);
            }
            const filters = {
                ...(category && { category: category }),
                ...(status && { status: status }),
                ...(priority && { priority: priority }),
                ...(propertyIds && { property_ids: propertyIds }),
            };
            const notifications = await notificationsService.getNotifications(user, Number(limit), Number(offset), filters);
            writeSuccess(res, 200, 'Notifications retrieved successfully', notifications);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    createNotification: async (req, res) => {
        try {
            const user = req.user;
            const notificationData = req.body;
            const notification = await notificationsService.createNotification(user, notificationData);
            writeSuccess(res, 201, 'Notification created successfully', notification);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getNotification: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const notification = await notificationsService.getNotification(user, id);
            if (!notification) {
                return writeError(res, 404, 'Notification not found');
            }
            writeSuccess(res, 200, 'Notification retrieved successfully', notification);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    updateNotification: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;
            const notification = await notificationsService.updateNotification(user, id, updateData);
            writeSuccess(res, 200, 'Notification updated successfully', notification);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    deleteNotification: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            // Handle both body and query parameters for deleteForEveryone
            const deleteForEveryone = req.body?.deleteForEveryone === true || req.query?.deleteForEveryone === 'true';
            const result = await notificationsService.deleteNotification(user, id, deleteForEveryone);
            writeSuccess(res, 200, result.deletedForEveryone ? 'Message deleted for everyone' : 'Message deleted for you', result);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    markAsRead: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const notification = await notificationsService.markAsRead(user, id);
            writeSuccess(res, 200, 'Notification marked as read', notification);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    getUnreadCount: async (req, res) => {
        try {
            const user = req.user;
            const count = await notificationsService.getUnreadCount(user);
            writeSuccess(res, 200, 'Unread count retrieved successfully', { unreadCount: count });
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    markAllAsRead: async (req, res) => {
        try {
            const user = req.user;
            const result = await notificationsService.markAllAsRead(user);
            writeSuccess(res, 200, 'All notifications marked as read', result);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    archiveNotification: async (req, res) => {
        try {
            const user = req.user;
            const { id } = req.params;
            const notification = await notificationsService.archiveNotification(user, id);
            writeSuccess(res, 200, 'Notification archived successfully', notification);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
    bulkUpdateNotifications: async (req, res) => {
        try {
            const user = req.user;
            const { action, notificationIds } = req.body;
            if (!action || !notificationIds || !Array.isArray(notificationIds)) {
                return writeError(res, 400, 'Invalid request: action and notificationIds array are required');
            }
            const result = await notificationsService.bulkUpdateNotifications(user, action, notificationIds);
            writeSuccess(res, 200, 'Bulk action completed successfully', result);
        }
        catch (error) {
            writeError(res, 500, error.message);
        }
    },
};
