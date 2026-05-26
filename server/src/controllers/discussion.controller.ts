import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser, emitToAll } from '../services/socket.service';
import { createNotification } from '../utils/notification';
import { AppError } from '../middlewares/error.middleware';
import { clampLimit, clampPage } from '../utils/pagination';
import { sanitizeHtml } from '../utils/sanitize';

export const getAllDiscussions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId, tag, sort } = req.query;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 10, 50);
  const search = req.query.search as string;
  const skip = (page - 1) * limit;

  try {
    const where: Prisma.DiscussionWhereInput = {};
    if (courseId) where.courseId = courseId as string;
    if (tag) {
      where.tags = { contains: tag as string };
    }
    if (search) {
      where.OR = [{ title: { contains: search } }, { content: { contains: search } }];
    }

    let orderBy: Prisma.DiscussionOrderByWithRelationInput[] = [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ];
    if (sort === 'most_commented') {
      orderBy = [{ isPinned: 'desc' }, { comments: { _count: 'desc' } }];
    } else if (sort === 'most_liked') {
      orderBy = [{ isPinned: 'desc' }, { likes: { _count: 'desc' } }];
    } else if (sort === 'most_viewed') {
      orderBy = [{ isPinned: 'desc' }, { viewCount: 'desc' }];
    }

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { comments: true, likes: true },
          },
          likes: {
            where: { userId: req.userId },
            select: { id: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.discussion.count({ where }),
    ]);

    const discussionsWithLiked = discussions.map((d) => ({
      ...d,
      isLiked: d.likes.length > 0,
      likes: undefined,
    }));

    res.json({
      discussions: discussionsWithLiked,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDiscussionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return next(new AppError('Discussion not found', 404));

    const discussion = await prisma.discussion.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
            likes: {
              where: { userId: req.userId },
              select: { id: true },
            },
            _count: {
              select: { likes: true, replies: true },
            },
            replies: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
                likes: {
                  where: { userId: req.userId },
                  select: { id: true },
                },
                _count: {
                  select: { likes: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          where: { userId: req.userId },
          select: { id: true },
        },
      },
    });

    if (!discussion) return next(new AppError('Discussion not found', 404));

    const formattedComments = discussion.comments.map((c) => ({
      ...c,
      isLiked: c.likes.length > 0,
      likes: undefined,
      replies: c.replies.map((r) => ({
        ...r,
        isLiked: r.likes.length > 0,
        likes: undefined,
      })),
    }));

    res.json({
      ...discussion,
      isLiked: discussion.likes.length > 0,
      likes: undefined,
      comments: formattedComments,
    });
  } catch (error) {
    next(error);
  }
};

export const createDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, content, courseId, tags } = req.body;
  const files = req.files as Express.Multer.File[] | undefined;

  if (!title || !title.trim()) {
    return next(new AppError('标题不能为空', 400));
  }
  if (!content || !content.trim()) {
    return next(new AppError('内容不能为空', 400));
  }

  try {
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = files.map(
        (file) => `${req.protocol}://${req.get('host')}/uploads/discussions/${file.filename}`,
      );
    }

    const discussion = await prisma.discussion.create({
      data: {
        title: sanitizeHtml(title.trim()),
        content: sanitizeHtml(content.trim()),
        courseId,
        tags: tags || null,
        userId: req.userId as string,
        images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      },
    });

    emitToAll('new_activity', {
      id: `d-${discussion.id}`,
      user: req.user?.name || '有人',
      action: '发起了新讨论',
      target: discussion.title,
      createdAt: discussion.createdAt,
    });

    res.status(201).json(discussion);
  } catch (error) {
    next(error);
  }
};

export const deleteDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!discussion) return next(new AppError('Discussion not found', 404));
    if (discussion.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized', 403));
    }

    await prisma.discussion.delete({ where: { id } });
    res.json({ message: 'Discussion deleted' });
  } catch (error) {
    next(error);
  }
};

