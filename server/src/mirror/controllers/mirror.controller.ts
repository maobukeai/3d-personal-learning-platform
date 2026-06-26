import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { mirrorService } from '../services/mirror.service';
import prisma from '../../services/prisma';
import { getPlanName } from '../../utils/plan-utils';
import { encryptText } from '../../utils/crypto';
import { clampLimit, clampPage } from '../../utils/pagination';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export const getSources = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId || 'guest';
    const sources = await mirrorService.getAccessibleSources(userId);

    const result = sources.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      baseUrl: s.baseUrl,
      adapterType: s.adapterType,
      status: s.status,
      syncStatus: s.syncStatus,
      lastSyncAt: s.lastSyncAt,
      lastSyncDuration: s.lastSyncDuration,
      totalResources: s.totalResources,
      iconUrl: s.iconUrl,
      description: s.description,
      hasAccess: s.hasAccess,
      minPlanPriority: s.minPlanPriority,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSource = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const source = await mirrorService.getSource(id, req.userId);

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    res.json(source);
  } catch (error) {
    next(error);
  }
};

const checkSourceAccess = async (sourceId: string, req: AuthRequest) => {
  const source = await prisma.mirrorSource.findUnique({
    where: { id: sourceId },
    select: { minPlanPriority: true },
  });

  if (!source) {
    return { hasAccess: false, error: '镜像源不存在' };
  }

  if (source.minPlanPriority > 0) {
    let userPlanPriority = 0;
    if (req.userId) {
      userPlanPriority = await mirrorService.getUserPlanPriority(req.userId);
    }
    if (userPlanPriority < source.minPlanPriority) {
      return {
        hasAccess: false,
        error: '权限不足',
        message: `当前内容需要更高会员权限才能查看`,
        requiredPlan: source.minPlanPriority,
        currentPlan: userPlanPriority,
      };
    }
  }

  return { hasAccess: true };
};

const getPublicBaseUrl = (req: AuthRequest): string => {
  const configured = config.BACKEND_URL?.replace(/\/$/, '');
  const isLocalConfigured = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    configured || '',
  );

  if (configured && !isLocalConfigured) {
    return configured;
  }

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');

  return `${protocol}://${host}`.replace(/\/$/, '');
};

const normalizeUploadUrl = (value: string | null | undefined, baseUrl: string): string | null => {
  if (!value) return null;

  if (value.startsWith('/uploads/')) {
    return `${baseUrl}${value}`;
  }

  return value.replace(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/uploads\/.*)$/i,
    `${baseUrl}$1`,
  );
};

const normalizeUploadUrlsInHtml = (html: string, baseUrl: string) =>
  html
    .replace(
      /(src|href)=["'](\/uploads\/[^"']+)["']/gi,
      (_match, attr, uploadPath) => `${attr}="${baseUrl}${uploadPath}"`,
    )
    .replace(
      /(src|href)=["']https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/uploads\/[^"']+)["']/gi,
      (_match, attr, uploadPath) => `${attr}="${baseUrl}${uploadPath}"`,
    );

