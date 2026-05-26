import { logger } from '../utils/logger';
import { Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createPaginationMeta, getPaginationParams } from '../utils/pagination';

// Admin: Get all activation codes
export const getAllActivationCodes = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 100, 500);
    const status =
      typeof req.query.status === 'string' && req.query.status !== 'ALL'
        ? req.query.status
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where: Prisma.ActivationCodeWhereInput = {
      ...(status === 'DISABLED'
        ? { status: { notIn: ['ACTIVE', 'USED'] } }
        : status
          ? { status }
          : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { bindEmail: { contains: q } },
              { description: { contains: q } },
              { plan: { is: { name: { contains: q } } } },
              { plan: { is: { displayName: { contains: q } } } },
              { usedBy: { is: { name: { contains: q } } } },
              { usedBy: { is: { email: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [total, codes] = await prisma.$transaction([
      prisma.activationCode.count({ where }),
      prisma.activationCode.findMany({
        where,
        include: {
          plan: true,
          usedBy: { select: { name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: codes,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    logger.error('Get all activation codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Batch create activation codes
export const createActivationCode = async (req: AuthRequest, res: Response) => {
  const { planId, durationDays, quantity, expiresAt, bindEmail, description, prefix } = req.body;

  if (!planId || !durationDays || !quantity) {
    return res.status(400).json({ error: '请提供订阅计划、持续天数和生成数量' });
  }

  const duration = parseInt(durationDays, 10);
  const qty = parseInt(quantity, 10);

  if (isNaN(duration) || duration <= 0) {
    return res.status(400).json({ error: '天数必须为正整数' });
  }
  if (isNaN(qty) || qty <= 0 || qty > 100) {
    return res.status(400).json({ error: '生成数量必须在 1 到 100 之间' });
  }

  let expiresAtDate: Date | null = null;
  if (expiresAt && typeof expiresAt === 'string' && expiresAt.trim() !== '') {
    expiresAtDate = new Date(expiresAt);
    if (isNaN(expiresAtDate.getTime())) {
      return res.status(400).json({ error: '无效的过期日期格式' });
    }
  }

  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ error: '指定的订阅计划不存在' });
    }

    const codesData = [];
    const finalPrefix = prefix ? `${prefix.trim().toUpperCase()}-` : '';
    for (let i = 0; i < qty; i++) {
      // Format: [PREFIX-]PLANNAME-XXXX-XXXX-XXXX
      const randomPart = () => crypto.randomBytes(2).toString('hex').toUpperCase();
      const codeStr = `${finalPrefix}${plan.name.toUpperCase()}-${randomPart()}-${randomPart()}-${randomPart()}`;

      codesData.push({
        code: codeStr,
        planId,
        durationDays: duration,
        status: 'ACTIVE',
        expiresAt: expiresAtDate,
        bindEmail:
          bindEmail && typeof bindEmail === 'string' && bindEmail.trim() !== ''
            ? bindEmail.trim()
            : null,
        description:
          description && typeof description === 'string' && description.trim() !== ''
            ? description.trim()
            : null,
      });
    }

    await prisma.activationCode.createMany({
      data: codesData,
    });

    res.status(201).json({
      message: `成功生成 ${qty} 个激活码`,
      codes: codesData.map((c) => c.code),
    });
  } catch (error) {
    logger.error('Create activation codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Delete/Invalidate an activation code
export const deleteActivationCode = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const code = await prisma.activationCode.findUnique({
      where: { id },
    });

    if (!code) {
      return res.status(404).json({ error: '激活码不存在' });
    }

    await prisma.activationCode.delete({
      where: { id },
    });

    res.json({ message: '激活码已成功删除' });
  } catch (error) {
    logger.error('Delete activation code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// User: Redeem an activation code
export const redeemActivationCode = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { code } = req.body;

  if (!userId) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '请输入有效的激活码' });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 0. Find the user
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 1. Find the activation code
      const actCode = await tx.activationCode.findUnique({
        where: { code: cleanCode },
        include: { plan: true },
      });

      if (!actCode) {
        throw new Error('该激活码无效，请检查输入');
      }

      // Expiry Check
      if (actCode.expiresAt && new Date(actCode.expiresAt) < new Date()) {
        // Automatically mark as EXPIRED for tracking if status is ACTIVE
        if (actCode.status === 'ACTIVE') {
          await tx.activationCode.update({
            where: { id: actCode.id },
            data: { status: 'EXPIRED' },
          });
        }
        throw new Error('该激活码已过期失效');
      }

      if (actCode.status !== 'ACTIVE') {
        throw new Error('该激活码已被使用或已失效');
      }

      // Bind Email Check
      if (actCode.bindEmail && actCode.bindEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error('该激活码仅限绑定邮箱的用户兑换');
      }

      // 2. Mark the code as used
      await tx.activationCode.update({
        where: { id: actCode.id },
        data: {
          status: 'USED',
          usedById: userId,
          usedAt: new Date(),
        },
      });

      // 3. Find user's current subscription
      const currentSub = await tx.subscription.findUnique({
        where: { userId },
      });

      const now = new Date();
      let newStartDate = now;
      let newEndDate = new Date(now.getTime() + actCode.durationDays * 24 * 60 * 60 * 1000);

      if (currentSub) {
        // If same plan, extend the subscription
        if (currentSub.planId === actCode.planId) {
          const currentEnd = currentSub.endDate ? new Date(currentSub.endDate) : now;
          const baseTime = currentEnd > now ? currentEnd : now;
          newStartDate = currentSub.startDate; // Keep original start
          newEndDate = new Date(baseTime.getTime() + actCode.durationDays * 24 * 60 * 60 * 1000);
        }

        // Update subscription
        await tx.subscription.update({
          where: { userId },
          data: {
            planId: actCode.planId,
            status: 'ACTIVE',
            startDate: newStartDate,
            endDate: newEndDate,
            autoRenew: false,
            paymentMethod: 'ACTIVATION_CODE',
          },
        });
      } else {
        // Create new subscription
        await tx.subscription.create({
          data: {
            userId,
            planId: actCode.planId,
            status: 'ACTIVE',
            interval: actCode.durationDays === 365 ? 'YEARLY' : 'MONTHLY',
            startDate: newStartDate,
            endDate: newEndDate,
            autoRenew: false,
            paymentMethod: 'ACTIVATION_CODE',
          },
        });
      }

      // 4. Create transaction log
      const invoiceNo = `ACT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await tx.transaction.create({
        data: {
          userId,
          amount: 0,
          currency: 'CNY',
          status: 'COMPLETED',
          paymentMethod: 'ACTIVATION_CODE',
          description: `激活码兑换: ${actCode.plan.displayName || actCode.plan.name} (${actCode.durationDays}天)`,
          planId: actCode.plan.id,
          planName: actCode.plan.name,
          interval: actCode.durationDays === 365 ? 'YEARLY' : 'MONTHLY',
          invoiceNo,
        },
      });

      return {
        planName: actCode.plan.displayName || actCode.plan.name,
        endDate: newEndDate,
      };
    });

    res.json({
      message: '兑换成功！您的权限已生效',
      planName: result.planName,
      endDate: result.endDate,
    });
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : '兑换失败，请稍后重试' });
  }
};
