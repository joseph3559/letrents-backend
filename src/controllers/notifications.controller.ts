import { Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export const notificationsController = {
  getNotifications: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { limit = 10, offset = 0, category, status, priority, property_ids } = req.query;
      
      // Parse property_ids (comma-separated) for super-admin filtering
      let propertyIds: string[] | undefined = undefined;
      if (property_ids) {
        const propertyIdsParam = property_ids as string;
        propertyIds = propertyIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
        console.log('🔔 Parsed property_ids from query:', propertyIds);
      }
      
      const filters: any = {
        ...(category && { category: category as string }),
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
        ...(propertyIds && { property_ids: propertyIds }),
      };

      const notifications = await notificationsService.getNotifications(
        user, 
        Number(limit), 
        Number(offset), 
        filters
      );
      
      writeSuccess(res, 200, 'Notifications retrieved successfully', notifications);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  createNotification: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const notificationData = req.body;
      const notification = await notificationsService.createNotification(user, notificationData);
      writeSuccess(res, 201, 'Notification created successfully', notification);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getNotification: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const notification = await notificationsService.getNotification(user, id);
      
      if (!notification) {
        return writeError(res, 404, 'Notification not found');
      }
      
      writeSuccess(res, 200, 'Notification retrieved successfully', notification);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  updateNotification: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const updateData = req.body;
      const notification = await notificationsService.updateNotification(user, id, updateData);
      writeSuccess(res, 200, 'Notification updated successfully', notification);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  deleteNotification: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      await notificationsService.deleteNotification(user, id);
      writeSuccess(res, 200, 'Notification deleted successfully');
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  markAsRead: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const notification = await notificationsService.markAsRead(user, id);
      writeSuccess(res, 200, 'Notification marked as read', notification);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getUnreadCount: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const count = await notificationsService.getUnreadCount(user);
      writeSuccess(res, 200, 'Unread count retrieved successfully', { unreadCount: count });
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  markAllAsRead: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const result = await notificationsService.markAllAsRead(user);
      writeSuccess(res, 200, 'All notifications marked as read', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  archiveNotification: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const notification = await notificationsService.archiveNotification(user, id);
      writeSuccess(res, 200, 'Notification archived successfully', notification);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  bulkUpdateNotifications: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { action, notificationIds } = req.body;
      
      if (!action || !notificationIds || !Array.isArray(notificationIds)) {
        return writeError(res, 400, 'Invalid request: action and notificationIds array are required');
      }

      const result = await notificationsService.bulkUpdateNotifications(user, action, notificationIds);
      writeSuccess(res, 200, 'Bulk action completed successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },
};
