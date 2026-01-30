import { getPrisma } from '../config/prisma.js';
import { JWTClaims } from '../types/index.js';
import { supabaseRealtimeService } from './supabase-realtime.service.js';

const prisma = getPrisma();

interface CreateMessageData {
  conversationId?: string;
  recipientIds: string[];
  content: string;
  subject?: string;
  messageType?: string;
  priority?: string;
  replyToMessageId?: string;
  attachments?: any[];
  metadata?: any;
}

interface UpdateMessageData {
  content?: string;
  subject?: string;
}

interface MessageReactionData {
  reactionType: string;
}

/**
 * Enhanced Messaging Service
 * Handles all messaging operations with presence, typing, reactions, etc.
 */
export const messagingService = {
  /**
   * Get or create a conversation between users
   */
  async getOrCreateConversation(
    user: JWTClaims,
    participantIds: string[],
    isGroup: boolean = false,
    groupName?: string
  ) {
    // Validate participants
    const allParticipants = [user.user_id, ...participantIds].filter(
      (id, index, self) => self.indexOf(id) === index
    );

    if (allParticipants.length < 2) {
      throw new Error('At least 2 participants required for a conversation');
    }

    // For direct messages (2 participants), check if conversation exists
    if (!isGroup && allParticipants.length === 2) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          company_id: user.company_id,
          participants: {
            every: {
              user_id: { in: allParticipants },
            },
          },
        },
        include: {
          participants: true,
        },
      });

      if (existingConversation) {
        const participantCount = existingConversation.participants.length;
        const matchesAll = existingConversation.participants.every(p =>
          allParticipants.includes(p.user_id)
        );

        if (participantCount === allParticipants.length && matchesAll) {
          return existingConversation;
        }
      }
    }

    // Validate company_id
    if (!user.company_id) {
      throw new Error('User must have a company_id to create conversations');
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        company_id: user.company_id,
        subject: isGroup && groupName ? groupName : 'Direct Message',
        type: isGroup ? 'group' : 'direct',
        created_by: user.user_id,
      },
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
    });

    // Add participants
    await prisma.conversationParticipant.createMany({
      data: allParticipants.map(participantId => ({
        conversation_id: conversation.id,
        user_id: participantId,
        role: participantId === user.user_id ? 'admin' : 'participant',
      })),
    });

    // Initialize metadata for all participants
    await prisma.$executeRaw`
      INSERT INTO conversation_metadata (conversation_id, user_id, unread_count, updated_at)
      SELECT ${conversation.id}, user_id, 0, NOW()
      FROM unnest(${allParticipants}::uuid[]) AS user_id
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `;

    return prisma.conversation.findUnique({
      where: { id: conversation.id },
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
    });
  },

  /**
   * Create a message
   */
  async createMessage(user: JWTClaims, data: CreateMessageData) {
    let conversationId = data.conversationId;

    // Create conversation if not provided
    if (!conversationId) {
      if (!data.recipientIds || data.recipientIds.length === 0) {
        throw new Error('Either conversationId or recipientIds must be provided');
      }

      const conversation = await this.getOrCreateConversation(
        user,
        data.recipientIds,
        false
      );
      if (!conversation) {
        throw new Error('Failed to create conversation');
      }
      conversationId = conversation.id;
    }

    // Validate company_id
    if (!user.company_id) {
      throw new Error('User must have a company_id to create messages');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        company_id: user.company_id,
        conversation_id: conversationId,
        sender_id: user.user_id,
        content: data.content,
        subject: data.subject,
        message_type: data.messageType || 'text',
        priority: (data.priority as any) || 'medium',
        status: 'sent',
        sent_at: new Date(),
        parent_message_id: data.replyToMessageId, // Use parent_message_id instead of reply_to_message_id
        attachments: data.attachments || [],
        metadata: data.metadata || {},
      },
      include: {
        sender: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
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

    // Get recipients from conversation participants (exclude sender)
    if (!message.conversation) {
      throw new Error('Conversation not found in message');
    }
    
    const recipients = message.conversation.participants
      .filter((p: { user_id: string }) => p.user_id !== user.user_id)
      .map((p: { user_id: string }) => p.user_id);

    // Create message recipients
    if (recipients.length > 0) {
      await prisma.messageRecipient.createMany({
        data: recipients.map((recipientId: string) => ({
          message_id: message.id,
          recipient_id: recipientId,
          is_read: false,
          delivered_at: new Date(),
        })),
      });
    }

    // Update conversation last message (using raw SQL since last_message_id may not exist in Prisma schema)
    await prisma.$executeRaw`
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = ${conversationId}::uuid
    `;
    
    // Update conversation metadata for unread counts
    await prisma.$executeRaw`
      INSERT INTO conversation_metadata (conversation_id, user_id, unread_count, updated_at)
      SELECT ${conversationId}::uuid, user_id, 1, NOW()
      FROM unnest(${recipients}::uuid[]) AS user_id
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET unread_count = conversation_metadata.unread_count + 1, updated_at = NOW()
    `;

    // Publish to Supabase Realtime
    try {
      await supabaseRealtimeService.publishMessage({
        ...message,
        recipients,
      });
    } catch (error) {
      console.debug('Supabase not available for message publish:', error);
    }

    return message;
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(
    user: JWTClaims,
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
    before?: Date
  ) {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: user.user_id,
      },
    });

    if (!participant) {
      throw new Error('Not a participant in this conversation');
    }

    // Note: deleted_for_everyone may not exist in Prisma schema
    // Use raw SQL or filter after query if needed
    const whereClause: any = {
      conversation_id: conversationId,
    };

    if (before) {
      whereClause.created_at = { lt: before };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true,
            },
          },
          recipients: {
            where: { recipient_id: user.user_id },
            select: {
              is_read: true,
              read_at: true,
              is_starred: true,
            },
          },
          parent_message: {
            select: {
              id: true,
              content: true,
              sender: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      }),
      prisma.message.count({ where: whereClause }),
    ]);

    // Mark messages as read
    const unreadMessageIds = messages
      .filter(m => {
        const recipient = m.recipients?.[0];
        return recipient && !recipient.is_read;
      })
      .map(m => m.id);

    if (unreadMessageIds.length > 0) {
      await prisma.messageRecipient.updateMany({
        where: {
          message_id: { in: unreadMessageIds },
          recipient_id: user.user_id,
        },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      // Publish read receipts
      for (const message of messages.filter(m => unreadMessageIds.includes(m.id))) {
        try {
          await supabaseRealtimeService.publishReadStatus(
            message.sender_id,
            message.id,
            user.user_id,
            new Date()
          );
        } catch (error) {
          console.debug('Error publishing read receipt:', error);
        }
      }

      // Update conversation metadata
      await prisma.$executeRaw`
        UPDATE conversation_metadata
        SET unread_count = GREATEST(0, unread_count - ${unreadMessageIds.length}),
            last_read_at = NOW(),
            updated_at = NOW()
        WHERE conversation_id = ${conversationId}::uuid
          AND user_id = ${user.user_id}::uuid
      `;
    }

    return {
      messages: messages.reverse(), // Reverse to show oldest first
      total,
      hasMore: offset + messages.length < total,
    };
  },

  /**
   * Update message (edit)
   */
  async updateMessage(
    user: JWTClaims,
    messageId: string,
    data: UpdateMessageData
  ) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender_id !== user.user_id) {
      throw new Error('Only the sender can edit a message');
    }

    // Check 15-minute time limit
    const messageTime = new Date(message.created_at).getTime();
    const now = new Date().getTime();
    const diffInMinutes = (now - messageTime) / (1000 * 60);

    if (diffInMinutes > 15) {
      throw new Error('Messages can only be edited within 15 minutes of sending');
    }

    // Save edit history
    await prisma.$executeRaw`
      INSERT INTO message_edit_history (message_id, edited_content, edited_by, edited_at)
      VALUES (${messageId}::uuid, ${message.content}, ${user.user_id}::uuid, NOW())
    `;

    // Update message (using raw SQL for fields that may not exist in Prisma schema)
    await prisma.$executeRaw`
      UPDATE messages
      SET content = ${data.content || message.content},
          subject = ${data.subject || message.subject},
          is_edited = TRUE,
          edited_at = NOW(),
          updated_at = NOW()
      WHERE id = ${messageId}::uuid
    `;
    
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: data.content || message.content,
        subject: data.subject || message.subject,
        updated_at: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
      },
    });

    // Publish update to Supabase
    try {
      await supabaseRealtimeService.publishMessage({
        ...updatedMessage,
        event: 'message_updated',
      });
    } catch (error) {
      console.debug('Error publishing message update:', error);
    }

    return updatedMessage;
  },

  /**
   * Delete message
   */
  async deleteMessage(
    user: JWTClaims,
    messageId: string,
    deleteForEveryone: boolean = false
  ) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        recipients: true,
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    const isSender = message.sender_id === user.user_id;

    if (deleteForEveryone) {
      if (!isSender) {
        throw new Error('Only the sender can delete a message for everyone');
      }

      // Check 15-minute time limit
      const messageTime = new Date(message.created_at).getTime();
      const now = new Date().getTime();
      const diffInMinutes = (now - messageTime) / (1000 * 60);

      if (diffInMinutes > 15) {
        throw new Error('Messages can only be deleted for everyone within 15 minutes of sending');
      }

      // Delete for everyone (using raw SQL for fields that may not exist in Prisma schema)
      await prisma.$executeRaw`
        UPDATE messages
        SET deleted_for_everyone = TRUE,
            deleted_at = NOW(),
            deleted_by = ${user.user_id}::uuid,
            content = 'This message was deleted',
            updated_at = NOW()
        WHERE id = ${messageId}::uuid
      `;

      // Publish deletion
      try {
        await supabaseRealtimeService.publishMessage({
          id: messageId,
          event: 'message_deleted',
          deleted_for_everyone: true,
        });
      } catch (error) {
        console.debug('Error publishing message deletion:', error);
      }

      return { success: true, deletedForEveryone: true };
    }

    // Delete for me only - mark in recipient record
    const recipient = message.recipients.find(r => r.recipient_id === user.user_id);
    if (!recipient && !isSender) {
      throw new Error('Message not found or access denied');
    }

    if (isSender) {
      // Sender can soft delete by marking as archived
      await prisma.messageRecipient.updateMany({
        where: { message_id: messageId },
        data: { is_archived: true },
      });
    } else {
      // Recipient can delete their own view
      await prisma.messageRecipient.update({
        where: {
          message_id_recipient_id: {
            message_id: messageId,
            recipient_id: user.user_id,
          },
        },
        data: { is_archived: true },
      });
    }

    return { success: true, deletedForEveryone: false };
  },

  /**
   * Add reaction to message
   */
  async addReaction(user: JWTClaims, messageId: string, reactionType: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Add or update reaction
    await prisma.$executeRaw`
      INSERT INTO message_reactions (message_id, user_id, reaction_type, created_at)
      VALUES (${messageId}::uuid, ${user.user_id}::uuid, ${reactionType}, NOW())
      ON CONFLICT (message_id, user_id, reaction_type) DO NOTHING
    `;

    // Note: reaction_count field may not exist in Prisma schema
    // Reactions are tracked in message_reactions table

    // Publish reaction
    try {
      await supabaseRealtimeService.publishMessage({
        id: messageId,
        event: 'reaction_added',
        reactionType,
        userId: user.user_id,
      });
    } catch (error) {
      console.debug('Error publishing reaction:', error);
    }

    return { success: true };
  },

  /**
   * Remove reaction from message
   */
  async removeReaction(user: JWTClaims, messageId: string, reactionType: string) {
    await prisma.$executeRaw`
      DELETE FROM message_reactions
      WHERE message_id = ${messageId}::uuid
        AND user_id = ${user.user_id}::uuid
        AND reaction_type = ${reactionType}
    `;

    // Note: reaction_count field may not exist in Prisma schema
    // Reactions are tracked in message_reactions table

    // Publish reaction removal
    try {
      await supabaseRealtimeService.publishMessage({
        id: messageId,
        event: 'reaction_removed',
        reactionType,
        userId: user.user_id,
      });
    } catch (error) {
      console.debug('Error publishing reaction removal:', error);
    }

    return { success: true };
  },

  /**
   * Pin message
   */
  async pinMessage(
    user: JWTClaims,
    conversationId: string,
    messageId: string,
    note?: string
  ) {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: user.user_id,
      },
    });

    if (!participant) {
      throw new Error('Not a participant in this conversation');
    }

    await prisma.$executeRaw`
      INSERT INTO pinned_messages (conversation_id, message_id, pinned_by, note, pinned_at)
      VALUES (${conversationId}::uuid, ${messageId}::uuid, ${user.user_id}::uuid, ${note || null}, NOW())
      ON CONFLICT DO NOTHING
    `;

    return { success: true };
  },

  /**
   * Unpin message
   */
  async unpinMessage(
    user: JWTClaims,
    conversationId: string,
    messageId: string
  ) {
    await prisma.$executeRaw`
      DELETE FROM pinned_messages
      WHERE conversation_id = ${conversationId}::uuid
        AND message_id = ${messageId}::uuid
    `;

    return { success: true };
  },

  /**
   * Get conversations for user
   */
  async getConversations(user: JWTClaims, limit: number = 50, offset: number = 0) {
    const conversations = await prisma.conversation.findMany({
      where: {
        company_id: user.company_id,
        participants: {
          some: { user_id: user.user_id },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { updated_at: 'desc' },
      include: {
        participants: {
          where: { user_id: { not: user.user_id } },
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
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    // Get metadata for each conversation
    const conversationsWithMetadata = await Promise.all(
      conversations.map(async conversation => {
        const metadata = await prisma.$queryRaw<Array<{ unread_count: number; is_muted: boolean; is_pinned: boolean }>>`
          SELECT unread_count, is_muted, is_pinned
          FROM conversation_metadata
          WHERE conversation_id = ${conversation.id}::uuid
            AND user_id = ${user.user_id}::uuid
        `;

        return {
          ...conversation,
          unreadCount: metadata[0]?.unread_count || 0,
          isMuted: metadata[0]?.is_muted || false,
          isPinned: metadata[0]?.is_pinned || false,
        };
      })
    );

    return conversationsWithMetadata;
  },

  /**
   * Delete (leave) a conversation for the current user.
   * Removes the user's participation so the conversation no longer appears in their list.
   */
  async deleteConversation(user: JWTClaims, conversationId: string) {
    const deleted = await prisma.conversationParticipant.deleteMany({
      where: {
        conversation_id: conversationId,
        user_id: user.user_id,
      },
    });
    if (deleted.count === 0) {
      throw new Error('Conversation not found or you are not a participant');
    }
    return { success: true };
  },

  /**
   * Search messages
   */
  async searchMessages(
    user: JWTClaims,
    query: string,
    conversationId?: string,
    limit: number = 50
  ) {
    const whereClause: any = {
      company_id: user.company_id,
      content: { contains: query, mode: 'insensitive' },
      // Filter deleted messages in application logic
    };

    if (conversationId) {
      whereClause.conversation_id = conversationId;
    } else {
      // Only search in conversations user is part of
      const userConversations = await prisma.conversationParticipant.findMany({
        where: { user_id: user.user_id },
        select: { conversation_id: true },
      });
      whereClause.conversation_id = {
        in: userConversations.map(c => c.conversation_id),
      };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
        conversation: {
          select: {
            id: true,
            subject: true,
          },
        },
      },
    });

    return messages;
  },

  /**
   * Update presence status
   */
  async updatePresence(user: JWTClaims, status: string, message?: string) {
    // Use raw SQL for presence fields that may not exist in Prisma schema
    await prisma.$executeRaw`
      UPDATE users
      SET presence_status = ${status},
          presence_message = ${message || null},
          last_seen_at = ${status === 'offline' ? new Date() : null}
      WHERE id = ${user.user_id}::uuid
    `;
    
    // Also update user_presence table if it exists
    await prisma.$executeRaw`
      INSERT INTO user_presence (user_id, status, message, last_seen_at, updated_at)
      VALUES (${user.user_id}::uuid, ${status}, ${message || null}, ${status === 'offline' ? new Date() : null}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = ${status},
        message = ${message || null},
        last_seen_at = ${status === 'offline' ? new Date() : null},
        updated_at = NOW()
    `;

    // Publish presence update
    try {
      await supabaseRealtimeService.publishMessage({
        event: 'presence_updated',
        userId: user.user_id,
        status,
        message,
      });
    } catch (error) {
      console.debug('Error publishing presence update:', error);
    }

    return { success: true };
  },

  /**
   * Update typing indicator
   */
  async updateTypingIndicator(
    user: JWTClaims,
    conversationId: string,
    isTyping: boolean
  ) {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversation_id: conversationId,
        user_id: user.user_id,
      },
    });

    if (!participant) {
      throw new Error('Not a participant in this conversation');
    }

    if (isTyping) {
      await prisma.$executeRaw`
        INSERT INTO typing_indicators (conversation_id, user_id, is_typing, started_at, updated_at)
        VALUES (${conversationId}::uuid, ${user.user_id}::uuid, true, NOW(), NOW())
        ON CONFLICT (conversation_id, user_id)
        DO UPDATE SET is_typing = true, updated_at = NOW()
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE typing_indicators
        SET is_typing = false, updated_at = NOW()
        WHERE conversation_id = ${conversationId}::uuid
          AND user_id = ${user.user_id}::uuid
      `;
    }

    // Get other participants
    const otherParticipants = await prisma.conversationParticipant.findMany({
      where: {
        conversation_id: conversationId,
        user_id: { not: user.user_id },
      },
      select: { user_id: true },
    });

    // Publish typing indicator
    try {
      for (const participant of otherParticipants) {
        await supabaseRealtimeService.publishMessage({
          event: 'typing',
          conversationId,
          userId: user.user_id,
          isTyping,
        });
      }
    } catch (error) {
      console.debug('Error publishing typing indicator:', error);
    }

    return { success: true };
  },
};

