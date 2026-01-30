import { Request, Response } from 'express';
import { messagingService } from '../services/messaging.service.js';
import { writeSuccess, writeError } from '../utils/response.js';
import { JWTClaims } from '../types/index.js';
import { getPrisma } from '../config/prisma.js';

const prisma = getPrisma();

export const messagingController = {
  getConversations: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { limit = 50, offset = 0 } = req.query;
      
      const conversations = await messagingService.getConversations(
        user,
        Number(limit),
        Number(offset)
      );
      
      writeSuccess(res, 200, 'Conversations retrieved successfully', conversations);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  createConversation: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { participantIds, isGroup, groupName } = req.body;
      
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return writeError(res, 400, 'participantIds array is required');
      }
      
      const conversation = await messagingService.getOrCreateConversation(
        user,
        participantIds,
        isGroup || false,
        groupName
      );
      
      writeSuccess(res, 201, 'Conversation created successfully', conversation);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getConversation: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      
      // Verify user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversation_id: id,
          user_id: user.user_id,
        },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      first_name: true,
                      last_name: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      
      if (!participant) {
        return writeError(res, 404, 'Conversation not found or access denied');
      }
      
      writeSuccess(res, 200, 'Conversation retrieved successfully', participant.conversation);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  getMessages: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const { limit = 50, offset = 0, before } = req.query;
      
      const beforeDate = before ? new Date(before as string) : undefined;
      
      const result = await messagingService.getMessages(
        user,
        id,
        Number(limit),
        Number(offset),
        beforeDate
      );
      
      writeSuccess(res, 200, 'Messages retrieved successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  createMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id: conversationId } = req.params;
      const {
        recipientIds,
        content,
        subject,
        messageType,
        priority,
        replyToMessageId,
        attachments,
        metadata,
      } = req.body;
      
      if (!content || !content.trim()) {
        return writeError(res, 400, 'Message content is required');
      }
      
      const message = await messagingService.createMessage(user, {
        conversationId,
        recipientIds: recipientIds || [],
        content: content.trim(),
        subject,
        messageType,
        priority,
        replyToMessageId,
        attachments,
        metadata,
      });
      
      writeSuccess(res, 201, 'Message sent successfully', message);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  updateMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const { content, subject } = req.body;
      
      if (!content || !content.trim()) {
        return writeError(res, 400, 'Message content is required');
      }
      
      const message = await messagingService.updateMessage(user, id, {
        content: content.trim(),
        subject,
      });
      
      writeSuccess(res, 200, 'Message updated successfully', message);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  deleteMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const { deleteForEveryone } = req.query;
      
      const result = await messagingService.deleteMessage(
        user,
        id,
        deleteForEveryone === 'true'
      );
      
      writeSuccess(
        res,
        200,
        result.deletedForEveryone
          ? 'Message deleted for everyone'
          : 'Message deleted for you',
        result
      );
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  addReaction: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      const { reactionType } = req.body;
      
      if (!reactionType) {
        return writeError(res, 400, 'reactionType is required');
      }
      
      const result = await messagingService.addReaction(user, id, reactionType);
      writeSuccess(res, 200, 'Reaction added successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  removeReaction: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id, reactionType } = req.params;
      
      const result = await messagingService.removeReaction(user, id, reactionType);
      writeSuccess(res, 200, 'Reaction removed successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  pinMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id: conversationId, messageId } = req.params;
      const { note } = req.body;
      
      const result = await messagingService.pinMessage(
        user,
        conversationId,
        messageId,
        note
      );
      writeSuccess(res, 200, 'Message pinned successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  unpinMessage: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id: conversationId, messageId } = req.params;
      
      const result = await messagingService.unpinMessage(user, conversationId, messageId);
      writeSuccess(res, 200, 'Message unpinned successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  searchMessages: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { q, conversationId, limit = 50 } = req.query;
      
      if (!q || typeof q !== 'string') {
        return writeError(res, 400, 'Search query (q) is required');
      }
      
      const messages = await messagingService.searchMessages(
        user,
        q,
        conversationId as string | undefined,
        Number(limit)
      );
      
      writeSuccess(res, 200, 'Messages found successfully', messages);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  updatePresence: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { status, message } = req.body;
      
      if (!status) {
        return writeError(res, 400, 'status is required');
      }
      
      const result = await messagingService.updatePresence(user, status, message);
      writeSuccess(res, 200, 'Presence updated successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  updateTypingIndicator: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { conversationId, isTyping } = req.body;
      
      if (!conversationId) {
        return writeError(res, 400, 'conversationId is required');
      }
      
      const result = await messagingService.updateTypingIndicator(
        user,
        conversationId,
        isTyping === true
      );
      writeSuccess(res, 200, 'Typing indicator updated successfully', result);
    } catch (error: any) {
      writeError(res, 500, error.message);
    }
  },

  deleteConversation: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as JWTClaims;
      const { id } = req.params;
      await messagingService.deleteConversation(user, id);
      writeSuccess(res, 200, 'Conversation deleted', { success: true });
    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('not a participant')) {
        return writeError(res, 404, error.message);
      }
      writeError(res, 500, error.message);
    }
  },
};

