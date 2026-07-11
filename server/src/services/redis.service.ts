import Redis from 'ioredis';
import Redlock, { Lock, ResourceLockedError } from 'redlock';
import { logger } from '../utils/logger';

class RedisService {
  private redisClient: Redis | null = null;
  private redlock: Redlock | null = null;
  public isRedisEnabled = false;
  private static readonly PRUNE_INTERVAL_MS = 60_000;
  private static readonly LOCAL_CACHE_MAX_SIZE = 1000;
  private lastPruneTime = 0;
  // Local fallback cache with TTL
  private localCache = new Map<string, { value: unknown; expiresAt: number }>();

  public getNewRedisConnection() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      lazyConnect: true,
    });
  }

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_REDIS_IN_TESTS !== 'true') {
      return;
    }

    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          // Exponential backoff capped at 5 seconds. Avoids client termination (null) so connection can recover.
          const delay = Math.min(times * 500, 5000);
          return delay;
        },
      });

      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis server.');
        this.isRedisEnabled = true;
      });

      this.redisClient.on('reconnecting', () => {
        logger.warn('Redis disconnected. Attempting to reconnect...');
        this.isRedisEnabled = false; // Fallback to local memory cache while reconnecting
      });

      this.redisClient.on('error', (err) => {
        logger.warn(`Redis error: ${err.message}`);
        this.isRedisEnabled = false;
      });

      // Create a Redlock instance sharing the existing redisClient connection.
      // Redlock v5 accepts ioredis clients directly and uses Lua scripts (EVALSHA)
      // to acquire/release locks atomically across the registered clients.
      this.redlock = new Redlock([this.redisClient], {
        retryCount: 3,
        retryDelay: 200,
        retryJitter: 100,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Failed to initialize Redis client:', msg);
      this.isRedisEnabled = false;
      this.redisClient = null;
    }
  }

  private pruneCache() {
    const now = Date.now();
    // Only prune if at least 1 minute has passed since last prune
    if (now - this.lastPruneTime < RedisService.PRUNE_INTERVAL_MS) return;
    this.lastPruneTime = now;

    for (const [key, cached] of this.localCache.entries()) {
      if (now >= cached.expiresAt) {
        this.localCache.delete(key);
      }
    }

    // Capping at 1000 items to prevent unbounded memory growth
    if (this.localCache.size > RedisService.LOCAL_CACHE_MAX_SIZE) {
      const keysToKeep = Array.from(this.localCache.keys()).slice(
        -RedisService.LOCAL_CACHE_MAX_SIZE,
      );
      const newCache = new Map<string, { value: unknown; expiresAt: number }>();
      for (const k of keysToKeep) {
        const item = this.localCache.get(k);
        if (item) {
          newCache.set(k, item);
        }
      }
      this.localCache = newCache;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        if (val) {
          return JSON.parse(val) as T;
        }
        return null;
      } catch (err) {
        logger.error(`Redis GET error for key ${key}:`, err);
        // Fallback to local cache if Redis fails during runtime
      }
    }

    // Local fallback
    const cached = this.localCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return cached.value as T;
      }
      // Expired
      this.localCache.delete(key);
    }
    return null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.pruneCache();
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const stringified = JSON.stringify(value);
        await this.redisClient.set(key, stringified, 'EX', ttlSeconds);
        return;
      } catch (err) {
        logger.error(`Redis SET error for key ${key}:`, err);
      }
    }

    // Local fallback
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.localCache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err) {
        logger.error(`Redis DEL error for key ${key}:`, err);
      }
    }

    // Local fallback
    this.localCache.delete(key);
  }

  /**
   * Acquire a distributed lock using the Redlock algorithm.
   *
   * Redlock v5 uses a cryptographically-random lock value and Lua scripts to
   * guarantee that locks are acquired/released atomically and that a lock can
   * only be released by its owner. This is preferred over the simple
   * `acquireLock` SET NX EX approach, which lacks ownership verification on
   * release and is therefore vulnerable to accidental release by a non-owner.
   *
   * When Redis (and therefore the Redlock instance) is unavailable — e.g. in
   * test or development environments — this method degrades gracefully to the
   * local-cache fallback lock, mirroring the behaviour of every other method in
   * this service. This keeps callers working without a Redis dependency while
   * still providing mutual exclusion within a single process.
   *
   * @param resource Logical resource name (the `lock:` prefix is added automatically).
   * @param ttl      Lock duration in milliseconds.
   * @returns        A `Lock` object whose `release()` method must be called in a
   *                 `finally` block once the protected work is done.
   * @throws         `ResourceLockedError` when the lock cannot be acquired after
   *                 the configured retry budget is exhausted.
   */
  async acquireRedlock(resource: string, ttl: number): Promise<Lock> {
    if (this.redlock) {
      return this.redlock.acquire(['lock:' + resource], ttl);
    }

    // Fallback for environments without Redis (test/dev): use the simple
    // local-cache lock. Returns a Lock-compatible shim whose release() drops
    // the local cache entry. This is consistent with the degradation strategy
    // used by get/set/del/acquireLock above.
    const key = 'lock:' + resource;
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const acquired = await this.acquireLock(key, ttlSeconds);
    if (!acquired) {
      throw new ResourceLockedError(`Could not acquire lock on ${resource}`);
    }
    const expiration = Date.now() + ttl;
    const fallbackLock = {
      resources: [key],
      value: `fallback-${expiration}`,
      attempts: [] as ReadonlyArray<Promise<unknown>>,
      expiration,
      release: async () => {
        await this.releaseLock(key);
        return { attempts: [] as ReadonlyArray<Promise<unknown>> };
      },
    };
    return fallbackLock as unknown as Lock;
  }

  /**
   * @deprecated Use `acquireRedlock` instead. The simple SET NX EX lock does not
   * verify ownership on release and is retained only for backwards compatibility
   * with existing call sites and the local fallback cache.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const result = await this.redisClient.set(key, 'locked', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err) {
        logger.error(`Redis acquireLock error for key ${key}:`, err);
      }
    }

    // Local fallback lock
    const cached = this.localCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return false; // Already locked
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.localCache.set(key, { value: 'locked', expiresAt });
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  /**
   * Atomically increments a numeric counter by 1 and (on first creation) sets an expiry.
   * Falls back to a local-cache get-increment-set when Redis is unavailable.
   */
  async incr(key: string, ttlSeconds: number): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const newVal = await this.redisClient.incr(key);
        if (newVal === 1) {
          // First increment — set expiry so the key eventually cleans itself up
          await this.redisClient.expire(key, ttlSeconds);
        }
        return;
      } catch (err) {
        logger.error(`Redis INCR error for key ${key}:`, err);
      }
    }

    // Local fallback: read → increment → write
    const cached = this.localCache.get(key);
    const current = cached && Date.now() < cached.expiresAt ? (cached.value as number) : 0;
    const expiresAt = cached?.expiresAt ?? Date.now() + ttlSeconds * 1000;
    this.localCache.set(key, { value: current + 1, expiresAt });
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const key = `user_auth:${userId}`;
    await this.del(key);
  }

  async quit(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Disconnected from Redis server.');
      } catch (err) {
        logger.warn('Failed to disconnect from Redis:', err);
      } finally {
        this.redisClient = null;
        this.redlock = null;
        this.isRedisEnabled = false;
      }
    }
  }
}

export const redisService = new RedisService();
export default redisService;
