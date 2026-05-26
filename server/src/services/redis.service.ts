import Redis from 'ioredis';
import { logger } from '../utils/logger';

class RedisService {
  private redisClient: Redis | null = null;
  private isRedisEnabled = false;
  // Local fallback cache with TTL
  private localCache = new Map<string, { value: any; expiresAt: number }>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
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
    } catch (e: any) {
      logger.error('Failed to initialize Redis client:', e.message);
      this.isRedisEnabled = false;
      this.redisClient = null;
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

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
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

  async invalidateUserCache(userId: string): Promise<void> {
    const key = `user_auth:${userId}`;
    await this.del(key);
  }
}

export const redisService = new RedisService();
export default redisService;
