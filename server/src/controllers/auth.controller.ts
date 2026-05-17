import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { config } from '../config/env';
import { sendEmail } from '../utils/email';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  generateAccessToken,
  generateRefreshToken,
  generateRecoveryCodes,
  sanitizeUser,
} from '../utils/auth';
import { settingsService } from '../services/settings.service';
import { auditService, AuditModule, AuditAction } from '../services/audit.service';

export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getAll();
    const publicSettings = {
      PLATFORM_NAME: settings.PLATFORM_NAME,
      ALLOW_REGISTRATION: settings.ALLOW_REGISTRATION,
      MAINTENANCE_MODE: settings.MAINTENANCE_MODE,
      MATERIAL_CATEGORIES: settings.MATERIAL_CATEGORIES,
    };
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(publicSettings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name, verificationCode } = req.body;
  try {
    // Check if registration is allowed
    const allowReg = await prisma.systemSetting.findUnique({
      where: { key: 'ALLOW_REGISTRATION' },
    });
    if (allowReg && (allowReg.value === 'false' || allowReg.value === '0')) {
      return res.status(403).json({ error: '目前平台已关闭新用户注册' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // Verify code
    const record = await prisma.verificationCode.findFirst({
      where: { email, code: verificationCode, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 使用事务同时创建用户、个人团队和加入公共团队
    const result = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            emailVerified: true,
          },
        });

        // Cleanup
        await tx.verificationCode.deleteMany({ where: { email } });

        // 1. 创建个人工作区（PERSONAL 类型团队）
        const personalTeam = await tx.team.create({
          data: {
            name: `${name || user.email} 的个人空间`,
            description: '个人专属创作与协作空间',
            type: 'PERSONAL',
            visibility: 'PRIVATE',
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        });

        // 2. 查找或创建公共空间 - 使用并发安全的方式
        let publicTeam = await tx.team.findUnique({
          where: { name_type: { name: '公共空间', type: 'TEAM' } },
        });

        if (!publicTeam) {
          // 尝试创建公共空间，如果并发创建失败则重新查找
          try {
            publicTeam = await tx.team.create({
              data: {
                name: '公共空间',
                description: '全站公共协作与创作空间',
                type: 'TEAM',
                visibility: 'PUBLIC',
                ownerId: user.id, // 第一个用户成为公共空间的所有者
                members: {
                  create: {
                    userId: user.id,
                    role: 'OWNER',
                  },
                },
              },
            });
          } catch (e) {
            // 如果唯一约束冲突，说明有其他请求先创建了公共空间，重新查找
            publicTeam = await tx.team.findUnique({
              where: { name_type: { name: '公共空间', type: 'TEAM' } },
            });
            if (!publicTeam) {
              throw e; // 如果还是找不到，抛出原始错误
            }
          }
        }

        // 将用户添加到公共团队作为成员
        if (publicTeam.ownerId !== user.id) {
          await tx.teamMember.upsert({
            where: {
              teamId_userId: {
                teamId: publicTeam.id,
                userId: user.id,
              },
            },
            update: {},
            create: {
              teamId: publicTeam.id,
              userId: user.id,
              role: 'MEMBER',
            },
          });
        }

        await auditService.log({
          userId: user.id,
          action: AuditAction.CREATE_USER,
          module: AuditModule.AUTH,
          description: `新用户注册: ${user.email}`,
          newValue: sanitizeUser(user),
          req,
          tx, // Pass transaction client
        });

        return { user, personalTeam };
      },
      {
        timeout: 10000, // Increase timeout to 10 seconds
      },
    );

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendPublicVerificationCode = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { email, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const subject = configData.EMAIL_VERIFY_SUBJECT || '您的邮箱验证码';
    let html =
      configData.EMAIL_VERIFY_BODY ||
      `<div style="padding: 20px; font-family: sans-serif;">
        <h2>验证您的邮箱</h2>
        <p>您好，您正在进行注册验证，验证码如下：</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">{{code}}</div>
        <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
      </div>`;

    html = html.replace('{{code}}', code);
    const text = `您的验证码是: ${code}。有效期 10 分钟。`;

    await sendEmail(email, subject, text, html);

    res.json({ message: '验证码已发送到您的邮箱' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: '无法发送邮件，请检查后端配置' });
  }
};

export const verifyPublicEmail = async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    res.json({ message: '邮箱验证成功' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password, deviceToken } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: '您的账号已被封禁，请联系管理员。' });
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
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              avatarUrl: user.avatarUrl,
              bio: user.bio,
              location: user.location,
              website: user.website,
              twoFactorEnabled: user.twoFactorEnabled,
              createdAt: user.createdAt,
            },
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        website: user.website,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login2FA = async (req: Request, res: Response) => {
  const { userId, code, rememberDevice } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: '您的账号已被封禁，请联系管理员。' });
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
      return res.status(400).json({ error: '验证码或恢复代码错误' });
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        website: user.website,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  let token = req.body?.refreshToken || req.cookies?.refreshToken || null;
  if (!token) return res.status(400).json({ error: 'Refresh token required' });

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
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Return only the fields the frontend expects
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    subscription: user.subscription,
  };

  res.json(safeUser);
};

