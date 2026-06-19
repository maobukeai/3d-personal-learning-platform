import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import type { Subscription, SubscriptionPlan } from '@prisma/client';
import { AppError } from '../utils/error';
import { redisService } from '../services/redis.service';
import { logger } from '../utils/logger';

const USER_CACHE_TTL_SECONDS = 600;
const WORKSPACE_CACHE_TTL_SECONDS = 60;

// Revive Date objects from JSON-serialized cache entries.
// Works with partial User objects (sensitive fields excluded from cache).
const reviveUserDates = (user: Record<string, unknown>) => {
  if (!user) return user;
  if (user.createdAt && typeof user.createdAt === 'string')
    user.createdAt = new Date(user.createdAt as string);
  if (user.updatedAt && typeof user.updatedAt === 'string')
    user.updatedAt = new Date(user.updatedAt as string);
  return user;
};

// Fields to select from User for auth caching — excludes sensitive fields
// (password, twoFactorSecret, twoFactorRecoveryCodes) so they are never stored in Redis.
const selectFields = {
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
} as const;

type SafeUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique<{ where: { id: string }; select: typeof selectFields }>>>>;

export interface AuthRequest extends Request {
  userId?: string;
  user?: SafeUser & {
    subscription?: (Subscription & { plan: SubscriptionPlan }) | null;
  };
  workspaceId?: string;
}

const getTokenFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token;
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  return null;
};

const resolveWorkspaceId = async (user: SafeUser, requestedWorkspaceId?: string) => {
  // Check workspace resolution cache for non-virtual workspaces
  if (
    requestedWorkspaceId &&
    !requestedWorkspaceId.startsWith('admin-') &&
    !requestedWorkspaceId.startsWith('mirror-') &&
    !requestedWorkspaceId.startsWith('manual-')
  ) {
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
      const subscription = await prisma.subscription.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: { plan: true },
      });
      const userPlanPriority = subscription?.plan?.priority ?? 0;
      if (userPlanPriority < source.minPlanPriority) {
        throw new AppError('权限不足，请升级订阅以访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
      }
    }
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
      const subscription = await prisma.subscription.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: { plan: true },
      });
      const userPlanPriority = subscription?.plan?.priority ?? 0;
      if (userPlanPriority < station.minPlanPriority) {
        throw new AppError('权限不足，请升级订阅以访问该资源空间', 403, 'WORKSPACE_FORBIDDEN');
      }
    }
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

const attachAuthenticatedUser = async (req: AuthRequest, userId: string) => {
  const cacheKey = `user_auth:${userId}`;
  let user: SafeUser | null = await redisService.get(cacheKey);

  if (user) {
    reviveUserDates(user);
  } else {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });

    if (user) {
      await redisService.set(cacheKey, user, USER_CACHE_TTL_SECONDS);
    }
  }

  if (!user) {
    throw new AppError('Unauthorized: User not found', 401, 'USER_NOT_FOUND');
  }

  if (user.status === 'BANNED') {
    throw new AppError('您的账号已被封禁', 403, 'USER_BANNED');
  }

  req.userId = user.id;
  req.user = user;
  req.workspaceId = await resolveWorkspaceId(user, req.headers['x-workspace-id'] as string);
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError('Unauthorized: No token provided', 401, 'TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    await attachAuthenticatedUser(req, decoded.id);
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    await attachAuthenticatedUser(req, decoded.id);
    next();
  } catch (error) {
    // Invalid/expired tokens are expected for guests, but log them at debug
    // level so token-probing attacks leave an audit trail when needed.
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('[optionalAuthenticate] Expired token ignored');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('[optionalAuthenticate] Invalid token ignored');
    } else {
      logger.warn('[optionalAuthenticate] Unexpected token verification error:', error);
    }
    next();
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED'));
  }
  next();
};
