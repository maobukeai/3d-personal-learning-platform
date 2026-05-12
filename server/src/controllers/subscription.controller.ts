import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getPlans = async (req: Request, res: Response) => {
  try {
    let plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priority: 'asc' }
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
              '标准渲染队列'
            ]),
            maxStorage: 1,
            maxTeams: 1,
            maxProjects: 5,
            maxAssets: 50,
            priority: 0,
            isPopular: false,
            badgeColor: '#6b7280'
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
              '自定义工作空间'
            ]),
            maxStorage: 20,
            maxTeams: 999,
            maxProjects: 100,
            maxAssets: 500,
            priority: 1,
            isPopular: true,
            badgeColor: '#8b5cf6'
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
              '优先功能体验'
            ]),
            maxStorage: 9999,
            maxTeams: 999,
            maxProjects: 9999,
            maxAssets: 9999,
            priority: 2,
            isPopular: false,
            badgeColor: '#f59e0b'
          }
        ]
      });
      plans = await prisma.subscriptionPlan.findMany({
        orderBy: { priority: 'asc' }
      });
    }

    res.json(plans.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      yearlyDiscount: p.yearlyPrice && p.price > 0
        ? Math.round((1 - p.yearlyPrice / (p.price * 12)) * 100)
        : 0
    })));
  } catch (error) {
    res.status(500).json({ error: '获取订阅计划失败' });
  }
};

export const getMySubscription = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      const freePlan = await prisma.subscriptionPlan.findFirst({
        where: { name: 'FREE' }
      });
      return res.json({
        plan: freePlan ? {
          ...freePlan,
          features: JSON.parse(freePlan.features || '[]')
        } : null,
        status: 'ACTIVE',
        interval: 'MONTHLY',
        startDate: new Date(),
        endDate: null,
        cancelAtPeriodEnd: false,
        autoRenew: true,
      });
    }

    if (subscription.endDate && new Date(subscription.endDate) < new Date() && subscription.status === 'ACTIVE') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' }
      });
      subscription.status = 'EXPIRED';
    }

    res.json({
      ...subscription,
      plan: {
        ...subscription.plan,
        features: JSON.parse(subscription.plan.features || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取订阅信息失败' });
  }
};

const calculateProratedRefund = (
  currentPlanPrice: number,
  currentPlanInterval: string,
  startDate: Date,
  endDate: Date | null
): number => {
  if (!endDate) return 0;
  const totalDays = currentPlanInterval === 'YEARLY' ? 365 : 30;
  const remainingMs = new Date(endDate).getTime() - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const dailyPrice = currentPlanPrice / totalDays;
  return Math.round(dailyPrice * remainingDays * 100) / 100;
};

export const subscribe = async (req: any, res: Response) => {
  const userId = req.user.id;
  const { planId, interval, paymentMethod } = req.body;

  try {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: '订阅计划不存在' });

    const billingInterval = interval || 'MONTHLY';
    const amount = billingInterval === 'YEARLY' && plan.yearlyPrice
      ? plan.yearlyPrice
      : plan.price;
    const durationDays = billingInterval === 'YEARLY' ? 365 : 30;

    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (existingSub && existingSub.planId === planId && existingSub.status === 'ACTIVE' && existingSub.interval === billingInterval) {
      return res.status(400).json({ error: '您已订阅此计划' });
    }

    let proratedRefund = 0;
    let isUpgrade = false;
    let isRenewal = false;

    if (existingSub && existingSub.status === 'ACTIVE' && existingSub.plan.name !== 'FREE') {
      const currentPriority = existingSub.plan.priority || 0;
      const newPriority = plan.priority || 0;

      if (newPriority > currentPriority) {
        isUpgrade = true;
        proratedRefund = calculateProratedRefund(
          existingSub.interval === 'YEARLY' && existingSub.plan.yearlyPrice
            ? existingSub.plan.yearlyPrice
            : existingSub.plan.price,
          existingSub.interval,
          existingSub.startDate,
          existingSub.endDate
        );
      } else if (newPriority === currentPriority) {
        isRenewal = true;
      }
    }

    const invoiceNo = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        status: 'ACTIVE',
        interval: billingInterval,
        startDate: new Date(),
        endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        autoRenew: true,
        paymentMethod: paymentMethod || 'MOCK_PAYMENT',
      },
      create: {
        userId,
        planId,
        status: 'ACTIVE',
        interval: billingInterval,
        startDate: new Date(),
        endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        autoRenew: true,
        paymentMethod: paymentMethod || 'MOCK_PAYMENT',
      }
    });

    let description = '';
    if (isUpgrade) {
      description = `升级至 ${plan.displayName || plan.name} 计划 - ${billingInterval === 'YEARLY' ? '年付' : '月付'}`;
      if (proratedRefund > 0) {
        description += `（原计划剩余价值 ￥${proratedRefund} 已抵扣）`;
      }
    } else if (isRenewal) {
      description = `续费 ${plan.displayName || plan.name} 计划 - ${billingInterval === 'YEARLY' ? '年付' : '月付'}`;
    } else {
      description = `订阅 ${plan.displayName || plan.name} 计划 - ${billingInterval === 'YEARLY' ? '年付' : '月付'}`;
    }

    await prisma.transaction.create({
      data: {
        userId,
        amount: Math.max(0, amount - proratedRefund),
        status: 'COMPLETED',
        description,
        paymentMethod: paymentMethod || 'MOCK_PAYMENT',
        planName: plan.name,
        interval: billingInterval,
        invoiceNo,
      }
    });

    res.json({
      message: isUpgrade ? '订阅升级成功' : isRenewal ? '续费成功' : '订阅成功',
      subscription,
      invoiceNo,
      isUpgrade,
      isRenewal,
      proratedRefund,
      finalAmount: Math.max(0, amount - proratedRefund),
    });
  } catch (error) {
    res.status(500).json({ error: '订阅失败' });
  }
};

