import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { generateRecoveryCodes, hashRecoveryCodes } from '../../utils/auth';
import { AppError } from '../../utils/error';
import { redisService } from '../../services/redis.service';

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
    const codes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(codes);

    await prisma.user.update({
      where: { id: req.userId as string },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorRecoveryCodes: JSON.stringify(hashedCodes),
      },
    });

    await redisService.invalidateUserCache(req.userId as string);
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
      return next(new AppError('恢复码不存在', 404));
    }

    const recoveryCodes = JSON.parse(user.twoFactorRecoveryCodes) as string[];
    res.json({ count: recoveryCodes.length });
  } catch (error) {
    next(error);
  }
};

export const regenerateRecoveryCodes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { password, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('用户不存在', 404));

    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(new AppError('密码错误', 400));
      }
    } else if (code && user.twoFactorSecret) {
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) {
        return next(new AppError('验证码错误', 400));
      }
    } else {
      return next(new AppError('重新生成恢复码需要验证密码或 2FA 验证码', 400));
    }

    const codes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(codes);
    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorRecoveryCodes: JSON.stringify(hashedCodes) },
    });

    await redisService.invalidateUserCache(req.userId as string);
    res.json({ recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

export const enable2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { code, password } = req.body;
  try {
    if (!password) {
      return next(new AppError('启用双重验证需要验证当前密码', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user || !user.twoFactorSecret) {
      return next(new AppError('无效的双重验证设置请求', 400));
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

    await redisService.invalidateUserCache(user.id);
    res.json({ message: '双重验证已启用' });
  } catch (error) {
    next(error);
  }
};

export const disable2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { code, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('用户不存在', 404));

    if (!user.twoFactorEnabled) {
      return next(new AppError('双重验证未启用', 400));
    }

    if (code) {
      if (!user.twoFactorSecret) {
        return next(new AppError('双重验证配置异常', 400));
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
      return next(new AppError('禁用双重验证需要提供验证码或密码', 400));
    }

    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    });

    await redisService.invalidateUserCache(req.userId as string);
    res.json({ message: '双重验证已禁用' });
  } catch (error) {
    next(error);
  }
};
