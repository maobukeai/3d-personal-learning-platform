import { logger } from '../../utils/logger';
import { Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { sendEmail } from '../../utils/email';
import { sanitizeUser } from '../../utils/auth';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { redisService } from '../../services/redis.service';
import { getShanghaiStartOfDay, getShanghaiEndOfDay } from '../../utils/date';
import { TaskStatus } from '../../types/task';

const ACCOUNT_EXPORT_ITEM_LIMIT = 200;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type RecentDayBucket = {
  date: Date;
  key: string;
  learning: number;
  tasks: number;
  content: number;
  community: number;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

const safeJsonArrayLength = (value?: string | null) => {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return value
      .split(/[,，;；\s]+/)
      .map((item) => item.trim())
      .filter(Boolean).length;
  }
};

const buildRecentDayBuckets = (days = 14): RecentDayBucket[] => {
  const today = getShanghaiStartOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * MS_PER_DAY);
    return {
      date,
      key: formatDayKey(date),
      learning: 0,
      tasks: 0,
      content: 0,
      community: 0,
    };
  });
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await redisService.invalidateUserCache(req.userId as string);
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('User not found', 404));

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return next(new AppError('当前密码错误', 400));
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    await redisService.invalidateUserCache(user.id);

    await auditService.log({
      userId: user.id,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.AUTH,
      description: '用户修改了登录密码',
      req,
    });

    res.json({ message: '密码已成功修改' });
  } catch (error) {
    next(error);
  }
};

export const sendVerificationCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB
    await prisma.verificationCode.create({
      data: { email: user.email, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce(
      (acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value || '';
        return acc;
      },
      {} as Record<string, string>,
    );

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
    logger.error('Email send error:', error);
    next(new AppError('无法发送邮件，请检查后端配置', 500));
  }
};

export const verifyEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      return next(new AppError('验证码错误或已过期', 400));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await redisService.invalidateUserCache(user.id);

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
    logger.error('Verify email error:', error);
    next(error);
  }
};

export const sendCodeToNewEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { newEmail } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return next(new AppError('该邮箱已被占用', 400));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { email: newEmail, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce(
      (acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value || '';
        return acc;
      },
      {} as Record<string, string>,
    );

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

    await sendEmail(newEmail, subject, text, html);

    res.json({ message: '验证码已发送到新邮箱' });
  } catch (error) {
    logger.error('Email send error:', error);
    next(new AppError('无法发送邮件，请检查后端配置', 500));
  }
};

export const changeEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { newEmail, code } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return next(new AppError('该邮箱已被占用', 400));
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
      return next(new AppError('验证码错误或已过期', 400));
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId as string },
      data: {
        email: newEmail,
        emailVerified: true,
      },
    });

    await redisService.invalidateUserCache(req.userId as string);

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
    next(error);
  }
};

export const forgotPasswordCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.twoFactorEnabled) {
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.verificationCode.create({
        data: { email, code: resetCode, expiresAt },
      });

      await sendEmail(
        email,
        'Password reset verification code',
        `Your password reset code is ${resetCode}. It expires in 10 minutes.`,
        `<p>Your password reset code is <strong>${resetCode}</strong>.</p><p>It expires in 10 minutes.</p>`,
      );
    }

    res.json({
      message:
        'If the account exists and supports password reset, a verification code has been sent.',
      twoFactorEnabled: true,
      requiresEmailCode: true,
    });
  } catch (error) {
    logger.error('Forgot password check error:', error);
    next(error);
  }
};

