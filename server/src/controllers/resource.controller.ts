import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { callLLMWithFailover } from '../services/ai.service';
import { parseTags } from '../utils/tags';
import redisService from '../services/redis.service';
import axios from 'axios';
import http from 'http';
import https from 'https';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { storageService, decryptSecretIfNeeded } from '../services/storage.service';

type ResourceKind = 'asset' | 'material' | 'plugin' | 'showcase';
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
const RESOURCE_KINDS: ResourceKind[] = ['asset', 'material', 'plugin', 'showcase'];
const RESOURCE_STATUSES: ResourceStatus[] = ['APPROVED', 'PENDING', 'REJECTED'];
const STALE_REVIEW_HOURS = 48;

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

const isAdminResourceScope = (req: AuthRequest) =>
  req.user?.role === 'ADMIN' && req.workspaceId === 'admin-workspace';

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

const getDateTime = (date?: string) => {
  const timestamp = date ? new Date(date).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getResourceOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const teamFilter = getTeamFilter(req.workspaceId);
    const isAdminScope = isAdminResourceScope(req);

    // Cache lookup: unique to user, workspace, and admin status
    const cacheKey = `resource:overview:${userId}:${req.workspaceId || 'none'}:${isAdminScope}`;
    const cached = await redisService.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const assetOwnershipWhere = isAdminScope ? {} : { userId, ...teamFilter };
    const materialOwnershipWhere = isAdminScope ? {} : { userId, ...teamFilter };
    const pluginOwnershipWhere = isAdminScope ? {} : { userId };
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
    const showcaseVisibleWhere = isAdminScope
      ? {}
      : { OR: [{ status: APPROVED_STATUS }, { userId, ...teamFilter }] };
    const reviewQueueStatuses = isAdminScope ? ['PENDING'] : REVIEW_STATUSES;
    const assetReviewWhere = { ...assetOwnershipWhere, status: { in: reviewQueueStatuses } };
    const materialReviewWhere = { ...materialOwnershipWhere, status: { in: reviewQueueStatuses } };
    const pluginReviewWhere = { ...pluginOwnershipWhere, status: { in: reviewQueueStatuses } };
    const showcaseReviewWhere = { ...showcaseOwnershipWhere, status: { in: reviewQueueStatuses } };

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
      recentAssets,
      recentMaterials,
      recentPlugins,
      recentShowcases,
      topAssets,
      topMaterials,
      topPlugins,
      topShowcases,
      reviewAssets,
      reviewMaterials,
      reviewPlugins,
      reviewShowcases,
      assetTagRows,
      materialTagRows,
      pluginTagRows,
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
      prisma.material.count({ where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } } }),
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
      prisma.showcase.count({ where: { status: APPROVED_STATUS } }),
      prisma.showcase.count({ where: showcaseOwnershipWhere }),
      prisma.showcase.count({ where: { ...showcaseOwnershipWhere, status: 'PENDING' } }),
      prisma.showcase.count({ where: { ...showcaseOwnershipWhere, status: 'REJECTED' } }),
      prisma.showcase.count({ where: { status: APPROVED_STATUS, createdAt: { gte: sinceWeek } } }),
      prisma.showcase.aggregate({
        where: { status: APPROVED_STATUS },
        _sum: { views: true },
      }),
      prisma.showcaseLike.count({ where: { showcase: { status: APPROVED_STATUS } } }),
      prisma.showcaseComment.count({ where: { showcase: { status: APPROVED_STATUS } } }),
      prisma.asset.aggregate({ where: assetOwnershipWhere, _sum: { size: true } }),
      prisma.material.aggregate({ where: materialOwnershipWhere, _sum: { fileSize: true } }),
      prisma.plugin.aggregate({ where: pluginOwnershipWhere, _sum: { fileSize: true } }),
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
      prisma.showcase.findMany({
        where: { status: APPROVED_STATUS, tags: { not: null } },
        select: { tags: true },
        take: 400,
      }),
    ]);

    const normalizeAssets = (items: typeof recentAssets, metricLabel: string): ResourceFeedItem[] =>
      items.map((asset) => normalizeAssetItem(asset, metricLabel));

    const normalizeMaterials = (
      items: typeof recentMaterials,
      metricLabel: string,
    ): ResourceFeedItem[] => items.map((material) => normalizeMaterialItem(material, metricLabel));

    const normalizePlugins = (
      items: typeof recentPlugins,
      metricLabel: string,
    ): ResourceFeedItem[] => items.map((plugin) => normalizePluginItem(plugin, metricLabel));

    const normalizeShowcases = (
      items: typeof recentShowcases,
      metricLabel: string,
    ): ResourceFeedItem[] => items.map((showcase) => normalizeShowcaseItem(showcase, metricLabel));

    const recentItems = [
      ...normalizeAssets(recentAssets, '触达'),
      ...normalizeMaterials(recentMaterials, '收藏'),
      ...normalizePlugins(recentPlugins, '下载'),
      ...normalizeShowcases(recentShowcases, '互动'),
    ]
      .sort(
        (a, b) => getDateTime(b.updatedAt || b.createdAt) - getDateTime(a.updatedAt || a.createdAt),
      )
      .slice(0, 14);

    const topItems = [
      ...normalizeAssets(topAssets, '下载'),
      ...normalizeMaterials(topMaterials, '下载'),
      ...normalizePlugins(topPlugins, '下载'),
      ...normalizeShowcases(topShowcases, '浏览'),
    ]
      .sort((a, b) => b.metric - a.metric)
      .slice(0, 12);

    const reviewQueue = [
      ...normalizeAssets(reviewAssets, '触达'),
      ...normalizeMaterials(reviewMaterials, '收藏'),
      ...normalizePlugins(reviewPlugins, '下载'),
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

    const pendingReview = sumNumbers(assetPending, materialPending, pluginPending, showcasePending);
    const rejectedReview = sumNumbers(
      assetRejected,
      materialRejected,
      pluginRejected,
      showcaseRejected,
    );
    const myItems = sumNumbers(assetMine, materialMine, pluginMine, showcaseMine);
    const readyMine = Math.max(0, myItems - pendingReview - rejectedReview);
    const readyRate = myItems > 0 ? Math.round((readyMine / myItems) * 100) : 100;
    const staleReviewAt = new Date(Date.now() - STALE_REVIEW_HOURS * 60 * 60 * 1000);
    const [staleAssets, staleMaterials, stalePlugins, staleShowcases] = await Promise.all([
      prisma.asset.count({
        where: { ...assetOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
      }),
      prisma.material.count({
        where: { ...materialOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
      }),
      prisma.plugin.count({
        where: { ...pluginOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
      }),
      prisma.showcase.count({
        where: { ...showcaseOwnershipWhere, status: 'PENDING', createdAt: { lt: staleReviewAt } },
      }),
    ]);
    const staleReview = sumNumbers(staleAssets, staleMaterials, stalePlugins, staleShowcases);
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
        totalPublic: sumNumbers(assetTotal, materialTotal, pluginTotal, showcaseTotal),
        myItems,
        pendingReview,
        rejectedReview,
        reviewPressure: pendingReview + rejectedReview,
        readyRate,
        libraryCount: libraries.length,
        weekAdded: sumNumbers(assetWeek, materialWeek, pluginWeek, showcaseWeek),
        interactions: sumNumbers(
          assetAggregate._sum.downloads,
          assetAggregate._sum.viewCount,
          assetAggregate._sum.likes,
          materialAggregate._sum.downloads,
          materialFavorites,
          pluginAggregate._sum.downloads,
          showcaseAggregate._sum.views,
          showcaseLikes,
          showcaseComments,
        ),
        storageMb: sumNumbers(
          assetStorage._sum.size,
          materialStorage._sum.fileSize,
          pluginStorage._sum.fileSize,
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
        showcaseTagRows.flatMap((row) => parseTags(row.tags)),
      ),
      recentItems,
      topItems,
      reviewQueue,
      generatedAt: new Date().toISOString(),
    };

    // Cache the overview payload for 15 seconds
    await redisService.set(cacheKey, result, 15);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getResourceFeed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const teamFilter = getTeamFilter(req.workspaceId);
    const isAdminScope = isAdminResourceScope(req);
    const kind = normalizeKindFilter(req.query.kind);
    const status = normalizeStatusFilter(req.query.status);
    const sortMode = normalizeSortMode(req.query.sort);
    const query = getQueryText(req.query.q || req.query.search);
    const page = parsePage(req.query.page, 1, 50);
    const limit = parseLimit(req.query.limit, 40, 80);
    const skip = (page - 1) * limit;
    const selectedKinds = kind === 'all' ? RESOURCE_KINDS : [kind];
    const selectedStatus = status === 'all' ? undefined : status;

    const buildInput = (statusOverride?: ResourceStatus): BuildWhereInput => ({
      userId,
      teamFilter,
      isAdminScope,
      status: statusOverride,
      query,
    });

    const countKind = (resourceKind: ResourceKind, statusOverride?: ResourceStatus) => {
      const input = buildInput(statusOverride);
      if (resourceKind === 'asset') return prisma.asset.count({ where: buildAssetWhere(input) });
      if (resourceKind === 'material') {
        return prisma.material.count({ where: buildMaterialWhere(input) });
      }
      if (resourceKind === 'plugin') return prisma.plugin.count({ where: buildPluginWhere(input) });
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

    res.json({
      items: sortedItems,
      meta: {
        page,
        limit,
        total: totalForSelectedKind,
        hasMore: skip + sortedItems.length < totalForSelectedKind,
        kind,
        status,
        sort: sortMode,
        query,
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
  } catch (error) {
    next(error);
  }
};

export const getMyResourceWorkbench = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const limit = parseLimit(req.query.limit);

    const [assets, materials, plugins, showcases] = await Promise.all([
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
    );
    const totalReach = sumNumbers(
      assets.reduce((sum, item) => sum + Number(item.downloads || item.viewCount || 0), 0),
      materials.reduce((sum, item) => sum + Number(item.downloads || 0), 0),
      plugins.reduce((sum, item) => sum + Number(item.downloads || 0), 0),
      showcases.reduce((sum, item) => sum + Number(item.views || 0), 0),
    );

    res.json({
      assets,
      materials,
      plugins,
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
  } catch (error) {
    next(error);
  }
};

export const searchExternal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q;
    if (typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Missing search query q' });
    }
    const { searchAndAnalyze } = await import('../services/external-search.service');
    const result = await searchAndAnalyze(q);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

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
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
        const width = 1 + ((buffer[24] ?? 0) | ((buffer[25] ?? 0) << 8) | ((buffer[26] ?? 0) << 16));
        const height = 1 + ((buffer[27] ?? 0) | ((buffer[28] ?? 0) << 8) | ((buffer[29] ?? 0) << 16));
        return { width, height };
      }
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
        const b0 = buffer[21] ?? 0;
        const b1 = buffer[22] ?? 0;
        const b2 = buffer[23] ?? 0;
        const b3 = buffer[24] ?? 0;
        const width = 1 + (b0 | ((b1 & 0x3f) << 8));
        const height = 1 + (((b1 >> 6) | (b2 << 2) | ((b3 & 0xf) << 10)));
        return { width, height };
      }
    }
  } catch {}
  return null;
}

function isProbablyQrOrJunkDimensions(dim: { width: number; height: number } | null): boolean {
  if (!dim || !dim.width || !dim.height) return false;

  // 尺寸极小：小于 200px 的图标/小图
  if (dim.width < 200 || dim.height < 200) return true;

  const aspectRatio = dim.width / dim.height;

  // 接近 1:1 正方形 且 小于 640px——覆盖博文内常见二维码尺寸
  // jb51等站微信 QR 码通常 300~600px 正方形；产品预览图通常是横向大图 (16:9 / 4:3)
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
    const crawledDir = path.join(process.cwd(), 'uploads', 'crawled');
    if (!fs.existsSync(crawledDir)) {
      fs.mkdirSync(crawledDir, { recursive: true });
    }

    let refererHeader = '';
    if (parentUrl) {
      try {
        refererHeader = new URL(parentUrl).origin + '/';
      } catch {}
    }

    const requestHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (refererHeader) {
      requestHeaders['Referer'] = refererHeader;
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    let response: any;
    try {
      response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
        headers: requestHeaders,
        httpsAgent,
      });
    } catch (firstErr: any) {
      // 第一次失败后，尝试不带 Referer 重新下载一次（很多 CDN 允许无 Referer 访问）
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

    // 物理级别尺寸检测：如果是接近 1:1 的正方形小图或极小图片（典型二维码/打赏码/小图标特征），直接丢弃！
    const dim = getImageDimensions(buffer);
    if (isProbablyQrOrJunkDimensions(dim)) {
      logger.info(`[Download Crawled Image] Skipped QR/junk image by dimensions (${dim?.width}x${dim?.height}): ${imageUrl}`);
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
      } catch {}
    }

    const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
    const filename = `${hash}${ext}`;
    const filePath = path.join(crawledDir, filename);

    fs.writeFileSync(filePath, buffer);

    // 检查是否有启用的云存储配置 (优先匹配 ASSET，其次匹配 ALL)
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

    if (activeConfigs.length > 0) {
      const config = activeConfigs[0];
      if (config) {
        try {
          const stats = fs.statSync(filePath);
          const fileBytes = stats.size;
          const limitBytes = config.limitGb * 1024 * 1024 * 1024;

          // 执行占用容量配额
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

          if (updateResult.count > 0) {
            const cloudKey = `crawled/${filename}`;
            const r2Url = await storageService.uploadFile(
              {
                endpoint: config.endpoint,
                accessKeyId: config.accessKeyId,
                secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                bucketName: config.bucketName,
                publicUrl: config.publicUrl,
              },
              filePath,
              cloudKey,
              rawMimetype,
            );

            // 上传成功，删除本地临时文件，返回云存储 R2 的 URL
            fs.unlinkSync(filePath);
            return r2Url;
          } else {
            logger.warn(`[Download Crawled Image] Storage limit exceeded for R2 config ${config.name}, falling back to local storage.`);
          }
        } catch (uploadError: any) {
          logger.error(
            `[Download Crawled Image] Failed to upload crawled image to R2: ${uploadError.message}. Falling back to local storage.`,
          );
        }
      }
    }

    // 云存储未配置，或者上传报错、容量限制，降级使用本地存储路径
    return `/uploads/crawled/${filename}`;
  } catch (err: any) {
    logger.error(`[Download Crawled Image] Failed to download ${imageUrl}: ${err.message}`);
    return null;
  }
}

