import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import axios, { type AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import prisma from '../../services/prisma';
import { redisService } from '../../services/redis.service';
import { callLLMWithFailover } from '../../services/ai.service';
import { parseTags } from '../../utils/tags';
import { storageService, decryptSecretIfNeeded } from '../../services/storage.service';
import { logger } from '../../utils/logger';
import { fastifyAuthenticate, fastifyResolveWorkspace, type SafeUser } from '../auth/fastify-auth';
import {
  cancelTempUploadSchema,
  importExternalResourceSchema,
  resourceAbortMultipartSchema,
  resourceCompleteMultipartSchema,
  resourceCompleteSingleUploadSchema,
  resourceInitiateMultipartSchema,
  resourcePresignPartsSchema,
  resourcePresignedUrlSchema,
} from '../../utils/schemas-batch1';
import {
  getDecryptedActiveStorageConfig,
  getStorageTypeForField,
  generateS3Key,
  checkQuota,
  incrementConfigUsedBytes,
} from '../../utils/s3-upload-helper';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';

/**
 * Fastify 资源聚合路由（铁律六·1 渐进式迁移 —— 原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify
 *  - GET  /resources/feed              资源 Feed 流（鉴权 + workspace）
 *  - GET  /resources/my-workbench       我的工作台（鉴权）
 *  - GET  /resources/overview           资源总览（鉴权 + workspace，Redis 缓存）
 *  - GET  /resources/search-external    外部资源搜索（鉴权）
 *  - POST /resources/import-external    外部资源导入（鉴权）
 *  - POST /resources/upload-temp-cancel 取消临时上传（鉴权）
 *  - POST /resources/presigned-url      预签名上传 URL（鉴权）
 *  - POST /resources/complete-single    完成单次上传（鉴权）
 *  - POST /resources/multipart/initiate    初始化分片上传（鉴权）
 *  - POST /resources/multipart/presign-parts 获取分片预签名（鉴权）
 *  - POST /resources/multipart/complete    完成分片上传（鉴权）
 *  - POST /resources/multipart/abort       取消分片上传（鉴权）
 *
 * 路由级限流：120/min（对齐 Express resourceLimiter）
 */

type ResourceKind = 'asset' | 'material' | 'plugin' | 'showcase' | 'software';
type ResourceStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
type KindFilter = ResourceKind | 'all';
type StatusFilter = ResourceStatus | 'all';
type ResourceSortMode = 'updated' | 'created' | 'metric' | 'title' | 'review';

interface ResourceFeedItem {
  id: string;
  kind: ResourceKind;
  title: string;
  subtitle: string;
  metric: number;
  metricLabel: string;
  status: string;
  previewUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  path: string;
  reviewPath?: string;
  author: string;
  tags: string[];
  rejectReason?: string | null;
  reviewAgeHours?: number;
  category?: string | null;
  resolution?: string | null;
  fileSize?: number | null;
  isProcedural?: boolean;
  downloads?: number;
  favorites?: number;
}

const APPROVED_STATUS = 'APPROVED';
const REVIEW_STATUSES = ['PENDING', 'REJECTED'];
const RESOURCE_KINDS: ResourceKind[] = ['asset', 'material', 'plugin', 'showcase', 'software'];
const RESOURCE_STATUSES: ResourceStatus[] = ['APPROVED', 'PENDING', 'REJECTED'];
const STALE_REVIEW_HOURS = 48;

interface AuthReq extends FastifyRequest {
  userId?: string;
  workspaceId?: string;
  user?: SafeUser;
}

const getTeamFilter = (workspaceId?: string) => {
  if (
    !workspaceId ||
    workspaceId === 'admin-workspace' ||
    workspaceId.startsWith('mirror-') ||
    workspaceId.startsWith('manual-')
  ) {
    return {};
  }

  return { teamId: workspaceId };
};

const isAdminResourceScope = (req: AuthReq) =>
  req.user?.role === 'ADMIN' && req.workspaceId === 'admin-workspace';

const getAuthorName = (user?: { name?: string | null; email?: string | null } | null) =>
  user?.name || user?.email || '创作者';

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mergeHotTags = (...groups: Array<Array<string>>) => {
  const usage = new Map<string, number>();
  groups.flat().forEach((tag) => usage.set(tag, (usage.get(tag) || 0) + 1));

  return Array.from(usage.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
    .slice(0, 20);
};

const sumNumbers = (...values: Array<number | null | undefined>) => {
  let total = 0;
  values.forEach((value) => {
    total += Number(value) || 0;
  });
  return total;
};

const parseLimit = (value: unknown, fallback = 160, max = 500) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const getQueryText = (value: unknown) => {
  if (Array.isArray(value)) return getQueryText(value[0]);
  return typeof value === 'string' ? value.trim() : '';
};

const parsePage = (value: unknown, fallback = 1, max = 100) => {
  const parsed = Number.parseInt(getQueryText(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const normalizeKindFilter = (value: unknown): KindFilter => {
  const kind = getQueryText(value).toLowerCase();
  return RESOURCE_KINDS.includes(kind as ResourceKind) ? (kind as ResourceKind) : 'all';
};

const normalizeStatusFilter = (value: unknown): StatusFilter => {
  const status = getQueryText(value).toUpperCase();
  return RESOURCE_STATUSES.includes(status as ResourceStatus) ? (status as ResourceStatus) : 'all';
};

const normalizeSortMode = (value: unknown): ResourceSortMode => {
  const sort = getQueryText(value).toLowerCase();
  if (sort === 'created') return 'created';
  if (sort === 'metric' || sort === 'popular') return 'metric';
  if (sort === 'title' || sort === 'name') return 'title';
  if (sort === 'review') return 'review';
  return 'updated';
};

const withAnd = <T extends object>(...clauses: T[]): T => {
  const filtered = clauses.filter((clause) => Object.keys(clause).length > 0);
  if (!filtered.length) return {} as T;
  if (filtered.length === 1) return filtered[0] as T;
  return { AND: filtered } as T;
};

interface BuildWhereInput {
  userId: string;
  teamFilter: ReturnType<typeof getTeamFilter>;
  isAdminScope: boolean;
  status?: ResourceStatus;
  query?: string;
}

const buildAssetWhere = ({
  userId,
  teamFilter,
  isAdminScope,
  status,
  query,
}: BuildWhereInput): Prisma.AssetWhereInput => {
  const clauses: Prisma.AssetWhereInput[] = [];
  if (!isAdminScope) {
    clauses.push({
      OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }],
    });
  }
  if (status) clauses.push({ status });
  if (query) {
    clauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { type: { contains: query } },
        { category: { is: { name: { contains: query } } } },
        { user: { is: { name: { contains: query } } } },
        { user: { is: { email: { contains: query } } } },
      ],
    });
  }
  return withAnd(...clauses);
};

const buildMaterialWhere = ({
  userId,
  teamFilter,
  isAdminScope,
  status,
  query,
}: BuildWhereInput): Prisma.MaterialWhereInput => {
  const clauses: Prisma.MaterialWhereInput[] = [];
  if (!isAdminScope) {
    clauses.push({
      OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }],
    });
  }
  if (status) clauses.push({ status });
  if (query) {
    clauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { category: { contains: query } },
        { resolution: { contains: query } },
        { user: { is: { name: { contains: query } } } },
        { user: { is: { email: { contains: query } } } },
      ],
    });
  }
  return withAnd(...clauses);
};

const buildPluginWhere = ({
  userId,
  isAdminScope,
  status,
  query,
}: BuildWhereInput): Prisma.PluginWhereInput => {
  const clauses: Prisma.PluginWhereInput[] = [];
  if (!isAdminScope) {
    clauses.push({
      OR: [{ status: APPROVED_STATUS }, { userId }],
    });
  }
  if (status) clauses.push({ status });
  if (query) {
    clauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { category: { contains: query } },
        { compatibility: { contains: query } },
        { user: { is: { name: { contains: query } } } },
        { user: { is: { email: { contains: query } } } },
      ],
    });
  }
  return withAnd(...clauses);
};

const buildSoftwareWhere = ({
  userId,
  isAdminScope,
  status,
  query,
}: BuildWhereInput): Prisma.SoftwareWhereInput => {
  const clauses: Prisma.SoftwareWhereInput[] = [];
  if (!isAdminScope) {
    clauses.push({
      OR: [{ status: APPROVED_STATUS }, { userId }],
    });
  }
  if (status) clauses.push({ status });
  if (query) {
    clauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { category: { contains: query } },
        { compatibility: { contains: query } },
        { user: { is: { name: { contains: query } } } },
        { user: { is: { email: { contains: query } } } },
      ],
    });
  }
  return withAnd(...clauses);
};

const buildShowcaseWhere = ({
  userId,
  teamFilter,
  isAdminScope,
  status,
  query,
}: BuildWhereInput): Prisma.ShowcaseWhereInput => {
  const clauses: Prisma.ShowcaseWhereInput[] = [];
  if (!isAdminScope) {
    clauses.push({
      OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }],
    });
  }
  if (status) clauses.push({ status });
  if (query) {
    clauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { tags: { contains: query } },
        { type: { contains: query } },
        { user: { is: { name: { contains: query } } } },
        { user: { is: { email: { contains: query } } } },
      ],
    });
  }
  return withAnd(...clauses);
};

const getReviewAgeHours = (createdAt: Date | string, status: string) => {
  if (status !== 'PENDING') return undefined;
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 36e5));
};

// ── Narrow input shapes for normalise helpers ────────────────────────────────
type AssetRow = {
  id: string;
  title: string;
  type?: string | null;
  status: string;
  thumbnail?: string | null;
  tags?: string | null;
  rejectReason?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  downloads?: number | null;
  viewCount?: number | null;
  category?: { name?: string | null } | null;
  user?: { name?: string | null; email?: string | null } | null;
};
type MaterialRow = {
  id: string;
  title: string;
  category?: string | null;
  resolution?: string | null;
  status: string;
  previewUrl?: string | null;
  tags?: string | null;
  rejectReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  fileSize?: number | null;
  isProcedural?: boolean | null;
  downloads?: number | null;
  _count?: { favorites?: number } | null;
  user?: { name?: string | null; email?: string | null } | null;
};
type PluginRow = {
  id: string;
  title: string;
  category?: string | null;
  version?: string | null;
  status: string;
  previewUrl?: string | null;
  tags?: string | null;
  rejectReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  downloads?: number;
  user?: { name?: string | null; email?: string | null } | null;
};
type SoftwareRow = {
  id: string;
  title: string;
  category?: string | null;
  version?: string | null;
  status: string;
  previewUrl?: string | null;
  tags?: string | null;
  rejectReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  downloads?: number;
  user?: { name?: string | null; email?: string | null } | null;
};
type ShowcaseRow = {
  id: string;
  title: string;
  type?: string | null;
  status: string;
  thumbnailUrl?: string | null;
  tags?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  views?: number;
  _count?: { likes?: number; comments?: number } | null;
  user?: { name?: string | null; email?: string | null } | null;
};