export const resetPasswordWith2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, resetCode, twoFactorCode, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return next(new AppError('无效请求，该账户未启用两步验证', 400));
    }

    const resetRecord = await prisma.verificationCode.findFirst({
      where: {
        email,
        code: resetCode,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      return next(new AppError('邮箱验证码错误或已过期', 400));
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 1,
    });

    if (!isValid) {
      return next(new AppError('验证码错误', 400));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await prisma.verificationCode.delete({ where: { id: resetRecord.id } });
    await redisService.invalidateUserCache(user.id);

    await auditService.log({
      userId: user.id,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.AUTH,
      description: `用户通过邮箱验证码和 2FA 重置了登录密码: ${user.email}`,
      req,
    });

    res.json({ message: '密码已成功重置' });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const avatarUrl =
      (req.file as any).url ||
      `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

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

    await redisService.invalidateUserCache(req.userId as string);
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const getPublicUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { search } = req.query;

  // Only admins can see the full platform member list
  if (req.user?.role !== 'ADMIN') {
    return next(new AppError('只有管理员可以查看平台成员列表', 403));
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
    next(error);
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
      return next(new AppError('User not found', 404));
    }

    res.json(user);
  } catch (error) {
    logger.error('Get user profile error:', error);
    next(error);
  }
};

export const getActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { date } = req.query;
  try {
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (date) {
      const parsedDate = new Date(date as string);
      if (isNaN(parsedDate.getTime())) {
        return next(new AppError('无效的日期格式', 400));
      }
      const startOfDay = getShanghaiStartOfDay(parsedDate);
      const endOfDay = getShanghaiEndOfDay(parsedDate);
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
    logger.error('[Auth] Get activity error:', error);
    next(error);
  }
};

export const getUserSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.userSetting.findMany({
      where: { userId: req.userId as string },
    });
    const config = settings.reduce(
      (acc: Record<string, string>, curr) => {
        acc[curr.key] = curr.value || '';
        return acc;
      },
      {} as Record<string, string>,
    );
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const updateUserSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { settings } = req.body;
  try {
    if (!Array.isArray(settings)) {
      return next(new AppError('设置数据格式错误', 400));
    }
    const normalizedSettings = settings.map((s: { key?: unknown; value?: unknown }) => ({
      key: typeof s.key === 'string' ? s.key.trim() : '',
      value: typeof s.value === 'string' ? s.value : '',
    }));

    const hasInvalidSetting = normalizedSettings.some(
      (s) => !/^[A-Za-z0-9_.:-]{1,80}$/.test(s.key) || s.value.length > 5000,
    );

    if (hasInvalidSetting) {
      return next(new AppError('Invalid user setting key or value', 400));
    }

    const updates = normalizedSettings.map((s) =>
      prisma.userSetting.upsert({
        where: { userId_key: { userId: req.userId as string, key: s.key } },
        update: { value: s.value },
        create: { userId: req.userId as string, key: s.key, value: s.value },
      }),
    );
    await prisma.$transaction(updates);
    res.json({ message: '设置已成功保存' });
  } catch (error) {
    next(error);
  }
};

export const getTrustedDevices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const devices = await prisma.trustedDevice.findMany({
      where: { userId: req.userId as string },
      select: { id: true, createdAt: true },
    });
    res.json(devices);
  } catch (error) {
    next(error);
  }
};

export const revokeTrustedDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const device = await prisma.trustedDevice.findUnique({ where: { id } });
    if (!device) {
      return next(new AppError('设备不存在', 404));
    }
    if (device.userId !== req.userId) {
      return next(new AppError('无权操作此设备', 403));
    }
    await prisma.trustedDevice.delete({ where: { id } });
    res.json({ message: '设备已移除' });
  } catch (error) {
    next(error);
  }
};

export const exportAccountData = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const [
      profile,
      userSettings,
      notificationPreferences,
      teamMemberships,
      assets,
      projectMemberships,
      notes,
      discussions,
      showcases,
      assetCount,
      projectCount,
      noteCount,
      discussionCount,
      showcaseCount,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          bio: true,
          location: true,
          website: true,
          role: true,
          status: true,
          points: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userSetting.findMany({
        where: { userId },
        select: { key: true, value: true, updatedAt: true },
      }),
      prisma.notificationPreference.findUnique({
        where: { userId },
      }),
      prisma.teamMember.findMany({
        where: { userId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              visibility: true,
              category: true,
              ownerId: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { members: true, projects: true, tasks: true } },
            },
          },
        },
      }),
      prisma.asset.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACCOUNT_EXPORT_ITEM_LIMIT,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          url: true,
          thumbnail: true,
          tags: true,
          downloads: true,
          likes: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.projectMember.findMany({
        where: { userId },
        orderBy: { joinedAt: 'desc' },
        take: ACCOUNT_EXPORT_ITEM_LIMIT,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              progress: true,
              status: true,
              dueDate: true,
              teamId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      prisma.note.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACCOUNT_EXPORT_ITEM_LIMIT,
        select: {
          id: true,
          title: true,
          summary: true,
          visibility: true,
          tags: true,
          category: true,
          views: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.discussion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACCOUNT_EXPORT_ITEM_LIMIT,
        select: {
          id: true,
          title: true,
          tags: true,
          isPinned: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.showcase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: ACCOUNT_EXPORT_ITEM_LIMIT,
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          type: true,
          thumbnailUrl: true,
          status: true,
          views: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.asset.count({ where: { userId } }),
      prisma.projectMember.count({ where: { userId } }),
      prisma.note.count({ where: { userId } }),
      prisma.discussion.count({ where: { userId } }),
      prisma.showcase.count({ where: { userId } }),
    ]);

    if (!profile) {
      return next(new AppError('用户不存在', 404));
    }

    const settingsMap = userSettings.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    const teams = teamMemberships.map((membership) => ({
      role: membership.role,
      joinedAt: membership.joinedAt,
      team: membership.team,
    }));
    const projects = projectMemberships.map((membership) => ({
      role: membership.role,
      joinedAt: membership.joinedAt,
      project: membership.project,
    }));

    res.json({
      exportDate: new Date().toISOString(),
      profile,
      userSettings: settingsMap,
      notificationPreferences,
      teams,
      assets,
      projects,
      notes,
      discussions,
      showcases,
      counts: {
        teams: teams.length,
        assets: assetCount,
        projects: projectCount,
        notes: noteCount,
        discussions: discussionCount,
        showcases: showcaseCount,
      },
      exportedCounts: {
        teams: teams.length,
        assets: assets.length,
        projects: projects.length,
        notes: notes.length,
        discussions: discussions.length,
        showcases: showcases.length,
      },
      exportLimits: {
        perCollection: ACCOUNT_EXPORT_ITEM_LIMIT,
      },
      truncated: {
        assets: assets.length < assetCount,
        projects: projects.length < projectCount,
        notes: notes.length < noteCount,
        discussions: discussions.length < discussionCount,
        showcases: showcases.length < showcaseCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { twoFactorCode, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) {
      return next(new AppError('用户不存在', 404));
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(400).json({ error: '需要两步验证码', twoFactorRequired: true });
      }
      if (!user.twoFactorSecret) {
        return next(new AppError('两步验证配置异常', 400));
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });
      if (!isValid) {
        return next(new AppError('两步验证码错误', 400));
      }
    } else {
      if (!password) {
        return res.status(400).json({ error: '删除账号需要验证密码', passwordRequired: true });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(new AppError('密码错误', 400));
      }
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return next(new AppError('不能删除最后一个管理员账户', 400));
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
    await redisService.invalidateUserCache(req.userId as string);
    res.json({ message: '账户已成功删除' });
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const selectedDate = typeof req.query.date === 'string' ? new Date(req.query.date) : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return next(new AppError('无效的日期格式', 400));
    }

    const realWorkspaceId =
      req.workspaceId &&
      req.workspaceId !== 'admin-workspace' &&
      !req.workspaceId.startsWith('mirror-') &&
      !req.workspaceId.startsWith('manual-')
        ? req.workspaceId
        : undefined;

    const selectedDayStart = getShanghaiStartOfDay(selectedDate);
    const selectedDayEnd = getShanghaiEndOfDay(selectedDate);
    const todayStart = getShanghaiStartOfDay(new Date());
    const todayEnd = getShanghaiEndOfDay(new Date());
    const sevenDaysAgo = getShanghaiStartOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = getShanghaiStartOfDay(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
    const now = new Date();

    const assetWhere: Prisma.AssetWhereInput = {
      userId,
      ...(realWorkspaceId ? { teamId: realWorkspaceId } : {}),
    };

    const taskAccessWhere: Prisma.TaskWhereInput = {
      ...(realWorkspaceId ? { teamId: realWorkspaceId } : {}),
      OR: [
        { userId },
        { assigneeId: userId },
        { participants: { some: { userId } } },
        { project: { members: { some: { userId } } } },
      ],
    };

    const projectWhere: Prisma.ProjectWhereInput = {
      ...(realWorkspaceId ? { teamId: realWorkspaceId } : {}),
      members: { some: { userId } },
    };

    const [
      assetCount,
      taskCount,
      totalTasks,
      inProgressTasks,
      doneTasks,
      overdueTasks,
      dueTodayTasks,
      dueSelectedDayTasks,
      completedTodayTasks,
      feedbackCount,
      assetEngagement,
      pendingAssets,
      approvedAssets,
      activeProjects,
      stalledProjects,
      recentProjects,
      urgentTasks,
    ] = await Promise.all([
      prisma.asset.count({ where: assetWhere }),
      prisma.task.count({ where: { ...taskAccessWhere, status: TaskStatus.TODO } }),
      prisma.task.count({ where: taskAccessWhere }),
      prisma.task.count({ where: { ...taskAccessWhere, status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { ...taskAccessWhere, status: TaskStatus.DONE } }),
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          status: { not: TaskStatus.DONE },
          dueDate: { lt: todayStart },
        },
      }),
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          status: { not: TaskStatus.DONE },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          dueDate: { gte: selectedDayStart, lte: selectedDayEnd },
        },
      }),
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          status: TaskStatus.DONE,
          updatedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.feedback.count({ where: { userId } }),
      prisma.asset.aggregate({
        where: assetWhere,
        _sum: { viewCount: true, likes: true, downloads: true },
      }),
      prisma.asset.count({ where: { ...assetWhere, status: 'PENDING' } }),
      prisma.asset.count({ where: { ...assetWhere, status: 'APPROVED' } }),
      prisma.project.count({ where: { ...projectWhere, status: { not: 'COMPLETED' } } }),
      prisma.project.count({
        where: {
          ...projectWhere,
          status: { not: 'COMPLETED' },
          dueDate: { lt: now },
          progress: { lt: 100 },
        },
      }),
      prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          title: true,
          progress: true,
          status: true,
          dueDate: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      prisma.task.findMany({
        where: { ...taskAccessWhere, status: { not: TaskStatus.DONE } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, title: true, color: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
      }),
    ]);

    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const activeProgresses: number[] = [];

    // 1. Platform Course Progress Dimension
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
    });
    if (enrollments.length > 0) {
      const courseProgress =
        enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length;
      activeProgresses.push(courseProgress);
    }

    // 2. Learning Path Steps Progress Dimension
    const roadmaps = await prisma.roadmap.findMany({
      where: {
        OR: [{ creatorId: null }, { creatorId: userId }],
      },
      include: {
        steps: true,
      },
    });
    const totalSteps = roadmaps.reduce((sum, r) => sum + r.steps.length, 0);
    if (totalSteps > 0) {
      const stepProgresses = await prisma.userRoadmapProgress.findMany({
        where: {
          userId,
          completed: true,
          roadmapStepId: {
            in: roadmaps.flatMap((r) => r.steps.map((s) => s.id)),
          },
        },
      });
      const completedSteps = stepProgresses.length;
      const roadmapProgress = (completedSteps / totalSteps) * 100;
      activeProgresses.push(roadmapProgress);
    }

    // 3. Workbench Daily Tasks Progress Dimension
    const allTasks = await prisma.task.findMany({
      where: { userId },
    });
    if (allTasks.length > 0) {
      const completedTasks = allTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const taskProgress = (completedTasks / allTasks.length) * 100;
      activeProgresses.push(taskProgress);
    }

    // Compute the final multi-dimensional average (dynamic weighting)
    const totalProgress =
      activeProgresses.length > 0
        ? Math.round(activeProgresses.reduce((sum, p) => sum + p, 0) / activeProgresses.length)
        : 0;

    const [recentAssets, prevAssets] = await Promise.all([
      prisma.asset.count({ where: { ...assetWhere, createdAt: { gte: sevenDaysAgo } } }),
      prisma.asset.count({
        where: { ...assetWhere, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
    ]);

    const [recentTasks, prevTasks] = await Promise.all([
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          status: { not: TaskStatus.DONE },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.task.count({
        where: {
          ...taskAccessWhere,
          status: { not: TaskStatus.DONE },
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    const points = user?.points ?? 50;

    // Calculate points earned in the last 7 days
    const [
      recentDiscussionsCount,
      recentCommentsCount,
      recentDiscussionLikesCount,
      recentCommentLikesCount,
      recentShowcaseLikesCount,
      recentCompletedLessonsCount,
      recentCompletedTasksCount,
      recentShowcasesCount,
    ] = await Promise.all([
      prisma.discussion.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.comment.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.discussionLike.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.commentLike.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.showcaseLike.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.lessonProgress.count({
        where: { userId, completed: true, completedAt: { gte: sevenDaysAgo } },
      }),
      prisma.task.count({
        where: { userId, status: TaskStatus.DONE, updatedAt: { gte: sevenDaysAgo } },
      }),
      prisma.showcase.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
    ]);

    const pointsTrendValue =
      recentDiscussionsCount * 15 +
      recentCommentsCount * 5 +
      (recentDiscussionLikesCount + recentCommentLikesCount + recentShowcaseLikesCount) * 2 +
      recentCompletedLessonsCount * 30 +
      recentCompletedTasksCount * 20 +
      recentShowcasesCount * 50;

    const userRank =
      (await prisma.user.count({
        where: {
          status: 'ACTIVE',
          points: { gt: points },
        },
      })) + 1;

    const assetEngagementTotal =
      (assetEngagement._sum.viewCount ?? 0) +
      (assetEngagement._sum.likes ?? 0) +
      (assetEngagement._sum.downloads ?? 0);
    const activeEnrollmentCount = enrollments.filter(
      (enrollment) => enrollment.progress < 100,
    ).length;
    const focusScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          totalProgress * 0.35 +
            completionRate * 0.35 +
            Math.min(assetCount * 8, 30) -
            overdueTasks * 10 -
            stalledProjects * 8,
        ),
      ),
    );

    const dashboardInsights: Array<{
      id: string;
      tone: 'danger' | 'warning' | 'success' | 'info';
      title: string;
      detail: string;
      route: string;
      action: string;
    }> = [];

    if (overdueTasks > 0) {
      dashboardInsights.push({
        id: 'overdue-tasks',
        tone: 'danger',
        title: `有 ${overdueTasks} 个任务已经逾期`,
        detail: '优先处理这些阻塞项，可以立刻改善项目节奏。',
        route: '/work',
        action: '处理任务',
      });
    } else if (dueTodayTasks > 0) {
      dashboardInsights.push({
        id: 'today-tasks',
        tone: 'warning',
        title: `今天有 ${dueTodayTasks} 个任务到期`,
        detail: '建议先完成最小交付，再整理剩余任务。',
        route: '/work',
        action: '查看今日',
      });
    } else {
      dashboardInsights.push({
        id: 'task-health',
        tone: 'success',
        title: '任务节奏稳定',
        detail:
          completedTodayTasks > 0
            ? `今天已完成 ${completedTodayTasks} 个任务。`
            : '今天还没有完成记录，可以先推进一个小任务。',
        route: '/work',
        action: '打开看板',
      });
    }

    if (activeEnrollmentCount === 0) {
      dashboardInsights.push({
        id: 'no-active-course',
        tone: 'info',
        title: '还没有正在推进的课程',
        detail: '选择一条主线课程，能让作品和项目更容易持续产出。',
        route: '/academy',
        action: '选课程',
      });
    } else {
      dashboardInsights.push({
        id: 'course-progress',
        tone: totalProgress >= 60 ? 'success' : 'info',
        title: `学习综合进度 ${totalProgress}%`,
        detail: `当前有 ${activeEnrollmentCount} 门课程仍在推进中。`,
        route: '/academy',
        action: '继续学',
      });
    }

    if (pendingAssets > 0) {
      dashboardInsights.push({
        id: 'pending-assets',
        tone: 'warning',
        title: `${pendingAssets} 件作品等待审核`,
        detail: '补全封面、标签和说明，可以提升审核与展示质量。',
        route: '/my-works',
        action: '管理作品',
      });
    } else if (assetCount === 0) {
      dashboardInsights.push({
        id: 'no-assets',
        tone: 'info',
        title: '作品库还没有沉淀',
        detail: '上传第一个模型或展示图，让学习成果进入可复用资产库。',
        route: '/my-works',
        action: '上传作品',
      });
    } else {
      dashboardInsights.push({
        id: 'asset-engagement',
        tone: 'success',
        title: `作品累计互动 ${assetEngagementTotal}`,
        detail: `${approvedAssets} 件作品已通过审核，可继续整理高质量封面。`,
        route: '/my-works',
        action: '看作品',
      });
    }

    if (stalledProjects > 0) {
      dashboardInsights.push({
        id: 'stalled-projects',
        tone: 'danger',
        title: `${stalledProjects} 个项目存在延期风险`,
        detail: '检查项目截止日期和任务拆分，优先恢复交付节奏。',
        route: '/projects',
        action: '看项目',
      });
    } else if (activeProjects === 0) {
      dashboardInsights.push({
        id: 'no-projects',
        tone: 'info',
        title: '还没有活跃项目',
        detail: '把课程练习升级成项目，更适合团队协作和作品沉淀。',
        route: '/projects',
        action: '建项目',
      });
    }

    res.json({
      assetCount,
      taskCount,
      feedbackCount,
      learningProgress: `${totalProgress}%`,
      points,
      focusScore,
      selectedDate: selectedDate.toISOString(),
      taskSummary: {
        total: totalTasks,
        todo: taskCount,
        inProgress: inProgressTasks,
        done: doneTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        dueSelectedDay: dueSelectedDayTasks,
        completedToday: completedTodayTasks,
        completionRate,
      },
      assetSummary: {
        total: assetCount,
        pending: pendingAssets,
        approved: approvedAssets,
        views: assetEngagement._sum.viewCount ?? 0,
        likes: assetEngagement._sum.likes ?? 0,
        downloads: assetEngagement._sum.downloads ?? 0,
        engagement: assetEngagementTotal,
      },
      projectSummary: {
        active: activeProjects,
        stalled: stalledProjects,
        recent: recentProjects,
      },
      learningSummary: {
        enrollments: enrollments.length,
        activeEnrollments: activeEnrollmentCount,
        completedLessonsThisWeek: recentCompletedLessonsCount,
        progress: totalProgress,
      },
      communitySummary: {
        rank: userRank,
        points,
        pointsThisWeek: pointsTrendValue,
      },
      urgentTasks,
      insights: dashboardInsights.slice(0, 4),
      weeklyMomentum: {
        assets: recentAssets,
        tasks: recentTasks,
        discussions: recentDiscussionsCount,
        comments: recentCommentsCount,
        showcases: recentShowcasesCount,
        completedLessons: recentCompletedLessonsCount,
        completedTasks: recentCompletedTasksCount,
        points: pointsTrendValue,
      },
      trends: {
        assets: computeTrend(recentAssets, prevAssets),
        tasks: computeTrend(recentTasks, prevTasks),
        feedbacks: computeTrend(recentFeedbacks, prevFeedbacks),
        learning: totalProgress > 0 ? `+${totalProgress}%` : '0%',
        points: `+${pointsTrendValue}`,
      },
    });
  } catch (error) {
    logger.error('[Auth] Get stats error:', error);
    next(error);
  }
};

export const getWorkbench = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId || null;
    const todayStart = getShanghaiStartOfDay(new Date());
    const todayEnd = getShanghaiEndOfDay(new Date());
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * MS_PER_DAY);
    const fourteenDaysAgo = new Date(todayStart.getTime() - 14 * MS_PER_DAY);
    const nextSevenDays = new Date(todayEnd.getTime() + 7 * MS_PER_DAY);
    const recentBuckets = buildRecentDayBuckets(14);
    const bucketByKey = new Map(recentBuckets.map((bucket) => [bucket.key, bucket]));

    const taskWhere: Prisma.TaskWhereInput = {
      teamId: workspaceId,
      OR: [
        { projectId: null },
        {
          project: {
            members: {
              some: { userId },
            },
          },
        },
      ],
    };

    const projectWhere: Prisma.ProjectWhereInput = {
      teamId: workspaceId,
      OR: [
        { visibility: 'PUBLIC' },
        {
          members: {
            some: { userId },
          },
        },
      ],
    };

    const contentWhere = {
      teamId: workspaceId,
    };

    const [
      user,
      totalTasks,
      todoTasks,
      inProgressTasks,
      doneTasks,
      overdueTasks,
      dueTodayTasks,
      urgentTasks,
      assignedToMeTasks,
      recentDoneTasks,
      prevDoneTasks,
      recentTaskRows,
      projects,
      enrollments,
      lessonProgressRows,
      roadmaps,
      completedRoadmapSteps,
      assetCount,
      approvedAssetCount,
      pendingAssetCount,
      rejectedAssetCount,
      missingThumbAssetCount,
      materialCount,
      showcaseCount,
      pluginCount,
      assetTypeGroups,
      recentAssets,
      notesCount,
      publicNotesCount,
      discussionCount,
      projectDiscussionCount,
      unreadNotifications,
      unreadMessages,
      teamMemberCount,
      aiBotCount,
      recentLearningRows,
      recentAssetRows,
      recentShowcaseRows,
      recentDiscussionRows,
      recentProjectDiscussionRows,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          points: true,
          createdAt: true,
        },
      }),
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { ...taskWhere, status: TaskStatus.TODO } }),
      prisma.task.count({ where: { ...taskWhere, status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { ...taskWhere, status: TaskStatus.DONE } }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: TaskStatus.DONE },
          dueDate: { lt: todayStart },
        },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: TaskStatus.DONE },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: TaskStatus.DONE },
          priority: { in: ['HIGH', 'URGENT'] },
        },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: TaskStatus.DONE },
          assigneeId: userId,
        },
      }),
      prisma.task.count({
        where: { ...taskWhere, status: TaskStatus.DONE, updatedAt: { gte: sevenDaysAgo } },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: TaskStatus.DONE,
          updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
      prisma.task.findMany({
        where: { ...taskWhere, updatedAt: { gte: fourteenDaysAgo } },
        select: { updatedAt: true, status: true },
        take: 1000,
      }),
      prisma.project.findMany({
        where: projectWhere,
        take: 8,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          progress: true,
          status: true,
          dueDate: true,
          color: true,
          updatedAt: true,
          tasks: {
            select: { id: true, status: true, priority: true, dueDate: true, updatedAt: true },
          },
          members: {
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          roadmap: {
            select: {
              id: true,
              title: true,
              steps: { select: { id: true } },
            },
          },
        },
      }),
      prisma.enrollment.findMany({
        where: { userId, teamId: workspaceId },
        take: 6,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          courseId: true,
          progress: true,
          updatedAt: true,
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              difficulty: true,
              _count: { select: { lessons: true, reviews: true } },
            },
          },
        },
      }),
      prisma.lessonProgress.findMany({
        where: { userId, completed: true },
        select: { lessonId: true, completedAt: true, updatedAt: true },
        take: 2000,
      }),
      prisma.roadmap.findMany({
        where: {
          OR: [{ creatorId: null }, { creatorId: userId }, { project: projectWhere }],
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          steps: { select: { id: true } },
        },
        take: 20,
      }),
      prisma.userRoadmapProgress.findMany({
        where: { userId, completed: true },
        select: { roadmapStepId: true, updatedAt: true },
        take: 2000,
      }),
      prisma.asset.count({ where: contentWhere }),
      prisma.asset.count({ where: { ...contentWhere, status: 'APPROVED' } }),
      prisma.asset.count({ where: { ...contentWhere, status: 'PENDING' } }),
      prisma.asset.count({ where: { ...contentWhere, status: 'REJECTED' } }),
      prisma.asset.count({
        where: { ...contentWhere, OR: [{ thumbnail: null }, { thumbnail: '' }] },
      }),
      prisma.material.count({ where: contentWhere }),
      prisma.showcase.count({ where: contentWhere }),
      prisma.plugin.count({ where: { userId } }),
      prisma.asset.groupBy({
        by: ['type'],
        where: contentWhere,
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } },
        take: 8,
      }),
      prisma.asset.findMany({
        where: contentWhere,
        take: 6,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          thumbnail: true,
          status: true,
          viewCount: true,
          downloads: true,
          likes: true,
          tags: true,
          updatedAt: true,
        },
      }),
      prisma.note.count({ where: { userId } }),
      prisma.note.count({ where: { userId, visibility: 'PUBLIC' } }),
      prisma.discussion.count({ where: { userId } }),
      prisma.projectDiscussion.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.message.count({
        where: {
          senderId: { not: userId },
          conversation: { participants: { some: { id: userId } } },
          readBy: { none: { userId } },
        },
      }),
      workspaceId
        ? prisma.teamMember.count({ where: { teamId: workspaceId } })
        : Promise.resolve(0),
      prisma.aiBotIntegration.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.lessonProgress.findMany({
        where: { userId, completed: true, completedAt: { gte: fourteenDaysAgo } },
        select: { completedAt: true },
        take: 1000,
      }),
      prisma.asset.findMany({
        where: { ...contentWhere, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        take: 1000,
      }),
      prisma.showcase.findMany({
        where: { ...contentWhere, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        take: 1000,
      }),
      prisma.discussion.findMany({
        where: { userId, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        take: 1000,
      }),
      prisma.projectDiscussion.findMany({
        where: { userId, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        take: 1000,
      }),
    ]);

    recentTaskRows.forEach((task) => {
      const bucket = bucketByKey.get(formatDayKey(task.updatedAt));
      if (bucket) {
        bucket.tasks += task.status === TaskStatus.DONE ? 2 : 1;
      }
    });

    recentLearningRows.forEach((progress) => {
      const activityDate = progress.completedAt || new Date();
      const bucket = bucketByKey.get(formatDayKey(activityDate));
      if (bucket) bucket.learning += 1;
    });

    recentAssetRows.forEach((asset) => {
      const bucket = bucketByKey.get(formatDayKey(asset.createdAt));
      if (bucket) bucket.content += 1;
    });

    recentShowcaseRows.forEach((showcase) => {
      const bucket = bucketByKey.get(formatDayKey(showcase.createdAt));
      if (bucket) bucket.content += 1;
    });

    recentDiscussionRows.forEach((discussion) => {
      const bucket = bucketByKey.get(formatDayKey(discussion.createdAt));
      if (bucket) bucket.community += 1;
    });

    recentProjectDiscussionRows.forEach((discussion) => {
      const bucket = bucketByKey.get(formatDayKey(discussion.createdAt));
      if (bucket) bucket.community += 1;
    });

    const completedRoadmapStepIds = new Set(
      completedRoadmapSteps.map((step) => step.roadmapStepId),
    );
    const roadmapStepCount = roadmaps.reduce((sum, roadmap) => sum + roadmap.steps.length, 0);
    const roadmapCompletedCount = roadmaps.reduce(
      (sum, roadmap) =>
        sum + roadmap.steps.filter((step) => completedRoadmapStepIds.has(step.id)).length,
      0,
    );
    const roadmapProgress = roadmapStepCount
      ? clampPercent((roadmapCompletedCount / roadmapStepCount) * 100)
      : 0;
    const courseProgress = enrollments.length
      ? clampPercent(
          enrollments.reduce((sum, enrollment) => sum + Number(enrollment.progress || 0), 0) /
            enrollments.length,
        )
      : 0;
    const completedLessonCount = lessonProgressRows.length;
    const learningProgress = clampPercent(
      [courseProgress, roadmapProgress, totalTasks ? (doneTasks / totalTasks) * 100 : 0]
        .filter((value) => value > 0)
        .reduce((sum, value, _index, values) => sum + value / values.length, 0),
    );

    const activeCourse = enrollments
      .filter((enrollment) => enrollment.progress < 100)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    const projectHealth = projects.map((project) => {
      const projectTotalTasks = project.tasks.length;
      const projectDoneTasks = project.tasks.filter(
        (task) => task.status === TaskStatus.DONE,
      ).length;
      const projectOverdueTasks = project.tasks.filter(
        (task) => task.status !== TaskStatus.DONE && task.dueDate && task.dueDate < todayStart,
      ).length;
      const projectUrgentTasks = project.tasks.filter(
        (task) => task.status !== TaskStatus.DONE && ['HIGH', 'URGENT'].includes(task.priority),
      ).length;
      const dueSoon =
        !!project.dueDate && project.dueDate >= todayStart && project.dueDate <= nextSevenDays;
      const taskCompletion = projectTotalTasks
        ? clampPercent((projectDoneTasks / projectTotalTasks) * 100)
        : project.progress;
      const healthScore = clampPercent(
        Math.max(project.progress, taskCompletion) -
          projectOverdueTasks * 18 -
          projectUrgentTasks * 8 -
          (dueSoon ? 6 : 0) +
          (project.status === 'COMPLETED' ? 20 : 0),
      );

      return {
        id: project.id,
        title: project.title,
        progress: project.progress,
        status: project.status,
        color: project.color,
        dueDate: project.dueDate,
        updatedAt: project.updatedAt,
        memberCount: project.members.length,
        taskCount: projectTotalTasks,
        doneTaskCount: projectDoneTasks,
        overdueTaskCount: projectOverdueTasks,
        urgentTaskCount: projectUrgentTasks,
        dueSoon,
        roadmapStepCount: project.roadmap?.steps.length || 0,
        healthScore,
      };
    });

    const focusProjects = [...projectHealth]
      .sort((a, b) => {
        if (a.overdueTaskCount !== b.overdueTaskCount)
          return b.overdueTaskCount - a.overdueTaskCount;
        if (a.urgentTaskCount !== b.urgentTaskCount) return b.urgentTaskCount - a.urgentTaskCount;
        return a.healthScore - b.healthScore;
      })
      .slice(0, 4);
    const primaryFocusProject = focusProjects[0] || null;

    const taskCompletionRate = totalTasks ? clampPercent((doneTasks / totalTasks) * 100) : 0;
    const contentApprovalRate = assetCount
      ? clampPercent((approvedAssetCount / assetCount) * 100)
      : 100;
    const contentCoverage = assetCount + materialCount + showcaseCount + pluginCount;
    const collaborationLoad = unreadNotifications + unreadMessages + projectDiscussionCount;
    const momentumScore = clampPercent(
      taskCompletionRate * 0.32 +
        learningProgress * 0.3 +
        contentApprovalRate * 0.18 +
        Math.min(100, recentDoneTasks * 12 + recentLearningRows.length * 8 + contentCoverage * 2) *
          0.2 -
        overdueTasks * 5 -
        urgentTasks * 2,
    );

    const productivityTrend = (() => {
      if (prevDoneTasks === 0 && recentDoneTasks === 0) return '0';
      if (prevDoneTasks === 0) return `+${recentDoneTasks}`;
      const diff = recentDoneTasks - prevDoneTasks;
      const percent = Math.round((diff / prevDoneTasks) * 100);
      return percent >= 0 ? `+${percent}%` : `${percent}%`;
    })();

    const focusQueue = [
      overdueTasks > 0
        ? {
            id: 'overdue-tasks',
            severity: 'danger',
            title: '逾期任务',
            detail: `${overdueTasks} 个任务已经超过截止时间`,
            metric: overdueTasks,
            route: '/work',
          }
        : null,
      urgentTasks > 0
        ? {
            id: 'urgent-tasks',
            severity: 'warning',
            title: '高优先级任务',
            detail: `${urgentTasks} 个高优先级任务等待推进`,
            metric: urgentTasks,
            route: '/work',
          }
        : null,
      pendingAssetCount > 0
        ? {
            id: 'pending-assets',
            severity: 'notice',
            title: '内容审核中',
            detail: `${pendingAssetCount} 个资产仍在等待审核`,
            metric: pendingAssetCount,
            route: '/assets',
          }
        : null,
      missingThumbAssetCount > 0
        ? {
            id: 'missing-thumbnails',
            severity: 'notice',
            title: '资产封面缺失',
            detail: `${missingThumbAssetCount} 个资产缺少缩略图`,
            metric: missingThumbAssetCount,
            route: '/assets',
          }
        : null,
      unreadMessages > 0
        ? {
            id: 'unread-messages',
            severity: 'info',
            title: '未读私信',
            detail: `${unreadMessages} 条协作消息未读`,
            metric: unreadMessages,
            route: '/messages',
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    const smartActions = [
      overdueTasks > 0
        ? {
            id: 'clear-overdue',
            title: '先清掉逾期阻塞',
            description: '把逾期任务切成 25 分钟以内的小动作，优先恢复项目节奏。',
            impact: '降低交付风险',
            route: '/work',
          }
        : null,
      activeCourse
        ? {
            id: 'continue-course',
            title: `继续学习：${activeCourse.course.title}`,
            description: `当前进度 ${Math.round(activeCourse.progress)}%，继续推进可提升学习动量。`,
            impact: '提升学习进度',
            route: `/academy/player/${activeCourse.courseId}`,
          }
        : null,
      primaryFocusProject
        ? {
            id: 'repair-project',
            title: `修复项目健康度：${primaryFocusProject.title}`,
            description: `健康分 ${primaryFocusProject.healthScore}，建议先处理任务和截止日期。`,
            impact: '稳定项目交付',
            route: `/project/${primaryFocusProject.id}`,
          }
        : null,
      contentCoverage === 0
        ? {
            id: 'publish-content',
            title: '发布第一个作品资产',
            description: '把学习成果沉淀成可展示的资产，主页和社区都会更有生命力。',
            impact: '建立作品档案',
            route: '/my-works',
          }
        : null,
      unreadNotifications + unreadMessages > 0
        ? {
            id: 'catch-up',
            title: '处理协作收件箱',
            description: '先读未读消息和通知，避免错过项目邀请、任务更新和团队反馈。',
            impact: '减少协作延迟',
            route: unreadMessages > 0 ? '/messages' : '/notifications',
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({
      generatedAt: new Date().toISOString(),
      workspace: {
        id: workspaceId,
        memberCount: teamMemberCount,
      },
      profile: user,
      command: {
        momentumScore,
        productivityTrend,
        learningProgress,
        taskCompletionRate,
        contentApprovalRate,
        collaborationLoad,
      },
      learning: {
        activeCourse,
        enrollmentCount: enrollments.length,
        completedLessonCount,
        courseProgress,
        roadmapProgress,
        roadmapCount: roadmaps.length,
        roadmapStepCount,
        roadmapCompletedCount,
      },
      work: {
        total: totalTasks,
        todo: todoTasks,
        inProgress: inProgressTasks,
        done: doneTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        urgent: urgentTasks,
        assignedToMe: assignedToMeTasks,
        completionRate: taskCompletionRate,
        recentDone: recentDoneTasks,
      },
      projects: {
        total: projectHealth.length,
        focus: focusProjects,
        health: projectHealth,
      },
      content: {
        total: contentCoverage,
        assets: assetCount,
        approvedAssets: approvedAssetCount,
        pendingAssets: pendingAssetCount,
        rejectedAssets: rejectedAssetCount,
        missingThumbAssets: missingThumbAssetCount,
        materials: materialCount,
        showcases: showcaseCount,
        plugins: pluginCount,
        notes: notesCount,
        publicNotes: publicNotesCount,
        typeDistribution: assetTypeGroups.map((item) => ({
          type: item.type || 'UNKNOWN',
          count: item._count.type,
        })),
        recentAssets: recentAssets.map((asset) => ({
          ...asset,
          qualityScore: clampPercent(
            52 +
              (asset.thumbnail ? 14 : 0) +
              Math.min(18, asset.viewCount) +
              Math.min(10, asset.downloads * 2) +
              Math.min(8, asset.likes * 2) -
              (asset.status === 'REJECTED' ? 28 : 0) -
              (asset.status === 'PENDING' ? 8 : 0),
          ),
        })),
      },
      collaboration: {
        discussions: discussionCount,
        projectDiscussions: projectDiscussionCount,
        unreadNotifications,
        unreadMessages,
        activeAiBots: aiBotCount,
      },
      trend: recentBuckets.map(({ key, learning, tasks, content, community }) => ({
        date: key,
        learning,
        tasks,
        content,
        community,
        total: learning + tasks + content + community,
      })),
      focusQueue,
      smartActions: smartActions.slice(0, 5),
      signals: {
        hasCourse: enrollments.length > 0,
        hasProject: projectHealth.length > 0,
        hasContent: contentCoverage > 0,
        hasTeam: teamMemberCount > 1,
        tagCoverage: recentAssets.reduce((sum, asset) => sum + safeJsonArrayLength(asset.tags), 0),
      },
    });
  } catch (error) {
    logger.error('[Auth] Get workbench error:', error);
    next(error);
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const topUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        points: true,
      },
      orderBy: {
        points: 'desc',
      },
      take: 10,
    });

    const leaderboardData = topUsers.map((user, index) => ({
      id: user.id,
      name: user.name || user.email.split('@')[0],
      avatarUrl: user.avatarUrl,
      score: user.points,
      rank: index + 1,
    }));

    res.json(leaderboardData);
  } catch (error) {
    logger.error('[Auth] Get leaderboard error:', error);
    next(error);
  }
};
