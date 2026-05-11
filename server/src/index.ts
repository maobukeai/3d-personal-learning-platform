import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(express.json());
// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png) are allowed'));
  }
});

// --- Middleware ---

// Middleware to check for Admin role
const isAdmin = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    (req as any).userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Admin System Settings Routes ---

// Get All System Settings (Admin only)
app.get('/api/admin/settings', isAdmin, async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update System Settings (Admin only)
app.post('/api/admin/settings', isAdmin, async (req, res) => {
  try {
    const { settings } = req.body; // Expecting [{key, value}, ...]
    
    const updates = settings.map((s: { key: string, value: string }) => 
      prisma.systemSetting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value }
      })
    );

    await Promise.all(updates);
    res.json({ message: '设置已成功保存' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
const verificationCodes = new Map<string, { code: string, expires: number }>();

// --- Auth Routes ---

// Send Email Verification Code
app.post('/api/auth/email/send-code', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(user.email, { 
      code, 
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Fetch SMTP settings
    const settings = await prisma.systemSetting.findMany();
    const config = settings.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: parseInt(config.SMTP_PORT) || 465,
        secure: true,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: config.SMTP_FROM || config.SMTP_USER,
        to: user.email,
        subject: '您的邮箱验证码',
        text: `您的验证码是: ${code}。有效期 10 分钟。`,
        html: `<div style="padding: 20px; font-family: sans-serif;">
          <h2>验证您的邮箱</h2>
          <p>您好，您正在进行邮箱验证，验证码如下：</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">${code}</div>
          <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
        </div>`,
      });
      console.log(`[Email Success] To: ${user.email}`);
    } else {
      console.log(`[Email Mock/Not Configured] To: ${user.email}, Code: ${code}`);
    }

    res.json({ message: '验证码已发送到您的邮箱' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: '无法发送邮件，请检查后端配置' });
  }
});

// Verify Email
app.post('/api/auth/email/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const record = verificationCodes.get(user.email);
    if (!record || record.code !== code || record.expires < Date.now()) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { emailVerified: true }
    });

    verificationCodes.delete(user.email);
    res.json({ message: '邮箱验证成功' });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change Email
app.put('/api/auth/email/change', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { newEmail, code } = req.body;

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被占用' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // For changing email, we might want to verify the NEW email or the OLD one.
    // Here we'll assume the code was sent to the NEW email for verification.
    const record = verificationCodes.get(newEmail);
    if (!record || record.code !== code || record.expires < Date.now()) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { 
        email: newEmail,
        emailVerified: true // Verified since they just provided the code sent to this email
      }
    });

    verificationCodes.delete(newEmail);
    res.json({ 
      message: '邮箱已成功更换',
      user: { id: updatedUser.id, email: updatedUser.email, emailVerified: updatedUser.emailVerified }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Send Code to New Email (for changing email)
app.post('/api/auth/email/send-code-new', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { newEmail } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被占用' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(newEmail, { 
      code, 
      expires: Date.now() + 10 * 60 * 1000 
    });

    // Fetch SMTP settings
    const settings = await prisma.systemSetting.findMany();
    const config = settings.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: parseInt(config.SMTP_PORT) || 465,
        secure: true,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: config.SMTP_FROM || config.SMTP_USER,
        to: newEmail,
        subject: '您的新邮箱验证码',
        text: `您的验证码是: ${code}。有效期 10 分钟。`,
        html: `<div style="padding: 20px; font-family: sans-serif;">
          <h2>更改您的邮箱</h2>
          <p>您好，您正在尝试将账号邮箱更改为 ${newEmail}，验证码如下：</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">${code}</div>
          <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
        </div>`,
      });
      console.log(`[Email Success] To: ${newEmail}`);
    } else {
      console.log(`[Email Mock/Not Configured] To: ${newEmail}, Code: ${code}`);
    }

    res.json({ message: '验证码已发送到新邮箱' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: '无法发送邮件，请检查后端配置' });
  }
});
app.post('/api/auth/upload-avatar', upload.single('avatar'), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { avatarUrl },
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, location: true, website: true, role: true, twoFactorEnabled: true }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
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
});

