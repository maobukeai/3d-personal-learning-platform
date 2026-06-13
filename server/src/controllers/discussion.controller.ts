import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToAll } from '../services/socket.service';
import { createNotification } from '../utils/notification';
import { AppError } from '../middlewares/error.middleware';
import { clampLimit, clampPage } from '../utils/pagination';
import { sanitizeHtml } from '../utils/sanitize';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';

const userSelect = { id: true, name: true, avatarUrl: true } satisfies Prisma.UserSelect;

const parseTagList = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];
  } catch (_error) {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
};

const buildTagInsights = (rows: { tags: string | null }[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    parseTagList(row.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export const getAllDiscussions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId, tag, sort, filter } = req.query;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, 12, 50);
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
    if (filter === 'mine') {
      where.userId = req.userId || '';
    } else if (filter === 'unanswered') {
      where.comments = { none: {} };
    } else if (filter === 'pinned') {
      where.isPinned = true;
    }

    let orderBy: Prisma.DiscussionOrderByWithRelationInput[] = [
      { isPinned: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ];
    if (sort === 'most_commented') {
      orderBy = [{ isPinned: 'desc' }, { comments: { _count: 'desc' } }, { updatedAt: 'desc' }];
    } else if (sort === 'most_liked') {
      orderBy = [{ isPinned: 'desc' }, { likes: { _count: 'desc' } }, { updatedAt: 'desc' }];
    } else if (sort === 'most_viewed') {
      orderBy = [{ isPinned: 'desc' }, { viewCount: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'newest') {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where,
        include: {
          user: { select: userSelect },
          comments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              parentId: true,
              user: { select: userSelect },
              _count: { select: { likes: true, replies: true } },
            },
          },
          _count: {
            select: { comments: true, likes: true },
          },
          likes: {
            where: { userId: req.userId || '' },
            select: { id: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.discussion.count({ where }),
    ]);

    const discussionsWithLiked = discussions.map((discussion) => {
      const latestComment = discussion.comments[0] || null;
      const { comments: _comments, likes, ...discussionData } = discussion;
      return {
        ...discussionData,
        latestComment: latestComment ? { ...latestComment, replies: [] } : null,
        lastActivityAt: latestComment?.createdAt || discussion.updatedAt || discussion.createdAt,
        isLiked: likes.length > 0,
      };
    });

    res.json({
      discussions: discussionsWithLiked,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDiscussionInsights = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [
      discussionTotal,
      commentTotal,
      likeTotal,
      viewAggregate,
      activeAuthors,
      unansweredTotal,
      pinnedTotal,
      tagRows,
      trendingRows,
      recentComments,
      contributionDiscussions,
      contributionComments,
    ] = await Promise.all([
      prisma.discussion.count(),
      prisma.comment.count(),
      prisma.discussionLike.count(),
      prisma.discussion.aggregate({ _sum: { viewCount: true } }),
      prisma.discussion.findMany({ distinct: ['userId'], select: { userId: true } }),
      prisma.discussion.count({ where: { comments: { none: {} } } }),
      prisma.discussion.count({ where: { isPinned: true } }),
      prisma.discussion.findMany({
        where: { tags: { not: null } },
        select: { tags: true },
      }),
      prisma.discussion.findMany({
        include: {
          user: { select: userSelect },
          comments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              parentId: true,
              user: { select: userSelect },
              _count: { select: { likes: true, replies: true } },
            },
          },
          _count: { select: { comments: true, likes: true } },
          likes: {
            where: { userId: req.userId || '' },
            select: { id: true },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { viewCount: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
      prisma.comment.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: userSelect },
          discussion: { select: { id: true, title: true } },
        },
      }),
      prisma.discussion.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' },
        select: {
          user: { select: userSelect },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.comment.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' },
        select: {
          user: { select: userSelect },
        },
      }),
    ]);

    const trending = trendingRows.map((discussion) => {
      const latestComment = discussion.comments[0] || null;
      const { comments: _comments, likes, ...discussionData } = discussion;
      return {
        ...discussionData,
        latestComment: latestComment ? { ...latestComment, replies: [] } : null,
        lastActivityAt: latestComment?.createdAt || discussion.updatedAt || discussion.createdAt,
        isLiked: likes.length > 0,
      };
    });

    type Contributor = {
      user: { id: string; name: string | null; avatarUrl: string | null };
      discussions: number;
      comments: number;
      likesReceived: number;
    };
    const contributorMap = new Map<string, Contributor>();

    contributionDiscussions.forEach((discussion) => {
      const current = contributorMap.get(discussion.user.id) || {
        user: discussion.user,
        discussions: 0,
        comments: 0,
        likesReceived: 0,
      };
      current.discussions += 1;
      current.likesReceived += discussion._count.likes;
      contributorMap.set(discussion.user.id, current);
    });

    contributionComments.forEach((comment) => {
      const current = contributorMap.get(comment.user.id) || {
        user: comment.user,
        discussions: 0,
        comments: 0,
        likesReceived: 0,
      };
      current.comments += 1;
      contributorMap.set(comment.user.id, current);
    });

    const contributors = Array.from(contributorMap.values())
      .sort((a, b) => {
        const scoreA = a.discussions * 4 + a.comments + a.likesReceived * 2;
        const scoreB = b.discussions * 4 + b.comments + b.likesReceived * 2;
        return scoreB - scoreA;
      })
      .slice(0, 6);

    res.json({
      totals: {
        discussions: discussionTotal,
        comments: commentTotal,
        likes: likeTotal,
        views: viewAggregate._sum.viewCount || 0,
        activeAuthors: activeAuthors.length,
        unanswered: unansweredTotal,
        pinned: pinnedTotal,
      },
      tags: buildTagInsights(tagRows),
      trending,
      contributors,
      recentComments,
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
              where: { userId: req.userId || '' },
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
                  where: { userId: req.userId || '' },
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
          where: { userId: req.userId || '' },
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

    await awardPoints(req.userId as string, PointsAction.CREATE_DISCUSSION);

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
    await deductPoints(discussion.userId, PointsAction.CREATE_DISCUSSION);
    res.json({ message: 'Discussion deleted' });
  } catch (error) {
    next(error);
  }
};

export const toggleLikeDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const discussionId = req.params.id as string;
  try {
    const existing = await prisma.discussionLike.findUnique({
      where: { discussionId_userId: { discussionId, userId: req.userId || '' } },
    });

    if (existing) {
      await prisma.discussionLike.delete({ where: { id: existing.id } });
      await deductPoints(req.userId!, PointsAction.LIKE_CONTENT);
      res.json({ isLiked: false });
    } else {
      await prisma.discussionLike.create({
        data: { discussionId, userId: req.userId || '' },
      });

      await awardPoints(req.userId!, PointsAction.LIKE_CONTENT);

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

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { updatedAt: new Date() },
    });

    await awardPoints(req.userId as string, PointsAction.CREATE_COMMENT);

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
    await deductPoints(comment.userId, PointsAction.CREATE_COMMENT);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

export const toggleLikeComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.id as string;
  try {
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: req.userId || '' } },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      await deductPoints(req.userId!, PointsAction.LIKE_CONTENT);
      res.json({ isLiked: false });
    } else {
      await prisma.commentLike.create({
        data: { commentId, userId: req.userId || '' },
      });
      await awardPoints(req.userId!, PointsAction.LIKE_CONTENT);
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
        } catch (_err) {
          d.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((t: string) => tagSet.add(t));
        }
      }
    });

    res.json({ tags: Array.from(tagSet) });
  } catch (error) {
    next(error);
  }
};
