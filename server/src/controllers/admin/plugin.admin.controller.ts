import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

import { AppError } from '../../utils/error';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import { auditService, type AuditRequest } from '../../services/audit.service';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';

/**
 * 将 Fastify request 适配为 auditService 所需的 Express Request。
 * auditService 仅读取 headers / ip / socket，这些在 request.raw 上均可用；
 * Fastify 的 request.ip 提供 trustProxy 感知的 IP。
 */
const toAuditReq = (request: FastifyRequest): AuditRequest => ({
  headers: request.headers,
  ip: request.ip,
  socket: request.raw.socket,
});

// ── List all plugins (admin) ───────────────────────────────────────────────────
export const adminListPlugins = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.limit || query.pageSize) as string) || 36),
  );
  const usePaginatedResponse =
    query.response === 'paginated' ||
    Boolean(query.page || query.limit || query.pageSize || search);

  const baseWhere: Prisma.PluginWhereInput = {};
  if (search) {
    baseWhere.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
      { compatibility: { contains: search } },
      { tags: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }
  const where = { ...baseWhere };
  if (status && status !== 'ALL') where.status = status;

  const plugins = await prisma.plugin.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    ...(usePaginatedResponse ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
  });

  if (!usePaginatedResponse) {
    reply.send(plugins);
    return;
  }

  const [total, statusSummary] = await Promise.all([
    prisma.plugin.count({ where }),
    prisma.plugin.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
  ]);
  const statusCounts = Object.fromEntries(
    statusSummary.map((item) => [item.status, item._count._all]),
  );

  reply.send({
    items: plugins,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
      pending: statusCounts.PENDING || 0,
      approved: statusCounts.APPROVED || 0,
      rejected: statusCounts.REJECTED || 0,
    },
  });
};

// ── Update plugin status / info (admin) ───────────────────────────────────────
export const adminUpdatePlugin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const existing = await prisma.plugin.findUnique({ where: { id } });
  if (!existing) throw new AppError('插件不存在', 404);

  const allowed = [
    'title',
    'description',
    'category',
    'version',
    'compatibility',
    'tags',
    'installGuide',
    'status',
    'rejectReason',
  ];
  const body = request.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  for (const field of allowed) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }
  if (updateData.status !== 'REJECTED') updateData.rejectReason = null;

  const plugin = await prisma.plugin.update({ where: { id }, data: updateData });
  await auditService.log({
    userId: request.userId as string,
    action:
      plugin.status === 'APPROVED'
        ? 'APPROVE_PLUGIN'
        : plugin.status === 'REJECTED'
          ? 'REJECT_PLUGIN'
          : 'UPDATE_PLUGIN',
    module: 'PLUGIN',
    description: `管理员更新了插件: ${plugin.title}`,
    oldValue: existing,
    newValue: plugin,
    req: toAuditReq(request),
  });
  logger.info(
    `[AdminPlugin] Admin ${request.userId} updated plugin ${id} → status: ${plugin.status}`,
  );
  reply.send(plugin);
};

// ── Batch update status (admin) ───────────────────────────────────────────────
export const adminBatchUpdatePlugins = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { ids, status, rejectReason } = request.body as {
    ids: string[];
    status: string;
    rejectReason?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('请选择要操作的插件', 400);
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) throw new AppError('状态值无效', 400);
  if (status === 'REJECTED' && !rejectReason?.trim()) throw new AppError('拒绝时请填写原因', 400);

  const plugins = await prisma.plugin.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, status: true },
  });
  const result = await prisma.plugin.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      rejectReason: status === 'REJECTED' ? rejectReason! : null,
    },
  });

  await auditService.log({
    userId: request.userId as string,
    action: status === 'APPROVED' ? 'APPROVE_PLUGIN' : 'REJECT_PLUGIN',
    module: 'PLUGIN',
    description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个插件`,
    oldValue: plugins,
    newValue: { ids, status, rejectReason },
    req: toAuditReq(request),
  });
  logger.info(`[AdminPlugin] Admin ${request.userId} batch-${status} ${ids.length} plugins`);
  reply.send({ message: `已批量更新 ${result.count} 个插件的状态`, count: result.count });
};

// ── Delete plugin (admin) ─────────────────────────────────────────────────────
export const adminDeletePlugin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const existing = await prisma.plugin.findUnique({ where: { id } });
  if (!existing) throw new AppError('插件不存在', 404);

  const fileSizeBytes = existing.fileSize ? Math.round(existing.fileSize * 1024 * 1024) : undefined;
  if (existing.fileUrl) {
    deleteCloudOrLocalFileByUrl(existing.fileUrl, fileSizeBytes).catch((error) => {
      logger.warn(`[AdminPlugin] Failed to remove plugin file ${existing.fileUrl}`, error);
    });
  }
  if (existing.previewUrl) {
    deleteCloudOrLocalFileByUrl(existing.previewUrl).catch((error) => {
      logger.warn(`[AdminPlugin] Failed to remove plugin preview ${existing.previewUrl}`, error);
    });
  }

  await prisma.plugin.delete({ where: { id } });
  await auditService.log({
    userId: request.userId as string,
    action: 'DELETE_PLUGIN',
    module: 'PLUGIN',
    description: `管理员删除了插件: ${existing.title}`,
    oldValue: existing,
    req: toAuditReq(request),
  });
  logger.info(`[AdminPlugin] Admin ${request.userId} deleted plugin ${id}`);
  reply.send({ message: '插件已删除' });
};
