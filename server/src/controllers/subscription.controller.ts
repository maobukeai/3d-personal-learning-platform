import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';

export const getPlans = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    let plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priority: 'asc' },
    });

    if (plans.length === 0) {
      await prisma.subscriptionPlan.createMany({
        data: [
          {
            name: 'FREE',
            displayName: '免费版',
            price: 0,
            yearlyPrice: 0,
            interval: 'MONTHLY',
            features: JSON.stringify([
              '1GB 云存储空间',
              '基础 3D 资产库访问',
              '1 个协作团队',
              '社区论坛支持',
              '基础材质库',
              '标准渲染队列',
            ]),
            maxStorage: 1,
            maxTeams: 1,
            maxProjects: 5,
            maxAssets: 50,
            priority: 0,
            isPopular: false,
            badgeColor: '#6b7280',
          },
          {
            name: 'VIP',
            displayName: '专业版',
            price: 99,
            yearlyPrice: 948,
            interval: 'MONTHLY',
            features: JSON.stringify([
              '20GB 云存储空间',
              '高级材质库完整访问',
              '无限协作团队',
              '优先渲染队列',
              '1对1 技术支持',
              '项目版本历史',
              '高级导出格式',
              '自定义工作空间',
            ]),
            maxStorage: 20,
            maxTeams: 999,
            maxProjects: 100,
            maxAssets: 500,
            priority: 1,
            isPopular: true,
            badgeColor: '#8b5cf6',
          },
          {
            name: 'SVIP',
            displayName: '旗舰版',
            price: 299,
            yearlyPrice: 2868,
            interval: 'MONTHLY',
            features: JSON.stringify([
              '无限云存储空间',
              '定制化 3D 解决方案',
              '独立渲染服务器',
              '企业级安全保障',
              '专属客户经理',
              'API 接口访问',
              '白标定制服务',
              '团队管理后台',
              'SLA 保障 99.9%',
              '优先功能体验',
            ]),
            maxStorage: 9999,
            maxTeams: 999,
            maxProjects: 9999,
            maxAssets: 9999,
            priority: 2,
            isPopular: false,
            badgeColor: '#f59e0b',
          },
        ],
      });
      plans = await prisma.subscriptionPlan.findMany({
        orderBy: { priority: 'asc' },
      });
    }

    reply.send(
      plans.map((p) => ({
        ...p,
        features: JSON.parse(p.features || '[]'),
        yearlyDiscount:
          p.yearlyPrice && p.price > 0 ? Math.round((1 - p.yearlyPrice / (p.price * 12)) * 100) : 0,
      })),
    );
  } catch (_error) {
    reply.status(500).send({ error: '获取订阅计划失败' });
  }
};

export const getMySubscription = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      const freePlan = await prisma.subscriptionPlan.findFirst({
        where: { name: 'FREE' },
      });
      reply.send({
        plan: freePlan
          ? {
              ...freePlan,
              features: JSON.parse(freePlan.features || '[]'),
            }
          : null,
        status: 'ACTIVE',
        interval: 'MONTHLY',
        startDate: new Date(),
        endDate: null,
        cancelAtPeriodEnd: false,
        autoRenew: true,
      });
      return;
    }

    if (
      subscription.endDate &&
      new Date(subscription.endDate) < new Date() &&
      subscription.status === 'ACTIVE'
    ) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });
      subscription.status = 'EXPIRED';
    }

    reply.send({
      ...subscription,
      plan: {
        ...subscription.plan,
        features: JSON.parse(subscription.plan.features || '[]'),
      },
    });
  } catch (_error) {
    reply.status(500).send({ error: '获取订阅信息失败' });
  }
};

export const createOrder = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  reply.status(400).send({ error: '在线支付功能已禁用，请使用激活码激活订阅' });
};

export const payOrder = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  reply.status(400).send({ error: '在线支付功能已禁用，请使用激活码激活订阅' });
};

export const verifyPayment = async (
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  reply.status(400).send({ error: '在线支付功能已禁用，请使用激活码激活订阅' });
};

export const subscribe = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  reply.status(400).send({ error: '在线支付功能已禁用，请使用激活码激活订阅' });
};

