import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { clampLimit } from '../../utils/pagination';
import { notificationPreferencesSchema } from '../../utils/schemas-batch2';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 通知路由（原生 handler，无 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/notifications
 *  全部端点需鉴权（对齐 Express authenticate + notificationLimiter）。
 *
 * 端点：
 *  - GET    /latest-broadcast   获取最新广播
 *  - GET    /preferences        获取通知偏好
 *  - PUT    /preferences        更新通知偏好
 *  - GET    /                   获取我的通知（游标分页）
 *  - PUT    /read-all           全部标记已读
 *  - PUT    /:id/read           标记单条已读
 *  - DELETE /                   删除全部通知
 *  - DELETE /:id                删除单条通知
 *
 * 路由级限流：120/min（对齐 Express notificationLimiter）
 */

const requireUserId = (request: FastifyRequest): string => {
  if (!request.userId) {
    throw new AppError('登录会话已过期，请重新登录', 401, 'UNAUTHORIZED');
  }
  return request.userId;
};

const idParamsSchema = z.object({
  id: z.string().min(1, 'Notification id is required'),
});

const listNotificationsQuerySchema = z.object({
  type: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.union([z.string(), z.number()]).optional(),
});

export const registerNotificationRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    // Express notificationLimiter: 120 / minute
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  };

  // GET /notifications/latest-broadcast —— 获取最新广播
  app.get('/notifications/latest-broadcast', { ...auth }, async (_request, reply) => {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        NOT: {
          title: {
            startsWith: '[OFFLINE]',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return reply.send(broadcast);
  });

  // GET /notifications/preferences —— 获取通知偏好
  app.get('/notifications/preferences', { ...auth }, async (request, reply) => {
    const userId = requireUserId(request);
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return reply.send(prefs);
  });

  // PUT /notifications/preferences —— 更新通知偏好
  app.put(
    '/notifications/preferences',
    { ...auth, schema: { body: notificationPreferencesSchema } },
    async (request, reply) => {
      const userId = requireUserId(request);
      const {
        pushSystemUpdates,
        pushTeamActivity,
        pushMentions,
        pushDirectMessages,
        pushMarketing,
        emailSystemUpdates,
        emailTeamActivity,
        emailDirectMessages,
        emailMentions,
        emailMarketing,
      } = request.body as {
        pushSystemUpdates?: boolean;
        pushTeamActivity?: boolean;
        pushMentions?: boolean;
        pushDirectMessages?: boolean;
        pushMarketing?: boolean;
        emailSystemUpdates?: boolean;
        emailTeamActivity?: boolean;
        emailDirectMessages?: boolean;
        emailMentions?: boolean;
        emailMarketing?: boolean;
      };

      const prefs = await prisma.notificationPreference.upsert({
        where: { userId },
        update: {
          ...(pushSystemUpdates !== undefined && { pushSystemUpdates }),
          ...(pushTeamActivity !== undefined && { pushTeamActivity }),
          ...(pushMentions !== undefined && { pushMentions }),
          ...(pushDirectMessages !== undefined && { pushDirectMessages }),
          ...(pushMarketing !== undefined && { pushMarketing }),
          ...(emailSystemUpdates !== undefined && { emailSystemUpdates }),
          ...(emailTeamActivity !== undefined && { emailTeamActivity }),
          ...(emailDirectMessages !== undefined && { emailDirectMessages }),
          ...(emailMentions !== undefined && { emailMentions }),
          ...(emailMarketing !== undefined && { emailMarketing }),
        },
        create: {
          userId,
          pushSystemUpdates: pushSystemUpdates ?? true,
          pushTeamActivity: pushTeamActivity ?? true,
          pushMentions: pushMentions ?? true,
          pushDirectMessages: pushDirectMessages ?? true,
          pushMarketing: pushMarketing ?? false,
          emailSystemUpdates: emailSystemUpdates ?? true,
          emailTeamActivity: emailTeamActivity ?? true,
          emailDirectMessages: emailDirectMessages ?? true,
          emailMentions: emailMentions ?? true,
          emailMarketing: emailMarketing ?? false,
        },
      });
      return reply.send(prefs);
    },
  );

  // GET /notifications —— 获取我的通知（游标分页）
  app.get(
    '/notifications',
    { ...auth, schema: { querystring: listNotificationsQuerySchema } },
    async (request, reply) => {
      const userId = requireUserId(request);
      const query = request.query as { type?: string; cursor?: string; limit?: string | number };
      const { type, cursor } = query;
      const limit = clampLimit(query.limit, 20, 50);

      const where: Prisma.NotificationWhereInput = { userId };

      if (type && type !== 'all') {
        if (type === 'TEAM') {
          where.type = { in: ['TEAM', 'PROJECT_INVITE', 'TEAM_ACTIVITY'] };
        } else if (type === 'MESSAGE') {
          where.type = { in: ['MESSAGE', 'REPLY', 'MENTION'] };
        } else {
          where.type = type;
        }
      }

      const queryOptions: Prisma.NotificationFindManyArgs = {
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      };

      if (cursor) {
        queryOptions.cursor = { id: cursor };
        queryOptions.skip = 1;
      }

      const notifications = await prisma.notification.findMany(queryOptions);

      const nextCursor =
        notifications.length === limit ? notifications[notifications.length - 1]?.id : null;

      return reply.send({
        notifications,
        nextCursor,
      });
    },
  );

  // PUT /notifications/read-all —— 全部标记已读
  app.put('/notifications/read-all', { ...auth }, async (request, reply) => {
    const userId = requireUserId(request);
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return reply.send({ message: 'All notifications marked as read' });
  });

  // PUT /notifications/:id/read —— 标记单条已读
  app.put(
    '/notifications/:id/read',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await prisma.notification.update({
        where: { id, userId },
        data: { isRead: true },
      });
      return reply.send({ message: 'Notification marked as read' });
    },
  );

  // DELETE /notifications —— 删除全部通知
  app.delete('/notifications', { ...auth }, async (request, reply) => {
    const userId = requireUserId(request);
    await prisma.notification.deleteMany({
      where: { userId },
    });
    return reply.send({ message: 'All notifications deleted' });
  });

  // DELETE /notifications/:id —— 删除单条通知
  app.delete(
    '/notifications/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await prisma.notification.delete({
        where: { id, userId },
      });
      return reply.send({ message: 'Notification deleted' });
    },
  );
};
