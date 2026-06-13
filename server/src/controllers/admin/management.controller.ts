import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';

type IssueSeverity = 'critical' | 'warning' | 'info';
type ControlTone = 'good' | 'warn' | 'risk' | 'info';

type ManagementIssue = {
  severity: IssueSeverity;
  module: string;
  title: string;
  detail: string;
  route: string;
};

type ManagementAction = {
  id: string;
  severity: IssueSeverity;
  scope: string;
  title: string;
  detail: string;
  metric: string;
  cta: string;
  route: string;
};

type ManagementControlMetric = {
  key: string;
  label: string;
  score: number;
  tone: ControlTone;
  route: string;
  primary: string;
  secondary: string;
};

type ManagementWorkloadItem = {
  key: string;
  label: string;
  current: number;
  overdue: number;
  capacity: number;
  route: string;
  level: 'ok' | 'watch' | 'high';
};

type ManagementSlaItem = {
  key: string;
  label: string;
  current: number;
  overdue: number;
  dueSoon: number;
  targetHours: number;
  route: string;
  owner: string;
  status: 'healthy' | 'watch' | 'breached';
};

type ManagementQueueItem = {
  id: string;
  type: 'feedback' | 'audit' | 'team' | 'billing' | 'resource';
  severity: IssueSeverity;
  title: string;
  detail: string;
  owner: string;
  ageHours: number;
  route: string;
  createdAt: Date;
  dueAt?: Date | null;
  status: string;
};

type ManagementTrendPoint = {
  date: string;
  users: number;
  content: number;
  feedback: number;
  audit: number;
};

type ManagementPlaybook = {
  id: string;
  title: string;
  detail: string;
  route: string;
  cta: string;
  impact: string;
  severity: IssueSeverity;
};

type ManagementStats = {
  adminsWithoutMfa: number;
  neverLoggedInUsers: number;
  bannedUsers: number;
  teamsWithoutMembers: number;
  pendingTeamApplications: number;
  openFeedbacks: number;
  highPriorityFeedbacks: number;
  staleFeedbacks: number;
  pendingContentItems: number;
  staleAuditItems: number;
  coursesWithoutLessons: number;
  coursesWithoutThumbnail: number;
  roadmapsWithoutSteps: number;
  activeBanners: number;
  bannersWithoutImage: number;
  activePlans: number;
  mirrorErrors: number;
  syncingSources: number;
  staleSources: number;
  emptyManualStations: number;
};

const parseSettingList = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const percent = (value: number, total: number, fallback = 100) =>
  total > 0 ? clamp(round((value / total) * 100)) : fallback;

const getControlTone = (score: number): ControlTone => {
  if (score < 50) return 'risk';
  if (score < 75) return 'warn';
  return 'good';
};

const getWorkloadLevel = (current: number, overdue: number): ManagementWorkloadItem['level'] => {
  if (overdue > 0 || current >= 20) return 'high';
  if (current > 0) return 'watch';
  return 'ok';
};

const hoursBetween = (from: Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / (60 * 60 * 1000)));

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

const getDayKeys = (days: number, now: Date) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return formatDayKey(date);
  });

const countByDay = <T>(items: T[], getDate: (item: T) => Date) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const key = formatDayKey(getDate(item));
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const getSlaStatus = (overdue: number, dueSoon: number): ManagementSlaItem['status'] => {
  if (overdue > 0) return 'breached';
  if (dueSoon > 0) return 'watch';
  return 'healthy';
};

