import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../../services/prisma';
import { generateRecoveryCodes, hashRecoveryCodes } from '../../utils/auth';
import { AppError } from '../../utils/error';
import { redisService } from '../../services/redis.service';

export const setup2FA = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const user = request.user!;
    if (!user) throw new AppError('Unauthorized', 401);

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `3D Learning Platform (${user.email})`,
    });

    const otpauth = secret.otpauth_url!;
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    const codes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(codes);

    await prisma.user.update({
      where: { id: request.userId as string },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorRecoveryCodes: JSON.stringify(hashedCodes),
      },
    });

    await redisService.invalidateUserCache(request.userId as string);
    reply.send({ qrCodeUrl, secret: secret.base32, recoveryCodes: codes });
  } catch (error) {
    throw error;
  }
};

export const getRecoveryCodes = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId as string },
      select: { twoFactorRecoveryCodes: true },
    });

    if (!user || !user.twoFactorRecoveryCodes) {
      throw new AppError('恢复码不存在', 404);
    }

    const recoveryCodes = JSON.parse(user.twoFactorRecoveryCodes) as string[];
    reply.send({ count: recoveryCodes.length });
  } catch (error) {
    throw error;
  }
};

export const regenerateRecoveryCodes = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { password, code } = (request.body as { password?: string; code?: string }) ?? {};
  try {
    const user = await prisma.user.findUnique({ where: { id: request.userId as string } });
    if (!user) throw new AppError('用户不存在', 404);

    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('密码错误', 400);
      }
    } else if (code && user.twoFactorSecret) {
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) {
        throw new AppError('验证码错误', 400);
      }
    } else {
      throw new AppError('重新生成恢复码需要验证密码或 2FA 验证码', 400);
    }

    const codes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(codes);
    await prisma.user.update({
      where: { id: request.userId as string },
      data: { twoFactorRecoveryCodes: JSON.stringify(hashedCodes) },
    });

    await redisService.invalidateUserCache(request.userId as string);
    reply.send({ recoveryCodes: codes });
  } catch (error) {
    throw error;
  }
};

export const enable2FA = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { code, password } = request.body as { code: string; password: string };
  try {
    if (!password) {
      throw new AppError('启用双重验证需要验证当前密码', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: request.userId as string } });
    if (!user || !user.twoFactorSecret) {
      throw new AppError('无效的双重验证设置请求', 400);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('密码错误', 400);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      throw new AppError('验证码错误', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    await redisService.invalidateUserCache(user.id);
    reply.send({ message: '双重验证已启用' });
  } catch (error) {
    throw error;
  }
};

export const disable2FA = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { code, password } = (request.body as { code?: string; password?: string }) ?? {};
  try {
    const user = await prisma.user.findUnique({ where: { id: request.userId as string } });
    if (!user) throw new AppError('用户不存在', 404);

    if (!user.twoFactorEnabled) {
      throw new AppError('双重验证未启用', 400);
    }

    if (code) {
      if (!user.twoFactorSecret) {
        throw new AppError('双重验证配置异常', 400);
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) {
        throw new AppError('验证码错误', 400);
      }
    } else if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('密码错误', 400);
      }
    } else {
      throw new AppError('禁用双重验证需要提供验证码或密码', 400);
    }

    await prisma.user.update({
      where: { id: request.userId as string },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    });

    await redisService.invalidateUserCache(request.userId as string);
    reply.send({ message: '双重验证已禁用' });
  } catch (error) {
    throw error;
  }
};
