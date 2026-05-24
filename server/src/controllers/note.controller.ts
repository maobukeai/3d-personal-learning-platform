import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { clampLimit, clampPage } from '../utils/pagination';

export const getNotes = async (req: AuthRequest, res: Response) => {
  const { visibility, search, sort, tag, category, author } = req.query;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 12, 100);
  const skip = (page - 1) * limit;

  try {
    const where: any = {};

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

    let orderBy: any = [{ isPinned: 'desc' as const }, { createdAt: 'desc' as const }];
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
    console.error('Get notes error:', error);
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
    console.error('Get popular notes error:', error);
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
      where: { id: id as any },
      select: { isPopular: true, visibility: true },
    });

    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.visibility !== 'PUBLIC' && !note.isPopular) {
      return res.status(400).json({ error: '只有公开笔记可以推流到热门' });
    }

    const updated = await prisma.note.update({
      where: { id: id as any },
      data: { isPopular: !note.isPopular },
    });

    res.json({ isPopular: updated.isPopular });
  } catch (error) {
    console.error('Toggle popular note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNoteById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.note.findUnique({
      where: { id: id as any },
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
      where: { id: id as any },
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
    console.error('Get note by id error:', error);
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
        title: title.trim(),
        content: content.trim(),
        summary: summary?.trim() || null,
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
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNote = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, summary, visibility, tags, category } = req.body;

  try {
    const note = await prisma.note.findUnique({
      where: { id: id as any },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权修改此笔记' });
    }

    const updated = await prisma.note.update({
      where: { id: id as any },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(summary !== undefined && { summary: summary?.trim() || null }),
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
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNote = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id: id as any },
      select: { userId: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权删除此笔记' });
    }

    await prisma.note.delete({ where: { id: id as any } });
    res.json({ message: '笔记已删除' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLikeNote = async (req: AuthRequest, res: Response) => {
  const noteId = req.params.id as string;
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, visibility: true },
    });
    if (!note) return res.status(404).json({ error: '笔记不存在' });
    if (note.visibility === 'PRIVATE') {
      return res.status(400).json({ error: '私有笔记不能被点赞' });
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
    console.error('Toggle like note error:', error);
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
    console.error('Get note tags error:', error);
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
    console.error('Get note categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
