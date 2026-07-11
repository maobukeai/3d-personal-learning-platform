import Redis from 'ioredis';
import Redlock, { ResourceLockedError } from 'redlock';
import prisma from '../src/services/prisma';
import { withRowLock } from '../src/utils/dbLock';

/**
 * Redlock 分布式锁 + DB 行级锁测试（铁律六·3）。
 *
 * 这些测试需要真实 Redis 连接（Redlock 依赖 Redis 的 Lua 脚本能力，无法用
 * 本地内存缓存模拟）。若测试环境没有 Redis，所有 Redlock 测试会自动跳过
 * （标记为通过并打印警告），而不是失败。
 *
 * withRowLock 测试需要真实数据库连接（MySQL），若数据库不可用同样跳过。
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redis: Redis | null = null;
let redlock: Redlock | null = null;
let redisAvailable = false;
let dbAvailable = false;

// 与 redis.service.ts 中 acquireRedlock 完全一致的封装，便于在测试中直接验证
// Redlock 算法路径（singleton 在 NODE_ENV=test 下不会初始化 redlock）。
const acquireRedlock = (resource: string, ttl: number) => {
  if (!redlock) {
    throw new ResourceLockedError('Redlock not initialized');
  }
  return redlock.acquire(['lock:' + resource], ttl);
};

beforeAll(async () => {
  // 1) 尝试连接 Redis
  try {
    redis = new Redis(REDIS_URL, {
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // 不重试，快速失败
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Redis connect timeout')), 2500);
      redis!.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      redis!.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    // 复用 singleton 中的 Redlock 配置：retryCount=3, retryDelay=200, retryJitter=100
    redlock = new Redlock([redis], {
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
    });
    redisAvailable = true;
  } catch {
    redisAvailable = false;
    if (redis) {
      try {
        await redis.quit();
      } catch {
        // ignore
      }
    }
    redis = null;
    redlock = null;
  }

  // 2) 探测数据库是否可用
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // ignore
    }
  }
});

const skipIfNoRedis = () => {
  if (!redisAvailable) {
    // 测试环境没有 Redis —— 跳过而非失败
    // eslint-disable-next-line no-console
    console.warn('[SKIP] Redis 不可用，跳过 Redlock 测试');
    return true;
  }
  return false;
};

const skipIfNoDb = () => {
  if (!dbAvailable) {
    // eslint-disable-next-line no-console
    console.warn('[SKIP] 数据库不可用，跳过 withRowLock 测试');
    return true;
  }
  return false;
};

describe('Redlock 分布式锁', () => {
  test('并发抢锁：5 个 worker 同时抢同一资源，仅 1 个成功，其余 4 个抛 ResourceLockedError', async () => {
    if (skipIfNoRedis()) return;

    const resource = `test-resource-${Date.now()}`;
    const ttl = 5000;

    // 5 个 worker 并发抢锁
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => acquireRedlock(resource, ttl)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    // 失败的 worker 必须是 ResourceLockedError
    for (const r of rejected) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ResourceLockedError);
      }
    }

    // 释放胜出的锁，避免影响后续测试
    const winner = fulfilled[0];
    if (winner && winner.status === 'fulfilled') {
      await winner.value.release();
    }
  });

  test('锁释放后可重新获取', async () => {
    if (skipIfNoRedis()) return;

    const resource = `test-resource-rel-${Date.now()}`;
    const ttl = 5000;

    // Worker A 抢到锁
    const lockA = await acquireRedlock(resource, ttl);
    expect(lockA).toBeDefined();
    expect(lockA.resources).toContain('lock:' + resource);

    // Worker B 同时抢锁应失败
    await expect(acquireRedlock(resource, ttl)).rejects.toBeInstanceOf(ResourceLockedError);

    // Worker A 释放锁
    await lockA.release();

    // Worker A 释放后，Worker B 可以重新获取
    const lockB = await acquireRedlock(resource, ttl);
    expect(lockB).toBeDefined();
    await lockB.release();
  });

  test('Redlock quorum：单实例下 acquire/release 往返正常（健康检查）', async () => {
    if (skipIfNoRedis()) return;

    const resource = `test-resource-quorum-${Date.now()}`;
    const lock = await acquireRedlock(resource, 2000);
    expect(lock.value).toBeTruthy();

    // release 返回 ExecutionResult（含 attempts）
    const releaseResult = await lock.release();
    expect(releaseResult).toBeDefined();

    // 释放后可再次获取
    const lock2 = await acquireRedlock(resource, 2000);
    await lock2.release();
  });
});

describe('withRowLock DB 行级锁', () => {
  const testQueueName = 'redlock-test-queue';

  test('在事务中执行 SELECT ... FOR UPDATE 不报错，回调正常返回', async () => {
    if (skipIfNoDb()) return;

    // 创建一条 Job 用于行锁测试
    const job = await prisma.job.create({
      data: {
        queueName: testQueueName,
        payload: '{}',
        type: 'redlock-test',
      },
    });

    try {
      const result = await prisma.$transaction(async (tx) =>
        withRowLock(tx, 'Job', job.id, async (tx) => {
          // 在持锁状态下读取该行，验证事务内可正常访问
          const row = await tx.job.findUnique({ where: { id: job.id } });
          return row?.id;
        }),
      );

      expect(result).toBe(job.id);
    } finally {
      await prisma.job.delete({ where: { id: job.id } }).catch(() => {
        // ignore cleanup errors
      });
    }
  });

  test('withRowLock 在事务内串行执行回调', async () => {
    if (skipIfNoDb()) return;

    const job = await prisma.job.create({
      data: {
        queueName: testQueueName,
        payload: '{}',
        type: 'redlock-test',
      },
    });

    try {
      const order: string[] = [];
      await prisma.$transaction(async (tx) => {
        await withRowLock(tx, 'Job', job.id, async (tx) => {
          order.push('locked-start');
          // 事务内的更新应在持锁期间完成
          await tx.job.update({
            where: { id: job.id },
            data: { progress: 42 },
          });
          order.push('locked-end');
        });
      });
      order.push('committed');

      expect(order).toEqual(['locked-start', 'locked-end', 'committed']);

      const updated = await prisma.job.findUnique({ where: { id: job.id } });
      expect(updated?.progress).toBe(42);
    } finally {
      await prisma.job.delete({ where: { id: job.id } }).catch(() => {
        // ignore
      });
    }
  });
});