export const cancelSubscription = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }
    const { immediate } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return res.status(400).json({ error: '没有有效的订阅可取消' });
    }

    if (!subscription.plan || subscription.plan.name === 'FREE') {
      return res.status(400).json({ error: '免费计划无需取消' });
    }

    if (immediate) {
      const freePlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } });
      if (!freePlan) return res.status(500).json({ error: '系统错误' });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: freePlan.id,
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
          autoRenew: false,
          endDate: new Date(),
        }
      });

      await prisma.transaction.create({
        data: {
          userId,
          amount: 0,
          status: 'COMPLETED',
          description: `取消 ${subscription.plan.displayName || subscription.plan.name} 订阅`,
          paymentMethod: subscription.paymentMethod,
          planName: subscription.plan.name,
          invoiceNo: `CNL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        }
      });

      res.json({ message: '订阅已立即取消', type: 'immediate' });
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          autoRenew: false,
        }
      });

      res.json({
        message: '订阅将在当前周期结束后取消',
        type: 'end_of_period',
        endDate: subscription.endDate
      });
    }
  } catch (error) {
    console.error('取消订阅失败:', error);
    res.status(500).json({ error: '取消订阅失败' });
  }
};

export const cancelSubscriptionWith2FA = async (req: any, res: Response) => {
  const userId = req.user.id;
  const { immediate, twoFactorCode } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(400).json({ error: '请提供两步验证码', requires2FA: true });
      }

      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: '两步验证未正确设置' });
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });

      if (!isValid) {
        return res.status(400).json({ error: '两步验证码错误，请重新输入' });
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return res.status(400).json({ error: '没有有效的订阅可取消' });
    }

    if (subscription.plan.name === 'FREE') {
      return res.status(400).json({ error: '免费计划无需取消' });
    }

    if (immediate) {
      const freePlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } });
      if (!freePlan) return res.status(500).json({ error: '系统错误' });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: freePlan.id,
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
          autoRenew: false,
          endDate: new Date(),
        }
      });

      await prisma.transaction.create({
        data: {
          userId,
          amount: 0,
          status: 'COMPLETED',
          description: `取消 ${subscription.plan.displayName || subscription.plan.name} 订阅（2FA验证）`,
          paymentMethod: subscription.paymentMethod,
          planName: subscription.plan.name,
          invoiceNo: `CNL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        }
      });

      res.json({ message: '订阅已立即取消', type: 'immediate' });
    } else {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          autoRenew: false,
        }
      });

      res.json({
        message: '订阅将在当前周期结束后取消',
        type: 'end_of_period',
        endDate: subscription.endDate
      });
    }
  } catch (error) {
    res.status(500).json({ error: '取消订阅失败' });
  }
};

