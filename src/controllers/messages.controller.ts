import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { writeSuccess, writeError } from '../utils/response.js';

const prisma = getPrisma();

/**
 * Messages Controller
 * 
 * IMPORTANT: For messages to work correctly across web and mobile:
 * - The same tenant must use the same user_id on both platforms (same JWT token user_id)
 * - Messages are linked by sender_id and recipient_id, so user ID consistency is critical
 * - If a tenant has different user_ids on web vs mobile, they will see separate message threads
 */

export const messagesController = {
  // Get messages for all roles (landlord, agent, agency_admin, caretaker, super_admin, etc.)
  getMessages: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Parse property_ids if provided (for filtering)
      let queryPropertyIds: string[] | undefined = undefined;
      if (req.query.property_ids) {
        const propertyIdsParam = req.query.property_ids as string;
        queryPropertyIds = propertyIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
      }

      // Build where clause for messages
      // Messages are notifications with notification_type='message' OR category='message'
      const andConditions: any[] = [];

      // Add message type filter (always required)
      andConditions.push({
        OR: [
          { notification_type: 'message' },
          { category: 'message' }
        ]
      });

      // For non-super-admin users, filter by company and user involvement
      if (user.role !== 'super_admin') {
        andConditions.push({
          company_id: user.company_id
        });
        
        // Build OR conditions for message visibility
        const userOrConditions: any[] = [
          { recipient_id: user.user_id },  // Received messages
          { sender_id: user.user_id }       // Sent messages
        ];
        
        // For landlords and agents, also include messages from tenants in their properties
        if (user.role === 'landlord' || user.role === 'agent') {
          // Get properties owned/managed by this user
          let propertyIds: string[] = [];
          
          if (user.role === 'landlord') {
            // Get properties owned by this landlord
            const landlordProperties = await prisma.property.findMany({
              where: {
                owner_id: user.user_id,
                company_id: user.company_id
              },
              select: { id: true }
            });
            propertyIds = landlordProperties.map(p => p.id);
          } else if (user.role === 'agent') {
            // Get properties assigned to this agent
            const agentProperties = await prisma.staffPropertyAssignment.findMany({
              where: {
                staff_id: user.user_id,
                status: 'active'
              },
              select: { property_id: true }
            });
            propertyIds = agentProperties.map(ap => ap.property_id);
          }
          
          // If user has properties, include messages related to those properties
          // This ensures landlords/agents see messages from tenants in their properties
          if (propertyIds.length > 0) {
            userOrConditions.push({
              property_id: { in: propertyIds }
            });
          }
        }
        
        andConditions.push({
          OR: userOrConditions
        });
      }

      // Add property filter if provided (from query parameter)
      if (queryPropertyIds && Array.isArray(queryPropertyIds) && queryPropertyIds.length > 0) {
        andConditions.push({
          property_id: { in: queryPropertyIds }
        });
      }

      // Note: Agent property filtering is now handled in the main OR condition above
      // This ensures agents see messages from tenants in their assigned properties

      const whereClause: any = {
        AND: andConditions
      };

      // Fetch all messages
      const allMessages = await prisma.notification.findMany({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          },
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          },
          property: {
            select: {
              id: true,
              name: true
            }
          },
          unit: {
            select: {
              id: true,
              unit_number: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      // Filter out messages deleted by current user
      const messages = allMessages.filter((notif: any) => {
        // Check if deleted_by_users array contains current user ID
        if (notif.deleted_by_users) {
          let deletedByUsers = [];
          if (Array.isArray(notif.deleted_by_users)) {
            deletedByUsers = notif.deleted_by_users;
          } else if (typeof notif.deleted_by_users === 'string') {
            try {
              deletedByUsers = JSON.parse(notif.deleted_by_users);
            } catch {
              deletedByUsers = [];
            }
          }
          // Exclude if current user is in deleted_by_users
          if (deletedByUsers.includes(user.user_id)) {
            return false;
          }
        }
        return true;
      });

      // Apply pagination after filtering
      const paginatedMessages = messages.slice(offset, offset + limit);
      const total = messages.length;

      writeSuccess(res, 200, 'Messages retrieved successfully', {
        messages: paginatedMessages,
        pagination: {
          page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });

    } catch (error: any) {
      console.error('Error getting messages:', error);
      writeError(res, 500, 'Failed to retrieve messages');
    }
  },

  // Get a specific message
  getMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;

      let whereClause: any = {
        id,
        OR: [
          { notification_type: 'message' },
          { category: 'message' }
        ]
      };

      // For non-super-admin users, restrict to same company and user involvement
      if (user.role !== 'super_admin') {
        whereClause.company_id = user.company_id;
        whereClause.AND = [
          {
            OR: [
              { recipient_id: user.user_id },
              { sender_id: user.user_id }
            ]
          },
          {
            OR: [
              { notification_type: 'message' },
              { category: 'message' }
            ]
          }
        ];
      }

      const message = await prisma.notification.findFirst({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          },
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          },
          property: {
            select: {
              id: true,
              name: true
            }
          },
          unit: {
            select: {
              id: true,
              unit_number: true
            }
          }
        }
      });

      if (!message) {
        return writeError(res, 404, 'Message not found');
      }

      writeSuccess(res, 200, 'Message retrieved successfully', message);
    } catch (error: any) {
      console.error('Error getting message:', error);
      writeError(res, 500, 'Failed to retrieve message');
    }
  },

  // Mark message as read
  markAsRead: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;

      // Verify user has access to this message
      let whereClause: any = {
        id,
        OR: [
          { notification_type: 'message' },
          { category: 'message' }
        ]
      };

      if (user.role !== 'super_admin') {
        whereClause.company_id = user.company_id;
        whereClause.AND = [
          {
            OR: [
              { recipient_id: user.user_id },
              { sender_id: user.user_id }
            ]
          }
        ];
      }

      const message = await prisma.notification.findFirst({
        where: whereClause
      });

      if (!message) {
        return writeError(res, 404, 'Message not found');
      }

      // Only mark as read if user is the recipient
      if (message.recipient_id === user.user_id && !message.is_read) {
        await prisma.notification.update({
          where: { id },
          data: {
            is_read: true,
            read_at: new Date(),
            status: 'read'
          }
        });
      }

      const updatedMessage = await prisma.notification.findUnique({
        where: { id },
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          },
          recipient: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true
            }
          }
        }
      });

      writeSuccess(res, 200, 'Message marked as read', updatedMessage);
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      writeError(res, 500, 'Failed to mark message as read');
    }
  },

  // Delete message
  deleteMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const deleteForEveryone = req.body?.deleteForEveryone === true || req.query?.deleteForEveryone === 'true';

      // Verify user has access to this message
      let whereClause: any = {
        id,
        OR: [
          { notification_type: 'message' },
          { category: 'message' }
        ]
      };

      if (user.role !== 'super_admin') {
        whereClause.company_id = user.company_id;
        whereClause.AND = [
          {
            OR: [
              { recipient_id: user.user_id },
              { sender_id: user.user_id }
            ]
          }
        ];
      }

      const message = await prisma.notification.findFirst({
        where: whereClause
      });

      if (!message) {
        return writeError(res, 404, 'Message not found');
      }

      // Check if message was sent within 15 minutes
      const messageTime = new Date(message.created_at).getTime();
      const now = Date.now();
      const minutesSinceSent = (now - messageTime) / (1000 * 60);
      const isSender = message.sender_id === user.user_id;
      const canDeleteForEveryone = isSender && minutesSinceSent <= 15;

      if (deleteForEveryone && canDeleteForEveryone) {
        // Delete for everyone - permanently delete from database
        await prisma.notification.delete({
          where: { id }
        });
      } else {
        // Delete for current user only - add to deleted_by_users array
        let deletedByUsers: string[] = [];
        if (message.deleted_by_users) {
          if (Array.isArray(message.deleted_by_users)) {
            // Properly cast JsonArray to string[]
            deletedByUsers = (message.deleted_by_users as any[]).filter((id): id is string => typeof id === 'string');
          } else if (typeof message.deleted_by_users === 'string') {
            try {
              const parsed = JSON.parse(message.deleted_by_users);
              if (Array.isArray(parsed)) {
                deletedByUsers = parsed.filter((id): id is string => typeof id === 'string');
              }
            } catch {
              deletedByUsers = [];
            }
          }
        }

        if (!deletedByUsers.includes(user.user_id)) {
          deletedByUsers.push(user.user_id);
        }

        // If all recipients have deleted it, permanently delete from database
        // Get all unique recipient IDs for this message
        const allRecipients = new Set<string>();
        if (message.recipient_id) {
          allRecipients.add(message.recipient_id);
        }
        // If it's a group message, check metadata for all recipients
        if (message.metadata && typeof message.metadata === 'object') {
          const metadata = message.metadata as any;
          if (metadata.recipient_ids && Array.isArray(metadata.recipient_ids)) {
            metadata.recipient_ids.forEach((id: string) => allRecipients.add(id));
          }
        }

        // If all recipients have deleted it, permanently delete
        if (deletedByUsers.length >= allRecipients.size && allRecipients.size > 0) {
          await prisma.notification.delete({
            where: { id }
          });
        } else {
          // Otherwise, just mark as deleted for this user
          await prisma.notification.update({
            where: { id },
            data: {
              deleted_by_users: deletedByUsers
            }
          });
        }
      }

      writeSuccess(res, 200, deleteForEveryone ? 'Message deleted for everyone' : 'Message deleted for you', {
        id,
        deletedForEveryone: deleteForEveryone
      });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      writeError(res, 500, 'Failed to delete message');
    }
  }
};