export const setup2FA = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

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
    console.error('2FA Setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecoveryCodes = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { twoFactorRecoveryCodes: true },
    });

    if (!user || !user.twoFactorRecoveryCodes) {
      return res.status(404).json({ error: 'Recovery codes not found' });
    }

    res.json({ recoveryCodes: JSON.parse(user.twoFactorRecoveryCodes) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateRecoveryCodes = async (req: AuthRequest, res: Response) => {
  try {
    const codes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorRecoveryCodes: JSON.stringify(codes) },
    });
    res.json({ recoveryCodes: codes });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const enable2FA = async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ error: '验证码错误' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    res.json({ message: '两步验证已启用' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const disable2FA = async (req: AuthRequest, res: Response) => {
  const { code, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '两步验证未启用' });
    }

    if (code) {
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: '配置异常，请联系管理员' });
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) {
        return res.status(400).json({ error: '验证码错误' });
      }
    } else if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: '密码错误' });
      }
    } else {
      return res
        .status(400)
        .json({ error: '禁用两步验证需要提供验证码或密码', verificationRequired: true });
    }

    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    res.json({ message: '两步验证已禁用' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const { name, bio, location, website } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.userId as string },
      data: { name, bio, location, website },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        bio: true,
        location: true,
        website: true,
        role: true,
        twoFactorEnabled: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    await auditService.log({
      userId: user.id,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.AUTH,
      description: '用户修改了登录密码',
      req,
    });

    res.json({ message: '密码已成功修改' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendVerificationCode = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB
    await prisma.verificationCode.create({
      data: { email: user.email, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const subject = configData.EMAIL_VERIFY_SUBJECT || '您的邮箱验证码';
    let html =
      configData.EMAIL_VERIFY_BODY ||
      `<div style="padding: 20px; font-family: sans-serif;">
        <h2>验证您的邮箱</h2>
        <p>您好，您正在进行邮箱验证，验证码如下：</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">{{code}}</div>
        <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
      </div>`;

    html = html.replace('{{code}}', code);
    const text = `您的验证码是: ${code}。有效期 10 分钟。`;

    await sendEmail(user.email, subject, text, html);

    res.json({ message: '验证码已发送到您的邮箱' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: '无法发送邮件，请检查后端配置' });
  }
};

export const verifyEmail = async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  try {
    const user = req.user!;
    const record = await prisma.verificationCode.findFirst({
      where: {
        email: user.email,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Clean up used code and all expired codes for this email
    await prisma.$transaction([
      prisma.verificationCode.delete({ where: { id: record.id } }),
      prisma.verificationCode.deleteMany({
        where: {
          email: user.email,
          expiresAt: { lt: new Date() },
        },
      }),
    ]);

    res.json({ message: '邮箱验证成功' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendCodeToNewEmail = async (req: AuthRequest, res: Response) => {
  const { newEmail } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被占用' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { email: newEmail, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const subject = configData.EMAIL_CHANGE_SUBJECT || '您的新邮箱验证码';
    let html =
      configData.EMAIL_CHANGE_BODY ||
      `<div style="padding: 20px; font-family: sans-serif;">
        <h2>更改您的邮箱</h2>
        <p>您好，您正在尝试将账号邮箱更改为 {{newEmail}}，验证码如下：</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">{{code}}</div>
        <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
      </div>`;

    html = html.replace('{{code}}', code).replace('{{newEmail}}', newEmail);
    const text = `您的验证码是: ${code}。有效期 10 分钟。`;

    await sendEmail(newEmail, subject, text, html);

    res.json({ message: '验证码已发送到新邮箱' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: '无法发送邮件，请检查后端配置' });
  }
};

export const changeEmail = async (req: AuthRequest, res: Response) => {
  const { newEmail, code } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被占用' });
    }

    const record = await prisma.verificationCode.findFirst({
      where: {
        email: newEmail,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId as string },
      data: {
        email: newEmail,
        emailVerified: true,
      },
    });

    await auditService.log({
      userId: updatedUser.id,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.AUTH,
      description: `用户更换了登录邮箱: ${newEmail}`,
      newValue: { email: newEmail },
      req,
    });

    await prisma.verificationCode.delete({ where: { id: record.id } });

    res.json({
      message: '邮箱已成功更换',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPasswordCheck = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }
    res.json({ twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPasswordWith2FA = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return res.status(400).json({ error: '无效请求，该账户未启用两步验证' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ error: '验证码错误' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await auditService.log({
      userId: user.id,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.AUTH,
      description: `用户重置了登录密码 (2FA 验证): ${user.email}`,
      req,
    });

    res.json({ message: '密码已成功重置' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: req.userId as string },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        bio: true,
        location: true,
        website: true,
        role: true,
        twoFactorEnabled: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicUsers = async (req: AuthRequest, res: Response) => {
  const { search } = req.query;

  // Only admins can see the full platform member list
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '只有管理员可以查看平台成员列表' });
  }

  try {
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search as string } },
              { email: { contains: search as string } },
            ],
          }
        : {},
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        subscription: {
          include: { plan: true },
        },
      },
      take: 50, // Increased limit for admins
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: id as any },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        bio: true,
        location: true,
        website: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            assets: true,
            discussions: true,
            showcases: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActivity = async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  try {
    const where: any = {};
    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const [assets, discussions, enrollments, showcases] = await Promise.all([
      prisma.asset.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              subscription: { include: { plan: true } },
            },
          },
        },
      }),
      prisma.discussion.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              subscription: { include: { plan: true } },
            },
          },
        },
      }),
      prisma.enrollment.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              subscription: { include: { plan: true } },
            },
          },
          course: { select: { title: true } },
        },
      }),
      prisma.showcase.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              subscription: { include: { plan: true } },
            },
          },
        },
      }),
    ]);

    const activities = [
      ...assets.map((a) => ({
        id: `a-${a.id}`,
        user: a.user,
        action: '发布了新资产',
        target: a.title,
        createdAt: a.createdAt,
      })),
      ...discussions.map((d) => ({
        id: `d-${d.id}`,
        user: d.user,
        action: '发起了新讨论',
        target: d.title,
        createdAt: d.createdAt,
      })),
      ...enrollments.map((e) => ({
        id: `e-${e.id}`,
        user: e.user,
        action: '加入了新课程',
        target: e.course.title,
        createdAt: e.createdAt,
      })),
      ...showcases.map((s) => ({
        id: `s-${s.id}`,
        user: s.user,
        action: '发布了新作品',
        target: s.title,
        createdAt: s.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    res.json(activities);
  } catch (error) {
    console.error('[Auth] Get activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.userSetting.findMany({
      where: { userId: req.userId as string },
    });
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserSettings = async (req: AuthRequest, res: Response) => {
  const { settings } = req.body;
  try {
    const updates = settings.map((s: { key: string; value: string }) =>
      prisma.userSetting.upsert({
        where: { userId_key: { userId: req.userId as string, key: s.key } },
        update: { value: s.value },
        create: { userId: req.userId as string, key: s.key, value: s.value },
      }),
    );
    await Promise.all(updates);
    res.json({ message: '设置已成功保存' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTrustedDevices = async (req: AuthRequest, res: Response) => {
  try {
    const devices = await prisma.trustedDevice.findMany({
      where: { userId: req.userId as string },
      select: { id: true, createdAt: true },
    });
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const revokeTrustedDevice = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const device = await prisma.trustedDevice.findUnique({ where: { id: id as any } });
    if (!device) {
      return res.status(404).json({ error: '设备不存在' });
    }
    if (device.userId !== req.userId) {
      return res.status(403).json({ error: '无权操作此设备' });
    }
    await prisma.trustedDevice.delete({ where: { id: id as any } });
    res.json({ message: '设备已移除' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  const { twoFactorCode, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(400).json({ error: '需要两步验证码', twoFactorRequired: true });
      }
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: '两步验证配置异常' });
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });
      if (!isValid) {
        return res.status(400).json({ error: '两步验证码错误' });
      }
    } else {
      if (!password) {
        return res.status(400).json({ error: '删除账号需要验证密码', passwordRequired: true });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: '密码错误' });
      }
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: '不能删除最后一个管理员账户' });
      }
    }

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_USER,
      module: AuditModule.AUTH,
      description: `用户注销了账户: ${user.email}`,
      oldValue: sanitizeUser(user),
      req,
    });

    await prisma.user.delete({ where: { id: req.userId as string } });
    res.json({ message: '账户已成功删除' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  try {
    const userId = req.userId as string;

    const assetCount = await prisma.asset.count({
      where: { userId },
    });

    const taskCount = await prisma.task.count({
      where: { userId, status: 'TODO' },
    });

    const feedbackCount = await prisma.feedback.count({
      where: { userId },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
    });

    const totalProgress =
      enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
        : 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const fourteenDaysAgo = new Date(sevenDaysAgo);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 7);

    const [recentAssets, prevAssets] = await Promise.all([
      prisma.asset.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.asset.count({
        where: { userId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
    ]);

    const [recentTasks, prevTasks] = await Promise.all([
      prisma.task.count({ where: { userId, status: 'TODO', createdAt: { gte: sevenDaysAgo } } }),
      prisma.task.count({
        where: { userId, status: 'TODO', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
    ]);

    const [recentFeedbacks, prevFeedbacks] = await Promise.all([
      prisma.feedback.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.feedback.count({
        where: { userId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
    ]);

    const computeTrend = (current: number, previous: number): string => {
      if (previous === 0 && current === 0) return '0';
      if (previous === 0) return `+${current}`;
      const diff = current - previous;
      const pct = Math.round((diff / previous) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    res.json({
      assetCount,
      taskCount,
      feedbackCount,
      learningProgress: `${totalProgress}%`,
      trends: {
        assets: computeTrend(recentAssets, prevAssets),
        tasks: computeTrend(recentTasks, prevTasks),
        feedbacks: computeTrend(recentFeedbacks, prevFeedbacks),
        learning: totalProgress > 0 ? `+${totalProgress}%` : '0%',
      },
    });
  } catch (error) {
    console.error('[Auth] Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
