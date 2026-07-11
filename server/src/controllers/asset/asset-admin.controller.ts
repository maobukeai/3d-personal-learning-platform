import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { createNotification } from '../../utils/notification';
import { clampLimit, clampPage } from '../../utils/pagination';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
  userId?: string;
  user?: any;
};

export const getAllAssetsForAdmin = async (req: AdminRequest, reply: FastifyReply) => {
  const { status, search, page: pageQuery, limit: limitQuery, response } = req.query;
  try {
    const q = typeof search === 'string' ? search.trim() : '';
    const normalizedStatus = typeof status === 'string' && status !== 'ALL' ? status : undefined;
    const page = clampPage(pageQuery);
    const limit = clampLimit(limitQuery, 36, 100);
    const usePaginatedResponse = response === 'paginated' || Boolean(pageQuery || limitQuery || q);
    const baseWhere: Prisma.AssetWhereInput = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
            { type: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        }
      : {};
    const where: Prisma.AssetWhereInput = normalizedStatus
      ? { ...baseWhere, status: normalizedStatus }
      : baseWhere;
    const assets = await prisma.asset.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true },
        },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    const normalizedAssets = assets.map(({ category, ...asset }) => ({
      ...asset,
      category: category?.name || null,
    }));

    if (!usePaginatedResponse) {
      return reply.send(normalizedAssets);
    }

    const [total, statusSummary] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);

    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    reply.send({
      items: normalizedAssets,
      total,
      page,
      pageSize: limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
        pending: statusCounts.PENDING || 0,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
    });
  } catch (error) {
    throw error;
  }
};

export const updateAssetStatus = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { status, rejectReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  try {
    const updateData: Prisma.AssetUpdateInput = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) throw new AppError('Asset not found', 404);

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员${status === 'APPROVED' ? '批准' : '拒绝'}了资产: ${asset.title}`,
      oldValue: { status: oldAsset.status },
      newValue: { status, rejectReason },
      req,
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
      content:
        status === 'REJECTED' && rejectReason
          ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
          : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: asset.userId,
      link: '/assets',
      category: 'SYSTEM',
    });

    reply.send(asset);
  } catch (error) {
    throw error;
  }
};

export const batchUpdateAssetStatus = async (req: AdminRequest, reply: FastifyReply) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('请选择至少一个资产', 400);
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  try {
    const updateData: Prisma.AssetUpdateManyMutationInput = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const result = await prisma.asset.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    const assets = await prisma.asset.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true },
    });

    for (const asset of assets) {
      await createNotification({
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
        content:
          status === 'REJECTED' && rejectReason
            ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
            : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: asset.userId,
        link: '/assets',
        category: 'SYSTEM',
      });
    }

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个资产`,
      newValue: { ids, status, rejectReason },
      req,
    });

    reply.send({ message: `成功更新 ${result.count} 个资产状态`, count: result.count });
  } catch (error) {
    throw error;
  }
};

export const adminUpdateAsset = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, description, status, categoryId, formats, tags } = req.body;

  try {
    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) throw new AppError('Asset not found', 404);

    const updateData: Prisma.AssetUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (formats !== undefined) {
      updateData.formats = formats ? JSON.stringify(formats) : null;
    }
    if (tags !== undefined) {
      updateData.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员更新了资产: ${asset.title}`,
      oldValue: oldAsset,
      newValue: asset,
      req,
    });

    reply.send(asset);
  } catch (error) {
    throw error;
  }
};

export const adminDeleteAsset = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    // Delete files from disk or cloud if they exist (run in background)
    const fileSizeBytes = asset.packageSize
      ? Math.round(asset.packageSize * 1024 * 1024)
      : undefined;
    deleteCloudOrLocalFileByUrl(asset.url, fileSizeBytes).catch((err) => {
      logger.error(
        `[AssetController] Failed to delete asset file ${asset.url} in background:`,
        err,
      );
    });
    if (asset.thumbnail) {
      deleteCloudOrLocalFileByUrl(asset.thumbnail).catch((err) => {
        logger.error(
          `[AssetController] Failed to delete asset thumbnail ${asset.thumbnail} in background:`,
          err,
        );
      });
    }

    await prisma.asset.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员删除了资产: ${asset.title}`,
      oldValue: asset,
      req,
    });

    reply.send({ message: 'Asset deleted successfully by admin' });
  } catch (error) {
    throw error;
  }
};
