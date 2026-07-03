import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error';
import { getPaginationParams, createPaginationMeta } from '../../utils/pagination';

// GET /api/assets/requests
export const listAssetRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>, 20, 50);
    const status = req.query.status as string | undefined;

    const where: Prisma.AssetRequestWhereInput = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.assetRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { replies: true } },
        },
      }),
      prisma.assetRequest.count({ where }),
    ]);

    res.json({ requests, pagination: createPaginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
};

// GET /api/assets/requests/:id
export const getAssetRequestById = async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const request = await prisma.assetRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            linkedAsset: {
              select: { id: true, title: true, type: true, thumbnail: true, downloads: true },
            },
          },
        },
      },
    });

    if (!request) {
      return next(new AppError('求助帖不存在', 404));
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
};

// POST /api/assets/requests
export const createAssetRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return next(new AppError('标题和内容为必填项', 400));
  }

  try {
    const request = await prisma.assetRequest.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        userId: req.userId!,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    });

    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
};

// POST /api/assets/requests/:id/replies
export const createAssetRequestReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.params.id as string;
  const { content, linkedAssetId } = req.body;

  if (!content?.trim()) {
    return next(new AppError('回复内容不能为空', 400));
  }

  try {
    const request = await prisma.assetRequest.findUnique({ where: { id: requestId } });
    if (!request) return next(new AppError('求助帖不存在', 404));

    if (linkedAssetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: linkedAssetId, status: 'APPROVED' },
      });
      if (!asset) return next(new AppError('关联的模型不存在或未被批准发布', 400));
    }

    const reply = await prisma.assetRequestReply.create({
      data: {
        requestId,
        userId: req.userId!,
        content: content.trim(),
        linkedAssetId: linkedAssetId || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        linkedAsset: {
          select: { id: true, title: true, type: true, thumbnail: true, downloads: true },
        },
      },
    });

    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
};

// POST /api/assets/requests/:id/resolve
export const resolveAssetRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestId = req.params.id as string;
  try {
    const request = await prisma.assetRequest.findUnique({ where: { id: requestId } });
    if (!request) return next(new AppError('求助帖不存在', 404));

    if (request.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权关闭此求助贴', 403));
    }

    const updated = await prisma.assetRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED' },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
