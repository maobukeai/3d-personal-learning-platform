import type { NextFunction, Response } from 'express';
import type { Prisma } from '@prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { parseTags } from '../utils/tags';

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

const normalizeAssetItem = (asset: any, metricLabel = '触达'): ResourceFeedItem => ({
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
  previewUrl: asset.thumbnail,
  createdAt: toIso(asset.createdAt),
  updatedAt: toIso(asset.updatedAt),
  path: `/assets/${asset.id}`,
  reviewPath: `/admin/audits?tab=assets&item=${asset.id}`,
  author: getAuthorName(asset.user),
  tags: parseTags(asset.tags),
  rejectReason: asset.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(asset.createdAt, asset.status),
});

const normalizeMaterialItem = (material: any, metricLabel = '收藏'): ResourceFeedItem => ({
  id: material.id,
  kind: 'material',
  title: material.title,
  subtitle: [material.category, material.resolution].filter(Boolean).join(' / ') || '材质',
  metric: metricLabel === '下载' ? sumNumbers(material.downloads) : sumNumbers(material._count?.favorites),
  metricLabel,
  status: material.status,
  previewUrl: material.previewUrl,
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

const normalizePluginItem = (plugin: any, metricLabel = '下载'): ResourceFeedItem => ({
  id: plugin.id,
  kind: 'plugin',
  title: plugin.title,
  subtitle: `${plugin.category} / v${String(plugin.version).replace(/^v/i, '')}`,
  metric: plugin.downloads,
  metricLabel,
  status: plugin.status,
  previewUrl: plugin.previewUrl,
  createdAt: toIso(plugin.createdAt),
  updatedAt: toIso(plugin.updatedAt),
  path: `/plugins?plugin=${plugin.id}`,
  reviewPath: `/admin/audits?tab=plugins&item=${plugin.id}`,
  author: getAuthorName(plugin.user),
  tags: parseTags(plugin.tags),
  rejectReason: plugin.rejectReason || null,
  reviewAgeHours: getReviewAgeHours(plugin.createdAt, plugin.status),
});

const normalizeShowcaseItem = (showcase: any, metricLabel = '互动'): ResourceFeedItem => ({
  id: showcase.id,
  kind: 'showcase',
  title: showcase.title,
  subtitle: showcase.type,
  metric:
    metricLabel === '浏览'
      ? sumNumbers(showcase.views)
      : sumNumbers(showcase._count?.likes, showcase._count?.comments),
  metricLabel,
  status: showcase.status,
  previewUrl: showcase.thumbnailUrl,
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

    res.json({
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
    });
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
    const teamFilter = getTeamFilter(req.workspaceId);
    const limit = parseLimit(req.query.limit);

    const [assets, materials, plugins, showcases] = await Promise.all([
      prisma.asset.findMany({
        where: { userId, ...teamFilter },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          category: true,
        },
      }),
      prisma.material.findMany({
        where: { userId, ...teamFilter },
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
        where: { userId, ...teamFilter },
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
