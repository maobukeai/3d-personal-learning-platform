import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export const checkMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maintenanceMode = await prisma.systemSetting.findUnique({
      where: { key: 'MAINTENANCE_MODE' }
    });

    if (maintenanceMode && maintenanceMode.value === 'true') {
      // Check if it's an admin trying to bypass
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
          const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
          
          if (user && user.role === 'ADMIN') {
            return next(); // Allow admin to bypass
          }
        } catch (e) {
          // Token invalid or other error, just proceed to block
        }
      }

      // If it's a critical auth route or admin route, we might want to allow it?
      // Actually, if it's maintenance mode, we should block everything except maybe GET stats or something?
      // Usually, we block all user-facing APIs.
      
      // Allow admin login and public settings even in maintenance mode
      if (req.path === '/api/auth/login' || req.path === '/api/auth/settings') {
         return next();
      }

      return res.status(503).json({ 
        error: '系统维护中', 
        message: '平台正在进行例行维护，请稍后再试。管理员仍可正常登录。' 
      });
    }

    next();
  } catch (error) {
    next(); // If DB fails, don't block the site
  }
};
