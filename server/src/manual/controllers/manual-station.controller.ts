import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { clampLimit, clampPage } from '../../utils/pagination';
import { config } from '../../config/env';
import { UploadedFile } from '../../types/upload';

type ManualRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

// Helper to check user plan priority vs station priority
const getUserPlanPriority = async (userId: string): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });
  if (!user || user.role === 'ADMIN') return 999; // Admins have absolute priority
  if (!user.subscription || user.subscription.status !== 'ACTIVE') return 0; // Free plan
  return user.subscription.plan?.priority || 0;
};

const checkStationAccess = async (stationId: string, userId?: string) => {
  const station = await prisma.manualStation.findUnique({
    where: { id: stationId },
    select: { minPlanPriority: true },
  });

  if (!station) {
    return { hasAccess: false, error: '站点不存在' };
  }

  if (station.minPlanPriority > 0) {
    let userPlanPriority = 0;
    if (userId) {
      userPlanPriority = await getUserPlanPriority(userId);
    }
    if (userPlanPriority < station.minPlanPriority) {
      return {
        hasAccess: false,
        error: '权限不足',
        message: '当前内容需要更高会员权限才能查看',
        requiredPlan: station.minPlanPriority,
        currentPlan: userPlanPriority,
      };
    }
  }

  return { hasAccess: true };
};

// -------------------------------------------------------------
// USER FACING CONTROLLERS
// -------------------------------------------------------------

