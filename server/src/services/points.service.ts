import prisma from './prisma';
import { logger } from '../utils/logger';
import { redisService } from './redis.service';

export enum PointsAction {
  CREATE_DISCUSSION = 'CREATE_DISCUSSION',
  CREATE_COMMENT = 'CREATE_COMMENT',
  LIKE_CONTENT = 'LIKE_CONTENT',
  COMPLETE_LESSON = 'COMPLETE_LESSON',
  PUBLISH_SHOWCASE = 'PUBLISH_SHOWCASE',
  COMPLETE_TASK = 'COMPLETE_TASK',
}

export const POINTS_RULES: Record<PointsAction, number> = {
  [PointsAction.CREATE_DISCUSSION]: 15,
  [PointsAction.CREATE_COMMENT]: 5,
  [PointsAction.LIKE_CONTENT]: 2,
  [PointsAction.COMPLETE_LESSON]: 30,
  [PointsAction.PUBLISH_SHOWCASE]: 50,
  [PointsAction.COMPLETE_TASK]: 20,
};

const ACTION_NAMES: Record<PointsAction, string> = {
  [PointsAction.CREATE_DISCUSSION]: '发布讨论',
  [PointsAction.CREATE_COMMENT]: '发表评论',
  [PointsAction.LIKE_CONTENT]: '点赞内容',
  [PointsAction.COMPLETE_LESSON]: '完成课时学习',
  [PointsAction.PUBLISH_SHOWCASE]: '发布作品',
  [PointsAction.COMPLETE_TASK]: '完成协作任务',
};

export const awardPoints = async (userId: string, action: PointsAction): Promise<number> => {
  const amount = POINTS_RULES[action];
  if (!amount) return 0;

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: amount,
        },
      },
      select: {
        points: true,
      },
    });

    await redisService.invalidateUserCache(userId).catch(() => {});
    logger.info(
      `[Points] Awarded ${amount} points to user ${userId} for ${ACTION_NAMES[action]}. New total: ${user.points}`,
    );
    return user.points;
  } catch (error) {
    logger.error(`[Points] Failed to award points to user ${userId} for ${action}:`, error);
    return 0;
  }
};

export const deductPoints = async (userId: string, action: PointsAction): Promise<number> => {
  const amount = POINTS_RULES[action];
  if (!amount) return 0;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    if (!user) return 0;

    const newPoints = Math.max(0, user.points - amount);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { points: newPoints },
      select: { points: true },
    });

    await redisService.invalidateUserCache(userId).catch(() => {});
    logger.info(
      `[Points] Deducted ${amount} points from user ${userId} due to undoing ${ACTION_NAMES[action]}. New total: ${updated.points}`,
    );
    return updated.points;
  } catch (error) {
    logger.error(`[Points] Failed to deduct points from user ${userId} for ${action}:`, error);
    return 0;
  }
};
