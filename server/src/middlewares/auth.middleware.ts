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
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    
    // Optionally attach the full user object
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      include: { 
        subscription: {
          include: { plan: true }
        }
      }
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
        where: { teamId: workspaceId, userId: decoded.userId }
      });
      if (isMember) {
        req.workspaceId = workspaceId;
      }
    }

    // Fallback to personal workspace if not set or invalid
    if (!req.workspaceId) {
      const personalTeam = await prisma.team.findFirst({
        where: { ownerId: decoded.userId, type: 'PERSONAL' }
      });
      if (personalTeam) {
        req.workspaceId = personalTeam.id;
      }
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};