// 已知会在文章顶部/内容区放置微信/公众号大型二维码的站点图片 CDN 域名黑名单
// 注意：不包含 jb51.net——依靠物理尺寸检测拦截其 QR 码
const QR_IMAGE_DOMAIN_BLOCKLIST: string[] = [];

function isJunkOrQrImage(src: string, el?: any): boolean {
  if (!src || !src.startsWith('http')) return true;
  const lower = src.toLowerCase();

  // 不接受 GIF 和 SVG
  if (lower.endsWith('.gif') || lower.endsWith('.svg')) return true;

  // 域名级黑名单：对已知会把大型二维码作为头图的站点，完全跳过其图片
  try {
    const srcHost = new URL(src).hostname;
    if (QR_IMAGE_DOMAIN_BLOCKLIST.some((d) => srcHost === d || srcHost.endsWith('.' + d))) {
      return true;
    }
  } catch {}

  const junkKeywords = [
    'avatar', 'logo', 'icon', 'loading', 'favorite', 'fav',
    'qr', 'qrcode', 'weixin', 'wechat', 'gongzhonghao', 'reward', 'dashang',
    'saoma', 'alipay', 'kefu', 'wxcode', 'qqgroup',
    'jbscript', 'jb-script', 'gzh',
    'erweima', 'erwm', 'qr_code', 'qr-code', 'wx_qr', 'weixin_qr',
    // jb51.net 特有的侧边栏缩略图 CDN 路径（不是文章正文图片）
    'litimg', '/skin/',
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

    if (/二维码|微信|公众号|扫码|打赏|qq群|关注|群二维码|qrcode|weixin|gongzhonghao|gzh|saoma|erweima/i.test(attrText)) {
      return true;
    }
  }

  return false;
}

