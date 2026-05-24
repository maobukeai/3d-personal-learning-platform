import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getPlanName } from '../../utils/plan-utils';
import prisma from '../../services/prisma';

export const requireMinPlan = (minPriority: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }

    // Dynamically query subscription to avoid eager load overhead on other requests
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      include: { plan: true },
    });

    const userPlanPriority = subscription?.plan?.priority ?? 0;

    if (userPlanPriority < minPriority) {
      return res.status(403).json({
        error: '权限不足',
        message: `当前内容需要 ${getPlanName(minPriority)} 及以上会员权限才能访问`,
        requiredPlan: minPriority,
        currentPlan: userPlanPriority,
        currentPlanName: getPlanName(userPlanPriority),
      });
    }

    next();
  };
};
