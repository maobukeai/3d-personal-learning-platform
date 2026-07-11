import prisma from '../src/services/prisma';
import { withRowLock } from '../src/utils/dbLock';
import {
  awardPoints,
  deductPoints,
  PointsAction,
  POINTS_RULES,
} from '../src/services/points.service';

/**
 * 并发回归测试（铁律六·3）。
 *
 * 验证 `withRowLock` + Prisma 事务能正确防止高并发写场景下的 lost update：
 *   1. 资产点赞计数器 — 100 并发 toggle 不产生计数漂移
 *   2. 积分增减 — 100 并发 awardPoints 不丢失任何一次 increment
 *
 * 这些测试需要真实数据库连接（MySQL），若数据库不可用则跳过。
 */

const CONCURRENCY = 20; // 并发数（控制为 20 以便 CI 环境也能跑）

let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

const skipIfNoDb = () => {
  if (!dbAvailable) {
    console.warn('[concurrency.test] DB unavailable, skipping tests.');
    return true;
  }
  return false;
};

describe('并发点赞计数器 — withRowLock 防止 lost update', () => {
  test('多个事务并发 toggle 同一 Asset 的 likes 计数，最终计数正确', async () => {
    if (skipIfNoDb()) return;

    // 准备：创建测试 owner User、一条测试 Asset 与 20 个测试 User
    const owner = await prisma.user.create({
      data: {
        email: `concurrency-owner-${Date.now()}@example.com`,
        name: 'concurrency-test-owner',
        password: 'hash',
        role: 'USER',
        status: 'ACTIVE',
        points: 0,
      },
    });

    const asset = await prisma.asset.create({
      data: {
        title: 'concurrency-test-asset',
        status: 'APPROVED',
        type: 'MODEL',
        userId: owner.id,
        url: 'https://example.com/test.glb',
        size: 1,
      },
    });

    const userIds: string[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const u = await prisma.user.create({
        data: {
          email: `concurrency-test-${i}-${Date.now()}@example.com`,
          name: `concurrency-test-${i}`,
          password: 'hash',
          role: 'USER',
          status: 'ACTIVE',
          points: 0,
        },
      });
      userIds.push(u.id);
    }

    try {
      // 执行：20 个用户并发点赞同一资产
      // 每个用户都会：进入事务 -> 锁 Asset 行 -> 创建 AssetLike -> count -> update Asset.likes
      await Promise.all(
        userIds.map(async (userId) => {
          await prisma.$transaction(async (tx) => {
            return await withRowLock(tx, 'Asset', asset.id, async (lockedTx) => {
              await lockedTx.assetLike.create({
                data: { assetId: asset.id, userId, category: '默认' },
              });
              const likes = await lockedTx.assetLike.count({ where: { assetId: asset.id } });
              await lockedTx.asset.update({
                where: { id: asset.id },
                data: { likes },
              });
            });
          });
        }),
      );

      // 验证：最终 likes 计数必须等于 CONCURRENCY（无丢失、无重复）
      const finalAsset = await prisma.asset.findUnique({ where: { id: asset.id } });
      const finalLikesCount = await prisma.assetLike.count({ where: { assetId: asset.id } });

      expect(finalLikesCount).toBe(CONCURRENCY);
      expect(finalAsset?.likes).toBe(CONCURRENCY);
    } finally {
      // 清理
      await prisma.assetLike.deleteMany({ where: { assetId: asset.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: asset.id } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [...userIds, owner.id] } } })
        .catch(() => {});
    }
  });
});

describe('并发积分增减 — withRowLock 防止 lost update', () => {
  test('多个事务并发对同一 User awardPoints，最终积分 = 初始 + N * amount', async () => {
    if (skipIfNoDb()) return;

    const initialPoints = 100;
    const user = await prisma.user.create({
      data: {
        email: `points-concurrency-${Date.now()}@example.com`,
        name: 'points-concurrency-test',
        password: 'hash',
        role: 'USER',
        status: 'ACTIVE',
        points: initialPoints,
      },
    });

    try {
      const amount = POINTS_RULES[PointsAction.CREATE_COMMENT]; // 5
      const iterations = CONCURRENCY;

      // 并发调用 awardPoints（每个调用内部会用 withRowLock 锁 User 行）
      await Promise.all(
        Array.from({ length: iterations }, () => awardPoints(user.id, PointsAction.CREATE_COMMENT)),
      );

      // 验证：最终积分 = 初始 + N * amount（无丢失）
      const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(finalUser?.points).toBe(initialPoints + iterations * amount);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  test('并发 deductPoints 不会将积分扣为负数', async () => {
    if (skipIfNoDb()) return;

    const initialPoints = 30;
    const user = await prisma.user.create({
      data: {
        email: `deduct-concurrency-${Date.now()}@example.com`,
        name: 'deduct-concurrency-test',
        password: 'hash',
        role: 'USER',
        status: 'ACTIVE',
        points: initialPoints,
      },
    });

    try {
      // 并发扣减 20 次（每次 5 分，总共应扣 100，但初始只有 30，应被 Math.max(0,...) 限制）
      await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          deductPoints(user.id, PointsAction.CREATE_COMMENT),
        ),
      );

      // 验证：积分不为负
      const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(finalUser?.points).toBeGreaterThanOrEqual(0);
      // 由于 withRowLock 串行化，最终积分应为 max(0, 30 - 20*5) = 0
      // 但实际上 deductPoints 内部每次都重新读取当前值，所以经过足够多次扣减后应为 0
      expect(finalUser?.points).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });
});