export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sourceId = req.params.sourceId as string;
    const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!sourceExists) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const categories = await mirrorService.getCategories(sourceId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const getResources = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sourceId = req.params.sourceId as string;
    const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!sourceExists) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const page = clampPage(req.query.page);
    const pageSize = clampLimit(req.query.pageSize, 21, 100);
    const categoryId = (req.query.categoryId as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const sort = (req.query.sort as string) || undefined;

    const result = await mirrorService.getResources(sourceId, {
      page,
      pageSize,
      categoryId,
      search,
      sort,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getResource = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Fetch resource and check source access in parallel to avoid a sequential waterfall
    const [resource, _placeholder] = await Promise.all([
      mirrorService.getResource(id),
      Promise.resolve(null), // room for future parallel fetches
    ]);

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    // Access check runs after resource fetch (needs resource.sourceId)
    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess && access.error === '镜像源不存在') {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    // Rewrite upload URLs to the public HTTPS host. This also fixes historical
    // localhost upload URLs stored before production env vars were configured.
    const hostUrl = getPublicBaseUrl(req);
    let cleanHtml = resource.contentHtml || '';
    if (cleanHtml) {
      cleanHtml = normalizeUploadUrlsInHtml(cleanHtml, hostUrl);
    }

    // Check if it has a matched manual download link block
    const manualLinkRegex =
      /<!-- MANUAL_DOWNLOAD_LINK_START -->([\s\S]*?)<!-- MANUAL_DOWNLOAD_LINK_END -->/;
    const manualMatch = cleanHtml.match(manualLinkRegex);
    const hasManualLink = !!manualMatch;

    const linksMeta: Array<{ name: string; type: string }> = [];
    if (manualMatch && manualMatch[1]) {
      const block = manualMatch[1];
      const hrefMatch = block.match(/href="([^"]+)"/);
      if (hrefMatch && hrefMatch[1]) {
        const href = hrefMatch[1];
        const type = href.includes('quark.cn')
          ? 'quark'
          : href.includes('baidu.com')
            ? 'baidu'
            : href.includes('alipan.com') || href.includes('aliyundrive.com')
              ? 'aliyun'
              : href.includes('123pan.com')
                ? '123pan'
                : 'generic';
        const name = href.includes('quark.cn')
          ? '夸克网盘'
          : href.includes('baidu.com')
            ? '百度网盘'
            : href.includes('alipan.com') || href.includes('aliyundrive.com')
              ? '阿里云盘'
              : href.includes('123pan.com')
                ? '123云盘'
                : '资源网盘';
        linksMeta.push({ name, type });
      }
    }

    // Strip download link markup entirely from contentHtml to protect it from scrapers/crawlers
    const strippedHtml = cleanHtml.replace(
      /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g,
      '',
    );

    let finalThumbnail = resource.thumbnailUrl;
    finalThumbnail = normalizeUploadUrl(finalThumbnail, hostUrl);

    res.json({
      ...resource,
      contentHtml: access.hasAccess ? strippedHtml : null,
      thumbnailUrl: finalThumbnail,
      hasAccess: access.hasAccess,
      hasLinks: hasManualLink,
      links: access.hasAccess ? linksMeta : [],
      requiredPlan: access.requiredPlan,
      currentPlan: access.currentPlan,
    });
  } catch (error) {
    next(error);
  }
};

export const searchResources = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sourceId = req.params.sourceId as string;
    const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!sourceExists) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const q = (req.query.q as string) || '';
    const page = clampPage(req.query.page);
    const pageSize = clampLimit(req.query.pageSize, 21, 100);

    const result = await mirrorService.getResources(sourceId, {
      page,
      pageSize,
      search: q,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSourceStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sourceId = req.params.sourceId as string;
    const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!sourceExists) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const stats = await mirrorService.getSourceStats(sourceId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getPlanRequiredForSource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceId = req.params.sourceId as string;
    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId },
      select: { minPlanPriority: true, displayName: true },
    });

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    res.json({
      sourceId,
      displayName: source.displayName,
      minPlanPriority: source.minPlanPriority,
      minPlanName: getPlanName(source.minPlanPriority),
    });
  } catch (error) {
    next(error);
  }
};