const normalizeAssetItem = (asset: AssetRow, metricLabel = '触达'): ResourceFeedItem => ({
  id: asset.id,
  kind: 'asset',
  title: asset.title,
  subtitle: asset.category?.name || asset.type || '3D 资源',
  metric:
    metricLabel === '下载'
      ? sumNumbers(asset.downloads)
      : sumNumbers(asset.downloads, asset.viewCount),
  metricLabel,
  status: asset.status,
  previewUrl: asset.thumbnail ?? null,
  createdAt: toIso(asset.createdAt),
  updatedAt: asset.updatedAt ? toIso(asset.updatedAt) : toIso(asset.createdAt),
  path: `/assets/${asset.id}`,
  reviewPath: `/admin/audits?tab=assets&item=${asset.id}`,
  author: getAuthorName(asset.user),
  tags: parseTags(asset.tags),
  rejectReason: asset.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(asset.createdAt, asset.status),
});

const normalizeMaterialItem = (material: MaterialRow, metricLabel = '收藏'): ResourceFeedItem => ({
  id: material.id,
  kind: 'material',
  title: material.title,
  subtitle: [material.category, material.resolution].filter(Boolean).join(' / ') || '材质',
  metric:
    metricLabel === '下载'
      ? sumNumbers(material.downloads)
      : sumNumbers(material._count?.favorites),
  metricLabel,
  status: material.status,
  previewUrl: material.previewUrl ?? null,
  createdAt: toIso(material.createdAt),
  updatedAt: toIso(material.updatedAt),
  path: `/materials?material=${material.id}`,
  reviewPath: `/admin/audits?tab=materials&item=${material.id}`,
  author: getAuthorName(material.user),
  tags: parseTags(material.tags),
  rejectReason: material.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(material.createdAt, material.status),
  category: material.category || null,
  resolution: material.resolution || null,
  fileSize: material.fileSize ?? null,
  isProcedural: Boolean(material.isProcedural),
  downloads: sumNumbers(material.downloads),
  favorites: sumNumbers(material._count?.favorites),
});

const normalizePluginItem = (plugin: PluginRow, metricLabel = '下载'): ResourceFeedItem => ({
  id: plugin.id,
  kind: 'plugin',
  title: plugin.title,
  subtitle: `${plugin.category} / v${String(plugin.version).replace(/^v/i, '')}`,
  metric: plugin.downloads ?? 0,
  metricLabel,
  status: plugin.status,
  previewUrl: plugin.previewUrl ?? null,
  createdAt: toIso(plugin.createdAt),
  updatedAt: toIso(plugin.updatedAt),
  path: `/plugins?plugin=${plugin.id}`,
  reviewPath: `/admin/audits?tab=plugins&item=${plugin.id}`,
  author: getAuthorName(plugin.user),
  tags: parseTags(plugin.tags),
  rejectReason: plugin.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(plugin.createdAt, plugin.status),
});

const normalizeSoftwareItem = (software: SoftwareRow, metricLabel = '下载'): ResourceFeedItem => ({
  id: software.id,
  kind: 'software',
  title: software.title,
  subtitle: `${software.category} / v${String(software.version).replace(/^v/i, '')}`,
  metric: software.downloads ?? 0,
  metricLabel,
  status: software.status,
  previewUrl: software.previewUrl ?? null,
  createdAt: toIso(software.createdAt),
  updatedAt: toIso(software.updatedAt),
  path: `/softwares?software=${software.id}`,
  reviewPath: `/admin/audits?tab=softwares&item=${software.id}`,
  author: getAuthorName(software.user),
  tags: parseTags(software.tags),
  rejectReason: software.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(software.createdAt, software.status),
});

const normalizeShowcaseItem = (showcase: ShowcaseRow, metricLabel = '互动'): ResourceFeedItem => ({
  id: showcase.id,
  kind: 'showcase',
  title: showcase.title,
  subtitle: showcase.type ?? '',
  metric:
    metricLabel === '浏览'
      ? sumNumbers(showcase.views)
      : sumNumbers(showcase._count?.likes, showcase._count?.comments),
  metricLabel,
  status: showcase.status,
  previewUrl: showcase.thumbnailUrl ?? null,
  createdAt: toIso(showcase.createdAt),
  updatedAt: toIso(showcase.updatedAt),
  path: `/showcase?work=${showcase.id}`,
  reviewPath: `/admin/audits?tab=showcases&item=${showcase.id}`,
  author: getAuthorName(showcase.user),
  tags: parseTags(showcase.tags),
  reviewAgeHours: getReviewAgeHours(showcase.createdAt, showcase.status),
});

const getDateTime = (date?: string) => {
  const timestamp = date ? new Date(date).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const statusPriority = (status: string) => {
  if (status === 'REJECTED') return 0;
  if (status === 'PENDING') return 1;
  if (status === 'APPROVED') return 2;
  return 3;
};

const sortFeedItems = (items: ResourceFeedItem[], sortMode: ResourceSortMode) =>
  [...items].sort((a, b) => {
    if (sortMode === 'metric') return b.metric - a.metric;
    if (sortMode === 'title') return a.title.localeCompare(b.title, 'zh-CN');
    if (sortMode === 'created') {
      return getDateTime(b.createdAt) - getDateTime(a.createdAt);
    }
    if (sortMode === 'review') {
      const priorityDiff = statusPriority(a.status) - statusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return getDateTime(a.createdAt) - getDateTime(b.createdAt);
    }
    return getDateTime(b.updatedAt || b.createdAt) - getDateTime(a.updatedAt || a.createdAt);
  });

// --- Image download / scraping helpers (for import-external) ---

function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (!buffer || buffer.length < 24) return null;

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1] ?? 0;
        if (marker >= 0xc0 && marker <= 0xc3) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 1 + length;
      }
    }

    // WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      if (
        buffer[12] === 0x56 &&
        buffer[13] === 0x50 &&
        buffer[14] === 0x38 &&
        buffer[15] === 0x58
      ) {
        const width =
          1 + ((buffer[24] ?? 0) | ((buffer[25] ?? 0) << 8) | ((buffer[26] ?? 0) << 16));
        const height =
          1 + ((buffer[27] ?? 0) | ((buffer[28] ?? 0) << 8) | ((buffer[29] ?? 0) << 16));
        return { width, height };
      }
      if (
        buffer[12] === 0x56 &&
        buffer[13] === 0x50 &&
        buffer[14] === 0x38 &&
        buffer[15] === 0x20
      ) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (
        buffer[12] === 0x56 &&
        buffer[13] === 0x50 &&
        buffer[14] === 0x38 &&
        buffer[15] === 0x4c
      ) {
        const b0 = buffer[21] ?? 0;
        const b1 = buffer[22] ?? 0;
        const b2 = buffer[23] ?? 0;
        const b3 = buffer[24] ?? 0;
        const width = 1 + (b0 | ((b1 & 0x3f) << 8));
        const height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0xf) << 10));
        return { width, height };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isProbablyQrOrJunkDimensions(dim: { width: number; height: number } | null): boolean {
  if (!dim || !dim.width || !dim.height) return false;

  if (dim.width < 200 || dim.height < 200) return true;

  const aspectRatio = dim.width / dim.height;

  if (aspectRatio >= 0.88 && aspectRatio <= 1.14 && dim.width <= 640) {
    return true;
  }

  return false;
}

async function downloadAndSaveImage(imageUrl: string, parentUrl?: string): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.startsWith('data:')) {
    return null;
  }

  try {
    let refererHeader = '';
    if (parentUrl) {
      try {
        refererHeader = new URL(parentUrl).origin + '/';
      } catch {
        /* ignore */
      }
    }

    const requestHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (refererHeader) {
      requestHeaders['Referer'] = refererHeader;
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    let response: AxiosResponse;
    try {
      response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        headers: requestHeaders,
        httpsAgent,
      });
    } catch {
      delete requestHeaders['Referer'];
      response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        headers: requestHeaders,
        httpsAgent,
      });
    }

    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    const dim = getImageDimensions(buffer);
    if (isProbablyQrOrJunkDimensions(dim)) {
      logger.info(
        `[Download Crawled Image] Skipped QR/junk image by dimensions (${dim?.width}x${dim?.height}): ${imageUrl}`,
      );
      return null;
    }

    let ext = '.png';
    let rawMimetype = 'image/png';
    const rawContentType = response.headers['content-type'];
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType;
    if (contentType && typeof contentType === 'string') {
      rawMimetype = (contentType.split(';')[0] || '').trim();
      if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        ext = '.jpg';
      } else if (contentType.includes('image/png')) {
        ext = '.png';
      } else if (contentType.includes('image/webp')) {
        ext = '.webp';
      } else if (contentType.includes('image/gif')) {
        ext = '.gif';
      } else if (contentType.includes('image/svg+xml')) {
        ext = '.svg';
      }
    } else {
      try {
        const parsedPath = path.extname(new URL(imageUrl).pathname);
        if (parsedPath) {
          ext = parsedPath.toLowerCase();
        }
      } catch {
        /* ignore */
      }
    }

    const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
    const filename = `${hash}${ext}`;

    let activeConfigs = await prisma.storageConfig.findMany({
      where: {
        status: 'ACTIVE',
        assetType: 'ASSET',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    if (activeConfigs.length === 0) {
      activeConfigs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          assetType: 'ALL',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    }

    if (activeConfigs.length === 0) {
      logger.warn(
        '[Download Crawled Image] No active R2 storage config available; skipping crawled image.',
      );
      return null;
    }

    const config = activeConfigs[0];
    if (!config) {
      return null;
    }

    const fileBytes = buffer.length;
    const limitBytes = config.limitGb * 1024 * 1024 * 1024;

    const updateResult = await prisma.storageConfig.updateMany({
      where: {
        id: config.id,
        status: 'ACTIVE',
        usedBytes: { lte: limitBytes - fileBytes },
      },
      data: {
        usedBytes: { increment: fileBytes },
      },
    });

    if (updateResult.count === 0) {
      logger.warn(
        `[Download Crawled Image] Storage limit exceeded for R2 config ${config.name}; skipping crawled image.`,
      );
      return null;
    }

    const cloudKey = `crawled/${filename}`;
    try {
      const r2Url = await storageService.uploadBuffer(
        {
          endpoint: config.endpoint,
          accessKeyId: config.accessKeyId,
          secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
          bucketName: config.bucketName,
          publicUrl: config.publicUrl,
        },
        buffer,
        cloudKey,
        rawMimetype,
      );
      return r2Url;
    } catch (uploadError: unknown) {
      logger.error(
        `[Download Crawled Image] Failed to upload crawled image to R2: ${(uploadError as Error).message}.`,
      );
      await prisma.storageConfig.update({
        where: { id: config.id },
        data: { usedBytes: { decrement: fileBytes } },
      });
      return null;
    }
  } catch (err: unknown) {
    logger.error(
      `[Download Crawled Image] Failed to download ${imageUrl}: ${(err as Error).message}`,
    );
    return null;
  }
}

const QR_IMAGE_DOMAIN_BLOCKLIST: string[] = [];

const SUPERHIVE_READER_URL = 'https://r.jina.ai/';

function isSuperHiveProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'superhivemarket.com' ||
        parsed.hostname.endsWith('.superhivemarket.com')) &&
      /^\/products\/[^/]+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Superhive blocks server-side page requests with 403, while its public image
 * CDN remains reachable. Jina's reader fetches the public product page and
 * exposes its Markdown image links, letting us download the product's original
 * preview images into the configured storage just like any normal import.
 */
