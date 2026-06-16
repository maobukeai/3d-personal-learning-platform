import { logger } from '../utils/logger';
import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToConversation, emitToUser } from '../services/socket.service';
import { queueDirectMessageEmail } from '../services/direct-message-email.service';
import { createNotification } from '../utils/notification';
import { clampLimit } from '../utils/pagination';

export const getConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.userId as string;
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                NOT: { senderId: userId },
                readBy: {
                  none: { userId },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = conversations.map((c) => ({
      ...c,
      unreadCount: c._count.messages,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;
  const cursor = req.query.cursor as string | undefined;
  const limit = clampLimit(req.query.limit, 50, 100);

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: userId },
        },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
        readBy: true,
        reactions: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;

    res.json({
      messages: items.reverse(),
      hasMore,
      nextCursor: hasMore ? items[0]?.createdAt : null,
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createConversation = async (req: AuthRequest, res: Response) => {
  const { participantIds, name, avatarUrl, isGroup } = req.body;
  const currentUserId = req.userId as string;

  try {
    if (!isGroup && participantIds.length === 1) {
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: currentUserId } } },
            { participants: { some: { id: participantIds[0] } } },
          ],
        },
        include: {
          participants: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });
      if (existing && existing.participants.length === 2) return res.json(existing);
    }

    const conversation = await prisma.conversation.create({
      data: {
        name,
        avatarUrl,
        isGroup: !!isGroup,
        participants: {
          connect: [currentUserId, ...participantIds].map((id) => ({ id })),
        },
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    conversation.participants.forEach((p: any) => {
      emitToUser(p.id, 'conversation_created', conversation);
    });

    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateConversation = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;
  const { name, avatarUrl } = req.body;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: userId } },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(name !== undefined && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    emitToConversation(conversationId, 'conversation_updated', updated);

    res.json(updated);
  } catch (error) {
    logger.error('Update conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addParticipant = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;
  const { userId: addUserId } = req.body;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: userId } },
        isGroup: true,
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied or not a group' });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: { connect: { id: addUserId } },
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    emitToConversation(conversationId, 'conversation_updated', updated);
    emitToUser(addUserId, 'conversation_created', updated);

    res.json(updated);
  } catch (error) {
    logger.error('Add participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeParticipant = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;
  const { userId: removeUserId } = req.body;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: userId } },
        isGroup: true,
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied or not a group' });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: { disconnect: { id: removeUserId } },
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    emitToConversation(conversationId, 'conversation_updated', updated);
    emitToUser(removeUserId, 'conversation_removed', { conversationId });

    res.json(updated);
  } catch (error) {
    logger.error('Remove participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const leaveConversation = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: userId } },
        isGroup: true,
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied or not a group' });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: { disconnect: { id: userId } },
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    emitToConversation(conversationId, 'conversation_updated', updated);

    const systemMsg = await prisma.message.create({
      data: {
        content: `${req.user?.name || '一位用户'} 离开了群聊`,
        type: 'SYSTEM',
        senderId: userId,
        conversationId,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    emitToConversation(conversationId, 'new_message', systemMsg);

    res.json({ message: 'Left conversation' });
  } catch (error) {
    logger.error('Leave conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const { conversationId, content, type, replyToId } = req.body;
  const senderId = req.userId as string;

  const msgType = type || 'TEXT';
  if (msgType === 'TEXT' && (!content || !content.trim())) {
    return res.status(400).json({ error: '消息内容不能为空' });
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: senderId },
        },
      },
      include: {
        participants: {
          select: { id: true },
        },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    if (replyToId) {
      const replyMsg = await prisma.message.findFirst({
        where: { id: replyToId, conversationId },
      });
      if (!replyMsg) {
        return res.status(400).json({ error: 'Reply message not found in this conversation' });
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        type: type || 'TEXT',
        senderId,
        conversationId,
        ...(replyToId && { replyToId }),
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    emitToConversation(conversationId, 'new_message', message);

    const senderName = req.user?.name || req.user?.email || '有人';
    const groupContext =
      conversation.isGroup && conversation.name ? `在「${conversation.name}」中` : '';
    const notificationTitle = '收到新私信';
    const notificationContent = groupContext
      ? `${senderName} ${groupContext}发送了一条消息`
      : `${senderName} 给你发送了一条消息`;
    const messageLink = `/messages?conversationId=${encodeURIComponent(conversationId)}`;

    conversation.participants.forEach((p: any) => {
      if (p.id !== senderId) {
        emitToUser(p.id, 'message_received', {
          conversationId,
          message,
        });

        void (async () => {
          try {
            await createNotification({
              type: 'MESSAGE',
              title: notificationTitle,
              content: notificationContent,
              userId: p.id,
              link: messageLink,
              category: 'DIRECT_MESSAGE',
            });
          } catch (error) {
            logger.error('[Message] Failed to create in-app message notification:', error);
          }

          try {
            await queueDirectMessageEmail({
              recipientId: p.id,
              conversationId,
              senderName,
              conversationName: conversation.name,
              isGroup: conversation.isGroup,
              content,
              messageType: msgType,
            });
          } catch (error) {
            logger.error('[Message] Failed to queue message email reminder:', error);
          }
        })();
      }
    });

    res.status(201).json(message);
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  const messageId = req.params.messageId as string;
  const userId = req.userId as string;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    emitToConversation(message.conversationId, 'message_deleted', {
      messageId,
      conversationId: message.conversationId,
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { id: userId } },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: { disconnect: { id: userId } },
      },
    });

    emitToUser(userId, 'conversation_removed', { conversationId });

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileUrl = (req.file as any).url || `/uploads/messages/${req.file.filename}`;
    res.json({ url: fileUrl, type: req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE' });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: userId },
        },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        readBy: {
          none: { userId },
        },
        NOT: { senderId: userId },
      },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((m) => ({
          messageId: m.id,
          userId,
        })),
      });

      emitToConversation(conversationId, 'messages_read', {
        conversationId,
        userId,
        messageIds: unreadMessages.map((m) => m.id),
        readAt: new Date(),
      });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addReaction = async (req: AuthRequest, res: Response) => {
  const messageId = req.params.messageId as string;
  const { emoji } = req.body;
  const userId = req.userId as string;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: message.conversationId,
        participants: { some: { id: userId } },
      },
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId: messageId as string, userId, emoji: emoji as string },
      },
      create: { messageId: messageId as string, userId, emoji: emoji as string },
      update: {},
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    emitToConversation(message.conversationId, 'message_reaction', {
      messageId,
      reaction,
    });

    res.status(201).json(reaction);
  } catch (error) {
    logger.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeReaction = async (req: AuthRequest, res: Response) => {
  const messageId = req.params.messageId as string;
  const emoji = req.params.emoji as string;
  const userId = req.userId as string;

  try {
    const reaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: messageId as string,
          userId,
          emoji: emoji as string,
        },
      },
    });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    await prisma.messageReaction.delete({
      where: { id: reaction.id },
    });

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (message) {
      emitToConversation(message.conversationId, 'message_reaction_removed', {
        messageId,
        userId,
        emoji,
      });
    }

    res.json({ message: 'Reaction removed' });
  } catch (error) {
    logger.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const translateMessage = async (req: AuthRequest, res: Response) => {
  const { content, targetLang } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // This is a mock translation service.
    // In a real production environment, you would integrate with services like Google Translate API, DeepL, etc.
    // For now, we simulate a translation by appending the language code.

    let translation = '';
    const lang = targetLang || 'zh';

    if (lang === 'zh') {
      translation = `[译自英文]: ${content} (模拟翻译内容)`;
    } else if (lang === 'en') {
      translation = `[Translated from Chinese]: ${content} (Mock translated content)`;
    } else {
      translation = `[Translated to ${lang}]: ${content}`;
    }

    // Small delay to simulate network latency of an external API
    await new Promise((resolve) => setTimeout(resolve, 300));

    res.json({ translation });
  } catch (error) {
    logger.error('Translate message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