export const getStations = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const userId = req.userId;
    const stations = await prisma.manualStation.findMany({
      orderBy: { createdAt: 'desc' },
    });

    let userPlanPriority = 0;
    if (userId) {
      userPlanPriority = await getUserPlanPriority(userId);
    }

    const result = stations.map((s) => ({
      ...s,
      hasAccess: userPlanPriority >= s.minPlanPriority,
    }));

    reply.send(result);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getStation = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const id = req.params.id as string;
    const station = await prisma.manualStation.findUnique({
      where: { id },
    });

    if (!station) {
      return reply.status(404).send({ error: '站点不存在' });
    }

    let userPlanPriority = 0;
    if (req.userId) {
      userPlanPriority = await getUserPlanPriority(req.userId);
    }

    reply.send({
      ...station,
      hasAccess: userPlanPriority >= station.minPlanPriority,
    });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getCategories = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const stationId = req.params.stationId as string;
    const stationExists = await prisma.manualStation.findUnique({ where: { id: stationId } });
    if (!stationExists) {
      return reply.status(404).send({ error: '站点不存在' });
    }

    const categories = await prisma.manualCategory.findMany({
      where: { stationId },
      orderBy: { order: 'asc' },
    });
    reply.send(categories);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getResources = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const stationId = req.params.stationId as string;
    const stationExists = await prisma.manualStation.findUnique({ where: { id: stationId } });
    if (!stationExists) {
      return reply.status(404).send({ error: '站点不存在' });
    }

    const page = clampPage(req.query.page);
    const pageSize = clampLimit(req.query.pageSize, 21, 100);
    const categoryId = (req.query.categoryId as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const sort = (req.query.sort as string) || undefined;

    const where: Prisma.ManualResourceWhereInput = { stationId };
    if (categoryId) {
      const childCategories = await prisma.manualCategory.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });
      const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];
      where.categoryId = { in: categoryIds };
    }
    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    let orderBy: Prisma.ManualResourceOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sort === 'views') {
      orderBy = { viewCount: 'desc' };
    } else if (sort === 'title') {
      orderBy = { title: 'asc' };
    }

    const [resources, total] = await Promise.all([
      prisma.manualResource.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { name: true } },
        },
      }),
      prisma.manualResource.count({ where }),
    ]);

    reply.send({
      resources,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getResource = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const id = req.params.id as string;

    const resource = await prisma.manualResource.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        likes: true,
      },
    });

    if (!resource) {
      return reply.status(404).send({ error: '资源不存在' });
    }

    const access = await checkStationAccess(resource.stationId, req.userId);
    if (!access.hasAccess && access.error === '站点不存在') {
      return reply.status(404).send({ error: '站点不存在' });
    }

    // Host url mapping for local media files
    const hostUrl = config.BACKEND_URL.replace(/\/$/, '');
    let cleanHtml = resource.contentHtml || '';
    if (cleanHtml) {
      cleanHtml = cleanHtml.replace(
        /(src|href)=["'](\/uploads\/[^"']+)["']/gi,
        `$1="${hostUrl}$2"`,
      );
    }

    // Identify netdisk links from contentUrl directly
    const linksMeta: Array<{ name: string; type: string }> = [];
    if (resource.contentUrl) {
      const url = resource.contentUrl;
      const type = url.includes('quark.cn')
        ? 'quark'
        : url.includes('baidu.com')
          ? 'baidu'
          : url.includes('alipan.com') || url.includes('aliyundrive.com')
            ? 'aliyun'
            : url.includes('123pan.com')
              ? '123pan'
              : 'generic';
      const name = url.includes('quark.cn')
        ? '夸克网盘'
        : url.includes('baidu.com')
          ? '百度网盘'
          : url.includes('alipan.com') || url.includes('aliyundrive.com')
            ? '阿里云盘'
            : url.includes('123pan.com')
              ? '123云盘'
              : '资源网盘';
      linksMeta.push({ name, type });
    }

    let finalThumbnail = resource.thumbnailUrl;
    if (finalThumbnail && finalThumbnail.startsWith('/uploads/')) {
      finalThumbnail = `${hostUrl}${finalThumbnail}`;
    }

    // Update view count asynchronously
    prisma.manualResource
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    const hasLiked = req.userId ? resource.likes.some((l) => l.userId === req.userId) : false;

    reply.send({
      id: resource.id,
      stationId: resource.stationId,
      categoryId: resource.categoryId,
      category: resource.category,
      title: resource.title,
      description: resource.description,
      thumbnailUrl: finalThumbnail,
      contentHtml: access.hasAccess ? cleanHtml : null,
      resourceType: resource.resourceType,
      viewCount: resource.viewCount + 1,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      comments: resource.comments,
      likeCount: resource.likes.length,
      hasLiked,
      links: access.hasAccess ? linksMeta : [],
      hasAccess: access.hasAccess,
      minPlanPriority: access.requiredPlan,
    });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const extractDownloadLink = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const id = req.params.id as string;
    const resource = await prisma.manualResource.findUnique({
      where: { id },
      select: { contentUrl: true, stationId: true },
    });

    if (!resource) {
      return reply.status(404).send({ error: '资源不存在' });
    }

    const access = await checkStationAccess(resource.stationId, req.userId);
    if (!access.hasAccess) {
      if (access.error === '站点不存在') {
        return reply.status(404).send({ error: '站点不存在' });
      }
      return reply.status(403).send({
        error: '权限不足',
        message: '您的会员权限不足，无法提取此资源链接',
      });
    }

    if (!resource.contentUrl) {
      return reply.status(404).send({ error: '此资源未配置下载链接' });
    }

    reply.send({ downloadUrl: resource.contentUrl });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const createComment = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const resourceId = req.params.id as string;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return reply.status(400).send({ error: '评论内容不能为空' });
    }

    const resource = await prisma.manualResource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return reply.status(404).send({ error: '资源不存在' });
    }

    const comment = await prisma.manualResourceComment.create({
      data: {
        resourceId,
        userId: req.userId!,
        content,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    reply.status(201).send(comment);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const toggleLike = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const resourceId = req.params.id as string;
    const userId = req.userId!;

    const existingLike = await prisma.manualResourceLike.findUnique({
      where: {
        resourceId_userId: { resourceId, userId },
      },
    });

    if (existingLike) {
      await prisma.manualResourceLike.delete({
        where: { id: existingLike.id },
      });
      return reply.send({ liked: false });
    } else {
      await prisma.manualResourceLike.create({
        data: { resourceId, userId },
      });
      return reply.send({ liked: true });
    }
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

// -------------------------------------------------------------
// ADMIN CRUD CONTROLLERS
// -------------------------------------------------------------

export const createStation = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const { name, displayName, minPlanPriority, description, iconUrl } = req.body;

    if (!name || !displayName) {
      return reply.status(400).send({ error: '标识与名称为必填项' });
    }

    const exists = await prisma.manualStation.findUnique({ where: { name } });
    if (exists) {
      return reply.status(400).send({ error: '此站点英文标识已被占用' });
    }

    const station = await prisma.manualStation.create({
      data: {
        name,
        displayName,
        minPlanPriority: parseInt(minPlanPriority) || 0,
        description,
        iconUrl,
      },
    });

    reply.status(201).send(station);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateStation = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const id = req.params.id as string;
    const { name, displayName, minPlanPriority, description, iconUrl, status } = req.body;

    if (!displayName) {
      return reply.status(400).send({ error: '显示名称为必填项' });
    }

    const station = await prisma.manualStation.update({
      where: { id },
      data: {
        name,
        displayName,
        minPlanPriority: parseInt(minPlanPriority) || 0,
        description,
        iconUrl,
        status,
      },
    });

    reply.send(station);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteStation = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const id = req.params.id as string;
    await prisma.manualStation.delete({ where: { id } });
    reply.send({ message: '站点删除成功' });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const createCategory = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const stationId = req.params.stationId as string;
    const { name, slug, order, parentId, childIds } = req.body;

    if (!name) {
      return reply.status(400).send({ error: '分类名称为必填项' });
    }

    const category = await prisma.manualCategory.create({
      data: {
        stationId,
        name,
        slug,
        order: parseInt(order) || 0,
        parentId: parentId || null,
      },
    });

    if (childIds && Array.isArray(childIds) && childIds.length > 0) {
      await prisma.manualCategory.updateMany({
        where: {
          id: { in: childIds },
          stationId,
        },
        data: {
          parentId: category.id,
        },
      });
    }

    reply.status(201).send(category);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateCategory = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const catId = req.params.catId as string;
    const { name, slug, order, parentId, childIds } = req.body;

    const category = await prisma.manualCategory.update({
      where: { id: catId },
      data: {
        name,
        slug,
        order: parseInt(order) || 0,
        parentId: parentId !== undefined ? parentId || null : undefined,
      },
    });

    if (childIds && Array.isArray(childIds)) {
      // 1. Reset parentId to null for categories that are currently children of this category but not in the new childIds list
      await prisma.manualCategory.updateMany({
        where: {
          parentId: catId,
          id: { notIn: childIds },
        },
        data: {
          parentId: null,
        },
      });

      // 2. Set parentId to catId for the selected categories
      await prisma.manualCategory.updateMany({
        where: {
          id: { in: childIds },
          stationId: category.stationId,
        },
        data: {
          parentId: catId,
        },
      });
    }

    reply.send(category);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteCategory = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const catId = req.params.catId as string;

    // Disconnect resources from this category
    await prisma.manualResource.updateMany({
      where: { categoryId: catId },
      data: { categoryId: null },
    });

    await prisma.manualCategory.delete({ where: { id: catId } });
    reply.send({ message: '分类删除成功' });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const createResource = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const stationId = req.params.stationId as string;
    const {
      title,
      description,
      categoryId,
      thumbnailUrl,
      contentUrl,
      tags,
      contentHtml,
      resourceType,
    } = req.body;

    if (!title) {
      return reply.status(400).send({ error: '资源标题为必填项' });
    }

    const resource = await prisma.manualResource.create({
      data: {
        stationId,
        title,
        description,
        categoryId: categoryId || null,
        thumbnailUrl,
        contentUrl,
        tags,
        contentHtml,
        resourceType: resourceType || 'COURSE',
      },
    });

    // Update station total resource count
    const total = await prisma.manualResource.count({ where: { stationId } });
    await prisma.manualStation.update({
      where: { id: stationId },
      data: { totalResources: total },
    });

    reply.status(201).send(resource);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateResource = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const resId = req.params.resId as string;
    const {
      title,
      description,
      categoryId,
      thumbnailUrl,
      contentUrl,
      tags,
      contentHtml,
      resourceType,
    } = req.body;

    const resource = await prisma.manualResource.update({
      where: { id: resId },
      data: {
        title,
        description,
        categoryId: categoryId || null,
        thumbnailUrl,
        contentUrl,
        tags,
        contentHtml,
        resourceType: resourceType || 'COURSE',
      },
    });

    reply.send(resource);
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteResource = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    const resId = req.params.resId as string;

    const resource = await prisma.manualResource.findUnique({
      where: { id: resId },
      select: { stationId: true },
    });

    if (resource) {
      await prisma.manualResource.delete({ where: { id: resId } });

      // Update station total resource count
      const total = await prisma.manualResource.count({ where: { stationId: resource.stationId } });
      await prisma.manualStation.update({
        where: { id: resource.stationId },
        data: { totalResources: total },
      });
    }

    reply.send({ message: '资源删除成功' });
  } catch (error) {
    reply.status(500).send({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const uploadImage = async (req: ManualRequest, reply: FastifyReply) => {
  try {
    if (!req.file) {
      return reply.status(400).send({ error: '请选择要上传的图片文件' });
    }
    const relativePath = (req.file as unknown as UploadedFile).url;
    if (!relativePath) {
      return reply.status(400).send({ error: '文件上传失败，未获取到云存储地址' });
    }
    reply.send({ url: relativePath });
  } catch (_error) {
    reply.status(500).send({ error: '图片上传失败' });
  }
};
