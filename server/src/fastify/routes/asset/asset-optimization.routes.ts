import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../../services/prisma';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../utils/error';
import {
  extractRecords,
  verifyHmacSignature,
  idParamsSchema,
  fastifyAuthenticate,
  fastifyResolveWorkspace,
} from './asset-helpers';

export const registerAssetOptimizationRoutes = (app: FastifyInstance): void => {
  // POST /webhook —— R2 Event Notification 回调
  app.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const signatureHeader = request.headers['x-r2-signature'] as string | undefined;
    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ||
      Buffer.from(JSON.stringify(request.body));

    if (!verifyHmacSignature(rawBody, signatureHeader)) {
      logger.warn('[Asset Webhook] HMAC 签名校验失败');
      throw new AppError('签名校验失败', 401, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const records = extractRecords(request.body);
    logger.info(`[Asset Webhook] 收到 ${records.length} 条 R2 事件`);

    let processedCount = 0;
    for (const record of records) {
      if (!record.eventName.startsWith('ObjectCreated:')) {
        continue;
      }

      const key = record.s3.object.key;
      if (!key) continue;

      const assets = await prisma.asset.findMany({
        where: {
          OR: [{ url: { contains: key } }, { thumbnail: { contains: key } }],
        },
      });

      for (const asset of assets) {
        if (asset.url && asset.url.includes(key)) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { status: 'APPROVED' },
          });
          processedCount++;
        }
      }
    }

    return reply.send({ success: true, processed: processedCount });
  });

  // GET /:id/status —— 资产处理状态
  app.get(
    '/:id/status',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { params: idParamsSchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const assetId = (request.params as { id: string }).id;
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      if (!asset) {
        return reply.status(404).send({ error: '资产不存在' });
      }

      return reply.send(asset);
    },
  );
};
