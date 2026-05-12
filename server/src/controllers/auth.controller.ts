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

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  try {
    // Check if registration is allowed
    const allowReg = await prisma.systemSetting.findUnique({ where: { key: 'ALLOW_REGISTRATION' } });
    if (allowReg && allowReg.value === 'false') {
      return res.status(403).json({ error: '目前平台已关闭新用户注册' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
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

    if (user.twoFactorEnabled) {
      if (deviceToken) {
        const trusted = await prisma.trustedDevice.findFirst({
          where: { userId: user.id, token: deviceToken }
        });
        if (trusted) {
          const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
          return res.json({ 
            token, 
            user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } 
          });
        }
      }
      return res.json({ twoFactorRequired: true, userId: user.id });
    }
    
    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login2FA = async (req: Request, res: Response) => {
  const { userId, code, rememberDevice } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
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

    let deviceToken = null;
    if (rememberDevice) {
      deviceToken = crypto.randomUUID();
      await prisma.trustedDevice.create({
        data: { userId: user.id, token: deviceToken }
      });
    }

    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      deviceToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const user = req.user;
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
    emailVerified: user.emailVerified
  };
  
  res.json(safeUser);
};

export const setup2FA = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `3D Learning Platform (${user.email})`,
    });
    
    const otpauth = secret.otpauth_url!;
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorSecret: secret.base32 }
    });

    res.json({ qrCodeUrl, secret: secret.base32 });
  } catch (error) {
    console.error('2FA Setup error:', error);
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
      data: { twoFactorEnabled: true }
    });

    res.json({ message: '两步验证已启用' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const disable2FA = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId as string },
      data: { twoFactorEnabled: false, twoFactorSecret: null }
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
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, location: true, website: true, role: true, twoFactorEnabled: true }
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
      data: { password: hashedNewPassword }
    });

    res.json({ message: '密码已成功修改' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendVerificationCode = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB
    await prisma.verificationCode.create({
      data: { email: user.email, code, expiresAt }
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const subject = configData.EMAIL_VERIFY_SUBJECT || '您的邮箱验证码';
    let html = configData.EMAIL_VERIFY_BODY || `<div style="padding: 20px; font-family: sans-serif;">
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
    const user = req.user;
    const record = await prisma.verificationCode.findFirst({
      where: { 
        email: user.email, 
        code, 
        expiresAt: { gt: new Date() } 
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true }
    });

    // Clean up used code and all expired codes for this email
    await prisma.$transaction([
      prisma.verificationCode.delete({ where: { id: record.id } }),
      prisma.verificationCode.deleteMany({
        where: {
          email: user.email,
          expiresAt: { lt: new Date() }
        }
      })
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
      data: { email: newEmail, code, expiresAt }
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const subject = configData.EMAIL_CHANGE_SUBJECT || '您的新邮箱验证码';
    let html = configData.EMAIL_CHANGE_BODY || `<div style="padding: 20px; font-family: sans-serif;">
        <h2>更改您的邮箱</h2>
        <p>您好，您正在尝试将账号邮箱更改为 ${newEmail}，验证码如下：</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">{{code}}</div>
        <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
      </div>`;

    html = html.replace('{{code}}', code).replace('${newEmail}', newEmail);
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
        expiresAt: { gt: new Date() } 
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId as string },
      data: { 
        email: newEmail,
        emailVerified: true 
      }
    });

    await prisma.verificationCode.delete({ where: { id: record.id } });

    res.json({ 
      message: '邮箱已成功更换',
      user: { id: updatedUser.id, email: updatedUser.email, emailVerified: updatedUser.emailVerified }
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
      data: { password: hashedPassword }
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
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, location: true, website: true, role: true, twoFactorEnabled: true }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true
      }
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
            showcases: true
          }
        }
      }
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
  try {
    const [assets, discussions, enrollments] = await Promise.all([
      prisma.asset.findMany({ 
        take: 5, 
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
      }),
      prisma.discussion.findMany({ 
        take: 5, 
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
      }),
      prisma.enrollment.findMany({ 
        take: 5, 
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } }, course: { select: { title: true } } }
      })
    ]);

    const activities = [
      ...assets.map(a => ({ 
        id: `a-${a.id}`, 
        user: a.user.name || 'AI成员', 
        action: '发布了新资产', 
        target: a.title, 
        createdAt: a.createdAt 
      })),
      ...discussions.map(d => ({ 
        id: `d-${d.id}`, 
        user: d.user.name || 'AI成员', 
        action: '发起了新讨论', 
        target: d.title, 
        createdAt: d.createdAt 
      })),
      ...enrollments.map(e => ({ 
        id: `e-${e.id}`, 
        user: e.user.name || 'AI成员', 
        action: '加入了新课程', 
        target: e.course.title, 
        createdAt: e.createdAt 
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const assetCount = await prisma.asset.count({
      where: { userId: req.userId as string }
    });

    const taskCount = await prisma.task.count({
      where: { userId: req.userId as string, status: 'TODO' }
    });

    const feedbackCount = await prisma.feedback.count({
      where: { userId: req.userId as string }
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.userId as string }
    });

    const totalProgress = enrollments.length > 0 
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
      : 0;

    res.json({
      assetCount,
      taskCount,
      feedbackCount,
      learningProgress: `${totalProgress}%`
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