export const toggleLikeDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const discussionId = req.params.id as string;
  try {
    const existing = await prisma.discussionLike.findUnique({
      where: { discussionId_userId: { discussionId, userId: req.userId! } },
    });

    if (existing) {
      await prisma.discussionLike.delete({ where: { id: existing.id } });
      res.json({ isLiked: false });
    } else {
      await prisma.discussionLike.create({
        data: { discussionId, userId: req.userId! },
      });

      const discussion = await prisma.discussion.findUnique({
        where: { id: discussionId },
        select: { userId: true, title: true },
      });
      if (discussion && discussion.userId !== req.userId) {
        await createNotification({
          type: 'LIKE',
          title: '收到点赞',
          content: `${req.user?.name || '有人'} 赞了你的讨论: ${discussion.title}`,
          userId: discussion.userId,
          link: `/discussions`,
          category: 'MENTION',
        });
      }

      res.json({ isLiked: true });
    }
  } catch (error) {
    next(error);
  }
};

export const togglePinDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    if (req.user?.role !== 'ADMIN') {
      return next(new AppError('Only admins can pin discussions', 403));
    }

    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { isPinned: true },
    });
    if (!discussion) return next(new AppError('Discussion not found', 404));

    const updated = await prisma.discussion.update({
      where: { id },
      data: { isPinned: !discussion.isPinned },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { discussionId, content, parentId } = req.body;

  if (!discussionId) {
    return next(new AppError('讨论ID不能为空', 400));
  }
  if (!content || !content.trim()) {
    return next(new AppError('评论内容不能为空', 400));
  }

  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
    });
    if (!discussion) {
      return next(new AppError('讨论不存在', 404));
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment) {
        return next(new AppError('父评论不存在', 404));
      }
      if (parentComment.discussionId !== discussionId) {
        return next(new AppError('父评论不属于该讨论', 400));
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: sanitizeHtml(content.trim()),
        discussionId,
        parentId: parentId || null,
        userId: req.userId as string,
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        discussion: {
          select: { userId: true, title: true },
        },
        _count: {
          select: { likes: true, replies: true },
        },
      },
    });

    if (comment.discussion.userId !== req.userId) {
      await createNotification({
        type: 'MESSAGE',
        title: '收到新回复',
        content: `${req.user?.name || '有人'} 回复了你的讨论: ${comment.discussion.title}`,
        userId: comment.discussion.userId,
        link: `/discussions`,
        category: 'MENTION',
      });
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });
      if (parentComment && parentComment.userId !== req.userId) {
        await createNotification({
          type: 'MESSAGE',
          title: '收到新回复',
          content: `${req.user?.name || '有人'} 回复了你的评论`,
          userId: parentComment.userId,
          link: `/discussions`,
          category: 'MENTION',
        });
      }
    }

    const { discussion: _discussion, ...commentData } = comment;
    res.status(201).json({
      ...commentData,
      isLiked: false,
      replies: [],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!comment) return next(new AppError('Comment not found', 404));
    if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized', 403));
    }

    await prisma.comment.delete({ where: { id } });
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

export const toggleLikeComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.id as string;
  try {
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: req.userId! } },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      res.json({ isLiked: false });
    } else {
      await prisma.commentLike.create({
        data: { commentId, userId: req.userId! },
      });
      res.json({ isLiked: true });
    }
  } catch (error) {
    next(error);
  }
};

export const getDiscussionTags = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const discussions = await prisma.discussion.findMany({
      where: { tags: { not: null } },
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    discussions.forEach((d) => {
      if (d.tags) {
        try {
          const tags = JSON.parse(d.tags);
          if (Array.isArray(tags)) {
            tags.forEach((t: string) => tagSet.add(t));
          }
        } catch {}
      }
    });

    res.json({ tags: Array.from(tagSet) });
  } catch (error) {
    next(error);
  }
};
