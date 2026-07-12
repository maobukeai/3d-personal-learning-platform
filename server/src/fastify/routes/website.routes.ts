import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import prisma from '../../services/prisma';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';

const WEBSITE_HOME_KEY = 'WEBSITE_HOME_CONFIG';

const defaultHome = {
  eyebrow: 'PERSONAL LEARNING PLATFORM',
  title: '把每一次学习，\n变成看得见的成长。',
  subtitle: '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  featuredMirrorId: null as string | null,
  showCoursePreview: true,
  showCapabilityMap: true,
  showMirrorPreview: true,
};

const homeSchema = z.object({
  eyebrow: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().min(1).max(300),
  featuredMirrorId: z.string().trim().nullable().optional(),
  showCoursePreview: z.boolean().optional(),
  showCapabilityMap: z.boolean().optional(),
  showMirrorPreview: z.boolean().optional(),
});

const sourceParamsSchema = z.object({ sourceId: z.string().min(1) });
const resourceParamsSchema = z.object({
  sourceId: z.string().min(1),
  resourceId: z.string().min(1),
});
const resourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(18),
  categoryId: z.string().min(1).optional(),
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
      const { page, pageSize, categoryId, q } = request.query as z.infer<
        typeof resourcesQuerySchema
      >;
      const source = await prisma.mirrorSource.findFirst({
        where: { id: sourceId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!source) return reply.status(404).send({ error: '镜像站不存在或未公开' });

      const where = {
        sourceId,
        ...(categoryId ? { categoryId } : {}),
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
      return { ...resource, contentHtml: safeHtml(resource.contentHtml) };
    },
  );

  const adminOnly = { preHandler: [fastifyAuthenticate, fastifyRequireAdmin] };

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
};
