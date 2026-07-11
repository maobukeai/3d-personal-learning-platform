import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../services/prisma';
import { createNotification } from '../../utils/notification';
import { AppError } from '../../utils/error';
import { clampLimit, clampPage } from '../../utils/pagination';
import { sanitizeMarkdown } from '../../utils/sanitize';
import { awardPoints, deductPoints, PointsAction } from '../../services/points.service';
import { withRowLock } from '../../utils/dbLock';
import { fastifyAuthenticate, fastifyOptionalAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import type { UploadedFile } from '../../types/upload';

/**
 * Fastify 讨论路由（铁律六·1 渐进式迁移）。
 *
 * 挂载前缀: /api/fastify/discussions
 *
 * 业务逻辑从 Express discussion.controller.ts 移植而来，仅适配 Fastify
 * request/reply 签名；复用同款 prisma / socket.service / notification /
 * points / sanitize / withRowLock 等共享模块。
 *
 * 跳过端点（保留在 Express，因使用 multer 文件上传）：
 *  - POST / （createDiscussion 使用 upload.array('images', 5)）
 *
 * 公开读路由使用 fastifyOptionalAuthenticate（游客可读，登录用户附加 isLiked）。
 * 写路由使用 fastifyAuthenticate。
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const idParamsSchema = z.object({
  id: z.string().min(1, 'Discussion id is required'),
});

const commentIdParamsSchema = z.object({
  id: z.string().min(1, 'Comment id is required'),
});

const listDiscussionsQuerySchema = z.object({
  courseId: z.string().optional(),
  tag: z.string().optional(),
  sort: z.string().optional(),
  filter: z.string().optional(),
  search: z.string().optional(),
  page: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
});

const addCommentBodySchema = z.object({
  discussionId: z.string().min(1, '讨论ID不能为空'),
  content: z.string().min(1, '评论内容不能为空'),
  parentId: z.string().optional().nullable(),
});

// Comment anti-spam rate limit (matches Express commentLimiter: 10/min)
const COMMENT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerDiscussionRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------------------------------
  // Public read routes (optional auth)
  // -------------------------------------------------------------------------

  // GET /tags —— 获取所有讨论标签
  app.get(
    '/tags',
    {
      preHandler: [fastifyOptionalAuthenticate],
    },
    async (_request, reply) => {
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

      return reply.send({ tags: Array.from(tagSet) });
    },
  );

  // GET /insights —— 讨论洞察（统计、趋势、贡献者）
  app.get(
    '/insights',
    {
      preHandler: [fastifyOptionalAuthenticate],
    },
    async (request, reply) => {
      const userId = request.userId || '';

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
              where: { userId },
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

      return reply.send({
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
    },
  );

  // GET / —— 获取讨论列表
  app.get(
    '/',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { querystring: listDiscussionsQuerySchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const query = request.query as {
        courseId?: string;
        tag?: string;
        sort?: string;
        filter?: string;
        search?: string;
        page?: string | number;
        limit?: string | number;
      };
      const { courseId, tag, sort, filter, search } = query;
      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 12, 50);
      const skip = (page - 1) * limit;

      const where: Prisma.DiscussionWhereInput = {};
      if (courseId) where.courseId = courseId;
      if (tag) {
        where.tags = { contains: tag };
      }
      if (search) {
        where.OR = [{ title: { contains: search } }, { content: { contains: search } }];
      }
      if (filter === 'mine') {
        where.userId = userId;
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
              where: { userId },
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

      return reply.send({
        discussions: discussionsWithLiked,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    },
  );

  // GET /:id —— 获取单个讨论（含评论树）
  app.get(
    '/:id',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { id } = request.params as { id: string };

      const existing = await prisma.discussion.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw new AppError('Discussion not found', 404, 'DISCUSSION_NOT_FOUND');
      }

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
                where: { userId },
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
                    where: { userId },
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
            where: { userId },
            select: { id: true },
          },
        },
      });

      if (!discussion) {
        throw new AppError('Discussion not found', 404, 'DISCUSSION_NOT_FOUND');
      }

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

      return reply.send({
        ...discussion,
        isLiked: discussion.likes.length > 0,
        likes: undefined,
        comments: formattedComments,
      });
    },
  );

  // -------------------------------------------------------------------------
  // Authenticated write routes
  // -------------------------------------------------------------------------

  // DELETE /:id —— 删除讨论
  app.delete(
    '/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { id } = request.params as { id: string };

      const discussion = await prisma.discussion.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!discussion) {
        throw new AppError('Discussion not found', 404, 'DISCUSSION_NOT_FOUND');
      }
      if (discussion.userId !== userId && request.user?.role !== 'ADMIN') {
        throw new AppError('Not authorized', 403, 'FORBIDDEN');
      }

      await prisma.discussion.delete({ where: { id } });
      await deductPoints(discussion.userId, PointsAction.CREATE_DISCUSSION);

      return reply.send({ message: 'Discussion deleted' });
    },
  );

  // POST /:id/like —— 点赞/取消点赞讨论
  app.post(
    '/:id/like',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { id: discussionId } = request.params as { id: string };

      const result = await prisma.$transaction(async (tx) => {
        // 铁律六·3 — lock the Discussion row to prevent concurrent like races
        // that would otherwise allow duplicate likes or lost toggles.
        return await withRowLock(tx, 'Discussion', discussionId, async (lockedTx) => {
          const existing = await lockedTx.discussionLike.findUnique({
            where: { discussionId_userId: { discussionId, userId } },
          });

          if (existing) {
            await lockedTx.discussionLike.delete({ where: { id: existing.id } });
            return { isLiked: false };
          } else {
            await lockedTx.discussionLike.create({
              data: { discussionId, userId },
            });
            return { isLiked: true };
          }
        });
      });

      if (result.isLiked) {
        await awardPoints(userId, PointsAction.LIKE_CONTENT);

        const discussion = await prisma.discussion.findUnique({
          where: { id: discussionId },
          select: { userId: true, title: true },
        });
        if (discussion && discussion.userId !== userId) {
          await createNotification({
            type: 'LIKE',
            title: '收到点赞',
            content: `${request.user?.name || '有人'} 赞了你的讨论: ${discussion.title}`,
            userId: discussion.userId,
            link: `/discussions`,
            category: 'MENTION',
          });
        }
      } else {
        await deductPoints(userId, PointsAction.LIKE_CONTENT);
      }

      return reply.send(result);
    },
  );

  // POST /:id/pin —— 置顶/取消置顶讨论（仅管理员）
  app.post(
    '/:id/pin',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      if (request.user?.role !== 'ADMIN') {
        throw new AppError('Only admins can pin discussions', 403, 'FORBIDDEN');
      }

      const { id } = request.params as { id: string };

      const discussion = await prisma.discussion.findUnique({
        where: { id },
        select: { isPinned: true },
      });
      if (!discussion) {
        throw new AppError('Discussion not found', 404, 'DISCUSSION_NOT_FOUND');
      }

      const updated = await prisma.discussion.update({
        where: { id },
        data: { isPinned: !discussion.isPinned },
      });

      return reply.send(updated);
    },
  );

  // POST /comments —— 添加评论（含限流）
  app.post(
    '/comments',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: addCommentBodySchema },
      config: { rateLimit: COMMENT_RATE_LIMIT },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { discussionId, content, parentId } = request.body as {
        discussionId: string;
        content: string;
        parentId?: string | null;
      };

      const comment = await prisma.$transaction(async (tx) => {
        const discussion = await tx.discussion.findUnique({
          where: { id: discussionId },
        });
        if (!discussion) {
          throw new AppError('讨论不存在', 404, 'DISCUSSION_NOT_FOUND');
        }

        if (parentId) {
          const parentComment = await tx.comment.findUnique({
            where: { id: parentId },
          });
          if (!parentComment) {
            throw new AppError('父评论不存在', 404, 'COMMENT_NOT_FOUND');
          }
          if (parentComment.discussionId !== discussionId) {
            throw new AppError('父评论不属于该讨论', 400, 'VALIDATION_ERROR');
          }
        }

        const newComment = await tx.comment.create({
          data: {
            content: sanitizeMarkdown(content.trim()),
            discussionId,
            parentId: parentId || null,
            userId,
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

        await tx.discussion.update({
          where: { id: discussionId },
          data: { updatedAt: new Date() },
        });

        return newComment;
      });

      await awardPoints(userId, PointsAction.CREATE_COMMENT);

      if (comment.discussion.userId !== userId) {
        await createNotification({
          type: 'MESSAGE',
          title: '收到新回复',
          content: `${request.user?.name || '有人'} 回复了你的讨论: ${comment.discussion.title}`,
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
        if (parentComment && parentComment.userId !== userId) {
          await createNotification({
            type: 'MESSAGE',
            title: '收到新回复',
            content: `${request.user?.name || '有人'} 回复了你的评论`,
            userId: parentComment.userId,
            link: `/discussions`,
            category: 'MENTION',
          });
        }
      }

      const { discussion: _discussion, ...commentData } = comment;
      return reply.status(201).send({
        ...commentData,
        isLiked: false,
        replies: [],
      });
    },
  );

  // POST /comments/:id/like —— 点赞/取消点赞评论
  app.post(
    '/comments/:id/like',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: commentIdParamsSchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { id: commentId } = request.params as { id: string };

      const result = await prisma.$transaction(async (tx) => {
        // 铁律六·3 — lock the Comment row to prevent concurrent like races.
        return await withRowLock(tx, 'Comment', commentId, async (lockedTx) => {
          const existing = await lockedTx.commentLike.findUnique({
            where: { commentId_userId: { commentId, userId } },
          });

          if (existing) {
            await lockedTx.commentLike.delete({ where: { id: existing.id } });
            return { isLiked: false };
          } else {
            await lockedTx.commentLike.create({
              data: { commentId, userId },
            });
            return { isLiked: true };
          }
        });
      });

      if (result.isLiked) {
        await awardPoints(userId, PointsAction.LIKE_CONTENT);
      } else {
        await deductPoints(userId, PointsAction.LIKE_CONTENT);
      }

      return reply.send(result);
    },
  );

  // DELETE /comments/:id —— 删除评论
  app.delete(
    '/comments/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: commentIdParamsSchema },
    },
    async (request, reply) => {
      const userId = request.userId || '';
      const { id } = request.params as { id: string };

      const comment = await prisma.comment.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!comment) {
        throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
      }
      if (comment.userId !== userId && request.user?.role !== 'ADMIN') {
        throw new AppError('Not authorized', 403, 'FORBIDDEN');
      }

      await prisma.comment.delete({ where: { id } });
      await deductPoints(comment.userId, PointsAction.CREATE_COMMENT);

      return reply.send({ message: 'Comment deleted' });
    },
  );

  // POST / —— 创建讨论
  app.post(
    '/',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'images', maxCount: 5 }])],
    },
    async (request, reply) => {
      const { title, content, courseId, tags } = request.body as {
        title: string;
        content: string;
        courseId?: string;
        tags?: string;
      };
      const files = (request as FastifyRequest & { files?: Record<string, UploadedFile[]> })?.files
        ?.images;

      if (!title || !title.trim()) {
        throw new AppError('标题不能为空', 400);
      }
      if (!content || !content.trim()) {
        throw new AppError('内容不能为空', 400);
      }

      let imageUrls: string[] = [];
      if (files && files.length > 0) {
        imageUrls = files.map((file) => {
          if (!file.url) {
            throw new Error(`文件上传失败：未获取到云存储地址 (field=${file.fieldname})`);
          }
          return file.url;
        });
      }

      const discussion = await prisma.$transaction(async (tx) => {
        const created = await tx.discussion.create({
          data: {
            title: sanitizeMarkdown(title.trim()),
            content: sanitizeMarkdown(content.trim()),
            courseId,
            tags: tags || null,
            userId: request.userId as string,
            images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
          },
        });

        await awardPoints(request.userId as string, PointsAction.CREATE_DISCUSSION, tx);
        return created;
      });

      const { emitToAll } = await import('../../services/socket.service');
      emitToAll('new_activity', {
        id: `d-${discussion.id}`,
        user: request.user?.name || '有人',
        action: '发起了新讨论',
        target: discussion.title,
        createdAt: discussion.createdAt,
      });

      return reply.status(201).send(discussion);
    },
  );
};
