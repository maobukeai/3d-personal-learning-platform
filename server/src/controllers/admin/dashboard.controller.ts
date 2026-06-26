import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { emitToAll } from '../../services/socket.service';
import { createNotificationBatch } from '../../utils/notification';
import { AppError } from '../../utils/error';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { redisService } from '../../services/redis.service';

const DASHBOARD_STATS_CACHE_TTL = 30; // seconds

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const getDateBound = (value: unknown, boundary: 'start' | 'end') => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (!value.includes('T')) {
    if (boundary === 'start') date.setHours(0, 0, 0, 0);
    if (boundary === 'end') date.setHours(23, 59, 59, 999);
  }
  return date;
};

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
};

const getAuditSeverity = (action: string) => {
  if (/DELETE|RESET_PASSWORD|REVOKE|BAN|CLEANUP|REJECT/.test(action)) return 'HIGH';
  if (/UPDATE_SETTINGS|BATCH|APPROVE|CREATE_USER|UPDATE_USER/.test(action)) return 'MEDIUM';
  return 'LOW';
};

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

export const getAdminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Return cached stats when available (no force-refresh requested)
    if (req.query.refresh !== '1') {
      const cached = await redisService.get<object>('admin_dashboard_stats');
      if (cached) {
        return res.json(cached);
      }
    }

    const last7Days = daysAgo(7);
    const last30Days = daysAgo(30);

    const [
      userCount,
      activeUserCount,
      bannedUserCount,
      newUsers7d,
      newUsers30d,
      assetCount,
      approvedAssets,
      pendingAssets,
      rejectedAssets,
      newAssets7d,
      materialCount,
      approvedMaterials,
      pendingMaterials,
      rejectedMaterials,
      showcaseCount,
      approvedShowcases,
      pendingShowcases,
      rejectedShowcases,
      pluginCount,
      approvedPlugins,
      pendingPlugins,
      rejectedPlugins,
      courseCount,
      publishedCourses,
      draftCourses,
      newCourses30d,
      roadmapCount,
      enrollmentCount,
      discussionCount,
      feedbackCount,
      openFeedbacks,
      inProgressFeedbacks,
      resolvedFeedbacks,
      closedFeedbacks,
      teamCount,
      subscriptionCount,
      activeSubscriptionCount,
      transactionCount,
      failedTransactionCount,
      bannerCount,
      activeBannerCount,
      mirrorSourceCount,
      manualStationCount,
      auditLogs7d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.asset.count(),
      prisma.asset.count({ where: { status: 'APPROVED' } }),
      prisma.asset.count({ where: { status: 'PENDING' } }),
      prisma.asset.count({ where: { status: 'REJECTED' } }),
      prisma.asset.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.material.count(),
      prisma.material.count({ where: { status: 'APPROVED' } }),
      prisma.material.count({ where: { status: 'PENDING' } }),
      prisma.material.count({ where: { status: 'REJECTED' } }),
      prisma.showcase.count(),
      prisma.showcase.count({ where: { status: 'APPROVED' } }),
      prisma.showcase.count({ where: { status: 'PENDING' } }),
      prisma.showcase.count({ where: { status: 'REJECTED' } }),
      prisma.plugin.count(),
      prisma.plugin.count({ where: { status: 'APPROVED' } }),
      prisma.plugin.count({ where: { status: 'PENDING' } }),
      prisma.plugin.count({ where: { status: 'REJECTED' } }),
      prisma.course.count(),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
      prisma.course.count({ where: { status: 'DRAFT' } }),
      prisma.course.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.roadmap.count(),
      prisma.enrollment.count(),
      prisma.discussion.count(),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
      prisma.feedback.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { status: 'RESOLVED' } }),
      prisma.feedback.count({ where: { status: 'CLOSED' } }),
      prisma.team.count({ where: { type: 'TEAM' } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.banner.count(),
      prisma.banner.count({ where: { isActive: true } }),
      prisma.mirrorSource.count(),
      prisma.manualStation.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: last7Days } } }),
    ]);

    const [
      recentUsers,
      recentAssets,
      recentFeedbacks,
      recentAuditLogs,
      pendingAssetItems,
      pendingMaterialItems,
      pendingShowcaseItems,
      pendingPluginItems,
      topCourses,
      latestBroadcasts,
    ] = await Promise.all([
      prisma.user.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          points: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.asset.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.feedback.findMany({
        take: 6,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      }),
      prisma.asset.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.material.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.showcase.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.plugin.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.course.findMany({
        take: 5,
        orderBy: [{ enrollments: { _count: 'desc' } }, { updatedAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { lessons: true, enrollments: true, reviews: true } },
        },
      }),
      prisma.broadcast.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
    ]);

    const reviewQueueTotal = pendingAssets + pendingMaterials + pendingShowcases + pendingPlugins;

    const stats = {
      counts: {
        users: userCount,
        activeUsers: activeUserCount,
        bannedUsers: bannedUserCount,
        newUsers7d,
        newUsers30d,
        assets: assetCount,
        approvedAssets,
        pendingAssets,
        rejectedAssets,
        newAssets7d,
        materials: materialCount,
        approvedMaterials,
        pendingMaterials,
        rejectedMaterials,
        showcases: showcaseCount,
        approvedShowcases,
        pendingShowcases,
        rejectedShowcases,
        plugins: pluginCount,
        approvedPlugins,
        pendingPlugins,
        rejectedPlugins,
        courses: courseCount,
        publishedCourses,
        draftCourses,
        newCourses30d,
        roadmaps: roadmapCount,
        enrollments: enrollmentCount,
        discussions: discussionCount,
        feedbacks: feedbackCount,
        openFeedbacks,
        inProgressFeedbacks,
        resolvedFeedbacks,
        closedFeedbacks,
        teams: teamCount,
        subscriptions: subscriptionCount,
        activeSubscriptions: activeSubscriptionCount,
        transactions: transactionCount,
        failedTransactions: failedTransactionCount,
        banners: bannerCount,
        activeBanners: activeBannerCount,
        mirrorSources: mirrorSourceCount,
        manualStations: manualStationCount,
        auditLogs7d,
        reviewQueueTotal,
      },
      health: {
        reviewQueueLevel: reviewQueueTotal > 20 ? 'HIGH' : reviewQueueTotal > 5 ? 'MEDIUM' : 'LOW',
        feedbackLevel: openFeedbacks > 10 ? 'HIGH' : openFeedbacks > 3 ? 'MEDIUM' : 'LOW',
        billingLevel: failedTransactionCount > 0 ? 'WATCH' : 'OK',
        contentLevel: reviewQueueTotal > 0 ? 'WATCH' : 'OK',
      },
      growth: {
        users7d: newUsers7d,
        users30d: newUsers30d,
        assets7d: newAssets7d,
        courses30d: newCourses30d,
      },
      reviewQueues: {
        assets: { total: pendingAssets, items: pendingAssetItems },
        materials: { total: pendingMaterials, items: pendingMaterialItems },
        showcases: { total: pendingShowcases, items: pendingShowcaseItems },
        plugins: { total: pendingPlugins, items: pendingPluginItems },
      },
      recentUsers,
      recentAssets,
      recentFeedbacks,
      recentAuditLogs,
      topCourses,
      latestBroadcasts: latestBroadcasts.map((b) => {
        const isOffline = b.title.startsWith('[OFFLINE]');
        return {
          ...b,
          title: isOffline ? b.title.slice(9) : b.title,
          isOffline,
        };
      }),
    };

    // Cache the response for 30 seconds to reduce database load
    redisService.set('admin_dashboard_stats', stats, DASHBOARD_STATS_CACHE_TTL).catch(() => {});

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 50,
      module,
      action,
      search,
      userId,
      dateFrom,
      dateTo,
      export: exportFormat,
    } = req.query;

    const take = Math.min(toPositiveNumber(limit, 50), 200);
    const currentPage = toPositiveNumber(page, 1);
    const skip = (currentPage - 1) * take;

    const where: Record<string, unknown> = {};
    if (module) where.module = module as string;
    if (action) where.action = { contains: action as string };
    if (userId) where.userId = userId as string;
    const fromDate = getDateBound(dateFrom, 'start');
    const toDate = getDateBound(dateTo, 'end');
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, unknown>).gte = fromDate;
      if (toDate) (where.createdAt as Record<string, unknown>).lte = toDate;
    }

    const keyword = typeof search === 'string' ? search.trim() : '';
    if (keyword) {
      where.OR = [
        { action: { contains: keyword } },
        { module: { contains: keyword } },
        { description: { contains: keyword } },
        { ipAddress: { contains: keyword } },
        { user: { name: { contains: keyword } } },
        { user: { email: { contains: keyword } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    if (exportFormat === 'csv') {
      const rows = [
        ['时间', '模块', '动作', '操作者', '邮箱', 'IP', '描述'],
        ...logs.map((log) => [
          log.createdAt.toISOString(),
          log.module,
          log.action,
          log.user?.name || 'System',
          log.user?.email || '',
          log.ipAddress || '',
          log.description || '',
        ]),
      ];

      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(`\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`);
      return;
    }

    const insightWindowStart = fromDate || daysAgo(14);
    const createdAtFilter = where.createdAt as { gte?: Date; lte?: Date } | undefined;
    const insightWhere = {
      ...where,
      createdAt: {
        ...(createdAtFilter || {}),
        gte:
          createdAtFilter?.gte && createdAtFilter.gte > insightWindowStart
            ? createdAtFilter.gte
            : insightWindowStart,
      },
    };

    const [moduleSummary, actionSummary, sourceSummary, actorSummary, trendLogs] =
      await Promise.all([
        prisma.auditLog.groupBy({ by: ['module'], where, _count: { _all: true } }),
        prisma.auditLog.groupBy({ by: ['action'], where, _count: { _all: true } }),
        prisma.auditLog.groupBy({
          by: ['ipAddress'],
          where,
          _count: { _all: true },
          orderBy: { _count: { ipAddress: 'desc' } },
          take: 8,
        }),
        prisma.auditLog.groupBy({
          by: ['userId'],
          where,
          _count: { _all: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 8,
        }),
        prisma.auditLog.findMany({
          where: insightWhere,
          take: 1500,
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true, action: true, module: true },
        }),
      ]);

    const actorIds = actorSummary
      .map((item) => item.userId)
      .filter((id): id is string => Boolean(id));
    const actorUsers = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      : [];
    const actorUserMap = new Map(actorUsers.map((user) => [user.id, user]));
    const trendMap = new Map<
      string,
      { date: string; total: number; high: number; medium: number; low: number }
    >();
    trendLogs.forEach((log) => {
      const date = formatDayKey(log.createdAt);
      const current = trendMap.get(date) || { date, total: 0, high: 0, medium: 0, low: 0 };
      const severity = getAuditSeverity(log.action);
      current.total += 1;
      if (severity === 'HIGH') current.high += 1;
      else if (severity === 'MEDIUM') current.medium += 1;
      else current.low += 1;
      trendMap.set(date, current);
    });

    const severitySummary = actionSummary.reduce(
      (acc, item) => {
        const severity = getAuditSeverity(item.action);
        if (severity === 'HIGH') acc.high += item._count._all;
        else if (severity === 'MEDIUM') acc.medium += item._count._all;
        else acc.low += item._count._all;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );

    res.json({
      logs,
      total,
      pages: Math.ceil(total / take),
      currentPage,
      pageSize: take,
      summary: {
        modules: moduleSummary
          .map((item) => ({ module: item.module, count: item._count._all }))
          .sort((a, b) => b.count - a.count),
        actions: actionSummary
          .map((item) => ({ action: item.action, count: item._count._all }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
      },
      insights: {
        severity: severitySummary,
        sources: sourceSummary
          .filter((item) => item.ipAddress)
          .map((item) => ({ ipAddress: item.ipAddress, count: item._count._all })),
        actors: actorSummary.map((item) => ({
          userId: item.userId,
          count: item._count._all,
          user: item.userId ? actorUserMap.get(item.userId) || null : null,
        })),
        trend: Array.from(trendMap.values()),
        windowDays: fromDate ? null : 14,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBroadcasts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const mapped = broadcasts.map((b) => {
      const isOffline = b.title.startsWith('[OFFLINE]');
      return {
        ...b,
        title: isOffline ? b.title.slice(9) : b.title,
        isOffline,
      };
    });
    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

export const deleteBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    const broadcast = await prisma.broadcast.delete({
      where: { id: String(id) },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_SETTINGS,
      module: AuditModule.SETTINGS,
      description: `撤回全站广播：${broadcast.title}`,
      oldValue: broadcast,
      req,
    });

    res.json({ message: '广播已成功撤回' });
  } catch (error) {
    next(error);
  }
};

export const sendBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, content, link } = req.body;

  if (!title || !content) {
    return next(new AppError('标题和内容不能为空', 400));
  }

  try {
    const broadcast = await prisma.broadcast.create({
      data: { title, content, link },
    });

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    await createNotificationBatch(
      users.map((user) => ({
        type: 'SYSTEM',
        title,
        content,
        link,
        userId: user.id,
        broadcastId: broadcast.id,
        category: 'SYSTEM',
      })),
    );

    emitToAll('new_notification', {
      type: 'SYSTEM',
      title,
      content,
      link,
      createdAt: new Date(),
      broadcastId: broadcast.id,
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_SETTINGS,
      module: AuditModule.SETTINGS,
      description: `发送全站广播：${title}`,
      newValue: { title, content, link, recipients: users.length },
      req,
    });

    res.json({ message: `广播发送成功，共发送给 ${users.length} 名用户` });
  } catch (error) {
    next(error);
  }
};

export const toggleBroadcastOffline = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  try {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: String(id) },
    });

    if (!broadcast) {
      return next(new AppError('该广播不存在', 404));
    }

    const isCurrentlyOffline = broadcast.title.startsWith('[OFFLINE]');
    let newTitle: string;
    if (isCurrentlyOffline) {
      newTitle = broadcast.title.slice(9);
    } else {
      newTitle = `[OFFLINE]${broadcast.title}`;
    }

    const updated = await prisma.broadcast.update({
      where: { id: String(id) },
      data: { title: newTitle },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_SETTINGS,
      module: AuditModule.SETTINGS,
      description: isCurrentlyOffline
        ? `重新发布全站广播：${newTitle}`
        : `下架全站广播：${broadcast.title}`,
      newValue: updated,
      oldValue: broadcast,
      req,
    });

    res.json({
      message: isCurrentlyOffline ? '广播已重新发布（上架）' : '广播已下架',
      broadcast: {
        ...updated,
        title: isCurrentlyOffline ? newTitle : broadcast.title,
        isOffline: !isCurrentlyOffline,
      },
    });
  } catch (error) {
    next(error);
  }
};