// 备用抓取时，这些站点的图片直接跳过（只取文字）
// 以下只保留确实不提供任何商品图片的窾争站点
const IMAGE_SKIP_DOMAINS: string[] = [];

async function performFallbackSearchAndScrape(
  title: string,
  originalUrl: string,
  type: string
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
    } catch {}

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

    // 收集所有候选站结果，优先返回既有文字又有图片的
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

          // 判断当前备用站点是否属于图片跳过域名
          let skipImages = false;
          try {
            const linkHost = new URL(link).hostname;
            skipImages = IMAGE_SKIP_DOMAINS.some((d) => linkHost === d || linkHost.endsWith('.' + d));
          } catch {}

          if (!skipImages) {
            const imageSelectors = [
              '.entry-content img', '.post-content img', '.article-content img',
              '.entry img', '.entry-inner img', '.post-inner img', 'article img', 'main img'
            ];
            let imgElements = $(imageSelectors.join(', '));
            if (imgElements.length === 0) imgElements = $('img');

            imgElements.each((_, el) => {
              const parent = $(el).parents('footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header, .author-avatar, .widget-postlist');
              if (parent.length > 0) return;

              let src = $(el).attr('data-src') || $(el).attr('data-original-src') || $(el).attr('data-lazy-src') || $(el).attr('src');
              if (!src || src.startsWith('data:')) {
                const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
                if (srcset) {
                  const match = srcset.match(/(https?:\/\/[^\s,]+)/);
                  if (match) src = match[1];
                }
              }
              if (src && imageUrls.length < 5) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (src.startsWith('/')) {
                  try {
                    const urlObj = new URL(link);
                    src = urlObj.origin + src;
                  } catch {}
                }
                if (!isJunkOrQrImage(src, $(el))) {
                  imageUrls.push(src);
                }
              }
            });
          }

          const articleSelectors = [
            '.entry-content p', '.post-content p', '.article-content p',
            '.entry p', '.entry-inner p', '.post-inner p', 'article p', 'main p'
          ];
          let pElements = $(articleSelectors.join(', '));
          if (pElements.length === 0) pElements = $('p');

          pElements.each((_, el) => {
            const parent = $(el).parents('footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header');
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
            logger.info(`[Import External Fallback] Candidate scraped: ${link} (images: ${imageUrls.length}, texts: ${textParagraphs.length})`);
            candidateResults.push({ imageUrls, textParagraphs, fallbackUrl: link });
          }
        } catch (err: any) {
          logger.debug(`[Import External Fallback] Failed to scrape ${link}: ${err.message}`);
        }
      })
    );

    if (candidateResults.length === 0) return null;

    // 优先选择有图片的结果（图片数最多的）；否则退而求其次用纯文字结果
    const withImages = candidateResults.filter((r) => r.imageUrls.length > 0);
    const best = withImages.length > 0
      ? withImages.sort((a, b) => b.imageUrls.length - a.imageUrls.length)[0]!
      : candidateResults[0]!;

    logger.info(`[Import External Fallback] Best fallback: ${best.fallbackUrl} (images: ${best.imageUrls.length})`);
    return best;
  } catch (err: any) {
    logger.error(`[Import External Fallback] Failed search and scrape: ${err.message}`);
  }
  return null;
}

