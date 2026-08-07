import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
} from '../../auth/fastify-auth';

export { fastifyAuthenticate, fastifyOptionalAuthenticate, fastifyResolveWorkspace };
import { AppError } from '../../../utils/error';
import { logger } from '../../../utils/logger';
import prisma from '../../../services/prisma';
import { config } from '../../../config/env';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
  url?: string;
  r2Key?: string;
  r2ConfigId?: string;
}

export interface AuthReq extends FastifyRequest {
  userId?: string;
  workspaceId?: string;
}

export const CUSTOM_ASSET_CATEGORIES_SETTING_KEY = 'asset_favorite_categories';

export const getCustomAssetCategories = async (userId: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY } },
    });
    if (setting && setting.value) {
      return JSON.parse(setting.value) as string[];
    }
  } catch (err) {
    logger.warn(
      '[Asset] Failed to parse custom categories setting:',
      err instanceof Error ? err.message : err,
    );
  }
  return [];
};

export const saveCustomAssetCategories = async (userId: string, categories: string[]) => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: {
      userId,
      key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY,
      value: JSON.stringify(uniqueCats),
    },
  });
};

export const safeUnlink = (p: string | undefined | null): Promise<void> => {
  if (!p) return Promise.resolve();
  return import('fs').then((fs) =>
    fs.promises.unlink(p).catch((err: unknown) => {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        logger.error(`[Asset] Failed to unlink ${p}:`, err);
      }
    }),
  );
};

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const commentIdParamsSchema = z.object({
  commentId: z.string().min(1),
});

export const shareIdParamsSchema = z.object({
  shareId: z.string().min(1),
});

export const categoryNameParamsSchema = z.object({
  categoryName: z.string().min(1),
});

export const idAnnotationParamsSchema = z.object({
  id: z.string().min(1),
  annotationId: z.string().min(1),
});

export const assetListQuerySchema = z
  .object({
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    lite: z.union([z.string(), z.boolean()]).optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    sort: z.string().optional(),
    mine: z.union([z.string(), z.boolean()]).optional(),
    favoritesOnly: z.union([z.string(), z.boolean()]).optional(),
    favoriteCategory: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const viewFileQuerySchema = z
  .object({
    type: z.string().optional(),
  })
  .passthrough();

export const requestsQuerySchema = z
  .object({
    status: z.string().optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export const optionalAuthWithWorkspace = [
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
] as const;
export const authWithWorkspace = [fastifyAuthenticate, fastifyResolveWorkspace] as const;

export interface R2EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string; size?: number; eTag?: string; contentType?: string };
  };
}

export function extractRecords(body: unknown): R2EventRecord[] {
  if (!body || typeof body !== 'object') return [];

  const snsMsg = (body as { Message?: string }).Message;
  if (typeof snsMsg === 'string') {
    try {
      const inner = JSON.parse(snsMsg);
      if (Array.isArray(inner.records)) return inner.records as R2EventRecord[];
      if (Array.isArray(inner.Records)) return inner.Records as R2EventRecord[];
    } catch {
      return [];
    }
  }

  const direct = body as { records?: R2EventRecord[]; Records?: R2EventRecord[] };
  if (Array.isArray(direct.records)) return direct.records;
  if (Array.isArray(direct.Records)) return direct.Records;

  return [];
}

export function verifyHmacSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = config.R2_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError(
      'R2_WEBHOOK_SECRET 未配置，webhook 端点拒绝处理（铁律：密钥不允许硬编码兜底）',
      500,
      'WEBHOOK_SECRET_MISSING',
    );
  }
  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.trim();

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export const CATEGORIES_CACHE_KEY = 'categories:all';
export const CATEGORIES_CACHE_TTL = 300;
