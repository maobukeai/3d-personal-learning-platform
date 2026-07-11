import prisma from './prisma';
import { logger } from '../utils/logger';
import { redisService } from './redis.service';
import { enqueueBullMQ } from './bullmq.service';

export interface EnqueueOptions {
  maxAttempts?: number;
  delaySeconds?: number;
  uniqueKey?: string; // Legacy alias for idempotencyKey
  idempotencyKey?: string;
  type?: string;
  userId?: string; // Owning user — used for targeted Socket.io job_progress push
}

export class QueueService {
  /**
   * Enqueues a job to a database-backed queue or BullMQ.
   * If an idempotencyKey/uniqueKey is provided, it prevents duplicate enqueues of active tasks.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async enqueue(queueName: string, payload: any, options: EnqueueOptions = {}) {
    const maxAttempts = options.maxAttempts ?? 3;
    const delaySeconds = options.delaySeconds ?? 0;
    const idempotencyKey = options.idempotencyKey ?? options.uniqueKey;
    const type = options.type ?? queueName;

    const runAt = new Date(Date.now() + delaySeconds * 1000);
    const payloadStr = JSON.stringify(payload);

    if (idempotencyKey) {
      // Check for an existing PENDING or RUNNING job to prevent double execution
      const existingJob = await prisma.job.findFirst({
        where: {
          idempotencyKey,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
      if (existingJob) {
        logger.info(
          `Skipped duplicate enqueue: found active job ${existingJob.id} with idempotencyKey "${idempotencyKey}"`,
        );
        return existingJob;
      }
    }

    try {
      const job = await prisma.job.create({
        data: {
          queueName,
          type,
          payload: payloadStr,
          maxAttempts,
          runAt,
          idempotencyKey: idempotencyKey || null,
          lockKey: idempotencyKey || null, // Sync lockKey for backward compatibility
          status: 'PENDING',
        },
      });
      logger.info(`Enqueued job ${job.id} to queue "${queueName}"`);

      // If Redis is enabled, enqueue into BullMQ
      if (redisService.isRedisEnabled) {
        await enqueueBullMQ(queueName, payload, job.id, {
          maxAttempts,
          type,
          userId: options.userId,
        });
      }

      return job;
    } catch (err: unknown) {
      // P2002 is Prisma's code for unique constraint violation (idempotency key clash)
      if (
        err &&
        typeof err === 'object' &&
        (err as Record<string, unknown>).code === 'P2002' &&
        idempotencyKey
      ) {
        logger.warn(
          `Skipped duplicate job enqueue for uniqueKey "${idempotencyKey}" due to DB constraint`,
        );
        const existingJob = await prisma.job.findFirst({
          where: { idempotencyKey },
        });
        return existingJob;
      }
      logger.error(`Failed to enqueue job to queue "${queueName}":`, err);
      throw err;
    }
  }

  /**
   * Retrieves a job by ID
   */
  public static async getJob(jobId: string) {
    return prisma.job.findUnique({
      where: { id: jobId },
    });
  }
}
