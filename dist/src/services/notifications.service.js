import { PrismaClient } from '@prisma/client';
import { formatDataForRole } from '../utils/roleBasedFiltering.js';
import { supabaseRealtimeService } from './supabase-realtime.service.js';
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
                take: limit * 2, // Fetch more to account for filtering
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
        // Filter out messages deleted by current user (unless deleted_for_everyone is true)
        const filteredNotifications = notifications.filter(notification => {
            // If deleted for everyone, show it (with placeholder message)
            if (notification.deleted_for_everyone) {
                return true;
            }
            // Check if current user has deleted this message
            let deletedByUsers = [];
            if (notification.deleted_by_users) {
                if (Array.isArray(notification.deleted_by_users)) {
                    deletedByUsers = notification.deleted_by_users;
                }
                else if (typeof notification.deleted_by_users === 'string') {
                    try {
                        deletedByUsers = JSON.parse(notification.deleted_by_users);
                    }
                    catch {
                        deletedByUsers = [];
                    }
                }
            }
            // Exclude if current user is in deleted_by_users
            return !deletedByUsers.includes(user.user_id);
        }).slice(0, limit); // Apply limit after filtering
        return {
            notifications: formatDataForRole(user, filteredNotifications),
            total: filteredNotifications.length,
            page: Math.floor(offset / limit) + 1,
            limit,
            totalPages: Math.ceil(filteredNotifications.length / limit)
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
        // Publish to Supabase Realtime for real-time delivery
        try {
            await supabaseRealtimeService.publishNotification(notification);
        }
        catch (error) {
            // Silently fail if Supabase is not available
            console.debug('Supabase Realtime not available:', error);
        }
        // TODO: Push notifications - Replace Firebase FCM with Supabase push notifications or another service
        // For now, real-time updates work via Supabase Realtime subscriptions
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
        // Check if user is the sender (for message editing)
        const isSender = existingNotification.sender_id === user.user_id;
        // If updating message content, check 15-minute time limit
        if ((updateData.message || updateData.content) && isSender) {
            const messageTime = new Date(existingNotification.created_at).getTime();
            const now = new Date().getTime();
            const diffInMinutes = (now - messageTime) / (1000 * 60);
            if (diffInMinutes > 15) {
                throw new Error('Messages can only be edited within 15 minutes of sending');
            }
        }
        // Only allow updating certain fields
        const updateFields = {};
        if (updateData.title) {
            updateFields.title = updateData.title;
        }
        if (updateData.message || updateData.content) {
            // Only allow sender to edit message content
            if (isSender) {
                updateFields.message = updateData.message || updateData.content;
                updateFields.updated_at = new Date();
            }
            else {
                throw new Error('Only the sender can edit message content');
            }
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
                },
                recipient: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        role: true,
                    }
                }
            }
        });
        // Publish read status to Supabase Realtime
        if (updateFields.is_read && updatedNotification.recipient_id && updatedNotification.sender_id) {
            try {
                await supabaseRealtimeService.publishReadStatus(updatedNotification.sender_id, notificationId, updatedNotification.recipient_id, updatedNotification.read_at || new Date());
            }
            catch (error) {
                console.debug('Supabase not available for read status update:', error);
            }
        }
        return updatedNotification;
    },
    async deleteNotification(user, notificationId, deleteForEveryone = false) {
        // Check if notification exists and user has access
        const existingNotification = await this.getNotification(user, notificationId);
        if (!existingNotification) {
            throw new Error('Notification not found or access denied');
        }
        const isSender = existingNotification.sender_id === user.user_id;
        const isRecipient = existingNotification.recipient_id === user.user_id;
        const isAdmin = ['super_admin', 'agency_admin'].includes(user.role);
        // Only sender can delete for everyone, and only within 15 minutes (like WhatsApp)
        if (deleteForEveryone) {
            if (!isSender) {
                throw new Error('Only the sender can delete a message for everyone');
            }
            // Check if message is within 15 minutes
            const messageTime = new Date(existingNotification.created_at).getTime();
            const now = new Date().getTime();
            const diffInMinutes = (now - messageTime) / (1000 * 60);
            if (diffInMinutes > 15) {
                throw new Error('Messages can only be deleted for everyone within 15 minutes of sending');
            }
            // Delete for everyone - mark as deleted_for_everyone
            await prisma.notification.update({
                where: { id: notificationId },
                data: {
                    deleted_for_everyone: true,
                    message: 'This message was deleted',
                    updated_at: new Date(),
                }
            });
            return { success: true, deletedForEveryone: true };
        }
        // Delete for me only - soft delete by adding user to deleted_by_users array
        if (!isSender && !isRecipient && !isAdmin) {
            throw new Error('Insufficient permissions to delete notification');
        }
        // Get current deleted_by_users array
        const deletedByUsers = Array.isArray(existingNotification.deleted_by_users)
            ? existingNotification.deleted_by_users
            : (existingNotification.deleted_by_users ? JSON.parse(existingNotification.deleted_by_users) : []);
        // Add current user to deleted_by_users if not already there
        if (!deletedByUsers.includes(user.user_id)) {
            deletedByUsers.push(user.user_id);
        }
        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                deleted_by_users: deletedByUsers,
                updated_at: new Date(),
            }
        });
        return { success: true, deletedForEveryone: false };
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