/**
 * Uses LLM to extract metadata such as version, compatibility, tags, and category
 * from scraped webpage text.
 */
async function parseResourceWithAI(
  title: string,
  snippet: string | undefined,
  textParagraphs: string[],
  type: string
) {
  try {
    const textSnippet = [
      `标题: ${title}`,
      snippet ? `引言: ${snippet}` : '',
      `正文段落:`,
      ...textParagraphs.slice(0, 10)
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are a helper that extracts metadata and translates content from webpage text snippets for a 3D learning platform database.
You must respond with a strictly formatted JSON object containing the metadata.
Do not include any markdown styling like \`\`\`json or explanations. Return ONLY the raw JSON string.
Important: If the title, description, or tags are in English, please translate/localize them to natural, clean Chinese. The tags should be translated to Chinese comma-separated keywords (e.g. '建模,材质,动画' instead of 'modeling,texture,animation').

For type: "plugin", return:
{
  "version": "string (e.g. '1.2.0', default '1.0.0')",
  "compatibility": "string (e.g. 'Blender 3.x / 4.x', default '')",
  "tags": "string (comma-separated Chinese tag names, e.g. '建模,优化,材质', default '')",
  "category": "string (must be one of: 'Blender 插件', 'Three.js 插件', 'Substance 工具', '游戏引擎插件', 'Photoshop 脚本', '其他工具')",
  "translatedDescription": "string (A clean, localized Chinese translation/summary of the description. Max 300 words)"
}

For type: "asset" (3D Model), return:
{
  "tags": "string (comma-separated Chinese tag names, e.g. '科幻,机器人,角色', default '')",
  "meshType": "string (must be one of: 'LOW_POLY', 'HIGH_POLY', 'CAD', 'UNKNOWN', default 'UNKNOWN')",
  "translatedDescription": "string (A clean, localized Chinese translation/summary of the description. Max 300 words)"
}

For type: "material", return:
{
  "tags": "string (comma-separated Chinese tag names, e.g. '木质,程序化,写实', default '')",
  "resolution": "string (e.g. '4K', '8K', '1024x1024', default null)",
  "isProcedural": "boolean (default false)",
  "translatedDescription": "string (A clean, localized Chinese translation/summary of the description. Max 300 words)"
}
`;

    const userPrompt = `Extract metadata for type "${type}" from the following webpage snippet:\n\n${textSnippet}`;

    const responseText = await callLLMWithFailover(userPrompt, systemPrompt);
    logger.info(`[AI Scraper Parser] LLM raw response: ${responseText}`);

    // Parse JSON safely
    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    return parsed;
  } catch (error: any) {
    logger.warn(`[AI Scraper Parser] Failed to parse resource with AI: ${error.message}`);
    return null;
  }
}

export const importExternalResource = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { url: rawUrl, title, type, snippet } = req.body;
    const userId = req.userId as string;

    if (!rawUrl || !title || !type) {
      return res.status(400).json({ error: 'Missing required fields: url, title, type' });
    }

    const { normalizeResourceUrl } = await import('../services/external-search.service');
    const url = normalizeResourceUrl(rawUrl);

    let scrapedTextParagraphs: string[] = [];
    let scrapedImageUrls: string[] = [];
    let isFallbackScraped = false;
    let fallbackSourceUrl = '';

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://www.google.com/',
        },
        timeout: 3000,
        proxy: false,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
      });
      const $ = cheerio.load(response.data);

      // Extract main page images (up to 5 images)
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

      imgElements.each((i, el) => {
        const parent = $(el).parents('footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header, .author-avatar, .widget-postlist');
        if (parent.length > 0) return;

        let src = $(el).attr('data-src') || $(el).attr('data-original-src') || $(el).attr('data-lazy-src') || $(el).attr('src');
        if (!src || src.startsWith('data:')) {
          const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
          if (srcset) {
            const match = srcset.match(/(https?:\/\/[^\s,]+)/);
            if (match) src = match[1];
          }
        }
        if (src && imageUrls.length < 5) {
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            try {
              const urlObj = new URL(url);
              src = urlObj.origin + src;
            } catch {}
          }
          if (!isJunkOrQrImage(src, $(el))) {
            imageUrls.push(src);
          }
        }
      });

      // Extract text content paragraphs (up to 15 paragraphs)
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
        const parent = $(el).parents('footer, header, sidebar, .sidebar, #sidebar, .widget, .comments, #comments, nav, .nav, .menu, #footer, #header');
        if (parent.length > 0) return;

        const txt = $(el).text().trim();
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

      // Download and save crawled images locally to avoid hotlinking issues
      const localImageUrls: string[] = [];
      for (const imgUrl of imageUrls) {
        const localPath = await downloadAndSaveImage(imgUrl, url);
        if (localPath) {
          localImageUrls.push(localPath);
        }
      }

      scrapedTextParagraphs = textParagraphs;
      scrapedImageUrls = localImageUrls;
    } catch (fetchErr: any) {
      logger.error(`[Import External] Failed to scrape webpage ${url}: ${fetchErr.message}`);
      
      logger.info(`[Import External] Triggering fallback search & scrape for title: "${title}" (type: ${type})`);
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

    // Call AI to parse metadata and translate English to Chinese
    const aiData = await parseResourceWithAI(title, snippet, scrapedTextParagraphs, type);

    // 1. Build initial Markdown description block
    let descriptionMarkdown = `### ${title}\n\n来自源站的资源详情页面：[直接访问源站](${url})\n\n`;
    if (snippet) {
      descriptionMarkdown += `> ${snippet}\n\n`;
    }

    if (isFallbackScraped) {
      descriptionMarkdown += `*(注：由于原源站防爬虫限制，系统已自动从公开网络备用站点 [直接访问备用源站](${fallbackSourceUrl || url}) 抓取并补充了以下介绍与预览图)*\n\n`;
    }

    // 2. Add description text (AI translated/summarized or fallback scraped paragraphs)
    if (aiData?.translatedDescription) {
      descriptionMarkdown += `### 📝 资源描述与介绍 (AI 翻译/润色)\n\n${aiData.translatedDescription}\n\n`;
    } else if (scrapedTextParagraphs.length > 0) {
      descriptionMarkdown += `### 📝 资源描述与介绍\n\n`;
      scrapedTextParagraphs.forEach((p) => {
        descriptionMarkdown += `${p}\n\n`;
      });
    } else {
      descriptionMarkdown += `*(由于源站防爬虫或网络原因限制，未能成功抓取文章内部正文与图片，请点击上方源站链接手动编辑补充)*\n\n`;
    }

    // 3. Append images
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

    // Extract cover image from downloaded images (first image)
    const coverUrl = scrapedImageUrls.length > 0 ? scrapedImageUrls[0] : null;

    // 4. Create the resource as a draft (status: PENDING)
    let createdItem: any;
    if (type === 'asset') {
      let tagsJson: string | null = null;
      if (aiData?.tags) {
        const tagList = aiData.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
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
      createdItem = await prisma.plugin.create({
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
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    res.json({
      success: true,
      message: '一键导入草稿箱成功！',
      item: createdItem,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadTempFile = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }
  
  const tempPath = (req.file as any).url || `/uploads/temp/${req.file.filename}`;
  res.json({
    success: true,
    filePath: tempPath,
    originalName: req.file.originalname,
  });
};

export const cancelTempUpload = async (req: Request, res: Response) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: '无效的文件路径' });
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    const { deleteCloudOrLocalFileByUrl } = await import('../utils/file');
    deleteCloudOrLocalFileByUrl(filePath).catch((err) => {
      logger.error(`[Cancel Temp Upload] Failed to delete cloud file ${filePath}:`, err);
    });
    return res.json({ success: true, message: '临时文件已删除' });
  }

  // Security check: only allow deleting files under uploads/temp to prevent directory traversal
  const resolvedPath = path.resolve(process.cwd(), filePath.replace(/^\/+/, ''));
  const tempDir = path.resolve(process.cwd(), 'uploads', 'temp');
  
  if (!resolvedPath.startsWith(tempDir)) {
    return res.status(403).json({ error: '拒绝访问：只能删除临时文件夹中的文件' });
  }

  try {
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
    res.json({ success: true, message: '临时文件已删除' });
  } catch (err: any) {
    logger.error(`[Cancel Temp Upload] Failed to delete file ${resolvedPath}: ${err.message}`);
    res.status(500).json({ error: '删除文件失败' });
  }
};
