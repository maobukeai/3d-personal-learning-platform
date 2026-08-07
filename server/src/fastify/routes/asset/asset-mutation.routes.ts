import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../../../services/prisma';
import { assetCommentSchema } from '../../../utils/schemas';
import {
  idParamsSchema,
  commentIdParamsSchema,
  categoryNameParamsSchema,
  fastifyAuthenticate,
  fastifyResolveWorkspace,
  saveCustomAssetCategories,
  getCustomAssetCategories,
  type AuthReq,
} from './asset-helpers';

const createCategorySchema = z.object({
  categoryName: z.string().min(1).max(50),
});

const updateCategorySchema = z.object({
  oldCategoryName: z.string().min(1),
  newCategoryName: z.string().min(1).max(50),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const bulkFavoriteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  category: z.string().optional(),
});

export const registerAssetMutationRoutes = (app: FastifyInstance): void => {
  // POST /favorites/categories —— 创建收藏分类
  app.post(
    '/favorites/categories',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { body: createCategorySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const { categoryName } = request.body as z.infer<typeof createCategorySchema>;
      const existing = await getCustomAssetCategories(userId);

      if (existing.includes(categoryName.trim())) {
        return reply.status(400).send({ error: '该收藏分类已存在' });
      }

      const updated = [...existing, categoryName.trim()];
      await saveCustomAssetCategories(userId, updated);
      return reply.send({ categories: updated });
    },
  );

  // PUT /favorites/categories —— 更新收藏分类
  app.put(
    '/favorites/categories',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { body: updateCategorySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const { oldCategoryName, newCategoryName } = request.body as z.infer<
        typeof updateCategorySchema
      >;
      const existing = await getCustomAssetCategories(userId);

      const index = existing.indexOf(oldCategoryName.trim());
      if (index === -1) {
        return reply.status(404).send({ error: '未找到原分类' });
      }

      existing[index] = newCategoryName.trim();
      await saveCustomAssetCategories(userId, existing);

      await prisma.assetLike.updateMany({
        where: { userId, category: oldCategoryName.trim() },
        data: { category: newCategoryName.trim() },
      });

      return reply.send({ categories: existing });
    },
  );

  // DELETE /favorites/categories/:categoryName —— 删除收藏分类
  app.delete(
    '/favorites/categories/:categoryName',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { params: categoryNameParamsSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const { categoryName } = request.params as z.infer<typeof categoryNameParamsSchema>;
      const existing = await getCustomAssetCategories(userId);

      const filtered = existing.filter((c) => c !== categoryName.trim());
      await saveCustomAssetCategories(userId, filtered);

      await prisma.assetLike.updateMany({
        where: { userId, category: categoryName.trim() },
        data: { category: '默认' },
      });

      return reply.send({ categories: filtered });
    },
  );

  // POST /:id/like —— 切换点赞/收藏
  app.post(
    '/:id/like',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { params: idParamsSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const assetId = (request.params as { id: string }).id;
      const { category } = (request.body as { category?: string }) || {};

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) {
        return reply.status(404).send({ error: '资产不存在' });
      }

      const existingLike = await prisma.assetLike.findUnique({
        where: { assetId_userId: { assetId, userId } },
      });

      if (existingLike) {
        await prisma.$transaction([
          prisma.assetLike.delete({ where: { id: existingLike.id } }),
          prisma.asset.update({
            where: { id: assetId },
            data: { likes: { decrement: 1 } },
          }),
        ]);
        return reply.send({ isLiked: false, likesCount: Math.max(0, asset.likes - 1) });
      }

      await prisma.$transaction([
        prisma.assetLike.create({
          data: {
            userId,
            assetId,
            ...(category ? { category: category.trim() } : {}),
          },
        }),
        prisma.asset.update({
          where: { id: assetId },
          data: { likes: { increment: 1 } },
        }),
      ]);

      return reply.send({ isLiked: true, likesCount: asset.likes + 1 });
    },
  );

  // POST /bulk-delete —— 批量删除资产
  app.post(
    '/bulk-delete',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { body: bulkDeleteSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const { ids } = request.body as z.infer<typeof bulkDeleteSchema>;

      const assets = await prisma.asset.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true },
      });

      const allowedIds = assets.map((a) => a.id);
      if (allowedIds.length === 0) {
        return reply.send({ count: 0 });
      }

      const result = await prisma.asset.deleteMany({
        where: { id: { in: allowedIds } },
      });

      return reply.send({ count: result.count });
    },
  );

  // POST /bulk/favorite —— 批量收藏
  app.post(
    '/bulk/favorite',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { body: bulkFavoriteSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const { ids, category } = request.body as z.infer<typeof bulkFavoriteSchema>;

      const existingLikes = await prisma.assetLike.findMany({
        where: { userId, assetId: { in: ids } },
        select: { assetId: true },
      });
      const existingIds = new Set(existingLikes.map((l) => l.assetId));

      const newIds = ids.filter((id) => !existingIds.has(id));
      if (newIds.length > 0) {
        await prisma.assetLike.createMany({
          data: newIds.map((assetId) => ({
            userId,
            assetId,
            ...(category ? { category: category.trim() } : {}),
          })),
        });

        await prisma.asset.updateMany({
          where: { id: { in: newIds } },
          data: { likes: { increment: 1 } },
        });
      }

      return reply.send({ addedCount: newIds.length });
    },
  );

  // POST /:id/comments —— 创建评论
  app.post(
    '/:id/comments',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { params: idParamsSchema, body: assetCommentSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const assetId = (request.params as { id: string }).id;
      const { content } = request.body as z.infer<typeof assetCommentSchema>;

      const comment = await prisma.assetComment.create({
        data: {
          assetId,
          userId,
          content,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      return reply.status(201).send(comment);
    },
  );

  // DELETE /comments/:commentId —— 删除评论
  app.delete(
    '/comments/:commentId',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { params: commentIdParamsSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const commentId = (request.params as { commentId: string }).commentId;

      const comment = await prisma.assetComment.findUnique({
        where: { id: commentId },
        include: { asset: { select: { userId: true } } },
      });

      if (!comment) {
        return reply.status(404).send({ error: '评论不存在' });
      }

      if (comment.userId !== userId && comment.asset.userId !== userId) {
        return reply.status(403).send({ error: '无权删除该评论' });
      }

      await prisma.assetComment.delete({ where: { id: commentId } });
      return reply.send({ success: true });
    },
  );
};
