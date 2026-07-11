import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
import { settingsService } from '../../services/settings.service';
import { logger } from '../../utils/logger';

/**
 * Fastify 版维护模式 preHandler（对应 Express 版 maintenance.middleware.ts）。
 *
 * - 读取 settingsService 的 MAINTENANCE_MODE
 * - 维护中：放行管理员（Authorization header / cookie 中的 admin JWT）
 * - 放行登录 / 公共设置 / 刷新 token 路径，便于管理员登录
 * - 其余请求返回 503
 * - settings 读取失败时放行，但记录告警，避免静默绕过
 */
export const fastifyMaintenance = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const isMaintenance = await settingsService.get('MAINTENANCE_MODE');

    if (!isMaintenance) {
      return;
    }

    // Check if it's an admin trying to bypass
    const authHeader = request.headers.authorization;
    let token = authHeader && authHeader.split(' ')[1];

    // Also check cookies if no token in header
    if (!token && request.cookies) {
      token = request.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET!, {
          algorithms: ['HS256'],
        }) as unknown as { id: string };
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (user && user.role === 'ADMIN') {
          return; // Allow admin to bypass
        }
      } catch (_e) {
        // Token invalid or other error
      }
    }

    // Allow admin login and public settings even in maintenance mode
    const requestPath = request.url.split('?')[0] || request.url;
    if (
      requestPath === '/api/auth/login' ||
      requestPath === '/api/auth/settings' ||
      requestPath === '/api/auth/refresh'
    ) {
      return;
    }

    const requestId = (request as FastifyRequest & { requestId?: string }).requestId;
    return reply.status(503).send({
      status: 'error',
      error: '系统维护中',
      message: '平台正在进行例行维护，请稍后再试。管理员仍可正常登录。',
      code: 'MAINTENANCE_MODE',
      ...(requestId && { requestId }),
    });
  } catch (error) {
    // If the settings service fails (e.g. DB unreachable), don't block the
    // site, but record the failure so silent maintenance-mode bypasses are
    // visible during incident investigation.
    logger.warn(
      '[MaintenanceMiddleware] Failed to read maintenance mode, allowing request:',
      error,
    );
    // allow request to proceed
  }
};
