import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { settingsService } from '../services/settings.service';

export const checkMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isMaintenance = await settingsService.get('MAINTENANCE_MODE');

    if (isMaintenance) {
      // Check if it's an admin trying to bypass
      const authHeader = req.headers.authorization;
      let token = authHeader && authHeader.split(' ')[1];

      // Also check cookies if no token in header
      if (!token && req.cookies) {
        token = req.cookies.token;
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, config.JWT_SECRET!, {
            algorithms: ['HS256'],
          }) as unknown as { id: string };
          const user = await prisma.user.findUnique({ where: { id: decoded.id } });
          if (user && user.role === 'ADMIN') {
            return next(); // Allow admin to bypass
          }
        } catch (_e) {
          // Token invalid or other error
        }
      }

      // Allow admin login and public settings even in maintenance mode
      if (
        req.path === '/api/auth/login' ||
        req.path === '/api/auth/settings' ||
        req.path === '/api/auth/refresh'
      ) {
        return next();
      }

      const requestId = (req as Request & { requestId?: string }).requestId;
      return res.status(503).json({
        status: 'error',
        error: '系统维护中',
        message: '平台正在进行例行维护，请稍后再试。管理员仍可正常登录。',
        code: 'MAINTENANCE_MODE',
        ...(requestId && { requestId }),
      });
    }

    next();
  } catch (_error) {
    next(); // If service fails, don't block the site
  }
};
