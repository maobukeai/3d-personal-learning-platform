import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import type { User, Subscription, SubscriptionPlan } from '@prisma/client';
import { AppError } from './error.middleware';

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

const resolveWorkspaceId = async (userId: string, requestedWorkspaceId?: string) => {
  if (requestedWorkspaceId) {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId: requestedWorkspaceId, userId },
      select: { id: true },
    });

    if (membership) {
      return requestedWorkspaceId;
    }
  }

  const personalTeam = await prisma.team.findFirst({
    where: { ownerId: userId, type: 'PERSONAL' },
    select: { id: true },
  });

  return personalTeam?.id;
};

const attachAuthenticatedUser = async (req: AuthRequest, userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('Unauthorized: User not found', 401, 'USER_NOT_FOUND');
  }

  if (user.status === 'BANNED') {
    throw new AppError('您的账号已被封禁', 403, 'USER_BANNED');
  }

  req.userId = user.id;
  req.user = user;
  req.workspaceId = await resolveWorkspaceId(user.id, req.headers['x-workspace-id'] as string);
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError('Unauthorized: No token provided', 401, 'TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
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
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    await attachAuthenticatedUser(req, decoded.id);
    next();
  } catch (error) {
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
