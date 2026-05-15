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
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
          try {
            const decoded = jwt.verify(token, config.JWT_SECRET!) as unknown as { id: string };
            const user = await prisma.user.findUnique({ where: { id: decoded.id } });
            if (user && user.role === 'ADMIN') {
              return next(); // Allow admin to bypass
            }
          } catch (e) {
            // Token invalid or other error
          }
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

      return res.status(503).json({
        error: '系统维护中',
        message: '平台正在进行例行维护，请稍后再试。管理员仍可正常登录。',
      });
    }

    next();
  } catch (error) {
    next(); // If service fails, don't block the site
  }
};
