import { logger } from '../../utils/logger';
import type { FastifyRequest, FastifyReply } from 'fastify';

import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
import {
  generateAccessToken,
  generateRefreshToken,
  sanitizeUser,
  verifyRecoveryCode,
} from '../../utils/auth';
import { getPublicAIModels, settingsService } from '../../services/settings.service';
import {
  auditService,
  AuditModule,
  AuditAction,
  type AuditRequest,
} from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { redisService } from '../../services/redis.service';

const setAuthCookies = (reply: FastifyReply, accessToken: string, refreshToken: string) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  reply.setCookie('token', accessToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
  reply.setCookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');
  reply.setCookie('csrfToken', csrfToken, {
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    httpOnly: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const getPublicSettings = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const settings = await settingsService.getAll();
    const publicSettings = {
      PLATFORM_NAME: settings.PLATFORM_NAME,
      PLATFORM_SUBTITLE: settings.PLATFORM_SUBTITLE,
      BROWSER_TITLE: settings.BROWSER_TITLE,
      PLATFORM_LOGO_URL: settings.PLATFORM_LOGO_URL,
      PLATFORM_FAVICON_URL: settings.PLATFORM_FAVICON_URL,
      PLATFORM_DESCRIPTION: settings.PLATFORM_DESCRIPTION,
      ALLOW_REGISTRATION: settings.ALLOW_REGISTRATION,
      MAINTENANCE_MODE: settings.MAINTENANCE_MODE,
      MATERIAL_CATEGORIES: settings.MATERIAL_CATEGORIES,
      TEAM_CATEGORIES: settings.TEAM_CATEGORIES,
      PLUGIN_CATEGORIES: settings.PLUGIN_CATEGORIES,
      SOFTWARE_CATEGORIES: settings.SOFTWARE_CATEGORIES,
      SHOWCASE_CATEGORIES: settings.SHOWCASE_CATEGORIES,
      FOOTER_TEXT: settings.FOOTER_TEXT,
      OAUTH_GOOGLE_ENABLED: settings.OAUTH_GOOGLE_ENABLED,
      OAUTH_GITHUB_ENABLED: settings.OAUTH_GITHUB_ENABLED,
      AI_IMPORT_ENABLED: settings.AI_IMPORT_ENABLED,
      AI_MODEL_OPTIONS: getPublicAIModels(settings),
    };
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.send(publicSettings);
  } catch (error) {
    throw error;
  }
};

export const login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { email, password, deviceToken } = request.body as {
    email: string;
    password: string;
    deviceToken?: string;
  };
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });
    if (!user) {
      throw new AppError('邮箱或密码错误', 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('邮箱或密码错误', 400);
    }

    if (user.status === 'BANNED') {
      throw new AppError('您的账号已被封禁，请联系管理员。', 403);
    }

    if (user.twoFactorEnabled) {
      if (deviceToken) {
        const trusted = await prisma.trustedDevice.findFirst({
          where: { userId: user.id, token: deviceToken },
        });
        if (trusted) {
          await prisma.trustedDevice.update({
            where: { id: trusted.id },
            data: {
              lastUsedAt: new Date(),
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'] || null,
            },
          });
          const accessToken = generateAccessToken(user.id, user.role);
          const refreshToken = await generateRefreshToken(user.id);
          setAuthCookies(reply, accessToken, refreshToken);

          await auditService.log({
            userId: user.id,
            action: AuditAction.LOGIN,
            module: AuditModule.AUTH,
            description: `用户登录 (受信任设备): ${user.email}`,
            newValue: sanitizeUser(user),
            req: request as unknown as AuditRequest,
          });

          reply.send({
            accessToken,
            refreshToken,
            user: sanitizeUser(user),
          });
          return;
        }
      }
      reply.send({ twoFactorRequired: true, userId: user.id });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    setAuthCookies(reply, accessToken, refreshToken);

    await auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      module: AuditModule.AUTH,
      description: `用户登录: ${user.email}`,
      req: request as unknown as AuditRequest,
    });

    reply.send({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    throw error;
  }
};

export const login2FA = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { userId, code, rememberDevice } = request.body as {
    userId: string;
    code: string;
    rememberDevice?: boolean;
  };
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!user || !user.twoFactorSecret) {
      throw new AppError('Invalid request', 400);
    }

    if (user.status === 'BANNED') {
      throw new AppError('您的账号已被封禁，请联系管理员。', 403);
    }

    let isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    // If not valid TOTP, check recovery codes
    if (!isValid && user.twoFactorRecoveryCodes) {
      const recoveryCodeResult = await verifyRecoveryCode(user.twoFactorRecoveryCodes, code);
      if (recoveryCodeResult.valid) {
        isValid = true;
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: JSON.stringify(recoveryCodeResult.remainingCodes) },
        });

        await redisService.invalidateUserCache(user.id);
      }
    }

    if (!isValid) {
      throw new AppError('验证码或恢复代码错误', 400);
    }

    let deviceToken = null;
    if (rememberDevice) {
      deviceToken = crypto.randomUUID();
      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          token: deviceToken,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || null,
          lastUsedAt: new Date(),
        },
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    setAuthCookies(reply, accessToken, refreshToken);

    await auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      module: AuditModule.AUTH,
      description: `用户登录 (2FA 验证): ${user.email}`,
      req: request as unknown as AuditRequest,
    });

    reply.send({
      accessToken,
      refreshToken,
      deviceToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    throw error;
  }
};

export const refreshToken = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const body = (request.body as { refreshToken?: string } | null) ?? {};
  const cookies = (request.cookies as { refreshToken?: string } | undefined) ?? {};
  let token = body.refreshToken || cookies.refreshToken || null;
  if (!token) throw new AppError('Refresh token required', 400);

  try {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
      }
      reply.clearCookie('token');
      reply.clearCookie('refreshToken');
      reply.clearCookie('csrfToken');
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const accessToken = generateAccessToken(storedToken.user.id, storedToken.user.role);
    const newRefreshToken = await generateRefreshToken(storedToken.user.id);
    await prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
    setAuthCookies(reply, accessToken, newRefreshToken);

    reply.send({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('[Auth] Refresh token error:', error);
    throw error;
  }
};

export const logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const body = (request.body as { refreshToken?: string } | null) ?? {};
  const cookies = (request.cookies as { refreshToken?: string } | undefined) ?? {};
  const refreshToken = body.refreshToken || cookies.refreshToken || null;

  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  try {
    if (refreshToken && typeof refreshToken === 'string') {
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        select: { userId: true },
      });

      if (storedToken) {
        await auditService.log({
          userId: storedToken.userId,
          action: AuditAction.LOGOUT,
          module: AuditModule.AUTH,
          description: '用户登出',
          req: request as unknown as AuditRequest,
        });
      }

      await prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
    }

    reply.clearCookie('token', cookieOptions);
    reply.clearCookie('refreshToken', cookieOptions);
    reply.clearCookie('csrfToken', { ...cookieOptions, httpOnly: false });
    reply.send({ message: 'Logged out' });
  } catch (error) {
    logger.error('[Auth] Logout error:', error);
    throw error;
  }
};

export const getMe = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const user = request.user!;
  if (!user) throw new AppError('Unauthorized', 401);

  try {
    // Dynamically load user's subscription details separately to avoid redundant user query overhead
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });
    const userWithSub = { ...user, subscription };
    reply.send(sanitizeUser(userWithSub));
  } catch (error) {
    throw error;
  }
};
