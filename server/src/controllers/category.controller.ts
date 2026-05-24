import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';

// In-memory categories cache
let categoriesCache: any[] | null = null;

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (categoriesCache) {
      return res.json(categoriesCache);
    }

    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { assets: { where: { status: 'APPROVED' } } },
        },
      },
    });

    categoriesCache = categories;
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const adminCreateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, icon, order } = req.body;
  if (!name) {
    return next(new AppError('Name is required', 400));
  }

  try {
    const category = await prisma.category.create({
      data: {
        name,
        icon,
        order: order ? parseInt(order, 10) : 0,
      },
    });

    // Invalidate categories cache
    categoriesCache = null;

    await auditService.log({
      userId: req.userId as string,
      action: 'CREATE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员创建了资产分类: ${category.name}`,
      newValue: category,
      req,
    });

    res.status(201).json(category);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return next(new AppError('Category name already exists', 400));
    }
    next(error);
  }
};

export const adminUpdateCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { name, icon, order } = req.body;

  try {
    const oldCategory = await prisma.category.findUnique({ where: { id } });
    if (!oldCategory) {
      return next(new AppError('Category not found', 404));
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        icon,
        order: order !== undefined ? parseInt(order, 10) : undefined,
      },
    });

    // Invalidate categories cache
    categoriesCache = null;

    await auditService.log({
      userId: req.userId as string,
      action: 'UPDATE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员更新了资产分类: ${category.name}`,
      oldValue: oldCategory,
      newValue: category,
      req,
    });

    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;

  try {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return next(new AppError('Category not found', 404));
    }

    // Check if category has assets
    const assetCount = await prisma.asset.count({ where: { categoryId: id } });
    if (assetCount > 0) {
      return next(new AppError('Cannot delete category with associated assets', 400));
    }

    await prisma.category.delete({ where: { id } });

    // Invalidate categories cache
    categoriesCache = null;

    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员删除了资产分类: ${category.name}`,
      oldValue: category,
      req,
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};