export const checkCancelRequires2FA = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    res.json({
      requires2FA: user.twoFactorEnabled || false,
      twoFactorEnabled: user.twoFactorEnabled || false,
    });
  } catch (error) {
    res.status(500).json({ error: '检查失败' });
  }
};

export const toggleAutoRenew = async (req: any, res: Response) => {
  const userId = req.user.id;
  const { autoRenew } = req.body;

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return res.status(400).json({ error: '没有有效的订阅' });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew,
        cancelAtPeriodEnd: !autoRenew,
      }
    });

    res.json({
      message: autoRenew ? '已开启自动续费' : '已关闭自动续费',
      autoRenew
    });
  } catch (error) {
    res.status(500).json({ error: '操作失败' });
  }
};

export const getTransactions = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: '获取交易记录失败' });
  }
};

export const getStorageUsage = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const assets = await prisma.asset.findMany({
      where: { userId },
      select: { size: true }
    });

    const materials = await prisma.material.findMany({
      where: { userId },
      select: { id: true }
    });

    const showcases = await prisma.showcase.findMany({
      where: { userId },
      select: { id: true }
    });

    const assetStorage = assets.reduce((sum, a) => sum + (a.size || 0), 0);

    const usedMB = assetStorage;
    const usedGB = parseFloat((usedMB / 1024).toFixed(2));

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    const maxStorage = subscription?.plan?.maxStorage || 1;

    res.json({
      usedMB,
      usedGB,
      maxStorageGB: maxStorage,
      usagePercent: Math.min((usedGB / maxStorage) * 100, 100),
      assetCount: assets.length,
      materialCount: materials.length,
      showcaseCount: showcases.length,
    });
  } catch (error) {
    res.status(500).json({ error: '获取存储用量失败' });
  }
};

export const getSubscriptionLimits = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    const plan = subscription?.plan || await prisma.subscriptionPlan.findFirst({ where: { name: 'FREE' } });

    if (!plan) return res.status(500).json({ error: '无法获取计划信息' });

    const [teamCount, projectCount, assetCount] = await Promise.all([
      prisma.teamMember.count({ where: { userId } }),
      prisma.projectMember.count({ where: { userId } }),
      prisma.asset.count({ where: { userId } })
    ]);

    res.json({
      maxStorage: plan.maxStorage,
      maxTeams: plan.maxTeams,
      maxProjects: plan.maxProjects,
      maxAssets: plan.maxAssets,
      currentTeams: teamCount,
      currentProjects: projectCount,
      currentAssets: assetCount,
      planName: plan.name,
    });
  } catch (error) {
    res.status(500).json({ error: '获取订阅限制失败' });
  }
};

export const checkSubscription = async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      return res.json({ active: true, planName: 'FREE', needsUpgrade: false });
    }

    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      if (subscription.status === 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' }
        });
      }
      return res.json({
        active: false,
        expired: true,
        planName: subscription.plan.name,
        endDate: subscription.endDate,
        needsUpgrade: true
      });
    }

    res.json({
      active: subscription.status === 'ACTIVE',
      planName: subscription.plan.name,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      autoRenew: subscription.autoRenew,
      endDate: subscription.endDate,
      needsUpgrade: false
    });
  } catch (error) {
    res.status(500).json({ error: '检查订阅状态失败' });
  }
};
