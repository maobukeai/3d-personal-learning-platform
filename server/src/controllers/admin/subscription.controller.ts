import { Prisma } from '@prisma/client';
import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

export const getAllSubscriptionPlans = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priority: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
    reply.send(
      plans.map((p) => ({
        ...p,
        features: JSON.parse(p.features || '[]'),
        subscriberCount: p._count.subscriptions,
      })),
    );
  } catch (error) {
    throw error;
  }
};

export const createSubscriptionPlan = async (req: AdminRequest, reply: FastifyReply) => {
  const {
    name,
    displayName,
    price,
    yearlyPrice,
    interval,
    features,
    maxStorage,
    maxTeams,
    maxProjects,
    maxAssets,
    priority,
    isPopular,
    badgeColor,
  } = req.body;
  try {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        displayName,
        price: parseFloat(price),
        yearlyPrice: yearlyPrice ? parseFloat(yearlyPrice) : null,
        interval: interval || 'MONTHLY',
        features: JSON.stringify(features || []),
        maxStorage: parseFloat(maxStorage) || 1,
        maxTeams: parseInt(maxTeams) || 1,
        maxProjects: parseInt(maxProjects) || 5,
        maxAssets: parseInt(maxAssets) || 50,
        priority: parseInt(priority) || 0,
        isPopular: isPopular || false,
        badgeColor: badgeColor || null,
      },
    });
    reply.status(201).send({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new AppError('计划名称已存在', 400);
    throw error;
  }
};

export const updateSubscriptionPlan = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const {
    name,
    displayName,
    price,
    yearlyPrice,
    interval,
    features,
    maxStorage,
    maxTeams,
    maxProjects,
    maxAssets,
    priority,
    isPopular,
    badgeColor,
  } = req.body;
  try {
    const updateData: Prisma.SubscriptionPlanUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (yearlyPrice !== undefined)
      updateData.yearlyPrice = yearlyPrice ? parseFloat(yearlyPrice) : null;
    if (interval !== undefined) updateData.interval = interval;
    if (features !== undefined) updateData.features = JSON.stringify(features);
    if (maxStorage !== undefined) updateData.maxStorage = parseFloat(maxStorage);
    if (maxTeams !== undefined) updateData.maxTeams = parseInt(maxTeams);
    if (maxProjects !== undefined) updateData.maxProjects = parseInt(maxProjects);
    if (maxAssets !== undefined) updateData.maxAssets = parseInt(maxAssets);
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (isPopular !== undefined) updateData.isPopular = isPopular;
    if (badgeColor !== undefined) updateData.badgeColor = badgeColor;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });
    reply.send({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error) {
    throw error;
  }
};

export const deleteSubscriptionPlan = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    const subscriberCount = await prisma.subscription.count({
      where: { planId: id, status: 'ACTIVE' },
    });
    if (subscriberCount > 0) {
      throw new AppError(`该计划仍有 ${subscriberCount} 名活跃订阅者，无法删除`, 400);
    }
    await prisma.subscriptionPlan.delete({ where: { id } });
    reply.send({ message: '订阅计划已删除' });
  } catch (error) {
    throw error;
  }
};

export const getAllSubscriptions = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(subscriptions);
  } catch (error) {
    throw error;
  }
};

export const createSubscription = async (req: AdminRequest, reply: FastifyReply) => {
  const {
    userId,
    planId,
    status,
    interval,
    startDate,
    endDate,
    autoRenew,
    cancelAtPeriodEnd,
    paymentMethod,
  } = req.body;

  if (!userId || !planId) {
    throw new AppError('用户ID和计划ID为必填项', 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('用户不存在', 404);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError('订阅计划不存在', 404);

    const existingSub = await prisma.subscription.findUnique({ where: { userId } });
    if (existingSub) throw new AppError('该用户已有订阅，请使用编辑功能修改', 400);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: status || 'ACTIVE',
        interval: interval || 'MONTHLY',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        autoRenew: autoRenew !== undefined ? autoRenew : true,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        paymentMethod: paymentMethod || 'ADMIN_ASSIGN',
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true,
      },
    });

    reply.status(201).send(subscription);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new AppError('该用户已有订阅', 400);
    throw error;
  }
};

export const updateSubscription = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const {
    planId,
    status,
    interval,
    startDate,
    endDate,
    autoRenew,
    cancelAtPeriodEnd,
    paymentMethod,
  } = req.body;

  try {
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('订阅不存在', 404);

    const updateData: Prisma.SubscriptionUpdateInput = {};
    if (planId !== undefined) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new AppError('订阅计划不存在', 404);
      updateData.plan = { connect: { id: planId } };
    }
    if (status !== undefined) updateData.status = status;
    if (interval !== undefined) updateData.interval = interval;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;

    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true,
      },
    });

    reply.send(subscription);
  } catch (error) {
    throw error;
  }
};

export const deleteSubscription = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new AppError('订阅不存在', 404);

    await prisma.subscription.delete({ where: { id } });
    reply.send({ message: '订阅已删除' });
  } catch (error) {
    throw error;
  }
};

export const getAllTransactions = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(transactions);
  } catch (error) {
    throw error;
  }
};
