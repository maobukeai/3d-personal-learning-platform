import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const getAllSubscriptionPlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priority: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
    res.json(
      plans.map((p) => ({
        ...p,
        features: JSON.parse(p.features || '[]'),
        subscriberCount: p._count.subscriptions,
      })),
    );
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    res.status(201).json({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error: any) {
    if (error.code === 'P2002') return next(new AppError('计划名称已存在', 400));
    next(error);
  }
};

export const updateSubscriptionPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    const updateData: any = {};
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
      where: { id: id as any },
      data: updateData,
    });
    res.json({ ...plan, features: JSON.parse(plan.features || '[]') });
  } catch (error) {
    next(error);
  }
};

export const deleteSubscriptionPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const subscriberCount = await prisma.subscription.count({
      where: { planId: id, status: 'ACTIVE' },
    });
    if (subscriberCount > 0) {
      return next(new AppError(`该计划仍有 ${subscriberCount} 名活跃订阅者，无法删除`, 400));
    }
    await prisma.subscriptionPlan.delete({ where: { id: id as any } });
    res.json({ message: '订阅计划已删除' });
  } catch (error) {
    next(error);
  }
};

export const getAllSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
};

export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    return next(new AppError('用户ID和计划ID为必填项', 400));
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError('用户不存在', 404));

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return next(new AppError('订阅计划不存在', 404));

    const existingSub = await prisma.subscription.findUnique({ where: { userId } });
    if (existingSub) return next(new AppError('该用户已有订阅，请使用编辑功能修改', 400));

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

    res.status(201).json(subscription);
  } catch (error: any) {
    if (error.code === 'P2002') return next(new AppError('该用户已有订阅', 400));
    next(error);
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    const existing = await prisma.subscription.findUnique({ where: { id: id as any } });
    if (!existing) return next(new AppError('订阅不存在', 404));

    const updateData: any = {};
    if (planId !== undefined) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) return next(new AppError('订阅计划不存在', 404));
      updateData.planId = planId;
    }
    if (status !== undefined) updateData.status = status;
    if (interval !== undefined) updateData.interval = interval;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;

    const subscription = await prisma.subscription.update({
      where: { id: id as any },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        plan: true,
      },
    });

    res.json(subscription);
  } catch (error) {
    next(error);
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.subscription.findUnique({ where: { id: id as any } });
    if (!existing) return next(new AppError('订阅不存在', 404));

    await prisma.subscription.delete({ where: { id: id as any } });
    res.json({ message: '订阅已删除' });
  } catch (error) {
    next(error);
  }
};

export const getAllTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
};