const buildIssues = (stats: ManagementStats): ManagementIssue[] => {
  const issues: ManagementIssue[] = [];

  if (stats.adminsWithoutMfa > 0) {
    issues.push({
      severity: 'critical',
      module: '用户管理',
      title: '管理员账号未开启 2FA',
      detail: `${stats.adminsWithoutMfa} 个管理员账号还没有双因素认证，建议优先处理。`,
      route: '/admin/users',
    });
  }

  if (stats.neverLoggedInUsers > 0) {
    issues.push({
      severity: 'info',
      module: '用户管理',
      title: '存在从未登录用户',
      detail: `${stats.neverLoggedInUsers} 个账号创建后还没有登录，可用于识别冷启动或无效邀请。`,
      route: '/admin/users',
    });
  }

  if (stats.bannedUsers > 0) {
    issues.push({
      severity: 'warning',
      module: '用户管理',
      title: '有封禁账号需要复核',
      detail: `${stats.bannedUsers} 个账号处于封禁状态，建议定期复核处理记录。`,
      route: '/admin/users',
    });
  }

  if (stats.teamsWithoutMembers > 0) {
    issues.push({
      severity: 'warning',
      module: '团队管理',
      title: '协作团队成员不足',
      detail: `${stats.teamsWithoutMembers} 个团队没有成员沉淀，适合补充负责人或归档。`,
      route: '/admin/teams',
    });
  }

  if (stats.pendingTeamApplications > 0) {
    issues.push({
      severity: 'info',
      module: '团队管理',
      title: '有待处理入队申请',
      detail: `${stats.pendingTeamApplications} 条团队申请等待处理。`,
      route: '/admin/teams',
    });
  }

  if (stats.highPriorityFeedbacks > 0) {
    issues.push({
      severity: 'critical',
      module: '用户反馈',
      title: '高优先级反馈待响应',
      detail: `${stats.highPriorityFeedbacks} 条高优先级反馈仍在打开或处理中。`,
      route: '/admin/feedback',
    });
  }

  if (stats.openFeedbacks > 0) {
    issues.push({
      severity: 'warning',
      module: '用户反馈',
      title: '反馈队列仍有待处理项',
      detail: `${stats.openFeedbacks} 条反馈尚未进入处理闭环。`,
      route: '/admin/feedback',
    });
  }

  if (stats.staleFeedbacks > 0) {
    issues.push({
      severity: 'warning',
      module: '用户反馈',
      title: '反馈响应超时',
      detail: `${stats.staleFeedbacks} 条反馈超过 72 小时未更新。`,
      route: '/admin/feedback',
    });
  }

  if (stats.pendingContentItems > 0) {
    issues.push({
      severity: 'warning',
      module: '内容审核',
      title: '审核队列仍有待处理内容',
      detail: `${stats.pendingContentItems} 条资产、材质、作品或插件等待审核。`,
      route: '/admin/audits',
    });
  }

  if (stats.staleAuditItems > 0) {
    issues.push({
      severity: 'critical',
      module: '内容审核',
      title: '审核队列存在积压',
      detail: `${stats.staleAuditItems} 条内容超过 48 小时未审核。`,
      route: '/admin/audits',
    });
  }

  if (stats.coursesWithoutLessons > 0) {
    issues.push({
      severity: 'warning',
      module: '教学管理',
      title: '有课程还没有课时',
      detail: `${stats.coursesWithoutLessons} 门课程缺少课时，发布前建议补齐学习内容。`,
      route: '/admin/courses',
    });
  }

  if (stats.coursesWithoutThumbnail > 0) {
    issues.push({
      severity: 'info',
      module: '教学管理',
      title: '课程封面不完整',
      detail: `${stats.coursesWithoutThumbnail} 门课程没有封面，会影响前台卡片质感。`,
      route: '/admin/courses',
    });
  }

  if (stats.roadmapsWithoutSteps > 0) {
    issues.push({
      severity: 'warning',
      module: '路线管理',
      title: '学习路线缺少阶段',
      detail: `${stats.roadmapsWithoutSteps} 条官方路线还没有阶段节点。`,
      route: '/admin/roadmaps',
    });
  }

  if (stats.activeBanners === 0) {
    issues.push({
      severity: 'critical',
      module: '运营管理',
      title: '首页没有可用轮播',
      detail: '至少保留 1 张启用的轮播图，避免首页运营位空缺。',
      route: '/admin/banners',
    });
  }

  if (stats.bannersWithoutImage > 0) {
    issues.push({
      severity: 'warning',
      module: '轮播管理',
      title: '轮播素材缺失',
      detail: `${stats.bannersWithoutImage} 张轮播缺少图片素材。`,
      route: '/admin/banners',
    });
  }

  if (stats.activePlans === 0) {
    issues.push({
      severity: 'critical',
      module: '订阅管理',
      title: '没有启用订阅套餐',
      detail: '订阅体系需要至少一个可分配的套餐计划。',
      route: '/admin/subscriptions',
    });
  }

  if (stats.mirrorErrors > 0) {
    issues.push({
      severity: 'critical',
      module: '镜像源管理',
      title: '镜像同步存在异常',
      detail: `${stats.mirrorErrors} 个镜像源处于异常状态，需要查看同步日志。`,
      route: '/admin/mirror',
    });
  }

  if (stats.syncingSources > 0) {
    issues.push({
      severity: 'info',
      module: '镜像源管理',
      title: '镜像源正在同步',
      detail: `${stats.syncingSources} 个镜像源正在同步，后台会持续更新进度。`,
      route: '/admin/mirror',
    });
  }

  if (stats.staleSources > 0) {
    issues.push({
      severity: 'warning',
      module: '镜像源管理',
      title: '镜像源同步过期',
      detail: `${stats.staleSources} 个镜像源超过同步间隔，建议触发增量同步。`,
      route: '/admin/mirror',
    });
  }

  if (stats.emptyManualStations > 0) {
    issues.push({
      severity: 'info',
      module: '资源站管理',
      title: '资源站还没有资源',
      detail: `${stats.emptyManualStations} 个资源站为空，适合先补分类与精品资源。`,
      route: '/admin/manual',
    });
  }

  return issues.slice(0, 12);
};

const buildActions = (stats: ManagementStats): ManagementAction[] => {
  const actions: ManagementAction[] = [];

  const addAction = (action: ManagementAction, condition: boolean) => {
    if (condition) actions.push(action);
  };

  addAction(
    {
      id: 'feedback-high-priority',
      severity: 'critical',
      scope: 'feedback',
      title: '高优反馈需要响应',
      detail: '优先处理高优先级和长时间未回复反馈，能直接改善用户信任。',
      metric: `${stats.highPriorityFeedbacks}`,
      cta: '处理反馈',
      route: '/admin/feedback',
    },
    stats.highPriorityFeedbacks > 0,
  );

  addAction(
    {
      id: 'audit-stale',
      severity: 'critical',
      scope: 'audits',
      title: '审核队列出现积压',
      detail: '存在超过 48 小时未审核的资产、材质、作品或插件。',
      metric: `${stats.staleAuditItems}`,
      cta: '打开审核',
      route: '/admin/audits',
    },
    stats.staleAuditItems > 0,
  );

  addAction(
    {
      id: 'users-admin-mfa',
      severity: 'critical',
      scope: 'users',
      title: '管理员 2FA 未覆盖',
      detail: '管理员账号缺少双因素认证会扩大后台风险面。',
      metric: `${stats.adminsWithoutMfa}`,
      cta: '查看账号',
      route: '/admin/users',
    },
    stats.adminsWithoutMfa > 0,
  );

  addAction(
    {
      id: 'mirror-errors',
      severity: 'critical',
      scope: 'mirror',
      title: '镜像源同步异常',
      detail: '异常镜像源会影响资源更新和前台可用性。',
      metric: `${stats.mirrorErrors}`,
      cta: '排查镜像',
      route: '/admin/mirror',
    },
    stats.mirrorErrors > 0,
  );

  addAction(
    {
      id: 'banners-empty',
      severity: 'critical',
      scope: 'banners',
      title: '首页缺少可用轮播',
      detail: '至少保留一个启用轮播位，避免运营入口空缺。',
      metric: '0',
      cta: '配置轮播',
      route: '/admin/banners',
    },
    stats.activeBanners === 0,
  );

  addAction(
    {
      id: 'subscriptions-empty',
      severity: 'critical',
      scope: 'subscriptions',
      title: '订阅套餐未配置',
      detail: '商业权限体系需要至少一个可分配的订阅计划。',
      metric: '0',
      cta: '配置套餐',
      route: '/admin/subscriptions',
    },
    stats.activePlans === 0,
  );

  addAction(
    {
      id: 'courses-without-lessons',
      severity: 'warning',
      scope: 'courses',
      title: '课程缺少课时',
      detail: '空课程不适合发布，建议补齐课时或转为草稿。',
      metric: `${stats.coursesWithoutLessons}`,
      cta: '完善课程',
      route: '/admin/courses',
    },
    stats.coursesWithoutLessons > 0,
  );

  addAction(
    {
      id: 'roadmaps-without-steps',
      severity: 'warning',
      scope: 'roadmaps',
      title: '学习路线缺少阶段',
      detail: '路线没有阶段会降低学习引导效果。',
      metric: `${stats.roadmapsWithoutSteps}`,
      cta: '补齐路线',
      route: '/admin/roadmaps',
    },
    stats.roadmapsWithoutSteps > 0,
  );

  addAction(
    {
      id: 'mirror-stale',
      severity: 'warning',
      scope: 'mirror',
      title: '镜像源同步过期',
      detail: '部分启用镜像源已经超过预期同步间隔。',
      metric: `${stats.staleSources}`,
      cta: '查看同步',
      route: '/admin/mirror',
    },
    stats.staleSources > 0,
  );

  addAction(
    {
      id: 'manual-empty-stations',
      severity: 'info',
      scope: 'manual',
      title: '资源站还没有内容',
      detail: '空资源站适合先补分类和首批精品资源。',
      metric: `${stats.emptyManualStations}`,
      cta: '维护资源站',
      route: '/admin/manual',
    },
    stats.emptyManualStations > 0,
  );

  addAction(
    {
      id: 'teams-pending-applications',
      severity: 'info',
      scope: 'teams',
      title: '入队申请待处理',
      detail: '及时处理团队申请能让协作空间保持流动。',
      metric: `${stats.pendingTeamApplications}`,
      cta: '处理申请',
      route: '/admin/teams',
    },
    stats.pendingTeamApplications > 0,
  );

  return actions.slice(0, 8);
};

