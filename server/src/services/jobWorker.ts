import type { Lock } from 'redlock';
import prisma from './prisma';
import redisService from './redis.service';
import { logger } from '../utils/logger';
import { emitToAll } from './socket.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler = (payload: any, job: any) => Promise<any>;

export class JobWorker {
  private static handlers = new Map<string, JobHandler>();
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isPolling = false;

  /**
   * Register a handler for a specific queue.
   */
  public static registerHandler(queueName: string, handler: JobHandler) {
    this.handlers.set(queueName, handler);
    const globalWithHandlers = globalThis as typeof globalThis & {
      JobWorkerHandlers?: Map<string, JobHandler>;
    };
    if (!globalWithHandlers.JobWorkerHandlers) {
      globalWithHandlers.JobWorkerHandlers = new Map<string, JobHandler>();
    }
    globalWithHandlers.JobWorkerHandlers.set(queueName, handler);
    logger.info(`Registered job handler for queue: "${queueName}"`);
  }

  /**
   * Get a registered handler.
   */
  public static getHandler(queueName: string): JobHandler | undefined {
    return this.handlers.get(queueName);
  }

  /**
   * Start the background polling loop.
   */
  public static start(intervalMs = 5000) {
    if (this.pollTimer) return;

    logger.info(`Starting JobWorker with polling interval of ${intervalMs}ms`);
    this.pollTimer = setInterval(() => {
      void this.pollJobs();
    }, intervalMs);
  }

  /**
   * Stop the background polling loop.
   */
  public static stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info('Stopped JobWorker');
    }
  }

  /**
   * Poll and execute pending jobs.
   */
  private static async pollJobs() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Find next pending job that is ready to run
      const job = await prisma.job.findFirst({
        where: {
          status: 'PENDING',
          runAt: { lte: new Date() },
        },
        orderBy: { runAt: 'asc' },
      });

      if (!job) {
        this.isPolling = false;
        return;
      }

      // Try to acquire a distributed lock via Redlock (replaces the simple
      // SET NX EX lock). Redlock throws ResourceLockedError when the lock
      // cannot be acquired after the configured retry budget is exhausted.
      let lock: Lock | null = null;
      try {
        lock = await redisService.acquireRedlock(`job:${job.id}`, 60000); // 1-minute lock duration
      } catch {
        // Lock busy — another worker is processing this job, skip this round
        this.isPolling = false;
        return;
      }

      try {
        // Double check status and atomically update to RUNNING to prevent race conditions
        let runningJob;
        try {
          runningJob = await prisma.job.update({
            where: { id: job.id, status: 'PENDING' },
            data: {
              status: 'RUNNING',
              startedAt: new Date(),
              attempts: { increment: 1 },
            },
          });
        } catch {
          // Record was already locked or updated by another worker
          this.isPolling = false;
          return;
        }

        logger.info(
          `Started processing job ${runningJob.id} on queue "${runningJob.queueName}" (Attempt #${runningJob.attempts})`,
        );

        // Broadcast RUNNING status
        emitToAll('job_progress', {
          jobId: runningJob.id,
          progress: runningJob.progress,
          status: 'RUNNING',
        });

        const handler = this.handlers.get(runningJob.queueName);
        if (!handler) {
          throw new Error(`No handler registered for queue "${runningJob.queueName}"`);
        }

        // Parse payload and execute
        const payload = JSON.parse(runningJob.payload);
        const result = await handler(payload, runningJob);

        // Success: Mark completed
        await prisma.job.update({
          where: { id: runningJob.id },
          data: {
            status: 'SUCCEEDED',
            finishedAt: new Date(),
            result: result ? JSON.stringify(result) : null,
            progress: 100,
          },
        });

        emitToAll('job_progress', {
          jobId: runningJob.id,
          progress: 100,
          status: 'SUCCEEDED',
          result,
        });

        logger.info(
          `Successfully completed job ${runningJob.id} on queue "${runningJob.queueName}"`,
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        logger.error(`Error processing job ${job.id} on queue "${job.queueName}":`, errorMsg);

        // Determine if we should retry
        const currentAttempts = job.attempts + 1; // since the attempt increment was done in update
        if (currentAttempts >= job.maxAttempts) {
          // Ultimate failure
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              finishedAt: new Date(),
              error: errorMsg,
            },
          });

          emitToAll('job_progress', {
            jobId: job.id,
            progress: job.progress,
            status: 'FAILED',
            error: errorMsg,
          });

          logger.warn(
            `Job ${job.id} exceeded max attempts (${job.maxAttempts}) and was marked as FAILED`,
          );
        } else {
          // Retry with exponential backoff (e.g. 10s, 30s, 90s, etc.)
          const backoffSeconds = Math.pow(3, currentAttempts) * 5;
          const nextRun = new Date(Date.now() + backoffSeconds * 1000);

          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'PENDING',
              runAt: nextRun,
              error: errorMsg,
              retryCount: currentAttempts,
            },
          });

          emitToAll('job_progress', {
            jobId: job.id,
            progress: job.progress,
            status: 'PENDING',
            error: errorMsg,
            retryCount: currentAttempts,
          });

          logger.info(
            `Job ${job.id} rescheduled to run at ${nextRun.toISOString()} (backoff delay: ${backoffSeconds}s)`,
          );
        }
      } finally {
        // Release distributed lock (Redlock ownership-verified release)
        if (lock) {
          await lock.release().catch((e: unknown) => {
            logger.warn(`Failed to release redlock for job ${job.id}:`, e);
          });
        }
      }
    } catch (err) {
      logger.error('Unexpected error in JobWorker polling loop:', err);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Helper method to report progress inside a handler.
   */
  public static async updateProgress(jobId: string, progress: number) {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const job = await prisma.job.update({
      where: { id: jobId },
      data: { progress: clampedProgress },
    });

    emitToAll('job_progress', {
      jobId,
      progress: clampedProgress,
      status: job.status,
    });
  }
}
