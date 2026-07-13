import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import prisma from '../../services/prisma';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';
import { storageService } from '../../services/storage.service';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { deleteCloudOrLocalFileByUrl, urlToPath } from '../../utils/file';
import {
  getActiveStorageConfig,
  getDecryptedActiveStorageConfig,
  generateS3Key,
  checkQuota,
  incrementConfigUsedBytes,
} from '../../utils/s3-upload-helper';
import {
  netdiskPresignedUrlSchema,
  netdiskCompleteSingleUploadSchema,
} from '../../utils/schemas-batch1';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

interface UploadedFile {
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

const WEBSITE_HOME_KEY = 'WEBSITE_HOME_CONFIG';
const WEBSITE_BANNERS_KEY = 'WEBSITE_BANNERS_CONFIG';
const WEBSITE_ANALYTICS_KEY = 'WEBSITE_ANALYTICS_EVENTS';

const defaultHome = {
  eyebrow: 'PERSONAL LEARNING PLATFORM',
  title: '把每一次学习，\n变成看得见的成长。',
  subtitle: '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  featuredMirrorId: null as string | null,
  showCoursePreview: true,
  showCapabilityMap: true,
  showMirrorPreview: true,
  showDiscovery: true,
  showLatest: true,
  showTrending: true,
  bannerImage: null as string | null,
  featuredResourceIds: {
    courses: [] as string[],
    assets: [] as string[],
    materials: [] as string[],
    plugins: [] as string[],
    softwares: [] as string[],
  },
  recommendedCategories: [] as string[],
  moduleOrder: ['hero', 'metrics', 'latest', 'trending', 'courses', 'capabilities', 'mirrors'],
};

const homeSchema = z.object({
  eyebrow: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().min(1).max(300),
  featuredMirrorId: z.string().trim().nullable().optional(),
  showCoursePreview: z.boolean().optional(),
  showCapabilityMap: z.boolean().optional(),
  showMirrorPreview: z.boolean().optional(),
  showDiscovery: z.boolean().optional(),
  showLatest: z.boolean().optional(),
  showTrending: z.boolean().optional(),
  bannerImage: z.string().trim().nullable().optional(),
  featuredResourceIds: z
    .object({
      courses: z.array(z.string().min(1)).max(12).default([]),
      assets: z.array(z.string().min(1)).max(12).default([]),
      materials: z.array(z.string().min(1)).max(12).default([]),
      plugins: z.array(z.string().min(1)).max(12).default([]),
      softwares: z.array(z.string().min(1)).max(12).default([]),
    })
    .optional(),
  recommendedCategories: z.array(z.string().trim().min(1)).max(30).optional(),
  moduleOrder: z.array(z.string().trim().min(1)).max(20).optional(),
});
const bannerSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().trim().min(1).max(1000),
  title: z.string().trim().max(160).default(''),
  subtitle: z.string().trim().max(300).default(''),
  buttonLabel: z.string().trim().max(40).default('探索资源'),
  href: z.string().trim().max(500).default('/resources'),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(99).default(0),
});
const bannersSchema = z.array(bannerSchema).max(12);

const sourceParamsSchema = z.object({ sourceId: z.string().min(1) });
const resourceParamsSchema = z.object({
  sourceId: z.string().min(1),
  resourceId: z.string().min(1),
});
const resourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(18),
  categoryId: z.string().min(1).optional(),
  parentCategoryId: z.string().min(1).optional(),
  categoryIds: z.string().trim().max(4000).optional(),
  q: z.string().trim().max(100).optional(),
});

const safeHtml = (html: string | null): string | null => {
  if (!html) return null;
  const $ = cheerio.load(html);
  $('script, style, iframe, object, embed, form, button, input, video, audio').remove();
  // The official site is browse-only: retain readable text and images but never a clickable/downloadable URL.
  $('a').each((_, element) => {
    $(element).replaceWith($(element).contents());
  });
  $('*').removeAttr('href download target onclick onload');
  return $('body').html() || null;
};

const officialMediaParamsSchema = z.object({
  kind: z.enum(['asset', 'material', 'plugin', 'software', 'course']),
  id: z.string().min(1),
});
const publicCatalogParamsSchema = z.object({
  kind: z.enum(['course', 'asset', 'material', 'plugin', 'software']),
  id: z.string().min(1),
});
const publicSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  type: z
    .enum(['all', 'course', 'asset', 'material', 'plugin', 'software', 'mirror'])
    .default('all'),
  category: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(18),
});

