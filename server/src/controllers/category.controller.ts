import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { assets: { where: { status: 'APPROVED' } } },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminCreateCategory = async (req: AuthRequest, res: Response) => {
  const { name, icon, order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const category = await prisma.category.create({
      data: {
        name,
        icon,
        order: order ? parseInt(order) : 0,
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: 'CREATE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员创建了资产分类: ${category.name}`,
      newValue: category,
      req,
    });

    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminUpdateCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const { name, icon, order } = req.body;

  try {
    const oldCategory = await prisma.category.findUnique({ where: { id } });
    if (!oldCategory) return res.status(404).json({ error: 'Category not found' });

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        icon,
        order: order !== undefined ? parseInt(order) : undefined,
      },
    });

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
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminDeleteCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id;

  try {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Check if category has assets
    const assetCount = await prisma.asset.count({ where: { categoryId: id } });
    if (assetCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with associated assets' });
    }

    await prisma.category.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_CATEGORY',
      module: 'CATEGORY',
      description: `管理员删除了资产分类: ${category.name}`,
      oldValue: category,
      req,
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};
