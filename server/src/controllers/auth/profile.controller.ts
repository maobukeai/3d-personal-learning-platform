import { logger } from '../../utils/logger';
import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { sendEmail } from '../../utils/email';
import { sanitizeUser } from '../../utils/auth';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';
import { redisService } from '../../services/redis.service';

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
        twoFactorEnabled: true,
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
      const startOfDay = new Date(parsedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
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

    const assetCount = await prisma.asset.count({
      where: { userId },
    });

    const taskCount = await prisma.task.count({
      where: { userId, status: 'TODO' },
    });

    const feedbackCount = await prisma.feedback.count({
      where: { userId },
    });

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
      const completedTasks = allTasks.filter((t) => t.status === 'DONE').length;
      const taskProgress = (completedTasks / allTasks.length) * 100;
      activeProgresses.push(taskProgress);
    }

    // Compute the final multi-dimensional average (dynamic weighting)
    const totalProgress =
      activeProgresses.length > 0
        ? Math.round(activeProgresses.reduce((sum, p) => sum + p, 0) / activeProgresses.length)
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
      prisma.task.count({ where: { userId, status: 'DONE', updatedAt: { gte: sevenDaysAgo } } }),
      prisma.showcase.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
    ]);

    const pointsTrendValue =
      recentDiscussionsCount * 15 +
      recentCommentsCount * 5 +
      (recentDiscussionLikesCount + recentCommentLikesCount + recentShowcaseLikesCount) * 2 +
      recentCompletedLessonsCount * 30 +
      recentCompletedTasksCount * 20 +
      recentShowcasesCount * 50;

    res.json({
      assetCount,
      taskCount,
      feedbackCount,
      learningProgress: `${totalProgress}%`,
      points,
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
