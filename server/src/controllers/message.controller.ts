import { logger } from '../utils/logger';
import { Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToConversation, emitToUser } from '../services/socket.service';
import { queueDirectMessageEmail } from '../services/direct-message-email.service';
import { createNotification } from '../utils/notification';
import { clampLimit } from '../utils/pagination';
import { UploadedFile } from '../types/upload';
import { callLLM, callLLMWithFailover } from '../services/ai.service';
import { settingsService, AIModelOption } from '../services/settings.service';
import { storageService } from '../services/storage.service';
import { buildDecryptedStorageConfig } from '../utils/crypto';
import { getActiveStorageConfig } from '../mirror/services/metadata.helper';

type ConversationParticipant = {
  id: string;
  name?: string | null;
  email?: string;
  avatarUrl?: string | null;
};

export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const createConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    conversation.participants.forEach((p: ConversationParticipant) => {
      emitToUser(p.id, 'conversation_created', conversation);
    });

    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Create conversation error:', error);
    next(error);
  }
};

export const updateConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const addParticipant = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const removeParticipant = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const leaveConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // If it's a file or image upload, check if it was uploaded to our active R2 storage
    if (msgType === 'FILE' || msgType === 'IMAGE') {
      const activeStorage = await getActiveStorage();
      if (activeStorage) {
        const publicUrlBase = activeStorage.publicUrl.replace(/\/$/, '');
        if (content && content.startsWith(publicUrlBase)) {
          try {
            const key = content.replace(publicUrlBase, '').replace(/^\//, '');
            const config = buildDecryptedStorageConfig(activeStorage);
            const metadata = await storageService.getObjectMetadata(config, key);
            const size = metadata.ContentLength || 0;
            if (size > 0) {
              await prisma.storageConfig.update({
                where: { id: activeStorage.id },
                data: { usedBytes: { increment: size } },
              });
              logger.info(`[Message Storage] Incremented R2 storage usedBytes by ${size} for file: ${key}`);
            }
          } catch (storageErr) {
            logger.warn('[Message Storage] Failed to update storage usedBytes for sent message:', storageErr);
          }
        }
      }
    }

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

    conversation.participants.forEach((p: ConversationParticipant) => {
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
    next(error);
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileUrl = (req.file as UploadedFile).url || `/uploads/messages/${req.file.filename}`;
    res.json({ url: fileUrl, type: req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE' });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const addReaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const removeReaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
};

export const translateMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { content, messages } = req.body;

  if (!content && (!messages || !Array.isArray(messages))) {
    return res.status(400).json({ error: 'Content or messages array is required' });
  }

  try {
    const settings = await settingsService.getAll();
    let models: AIModelOption[] = [];
    if (settings.AI_MODEL_OPTIONS) {
      try {
        const parsed = JSON.parse(settings.AI_MODEL_OPTIONS);
        if (Array.isArray(parsed)) {
          models = parsed as AIModelOption[];
        }
      } catch {}
    }

    // 1. Find enabled translation model by capability, name or description
    const translationModel = models.find((m) =>
      m.enabled && (
        (m.capabilities && m.capabilities.some(c => c.toLowerCase().includes('translate') || c.toLowerCase().includes('translation'))) ||
        (m.name && (m.name.toLowerCase().includes('translate') || m.name.toLowerCase().includes('translation') || m.name.includes('翻译'))) ||
        (m.modelName && (m.modelName.toLowerCase().includes('translate') || m.modelName.toLowerCase().includes('translation'))) ||
        (m.description && (m.description.toLowerCase().includes('translate') || m.description.toLowerCase().includes('translation') || m.description.includes('翻译')))
      )
    );

    // 2. Prepare items to translate
    const listToTranslate = content ? [{ id: 'single', content }] : messages;

    const systemPrompt = `You are a professional translation assistant.
Your task is to translate a list of chat messages between Chinese and English:
- If a message is written in Chinese, translate it to natural, fluent English.
- If a message is written in English or any other language, translate it to natural, fluent Chinese.
- You MUST output the result as a raw JSON array matching this exact format:
[
  {
    "id": "message_id",
    "translation": "translated_text"
  }
]
- Do NOT include any markdown code wrappers (like \`\`\`), preambles, notes, explanations, or quotes. Output ONLY the raw JSON string.`;

    const userPrompt = `Please translate these chat messages:\n${JSON.stringify(listToTranslate, null, 2)}`;

    let responseText = '';

    if (translationModel) {
      const overrides = {
        AI_IMPORT_ENABLED: true,
        AI_PROVIDER: translationModel.provider,
        AI_API_KEY: translationModel.apiKey || (translationModel.apiKeys && translationModel.apiKeys[0]) || settings.AI_API_KEY,
        AI_API_ENDPOINT: translationModel.endpoint || settings.AI_API_ENDPOINT,
        AI_MODEL_NAME: translationModel.modelName,
        capabilities: translationModel.capabilities,
      };

      try {
        logger.info(`[Message Translate] Batch translating using translation model: ${translationModel.name || translationModel.modelName}`);
        responseText = await callLLM(userPrompt, systemPrompt, overrides);
      } catch (err) {
        logger.warn(`[Message Translate] Custom translation model call failed, falling back to auto model:`, err);
        responseText = await callLLMWithFailover(userPrompt, systemPrompt);
      }
    } else {
      logger.info(`[Message Translate] No translation model configured, using default auto model`);
      responseText = await callLLMWithFailover(userPrompt, systemPrompt);
    }

    // 3. Robust JSON Parsing
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
    }
    
    let resultList: Array<{ id: string; translation: string }> = [];
    try {
      resultList = JSON.parse(cleaned);
    } catch (e) {
      logger.warn(`[Message Translate] Direct JSON parse failed, trying regex match:`, e);
      const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        resultList = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI translation JSON response');
      }
    }

    // 4. Return results
    if (content) {
      const singleTranslation = resultList.find(item => item.id === 'single')?.translation || '';
      return res.json({ translation: singleTranslation });
    }

    return res.json({ translations: resultList });
  } catch (error) {
    logger.error('Translate message error:', error);
    next(error);
  }
};

// NOTE: usedBytes in storageConfig is NOT automatically updated when files are uploaded
// via presigned URLs (direct S3/R2 upload), because the server has no upload-complete
// callback. The admin can sync usage manually via the Storage Settings panel.
// getActiveStorageConfig('ALL') is the shared helper from metadata.helper.
const getActiveStorage = () => getActiveStorageConfig('ALL');

export const getPresignedUrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { filename, mimetype, size } = req.body;
  if (!filename || !mimetype) {
    return res.status(400).json({ error: 'filename and mimetype are required' });
  }

  try {
    const raw = await getActiveStorage();
    if (!raw) {
      return res.json({ isDirect: false });
    }

    const limitBytes = raw.limitGb * 1000 * 1000 * 1000;
    if (size && raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    const config = buildDecryptedStorageConfig(raw);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = filename.replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_').replace(/\s+/g, '_');
    const key = `messages/${uniqueSuffix}/${sanitized}`;

    const uploadUrl = await storageService.getPresignedUploadUrl(config, key, mimetype);
    const publicUrlBase = config.publicUrl.replace(/\/$/, '');
    const publicUrl = `${publicUrlBase}/${key}`;

    res.json({
      isDirect: true,
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    logger.error('Get presigned url error:', error);
    next(error);
  }
};

export const initiateMultipartUpload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { filename, mimetype, size } = req.body;
  if (!filename || !mimetype) {
    return res.status(400).json({ error: 'filename and mimetype are required' });
  }

  try {
    const raw = await getActiveStorage();
    if (!raw) {
      return res.json({ isDirect: false });
    }

    const limitBytes = raw.limitGb * 1000 * 1000 * 1000;
    if (size && raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    const config = buildDecryptedStorageConfig(raw);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = filename.replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_').replace(/\s+/g, '_');
    const key = `messages/${uniqueSuffix}/${sanitized}`;

    const uploadId = await storageService.initiateMultipartUpload(config, key, mimetype);
    res.json({
      isDirect: true,
      uploadId,
      key,
    });
  } catch (error) {
    logger.error('Initiate multipart upload error:', error);
    next(error);
  }
};

export const getPresignedUploadPartUrls = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { key, uploadId, partNumbers } = req.body;
  if (!key || !uploadId || !Array.isArray(partNumbers)) {
    return res.status(400).json({ error: 'key, uploadId, and partNumbers are required' });
  }

  try {
    const raw = await getActiveStorage();
    if (!raw) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }

    const config = buildDecryptedStorageConfig(raw);
    const urls: Record<number, string> = {};
    for (const partNum of partNumbers) {
      const url = await storageService.getPresignedUploadPartUrl(config, key, uploadId, partNum);
      urls[partNum] = url;
    }
    res.json({ urls });
  } catch (error) {
    logger.error('Get presigned upload part urls error:', error);
    next(error);
  }
};

export const completeMultipartUpload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { key, uploadId, parts } = req.body;
  if (!key || !uploadId || !Array.isArray(parts)) {
    return res.status(400).json({ error: 'key, uploadId, and parts are required' });
  }

  try {
    const raw = await getActiveStorage();
    if (!raw) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }

    const config = buildDecryptedStorageConfig(raw);
    const finalUrl = await storageService.completeMultipartUpload(config, key, uploadId, parts);
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(key);

    res.json({
      url: finalUrl,
      type: isImage ? 'IMAGE' : 'FILE',
    });
  } catch (error) {
    logger.error('Complete multipart upload error:', error);
    next(error);
  }
};

export const abortMultipartUpload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { key, uploadId } = req.body;
  if (!key || !uploadId) {
    return res.status(400).json({ error: 'key and uploadId are required' });
  }

  try {
    const raw = await getActiveStorage();
    if (!raw) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }

    const config = buildDecryptedStorageConfig(raw);
    await storageService.abortMultipartUpload(config, key, uploadId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Abort multipart upload error:', error);
    next(error);
  }
};