export const getResourceComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resourceId = req.params.id as string;
    const resource = await prisma.mirrorResource.findUnique({
      where: { id: resourceId },
      select: { sourceId: true },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const comments = await prisma.mirrorResourceComment.findMany({
      where: { resourceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

export const createResourceComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const resourceId = req.params.id as string;
    const { content } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const resource = await prisma.mirrorResource.findUnique({
      where: { id: resourceId },
      select: { sourceId: true },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const comment = await prisma.mirrorResourceComment.create({
      data: {
        content: content.trim(),
        resourceId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteResourceComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const comment = await prisma.mirrorResourceComment.findUnique({
      where: { id: commentId },
      include: { resource: { select: { sourceId: true } } },
    });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    const access = await checkSourceAccess(comment.resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    if (comment.userId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await prisma.mirrorResourceComment.delete({
      where: { id: commentId },
    });

    res.json({ message: '评论删除成功' });
  } catch (error) {
    next(error);
  }
};

export const toggleResourceLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resourceId = req.params.id as string;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const resource = await prisma.mirrorResource.findUnique({
      where: { id: resourceId },
      select: { sourceId: true },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    const existingLike = await prisma.mirrorResourceLike.findUnique({
      where: {
        resourceId_userId: {
          resourceId,
          userId,
        },
      },
    });

    let liked = false;
    if (existingLike) {
      await prisma.mirrorResourceLike.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      await prisma.mirrorResourceLike.create({
        data: {
          resourceId,
          userId,
        },
      });
      liked = true;
    }

    const count = await prisma.mirrorResourceLike.count({
      where: { resourceId },
    });

    res.json({ liked, count });
  } catch (error) {
    next(error);
  }
};

export const getResourceLikeStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const resourceId = req.params.id as string;
    const userId = req.userId;

    const resource = await prisma.mirrorResource.findUnique({
      where: { id: resourceId },
      select: { sourceId: true },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const count = await prisma.mirrorResourceLike.count({
      where: { resourceId },
    });

    let liked = false;
    if (userId) {
      const existingLike = await prisma.mirrorResourceLike.findUnique({
        where: {
          resourceId_userId: {
            resourceId,
            userId,
          },
        },
      });
      liked = !!existingLike;
    }

    res.json({ liked, count });
  } catch (error) {
    next(error);
  }
};

export const extractResourceLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const resource = await mirrorService.getResource(id);

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    // Must check access to resource source
    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    // Parse the download link and password from contentHtml
    let link = '';
    let password = '';

    const contentHtml = resource.contentHtml || '';
    const manualLinkRegex =
      /<!-- MANUAL_DOWNLOAD_LINK_START -->([\s\S]*?)<!-- MANUAL_DOWNLOAD_LINK_END -->/;
    const manualMatch = contentHtml.match(manualLinkRegex);

    if (manualMatch && manualMatch[1]) {
      const block = manualMatch[1];
      const hrefMatch = block.match(/href="([^"]+)"/);
      if (hrefMatch && hrefMatch[1]) {
        link = hrefMatch[1];
      }

      // Match passcode inside the span tags
      const passMatch =
        block.match(/提取密码\/访问码：<\/strong><span[^>]*>([^<]+)<\/span>/) ||
        block.match(/提取密码：([^<]+)/);
      if (passMatch && passMatch[1]) {
        password = passMatch[1].trim();
      }
    }

    if (!link) {
      return res.status(404).json({ error: '该资源暂未配置下载提取链接' });
    }

    // Encrypt link and password with shared key
    const envKey = process.env.EXTRACT_ENCRYPTION_KEY;
    if (!envKey && process.env.NODE_ENV === 'production') {
      logger.warn(
        '[Mirror] EXTRACT_ENCRYPTION_KEY is not set in production. Falling back to default key.',
      );
    }
    const key = envKey || '3d_learning_platform_secure_extract_key_2026';
    const encryptedLink = encryptText(link, key);
    const encryptedPassword = password ? encryptText(password, key) : '';

    res.json({
      encryptedLink,
      encryptedPassword,
      driveName: link.includes('quark.cn')
        ? '夸克网盘'
        : link.includes('baidu.com')
          ? '百度网盘'
          : link.includes('alipan.com') || link.includes('aliyundrive.com')
            ? '阿里云盘'
            : link.includes('123pan.com')
              ? '123云盘'
              : '资源网盘',
    });
  } catch (error) {
    next(error);
  }
};