export const getManagementInsights = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleFeedbackAt = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const staleAuditAt = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const feedbackDueSoonAt = new Date(now.getTime() - 60 * 60 * 60 * 1000);
    const auditDueSoonAt = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const teamSlaAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const teamDueSoonAt = new Date(now.getTime() - 18 * 60 * 60 * 1000);
    const trendStart = new Date(now);
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - 13);

    const [
      totalCourses,
      publishedCourses,
      draftCourses,
      coursesWithoutLessons,
      coursesWithoutCategory,
      coursesWithoutThumbnail,
      totalLessons,
      totalEnrollments,
      coursesForRanking,
      totalRoadmaps,
      roadmapsWithoutSteps,
      totalRoadmapSteps,
      recentRoadmaps,
      courseCategories,
      assetCategories,
      categorySettings,
      totalBanners,
      activeBanners,
      inactiveBanners,
      bannersWithoutImage,
      recentBanners,
      plans,
      subscriptions,
      expiringSubscriptions,
      activeCodes,
      usedCodes,
      expiredCodes,
      mirrorSources,
      totalMirrorResources,
      totalMirrorCategories,
      recentFailedSyncLogs,
      manualStations,
      totalManualResources,
      totalManualCategories,
      recentManualResources,
    ] = await Promise.all([
      prisma.course.count(),
      prisma.course.count({ where: { status: 'PUBLISHED' } }),
      prisma.course.count({ where: { status: 'DRAFT' } }),
      prisma.course.count({ where: { lessons: { none: {} } } }),
      prisma.course.count({ where: { categoryId: null } }),
      prisma.course.count({ where: { OR: [{ thumbnail: null }, { thumbnail: '' }] } }),
      prisma.lesson.count(),
      prisma.enrollment.count(),
      prisma.course.findMany({
        take: 200,
        include: { _count: { select: { enrollments: true, lessons: true, reviews: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.roadmap.count({ where: { creatorId: null } }),
      prisma.roadmap.count({ where: { creatorId: null, steps: { none: {} } } }),
      prisma.roadmapStep.count({ where: { roadmap: { creatorId: null } } }),
      prisma.roadmap.findMany({
        where: { creatorId: null },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, updatedAt: true, _count: { select: { steps: true } } },
      }),
      prisma.courseCategory.findMany({ include: { _count: { select: { courses: true } } } }),
      prisma.category.findMany({ include: { _count: { select: { assets: true } } } }),
      prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'MATERIAL_CATEGORIES',
              'SHOWCASE_CATEGORIES',
              'MAINTENANCE_MODE',
              'ALLOW_REGISTRATION',
              'AI_IMPORT_ENABLED',
              'SYSTEM_EMAIL_PROVIDER',
              'SMTP_HOST',
            ],
          },
        },
      }),
      prisma.banner.count(),
      prisma.banner.count({ where: { isActive: true } }),
      prisma.banner.count({ where: { isActive: false } }),
      prisma.banner.count({ where: { OR: [{ imageUrl: '' }] } }),
      prisma.banner.findMany({
        take: 5,
        orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
        select: { id: true, title: true, route: true, isActive: true, updatedAt: true },
      }),
      prisma.subscriptionPlan.findMany({
        include: { _count: { select: { subscriptions: true, activationCodes: true } } },
        orderBy: { priority: 'asc' },
      }),
      prisma.subscription.findMany({
        include: { plan: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.subscription.count({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: soon } },
      }),
      prisma.activationCode.count({ where: { status: 'ACTIVE' } }),
      prisma.activationCode.count({ where: { status: 'USED' } }),
      prisma.activationCode.count({ where: { status: 'EXPIRED' } }),
      prisma.mirrorSource.findMany({
        include: { _count: { select: { resources: true, categories: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.mirrorResource.count(),
      prisma.mirrorCategory.count(),
      prisma.syncLog.findMany({
        where: { status: { in: ['ERROR', 'FAILED'] } },
        take: 6,
        orderBy: { startedAt: 'desc' },
        include: { source: { select: { id: true, displayName: true } } },
      }),
      prisma.manualStation.findMany({
        include: { _count: { select: { resources: true, categories: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.manualResource.count(),
      prisma.manualCategory.count(),
      prisma.manualResource.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: { station: { select: { id: true, displayName: true } } },
      }),
    ]);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      adminUsers,
      instructorUsers,
      verifiedUsers,
      mfaUsers,
      adminsWithoutMfa,
      recentUsers,
      recentLoginUsers,
      loggedInUsers,
      activeSessionGroups,
      trustedDeviceGroups,
      totalTeams,
      publicTeams,
      privateTeams,
      personalTeams,
      totalTeamMembers,
      pendingTeamApplications,
      pendingTeamInvitations,
      teamsForHealth,
      recentTeams,
      totalFeedbacks,
      openFeedbacks,
      inProgressFeedbacks,
      resolvedFeedbacks,
      closedFeedbacks,
      highPriorityFeedbacks,
      feedbackWithoutReply,
      staleFeedbacks,
      recentOpenFeedbacks,
      pendingAssets,
      approvedAssets,
      rejectedAssets,
      pendingMaterials,
      approvedMaterials,
      rejectedMaterials,
      pendingShowcases,
      approvedShowcases,
      rejectedShowcases,
      pendingPlugins,
      approvedPlugins,
      rejectedPlugins,
      staleAssets,
      staleMaterials,
      staleShowcases,
      stalePlugins,
      recentPendingAssets,
      recentPendingMaterials,
      recentPendingShowcases,
      recentPendingPlugins,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'INSTRUCTOR' } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { twoFactorEnabled: true } }),
      prisma.user.count({ where: { role: 'ADMIN', twoFactorEnabled: false } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          action: 'LOGIN',
          createdAt: { gte: weekAgo },
          userId: { not: null },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: 'LOGIN',
          userId: { not: null },
        },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { expiresAt: { gt: now } },
        _count: { _all: true },
      }),
      prisma.trustedDevice.groupBy({
        by: ['userId'],
        _count: { _all: true },
      }),
      prisma.team.count(),
      prisma.team.count({ where: { visibility: 'PUBLIC' } }),
      prisma.team.count({ where: { visibility: 'PRIVATE' } }),
      prisma.team.count({ where: { type: 'PERSONAL' } }),
      prisma.teamMember.count(),
      prisma.teamApplication.count({ where: { status: 'PENDING' } }),
      prisma.teamInvitation.count({ where: { status: 'PENDING', expiresAt: { gt: now } } }),
      prisma.team.findMany({
        select: {
          id: true,
          type: true,
          _count: {
            select: {
              members: true,
              assets: true,
              projects: true,
              tasks: true,
              materials: true,
              showcases: true,
            },
          },
        },
      }),
      prisma.team.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          visibility: true,
          category: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, assets: true, projects: true, tasks: true } },
        },
      }),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
      prisma.feedback.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { status: 'RESOLVED' } }),
      prisma.feedback.count({ where: { status: 'CLOSED' } }),
      prisma.feedback.count({
        where: { priority: 'HIGH', status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.feedback.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          OR: [{ adminReply: null }, { adminReply: '' }],
        },
      }),
      prisma.feedback.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          updatedAt: { lt: staleFeedbackAt },
        },
      }),
      prisma.feedback.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        take: 5,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        select: {
          id: true,
          title: true,
          priority: true,
          status: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.asset.count({ where: { status: 'PENDING' } }),
      prisma.asset.count({ where: { status: 'APPROVED' } }),
      prisma.asset.count({ where: { status: 'REJECTED' } }),
      prisma.material.count({ where: { status: 'PENDING' } }),
      prisma.material.count({ where: { status: 'APPROVED' } }),
      prisma.material.count({ where: { status: 'REJECTED' } }),
      prisma.showcase.count({ where: { status: 'PENDING' } }),
      prisma.showcase.count({ where: { status: 'APPROVED' } }),
      prisma.showcase.count({ where: { status: 'REJECTED' } }),
      prisma.plugin.count({ where: { status: 'PENDING' } }),
      prisma.plugin.count({ where: { status: 'APPROVED' } }),
      prisma.plugin.count({ where: { status: 'REJECTED' } }),
      prisma.asset.count({ where: { status: 'PENDING', createdAt: { lt: staleAuditAt } } }),
      prisma.material.count({ where: { status: 'PENDING', createdAt: { lt: staleAuditAt } } }),
      prisma.showcase.count({ where: { status: 'PENDING', createdAt: { lt: staleAuditAt } } }),
      prisma.plugin.count({ where: { status: 'PENDING', createdAt: { lt: staleAuditAt } } }),
      prisma.asset.findMany({
        where: { status: 'PENDING' },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.material.findMany({
        where: { status: 'PENDING' },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.showcase.findMany({
        where: { status: 'PENDING' },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.plugin.findMany({
        where: { status: 'PENDING' },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const [
      feedbackDueSoon,
      auditDueSoonAssets,
      auditDueSoonMaterials,
      auditDueSoonShowcases,
      auditDueSoonPlugins,
      staleTeamApplications,
      teamDueSoonApplications,
      pendingTeamApplicationItems,
      expiringSubscriptionItems,
      failedTransactionItems,
      failedTransactionCount,
      trendUsers,
      trendAssets,
      trendMaterials,
      trendShowcases,
      trendPlugins,
      trendFeedbacks,
      trendAuditLogs,
      recentHighRiskAuditLogs,
    ] = await Promise.all([
      prisma.feedback.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          updatedAt: { gte: staleFeedbackAt, lte: feedbackDueSoonAt },
        },
      }),
      prisma.asset.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: staleAuditAt, lte: auditDueSoonAt },
        },
      }),
      prisma.material.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: staleAuditAt, lte: auditDueSoonAt },
        },
      }),
      prisma.showcase.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: staleAuditAt, lte: auditDueSoonAt },
        },
      }),
      prisma.plugin.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: staleAuditAt, lte: auditDueSoonAt },
        },
      }),
      prisma.teamApplication.count({
        where: { status: 'PENDING', createdAt: { lt: teamSlaAt } },
      }),
      prisma.teamApplication.count({
        where: { status: 'PENDING', createdAt: { gte: teamSlaAt, lte: teamDueSoonAt } },
      }),
      prisma.teamApplication.findMany({
        where: { status: 'PENDING' },
        take: 6,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          message: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: soon } },
        take: 6,
        orderBy: { endDate: 'asc' },
        include: {
          plan: { select: { id: true, name: true, displayName: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { status: 'FAILED' },
        take: 6,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.user.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.asset.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.material.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.showcase.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.plugin.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.feedback.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true, action: true, module: true },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { action: { contains: 'DELETE' } },
            { action: { contains: 'REJECT' } },
            { action: { contains: 'RESET_PASSWORD' } },
            { action: { contains: 'REVOKE' } },
            { action: { contains: 'CLEANUP' } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const settingMap = new Map(categorySettings.map((item) => [item.key, item.value]));
    const materialCategories = parseSettingList(settingMap.get('MATERIAL_CATEGORIES'));
    const showcaseCategories = parseSettingList(settingMap.get('SHOWCASE_CATEGORIES'));

    const activeSubscriptions = subscriptions.filter((item) => item.status === 'ACTIVE');
    const cancelAtPeriodEnd = activeSubscriptions.filter((item) => item.cancelAtPeriodEnd).length;
    const monthlyRecurring = activeSubscriptions.filter(
      (item) => item.interval === 'MONTHLY',
    ).length;
    const yearlyRecurring = activeSubscriptions.filter((item) => item.interval === 'YEARLY').length;
    const estimatedMonthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
      const monthlyPrice =
        sub.interval === 'YEARLY'
          ? (sub.plan.yearlyPrice || sub.plan.price * 12) / 12
          : sub.plan.price;
      return sum + monthlyPrice;
    }, 0);

    const topCourses = coursesForRanking
      .sort((a, b) => b._count.enrollments - a._count.enrollments)
      .slice(0, 5)
      .map((course) => ({
        id: course.id,
        title: course.title,
        status: course.status,
        enrollments: course._count.enrollments,
        lessons: course._count.lessons,
        reviews: course._count.reviews,
      }));

    const activeMirrorSources = mirrorSources.filter((source) => source.status === 'ACTIVE');
    const mirrorErrors = mirrorSources.filter(
      (source) => source.status === 'ERROR' || source.syncStatus === 'ERROR',
    ).length;
    const syncingSources = mirrorSources.filter((source) => source.syncStatus === 'SYNCING').length;
    const staleSources = activeMirrorSources.filter((source) => {
      if (!source.lastSyncAt) return true;
      return now.getTime() - source.lastSyncAt.getTime() > source.syncInterval * 2 * 1000;
    }).length;

    const activeManualStations = manualStations.filter(
      (station) => station.status === 'ACTIVE',
    ).length;
    const disabledManualStations = manualStations.filter(
      (station) => station.status === 'DISABLED',
    ).length;
    const emptyManualStations = manualStations.filter(
      (station) => station._count.resources === 0,
    ).length;
    const lockedManualStations = manualStations.filter(
      (station) => station.minPlanPriority > 0,
    ).length;
    const activeSessionUsers = activeSessionGroups.length;
    const activeSessions = activeSessionGroups.reduce((sum, group) => sum + group._count._all, 0);
    const trustedDevices = trustedDeviceGroups.reduce((sum, group) => sum + group._count._all, 0);
    const neverLoggedInUsers = Math.max(
      0,
      totalUsers - loggedInUsers.filter((item) => item.userId).length,
    );
    const collaborationTeams = teamsForHealth.filter((team) => team.type !== 'PERSONAL');
    const teamsWithoutMembers = collaborationTeams.filter(
      (team) => team._count.members === 0,
    ).length;
    const teamsWithoutAssets = collaborationTeams.filter(
      (team) =>
        team._count.assets +
          team._count.materials +
          team._count.showcases +
          team._count.projects ===
        0,
    ).length;
    const totalTeamAssets = teamsForHealth.reduce(
      (sum, team) => sum + team._count.assets + team._count.materials + team._count.showcases,
      0,
    );
    const totalTeamProjects = teamsForHealth.reduce((sum, team) => sum + team._count.projects, 0);
    const totalTeamTasks = teamsForHealth.reduce((sum, team) => sum + team._count.tasks, 0);
    const totalPendingContent =
      pendingAssets + pendingMaterials + pendingShowcases + pendingPlugins;
    const totalApprovedContent =
      approvedAssets + approvedMaterials + approvedShowcases + approvedPlugins;
    const totalRejectedContent =
      rejectedAssets + rejectedMaterials + rejectedShowcases + rejectedPlugins;
    const staleAuditItems = staleAssets + staleMaterials + staleShowcases + stalePlugins;
    const recentPendingContent = [
      ...recentPendingAssets.map((item) => ({
        id: item.id,
        title: item.title,
        kind: '资产',
        channel: item.type || '3D',
        route: '/admin/audits?tab=assets',
        createdAt: item.createdAt,
        user: item.user,
      })),
      ...recentPendingMaterials.map((item) => ({
        id: item.id,
        title: item.title,
        kind: '材质',
        channel: item.category || 'Material',
        route: '/admin/audits?tab=materials',
        createdAt: item.createdAt,
        user: item.user,
      })),
      ...recentPendingShowcases.map((item) => ({
        id: item.id,
        title: item.title,
        kind: '作品',
        channel: item.type || 'Showcase',
        route: '/admin/audits?tab=showcases',
        createdAt: item.createdAt,
        user: item.user,
      })),
      ...recentPendingPlugins.map((item) => ({
        id: item.id,
        title: item.title,
        kind: '插件',
        channel: item.category || 'Plugin',
        route: '/admin/audits?tab=plugins',
        createdAt: item.createdAt,
        user: item.user,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);

    const auditDueSoon =
      auditDueSoonAssets + auditDueSoonMaterials + auditDueSoonShowcases + auditDueSoonPlugins;
    const ownerName = (user?: { name?: string | null; email?: string | null } | null) =>
      user?.name || user?.email || '未分配';
    const severityWeight: Record<IssueSeverity, number> = { critical: 3, warning: 2, info: 1 };

    const queueItems: ManagementQueueItem[] = [
      ...recentOpenFeedbacks.map((feedback): ManagementQueueItem => {
        const dueAt = addHours(feedback.updatedAt, 72);
        const severity: IssueSeverity = feedback.priority === 'HIGH' ? 'critical' : 'warning';
        return {
          id: feedback.id,
          type: 'feedback' as const,
          severity,
          title: feedback.title,
          detail: `${feedback.type} / ${feedback.status}`,
          owner: ownerName(feedback.user),
          ageHours: hoursBetween(feedback.updatedAt, now),
          route: '/admin/feedback',
          createdAt: feedback.createdAt,
          dueAt,
          status: feedback.priority,
        };
      }),
      ...recentPendingContent.map(
        (item): ManagementQueueItem => ({
          id: item.id,
          type: 'audit' as const,
          severity: (item.createdAt < staleAuditAt ? 'critical' : 'warning') as IssueSeverity,
          title: item.title,
          detail: `${item.kind} / ${item.channel}`,
          owner: ownerName(item.user),
          ageHours: hoursBetween(item.createdAt, now),
          route: item.route,
          createdAt: item.createdAt,
          dueAt: addHours(item.createdAt, 48),
          status: 'PENDING',
        }),
      ),
      ...pendingTeamApplicationItems.map(
        (item): ManagementQueueItem => ({
          id: item.id,
          type: 'team' as const,
          severity: (item.createdAt < teamSlaAt ? 'warning' : 'info') as IssueSeverity,
          title: `加入 ${item.team.name}`,
          detail: item.message || '入队申请等待审核',
          owner: ownerName(item.user),
          ageHours: hoursBetween(item.createdAt, now),
          route: '/admin/teams',
          createdAt: item.createdAt,
          dueAt: addHours(item.createdAt, 24),
          status: 'PENDING',
        }),
      ),
      ...expiringSubscriptionItems.map(
        (item): ManagementQueueItem => ({
          id: item.id,
          type: 'billing' as const,
          severity: (item.cancelAtPeriodEnd ? 'warning' : 'info') as IssueSeverity,
          title: `${ownerName(item.user)} 的订阅即将到期`,
          detail: `${item.plan.displayName || item.plan.name} / ${item.interval}`,
          owner: ownerName(item.user),
          ageHours: item.endDate ? hoursBetween(now, item.endDate) : 0,
          route: '/admin/subscriptions',
          createdAt: item.updatedAt,
          dueAt: item.endDate,
          status: item.cancelAtPeriodEnd ? 'CANCEL_AT_PERIOD_END' : item.status,
        }),
      ),
      ...failedTransactionItems.map(
        (item): ManagementQueueItem => ({
          id: item.id,
          type: 'billing' as const,
          severity: 'warning' as const,
          title: `支付失败 ${item.invoiceNo || item.paymentId || item.id.slice(0, 8)}`,
          detail: `${item.amount} ${item.currency} / ${item.paymentMethod || '未知渠道'}`,
          owner: ownerName(item.user),
          ageHours: hoursBetween(item.updatedAt, now),
          route: '/admin/subscriptions',
          createdAt: item.updatedAt,
          dueAt: null,
          status: item.status,
        }),
      ),
      ...recentFailedSyncLogs.map(
        (log): ManagementQueueItem => ({
          id: log.id,
          type: 'resource' as const,
          severity: 'critical' as const,
          title: `${log.source.displayName} 同步异常`,
          detail: log.error || `${log.type} / ${log.status}`,
          owner: '资源运维',
          ageHours: hoursBetween(log.startedAt, now),
          route: '/admin/mirror',
          createdAt: log.startedAt,
          dueAt: null,
          status: log.status,
        }),
      ),
      ...recentHighRiskAuditLogs.map(
        (log): ManagementQueueItem => ({
          id: log.id,
          type: 'resource' as const,
          severity: 'info' as const,
          title: log.description || log.action,
          detail: `${log.module} / ${log.action}`,
          owner: ownerName(log.user),
          ageHours: hoursBetween(log.createdAt, now),
          route: '/admin/audit-logs',
          createdAt: log.createdAt,
          dueAt: null,
          status: log.action,
        }),
      ),
    ]
      .sort((a, b) => {
        const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.ageHours - a.ageHours;
      })
      .slice(0, 18);

    const userTrendByDay = countByDay(trendUsers, (item) => item.createdAt);
    const contentTrendByDay = countByDay(
      [...trendAssets, ...trendMaterials, ...trendShowcases, ...trendPlugins],
      (item) => item.createdAt,
    );
    const feedbackTrendByDay = countByDay(trendFeedbacks, (item) => item.createdAt);
    const auditTrendByDay = countByDay(trendAuditLogs, (item) => item.createdAt);
    const trend: ManagementTrendPoint[] = getDayKeys(14, now).map((date) => ({
      date,
      users: userTrendByDay[date] || 0,
      content: contentTrendByDay[date] || 0,
      feedback: feedbackTrendByDay[date] || 0,
      audit: auditTrendByDay[date] || 0,
    }));

    const managementStats: ManagementStats = {
      adminsWithoutMfa,
      neverLoggedInUsers,
      bannedUsers,
      teamsWithoutMembers,
      pendingTeamApplications,
      openFeedbacks,
      highPriorityFeedbacks,
      staleFeedbacks,
      pendingContentItems: totalPendingContent,
      staleAuditItems,
      coursesWithoutLessons,
      coursesWithoutThumbnail,
      roadmapsWithoutSteps,
      activeBanners,
      bannersWithoutImage,
      activePlans: plans.length,
      mirrorErrors,
      syncingSources,
      staleSources,
      emptyManualStations,
    };

    const issues = buildIssues(managementStats);
    const actions = buildActions(managementStats);
    const healthScore = Math.max(
      48,
      100 -
        issues.reduce((score, issue) => {
          if (issue.severity === 'critical') return score + 14;
          if (issue.severity === 'warning') return score + 8;
          return score + 3;
        }, 0),
    );

    const adminMfaCoverage = percent(adminUsers - adminsWithoutMfa, adminUsers);
    const verifiedRate = percent(verifiedUsers, totalUsers);
    const feedbackClosureRate = percent(resolvedFeedbacks + closedFeedbacks, totalFeedbacks);
    const moderationClearance = percent(
      totalApprovedContent + totalRejectedContent,
      totalApprovedContent + totalRejectedContent + totalPendingContent,
    );
    const courseContentScore = totalCourses
      ? clamp(
          round(
            ((totalCourses - coursesWithoutLessons) / totalCourses) * 65 +
              ((totalCourses - coursesWithoutThumbnail) / totalCourses) * 35,
          ),
        )
      : 100;
    const businessReadiness = clamp(
      (activeBanners > 0 ? 32 : 0) +
        (plans.length > 0 ? 30 : 0) +
        (activeSubscriptions.length > 0 ? 24 : 0) +
        (expiringSubscriptions === 0 ? 14 : 7),
    );
    const resourceFreshness = percent(
      Math.max(0, activeMirrorSources.length - mirrorErrors - staleSources),
      activeMirrorSources.length,
    );

    const workload: ManagementWorkloadItem[] = [
      {
        key: 'feedback',
        label: '反馈响应',
        current: openFeedbacks + inProgressFeedbacks,
        overdue: staleFeedbacks,
        capacity: 20,
        route: '/admin/feedback',
        level: getWorkloadLevel(openFeedbacks + inProgressFeedbacks, staleFeedbacks),
      },
      {
        key: 'audits',
        label: '内容审核',
        current: totalPendingContent,
        overdue: staleAuditItems,
        capacity: 30,
        route: '/admin/audits',
        level: getWorkloadLevel(totalPendingContent, staleAuditItems),
      },
      {
        key: 'teams',
        label: '团队准入',
        current: pendingTeamApplications + pendingTeamInvitations,
        overdue: 0,
        capacity: 16,
        route: '/admin/teams',
        level: getWorkloadLevel(pendingTeamApplications + pendingTeamInvitations, 0),
      },
      {
        key: 'resources',
        label: '资源同步',
        current: mirrorErrors + staleSources + emptyManualStations,
        overdue: mirrorErrors,
        capacity: 16,
        route: mirrorErrors + staleSources > 0 ? '/admin/mirror' : '/admin/manual',
        level: getWorkloadLevel(mirrorErrors + staleSources + emptyManualStations, mirrorErrors),
      },
    ];

    const controlMetrics: ManagementControlMetric[] = [
      {
        key: 'security',
        label: '后台安全',
        score: round(adminMfaCoverage * 0.68 + verifiedRate * 0.32),
        tone: getControlTone(round(adminMfaCoverage * 0.68 + verifiedRate * 0.32)),
        route: '/admin/users',
        primary: `${adminMfaCoverage}% 管理员 2FA`,
        secondary: `${verifiedRate}% 邮箱验证`,
      },
      {
        key: 'moderation',
        label: '审核流转',
        score: moderationClearance,
        tone: staleAuditItems > 0 ? 'risk' : getControlTone(moderationClearance),
        route: '/admin/audits',
        primary: `${totalPendingContent} 待审核`,
        secondary: `${staleAuditItems} 条积压`,
      },
      {
        key: 'feedback',
        label: '服务闭环',
        score: feedbackClosureRate,
        tone: staleFeedbacks > 0 ? 'risk' : getControlTone(feedbackClosureRate),
        route: '/admin/feedback',
        primary: `${openFeedbacks + inProgressFeedbacks} 待响应`,
        secondary: `${feedbackClosureRate}% 闭环率`,
      },
      {
        key: 'teaching',
        label: '教学准备',
        score: courseContentScore,
        tone: getControlTone(courseContentScore),
        route: '/admin/courses',
        primary: `${publishedCourses} 已发布`,
        secondary: `${coursesWithoutLessons + coursesWithoutThumbnail} 项待完善`,
      },
      {
        key: 'business',
        label: '商业可用',
        score: businessReadiness,
        tone: getControlTone(businessReadiness),
        route: '/admin/subscriptions',
        primary: `${activeSubscriptions.length} 活跃订阅`,
        secondary: `${plans.length} 个套餐`,
      },
      {
        key: 'resources',
        label: '资源供给',
        score: resourceFreshness,
        tone: mirrorErrors > 0 ? 'risk' : getControlTone(resourceFreshness),
        route: mirrorErrors > 0 || staleSources > 0 ? '/admin/mirror' : '/admin/manual',
        primary: `${totalMirrorResources + totalManualResources} 个资源`,
        secondary: `${mirrorErrors + staleSources} 个同步异常`,
      },
    ];

    const sla: ManagementSlaItem[] = [
      {
        key: 'feedback',
        label: '反馈首次响应',
        current: openFeedbacks + inProgressFeedbacks,
        overdue: staleFeedbacks,
        dueSoon: feedbackDueSoon,
        targetHours: 72,
        route: '/admin/feedback',
        owner: '客服运营',
        status: getSlaStatus(staleFeedbacks, feedbackDueSoon),
      },
      {
        key: 'audit',
        label: '内容审核时效',
        current: totalPendingContent,
        overdue: staleAuditItems,
        dueSoon: auditDueSoon,
        targetHours: 48,
        route: '/admin/audits',
        owner: '内容审核',
        status: getSlaStatus(staleAuditItems, auditDueSoon),
      },
      {
        key: 'team',
        label: '团队准入处理',
        current: pendingTeamApplications,
        overdue: staleTeamApplications,
        dueSoon: teamDueSoonApplications,
        targetHours: 24,
        route: '/admin/teams',
        owner: '社区运营',
        status: getSlaStatus(staleTeamApplications, teamDueSoonApplications),
      },
      {
        key: 'billing',
        label: '订阅风险跟进',
        current: expiringSubscriptions + failedTransactionCount,
        overdue: failedTransactionCount,
        dueSoon: expiringSubscriptions,
        targetHours: 24,
        route: '/admin/subscriptions',
        owner: '商业运营',
        status: getSlaStatus(failedTransactionCount, expiringSubscriptions),
      },
      {
        key: 'resources',
        label: '资源同步恢复',
        current: mirrorErrors + staleSources + syncingSources,
        overdue: mirrorErrors,
        dueSoon: staleSources,
        targetHours: 12,
        route: mirrorErrors + staleSources > 0 ? '/admin/mirror' : '/admin/manual',
        owner: '资源运维',
        status: getSlaStatus(mirrorErrors, staleSources),
      },
    ];

    const settingBoolean = (key: string, fallback: boolean) => {
      const raw = settingMap.get(key);
      if (raw === undefined || raw === null || raw === '') return fallback;
      return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase());
    };

    const maintenanceMode = settingBoolean('MAINTENANCE_MODE', false);
    const registrationEnabled = settingBoolean('ALLOW_REGISTRATION', true);
    const aiImportEnabled = settingBoolean('AI_IMPORT_ENABLED', false);
    const systemEmailProvider = settingMap.get('SYSTEM_EMAIL_PROVIDER') || 'SMTP';
    const hasSmtpHost = Boolean(settingMap.get('SMTP_HOST'));

    const systemSignals = [
      {
        key: 'maintenance',
        label: '维护模式',
        value: maintenanceMode ? '已开启' : '关闭',
        status: maintenanceMode ? 'watch' : 'healthy',
        route: '/admin/settings',
      },
      {
        key: 'registration',
        label: '开放注册',
        value: registrationEnabled ? '允许' : '关闭',
        status: registrationEnabled ? 'healthy' : 'watch',
        route: '/admin/settings',
      },
      {
        key: 'email',
        label: '系统邮件',
        value: systemEmailProvider,
        status: hasSmtpHost || systemEmailProvider === 'MICROSOFT_POOL' ? 'healthy' : 'breached',
        route: '/admin/settings',
      },
      {
        key: 'ai',
        label: 'AI 导入',
        value: aiImportEnabled ? '启用' : '未启用',
        status: aiImportEnabled ? 'healthy' : 'watch',
        route: '/admin/settings',
      },
    ];

    const dailyReviewPlaybook: ManagementPlaybook = {
      id: 'daily-command-review',
      title: '完成今日运营巡检',
      detail: '按 SLA 队列、风险信号、趋势异常和最近高风险操作完成一次后台巡检。',
      route: '/admin/command-center',
      cta: '查看指挥中心',
      impact: '形成固定管理闭环',
      severity: 'info',
    };
    const playbooks: ManagementPlaybook[] = [
      ...actions.map(
        (action): ManagementPlaybook => ({
          id: action.id,
          title: action.title,
          detail: action.detail,
          route: action.route,
          cta: action.cta,
          impact:
            action.severity === 'critical'
              ? '降低高风险积压'
              : action.severity === 'warning'
                ? '恢复运营节奏'
                : '提升后台秩序',
          severity: action.severity,
        }),
      ),
      dailyReviewPlaybook,
    ].slice(0, 8);

    res.json({
      generatedAt: now.toISOString(),
      overview: {
        healthScore,
        issueCount: issues.length,
        totalTeachingItems: totalCourses + totalRoadmaps + totalLessons,
        totalOperationItems:
          totalBanners +
          plans.length +
          subscriptions.length +
          totalMirrorResources +
          totalManualResources +
          totalUsers +
          totalTeams +
          totalFeedbacks +
          totalPendingContent,
        activeEntitlements: activeSubscriptions.length,
      },
      command: {
        securityCoverage: adminMfaCoverage,
        verifiedRate,
        moderationClearance,
        feedbackClosureRate,
        contentReadiness: courseContentScore,
        businessReadiness,
        resourceFreshness,
        workloadTotal: workload.reduce((sum, item) => sum + item.current, 0),
        controlMetrics,
        workload,
      },
      commandCenter: {
        sla,
        queue: queueItems,
        trend,
        playbooks,
        systemSignals,
        riskMix: {
          critical: queueItems.filter((item) => item.severity === 'critical').length,
          warning: queueItems.filter((item) => item.severity === 'warning').length,
          info: queueItems.filter((item) => item.severity === 'info').length,
        },
        nextReviewAt: addHours(now, 6).toISOString(),
      },
      accounts: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          admins: adminUsers,
          instructors: instructorUsers,
          emailVerified: verifiedUsers,
          mfaEnabled: mfaUsers,
          adminsWithoutMfa,
          newLast7d: recentUsers.filter((user) => user.createdAt >= weekAgo).length,
          recentLoginUsers: recentLoginUsers.filter((item) => item.userId).length,
          neverLoggedIn: neverLoggedInUsers,
          activeSessionUsers,
          activeSessions,
          trustedDevices,
          recent: recentUsers,
        },
        teams: {
          total: totalTeams,
          public: publicTeams,
          private: privateTeams,
          personal: personalTeams,
          collaboration: Math.max(0, totalTeams - personalTeams),
          totalMembers: totalTeamMembers,
          pendingApplications: pendingTeamApplications,
          pendingInvitations: pendingTeamInvitations,
          withoutMembers: teamsWithoutMembers,
          withoutAssets: teamsWithoutAssets,
          totalAssets: totalTeamAssets,
          totalProjects: totalTeamProjects,
          totalTasks: totalTeamTasks,
          recent: recentTeams,
        },
        feedback: {
          total: totalFeedbacks,
          open: openFeedbacks,
          inProgress: inProgressFeedbacks,
          resolved: resolvedFeedbacks,
          closed: closedFeedbacks,
          highPriorityOpen: highPriorityFeedbacks,
          withoutReply: feedbackWithoutReply,
          stale: staleFeedbacks,
          recentOpen: recentOpenFeedbacks,
        },
      },
      teaching: {
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: draftCourses,
          withoutLessons: coursesWithoutLessons,
          withoutCategory: coursesWithoutCategory,
          withoutThumbnail: coursesWithoutThumbnail,
          totalLessons,
          totalEnrollments,
          avgLessonsPerCourse: totalCourses ? round(totalLessons / totalCourses) : 0,
          topCourses,
        },
        roadmaps: {
          total: totalRoadmaps,
          totalSteps: totalRoadmapSteps,
          withoutSteps: roadmapsWithoutSteps,
          avgStepsPerRoadmap: totalRoadmaps ? round(totalRoadmapSteps / totalRoadmaps) : 0,
          recent: recentRoadmaps,
        },
        categories: {
          course: courseCategories.length,
          asset: assetCategories.length,
          material: materialCategories.length,
          showcase: showcaseCategories.length,
          emptyCourseCategories: courseCategories.filter((item) => item._count.courses === 0)
            .length,
          emptyAssetCategories: assetCategories.filter((item) => item._count.assets === 0).length,
        },
      },
      moderation: {
        totalPending: totalPendingContent,
        totalApproved: totalApprovedContent,
        totalRejected: totalRejectedContent,
        stalePending: staleAuditItems,
        assets: {
          pending: pendingAssets,
          approved: approvedAssets,
          rejected: rejectedAssets,
        },
        materials: {
          pending: pendingMaterials,
          approved: approvedMaterials,
          rejected: rejectedMaterials,
        },
        showcases: {
          pending: pendingShowcases,
          approved: approvedShowcases,
          rejected: rejectedShowcases,
        },
        plugins: {
          pending: pendingPlugins,
          approved: approvedPlugins,
          rejected: rejectedPlugins,
        },
        recentPending: recentPendingContent,
      },
      operations: {
        banners: {
          total: totalBanners,
          active: activeBanners,
          inactive: inactiveBanners,
          withoutImage: bannersWithoutImage,
          recent: recentBanners,
        },
        subscriptions: {
          plans: plans.length,
          activeSubscriptions: activeSubscriptions.length,
          expiringSoon: expiringSubscriptions,
          cancelAtPeriodEnd,
          activeCodes,
          usedCodes,
          expiredCodes,
          monthlyRecurring,
          yearlyRecurring,
          estimatedMonthlyRevenue: round(estimatedMonthlyRevenue, 2),
        },
        mirror: {
          sources: mirrorSources.length,
          active: activeMirrorSources.length,
          syncing: syncingSources,
          errors: mirrorErrors,
          stale: staleSources,
          resources: totalMirrorResources,
          categories: totalMirrorCategories,
          recentFailedSyncLogs: recentFailedSyncLogs.map((log) => ({
            id: log.id,
            sourceId: log.sourceId,
            sourceName: log.source.displayName,
            status: log.status,
            type: log.type,
            error: log.error,
            startedAt: log.startedAt,
          })),
        },
        manual: {
          stations: manualStations.length,
          active: activeManualStations,
          disabled: disabledManualStations,
          locked: lockedManualStations,
          empty: emptyManualStations,
          resources: totalManualResources,
          categories: totalManualCategories,
          recentResources: recentManualResources.map((item) => ({
            id: item.id,
            title: item.title,
            stationId: item.stationId,
            stationName: item.station.displayName,
            updatedAt: item.updatedAt,
          })),
        },
      },
      issues,
      actions,
    });
  } catch (error) {
    next(error);
  }
};