async function scrapeSuperHiveViaReader(
  productUrl: string,
  productTitle?: string,
): Promise<{ imageUrls: string[]; textParagraphs: string[] } | null> {
  try {
    const response = await axios.get(`${SUPERHIVE_READER_URL}${productUrl}`, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': '3D-Learning-Platform/1.0 (+external-resource-import)',
      },
      timeout: 15_000,
      maxContentLength: 2 * 1024 * 1024,
      proxy: false,
    });
    const markdown = typeof response.data === 'string' ? response.data : '';
    if (!markdown) return null;

    const imageUrls: string[] = [];
    for (const match of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s" )]+)(?:\s+[^)]*)?\)/g)) {
      const imageUrl = match[1];
      if (imageUrl && !isJunkOrQrImage(imageUrl)) {
        imageUrls.push(imageUrl);
      }
    }

    const uniqueImageUrls = [...new Set(imageUrls)].slice(0, 5);
    // Reader output starts with marketplace navigation and product metadata.
    // Keep only the actual product article so changelog/permission widgets are
    // never presented as the source text.
    const productTitleCandidates = productTitle
      ? [productTitle, productTitle.split(' - ')[0]].filter((candidate): candidate is string =>
          Boolean(candidate),
        )
      : [];
    const titlePosition =
      productTitleCandidates
        .map((candidate) => markdown.toLocaleLowerCase().indexOf(candidate.toLocaleLowerCase()))
        .find((position) => position >= 0) ?? -1;
    const afterProductTitle = titlePosition >= 0 ? markdown.slice(titlePosition) : markdown;
    const articleHeading = afterProductTitle.search(/\n#{1,2}\s+(?!\[)/);
    let articleMarkdown =
      articleHeading >= 0 ? afterProductTitle.slice(articleHeading) : afterProductTitle;
    const articleEnd = articleMarkdown.search(
      /\n(?:#####\s+(?:Discover more products|Available Coupons)|\[Back to top\])/i,
    );
    if (articleEnd >= 0) articleMarkdown = articleMarkdown.slice(0, articleEnd);

    const textParagraphs = articleMarkdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/^#{1,6}\s*/, '').trim())
      .filter(
        (paragraph) =>
          paragraph.length > 20 &&
          !/^Image\s*\d*$/i.test(paragraph) &&
          !/^(Title|URL Source|Published Time):/i.test(paragraph) &&
          !/^(No changelog for this release\.?|This extension does not require special permissions\.?|Available Coupons|Details|Login to message)$/i.test(
            paragraph,
          ),
      )
      .slice(0, 30);

    if (uniqueImageUrls.length === 0 && textParagraphs.length === 0) return null;
    return { imageUrls: uniqueImageUrls, textParagraphs };
  } catch (err: unknown) {
    logger.warn(
      `[Import External Superhive] Reader fallback failed for ${productUrl}: ${(err as Error).message}`,
    );
    return null;
  }
}

function isJunkOrQrImage(
  src: string,
  el?: { attr: (name: string) => string | undefined },
): boolean {
  if (!src || !src.startsWith('http')) return true;
  const lower = src.toLowerCase();

  if (lower.endsWith('.gif') || lower.endsWith('.svg')) return true;

  try {
    const srcHost = new URL(src).hostname;
    if (QR_IMAGE_DOMAIN_BLOCKLIST.some((d) => srcHost === d || srcHost.endsWith('.' + d))) {
      return true;
    }
  } catch {
    /* ignore */
  }

  const junkKeywords = [
    'avatar',
    'logo',
    'icon',
    'loading',
    'favorite',
    'fav',
    'qr',
    'qrcode',
    'weixin',
    'wechat',
    'gongzhonghao',
    'reward',
    'dashang',
    'saoma',
    'alipay',
    'kefu',
    'wxcode',
    'qqgroup',
    'jbscript',
    'jb-script',
    'gzh',
    'erweima',
    'erwm',
    'qr_code',
    'qr-code',
    'wx_qr',
    'weixin_qr',
    'profile-pic',
    'profile_pic',
    'profile-picture',
    'blank-profile-pic',
    '/static/',
    'litimg',
    '/skin/',
  ];

  if (junkKeywords.some((kw) => lower.includes(kw))) return true;

  if (el) {
    const attrText = (
      (el.attr('alt') || '') +
      ' ' +
      (el.attr('title') || '') +
      ' ' +
      (el.attr('class') || '') +
      ' ' +
      (el.attr('id') || '')
    ).toLowerCase();

    if (
      /二维码|微信|公众号|扫码|打赏|qq群|关注|群二维码|qrcode|weixin|gongzhonghao|gzh|saoma|erweima/i.test(
        attrText,
      )
    ) {
      return true;
    }
  }

  return false;
}

function resolveExternalImageUrl(imageUrl: string, pageUrl: string): string | null {
  const value = imageUrl.trim();
  if (!value || value.startsWith('data:')) return null;
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value, pageUrl).href;
  } catch {
    return null;
  }
}

function getLargestSourceFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null;
  const candidates = srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((candidate): candidate is string => Boolean(candidate));
  return candidates[candidates.length - 1] || null;
}

const IMAGE_SKIP_DOMAINS: string[] = [];

