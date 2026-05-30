import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { clampLimit, clampPage } from '../utils/pagination';
import { sanitizeHtml } from '../utils/sanitize';

export const getNotes = async (req: AuthRequest, res: Response) => {
  const { visibility, search, sort, tag, category, author } = req.query;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 12, 100);
  const skip = (page - 1) * limit;

  try {
    const where: Prisma.NoteWhereInput = {};

    if (author === 'me') {
      where.userId = req.userId;
      if (visibility === 'PUBLIC') {
        where.visibility = 'PUBLIC';
      } else if (visibility === 'PRIVATE') {
        where.visibility = 'PRIVATE';
      }
    } else {
      if (visibility === 'PUBLIC') {
        where.visibility = 'PUBLIC';
      } else if (visibility === 'PRIVATE') {
        where.visibility = 'PRIVATE';
        where.userId = req.userId;
      } else {
        where.OR = [{ visibility: 'PUBLIC' }, { visibility: 'PRIVATE', userId: req.userId }];
      }
    }

    if (search) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [
            { title: { contains: search as string } },
            { content: { contains: search as string } },
            { summary: { contains: search as string } },
          ],
        },
      ];
      delete where.OR;
    }

    if (tag) {
      where.tags = { contains: tag as string };
    }

    if (category) {
      if (category === '__uncategorized__') {
        where.category = null;
      } else {
        where.category = category as string;
      }
    }

    let orderBy: Prisma.NoteOrderByWithRelationInput[] = [
      { isPinned: 'desc' as const },
      { createdAt: 'desc' as const },
    ];
    if (sort === 'most_liked') {
      orderBy = [{ isPinned: 'desc' as const }, { likes: { _count: 'desc' as const } }];
    } else if (sort === 'most_viewed') {
      orderBy = [{ isPinned: 'desc' as const }, { views: 'desc' as const }];
    } else if (sort === 'oldest') {
      orderBy = [{ isPinned: 'desc' as const }, { createdAt: 'asc' as const }];
    }

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { likes: true, comments: true },
          },
          likes: {
            where: { userId: req.userId },
            select: { userId: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.note.count({ where }),
    ]);

    const notesWithLiked = notes.map((n) => ({
      ...n,
      isLiked: n.likes.length > 0,
      likes: undefined,
    }));

    res.json({
      notes: notesWithLiked,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPopularNotes = async (req: AuthRequest, res: Response) => {
  try {
    const notes = await prisma.note.findMany({
      where: { visibility: 'PUBLIC', isPopular: true },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId },
          select: { userId: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });

    const notesWithLiked = notes.map((n) => ({
      ...n,
      isLiked: n.likes.length > 0,
      likes: undefined,
    }));

    res.json(notesWithLiked);
  } catch (error) {
    logger.error('Get popular notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const togglePopularNote = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '只有管理员可以推流笔记' });
  }

  try {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { isPopular: true, visibility: true },
    });

    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.visibility !== 'PUBLIC' && !note.isPopular) {
      return res.status(400).json({ error: '只有公开笔记可以推流到热门' });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: { isPopular: !note.isPopular },
    });

    res.json({ isPopular: updated.isPopular });
  } catch (error) {
    logger.error('Toggle popular note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNoteById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.note.findUnique({
      where: { id },
      select: { id: true, visibility: true, userId: true },
    });
    if (!existing) return res.status(404).json({ error: '笔记不存在' });

    if (
      existing.visibility === 'PRIVATE' &&
      existing.userId !== req.userId &&
      req.user?.role !== 'ADMIN'
    ) {
      return res.status(403).json({ error: '无权查看此笔记' });
    }

    const note = await prisma.note.update({
      where: { id },
      data: { views: { increment: 1 } },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId },
          select: { userId: true },
        },
      },
    });

    res.json({
      ...note,
      isLiked: note.likes.length > 0,
      likes: undefined,
    });
  } catch (error) {
    logger.error('Get note by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNote = async (req: AuthRequest, res: Response) => {
  const { title, content, summary, visibility, tags, category } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  try {
    const note = await prisma.note.create({
      data: {
        title: sanitizeHtml(title.trim()),
        content: sanitizeHtml(content.trim()),
        summary: summary ? sanitizeHtml(summary.trim()) : null,
        visibility: visibility || 'PRIVATE',
        tags: tags || null,
        category: category?.trim() || null,
        userId: req.userId as string,
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    res.status(201).json({ ...note, isLiked: false });
  } catch (error) {
    logger.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNote = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, summary, visibility, tags, category } = req.body;

  try {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权修改此笔记' });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: sanitizeHtml(title.trim()) }),
        ...(content !== undefined && { content: sanitizeHtml(content.trim()) }),
        ...(summary !== undefined && { summary: summary ? sanitizeHtml(summary.trim()) : null }),
        ...(visibility !== undefined && { visibility }),
        ...(tags !== undefined && { tags }),
        ...(category !== undefined && { category: category?.trim() || null }),
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId },
          select: { userId: true },
        },
      },
    });

    res.json({
      ...updated,
      isLiked: updated.likes.length > 0,
      likes: undefined,
    });
  } catch (error) {
    logger.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNote = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权删除此笔记' });
    }

    await prisma.note.delete({ where: { id } });
    res.json({ message: '笔记已删除' });
  } catch (error) {
    logger.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLikeNote = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, visibility: true, userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.visibility === 'PRIVATE' && note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权操作此私有笔记' });
    }

    const existing = await prisma.noteLike.findUnique({
      where: { noteId_userId: { noteId, userId: req.userId! } },
    });

    if (existing) {
      await prisma.noteLike.delete({
        where: { noteId_userId: { noteId, userId: req.userId! } },
      });
      res.json({ isLiked: false });
    } else {
      await prisma.noteLike.create({
        data: { noteId, userId: req.userId! },
      });
      res.json({ isLiked: true });
    }
  } catch (error) {
    logger.error('Toggle like note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNoteTags = async (req: AuthRequest, res: Response) => {
  try {
    const notes = await prisma.note.findMany({
      where: {
        tags: { not: null },
        OR: [{ visibility: 'PUBLIC' }, { visibility: 'PRIVATE', userId: req.userId }],
      },
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (n.tags) {
        try {
          const tags = JSON.parse(n.tags);
          if (Array.isArray(tags)) {
            tags.forEach((t: string) => tagSet.add(t));
          }
        } catch {}
      }
    });

    res.json({ tags: Array.from(tagSet) });
  } catch (error) {
    logger.error('Get note tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNoteCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.note.findMany({
      where: {
        category: { not: null },
        OR: [{ visibility: 'PUBLIC' }, { visibility: 'PRIVATE', userId: req.userId }],
      },
      select: { category: true },
      distinct: ['category'],
    });

    res.json({ categories: categories.map((c) => c.category).filter(Boolean) });
  } catch (error) {
    logger.error('Get note categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNoteShare = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权查看此笔记的分享配置' });
    }

    const share = await prisma.noteShare.findUnique({
      where: { noteId },
    });

    res.json(share);
  } catch (error) {
    logger.error('Get note share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createOrUpdateNoteShare = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  const { expireHours, customText } = req.body;

  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权修改此笔记的分享配置' });
    }

    let expiresAt: Date | null = null;
    if (expireHours && typeof expireHours === 'number' && expireHours > 0) {
      expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    } else if (req.body.expiresAt) {
      expiresAt = new Date(req.body.expiresAt);
    }

    const existing = await prisma.noteShare.findUnique({
      where: { noteId },
    });

    let share;
    if (existing) {
      share = await prisma.noteShare.update({
        where: { noteId },
        data: {
          expiresAt,
          customText: customText !== undefined ? customText || null : undefined,
        },
      });
    } else {
      share = await prisma.noteShare.create({
        data: {
          id: randomUUID(),
          noteId,
          userId: req.userId!,
          expiresAt,
          customText: customText || null,
        },
      });
    }

    res.json(share);
  } catch (error) {
    logger.error('Create/update note share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelNoteShare = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权取消此笔记的分享' });
    }

    await prisma.noteShare.deleteMany({
      where: { noteId },
    });

    res.json({ message: '分享已取消' });
  } catch (error) {
    logger.error('Cancel note share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicSharedNote = async (req: AuthRequest, res: Response) => {
  const shareId = req.params.shareId as string;
  try {
    const share = await prisma.noteShare.findUnique({
      where: { id: shareId },
      include: {
        note: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, bio: true },
            },
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ error: '分享链接不存在或已失效' });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({ error: '分享链接已过期且失效' });
    }

    await prisma.note.update({
      where: { id: share.noteId },
      data: { views: { increment: 1 } },
    });

    res.json({
      shareId: share.id,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      customText: share.customText,
      note: share.note,
    });
  } catch (error) {
    logger.error('Get public shared note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
