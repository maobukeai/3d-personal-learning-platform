import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { auditService } from '../services/audit.service';
import { AppError } from '../utils/error';
import { redisService } from '../services/redis.service';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

const CATEGORIES_CACHE_KEY = 'categories:all';
const CATEGORIES_CACHE_TTL = 300; // 5 minutes

type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: { _count: { select: { assets: true } } };
}>;

const invalidateCategoriesCache = async () => {
  await redisService.del(CATEGORIES_CACHE_KEY);
};

export const getAllCategories = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const cached = await redisService.get<CategoryWithCount[]>(CATEGORIES_CACHE_KEY);
    if (cached) {
      return reply.send(cached);
    }

    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { assets: { where: { status: 'APPROVED' } } },
        },
      },
    });

    await redisService.set(CATEGORIES_CACHE_KEY, categories, CATEGORIES_CACHE_TTL);
    reply.send(categories);
  } catch (error) {
    throw error;
  }
};

export const adminCreateCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const { name, icon, order } = req.body as {
    name?: string;
    icon?: string | null;
    order?: string;
  };
  if (!name) {
    throw new AppError('Name is required', 400);
  }

  try {
    const category = await prisma.category.create({
      data: {
        name,
        icon,
        order: order ? parseInt(order, 10) : 0,
      },
    });

    await invalidateCategoriesCache();

    await auditService.log({
      userId: req.userId as string,
      action: 'CREATE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员创建了资产分类: ${category.name}`,
      newValue: category,
      req,
    });

    reply.status(201).send(category);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new AppError('Category name already exists', 400);
    }
    throw error;
  }
};

export const adminUpdateCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { name, icon, order } = req.body as {
    name?: string;
    icon?: string | null;
    order?: string;
  };

  try {
    const oldCategory = await prisma.category.findUnique({ where: { id } });
    if (!oldCategory) {
      throw new AppError('Category not found', 404);
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        icon,
        order: order !== undefined ? parseInt(order, 10) : undefined,
      },
    });

    await invalidateCategoriesCache();

    await auditService.log({
      userId: req.userId as string,
      action: 'UPDATE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员更新了资产分类: ${category.name}`,
      oldValue: oldCategory,
      newValue: category,
      req,
    });

    reply.send(category);
  } catch (error) {
    throw error;
  }
};

export const adminDeleteCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;

  try {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // Check if category has assets
    const assetCount = await prisma.asset.count({ where: { categoryId: id } });
    if (assetCount > 0) {
      throw new AppError('Cannot delete category with associated assets', 400);
    }

    await prisma.category.delete({ where: { id } });

    await invalidateCategoriesCache();

    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员删除了资产分类: ${category.name}`,
      oldValue: category,
      req,
    });

    reply.send({ message: 'Category deleted successfully' });
  } catch (error) {
    throw error;
  }
};
