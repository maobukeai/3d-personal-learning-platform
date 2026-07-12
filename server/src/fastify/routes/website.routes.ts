import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import fs from 'fs';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
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

  /**
   * 将任意图片 URL 标准化为可被浏览器直接访问的绝对 HTTPS URL。
   *
   * 规则:
   *  - 已是 http(s):// 绝对 URL → 直接返回（如 R2 CDN 地址）
   *  - /uploads/... 相对路径 → 拼接 BACKEND_URL 变为主平台绝对 URL
   *  - null/undefined → null
   */
  const toAbsoluteImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    // relative /uploads/... path → main platform absolute URL
    const base = (config.BACKEND_URL || '').replace(/\/$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Official-site presentation-only preview of courses (no auth required)
  // Only PUBLISHED courses; never exposes lesson content or enrollment data.
  app.get(
    '/website/preview/courses',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      try {
        const courses = await prisma.course.findMany({
          where: { status: 'PUBLISHED' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            difficulty: true,
            category: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        });
        return reply.send(
          courses.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            thumbnail: toAbsoluteImageUrl(c.thumbnail),
            difficulty: c.difficulty,
            category: c.category?.name ?? null,
          })),
        );
      } catch (err) {
        logger.error('[website] preview/courses error:', err);
        throw err;
      }
    },
  );

  // Official-site presentation-only preview of platform resources (assets/materials/plugins)
  // Only APPROVED public items; never exposes download URLs or file content.
  app.get(
    '/website/preview/resources',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      try {
        const [assets, materials, plugins] = await Promise.all([
          prisma.asset.findMany({
            where: { status: 'APPROVED', teamId: null },
            select: { id: true, title: true, description: true, thumbnail: true, type: true },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }),
          prisma.material.findMany({
            where: { status: 'APPROVED' },
            select: {
              id: true,
              title: true,
              description: true,
              thumbnail: true,
              category: true,
              resolution: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }),
          prisma.plugin.findMany({
            where: { status: 'APPROVED' },
            select: {
              id: true,
              title: true,
              description: true,
              thumbnail: true,
              category: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }),
        ]);

        return reply.send({
          assets: assets.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            thumbnail: toAbsoluteImageUrl(a.thumbnail),
            category: a.type ?? null,
          })),
          materials: materials.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            thumbnail: toAbsoluteImageUrl(m.thumbnail),
            category: m.category ?? null,
            resolution: m.resolution ?? null,
          })),
          plugins: plugins.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            thumbnail: toAbsoluteImageUrl(p.thumbnail),
            category: p.category ?? null,
          })),
        });
      } catch (err) {
        logger.error('[website] preview/resources error:', err);
        throw err;
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
