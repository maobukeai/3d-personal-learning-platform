import prisma from '../services/prisma';
import { redisService } from '../services/redis.service';
import { AppError } from './error';
import { logger } from './logger';

const WORKSPACE_CACHE_TTL_SECONDS = 60;

// Fields to select from User for auth caching — excludes sensitive fields
// (password, twoFactorSecret, twoFactorRecoveryCodes) so they are never stored in Redis.
export const selectFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  bio: true,
  location: true,
  website: true,
  role: true,
  status: true,
  points: true,
  emailVerified: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
  googleId: true,
  githubId: true,
  defaultWorkspaceId: true,
} as const;

export type SafeUser = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.user.findUnique<{ where: { id: string }; select: typeof selectFields }>
    >
  >
>;

const getUserPlanPriority = async (userId: string): Promise<number> => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  return subscription?.plan?.priority ?? 0;
};

export const resolveWorkspaceId = async (user: SafeUser, requestedWorkspaceId?: string) => {
  // Check workspace resolution cache for non-virtual workspaces
  if (requestedWorkspaceId && !requestedWorkspaceId.startsWith('admin-')) {
    const cacheKey = `workspace_resolve:${user.id}:${requestedWorkspaceId}`;
    const cached = await redisService.get<string>(cacheKey);
    if (cached) return cached;
  }

  const getPersonalTeamId = async () => {
    const personalTeam = await prisma.team.findFirst({
      where: { ownerId: user.id, type: 'PERSONAL' },
      select: { id: true },
    });
    if (personalTeam) {
      const personalCacheKey = `workspace_resolve:${user.id}:personal`;
      await redisService.set(personalCacheKey, personalTeam.id, WORKSPACE_CACHE_TTL_SECONDS);
      return personalTeam.id;
    }
    // Create personal team on the fly if it doesn't exist
    const newPersonalTeam = await prisma.team.create({
      data: {
        name: `${user.name || '用户'} 的个人空间`,
        type: 'PERSONAL',
        visibility: 'PRIVATE',
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      select: { id: true },
    });
    logger.info(`Auto-created personal team ${newPersonalTeam.id} for user ${user.id}`);
    const personalCacheKey = `workspace_resolve:${user.id}:personal`;
    await redisService.set(personalCacheKey, newPersonalTeam.id, WORKSPACE_CACHE_TTL_SECONDS);
    return newPersonalTeam.id;
  };

  if (
    !requestedWorkspaceId ||
    requestedWorkspaceId === 'undefined' ||
    requestedWorkspaceId === 'null'
  ) {
    const personalCacheKey = `workspace_resolve:${user.id}:personal`;
    const cachedPersonal = await redisService.get<string>(personalCacheKey);
    if (cachedPersonal) return cachedPersonal;
    return await getPersonalTeamId();
  }

  // System/virtual workspaces bypass database team check
  if (requestedWorkspaceId === 'admin-workspace') {
    if (user.role === 'ADMIN') {
      return 'admin-workspace';
    }
    throw new AppError('无权访问该工作空间', 403, 'WORKSPACE_FORBIDDEN');
  }

  if (requestedWorkspaceId.startsWith('mirror-')) {
    const sourceId = requestedWorkspaceId.replace('mirror-', '');
    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId },
      select: { status: true, minPlanPriority: true },
    });
    if (!source || source.status !== 'ACTIVE') {
      throw new AppError('无权访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
    }
    if (source.minPlanPriority > 0) {
      const userPlanPriority = await getUserPlanPriority(user.id);
      if (userPlanPriority < source.minPlanPriority) {
        throw new AppError('权限不足，请升级订阅以访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
      }
    }
    const cacheKey = `workspace_resolve:${user.id}:${requestedWorkspaceId}`;
    await redisService.set(cacheKey, requestedWorkspaceId, WORKSPACE_CACHE_TTL_SECONDS);
    return requestedWorkspaceId;
  }

  if (requestedWorkspaceId.startsWith('manual-')) {
    const stationId = requestedWorkspaceId.replace('manual-', '');
    const station = await prisma.manualStation.findUnique({
      where: { id: stationId },
      select: { status: true, minPlanPriority: true },
    });
    if (!station || station.status !== 'ACTIVE') {
      throw new AppError('无权访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
    }
    if (station.minPlanPriority > 0) {
      const userPlanPriority = await getUserPlanPriority(user.id);
      if (userPlanPriority < station.minPlanPriority) {
        throw new AppError('权限不足，请升级订阅以访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
      }
    }
    const cacheKey = `workspace_resolve:${user.id}:${requestedWorkspaceId}`;
    await redisService.set(cacheKey, requestedWorkspaceId, WORKSPACE_CACHE_TTL_SECONDS);
    return requestedWorkspaceId;
  }

  const membership = await prisma.teamMember.findFirst({
    where: { teamId: requestedWorkspaceId, userId: user.id },
    select: { id: true },
  });

  if (membership) {
    // Cache the resolved workspace ID for 60 seconds
    const cacheKey = `workspace_resolve:${user.id}:${requestedWorkspaceId}`;
    await redisService.set(cacheKey, requestedWorkspaceId, WORKSPACE_CACHE_TTL_SECONDS);
    return requestedWorkspaceId;
  }

  // Also check if they are the owner of the team (to avoid false-positives for team owners, including personal workspace owners)
  const team = await prisma.team.findUnique({
    where: { id: requestedWorkspaceId },
    select: { ownerId: true },
  });

  if (team && team.ownerId === user.id) {
    // Cache the resolved workspace ID for 60 seconds
    const cacheKey = `workspace_resolve:${user.id}:${requestedWorkspaceId}`;
    await redisService.set(cacheKey, requestedWorkspaceId, WORKSPACE_CACHE_TTL_SECONDS);
    return requestedWorkspaceId;
  }

  throw new AppError('无权访问该工作空间', 403, 'WORKSPACE_FORBIDDEN');
};
