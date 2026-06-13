import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { sanitizeUser } from '../../utils/auth';
import { AppError } from '../../middlewares/error.middleware';
import { createPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { redisService } from '../../services/redis.service';
import { provisionUserWorkspaces } from '../../services/user-workspace.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const adminUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  avatarUrl: true,
  points: true,
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
  subscription: {
    include: {
      plan: true,
    },
  },
  _count: {
    select: {
      assets: true,
      materials: true,
      showcases: true,
      feedbacks: true,
      teamMemberships: true,
      projects: true,
      tasks: true,
      refreshTokens: true,
      trustedDevices: true,
      auditLogs: true,
    },
  },
} satisfies Prisma.UserSelect;

type AdminUserListItem = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

type AdminUserActivity = {
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  lastLoginUserAgent: string | null;
  loginCount: number;
  lastActivityAt: Date | null;
  lastActivityAction: string | null;
  lastActivityModule: string | null;
  lastActivityIp: string | null;
  activeSessions: number;
  trustedDevices: number;
};

const daysSince = (value?: Date | null) => {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / DAY_MS));
};

const attachUserActivity = async <T extends { id: string }>(
  users: T[],
): Promise<Array<T & AdminUserActivity>> => {
  const userIds = users.map((user) => user.id);
  const now = new Date();

  const [loginGroups, activityGroups, activeSessionGroups, trustedDeviceGroups] =
    userIds.length > 0
      ? await Promise.all([
          prisma.auditLog.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              action: AuditAction.LOGIN,
            },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          prisma.auditLog.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _max: { createdAt: true },
          }),
          prisma.refreshToken.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              expiresAt: { gt: now },
            },
            _count: { _all: true },
          }),
          prisma.trustedDevice.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { _all: true },
          }),
        ])
      : [[], [], [], []];

  const loginGroupByUserId = new Map(
    loginGroups
      .filter((group) => group.userId && group._max.createdAt)
      .map((group) => [group.userId as string, group]),
  );
  const activityGroupByUserId = new Map(
    activityGroups
      .filter((group) => group.userId && group._max.createdAt)
      .map((group) => [group.userId as string, group]),
  );
  const activeSessionsByUserId = new Map(
    activeSessionGroups.map((group) => [group.userId, group._count._all] as const),
  );
  const trustedDevicesByUserId = new Map(
    trustedDeviceGroups.map((group) => [group.userId, group._count._all] as const),
  );

  const loginLookup = Array.from(loginGroupByUserId.entries()).map(([userId, group]) => ({
    userId,
    createdAt: group._max.createdAt as Date,
  }));
  const activityLookup = Array.from(activityGroupByUserId.entries()).map(([userId, group]) => ({
    userId,
    createdAt: group._max.createdAt as Date,
  }));

  const [latestLoginLogs, latestActivityLogs] = await Promise.all([
    loginLookup.length > 0
      ? prisma.auditLog.findMany({
          where: {
            OR: loginLookup.map((item) => ({
              userId: item.userId,
              action: AuditAction.LOGIN,
              createdAt: item.createdAt,
            })),
          },
          select: {
            userId: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    activityLookup.length > 0
      ? prisma.auditLog.findMany({
          where: {
            OR: activityLookup.map((item) => ({
              userId: item.userId,
              createdAt: item.createdAt,
            })),
          },
          select: {
            userId: true,
            action: true,
            module: true,
            ipAddress: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const latestLoginByUserId = new Map(
    latestLoginLogs.filter((log) => log.userId).map((log) => [log.userId as string, log]),
  );
  const latestActivityByUserId = new Map(
    latestActivityLogs.filter((log) => log.userId).map((log) => [log.userId as string, log]),
  );

  return users.map((user) => {
    const loginGroup = loginGroupByUserId.get(user.id);
    const activityGroup = activityGroupByUserId.get(user.id);
    const latestLogin = latestLoginByUserId.get(user.id);
    const latestActivity = latestActivityByUserId.get(user.id);

    return {
      ...user,
      lastLoginAt: loginGroup?._max.createdAt || null,
      lastLoginIp: latestLogin?.ipAddress || null,
      lastLoginUserAgent: latestLogin?.userAgent || null,
      loginCount: loginGroup?._count._all || 0,
      lastActivityAt: activityGroup?._max.createdAt || null,
      lastActivityAction: latestActivity?.action || null,
      lastActivityModule: latestActivity?.module || null,
      lastActivityIp: latestActivity?.ipAddress || null,
      activeSessions: activeSessionsByUserId.get(user.id) || 0,
      trustedDevices: trustedDevicesByUserId.get(user.id) || 0,
    };
  });
};

const getRiskProfile = (user: AdminUserListItem & AdminUserActivity) => {
  const loginDays = daysSince(user.lastLoginAt);
  let score = 0;
  const reasons: string[] = [];

  if (user.status === 'BANNED') {
    score += 60;
    reasons.push('账号已封禁');
  }
  if (user.role === 'ADMIN' && !user.twoFactorEnabled) {
    score += 45;
    reasons.push('管理员未开启 2FA');
  }
  if (!user.emailVerified) {
    score += 24;
    reasons.push('邮箱未验证');
  }
  if (!user.lastLoginAt) {
    score += 18;
    reasons.push('从未登录');
  } else if (loginDays !== null && loginDays > 30) {
    score += 18;
    reasons.push('超过 30 天未登录');
  }
  if (user.activeSessions >= 5) {
    score += 20;
    reasons.push('活跃会话异常偏多');
  }
  if ((user._count.feedbacks || 0) >= 5) {
    score += 12;
    reasons.push('反馈量偏高');
  }

  return {
    score,
    level: score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low',
    reason: reasons[0] || '运行正常',
    reasons,
  };
};

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 50, 200);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const role =
      typeof req.query.role === 'string' && req.query.role !== 'ALL' ? req.query.role : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status !== 'ALL'
        ? req.query.status
        : undefined;
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { email: { contains: q } }],
          }
        : {}),
    };

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: adminUserSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const usersWithActivity = await attachUserActivity(users);

    res.json({
      data: usersWithActivity,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [
      total,
      active,
      banned,
      admins,
      instructors,
      newLast7d,
      newLast30d,
      emailVerified,
      twoFactorEnabled,
      adminsWithoutMfa,
      activeSubscriptions,
      expiringSoon,
      roleGroups,
      statusGroups,
      loginGroups,
      loginEventsLast7d,
      activeSessionGroups,
      trustedDeviceGroups,
      planGroups,
      plans,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'INSTRUCTOR' } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { twoFactorEnabled: true } }),
      prisma.user.count({ where: { role: 'ADMIN', twoFactorEnabled: false } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 14 * DAY_MS),
          },
        },
      }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, action: AuditAction.LOGIN },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.auditLog.count({
        where: { action: AuditAction.LOGIN, createdAt: { gte: sevenDaysAgo } },
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
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
      prisma.subscriptionPlan.findMany({
        select: { id: true, name: true, displayName: true, badgeColor: true },
      }),
    ]);

    const recentLogins = loginGroups.filter(
      (group) => group._max.createdAt && group._max.createdAt >= sevenDaysAgo,
    ).length;
    const dormantUserIds = loginGroups
      .filter(
        (group) => group.userId && group._max.createdAt && group._max.createdAt < thirtyDaysAgo,
      )
      .map((group) => group.userId as string);
    const activeSessionUsers = activeSessionGroups.length;
    const activeSessions = activeSessionGroups.reduce((sum, group) => sum + group._count._all, 0);
    const trustedDevices = trustedDeviceGroups.reduce((sum, group) => sum + group._count._all, 0);
    const highSessionUserIds = activeSessionGroups
      .filter((group) => group._count._all >= 5)
      .map((group) => group.userId);

    const riskCandidates = await prisma.user.findMany({
      where: {
        OR: [
          { status: 'BANNED' },
          { role: 'ADMIN', twoFactorEnabled: false },
          { emailVerified: false },
          { id: { in: highSessionUserIds } },
          { id: { in: dormantUserIds.slice(0, 80) } },
        ],
      },
      select: adminUserSelect,
      orderBy: { updatedAt: 'desc' },
      take: 80,
    });

    const recentUsers = await prisma.user.findMany({
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const riskQueue = (await attachUserActivity(riskCandidates))
      .map((user) => ({
        ...user,
        risk: getRiskProfile(user),
      }))
      .sort((a, b) => b.risk.score - a.risk.score)
      .slice(0, 8);

    const recentUsersWithActivity = await attachUserActivity(recentUsers);
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    res.json({
      generatedAt: now,
      totals: {
        total,
        active,
        banned,
        admins,
        instructors,
        users: Math.max(0, total - admins - instructors),
        newLast7d,
        newLast30d,
      },
      security: {
        emailVerified,
        emailUnverified: Math.max(0, total - emailVerified),
        twoFactorEnabled,
        twoFactorDisabled: Math.max(0, total - twoFactorEnabled),
        adminsWithoutMfa,
        activeSessions,
        activeSessionUsers,
        trustedDevices,
      },
      activity: {
        recentLogins,
        dormant: dormantUserIds.length,
        neverLoggedIn: Math.max(0, total - loginGroups.length),
        loginEventsLast7d,
      },
      commerce: {
        activeSubscriptions,
        expiringSoon,
        conversionRate: total > 0 ? Math.round((activeSubscriptions / total) * 100) : 0,
      },
      roleDistribution: roleGroups.map((group) => ({
        key: group.role,
        label: group.role,
        count: group._count._all,
      })),
      statusDistribution: statusGroups.map((group) => ({
        key: group.status,
        label: group.status,
        count: group._count._all,
      })),
      planDistribution: planGroups.map((group) => {
        const plan = planById.get(group.planId);
        return {
          key: group.planId,
          label: plan?.displayName || plan?.name || '未知计划',
          color: plan?.badgeColor || null,
          count: group._count._all,
        };
      }),
      riskQueue,
      recentUsers: recentUsersWithActivity,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return next(new AppError('邮箱和密码为必填项', 400));
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('该邮箱已被注册', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role || 'USER',
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      await provisionUserWorkspaces(tx, {
        userId: user.id,
        displayName: name || user.email,
        includePublicWorkspace: true,
      });

      return user;
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_USER,
      module: AuditModule.USER,
      description: `管理员创建了新用户 ${result.email}`,
      newValue: sanitizeUser(result),
      req,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { name, email, role, status } = req.body;

  try {
    const oldUser = await prisma.user.findUnique({ where: { id } });
    if (!oldUser) return next(new AppError('用户不存在', 404));

    // Prevent self-demotion or self-banning if you are an admin
    if (id === req.userId && (role !== 'ADMIN' || status === 'BANNED')) {
      return next(new AppError('不能修改自己的管理员权限或封禁自己', 400));
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, email, role, status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await redisService.invalidateUserCache(id);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `管理员更新了用户 ${updatedUser.email} 的资料`,
      oldValue: sanitizeUser(oldUser),
      newValue: updatedUser,
      req,
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return next(new AppError('密码长度至少为 6 位', 400));
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return next(new AppError('用户不存在', 404));

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await redisService.invalidateUserCache(id);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.USER,
      description: `管理员重置了用户 ${user.email} 的密码`,
      req,
    });

    res.json({ message: '用户密码已成功重置' });
  } catch (error) {
    next(error);
  }
};

export const revokeUserSessions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const includeTrustedDevices = req.body?.includeTrustedDevices === true;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!user) return next(new AppError('用户不存在', 404));

    const result = await prisma.$transaction(async (tx) => {
      const sessions = await tx.refreshToken.deleteMany({ where: { userId: id } });
      const trustedDevices = includeTrustedDevices
        ? await tx.trustedDevice.deleteMany({ where: { userId: id } })
        : { count: 0 };

      return {
        sessions: sessions.count,
        trustedDevices: trustedDevices.count,
      };
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `Admin revoked active sessions for ${user.email}`,
      newValue: { targetUserId: id, ...result },
      req,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const batchRevokeUserSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { ids, includeTrustedDevices } = req.body as {
    ids?: string[];
    includeTrustedDevices?: boolean;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('Please select at least one user', 400));
  }

  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return next(new AppError('Please select at least one user', 400));
  }

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return next(new AppError('Users not found', 404));
    }

    const targetIds = users.map((user) => user.id);
    const result = await prisma.$transaction(async (tx) => {
      const sessions = await tx.refreshToken.deleteMany({
        where: { userId: { in: targetIds } },
      });
      const trustedDevicesResult = includeTrustedDevices
        ? await tx.trustedDevice.deleteMany({ where: { userId: { in: targetIds } } })
        : { count: 0 };

      return {
        sessions: sessions.count,
        trustedDevices: trustedDevicesResult.count,
      };
    });

    await Promise.all(users.map((user) => redisService.invalidateUserCache(user.id)));

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `Admin batch revoked active sessions for ${users.length} users`,
      newValue: {
        ids: targetIds,
        emails: users.map((user) => user.email),
        includeTrustedDevices: includeTrustedDevices === true,
        ...result,
      },
      req,
    });

    res.json({
      users: users.length,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { role } = req.body;

  const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
  if (!validRoles.includes(role)) {
    return next(new AppError('Invalid role value', 400));
  }

  try {
    const oldUser = await prisma.user.findUnique({ where: { id } });
    if (!oldUser) return next(new AppError('用户不存在', 404));

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    await redisService.invalidateUserCache(id);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `管理员修改了用户 ${updatedUser.email} 的角色为 ${role}`,
      oldValue: { role: oldUser.role },
      newValue: { role },
      req,
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const batchUpdateUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { ids, role, status } = req.body as {
    ids?: string[];
    role?: string;
    status?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('Please select at least one user', 400));
  }

  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return next(new AppError('Please select at least one user', 400));
  }

  const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
  const validStatuses = ['ACTIVE', 'BANNED'];
  if (role !== undefined && !validRoles.includes(role)) {
    return next(new AppError('Invalid role value', 400));
  }
  if (status !== undefined && !validStatuses.includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }
  if (role === undefined && status === undefined) {
    return next(new AppError('No batch update field provided', 400));
  }

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, email: true, role: true },
    });

    if (users.length === 0) {
      return next(new AppError('Users not found', 404));
    }

    const touchesSelf = uniqueIds.includes(req.userId as string);
    if (touchesSelf && (status === 'BANNED' || (role !== undefined && role !== 'ADMIN'))) {
      return next(new AppError('Cannot demote or ban your own administrator account', 400));
    }

    const affectedAdminIds = users.filter((user) => user.role === 'ADMIN').map((user) => user.id);
    if (affectedAdminIds.length > 0 && role !== undefined && role !== 'ADMIN') {
      const remainingAdmins = await prisma.user.count({
        where: { role: 'ADMIN', id: { notIn: affectedAdminIds } },
      });
      if (remainingAdmins < 1) {
        return next(new AppError('Cannot remove the last administrator account', 400));
      }
    }

    const updateData: Prisma.UserUpdateManyMutationInput = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const result = await prisma.user.updateMany({
      where: { id: { in: users.map((user) => user.id) } },
      data: updateData,
    });

    await Promise.all(users.map((user) => redisService.invalidateUserCache(user.id)));

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `Admin batch updated ${result.count} users`,
      newValue: {
        ids: users.map((user) => user.id),
        emails: users.map((user) => user.email),
        role,
        status,
      },
      req,
    });

    res.json({ count: result.count });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    // Prevent self-deletion
    if (id === req.userId) {
      return next(new AppError('不能删除自己的账户', 400));
    }

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({ where: { id } });
    if (!userToDelete) {
      return next(new AppError('用户不存在', 404));
    }

    // Prevent deleting the last admin
    if (userToDelete.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return next(new AppError('不能删除最后一个管理员账户', 400));
      }
    }

    await prisma.user.delete({ where: { id } });
    await redisService.invalidateUserCache(id);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_USER,
      module: AuditModule.USER,
      description: `管理员删除了用户 ${userToDelete.email}`,
      oldValue: sanitizeUser(userToDelete),
      req,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
