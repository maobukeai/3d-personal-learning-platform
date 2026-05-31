import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import type { User, Subscription, SubscriptionPlan } from '@prisma/client';
import { AppError } from './error.middleware';
import { redisService } from '../services/redis.service';
import { logger } from '../utils/logger';

const reviveUserDates = (user: any) => {
  if (!user) return user;
  if (user.createdAt) user.createdAt = new Date(user.createdAt);
  if (user.updatedAt) user.updatedAt = new Date(user.updatedAt);
  return user;
};

export interface AuthRequest extends Request {
  userId?: string;
  user?: User & {
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

const resolveWorkspaceId = async (user: User, requestedWorkspaceId?: string) => {
  const getPersonalTeamId = async () => {
    const personalTeam = await prisma.team.findFirst({
      where: { ownerId: user.id, type: 'PERSONAL' },
      select: { id: true },
    });
    if (personalTeam) {
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
    return newPersonalTeam.id;
  };

  if (
    !requestedWorkspaceId ||
    requestedWorkspaceId === 'undefined' ||
    requestedWorkspaceId === 'null'
  ) {
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
    return requestedWorkspaceId;
  }

  // Also check if they are the owner of the team (to avoid false-positives for team owners, including personal workspace owners)
  const team = await prisma.team.findUnique({
    where: { id: requestedWorkspaceId },
    select: { ownerId: true },
  });

  if (team && team.ownerId === user.id) {
    return requestedWorkspaceId;
  }

  throw new AppError('无权访问该工作空间', 403, 'WORKSPACE_FORBIDDEN');
};

const attachAuthenticatedUser = async (req: AuthRequest, userId: string) => {
  const cacheKey = `user_auth:${userId}`;
  let user = await redisService.get<User>(cacheKey);

  if (user) {
    reviveUserDates(user);
  } else {
    user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      await redisService.set(cacheKey, user, 600); // 10 minutes cache
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
  } catch (_error) {
    // If token is invalid, just proceed as guest
    next();
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED'));
  }
  next();
};