async function performFallbackSearchAndScrape(
  title: string,
  originalUrl: string,
  type: string,
): Promise<{ imageUrls: string[]; textParagraphs: string[]; fallbackUrl?: string } | null> {
  try {
    const cleanQuery = title
      .replace(/- Superhive.*/i, '')
      .replace(/- Blender Market.*/i, '')
      .replace(/\(formerly Blender Market\)/i, '')
      .replace(/\[.*?\]/g, '')
      .replace(/v?\d+(\.\d+)+/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();

    if (!cleanQuery) return null;

    let querySuffix = '';
    if (type === 'plugin') {
      querySuffix = ' plugin';
    } else if (type === 'material') {
      querySuffix = ' material';
    } else if (type === 'asset') {
      querySuffix = ' 3d model';
    }

    const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(cleanQuery + querySuffix)}&first=1`;
    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 2500,
    });

    const $search = cheerio.load(searchResponse.data);
    const candidateLinks: string[] = [];

    let originalDomain = '';
    try {
      originalDomain = new URL(originalUrl).hostname.replace(/^www\./, '');
    } catch {
      /* ignore */
    }

    $search('.b_algo').each((_, element) => {
      const anchor = $search(element).find('h2 a').first();
      if (!anchor.length) return;
      const link = anchor.attr('href') || '';
      if (!link || link.startsWith('/') || link.includes('bing.com')) return;

      try {
        const linkDomain = new URL(link).hostname.replace(/^www\./, '');
        if (linkDomain === originalDomain || linkDomain.includes('blendermarket.com')) return;
      } catch {
        return;
      }

      candidateLinks.push(link);
    });

    type CandidateResult = { imageUrls: string[]; textParagraphs: string[]; fallbackUrl: string };
    const candidateResults: CandidateResult[] = [];

    await Promise.allSettled(
      candidateLinks.slice(0, 3).map(async (link) => {
        try {
          const response = await axios.get(link, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            timeout: 2500,
          });

          const $ = cheerio.load(response.data);
          const imageUrls: string[] = [];
          const textParagraphs: string[] = [];

          let skipImages = false;
          try {
            const linkHost = new URL(link).hostname;
            skipImages = IMAGE_SKIP_DOMAINS.some(
              (d) => linkHost === d || linkHost.endsWith('.' + d),
            );
          } catch {
            /* ignore */
          }

          if (!skipImages) {
            const imageSelectors = [
              '.entry-content img',
              '.post-content img',
              '.article-content img',
              '.entry img',
              '.entry-inner img',
              '.post-inner img',
              'article img',
              'main img',
            ];
            let imgElements = $(imageSelectors.join(', '));
            if (imgElements.length === 0) imgElements = $('img');

            imgElements.each((_, el) => {
              const parent = $(el).parents(
                'footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header, .author-avatar, .widget-postlist',
              );
              if (parent.length > 0) return;

              let src =
                $(el).attr('data-src') ||
                $(el).attr('data-original-src') ||
                $(el).attr('data-original') ||
                $(el).attr('data-lazy-src') ||
                $(el).attr('data-lazyload') ||
                $(el).attr('data-image') ||
                $(el).attr('src');
              if (!src || src.startsWith('data:')) {
                src =
                  getLargestSourceFromSrcset(
                    $(el).attr('data-original-srcset') ||
                      $(el).attr('data-lazy-srcset') ||
                      $(el).attr('data-srcset') ||
                      $(el).attr('srcset'),
                  ) || undefined;
              }
              const imageUrl = src ? resolveExternalImageUrl(src, link) : null;
              if (imageUrl && imageUrls.length < 5) {
                if (!isJunkOrQrImage(imageUrl, $(el)) && !imageUrls.includes(imageUrl)) {
                  imageUrls.push(imageUrl);
                }
              }
            });
          }

          const articleSelectors = [
            '.entry-content p',
            '.post-content p',
            '.article-content p',
            '.entry p',
            '.entry-inner p',
            '.post-inner p',
            'article p',
            'main p',
          ];
          let pElements = $(articleSelectors.join(', '));
          if (pElements.length === 0) pElements = $('p');

          pElements.each((_, el) => {
            const parent = $(el).parents(
              'footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header',
            );
            if (parent.length > 0) return;

            const txt = $(el).text().trim();
            if (txt && txt.length > 20 && textParagraphs.length < 10) {
              if (
                txt.includes('Copyright') ||
                txt.includes('©') ||
                txt.includes('备案号') ||
                txt.includes('All rights reserved')
              ) {
                return;
              }
              textParagraphs.push(txt);
            }
          });

          if (textParagraphs.length > 0) {
            logger.info(
              `[Import External Fallback] Candidate scraped: ${link} (images: ${imageUrls.length}, texts: ${textParagraphs.length})`,
            );
            candidateResults.push({ imageUrls, textParagraphs, fallbackUrl: link });
          }
        } catch (err: unknown) {
          logger.debug(
            `[Import External Fallback] Failed to scrape ${link}: ${(err as Error).message}`,
          );
        }
      }),
    );

    if (candidateResults.length === 0) return null;

    const withImages = candidateResults.filter((r) => r.imageUrls.length > 0);
    const best =
      withImages.length > 0
        ? withImages.sort((a, b) => b.imageUrls.length - a.imageUrls.length)[0]!
        : candidateResults[0]!;

    logger.info(
      `[Import External Fallback] Best fallback: ${best.fallbackUrl} (images: ${best.imageUrls.length})`,
    );
    return best;
  } catch (err: unknown) {
    logger.error(`[Import External Fallback] Failed search and scrape: ${(err as Error).message}`);
  }
  return null;
}

async function parseResourceWithAI(
  title: string,
  snippet: string | undefined,
  textParagraphs: string[],
  type: string,
) {
  try {
    // Page bodies often contain author cards, download buttons, version lists
    // and other chrome. They are useful for scraping, but are not facts the AI
    // should turn into the resource introduction.
    const summaryParagraphs = textParagraphs
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(
        (paragraph) =>
          paragraph.length >= 30 &&
          paragraph.length <= 1_200 &&
          !/^(by\b|tags?:|发布时间|发布于|作者[:：]|\[添加收藏\]|\[download\])/i.test(paragraph) &&
          !/(wpfunction|add&postid=|点击下载|备用网址|网盘下载|免责声明|all rights reserved)/i.test(
            paragraph,
          ),
      )
      .slice(0, 12);
    const textSnippet = [
      `标题: ${title}`,
      snippet ? `引言: ${snippet}` : '',
      `正文段落:`,
      ...summaryParagraphs,
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `You are a helper that extracts metadata and translates content from webpage text snippets for a 3D learning platform database.
You must respond with a strictly formatted JSON object containing the metadata.
Do not include any markdown styling like \`\`\`json or explanations. Return ONLY the raw JSON string.
Important: If the title, description, or tags are in English, please translate/localize them to natural, clean Chinese. The tags should be translated to Chinese comma-separated keywords (e.g. '建模,材质,动画' instead of 'modeling,texture,animation').
For translatedDescription, write a concise, polished Chinese resource overview (preferably 120-220 Chinese characters). Use only substantive product facts: what it is, its core capabilities, and who it is useful for. Ignore author/date information, navigation, tags, ads, download buttons and links, code blocks, version/download lists, calls to action, copyright text, and page-layout fragments. Do not reproduce source text, URLs, or Markdown. Do not invent unsupported facts.

For type: "plugin", return:
{
  "version": "string (e.g. '1.2.0', default '1.0.0')",
  "compatibility": "string (e.g. 'Blender 3.x / 4.x', default '')",
  "tags": "string (comma-separated Chinese tag names, e.g. '建模,优化,材质', default '')",
  "category": "string (must be one of: 'Blender 插件', 'Three.js 插件', 'Substance 工具', '游戏引擎插件', 'Photoshop 脚本', '其他工具')",
  "translatedDescription": "string (A concise, polished Chinese overview; preferably 120-220 Chinese characters)"
}

For type: "asset" (3D Model), return:
{
  "tags": "string (comma-separated Chinese tag names, e.g. '科幻,机器人,角色', default '')",
  "meshType": "string (must be one of: 'LOW_POLY', 'HIGH_POLY', 'CAD', 'UNKNOWN', default 'UNKNOWN')",
  "translatedDescription": "string (A concise, polished Chinese overview; preferably 120-220 Chinese characters)"
}

For type: "material", return:
{
  "tags": "string (comma-separated Chinese tag names, e.g. '木质,程序化,写实', default '')",
  "resolution": "string (e.g. '4K', '8K', '1024x1024', default null)",
  "isProcedural": "boolean (default false)",
  "translatedDescription": "string (A concise, polished Chinese overview; preferably 120-220 Chinese characters)"
}
`;

    const userPrompt = `Extract metadata for type "${type}" from the following webpage snippet:\n\n${textSnippet}`;

    const responseText = await callLLMWithFailover(userPrompt, systemPrompt);
    logger.info(`[AI Scraper Parser] LLM raw response: ${responseText}`);

    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    return parsed;
  } catch (error: unknown) {
    logger.warn(
      `[AI Scraper Parser] Failed to parse resource with AI: ${(error as Error).message}`,
    );
    return null;
  }
}

// --- Query schemas ---

