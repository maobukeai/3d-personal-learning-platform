import { logger } from '../../utils/logger';
import type { FastifyRequest, FastifyReply } from 'fastify';

import bcrypt from 'bcryptjs';
import prisma from '../../services/prisma';
import { sendEmail } from '../../utils/email';
import { sanitizeUser } from '../../utils/auth';
import {
  auditService,
  AuditModule,
  AuditAction,
  type AuditRequest,
} from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { provisionUserWorkspaces } from '../../services/user-workspace.service';

export const register = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { email, password, name, verificationCode } = request.body as {
    email: string;
    password: string;
    name: string;
    verificationCode: string;
  };
  try {
    // Check if registration is allowed
    const allowReg = await prisma.systemSetting.findUnique({
      where: { key: 'ALLOW_REGISTRATION' },
    });
    if (allowReg && (allowReg.value === 'false' || allowReg.value === '0')) {
      throw new AppError('目前平台已关闭新用户注册', 403);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('该邮箱已被注册', 400);
    }

    // Verify code
    const record = await prisma.verificationCode.findFirst({
      where: { email, code: verificationCode, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new AppError('验证码错误或已过期', 400);
    }

    // Delete the used code immediately to prevent reuse attack
    await prisma.verificationCode.delete({ where: { id: record.id } });

    const hashedPassword = await bcrypt.hash(password, 10);

    // 使用事务同时创建用户和个人工作区
    await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            emailVerified: true,
          },
        });

        const { personalTeam } = await provisionUserWorkspaces(tx, {
          userId: user.id,
          displayName: name || user.email,
        });

        await auditService.log({
          userId: user.id,
          action: AuditAction.CREATE_USER,
          module: AuditModule.AUTH,
          description: `新用户注册: ${user.email}`,
          newValue: sanitizeUser(user),
          req: request as unknown as AuditRequest,
          tx, // Pass transaction client
        });

        return { user, personalTeam };
      },
      {
        timeout: 10000, // Increase timeout to 10 seconds
      },
    );

    reply.status(201).send({ message: 'User created successfully' });
  } catch (error) {
    throw error;
  }
};

export const sendPublicVerificationCode = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { email } = request.body as { email: string };
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('该邮箱已被注册', 400);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { email, code, expiresAt },
    });

    const settings = await prisma.systemSetting.findMany();
    const configData = settings.reduce<Record<string, string>>((acc, curr) => {
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

    reply.send({ message: '验证码已发送到您的邮箱' });
  } catch (error) {
    logger.error('Email send error:', error);
    throw new AppError('无法发送邮件，请检查后端配置', 500);
  }
};

export const verifyPublicEmail = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { email, code } = request.body as { email: string; code: string };
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
      throw new AppError('验证码错误或已过期', 400);
    }

    // Delete the used code to prevent reuse
    await prisma.verificationCode.delete({ where: { id: record.id } });

    reply.send({ message: '邮箱验证成功' });
  } catch (error) {
    throw error;
  }
};
