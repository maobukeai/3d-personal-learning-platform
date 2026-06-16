import { redisService } from '../services/redis.service';
import prisma from '../services/prisma';

async function checkRedis() {
  const client = (redisService as any).client;
  if (!client) {
    console.log('Redis client is not initialized or active.');
    return;
  }

  // WARNING: `KEYS *` blocks Redis in production with large datasets.
  // For production, replace with `SCAN` iterator for non-blocking traversal.
  const keys = await client.keys('*');
  console.log('Redis keys:', keys);
}

checkRedis()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
