import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { generateRecoveryCodes } from '../../utils/auth';
import { AppError } from '../../middlewares/error.middleware';

export const setup2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    if (!user) return next(new AppError('Unauthorized', 401));

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `3D Learning Platform (${user.email})`,
    });

    const otpauth = secret.otpauth_url!;
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Generate initial recovery codes
    const codes = generateRecoveryCodes();

    await prisma.user.update({
      where: { id: req.userId as string },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorRecoveryCodes: JSON.stringify(codes),
      },
    });

    res.json({ qrCodeUrl, secret: secret.base32, recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

export const getRecoveryCodes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { twoFactorRecoveryCodes: true },
    });

    if (!user || !user.twoFactorRecoveryCodes) {
      return next(new AppError('Recovery codes not found', 404));
    }

    res.json({ recoveryCodes: JSON.parse(user.twoFactorRecoveryCodes) });
  } catch (error) {
    next(error);
  }
};

export const regenerateRecoveryCodes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const codes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorRecoveryCodes: JSON.stringify(codes) },
    });
    res.json({ recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

export const enable2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { code, password } = req.body;
  try {
    if (!password) {
      return next(new AppError('启用两步验证需要验证当前密码', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user || !user.twoFactorSecret) {
      return next(new AppError('Invalid request', 400));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError('密码错误', 400));
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return next(new AppError('验证码错误', 400));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    res.json({ message: '两步验证已启用' });
  } catch (error) {
    next(error);
  }
};

export const disable2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { code, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('User not found', 404));

    if (!user.twoFactorEnabled) {
      return next(new AppError('两步验证未启用', 400));
    }

    if (code) {
      if (!user.twoFactorSecret) {
        return next(new AppError('配置异常，请联系管理员', 400));
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) {
        return next(new AppError('验证码错误', 400));
      }
    } else if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(new AppError('密码错误', 400));
      }
    } else {
      return next(new AppError('禁用两步验证需要提供验证码或密码', 400));
    }

    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    res.json({ message: '两步验证已禁用' });
  } catch (error) {
    next(error);
  }
};
