import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToConversation, emitToUser } from '../services/socket.service';

export const getConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.userId as string;
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId }
        }
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { name: true } }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                NOT: { senderId: userId },
                readBy: {
                  none: { userId }
                }
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to include unreadCount at top level
    const formatted = conversations.map(c => ({
      ...c,
      unreadCount: c._count.messages
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;

  try {
    // Verify user is a participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: userId }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true }
        },
        readBy: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createConversation = async (req: AuthRequest, res: Response) => {
  const { participantIds, name, isGroup } = req.body;
  const currentUserId = req.userId as string;

  try {
    // If not a group, check if 1:1 conversation already exists
    if (!isGroup && participantIds.length === 1) {
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { id: currentUserId } } },
            { participants: { some: { id: participantIds[0] } } }
          ]
        },
        include: {
          participants: {
            select: { id: true, name: true, email: true, avatarUrl: true }
          }
        }
      });
      if (existing) return res.json(existing);
    }

    const conversation = await prisma.conversation.create({
      data: {
        name,
        isGroup: !!isGroup,
        participants: {
          connect: [currentUserId, ...participantIds].map(id => ({ id }))
        }
      },
      include: {
        participants: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    });
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const { conversationId, content, type } = req.body;
  const senderId = req.userId as string;

  try {
    // Verify user is a participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: senderId }
        }
      },
      include: {
        participants: {
          select: { id: true }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const message = await prisma.message.create({
      data: {
        content,
        type: type || 'TEXT',
        senderId,
        conversationId
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    // Update conversation updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Broadcast message via Socket.io
    emitToConversation(conversationId, 'new_message', message);

    // Also notify each participant individually (except sender) for general notifications/unread updates
    conversation.participants.forEach((p: any) => {
      if (p.id !== senderId) {
        emitToUser(p.id, 'message_received', {
          conversationId,
          message
        });
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.userId as string;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    // Broadcast deletion via Socket.io
    emitToConversation(message.conversationId, 'message_deleted', {
      messageId,
      conversationId: message.conversationId
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileUrl = `/uploads/messages/${req.file.filename}`;
    res.json({ url: fileUrl, type: req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.conversationId as string;
  const userId = req.userId as string;

  try {
    // Verify user is a participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: { id: userId }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        readBy: {
          none: { userId }
        },
        NOT: { senderId: userId }
      }
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map(m => ({
          messageId: m.id,
          userId
        }))
      });

      // Notify other participants that messages have been read
      emitToConversation(conversationId, 'messages_read', {
        conversationId,
        userId,
        messageIds: unreadMessages.map(m => m.id),
        readAt: new Date()
      });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
