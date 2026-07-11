import prisma from './prisma';
import { logger } from '../utils/logger';
import { redisService } from './redis.service';
import { withRowLock, TransactionClient } from '../utils/dbLock';

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

/**
 * Awards points to a user. 铁律六·3 — 当调用方传入 `tx`（处于事务内）时，
 * 先对 User 行加 FOR UPDATE 行级锁，避免并发积分增减导致 lost update。
 * 当调用方未传入 `tx`（独立调用），内部自建一个短事务包裹行锁。
 */
export const awardPoints = async (
  userId: string,
  action: PointsAction,
  tx?: TransactionClient,
): Promise<number> => {
  const amount = POINTS_RULES[action];
  if (!amount) return 0;

  try {
    if (tx) {
      // Caller is already inside a transaction — lock the row and increment.
      return await withRowLock(tx as TransactionClient, 'User', userId, async (lockedTx) => {
        const user = await lockedTx.user.update({
          where: { id: userId },
          data: { points: { increment: amount } },
          select: { points: true },
        });
        await redisService.invalidateUserCache(userId).catch(() => {});
        logger.info(
          `[Points] Awarded ${amount} points to user ${userId} for ${ACTION_NAMES[action]}. New total: ${user.points}`,
        );
        return user.points;
      });
    }
    // Standalone call — wrap in a short transaction with row lock.
    return await prisma.$transaction(async (innerTx) => {
      return await withRowLock(innerTx, 'User', userId, async (lockedTx) => {
        const user = await lockedTx.user.update({
          where: { id: userId },
          data: { points: { increment: amount } },
          select: { points: true },
        });
        await redisService.invalidateUserCache(userId).catch(() => {});
        logger.info(
          `[Points] Awarded ${amount} points to user ${userId} for ${ACTION_NAMES[action]}. New total: ${user.points}`,
        );
        return user.points;
      });
    });
  } catch (error) {
    logger.error(`[Points] Failed to award points to user ${userId} for ${action}:`, error);
    if (tx) throw error;
    return 0;
  }
};

/**
 * Deducts points from a user. 铁律六·3 — 当调用方传入 `tx`（处于事务内）时，
 * 先对 User 行加 FOR UPDATE 行级锁，避免并发扣减导致 lost update 或超扣。
 * 当调用方未传入 `tx`（独立调用），内部自建一个短事务包裹行锁。
 */
export const deductPoints = async (
  userId: string,
  action: PointsAction,
  tx?: TransactionClient,
): Promise<number> => {
  const amount = POINTS_RULES[action];
  if (!amount) return 0;

  try {
    if (tx) {
      return await withRowLock(tx as TransactionClient, 'User', userId, async (lockedTx) => {
        const user = await lockedTx.user.findUnique({
          where: { id: userId },
          select: { points: true },
        });
        if (!user) return 0;
        const newPoints = Math.max(0, user.points - amount);
        const updated = await lockedTx.user.update({
          where: { id: userId },
          data: { points: newPoints },
          select: { points: true },
        });
        await redisService.invalidateUserCache(userId).catch(() => {});
        logger.info(
          `[Points] Deducted ${amount} points from user ${userId} due to undoing ${ACTION_NAMES[action]}. New total: ${updated.points}`,
        );
        return updated.points;
      });
    }
    return await prisma.$transaction(async (innerTx) => {
      return await withRowLock(innerTx, 'User', userId, async (lockedTx) => {
        const user = await lockedTx.user.findUnique({
          where: { id: userId },
          select: { points: true },
        });
        if (!user) return 0;
        const newPoints = Math.max(0, user.points - amount);
        const updated = await lockedTx.user.update({
          where: { id: userId },
          data: { points: newPoints },
          select: { points: true },
        });
        await redisService.invalidateUserCache(userId).catch(() => {});
        logger.info(
          `[Points] Deducted ${amount} points from user ${userId} due to undoing ${ACTION_NAMES[action]}. New total: ${updated.points}`,
        );
        return updated.points;
      });
    });
  } catch (error) {
    logger.error(`[Points] Failed to deduct points from user ${userId} for ${action}:`, error);
    if (tx) throw error;
    return 0;
  }
};
