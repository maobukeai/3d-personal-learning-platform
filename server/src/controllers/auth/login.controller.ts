import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { generateAccessToken, generateRefreshToken, sanitizeUser } from '../../utils/auth';
import { settingsService } from '../../services/settings.service';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';

export const getPublicSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    const publicSettings = {
      PLATFORM_NAME: settings.PLATFORM_NAME,
      BROWSER_TITLE: settings.BROWSER_TITLE,
      PLATFORM_LOGO_URL: settings.PLATFORM_LOGO_URL,
      PLATFORM_FAVICON_URL: settings.PLATFORM_FAVICON_URL,
      PLATFORM_DESCRIPTION: settings.PLATFORM_DESCRIPTION,
      ALLOW_REGISTRATION: settings.ALLOW_REGISTRATION,
      MAINTENANCE_MODE: settings.MAINTENANCE_MODE,
      MATERIAL_CATEGORIES: settings.MATERIAL_CATEGORIES,
      FOOTER_TEXT: settings.FOOTER_TEXT,
      OAUTH_GOOGLE_ENABLED: settings.OAUTH_GOOGLE_ENABLED,
      OAUTH_GITHUB_ENABLED: settings.OAUTH_GITHUB_ENABLED,
    };
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(publicSettings);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, deviceToken } = req.body;
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
      return next(new AppError('邮箱或密码错误', 400));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError('邮箱或密码错误', 400));
    }

    if (user.status === 'BANNED') {
      return next(new AppError('您的账号已被封禁，请联系管理员。', 403));
    }

    if (user.twoFactorEnabled) {
      if (deviceToken) {
        const trusted = await prisma.trustedDevice.findFirst({
          where: { userId: user.id, token: deviceToken },
        });
        if (trusted) {
          const accessToken = generateAccessToken(user.id, user.role);
          const refreshToken = await generateRefreshToken(user.id);

          await auditService.log({
            userId: user.id,
            action: AuditAction.LOGIN,
            module: AuditModule.AUTH,
            description: `用户登录 (受信任设备): ${user.email}`,
            newValue: sanitizeUser(user),
            req,
          });

          return res.json({
            accessToken,
            refreshToken,
            user: sanitizeUser(user),
          });
        }
      }
      return res.json({ twoFactorRequired: true, userId: user.id });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('token', accessToken, { ...cookieOptions, maxAge: 3600000 }); // 1 hour
    res.cookie('refreshToken', refreshToken, cookieOptions);

    await auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      module: AuditModule.AUTH,
      description: `用户登录: ${user.email}`,
      req,
    });

    res.json({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const login2FA = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, code, rememberDevice } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!user || !user.twoFactorSecret) {
      return next(new AppError('Invalid request', 400));
    }

    if (user.status === 'BANNED') {
      return next(new AppError('您的账号已被封禁，请联系管理员。', 403));
    }

    let isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    // If not valid TOTP, check recovery codes
    if (!isValid && user.twoFactorRecoveryCodes) {
      const codes = JSON.parse(user.twoFactorRecoveryCodes) as string[];
      const codeIndex = codes.indexOf(code.toUpperCase());
      if (codeIndex !== -1) {
        isValid = true;
        // Remove used recovery code
        codes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: JSON.stringify(codes) },
        });
      }
    }

    if (!isValid) {
      return next(new AppError('验证码或恢复代码错误', 400));
    }

    let deviceToken = null;
    if (rememberDevice) {
      deviceToken = crypto.randomUUID();
      await prisma.trustedDevice.create({
        data: { userId: user.id, token: deviceToken },
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);

    await auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      module: AuditModule.AUTH,
      description: `用户登录 (2FA 验证): ${user.email}`,
      req,
    });

    res.json({
      accessToken,
      refreshToken,
      deviceToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  let token = req.body?.refreshToken || req.cookies?.refreshToken || null;
  if (!token) return next(new AppError('Refresh token required', 400));

  try {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
      }
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    const accessToken = generateAccessToken(storedToken.user.id, storedToken.user.role);
    const newRefreshToken = await generateRefreshToken(storedToken.user.id);
    await prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('token', accessToken, { ...cookieOptions, maxAge: 3600000 });
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('[Auth] Refresh token error:', error);
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken || null;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
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
          req,
        });
      }

      await prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
    }

    res.clearCookie('token', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user!;
  if (!user) return next(new AppError('Unauthorized', 401));

  res.json(sanitizeUser(user));
};