export const cancelSubscription = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      reply.status(401).send({ error: '未授权' });
      return;
    }
    const { immediate, twoFactorCode, password } = request.body as {
      immediate?: boolean;
      twoFactorCode?: string;
      password?: string;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.status(404).send({ error: '用户不存在' });
      return;
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        reply.status(400).send({ error: '需要两步验证码', twoFactorRequired: true });
        return;
      }
      if (!user.twoFactorSecret) {
        reply.status(400).send({ error: '两步验证配置异常' });
        return;
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });
      if (!isValid) {
        reply.status(400).send({ error: '两步验证码错误' });
        return;
      }
    } else {
      if (!password) {
        reply.status(400).send({ error: '取消订阅需要验证密码', passwordRequired: true });
        return;
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        reply.status(400).send({ error: '密码错误' });
        return;
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      reply.status(400).send({ error: '没有有效的订阅可取消' });
      return;
    }

    if (!subscription.plan || subscription.plan.name === 'FREE') {
      reply.status(400).send({ error: '免费计划无需取消' });
      return;
    }

    if (immediate) {
      const freePlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } });
      if (!freePlan) {
        reply.status(500).send({ error: '系统错误' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: 'CANCELED',
            cancelAtPeriodEnd: false,
            autoRenew: false,
            endDate: new Date(),
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            amount: 0,
            status: 'COMPLETED',
            description: `取消 ${subscription.plan.displayName || subscription.plan.name} 订阅`,
            paymentMethod: subscription.paymentMethod,
            planName: subscription.plan.name,
            invoiceNo: `CNL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          },
        });
      });

      reply.send({ message: '订阅已立即取消', type: 'immediate' });
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          autoRenew: false,
        },
      });

      reply.send({
        message: '订阅将在当前周期结束后取消',
        type: 'end_of_period',
        endDate: subscription.endDate,
      });
    }
  } catch (error) {
    logger.error('取消订阅失败:', error);
    reply.status(500).send({ error: '取消订阅失败' });
  }
};

export const cancelSubscriptionWith2FA = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { immediate, twoFactorCode } = request.body as {
    immediate?: boolean;
    twoFactorCode?: string;
  };

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.status(401).send({ error: '用户不存在' });
      return;
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        reply.status(400).send({ error: '请提供两步验证码', requires2FA: true });
        return;
      }

      if (!user.twoFactorSecret) {
        reply.status(400).send({ error: '两步验证未正确设置' });
        return;
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });

      if (!isValid) {
        reply.status(400).send({ error: '两步验证码错误，请重新输入' });
        return;
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      reply.status(400).send({ error: '没有有效的订阅可取消' });
      return;
    }

    if (subscription.plan.name === 'FREE') {
      reply.status(400).send({ error: '免费计划无需取消' });
      return;
    }

    if (immediate) {
      const freePlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } });
      if (!freePlan) {
        reply.status(500).send({ error: '系统错误' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: 'CANCELED',
            cancelAtPeriodEnd: false,
            autoRenew: false,
            endDate: new Date(),
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            amount: 0,
            status: 'COMPLETED',
            description: `取消 ${subscription.plan.displayName || subscription.plan.name} 订阅（2FA验证）`,
            paymentMethod: subscription.paymentMethod,
            planName: subscription.plan.name,
            invoiceNo: `CNL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          },
        });
      });

      reply.send({ message: '订阅已立即取消', type: 'immediate' });
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          autoRenew: false,
        },
      });

      reply.send({
        message: '订阅将在当前周期结束后取消',
        type: 'end_of_period',
        endDate: subscription.endDate,
      });
    }
  } catch (_error) {
    reply.status(500).send({ error: '取消订阅失败' });
  }
};

export const checkCancelRequires2FA = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.status(401).send({ error: '用户不存在' });
      return;
    }

    reply.send({
      requires2FA: user.twoFactorEnabled || false,
      twoFactorEnabled: user.twoFactorEnabled || false,
    });
  } catch (_error) {
    reply.status(500).send({ error: '检查失败' });
  }
};

export const toggleAutoRenew = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { autoRenew } = request.body as { autoRenew?: boolean };

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      reply.status(400).send({ error: '没有有效的订阅' });
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew,
        cancelAtPeriodEnd: !autoRenew,
      },
    });

    reply.send({
      message: autoRenew ? '已开启自动续费' : '已关闭自动续费',
      autoRenew,
    });
  } catch (_error) {
    reply.status(500).send({ error: '操作失败' });
  }
};

export const getTransactions = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(transactions);
  } catch (_error) {
    reply.status(500).send({ error: '获取交易记录失败' });
  }
};

export const getStorageUsage = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const assets = await prisma.asset.findMany({
      where: { userId },
      select: { size: true },
    });

    const materials = await prisma.material.findMany({
      where: { userId },
      select: { id: true, fileSize: true },
    });

    const showcases = await prisma.showcase.findMany({
      where: { userId },
      select: { id: true },
    });

    const assetStorage = assets.reduce((sum, a) => sum + (a.size || 0), 0);
    const materialStorage = materials.reduce((sum, m) => sum + (m.fileSize || 0), 0);

    const usedMB = assetStorage + materialStorage;
    const usedGB = parseFloat((usedMB / 1024).toFixed(2));

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const maxStorage = subscription?.plan?.maxStorage || 1;

    reply.send({
      usedMB,
      usedGB,
      maxStorageGB: maxStorage,
      usagePercent: Math.min((usedGB / maxStorage) * 100, 100),
      assetCount: assets.length,
      materialCount: materials.length,
      showcaseCount: showcases.length,
    });
  } catch (_error) {
    reply.status(500).send({ error: '获取存储用量失败' });
  }
};

export const getSubscriptionLimits = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const plan =
      subscription?.plan || (await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } }));

    if (!plan) {
      reply.status(500).send({ error: '无法获取计划信息' });
      return;
    }

    const [teamCount, projectCount, assetCount] = await Promise.all([
      prisma.teamMember.count({ where: { userId } }),
      prisma.projectMember.count({ where: { userId } }),
      prisma.asset.count({ where: { userId } }),
    ]);

    reply.send({
      maxStorage: plan.maxStorage,
      maxTeams: plan.maxTeams,
      maxProjects: plan.maxProjects,
      maxAssets: plan.maxAssets,
      currentTeams: teamCount,
      currentProjects: projectCount,
      currentAssets: assetCount,
      planName: plan.name,
    });
  } catch (_error) {
    reply.status(500).send({ error: '获取订阅限制失败' });
  }
};

export const checkSubscription = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      reply.send({ active: true, planName: 'FREE', needsUpgrade: false });
      return;
    }

    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      if (subscription.status === 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });
      }
      reply.send({
        active: false,
        expired: true,
        planName: subscription.plan.name,
        endDate: subscription.endDate,
        needsUpgrade: true,
      });
      return;
    }

    reply.send({
      active: subscription.status === 'ACTIVE',
      planName: subscription.plan.name,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      autoRenew: subscription.autoRenew,
      endDate: subscription.endDate,
      needsUpgrade: false,
    });
  } catch (_error) {
    reply.status(500).send({ error: '检查订阅状态失败' });
  }
};
