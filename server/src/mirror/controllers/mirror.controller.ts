import { Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { mirrorService } from '../services/mirror.service';
import prisma from '../../services/prisma';
import { getPlanName } from '../../utils/plan-utils';

export const getSources = async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const source = await mirrorService.getSource(id, req.userId);

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    res.json(source);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const access = await checkSourceAccess(sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    const categories = await mirrorService.getCategories(sourceId);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const access = await checkSourceAccess(sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getResource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const resource = await mirrorService.getResource(id);

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    // Rewrite relative image/link paths in contentHtml and thumbnailUrl to include the request host
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    if (resource.contentHtml) {
      resource.contentHtml = resource.contentHtml.replace(
        /(src|href)=["'](\/uploads\/[^"']+)["']/gi,
        `$1="${hostUrl}$2"`
      );
    }
    if (resource.thumbnailUrl && resource.thumbnailUrl.startsWith('/uploads/')) {
      resource.thumbnailUrl = `${hostUrl}${resource.thumbnailUrl}`;
    }

    res.json(resource);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const searchResources = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const access = await checkSourceAccess(sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    const q = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await mirrorService.getResources(sourceId, {
      page,
      pageSize,
      search: q,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSourceStats = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const access = await checkSourceAccess(sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
    }

    const stats = await mirrorService.getSourceStats(sourceId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPlanRequiredForSource = async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getResourceComments = async (req: AuthRequest, res: Response) => {
  try {
    const resourceId = req.params.id as string;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createResourceComment = async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteResourceComment = async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleResourceLike = async (req: AuthRequest, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getResourceLikeStatus = async (req: AuthRequest, res: Response) => {
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

    const access = await checkSourceAccess(resource.sourceId, req);
    if (!access.hasAccess) {
      return res.status(access.error === '镜像源不存在' ? 404 : 403).json(access);
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
