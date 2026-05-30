import { logger } from '../utils/logger';
import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getNoteComments = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  try {
    // Verify note exists and check access permissions
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { visibility: true, userId: true },
    });

    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    if (note.visibility === 'PRIVATE' && note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      // Check if note is currently shared via a valid active share
      const isShared = await prisma.noteShare.findFirst({
        where: {
          noteId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!isShared) {
        return res.status(403).json({ error: '无权查看此私有笔记的评论' });
      }
    }

    const comments = await prisma.noteComment.findMany({
      where: { noteId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (error) {
    logger.error('Get note comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNoteComment = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }

  try {
    // Verify note exists and is accessible
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { visibility: true, userId: true },
    });

    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    if (note.visibility === 'PRIVATE' && note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      // Check if note is currently shared via a valid active share
      const isShared = await prisma.noteShare.findFirst({
        where: {
          noteId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!isShared) {
        return res.status(403).json({ error: '无权评论此私有笔记' });
      }
    }

    const comment = await prisma.noteComment.create({
      data: {
        content: content.trim(),
        noteId,
        userId: req.userId as string,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    logger.error('Create note comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNoteComment = async (req: AuthRequest, res: Response) => {
  const commentId = req.params.commentId as string;

  try {
    const comment = await prisma.noteComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await prisma.noteComment.delete({
      where: { id: commentId },
    });

    res.json({ message: '评论已删除' });
  } catch (error) {
    logger.error('Delete note comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
