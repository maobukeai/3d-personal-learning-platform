import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import type { User, Subscription, SubscriptionPlan } from '@prisma/client';

export interface AuthRequest extends Request {
  userId?: string;
  user?: User & {
    subscription?: (Subscription & { plan: SubscriptionPlan }) | null;
  };
  workspaceId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    req.userId = decoded.id;

    // Optionally attach the full user object
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: '您的账号已被封禁' });
    }

    req.user = user;

    // Handle Workspace Context
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (workspaceId) {
      const isMember = await prisma.teamMember.findFirst({
        where: { teamId: workspaceId, userId: decoded.id },
      });
      if (isMember) {
        req.workspaceId = workspaceId;
      }
    }

    // Fallback to personal workspace if not set or invalid
    if (!req.workspaceId) {
      const personalTeam = await prisma.team.findFirst({
        where: { ownerId: decoded.id, type: 'PERSONAL' },
      });
      if (personalTeam) {
        req.workspaceId = personalTeam.id;
      }
    }

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    req.userId = decoded.id;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (user && user.status !== 'BANNED') {
      req.user = user;

      const workspaceId = req.headers['x-workspace-id'] as string;
      if (workspaceId) {
        const isMember = await prisma.teamMember.findFirst({
          where: { teamId: workspaceId, userId: decoded.id },
        });
        if (isMember) {
          req.workspaceId = workspaceId;
        }
      }

      if (!req.workspaceId) {
        const personalTeam = await prisma.team.findFirst({
          where: { ownerId: decoded.id, type: 'PERSONAL' },
        });
        if (personalTeam) {
          req.workspaceId = personalTeam.id;
        }
      }
    }
    next();
  } catch (error) {
    // If token is invalid, just proceed as guest
    next();
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};