const resolveOfficialPreviewUrl = async (url: string, storageType: string): Promise<string> => {
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const storage = await getDecryptedActiveStorageConfig(storageType);
    if (!storage) return url;
    const source = new URL(url);
    const publicHost = new URL(
      /^https?:\/\//i.test(storage.raw.publicUrl)
        ? storage.raw.publicUrl
        : `https://${storage.raw.publicUrl}`,
    ).host;
    if (source.host !== publicHost) return url;

    const key = decodeURIComponent(source.pathname.replace(/^\//, ''));
    return key ? storageService.getPresignedViewUrl(storage.config, key, 900) : url;
  } catch {
    return url;
  }
};

const canProxyExternalPreview = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      host !== 'localhost' &&
      host !== '::1' &&
      host !== '127.0.0.1' &&
      !host.startsWith('10.') &&
      !host.startsWith('192.168.') &&
      !/^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
};

/**
 * Public official-site configuration and its admin editor.
 * Resource and mirror CRUD remains in their existing dedicated admin modules;
 * this route intentionally owns only copy that is unique to the public website.
 */
export const registerWebsiteRoutes = (app: FastifyInstance): void => {
  app.get(
    '/website/home',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => {
      const setting = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_HOME_KEY } });
      if (!setting) return defaultHome;

      try {
        return { ...defaultHome, ...homeSchema.partial().parse(JSON.parse(setting.value)) };
      } catch {
        return defaultHome;
      }
    },
  );

  app.get(
    '/website/overview',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => {
      const [courses, assets, materials, plugins, softwares, mirrors] = await Promise.all([
        prisma.course.count({ where: { status: 'PUBLISHED' } }),
        prisma.asset.count({ where: { status: 'APPROVED' } }),
        prisma.material.count({ where: { status: 'APPROVED' } }),
        prisma.plugin.count({ where: { status: 'APPROVED' } }),
        prisma.software.count({ where: { status: 'APPROVED' } }),
        prisma.mirrorSource.aggregate({
          where: { status: 'ACTIVE' },
          _count: { id: true },
          _sum: { totalResources: true },
        }),
      ]);

      return {
        courses,
        assets,
        materials,
        plugins,
        softwares,
        activeMirrors: mirrors._count.id,
        mirroredResources: mirrors._sum.totalResources || 0,
      };
    },
  );

  app.get('/website/banners', async () => {
    const setting = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_BANNERS_KEY } });
    if (!setting) return [];
    try {
      return bannersSchema
        .parse(JSON.parse(setting.value))
        .filter((banner) => banner.enabled)
        .sort((a, b) => a.order - b.order);
    } catch {
      return [];
    }
  });

  app.post('/website/events', async (request, reply) => {
    const body = z
      .object({
        event: z.enum(['page_view', 'search', 'resource_click', 'category_click', 'banner_click']),
        resourceType: z.string().trim().max(30).optional(),
        resourceId: z.string().trim().max(100).optional(),
        sourceId: z.string().trim().max(100).optional(),
        queryHash: z.string().trim().max(128).optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid event' });
    const setting = await prisma.systemSetting.findUnique({
      where: { key: WEBSITE_ANALYTICS_KEY },
    });
    let events: Record<string, number> = {};
    try {
      events = setting ? JSON.parse(setting.value) : {};
    } catch {
      events = {};
    }
    const day = new Date().toISOString().slice(0, 10);
    const key = [
      day,
      body.data.event,
      body.data.resourceType || '',
      body.data.resourceId || '',
      body.data.sourceId || '',
      body.data.queryHash || '',
    ].join('|');
    events[key] = Math.min((events[key] || 0) + 1, 1000000);
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const retained = Object.fromEntries(
      Object.entries(events).filter(([entryKey]) => {
        const timestamp = Date.parse(`${entryKey.slice(0, 10)}T00:00:00Z`);
        return Number.isNaN(timestamp) || timestamp >= cutoff;
      }),
    );
    await prisma.systemSetting.upsert({
      where: { key: WEBSITE_ANALYTICS_KEY },
      create: { key: WEBSITE_ANALYTICS_KEY, value: JSON.stringify(retained) },
      update: { value: JSON.stringify(retained) },
    });
    return { accepted: true };
  });

  app.get('/website/trends', async (request) => {
    const parsed = z.object({ range: z.enum(['7d', '30d']).default('7d') }).parse(request.query);
    const setting = await prisma.systemSetting.findUnique({
      where: { key: WEBSITE_ANALYTICS_KEY },
    });
    let events: Record<string, number> = {};
    try {
      events = setting ? JSON.parse(setting.value) : {};
    } catch {
      events = {};
    }
    const days = parsed.range === '30d' ? 30 : 7;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const daily: Record<string, number> = {};
    const popular: Record<string, number> = {};
    const searches: Record<string, number> = {};
    Object.entries(events).forEach(([key, count]) => {
      const [day, event, resourceType, resourceId, sourceId, queryHash] = key.split('|');
      if (!day) return;
      const timestamp = Date.parse(`${day}T00:00:00Z`);
      if (!Number.isNaN(timestamp) && timestamp < cutoff) return;
      daily[day] = (daily[day] || 0) + count;
      if (event === 'resource_click' && resourceId)
        popular[`${resourceType}:${resourceId}`] =
          (popular[`${resourceType}:${resourceId}`] || 0) + count;
      if (event === 'search' && queryHash) searches[queryHash] = (searches[queryHash] || 0) + count;
      void sourceId;
    });
    return {
      range: parsed.range,
      daily: Object.entries(daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      popular: Object.entries(popular)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, count]) => ({ key, count })),
      searches: Object.entries(searches)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([queryHash, count]) => ({ queryHash, count })),
    };
  });

  const mapPublicPreview = (kind: string, item: any) => ({
    id: item.id,
    type: kind,
    title: item.title,
    description: item.description || null,
    category: item.category?.name || item.category || item.type || null,
    tags: item.tags || null,
    thumbnail: item.thumbnail || item.previewUrl || item.thumbnailUrl || null,
    officialPreviewUrl: `/api/website/media/${kind}/${item.id}`,
    updatedAt: item.updatedAt || item.createdAt,
    createdAt: item.createdAt,
    popularity: item.downloads ?? item.viewCount ?? 0,
  });

  app.get(
    '/website/discovery',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async () => {
      const [courses, assets, materials, plugins, softwares, mirrors] = await Promise.all([
        prisma.course.findMany({
          where: { status: 'PUBLISHED' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            difficulty: true,
            category: { select: { name: true } },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        prisma.asset.findMany({
          where: { status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            type: true,
            tags: true,
            downloads: true,
            viewCount: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        prisma.material.findMany({
          where: { status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            previewUrl: true,
            category: true,
            tags: true,
            downloads: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        prisma.plugin.findMany({
          where: { status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            previewUrl: true,
            category: true,
            tags: true,
            downloads: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        prisma.software.findMany({
          where: { status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            previewUrl: true,
            category: true,
            tags: true,
            downloads: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 12,
        }),
        prisma.mirrorResource.findMany({
          where: { source: { status: 'ACTIVE' } },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            resourceType: true,
            tags: true,
            viewCount: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { name: true } },
            source: { select: { id: true, displayName: true } },
          },
          orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
          take: 12,
        }),
      ]);
      const setting = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_HOME_KEY } });
      let featuredIds = defaultHome.featuredResourceIds;
      try {
        featuredIds = {
          ...featuredIds,
          ...(setting
            ? homeSchema.partial().parse(JSON.parse(setting.value)).featuredResourceIds || {}
            : {}),
        };
      } catch {
        /* use defaults */
      }
      const latest = [
        ...courses.map((item) => mapPublicPreview('course', item)),
        ...assets.map((item) => mapPublicPreview('asset', item)),
        ...materials.map((item) => mapPublicPreview('material', item)),
        ...plugins.map((item) => mapPublicPreview('plugin', item)),
        ...softwares.map((item) => mapPublicPreview('software', item)),
      ]
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, 24);
      const mirrorItems = mirrors.map((item) => ({
        ...mapPublicPreview('mirror', item),
        sourceId: item.source.id,
        sourceName: item.source.displayName,
        officialPreviewUrl: item.thumbnailUrl || null,
      }));
      const selectFeatured = (kind: string, items: any[], ids: string[]) => {
        const selected = ids.map((id) => items.find((item) => item.id === id)).filter(Boolean);
        return (selected.length ? selected : items.slice(0, 4)).map((item) =>
          mapPublicPreview(kind, item),
        );
      };
      return {
        latest,
        trending: [...latest].sort((a, b) => b.popularity - a.popularity).slice(0, 12),
        courses: courses.slice(0, 8).map((item) => mapPublicPreview('course', item)),
        assets: assets.slice(0, 8).map((item) => mapPublicPreview('asset', item)),
        materials: materials.slice(0, 8).map((item) => mapPublicPreview('material', item)),
        plugins: plugins.slice(0, 8).map((item) => mapPublicPreview('plugin', item)),
        softwares: softwares.slice(0, 8).map((item) => mapPublicPreview('software', item)),
        mirrors: mirrorItems,
        featured: {
          courses: selectFeatured('course', courses, featuredIds.courses),
          assets: selectFeatured('asset', assets, featuredIds.assets),
          materials: selectFeatured('material', materials, featuredIds.materials),
          plugins: selectFeatured('plugin', plugins, featuredIds.plugins),
          softwares: selectFeatured('software', softwares, featuredIds.softwares),
        },
      };
    },
  );

  app.get(
    '/website/search',
    {
      schema: { querystring: publicSearchQuerySchema },
      config: { rateLimit: { max: 90, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { q, type, category, tag, page, pageSize } = request.query as z.infer<
        typeof publicSearchQuerySchema
      >;
      const text = q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { tags: { contains: q } },
            ],
          }
        : {};
      const results: any[] = [];
      const take = Math.min(pageSize * page, 60);
      if (type === 'all' || type === 'course') {
        const courseText = q
          ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] }
          : {};
        const rows = await prisma.course.findMany({
          where: {
            status: 'PUBLISHED',
            ...courseText,
            ...(category ? { category: { name: category } } : {}),
          },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            category: { select: { name: true } },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take,
        });
        results.push(...rows.map((item) => mapPublicPreview('course', item)));
      }
      const resourceKinds = type === 'all' ? ['asset', 'material', 'plugin', 'software'] : [type];
      for (const kind of resourceKinds) {
        if (!['asset', 'material', 'plugin', 'software'].includes(kind)) continue;
        const model = prisma[kind as 'asset' | 'material' | 'plugin' | 'software'] as any;
        const categoryWhere = category
          ? kind === 'asset'
            ? { category: { name: category } }
            : { category }
          : {};
        const rows = await model.findMany({
          where: {
            status: 'APPROVED',
            ...text,
            ...categoryWhere,
            ...(tag ? { tags: { contains: tag } } : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take,
        });
        results.push(...rows.map((item: any) => mapPublicPreview(kind, item)));
      }
      if (type === 'all' || type === 'mirror') {
        const rows = await prisma.mirrorResource.findMany({
          where: {
            source: { status: 'ACTIVE' },
            ...text,
            ...(category ? { category: { name: category } } : {}),
            ...(tag ? { tags: { contains: tag } } : {}),
          },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            resourceType: true,
            tags: true,
            viewCount: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { name: true } },
            source: { select: { id: true, displayName: true } },
          },
          orderBy: { viewCount: 'desc' },
          take,
        });
        results.push(
          ...rows.map((item: any) => ({
            ...mapPublicPreview('mirror', item),
            sourceId: item.source.id,
            sourceName: item.source.displayName,
            officialPreviewUrl: item.thumbnailUrl,
          })),
        );
      }
      results.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
      );
      const total = results.length;
      return {
        items: results.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },
  );

  app.get(
    '/website/catalog/:kind/:id',
    { schema: { params: publicCatalogParamsSchema } },
    async (request, reply) => {
      const { kind, id } = request.params as z.infer<typeof publicCatalogParamsSchema>;
      let item: any = null;
      if (kind === 'course')
        item = await prisma.course.findFirst({
          where: { id, status: 'PUBLISHED' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            difficulty: true,
            category: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
          },
        });
      if (kind === 'asset')
        item = await prisma.asset.findFirst({
          where: { id, status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            type: true,
            tags: true,
            viewCount: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { id: true, name: true } },
          },
        });
      if (kind === 'material' || kind === 'plugin' || kind === 'software')
        item = await (prisma[kind] as any).findFirst({
          where: { id, status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            description: true,
            previewUrl: true,
            category: true,
            tags: true,
            downloads: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      if (!item) return reply.status(404).send({ error: 'Resource not found' });
      let related: any[] = [];
      if (kind === 'course' && item.category?.id)
        related = await prisma.course.findMany({
          where: { status: 'PUBLISHED', categoryId: item.category.id, id: { not: id } },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            category: { select: { name: true } },
            createdAt: true,
            updatedAt: true,
          },
          take: 4,
        });
      if (kind === 'asset' && item.category?.id)
        related = await prisma.asset.findMany({
          where: { status: 'APPROVED', categoryId: item.category.id, id: { not: id } },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            type: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 4,
        });
      if (['material', 'plugin', 'software'].includes(kind) && item.category)
        related = await (prisma[kind] as any).findMany({
          where: { status: 'APPROVED', category: item.category, id: { not: id } },
          select: {
            id: true,
            title: true,
            description: true,
            previewUrl: true,
            category: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 4,
        });
      return {
        ...mapPublicPreview(kind, item),
        detail: true,
        related: related.map((entry) => mapPublicPreview(kind, entry)),
      };
    },
  );

  app.get(
    '/website/media/:kind/:id',
    {
      schema: { params: officialMediaParamsSchema },
      config: { rateLimit: { max: 180, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { kind, id } = request.params as z.infer<typeof officialMediaParamsSchema>;
      const record = await (async () => {
        if (kind === 'asset') {
          return prisma.asset.findFirst({
            where: { id, status: 'APPROVED' },
            select: { thumbnail: true },
          });
        }
        if (kind === 'material') {
          return prisma.material.findFirst({
            where: { id, status: 'APPROVED' },
            select: { previewUrl: true },
          });
        }
        if (kind === 'plugin') {
          return prisma.plugin.findFirst({
            where: { id, status: 'APPROVED' },
            select: { previewUrl: true },
          });
        }
        if (kind === 'software') {
          return prisma.software.findFirst({
            where: { id, status: 'APPROVED' },
            select: { previewUrl: true },
          });
        }
        return prisma.course.findFirst({
          where: { id, status: 'PUBLISHED' },
          select: { thumbnail: true },
        });
      })();

      const rawUrl = record && ('previewUrl' in record ? record.previewUrl : record.thumbnail);
      if (!rawUrl) return reply.status(404).send({ error: 'Preview not available' });

      const storageType = kind === 'course' ? 'ALL' : kind.toUpperCase();
      const previewUrl = await resolveOfficialPreviewUrl(rawUrl, storageType);
      // Only course thumbnails need an external-media proxy (for example Bilibili hotlink
      // protection). Assets, materials, plugins and software keep their existing direct or
      // presigned delivery paths, which avoids unnecessary proxy traffic.
      if (kind !== 'course' || previewUrl !== rawUrl || !canProxyExternalPreview(rawUrl)) {
        reply.header('Cache-Control', 'private, no-store');
        return reply.redirect(previewUrl);
      }

      try {
        const upstream = await axios.get(rawUrl, {
          responseType: 'stream',
          timeout: 12_000,
          maxRedirects: 0,
          headers: {
            // Course thumbnails commonly originate from video platforms that reject bare image requests.
            'User-Agent': 'Mozilla/5.0 (compatible; PersonalLearningPlatform/1.0)',
            Referer: 'https://www.bilibili.com/',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });
        reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        reply.header('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
        if (upstream.headers['content-length']) {
          reply.header('Content-Length', upstream.headers['content-length']);
        }
        return reply.send(upstream.data);
      } catch {
        return reply.status(502).send({ error: 'Preview temporarily unavailable' });
      }
    },
  );

  // These endpoints deliberately expose a presentation-only projection of mirror data.
  // In particular, contentUrl, externalData and download/extract operations are never sent to the official site.
  app.get(
    '/website/mirrors/:sourceId',
    { schema: { params: sourceParamsSchema } },
    async (request, reply) => {
      const { sourceId } = request.params as z.infer<typeof sourceParamsSchema>;
      const source = await prisma.mirrorSource.findFirst({
        where: { id: sourceId, status: 'ACTIVE' },
        select: {
          id: true,
          externalId: true,
          name: true,
          displayName: true,
          description: true,
          iconUrl: true,
          totalResources: true,
          lastSyncAt: true,
        },
      });
      if (!source) return reply.status(404).send({ error: '镜像站不存在或未公开' });
      return source;
    },
  );

  app.get(
    '/website/mirrors/:sourceId/categories',
    { schema: { params: sourceParamsSchema } },
    async (request, reply) => {
      const { sourceId } = request.params as z.infer<typeof sourceParamsSchema>;
      const source = await prisma.mirrorSource.findFirst({
        where: { id: sourceId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!source) return reply.status(404).send({ error: '镜像站不存在或未公开' });
      const categories = await prisma.mirrorCategory.findMany({
        where: { sourceId },
        select: {
          id: true,
          externalId: true,
          name: true,
          parentExternalId: true,
          order: true,
          _count: {
            select: { resources: true },
          },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return categories.map((cat) => ({
        id: cat.id,
        externalId: cat.externalId,
        name: cat.name,
        parentExternalId: cat.parentExternalId,
        order: cat.order,
        resourceCount: cat._count.resources,
      }));
    },
  );

  app.get(
    '/website/mirrors/:sourceId/resources',
    { schema: { params: sourceParamsSchema, querystring: resourcesQuerySchema } },
    async (request, reply) => {
      const { sourceId } = request.params as z.infer<typeof sourceParamsSchema>;
      const { page, pageSize, categoryId, parentCategoryId, categoryIds, q } =
        request.query as z.infer<typeof resourcesQuerySchema>;
      const source = await prisma.mirrorSource.findFirst({
        where: { id: sourceId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!source) return reply.status(404).send({ error: '镜像站不存在或未公开' });

      let categoryWhere: Prisma.MirrorResourceWhereInput = categoryId ? { categoryId } : {};
      if (!categoryId && parentCategoryId) {
        const parent = await prisma.mirrorCategory.findFirst({
          where: { id: parentCategoryId, sourceId },
          select: { id: true, externalId: true },
        });
        if (parent) {
          const children = await prisma.mirrorCategory.findMany({
            where: { sourceId, parentExternalId: parent.externalId },
            select: { id: true },
          });
          categoryWhere = { categoryId: { in: [parent.id, ...children.map((child) => child.id)] } };
        }
      } else if (!categoryId && categoryIds) {
        const ids = categoryIds.split(',').filter(Boolean);
        if (ids.length) categoryWhere = { categoryId: { in: ids } };
      }

      const where = {
        sourceId,
        ...categoryWhere,
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
                { tags: { contains: q } },
              ],
            }
          : {}),
      };
      const [resources, total] = await Promise.all([
        prisma.mirrorResource.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            resourceType: true,
            viewCount: true,
            publishedAt: true,
            createdAt: true,
            tags: true,
            category: { select: { id: true, name: true } },
          },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.mirrorResource.count({ where }),
      ]);
      return { resources, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
    },
  );

  app.get(
    '/website/mirrors/:sourceId/resources/:resourceId',
    { schema: { params: resourceParamsSchema } },
    async (request, reply) => {
      const { sourceId, resourceId } = request.params as z.infer<typeof resourceParamsSchema>;
      const resource = await prisma.mirrorResource.findFirst({
        where: { id: resourceId, sourceId, source: { status: 'ACTIVE' } },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          resourceType: true,
          viewCount: true,
          publishedAt: true,
          createdAt: true,
          tags: true,
          contentHtml: true,
          category: { select: { id: true, name: true } },
          source: { select: { id: true, displayName: true } },
        },
      });
      if (!resource) return reply.status(404).send({ error: '资源不存在或未公开' });
      void prisma.mirrorResource
        .update({ where: { id: resourceId }, data: { viewCount: { increment: 1 } } })
        .catch(() => undefined);
      const cleanContentHtml = resource.contentHtml
        ? resource.contentHtml.replace(
            /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g,
            '',
          )
        : '';
      return { ...resource, contentHtml: safeHtml(cleanContentHtml) };
    },
  );

  const adminOnly = { preHandler: [fastifyAuthenticate, fastifyRequireAdmin] };

  app.get('/admin/website/catalog-options', adminOnly, async () => {
    const [courses, assets, materials, plugins, softwares] = await Promise.all([
      prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, title: true, thumbnail: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.asset.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, title: true, thumbnail: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.material.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, title: true, previewUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.plugin.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, title: true, previewUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.software.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, title: true, previewUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);
    return { courses, assets, materials, plugins, softwares };
  });

  app.get('/admin/website/banners', adminOnly, async () => {
    const setting = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_BANNERS_KEY } });
    try {
      return setting ? bannersSchema.parse(JSON.parse(setting.value)) : [];
    } catch {
      return [];
    }
  });

  app.put(
    '/admin/website/banners',
    { ...adminOnly, schema: { body: bannersSchema } },
    async (request) => {
      const content = request.body as z.infer<typeof bannersSchema>;
      await prisma.systemSetting.upsert({
        where: { key: WEBSITE_BANNERS_KEY },
        create: { key: WEBSITE_BANNERS_KEY, value: JSON.stringify(content) },
        update: { value: JSON.stringify(content) },
      });
      return content;
    },
  );

  app.get('/admin/website/home', adminOnly, async () => {
    const setting = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_HOME_KEY } });
    if (!setting) return defaultHome;
    try {
      return { ...defaultHome, ...homeSchema.partial().parse(JSON.parse(setting.value)) };
    } catch {
      return defaultHome;
    }
  });

  app.put(
    '/admin/website/home',
    { ...adminOnly, schema: { body: homeSchema } },
    async (request) => {
      const content = request.body as z.infer<typeof homeSchema>;
      await prisma.systemSetting.upsert({
        where: { key: WEBSITE_HOME_KEY },
        create: { key: WEBSITE_HOME_KEY, value: JSON.stringify(content) },
        update: { value: JSON.stringify(content) },
      });
      return content;
    },
  );

  // Helper to obtain the primary ADMIN user ID for guests
  const getGuestUserId = async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (admin) return admin.id;
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    return firstUser?.id || '';
  };

  const getActiveStorage = () => getActiveStorageConfig('TEMPORARY_NETDISK');
  const getDecryptedActiveStorage = () => getDecryptedActiveStorageConfig('TEMPORARY_NETDISK');

  // GET /website/netdisk/files —— 列出共享网盘文件
  app.get('/website/netdisk/files', async (request, reply) => {
    const activeConfig = await getActiveStorage();

    if (!activeConfig) {
      return reply.send({
        hasConfig: false,
        files: [],
        limitGb: 0,
        usedBytes: 0,
      });
    }

    const userId = await getGuestUserId();
    if (!userId) {
      return reply.send({
        hasConfig: true,
        files: [],
        limitGb: activeConfig.limitGb,
        usedBytes: activeConfig.usedBytes,
      });
    }

    const files = await prisma.temporaryFile.findMany({
      where: { userId },
      include: {
        shares: {
          select: {
            id: true,
            password: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      hasConfig: true,
      files,
      limitGb: activeConfig.limitGb,
      usedBytes: activeConfig.usedBytes,
    });
  });

  // POST /website/netdisk/presigned-url —— 获取免登录预签名直传授权 URL
  app.post(
    '/website/netdisk/presigned-url',
    { schema: { body: netdiskPresignedUrlSchema } },
    async (request, reply) => {
      const { filename, mimetype, size } = request.body as {
        filename: string;
        mimetype: string;
        size?: number;
      };

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.send({ isDirect: false });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, size);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const key = generateS3Key(filename, 'temporary');

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
        logger.error('Guest netdisk presigned url error:', error);
        throw error;
      }
    },
  );

  // POST /website/netdisk/complete-single —— 完成免登录单分片直传记录
  app.post(
    '/website/netdisk/complete-single',
    { schema: { body: netdiskCompleteSingleUploadSchema } },
    async (request, reply) => {
      const { filename, key, size, mimetype } = request.body as {
        filename: string;
        key: string;
        size: number | string;
        mimetype: string;
      };
      const numericSize = typeof size === 'string' ? Number(size) : size;

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.status(400).send({ error: '未启用云存储配置' });
        }
        const { raw } = active;

        const allowed = await checkQuota(raw, numericSize);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        await incrementConfigUsedBytes(raw.id, numericSize);

        const publicUrlBase = raw.publicUrl.replace(/\/$/, '');
        const fileUrl = `${publicUrlBase}/${key}`;

        const userId = await getGuestUserId();
        if (!userId) {
          return reply.status(400).send({ error: '系统超级管理员账户不存在，禁止上传' });
        }

        const temporaryFile = await prisma.temporaryFile.create({
          data: {
            name: filename,
            url: fileUrl,
            size: numericSize,
            mimeType: mimetype,
            userId,
            storageConfigId: raw.id,
          },
        });

        return reply.status(201).send(temporaryFile);
      } catch (error) {
        logger.error('Guest complete-single upload error:', error);
        throw error;
      }
    },
  );

  // POST /website/netdisk/upload —— 免登录公共上传备用通道 (Multer 直传服务器/云端)
  app.post(
    '/website/netdisk/upload',
    {
      preHandler: [fastifyUpload([{ name: 'temporary_file', maxCount: 1 }])],
    },
    async (request, reply) => {
      const activeConfig = await getActiveStorage();
      if (!activeConfig) {
        throw new AppError('未配置或未启用云存储配置，禁止上传文件', 400);
      }

      const file = (request as FastifyRequest & { file?: UploadedFile }).file;
      if (!file) {
        throw new AppError('请选择要上传的文件', 400);
      }

      const userId = await getGuestUserId();
      if (!userId) {
        throw new AppError('系统超级管理员账户不存在，禁止上传', 400);
      }

      const fileUrl = file.url;
      if (!fileUrl) {
        throw new AppError(
          `文件上传失败：未获取到存储目标地址 (field=${file.fieldname}, subfolder=temporary)`,
        );
      }
      const storageConfigId = file.r2ConfigId || null;

      const temporaryFile = await prisma.temporaryFile.create({
        data: {
          name: file.originalname,
          url: fileUrl,
          size: file.size,
          mimeType: file.mimetype,
          userId,
          storageConfigId,
        },
      });

      return reply.status(201).send(temporaryFile);
    },
  );

  // DELETE /website/netdisk/files/:id —— 公共免登录删除文件
  app.delete('/website/netdisk/files/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const file = await prisma.temporaryFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new AppError('文件不存在', 404);
    }

    // 物理删除
    try {
      await deleteCloudOrLocalFileByUrl(file.url, file.size);

      // 扣减配额
      if (file.storageConfigId) {
        const config = await prisma.storageConfig.findUnique({
          where: { id: file.storageConfigId },
        });
        if (config) {
          const nextUsedBytes = Math.max(0, config.usedBytes - file.size);
          await prisma.storageConfig.update({
            where: { id: file.storageConfigId },
            data: { usedBytes: nextUsedBytes },
          });
        }
      }
    } catch (err: any) {
      logger.error(`Delete public netdisk file physical file failed: ${err.message}`);
    }

    await prisma.temporaryFile.delete({
      where: { id },
    });

    return reply.status(200).send({ success: true });
  });

  // GET /website/netdisk/files/:id/download —— 公共下载重定向 (强制 attachment 下载)
  app.get('/website/netdisk/files/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    const file = await prisma.temporaryFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw new AppError('文件不存在', 404);
    }

    // 云存储重定向 + 预签名强制附件下载
    if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
      try {
        const activeConfig = await prisma.storageConfig.findFirst({
          where: { id: file.storageConfigId || undefined, status: 'ACTIVE' },
        });
        if (activeConfig) {
          const urlObj = new URL(file.url);
          const key = decodeURIComponent(urlObj.pathname.slice(1));
          const signedUrl = await storageService.getPresignedDownloadUrl(
            activeConfig,
            key,
            file.name,
          );
          return reply.redirect(signedUrl);
        }
      } catch {
        // Fallback to raw URL
      }
      return reply.redirect(file.url);
    }

    // 本地流式下载
    const localPath = urlToPath(file.url);
    if (!localPath) {
      throw new AppError('物理文件不存在', 404);
    }
    try {
      await fs.promises.access(localPath, fs.constants.R_OK);
    } catch {
      throw new AppError('物理文件不存在', 404);
    }

    const safeName = encodeURIComponent(file.name);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );

    const fileStream = fs.createReadStream(localPath);
    return reply.send(fileStream);
  });

  // POST /website/netdisk/shares —— 创建共享网盘文件分享
  app.post(
    '/website/netdisk/shares',
    {
      schema: {
        body: z.object({
          fileId: z.string(),
          password: z.string().optional(),
          expiresDays: z.union([z.number(), z.string()]).optional(),
        }),
      },
    },
    async (request, reply) => {
      const userId = await getGuestUserId();
      if (!userId) {
        throw new AppError('系统管理员账户未初始化', 400);
      }

      const { fileId, password, expiresDays } = request.body as {
        fileId: string;
        password?: string;
        expiresDays?: string | number;
      };

      const file = await prisma.temporaryFile.findFirst({
        where: { id: fileId, userId },
      });

      if (!file) {
        throw new AppError('文件不存在或无权操作', 404);
      }

      let expiresAt: Date | null = null;
      const numericExpiresDays =
        typeof expiresDays === 'string' ? parseInt(expiresDays, 10) : expiresDays;
      if (numericExpiresDays && numericExpiresDays > 0) {
        expiresAt = new Date(Date.now() + numericExpiresDays * 24 * 60 * 60 * 1000);
      }

      const share = await prisma.temporaryShare.create({
        data: {
          fileId,
          userId,
          password: password || null,
          expiresAt,
        },
      });

      return reply.status(201).send(share);
    },
  );
};
