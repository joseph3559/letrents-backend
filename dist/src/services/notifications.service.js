import { PrismaClient } from '@prisma/client';
import { formatDataForRole } from '../utils/roleBasedFiltering.js';
const prisma = new PrismaClient();
export const notificationsService = {
    async getNotifications(user, limit = 10, offset = 0, filters = {}) {
        // Extract property_ids from filters if provided
        const propertyIds = filters?.property_ids;
        delete filters?.property_ids; // Remove from filters to avoid conflicts
        // Build role-based where clause for notifications
        // Include both sent and received notifications
        let whereClause = {
            ...filters,
            company_id: user.company_id,
            OR: [
                { recipient_id: user.user_id }, // Received notifications
                { sender_id: user.user_id } // Sent notifications
            ]
        };
        // Super admin can see all notifications
        if (user.role === 'super_admin') {
            delete whereClause.OR;
            delete whereClause.company_id;
            // If property_ids provided, filter by property_id
            if (propertyIds && Array.isArray(propertyIds) && propertyIds.length > 0) {
                whereClause.property_id = { in: propertyIds };
            }
        }
        // For agents, also include notifications related to their assigned properties
        if (user.role === 'agent') {
            // Get agent's assigned properties
            const agentProperties = await prisma.staffPropertyAssignment.findMany({
                where: {
                    staff_id: user.user_id,
                    status: 'active'
                },
                select: {
                    property_id: true
                }
            });
            const propertyIds = agentProperties.map(ap => ap.property_id);
            // Update OR clause to also include notifications for assigned properties
            if (propertyIds.length > 0) {
                whereClause.OR = [
                    { recipient_id: user.user_id }, // Received notifications
                    { sender_id: user.user_id }, // Sent notifications
                    { property_id: { in: propertyIds } } // Notifications for assigned properties
                ];
            }
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
                    },
                    recipient: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            role: true,
                        }
                    },
                    property: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_number: true,
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
        if (!['landlord', 'agency_admin', 'super_admin', 'agent', 'caretaker', 'tenant'].includes(user.role)) {
            throw new Error('Insufficient permissions to create notification');
        }
        // Prepare notification data
        const createData = {
            title: notificationData.title,
            message: notificationData.message || notificationData.content,
            notification_type: notificationData.notification_type || notificationData.type || 'info',
            priority: notificationData.priority || 'medium',
            category: notificationData.category || 'general',
            sender_id: user.user_id,
            recipient_id: notificationData.recipientId || notificationData.recipient_id, // ✅ Support both formats
            is_read: false,
            company_id: user.company_id,
            // Optional fields
            ...(notificationData.property_id && { property_id: notificationData.property_id }),
            ...(notificationData.unit_id && { unit_id: notificationData.unit_id }),
            ...(notificationData.action_url && { action_url: notificationData.action_url }),
            ...(notificationData.action_required !== undefined && { action_required: notificationData.action_required }), // ✅ Add action_required support
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
        // Super admin: unrestricted
        if (user.role !== 'super_admin') {
            // For non-super-admin users, restrict to same company and either recipient or sender
            whereClause = {
                id: notificationId,
                company_id: user.company_id,
                OR: [
                    { recipient_id: user.user_id },
                    { sender_id: user.user_id }
                ]
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
                },
                recipient: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                },
                property: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                unit: {
                    select: {
                        id: true,
                        unit_number: true,
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
            updateFields.is_read = updateData.is_read;
            updateFields.status = updateData.is_read ? 'read' : 'unread';
            if (updateData.is_read) {
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
                status: 'read',
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
        if (user.role === 'super_admin') {
            // super_admin sees all unread
            whereClause = { is_read: false };
        }
        else {
            whereClause = {
                is_read: false,
                company_id: user.company_id,
                OR: [
                    { recipient_id: user.user_id },
                    { sender_id: user.user_id }
                ]
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
    async archiveNotification(user, notificationId) {
        // Check if notification exists and user has access
        const existingNotification = await this.getNotification(user, notificationId);
        if (!existingNotification) {
            throw new Error('Notification not found or access denied');
        }
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                status: 'archived',
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
    async bulkUpdateNotifications(user, action, notificationIds) {
        // Verify user has access to all notifications
        const userNotifications = await prisma.notification.findMany({
            where: {
                id: { in: notificationIds },
                recipient_id: user.user_id,
                company_id: user.company_id
            }
        });
        // Only update notifications the user has access to
        const accessibleIds = userNotifications.map(n => n.id);
        if (accessibleIds.length === 0) {
            throw new Error('No accessible notifications found');
        }
        let updateData = {};
        switch (action) {
            case 'mark_read':
                updateData = {
                    is_read: true,
                    status: 'read',
                    read_at: new Date(),
                };
                break;
            case 'archive':
                updateData = {
                    status: 'archived',
                };
                break;
            case 'delete':
                // For delete, we actually delete the records
                const deleteResult = await prisma.notification.deleteMany({
                    where: {
                        id: { in: accessibleIds }
                    }
                });
                return {
                    updatedCount: deleteResult.count,
                    message: `${deleteResult.count} notifications deleted`,
                    action: 'delete'
                };
            default:
                throw new Error(`Invalid action: ${action}`);
        }
        const result = await prisma.notification.updateMany({
            where: {
                id: { in: accessibleIds }
            },
            data: updateData
        });
        return {
            updatedCount: result.count,
            message: `${result.count} notifications ${action === 'mark_read' ? 'marked as read' : action === 'archive' ? 'archived' : 'updated'}`,
            action
        };
    },
};
