import { Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';

export const notificationsController = {
  getNotifications: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { limit = 10, offset = 0, category, status, priority } = req.query;
      
      const filters = {
        ...(category && { category: category as string }),
        ...(status && { status: status as string }),
        ...(priority && { priority: priority as string }),
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
      
      writeSuccess(res, notification, 'Notification retrieved successfully');
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
};
