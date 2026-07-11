import { redisService } from '../services/redis.service';

/**
 * P-6.3：基于 Redlock 算法的分布式临界区工具
 * 用于资产发布、课程报名等高并发场景，防止跨节点超卖
 *
 * 在 Redlock 不可用时（如测试/开发环境），`acquireRedlock` 会降级为
 * 本地内存互斥锁，保证单进程内的临界区串行执行。
 *
 * @param resource 锁资源标识（如 `asset:publish:${id}`）
 * @param fn 临界区函数
 * @param ttl 锁存活时间（毫秒），默认 30 秒
 * @returns fn 的返回值
 * @throws {ResourceLockedError} 当无法获取锁时（由 redlock 抛出）
 */
export async function withRedlock<T>(
  resource: string,
  fn: () => Promise<T>,
  ttl: number = 30_000,
): Promise<T> {
  const lock = await redisService.acquireRedlock(resource, ttl);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
