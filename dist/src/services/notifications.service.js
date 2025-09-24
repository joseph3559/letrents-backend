import { PrismaClient } from '@prisma/client';
import { formatDataForRole } from '../utils/roleBasedFiltering.js';
const prisma = new PrismaClient();
export const notificationsService = {
    async getNotifications(user, limit = 10, offset = 0, filters = {}) {
        // Build role-based where clause for notifications
        let whereClause = {
            ...filters,
            recipient_id: user.user_id,
            company_id: user.company_id
        };
        // Super admin can see all notifications
        if (user.role === 'super_admin') {
            delete whereClause.recipient_id;
            delete whereClause.company_id;
        }
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: whereClause,
                take: limit,
                skip: offset,
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            role: true,
                        }
                    }
                }
            }),
            prisma.notification.count({
                where: whereClause
            })
        ]);
        return {
            notifications: formatDataForRole(user, notifications),
            total,
            page: Math.floor(offset / limit) + 1,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },
    async createNotification(user, notificationData) {
        // Validate permissions - only certain roles can create notifications
        if (!['landlord', 'agency_admin', 'super_admin', 'caretaker'].includes(user.role)) {
            throw new Error('Insufficient permissions to create notification');
        }
        // Prepare notification data
        const createData = {
            title: notificationData.title,
            message: notificationData.message || notificationData.content,
            type: notificationData.type || 'info',
            priority: notificationData.priority || 'medium',
            category: notificationData.category || 'general',
            sender_id: user.user_id,
            recipient_id: notificationData.recipientId,
            recipient_type: notificationData.recipient_type || 'user',
            is_read: false,
            company_id: user.company_id,
            // Optional fields
            ...(notificationData.property_id && { property_id: notificationData.property_id }),
            ...(notificationData.unit_id && { unit_id: notificationData.unit_id }),
            ...(notificationData.actionUrl && { actionUrl: notificationData.actionUrl }),
            ...(notificationData.metadata && { metadata: notificationData.metadata }),
        };
        const notification = await prisma.notification.create({
            data: createData,
            include: {
                sender: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                }
            }
        });
        return notification;
    },
    async getNotification(user, notificationId) {
        // Build access control for single notification
        let whereClause = { id: notificationId };
        switch (user.role) {
            case 'super_admin':
                // No additional filters
                break;
            case 'agency_admin':
                whereClause = {
                    id: notificationId,
                    OR: [
                        { recipient_id: user.user_id },
                        {
                            AND: [
                                { recipient_type: 'agency' },
                                { company_id: user.company_id }
                            ]
                        },
                        {
                            AND: [
                                { recipient_type: 'company' },
                                { company_id: user.company_id }
                            ]
                        }
                    ]
                };
                break;
            case 'landlord':
                whereClause = {
                    id: notificationId,
                    OR: [
                        { recipient_id: user.user_id },
                        {
                            AND: [
                                { recipient_type: 'company' },
                                { company_id: user.company_id }
                            ]
                        }
                    ]
                };
                break;
            default:
                whereClause = {
                    id: notificationId,
                    recipient_id: user.user_id
                };
        }
        const notification = await prisma.notification.findFirst({
            where: whereClause,
            include: {
                sender: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                }
            }
        });
        if (!notification) {
            return null;
        }
        return formatDataForRole(user, notification);
    },
    async updateNotification(user, notificationId, updateData) {
        // Check if notification exists and user has access
        const existingNotification = await this.getNotification(user, notificationId);
        if (!existingNotification) {
            throw new Error('Notification not found or access denied');
        }
        // Only allow updating certain fields
        const updateFields = {};
        if (updateData.title) {
            updateFields.title = updateData.title;
        }
        if (updateData.message || updateData.content) {
            updateFields.message = updateData.message || updateData.content;
        }
        if (updateData.priority) {
            updateFields.priority = updateData.priority;
        }
        if (updateData.is_read !== undefined) {
            updateFields.is_read = updateData.isRead;
            if (updateData.isRead) {
                updateFields.read_at = new Date();
            }
        }
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: updateFields,
            include: {
                sender: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                }
            }
        });
        return updatedNotification;
    },
    async deleteNotification(user, notificationId) {
        // Check if notification exists and user has access
        const existingNotification = await this.getNotification(user, notificationId);
        if (!existingNotification) {
            throw new Error('Notification not found or access denied');
        }
        // Only allow deletion if user is the recipient or has admin privileges
        if (existingNotification.recipient_id !== user.user_id &&
            !['super_admin', 'agency_admin'].includes(user.role)) {
            throw new Error('Insufficient permissions to delete notification');
        }
        await prisma.notification.delete({
            where: { id: notificationId }
        });
        return { success: true };
    },
    async markAsRead(user, notificationId) {
        // Check if notification exists and user has access
        const existingNotification = await this.getNotification(user, notificationId);
        if (!existingNotification) {
            throw new Error('Notification not found or access denied');
        }
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                is_read: true,
                read_at: new Date(),
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                }
            }
        });
        return updatedNotification;
    },
    async getUnreadCount(user) {
        try {
            // Simplified approach using actual schema fields
            const whereClause = {
                is_read: false,
                recipient_id: user.user_id,
                company_id: user.company_id
            };
            // Super admin can see all notifications
            if (user.role === 'super_admin') {
                delete whereClause.company_id;
                delete whereClause.recipient_id;
            }
            const count = await prisma.notification.count({
                where: whereClause
            });
            return count;
        }
        catch (error) {
            console.error('Error getting unread notification count:', error);
            // Return 0 if there's an error (e.g., table doesn't exist)
            return 0;
        }
    },
    async markAllAsRead(user) {
        // Build where clause for user's notifications
        let whereClause = { is_read: false };
        switch (user.role) {
            case 'agency_admin':
                whereClause = {
                    is_read: false,
                    OR: [
                        { recipient_id: user.user_id },
                        {
                            AND: [
                                { recipient_type: 'agency' },
                                { company_id: user.company_id }
                            ]
                        },
                        {
                            AND: [
                                { recipient_type: 'company' },
                                { company_id: user.company_id }
                            ]
                        }
                    ]
                };
                break;
            case 'landlord':
                whereClause = {
                    is_read: false,
                    OR: [
                        { recipient_id: user.user_id },
                        {
                            AND: [
                                { recipient_type: 'company' },
                                { company_id: user.company_id }
                            ]
                        }
                    ]
                };
                break;
            default:
                whereClause = {
                    is_read: false,
                    recipient_id: user.user_id
                };
        }
        const result = await prisma.notification.updateMany({
            where: whereClause,
            data: {
                is_read: true,
                read_at: new Date(),
            }
        });
        return {
            updatedCount: result.count,
            message: `${result.count} notifications marked as read`
        };
    },
};