const feedQuerySchema = z
  .object({
    kind: z.string().optional(),
    status: z.string().optional(),
    sort: z.string().optional(),
    q: z.string().optional(),
    search: z.string().optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const workbenchQuerySchema = z
  .object({
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const searchExternalQuerySchema = z.object({
  q: z.string().min(1, 'Missing search query q'),
});

export const registerResourceRoutes = (app: FastifyInstance): void => {
  // GET /resources/feed —— 资源 Feed 流
  app.get(
    '/resources/feed',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { querystring: feedQuerySchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const req = request as AuthReq;
      const userId = req.userId as string;
      const teamFilter = getTeamFilter(req.workspaceId);
      const isAdminScope = isAdminResourceScope(req);
      const query = request.query as Record<string, unknown>;
      const kind = normalizeKindFilter(query.kind);
      const status = normalizeStatusFilter(query.status);
      const sortMode = normalizeSortMode(query.sort);
      const queryText = getQueryText(query.q || query.search);
      const page = parsePage(query.page, 1, 50);
      const limit = parseLimit(query.limit, 40, 80);
      const skip = (page - 1) * limit;
      const selectedKinds = kind === 'all' ? RESOURCE_KINDS : [kind];
      const selectedStatus = status === 'all' ? undefined : status;

      const buildInput = (statusOverride?: ResourceStatus): BuildWhereInput => ({
        userId,
        teamFilter,
        isAdminScope,
        status: statusOverride,
        query: queryText,
      });

      const countKind = (resourceKind: ResourceKind, statusOverride?: ResourceStatus) => {
        const input = buildInput(statusOverride);
        if (resourceKind === 'asset') return prisma.asset.count({ where: buildAssetWhere(input) });
        if (resourceKind === 'material') {
          return prisma.material.count({ where: buildMaterialWhere(input) });
        }
        if (resourceKind === 'plugin')
          return prisma.plugin.count({ where: buildPluginWhere(input) });
        if (resourceKind === 'software')
          return prisma.software.count({ where: buildSoftwareWhere(input) });
        return prisma.showcase.count({ where: buildShowcaseWhere(input) });
      };

      const countKinds = async (kinds: ResourceKind[], statusOverride?: ResourceStatus) => {
        const counts = await Promise.all(
          kinds.map((resourceKind) => countKind(resourceKind, statusOverride)),
        );
        return sumNumbers(...counts);
      };

      const assetOrderBy = ():
        | Prisma.AssetOrderByWithRelationInput
        | Prisma.AssetOrderByWithRelationInput[] => {
        if (sortMode === 'title') return { title: 'asc' };
        if (sortMode === 'created' || sortMode === 'review')
          return { createdAt: sortMode === 'review' ? 'asc' : 'desc' };
        if (sortMode === 'metric')
          return [{ downloads: 'desc' }, { viewCount: 'desc' }, { updatedAt: 'desc' }];
        return { updatedAt: 'desc' };
      };
      const materialOrderBy = ():
        | Prisma.MaterialOrderByWithRelationInput
        | Prisma.MaterialOrderByWithRelationInput[] => {
        if (sortMode === 'title') return { title: 'asc' };
        if (sortMode === 'created' || sortMode === 'review')
          return { createdAt: sortMode === 'review' ? 'asc' : 'desc' };
        if (sortMode === 'metric') return [{ downloads: 'desc' }, { updatedAt: 'desc' }];
        return { updatedAt: 'desc' };
      };
      const pluginOrderBy = ():
        | Prisma.PluginOrderByWithRelationInput
        | Prisma.PluginOrderByWithRelationInput[] => {
        if (sortMode === 'title') return { title: 'asc' };
        if (sortMode === 'created' || sortMode === 'review')
          return { createdAt: sortMode === 'review' ? 'asc' : 'desc' };
        if (sortMode === 'metric') return [{ downloads: 'desc' }, { updatedAt: 'desc' }];
        return { updatedAt: 'desc' };
      };
      const softwareOrderBy = ():
        | Prisma.SoftwareOrderByWithRelationInput
        | Prisma.SoftwareOrderByWithRelationInput[] => {
        if (sortMode === 'title') return { title: 'asc' };
        if (sortMode === 'created' || sortMode === 'review')
          return { createdAt: sortMode === 'review' ? 'asc' : 'desc' };
        if (sortMode === 'metric') return [{ downloads: 'desc' }, { updatedAt: 'desc' }];
        return { updatedAt: 'desc' };
      };
      const showcaseOrderBy = ():
        | Prisma.ShowcaseOrderByWithRelationInput
        | Prisma.ShowcaseOrderByWithRelationInput[] => {
        if (sortMode === 'title') return { title: 'asc' };
        if (sortMode === 'created' || sortMode === 'review')
          return { createdAt: sortMode === 'review' ? 'asc' : 'desc' };
        if (sortMode === 'metric') return [{ views: 'desc' }, { updatedAt: 'desc' }];
        return { updatedAt: 'desc' };
      };

      const fetchTake = skip + limit;
      const fetchKind = async (resourceKind: ResourceKind): Promise<ResourceFeedItem[]> => {
        const input = buildInput(selectedStatus);
        if (resourceKind === 'asset') {
          const assets = await prisma.asset.findMany({
            where: buildAssetWhere(input),
            orderBy: assetOrderBy(),
            take: fetchTake,
            include: {
              category: true,
              user: { select: { name: true, email: true } },
            },
          });
          return assets.map((item) => normalizeAssetItem(item));
        }

        if (resourceKind === 'material') {
          const materials = await prisma.material.findMany({
            where: buildMaterialWhere(input),
            orderBy: materialOrderBy(),
            take: fetchTake,
            include: {
              user: { select: { name: true, email: true } },
              _count: { select: { favorites: true } },
            },
          });
          return materials.map((item) => normalizeMaterialItem(item));
        }

        if (resourceKind === 'plugin') {
          const plugins = await prisma.plugin.findMany({
            where: buildPluginWhere(input),
            orderBy: pluginOrderBy(),
            take: fetchTake,
            include: { user: { select: { name: true, email: true } } },
          });
          return plugins.map((item) => normalizePluginItem(item));
        }

        if (resourceKind === 'software') {
          const softwares = await prisma.software.findMany({
            where: buildSoftwareWhere(input),
            orderBy: softwareOrderBy(),
            take: fetchTake,
            include: { user: { select: { name: true, email: true } } },
          });
          return softwares.map((item) => normalizeSoftwareItem(item));
        }

        const showcases = await prisma.showcase.findMany({
          where: buildShowcaseWhere(input),
          orderBy: showcaseOrderBy(),
          take: fetchTake,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { likes: true, comments: true } },
          },
        });
        return showcases.map((item) => normalizeShowcaseItem(item));
      };

      const [kindCountsList, statusCountsList, itemsByKind] = await Promise.all([
        Promise.all(
          RESOURCE_KINDS.map(
            async (resourceKind) =>
              [resourceKind, await countKind(resourceKind, selectedStatus)] as const,
          ),
        ),
        Promise.all(
          RESOURCE_STATUSES.map(
            async (resourceStatus) =>
              [resourceStatus, await countKinds(selectedKinds, resourceStatus)] as const,
          ),
        ),
        Promise.all(selectedKinds.map(fetchKind)),
      ]);

      const kindCounts = Object.fromEntries(kindCountsList) as Record<ResourceKind, number>;
      const totalForSelectedKind =
        kind === 'all' ? sumNumbers(...Object.values(kindCounts)) : kindCounts[kind] || 0;
      const statusCounts = Object.fromEntries(statusCountsList) as Record<ResourceStatus, number>;
      const statusAllCount = await countKinds(selectedKinds);
      const sortedItems = sortFeedItems(itemsByKind.flat(), sortMode).slice(skip, skip + limit);

      return reply.send({
        items: sortedItems,
        meta: {
          page,
          limit,
          total: totalForSelectedKind,
          hasMore: skip + sortedItems.length < totalForSelectedKind,
          kind,
          status,
          sort: sortMode,
          query: queryText,
          scope: isAdminScope ? 'admin' : 'workspace',
          kindCounts: {
            all: sumNumbers(...Object.values(kindCounts)),
            ...kindCounts,
          },
          statusCounts: {
            all: statusAllCount,
            ...statusCounts,
          },
        },
      });
    },
  );

  // GET /resources/my-workbench —— 我的工作台
  app.get(
    '/resources/my-workbench',
    {
      preHandler: [fastifyAuthenticate],
      schema: { querystring: workbenchQuerySchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const req = request as AuthReq;
      const userId = req.userId as string;
      const query = request.query as Record<string, unknown>;
      const limit = parseLimit(query.limit);

      const [assets, materials, plugins, softwares, showcases] = await Promise.all([
        prisma.asset.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          include: {
            category: true,
          },
        }),
        prisma.material.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { favorites: true } },
          },
        }),
        prisma.plugin.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        prisma.software.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        prisma.showcase.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          include: {
            _count: { select: { likes: true, comments: true } },
          },
        }),
      ]);

      const allStatuses = [
        ...assets.map((item) => item.status),
        ...materials.map((item) => item.status),
        ...plugins.map((item) => item.status),
        ...softwares.map((item) => item.status),
        ...showcases.map((item) => item.status),
      ];
      const countStatus = (status: string) => allStatuses.filter((item) => item === status).length;
      const total = allStatuses.length;
      const pending = countStatus('PENDING');
      const rejected = countStatus('REJECTED');
      const approved = countStatus('APPROVED');
      const totalSize = sumNumbers(
        assets.reduce((sum, item) => sum + Number(item.size || 0), 0),
        materials.reduce((sum, item) => sum + Number(item.fileSize || 0), 0),
        plugins.reduce((sum, item) => sum + Number(item.fileSize || 0), 0),
        softwares.reduce((sum, item) => sum + Number(item.fileSize || 0), 0),
      );
      const totalReach = sumNumbers(
        assets.reduce((sum, item) => sum + Number(item.downloads || item.viewCount || 0), 0),
        materials.reduce((sum, item) => sum + Number(item.downloads || 0), 0),
        plugins.reduce((sum, item) => sum + Number(item.downloads || 0), 0),
        softwares.reduce((sum, item) => sum + Number(item.downloads || 0), 0),
        showcases.reduce((sum, item) => sum + Number(item.views || 0), 0),
      );

      return reply.send({
        assets,
        materials,
        plugins,
        softwares,
        showcases,
        summary: {
          total,
          approved,
          pending,
          rejected,
          totalSize,
          totalReach,
          readyRate: total > 0 ? Math.round((approved / total) * 100) : 100,
          needsAction: pending + rejected,
          generatedAt: new Date().toISOString(),
        },
      });
    },
  );

  // GET /resources/overview —— 资源总览（含 Redis 缓存）
  app.get(
    '/resources/overview',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const req = request as AuthReq;
      const userId = req.userId as string;
      const teamFilter = getTeamFilter(req.workspaceId);
      const isAdminScope = isAdminResourceScope(req);

      const cacheKey = `resource:overview:${userId}:${req.workspaceId || 'none'}:${isAdminScope}`;
      const cached = await redisService.get<unknown>(cacheKey);
      if (cached) {
        return reply.send(cached);
      }

      const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const assetOwnershipWhere = isAdminScope ? {} : { userId, ...teamFilter };
      const materialOwnershipWhere = isAdminScope ? {} : { userId, ...teamFilter };
      const pluginOwnershipWhere = isAdminScope ? {} : { userId };
      const softwareOwnershipWhere = isAdminScope ? {} : { userId };
      const showcaseOwnershipWhere = isAdminScope ? {} : { userId, ...teamFilter };
      const assetVisibleWhere = isAdminScope
        ? {}
        : { OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }] };
      const materialVisibleWhere = isAdminScope
        ? {}
        : { OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }] };
      const pluginVisibleWhere = isAdminScope
        ? {}
        : { OR: [{ status: APPROVED_STATUS }, { userId }] };
      const softwareVisibleWhere = isAdminScope
        ? {}
        : { OR: [{ status: APPROVED_STATUS }, { userId }] };
      const showcaseVisibleWhere = isAdminScope
        ? {}
        : { OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }] };
      const reviewQueueStatuses = isAdminScope ? ['PENDING'] : REVIEW_STATUSES;
      const assetReviewWhere = { ...assetOwnershipWhere, status: { in: reviewQueueStatuses } };
      const materialReviewWhere = {
        ...materialOwnershipWhere,
        status: { in: reviewQueueStatuses },
      };
      const pluginReviewWhere = { ...pluginOwnershipWhere, status: { in: reviewQueueStatuses } };
      const softwareReviewWhere = {
        ...softwareOwnershipWhere,
        status: { in: reviewQueueStatuses },
      };
      const showcaseReviewWhere = {
        ...showcaseOwnershipWhere,
        status: { in: reviewQueueStatuses },
      };

      const [
        assetTotal,
        assetMine,
        assetPending,
        assetRejected,
        assetWeek,
        assetAggregate,
        materialTotal,
        materialMine,
        materialPending,
        materialRejected,
        materialWeek,
        materialAggregate,
        materialFavorites,
        pluginTotal,
        pluginMine,
        pluginPending,
        pluginRejected,
        pluginWeek,
        pluginAggregate,
        softwareTotal,
        softwareMine,
        softwarePending,
        softwareRejected,
        softwareWeek,
        softwareAggregate,
        softwareFavorites,
        showcaseTotal,
        showcaseMine,
        showcasePending,
        showcaseRejected,
        showcaseWeek,
        showcaseAggregate,
        showcaseLikes,
        showcaseComments,
        assetStorage,
        materialStorage,
        pluginStorage,
        softwareStorage,
        recentAssets,
        recentMaterials,
        recentPlugins,
        recentSoftwares,
        recentShowcases,
        topAssets,
        topMaterials,
        topPlugins,
        topSoftwares,
        topShowcases,
        reviewAssets,
        reviewMaterials,
        reviewPlugins,
        reviewSoftwares,
        reviewShowcases,
        assetTagRows,
        materialTagRows,
        pluginTagRows,
        softwareTagRows,
        showcaseTagRows,
      ] = await Promise.all([
        prisma.asset.count({ where: { status: APPROVED_STATUS } }),
        prisma.asset.count({ where: assetOwnershipWhere }),
        prisma.asset.count({ where: { ...assetOwnershipWhere, status: 'PENDING' } }),
        prisma.asset.count({ where: { ...assetOwnershipWhere, status: 'REJECTED' } }),
        prisma.asset.count({ where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } } }),
        prisma.asset.aggregate({
          where: { status: APPROVED_STATUS },
          _sum: { downloads: true, viewCount: true, likes: true, size: true },
        }),
        prisma.material.count({ where: { status: APPROVED_STATUS } }),
        prisma.material.count({ where: materialOwnershipWhere }),
        prisma.material.count({ where: { ...materialOwnershipWhere, status: 'PENDING' } }),
        prisma.material.count({ where: { ...materialOwnershipWhere, status: 'REJECTED' } }),
        prisma.material.count({
          where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } },
        }),
        prisma.material.aggregate({
          where: { status: APPROVED_STATUS },
          _sum: { downloads: true, fileSize: true },
        }),
        prisma.materialFavorite.count({ where: { material: { status: APPROVED_STATUS } } }),
        prisma.plugin.count({ where: { status: APPROVED_STATUS } }),
        prisma.plugin.count({ where: pluginOwnershipWhere }),
        prisma.plugin.count({ where: { ...pluginOwnershipWhere, status: 'PENDING' } }),
        prisma.plugin.count({ where: { ...pluginOwnershipWhere, status: 'REJECTED' } }),
        prisma.plugin.count({ where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } } }),
        prisma.plugin.aggregate({
          where: { status: APPROVED_STATUS },
          _sum: { downloads: true, fileSize: true },
        }),
        prisma.software.count({ where: { status: APPROVED_STATUS } }),
        prisma.software.count({ where: softwareOwnershipWhere }),
        prisma.software.count({ where: { ...softwareOwnershipWhere, status: 'PENDING' } }),
        prisma.software.count({ where: { ...softwareOwnershipWhere, status: 'REJECTED' } }),
        prisma.software.count({
          where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } },
        }),
        prisma.software.aggregate({
          where: { status: APPROVED_STATUS },
          _sum: { downloads: true, fileSize: true },
        }),
        prisma.softwareFavorite.count({ where: { software: { status: APPROVED_STATUS } } }),
        prisma.showcase.count({ where: { status: APPROVED_STATUS } }),
        prisma.showcase.count({ where: showcaseOwnershipWhere }),
        prisma.showcase.count({ where: { ...showcaseOwnershipWhere, status: 'PENDING' } }),
        prisma.showcase.count({ where: { ...showcaseOwnershipWhere, status: 'REJECTED' } }),
        prisma.showcase.count({
          where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } },
        }),
        prisma.showcase.aggregate({
          where: { status: APPROVED_STATUS },
          _sum: { views: true },
        }),
        prisma.showcaseLike.count({ where: { showcase: { status: APPROVED_STATUS } } }),
        prisma.showcaseComment.count({ where: { showcase: { status: APPROVED_STATUS } } }),
        prisma.asset.aggregate({ where: assetOwnershipWhere, _sum: { size: true } }),
        prisma.material.aggregate({ where: materialOwnershipWhere, _sum: { fileSize: true } }),
        prisma.plugin.aggregate({ where: pluginOwnershipWhere, _sum: { fileSize: true } }),
        prisma.software.aggregate({ where: softwareOwnershipWhere, _sum: { fileSize: true } }),
        prisma.asset.findMany({
          where: assetVisibleWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: {
            category: true,
            user: { select: { name: true, email: true } },
          },
        }),
        prisma.material.findMany({
          where: materialVisibleWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { favorites: true } },
          },
        }),
        prisma.plugin.findMany({
          where: pluginVisibleWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.software.findMany({
          where: softwareVisibleWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.showcase.findMany({
          where: showcaseVisibleWhere,
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { likes: true, comments: true } },
          },
        }),
        prisma.asset.findMany({
          where: { status: APPROVED_STATUS },
          orderBy: [{ downloads: 'desc' }, { viewCount: 'desc' }],
          take: 6,
          include: { category: true, user: { select: { name: true, email: true } } },
        }),
        prisma.material.findMany({
          where: { status: APPROVED_STATUS },
          orderBy: { downloads: 'desc' },
          take: 6,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { favorites: true } },
          },
        }),
        prisma.plugin.findMany({
          where: { status: APPROVED_STATUS },
          orderBy: { downloads: 'desc' },
          take: 6,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.software.findMany({
          where: { status: APPROVED_STATUS },
          orderBy: { downloads: 'desc' },
          take: 6,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.showcase.findMany({
          where: { status: APPROVED_STATUS },
          orderBy: { views: 'desc' },
          take: 6,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { likes: true, comments: true } },
          },
        }),
        prisma.asset.findMany({
          where: assetReviewWhere,
          orderBy: isAdminScope ? { createdAt: 'asc' } : { updatedAt: 'desc' },
          take: 6,
          include: { category: true, user: { select: { name: true, email: true } } },
        }),
        prisma.material.findMany({
          where: materialReviewWhere,
          orderBy: isAdminScope ? { createdAt: 'asc' } : { updatedAt: 'desc' },
          take: 6,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { favorites: true } },
          },
        }),
        prisma.plugin.findMany({
          where: pluginReviewWhere,
          orderBy: isAdminScope ? { createdAt: 'asc' } : { updatedAt: 'desc' },
          take: 6,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.software.findMany({
          where: softwareReviewWhere,
          orderBy: isAdminScope ? { createdAt: 'asc' } : { updatedAt: 'desc' },
          take: 6,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.showcase.findMany({
          where: showcaseReviewWhere,
          orderBy: isAdminScope ? { createdAt: 'asc' } : { updatedAt: 'desc' },
          take: 6,
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { likes: true, comments: true } },
          },
        }),
        prisma.asset.findMany({
          where: { status: APPROVED_STATUS, tags: { not: null } },
          select: { tags: true },
          take: 400,
        }),
        prisma.material.findMany({
          where: { status: APPROVED_STATUS, tags: { not: null } },
          select: { tags: true },
          take: 400,
        }),
        prisma.plugin.findMany({
          where: { status: APPROVED_STATUS, tags: { not: null } },
          select: { tags: true },
          take: 400,
        }),
        prisma.software.findMany({
          where: { status: APPROVED_STATUS, tags: { not: null } },
          select: { tags: true },
          take: 400,
        }),
        prisma.showcase.findMany({
          where: { status: APPROVED_STATUS, tags: { not: null } },
          select: { tags: true },
          take: 400,
        }),
      ]);

      const normalizeAssets = (
        items: typeof recentAssets,
        metricLabel: string,
      ): ResourceFeedItem[] => items.map((asset) => normalizeAssetItem(asset, metricLabel));

      const normalizeMaterials = (
        items: typeof recentMaterials,
        metricLabel: string,
      ): ResourceFeedItem[] =>
        items.map((material) => normalizeMaterialItem(material, metricLabel));

      const normalizePlugins = (
        items: typeof recentPlugins,
        metricLabel: string,
      ): ResourceFeedItem[] => items.map((plugin) => normalizePluginItem(plugin, metricLabel));

      const normalizeSoftwares = (
        items: typeof recentSoftwares,
        metricLabel: string,
      ): ResourceFeedItem[] =>
        items.map((software) => normalizeSoftwareItem(software, metricLabel));

      const normalizeShowcases = (
        items: typeof recentShowcases,
        metricLabel: string,
      ): ResourceFeedItem[] =>
        items.map((showcase) => normalizeShowcaseItem(showcase, metricLabel));

      const recentItems = [
        ...normalizeAssets(recentAssets, '触达'),
        ...normalizeMaterials(recentMaterials, '收藏'),
        ...normalizePlugins(recentPlugins, '下载'),
        ...normalizeSoftwares(recentSoftwares, '下载'),
        ...normalizeShowcases(recentShowcases, '互动'),
      ]
        .sort(
          (a, b) =>
            getDateTime(b.updatedAt || b.createdAt) - getDateTime(a.updatedAt || a.createdAt),
        )
        .slice(0, 14);

      const topItems = [
        ...normalizeAssets(topAssets, '下载'),
        ...normalizeMaterials(topMaterials, '下载'),
        ...normalizePlugins(topPlugins, '下载'),
        ...normalizeSoftwares(topSoftwares, '下载'),
        ...normalizeShowcases(topShowcases, '浏览'),
      ]
        .sort((a, b) => b.metric - a.metric)
        .slice(0, 12);

      const reviewQueue = [
        ...normalizeAssets(reviewAssets, '触达'),
        ...normalizeMaterials(reviewMaterials, '收藏'),
        ...normalizePlugins(reviewPlugins, '下载'),
        ...normalizeSoftwares(reviewSoftwares, '下载'),
        ...normalizeShowcases(reviewShowcases, '互动'),
      ]
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'REJECTED' ? -1 : 1;
          return isAdminScope
            ? getDateTime(a.createdAt) - getDateTime(b.createdAt)
            : getDateTime(b.updatedAt || b.createdAt) - getDateTime(a.updatedAt || a.createdAt);
        })
        .slice(0, 12);

      const libraries = [
        {
          key: 'assets',
          label: '资源库',
          path: '/assets',
          total: assetTotal,
          mine: assetMine,
          pending: assetPending,
          rejected: assetRejected,
          weekAdded: assetWeek,
          metric: sumNumbers(assetAggregate._sum.downloads, assetAggregate._sum.viewCount),
          metricLabel: '下载 / 浏览',
          storageMb: assetStorage._sum.size ?? 0,
        },
        {
          key: 'materials',
          label: '材质库',
          path: '/materials',
          total: materialTotal,
          mine: materialMine,
          pending: materialPending,
          rejected: materialRejected,
          weekAdded: materialWeek,
          metric: sumNumbers(materialAggregate._sum.downloads, materialFavorites),
          metricLabel: '下载 / 收藏',
          storageMb: materialStorage._sum.fileSize ?? 0,
        },
        {
          key: 'plugins',
          label: '插件库',
          path: '/plugins',
          total: pluginTotal,
          mine: pluginMine,
          pending: pluginPending,
          rejected: pluginRejected,
          weekAdded: pluginWeek,
          metric: pluginAggregate._sum.downloads ?? 0,
          metricLabel: '下载',
          storageMb: pluginStorage._sum.fileSize ?? 0,
        },
        {
          key: 'softwares',
          label: '软件库',
          path: '/softwares',
          total: softwareTotal,
          mine: softwareMine,
          pending: softwarePending,
          rejected: softwareRejected,
          weekAdded: softwareWeek,
          metric: sumNumbers(softwareAggregate._sum.downloads, softwareFavorites),
          metricLabel: '下载 / 收藏',
          storageMb: softwareStorage._sum.fileSize ?? 0,
        },
        {
          key: 'showcase',
          label: '作品展示',
          path: '/showcase',
          total: showcaseTotal,
          mine: showcaseMine,
          pending: showcasePending,
          rejected: showcaseRejected,
          weekAdded: showcaseWeek,
          metric: sumNumbers(showcaseAggregate._sum.views, showcaseLikes, showcaseComments),
          metricLabel: '浏览 / 互动',
          storageMb: 0,
        },
      ];

      const pendingReview = sumNumbers(
        assetPending,
        materialPending,
        pluginPending,
        softwarePending,
        showcasePending,
      );
      const rejectedReview = sumNumbers(
        assetRejected,
        materialRejected,
        pluginRejected,
        softwareRejected,
        showcaseRejected,
      );
      const myItems = sumNumbers(assetMine, materialMine, pluginMine, softwareMine, showcaseMine);
      const readyMine = Math.max(0, myItems - pendingReview - rejectedReview);
      const readyRate = myItems > 0 ? Math.round((readyMine / myItems) * 100) : 100;
      const staleReviewAt = new Date(Date.now() - STALE_REVIEW_HOURS * 60 * 60 * 1000);
      const [staleAssets, staleMaterials, stalePlugins, staleSoftwares, staleShowcases] =
        await Promise.all([
          prisma.asset.count({
            where: { ...assetOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
          }),
          prisma.material.count({
            where: {
              ...materialOwnershipWhere,
              status: 'PENDING',
              createdAt: { lt: staleReviewAt },
            },
          }),
          prisma.plugin.count({
            where: { ...pluginOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
          }),
          prisma.software.count({
            where: {
              ...softwareOwnershipWhere,
              status: 'PENDING',
              createdAt: { lt: staleReviewAt },
            },
          }),
          prisma.showcase.count({
            where: {
              ...showcaseOwnershipWhere,
              status: 'PENDING',
              createdAt: { lt: staleReviewAt },
            },
          }),
        ]);
      const staleReview = sumNumbers(
        staleAssets,
        staleMaterials,
        stalePlugins,
        staleSoftwares,
        staleShowcases,
      );
      const oldestReviewHours = reviewQueue.reduce(
        (max, item) => Math.max(max, item.reviewAgeHours || 0),
        0,
      );
      const reviewPressureLevel =
        pendingReview > 20 || staleReview > 0
          ? 'high'
          : pendingReview > 5 || rejectedReview > 0
            ? 'watch'
            : 'none';

      const result = {
        scope: isAdminScope ? 'admin' : 'workspace',
        summary: {
          totalPublic: sumNumbers(
            assetTotal,
            materialTotal,
            pluginTotal,
            softwareTotal,
            showcaseTotal,
          ),
          myItems,
          pendingReview,
          rejectedReview,
          reviewPressure: pendingReview + rejectedReview,
          readyRate,
          libraryCount: libraries.length,
          weekAdded: sumNumbers(assetWeek, materialWeek, pluginWeek, softwareWeek, showcaseWeek),
          interactions: sumNumbers(
            assetAggregate._sum.downloads,
            assetAggregate._sum.viewCount,
            assetAggregate._sum.likes,
            materialAggregate._sum.downloads,
            materialFavorites,
            pluginAggregate._sum.downloads,
            softwareAggregate._sum.downloads,
            showcaseAggregate._sum.views,
            showcaseLikes,
            showcaseComments,
          ),
          storageMb: sumNumbers(
            assetStorage._sum.size,
            materialStorage._sum.fileSize,
            pluginStorage._sum.fileSize,
            softwareStorage._sum.fileSize,
          ),
        },
        reviewPressure: {
          scope: isAdminScope ? 'admin' : 'workspace',
          pending: pendingReview,
          rejected: rejectedReview,
          stale: staleReview,
          staleThresholdHours: STALE_REVIEW_HOURS,
          oldestHours: oldestReviewHours,
          level: reviewPressureLevel,
          message:
            reviewPressureLevel === 'high'
              ? isAdminScope
                ? `${pendingReview} 条内容等待审核，其中 ${staleReview} 条已超过 ${STALE_REVIEW_HOURS} 小时。`
                : `${pendingReview} 条内容仍在审核，${rejectedReview} 条需要修改后重新提交。`
              : reviewPressureLevel === 'watch'
                ? isAdminScope
                  ? `${pendingReview} 条内容等待审核，请保持队列流转。`
                  : `${rejectedReview} 条内容需要修改，处理后可重新进入审核。`
                : '当前审核队列健康。',
          ctaPath: isAdminScope ? '/admin/audits' : '/my-works',
        },
        libraries,
        hotTags: mergeHotTags(
          assetTagRows.flatMap((row) => parseTags(row.tags)),
          materialTagRows.flatMap((row) => parseTags(row.tags)),
          pluginTagRows.flatMap((row) => parseTags(row.tags)),
          softwareTagRows.flatMap((row) => parseTags(row.tags)),
          showcaseTagRows.flatMap((row) => parseTags(row.tags)),
        ),
        recentItems,
        topItems,
        reviewQueue,
        generatedAt: new Date().toISOString(),
      };

      await redisService.set(cacheKey, result, 15);

      return reply.send(result);
    },
  );

  // GET /resources/search-external —— 外部资源搜索
  app.get(
    '/resources/search-external',
    {
      preHandler: [fastifyAuthenticate],
      schema: { querystring: searchExternalQuerySchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const q = (request.query as { q: string }).q;
      if (typeof q !== 'string' || !q.trim()) {
        return reply.status(400).send({ error: 'Missing search query q' });
      }
      const { searchAndAnalyze } = await import('../../services/external-search.service');
      const result = await searchAndAnalyze(q);
      return reply.send(result);
    },
  );

  // POST /resources/import-external —— 外部资源导入
  app.post(
    '/resources/import-external',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: importExternalResourceSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const req = request as AuthReq;
      const {
        url: rawUrl,
        title,
        type,
        snippet,
      } = request.body as {
        url: string;
        title: string;
        type: string;
        snippet?: string;
      };
      const userId = req.userId as string;

      if (!rawUrl || !title || !type) {
        return reply.status(400).send({ error: 'Missing required fields: url, title, type' });
      }

      const { normalizeResourceUrl } = await import('../../services/external-search.service');
      const url = normalizeResourceUrl(rawUrl);

      let scrapedTextParagraphs: string[] = [];
      let scrapedImageUrls: string[] = [];
      let isFallbackScraped = false;
      let isReaderScraped = false;
      let fallbackSourceUrl = '';

      const hydrateSuperHiveImages = async (): Promise<boolean> => {
        if (!isSuperHiveProductUrl(url)) return false;

        const readerData = await scrapeSuperHiveViaReader(url, title);
        if (!readerData) return false;

        const localImageUrls: string[] = [];
        for (const imageUrl of readerData.imageUrls) {
          const localPath = await downloadAndSaveImage(imageUrl, url);
          if (localPath) localImageUrls.push(localPath);
        }

        if (localImageUrls.length === 0) return false;

        scrapedImageUrls = localImageUrls;
        if (readerData.textParagraphs.length > 0) {
          scrapedTextParagraphs = readerData.textParagraphs;
        }
        isFallbackScraped = true;
        isReaderScraped = true;
        fallbackSourceUrl = url;
        logger.info(
          `[Import External Superhive] Imported ${localImageUrls.length} product image(s) via reader fallback: ${url}`,
        );
        return true;
      };

      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            Referer: 'https://www.google.com/',
          },
          timeout: 3000,
          proxy: false,
          httpAgent: new http.Agent({ keepAlive: true }),
          httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
        });
        const $ = cheerio.load(response.data);

        const imageUrls: string[] = [];
        const imageSelectors = [
          '.entry-content img',
          '.post-content img',
          '.article-content img',
          '.entry img',
          '.entry-inner img',
          '.post-inner img',
          'article img',
          '.post img',
          'main img',
          '#content img',
          '.single-content img',
        ];
        let imgElements = $(imageSelectors.join(', '));
        if (imgElements.length === 0) {
          imgElements = $('img');
        }

        // A number of channels expose their reliable cover only through Open
        // Graph metadata, or defer the <img> source until the browser scrolls.
        $(
          'meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"], meta[itemprop="image"]',
        ).each((_, el) => {
          const imageUrl = resolveExternalImageUrl($(el).attr('content') || '', url);
          if (
            imageUrl &&
            imageUrls.length < 5 &&
            !isJunkOrQrImage(imageUrl) &&
            !imageUrls.includes(imageUrl)
          ) {
            imageUrls.push(imageUrl);
          }
        });

        imgElements.each((i, el) => {
          const parent = $(el).parents(
            'footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header, .author-avatar, .widget-postlist',
          );
          if (parent.length > 0) return;

          let src =
            $(el).attr('data-src') ||
            $(el).attr('data-original-src') ||
            $(el).attr('data-original') ||
            $(el).attr('data-lazy-src') ||
            $(el).attr('data-lazyload') ||
            $(el).attr('data-image') ||
            $(el).attr('src');
          if (!src || src.startsWith('data:')) {
            src =
              getLargestSourceFromSrcset(
                $(el).attr('data-original-srcset') ||
                  $(el).attr('data-lazy-srcset') ||
                  $(el).attr('data-srcset') ||
                  $(el).attr('srcset'),
              ) || undefined;
          }
          const imageUrl = src ? resolveExternalImageUrl(src, url) : null;
          if (imageUrl && imageUrls.length < 5) {
            if (!isJunkOrQrImage(imageUrl, $(el)) && !imageUrls.includes(imageUrl)) {
              imageUrls.push(imageUrl);
            }
          }
        });

        const textParagraphs: string[] = [];
        const articleSelectors = [
          '.entry-content p',
          '.post-content p',
          '.article-content p',
          '.entry p',
          '.entry-inner p',
          '.post-inner p',
          'article p',
          '.post p',
          'main p',
          '#content p',
          '.single-content p',
        ];
        let pElements = $(articleSelectors.join(', '));
        if (pElements.length === 0) {
          pElements = $('p');
        }

        pElements.each((i, el) => {
          const parent = $(el).parents(
            'footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header',
          );
          if (parent.length > 0) return;

          // 复制节点，将 a 标签转换为 [text](href) 格式，保留网页内含的下载网盘链接
          const cloned = $(el).clone();
          cloned.find('a').each((j, aEl) => {
            const href = $(aEl).attr('href') || '';
            const text = $(aEl).text().trim();
            if (href && text) {
              $(aEl).replaceWith(`[${text}](${href})`);
            }
          });

          const txt = cloned.text().trim();
          if (txt && txt.length > 20 && textParagraphs.length < 15) {
            if (
              txt.includes('Copyright') ||
              txt.includes('©') ||
              txt.includes('备案号') ||
              txt.includes('All rights reserved')
            ) {
              return;
            }
            if (!snippet || !snippet.includes(txt.substring(0, 15))) {
              textParagraphs.push(txt);
            }
          }
        });

        const localImageUrls: string[] = [];
        for (const imgUrl of imageUrls) {
          const localPath = await downloadAndSaveImage(imgUrl, url);
          if (localPath) {
            localImageUrls.push(localPath);
          }
        }

        scrapedTextParagraphs = textParagraphs;
        scrapedImageUrls = localImageUrls;
      } catch (fetchErr: unknown) {
        logger.error(
          `[Import External] Failed to scrape webpage ${url}: ${(fetchErr as Error).message}`,
        );

        const hydratedFromSuperHive = await hydrateSuperHiveImages();
        if (!hydratedFromSuperHive) {
          logger.info(
            `[Import External] Triggering fallback search & scrape for title: "${title}" (type: ${type})`,
          );
          const fallbackData = await performFallbackSearchAndScrape(title, url, type);

          if (fallbackData) {
            isFallbackScraped = true;
            fallbackSourceUrl = fallbackData.fallbackUrl || '';

            const localFallbackImageUrls: string[] = [];
            for (const imgUrl of fallbackData.imageUrls) {
              const localPath = await downloadAndSaveImage(imgUrl, fallbackData.fallbackUrl || url);
              if (localPath) {
                localFallbackImageUrls.push(localPath);
              }
            }

            scrapedTextParagraphs = fallbackData.textParagraphs;
            scrapedImageUrls = localFallbackImageUrls;
          }
        }
      }

      // Superhive may return a valid challenge page instead of a 403. In that
      // case the direct scrape succeeds but yields no useful product image.
      if (scrapedImageUrls.length === 0) {
        await hydrateSuperHiveImages();
      }

      const aiData = await parseResourceWithAI(title, snippet, scrapedTextParagraphs, type);

      let descriptionMarkdown = `### ${title}\n\n来自源站的资源详情页面：[直接访问源站](${url})\n\n`;

      if (isFallbackScraped) {
        descriptionMarkdown += isReaderScraped
          ? `*(注：源站限制了服务器直接访问，系统已通过公开页面读取服务生成简介并补充预览图)*\n\n`
          : `*(注：由于原源站防爬虫限制，系统已自动从公开网络备用站点 [直接访问备用源站](${fallbackSourceUrl || url}) 生成简介并补充预览图)*\n\n`;
      }

      if (aiData?.translatedDescription) {
        descriptionMarkdown += `### ✨ AI 智能简介\n\n${aiData.translatedDescription}\n\n`;
      } else {
        descriptionMarkdown += `*(暂未能生成 AI 简介；可通过上方源站链接查看完整详情。)*\n\n`;
      }

      if (scrapedImageUrls.length > 0) {
        descriptionMarkdown += `### 🖼️ 资源预览图\n\n`;
        descriptionMarkdown += `![主预览图](${scrapedImageUrls[0]})\n\n`;
      }
      if (scrapedImageUrls.length > 1) {
        descriptionMarkdown += `### 🔍 更多细节截图\n\n`;
        scrapedImageUrls.slice(1).forEach((imgUrl, index) => {
          descriptionMarkdown += `![细节截图 ${index + 1}](${imgUrl})\n\n`;
        });
      }

      const coverUrl = scrapedImageUrls.length > 0 ? scrapedImageUrls[0] : null;

      let createdItem: Record<string, unknown>;
      if (type === 'asset') {
        let tagsJson: string | null = null;
        if (aiData?.tags) {
          const tagList = aiData.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
          if (tagList.length > 0) {
            tagsJson = JSON.stringify(tagList);
          }
        }

        createdItem = await prisma.asset.create({
          data: {
            title,
            description: descriptionMarkdown,
            url,
            thumbnail: coverUrl,
            status: 'PENDING',
            type: 'EXTERNAL',
            userId,
            meshType: aiData?.meshType || 'UNKNOWN',
            tags: tagsJson,
            uvUnwrapped: false,
            uvOverlapping: false,
            pbrChannels: '[]',
            rigged: false,
            gameReady: false,
          },
        });
      } else if (type === 'material') {
        createdItem = await prisma.material.create({
          data: {
            title,
            description: descriptionMarkdown,
            category: '外部导入',
            resolution: aiData?.resolution || null,
            isProcedural: typeof aiData?.isProcedural === 'boolean' ? aiData.isProcedural : false,
            tags: aiData?.tags || null,
            fileUrl: url,
            previewUrl: coverUrl,
            status: 'PENDING',
            userId,
          },
        });
      } else if (type === 'plugin') {
        const isBlenderExtensionsOrg = url.includes('extensions.blender.org');
        createdItem = await prisma.plugin.create({
          data: {
            title,
            description: descriptionMarkdown,
            category: isBlenderExtensionsOrg ? '官方库插件' : aiData?.category || '其他工具',
            version: aiData?.version || '1.0.0',
            compatibility: aiData?.compatibility || '',
            tags: aiData?.tags || '',
            fileUrl: url,
            previewUrl: coverUrl,
            status: 'PENDING',
            userId,
          },
        });
      } else if (type === 'software') {
        createdItem = await prisma.software.create({
          data: {
            title,
            description: descriptionMarkdown,
            category: aiData?.category || '其他工具',
            version: aiData?.version || '1.0.0',
            compatibility: aiData?.compatibility || '',
            tags: aiData?.tags || '',
            fileUrl: url,
            previewUrl: coverUrl,
            status: 'PENDING',
            userId,
          },
        });
      } else {
        return reply.status(400).send({ error: 'Invalid resource type' });
      }

      return reply.send({
        success: true,
        message: '一键导入草稿箱成功！',
        item: createdItem,
      });
    },
  );

  // POST /resources/upload-temp-cancel —— 取消临时上传
  app.post(
    '/resources/upload-temp-cancel',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: cancelTempUploadSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { filePath } = request.body as { filePath: string };

      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        deleteCloudOrLocalFileByUrl(filePath).catch((err) => {
          logger.error(`[Cancel Temp Upload] Failed to delete cloud file ${filePath}:`, err);
        });
        return reply.send({ success: true, message: '临时文件已删除' });
      }

      // Security check: only allow deleting files under uploads/temp to prevent directory traversal
      const resolvedPath = path.resolve(process.cwd(), filePath.replace(/^\/+/, ''));
      const tempDir = path.resolve(process.cwd(), 'uploads', 'temp');

      if (!resolvedPath.startsWith(tempDir)) {
        return reply.status(403).send({ error: '拒绝访问：只能删除临时文件夹中的文件' });
      }

      try {
        await fs.promises.unlink(resolvedPath).catch((err: unknown) => {
          const code = (err as NodeJS.ErrnoException)?.code;
          if (code !== 'ENOENT') throw err;
        });
        return reply.send({ success: true, message: '临时文件已删除' });
      } catch (err: unknown) {
        logger.error(
          `[Cancel Temp Upload] Failed to delete file ${resolvedPath}: ${(err as Error).message}`,
        );
        return reply.status(500).send({ error: '删除文件失败' });
      }
    },
  );

  // POST /resources/presigned-url —— 预签名上传 URL
  app.post(
    '/resources/presigned-url',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourcePresignedUrlSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { filename, mimetype, size, fieldname } = request.body as {
        filename: string;
        mimetype: string;
        size?: number;
        fieldname?: string;
      };

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.send({ isDirect: false });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, size);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const folderPrefix = fieldname || 'temp';
        const key = generateS3Key(filename, folderPrefix);

        const uploadUrl = await storageService.getPresignedUploadUrl(config, key, mimetype);
        const publicUrlBase = config.publicUrl.replace(/\/$/, '');
        const publicUrl = `${publicUrlBase}/${key}`;

        return reply.send({
          isDirect: true,
          uploadUrl,
          publicUrl,
          key,
        });
      } catch (error) {
        logger.error('Get resource presigned url error:', error);
        throw error;
      }
    },
  );

  // POST /resources/complete-single —— 完成单次上传
  app.post(
    '/resources/complete-single',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourceCompleteSingleUploadSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { filename, key, size, mimetype, fieldname } = request.body as {
        filename: string;
        key: string;
        size: number | string;
        mimetype: string;
        fieldname?: string;
      };
      const numericSize = typeof size === 'string' ? Number(size) : size;

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.status(400).send({ error: '未启用云存储配置' });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, numericSize);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        await incrementConfigUsedBytes(raw.id, numericSize);

        try {
          await storageService.applyCacheControlMetadata(config, key, mimetype);
        } catch (cacheMetadataError) {
          logger.warn(
            `Unable to apply R2 cache metadata for ${key}: ${
              cacheMetadataError instanceof Error
                ? cacheMetadataError.message
                : String(cacheMetadataError)
            }`,
          );
        }

        const publicUrlBase = raw.publicUrl.replace(/\/$/, '');
        const fileUrl = `${publicUrlBase}/${key}`;

        return reply.status(201).send({
          success: true,
          filePath: fileUrl,
          originalName: filename,
        });
      } catch (error) {
        logger.error('Complete single resource upload error:', error);
        throw error;
      }
    },
  );

  // POST /resources/multipart/initiate —— 初始化分片上传
  app.post(
    '/resources/multipart/initiate',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourceInitiateMultipartSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { filename, mimetype, size, fieldname } = request.body as {
        filename: string;
        mimetype: string;
        size?: number;
        fieldname?: string;
      };

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.send({ isDirect: false });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, size);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const folderPrefix = fieldname || 'temp';
        const key = generateS3Key(filename, folderPrefix);

        const uploadId = await storageService.initiateMultipartUpload(config, key, mimetype);
        return reply.send({
          isDirect: true,
          uploadId,
          key,
        });
      } catch (error) {
        logger.error('Initiate resource multipart upload error:', error);
        throw error;
      }
    },
  );

  // POST /resources/multipart/presign-parts —— 获取分片预签名
  app.post(
    '/resources/multipart/presign-parts',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourcePresignPartsSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { key, uploadId, partNumbers, fieldname } = request.body as {
        key: string;
        uploadId: string;
        partNumbers: Array<number | string>;
        fieldname?: string;
      };

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { config } = active;

        const urls: Record<number, string> = {};
        for (const partNum of partNumbers) {
          const url = await storageService.getPresignedUploadPartUrl(
            config,
            key,
            uploadId,
            Number(partNum),
          );
          urls[Number(partNum)] = url;
        }
        return reply.send({ urls });
      } catch (error) {
        logger.error('Get resource presigned upload part urls error:', error);
        throw error;
      }
    },
  );

  // POST /resources/multipart/complete —— 完成分片上传
  app.post(
    '/resources/multipart/complete',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourceCompleteMultipartSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const {
        key,
        uploadId,
        parts,
        filename,
        mimetype: _mimetype,
        size,
        fieldname,
      } = request.body as {
        key: string;
        uploadId: string;
        parts: unknown[];
        filename: string;
        mimetype: string;
        size: number | string;
        fieldname?: string;
      };
      const numericSize = typeof size === 'string' ? Number(size) : size;

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, numericSize);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const finalUrl = await storageService.completeMultipartUpload(
          config,
          key,
          uploadId,
          parts as { ETag: string; PartNumber: number }[],
        );

        await incrementConfigUsedBytes(raw.id, numericSize);

        return reply.status(201).send({
          success: true,
          filePath: finalUrl,
          originalName: filename,
        });
      } catch (error) {
        logger.error('Complete resource multipart upload error:', error);
        throw error;
      }
    },
  );

  // POST /resources/multipart/abort —— 取消分片上传
  app.post(
    '/resources/multipart/abort',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: resourceAbortMultipartSchema },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { key, uploadId, fieldname } = request.body as {
        key: string;
        uploadId: string;
        fieldname?: string;
      };

      try {
        const storageType = getStorageTypeForField(fieldname);
        const active = await getDecryptedActiveStorageConfig(storageType);
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { config } = active;

        await storageService.abortMultipartUpload(config, key, uploadId);
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Abort resource multipart upload error:', error);
        throw error;
      }
    },
  );
};