// Login
app.post('/api/auth/login', async (req, res) => {
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
      // Check if device is trusted
      if (deviceToken) {
        const trusted = await prisma.trustedDevice.findFirst({
          where: { userId: user.id, token: deviceToken }
        });
        if (trusted) {
          // Skip 2FA
          const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } });
        }
      }
      return res.json({ twoFactorRequired: true, userId: user.id });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login 2FA Verification
app.post('/api/auth/login/2fa', async (req, res) => {
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      deviceToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio, location: user.location, website: user.website, twoFactorEnabled: user.twoFactorEnabled } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Profile (Protected)
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, location: true, website: true, role: true, twoFactorEnabled: true }
    });
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 2FA Setup (Protected)
app.put('/api/auth/2fa/setup', async (req, res) => {
  console.log('2FA Setup requested (PUT)');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    console.log('Decoded token for user:', decoded.userId);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      console.log('User not found in DB');
      return res.status(404).json({ error: 'User not found' });
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `3D Learning Platform (${user.email})`,
    });
    console.log('Generated secret, base32:', secret.base32);
    const otpauth = secret.otpauth_url!;
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    console.log('Generated QR Code URL');

    // Temporarily store secret in DB but don't enable yet
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { twoFactorSecret: secret.base32 }
    });
    console.log('Updated user with secret');

    res.json({ qrCodeUrl, secret: secret.base32 });
  } catch (error) {
    console.error('2FA Setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2FA Enable (Protected)
app.post('/api/auth/2fa/enable', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
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
      where: { id: decoded.userId },
      data: { twoFactorEnabled: true }
    });

    res.json({ message: '两步验证已启用' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2FA Disable (Protected)
app.post('/api/auth/2fa/disable', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null }
    });

    res.json({ message: '两步验证已禁用' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile (Protected)
app.put('/api/auth/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { name, bio, location, website } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { name, bio, location, website },
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, location: true, website: true, role: true, twoFactorEnabled: true }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password (Protected)
app.put('/api/auth/change-password', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashedNewPassword }
    });

    res.json({ message: '密码已成功修改' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot Password - Check User & 2FA Status
app.post('/api/auth/forgot-password/check', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }

    res.json({ 
      twoFactorEnabled: user.twoFactorEnabled,
      email: user.email 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot Password - Reset with 2FA
app.post('/api/auth/forgot-password/reset-2fa', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: '请求无效或该账户未启用两步验证' });
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

    res.json({ message: '密码已重置成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Multer Setup for Feedback Attachments ---
const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/feedback';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'feedback-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadFeedback = multer({ 
  storage: feedbackStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use('/uploads/feedback', express.static(path.join(__dirname, '../uploads/feedback')));

// --- Feedback Routes ---

// Upload Feedback Attachment (Protected)
app.post('/api/feedback/upload', uploadFeedback.single('file'), async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/feedback/${req.file.filename}`;
    res.json({ url: attachmentUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit Feedback (Protected)
app.post('/api/feedback', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { type, title, description, priority, attachmentUrl } = req.body;

    const feedback = await prisma.feedback.create({
      data: {
        type,
        title,
        description,
        priority,
        attachmentUrl,
        userId: decoded.userId
      }
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's own feedback (Protected)
app.get('/api/feedback/my', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all feedback (Admin only)
app.get('/api/admin/feedback', isAdmin, async (req, res) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update feedback status (Admin only)
app.put('/api/admin/feedback/:id/status', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: { status }
    });
    res.json(updatedFeedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete feedback (Admin only)
app.delete('/api/admin/feedback/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.feedback.delete({ where: { id } });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Admin Routes ---

// Get all users (Admin only)
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role (Admin only)
app.put('/api/admin/users/:id/role', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (Admin only)
app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('3D Personal Learning Platform API');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
