import prisma from '../src/services/prisma';
import redisService from '../src/services/redis.service';
import { QueueService } from '../src/services/queue.service';
import { JobWorker } from '../src/services/jobWorker';
import * as socketService from '../src/services/socket.service';

// Mock socketService broadcast methods
jest.mock('../src/services/socket.service', () => {
  const original = jest.requireActual('../src/services/socket.service');
  return {
    ...original,
    emitToAll: jest.fn(),
  };
});

describe('Job Queue and Worker Tests', () => {
  const testQueueName = 'test-queue';

  beforeEach(async () => {
    // Clear the jobs table before each test
    await prisma.job.deleteMany();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up
    await prisma.job.deleteMany();
  });

  test('Should create and execute job successfully (Life cycle PENDING -> RUNNING -> SUCCEEDED)', async () => {
    const payload = { testData: 'hello' };
    const handler = jest.fn().mockResolvedValue({ success: true, count: 42 });

    // Register test handler
    JobWorker.registerHandler(testQueueName, handler);

    // Enqueue
    const job = await QueueService.enqueue(testQueueName, payload, { type: 'test-job' });
    expect(job).toBeDefined();
    expect(job?.status).toBe('PENDING');
    expect(job?.attempts).toBe(0);

    // Force run polling once manually
    // @ts-ignore
    await JobWorker.pollJobs();

    // Verify handler run
    expect(handler).toHaveBeenCalled();
    const passedPayload = handler.mock.calls[0][0];
    expect(passedPayload).toEqual(payload);

    // Verify database job status
    const updatedJob = await prisma.job.findUnique({ where: { id: job?.id } });
    expect(updatedJob?.status).toBe('SUCCEEDED');
    expect(updatedJob?.progress).toBe(100);
    expect(updatedJob?.result).toBeDefined();
    expect(JSON.parse(updatedJob?.result || '{}')).toEqual({ success: true, count: 42 });

    // Verify socket.io broadcasts
    expect(socketService.emitToAll).toHaveBeenCalledWith(
      'job_progress',
      expect.objectContaining({
        jobId: job?.id,
        status: 'RUNNING',
      }),
    );
    expect(socketService.emitToAll).toHaveBeenCalledWith(
      'job_progress',
      expect.objectContaining({
        jobId: job?.id,
        status: 'SUCCEEDED',
        progress: 100,
      }),
    );
  });

  test('Should enforce idempotency (duplicate check on active jobs)', async () => {
    const payload = { uniqueId: 999 };
    const idempotencyKey = 'idemp-test-123';

    // Enqueue first time
    const job1 = await QueueService.enqueue(testQueueName, payload, { idempotencyKey });
    expect(job1).toBeDefined();

    // Enqueue second time with same key
    const job2 = await QueueService.enqueue(testQueueName, payload, { idempotencyKey });

    // Should return the exact same job instance
    expect(job2?.id).toBe(job1?.id);

    const count = await prisma.job.count({ where: { idempotencyKey } });
    expect(count).toBe(1); // Only 1 job created
  });

  test('Should handle failure and exponential backoff reschedule retryCount', async () => {
    const payload = { fail: true };
    const handler = jest.fn().mockRejectedValue(new Error('Mock Handler Failure'));

    JobWorker.registerHandler(testQueueName, handler);

    // Enqueue with maxAttempts = 2
    const job = await QueueService.enqueue(testQueueName, payload, { maxAttempts: 2 });
    expect(job).toBeDefined();

    // First Poll -> Failure -> Rescheduled as PENDING
    // @ts-ignore
    await JobWorker.pollJobs();

    const jobAfterFirstFail = await prisma.job.findUnique({ where: { id: job?.id } });
    expect(jobAfterFirstFail?.status).toBe('PENDING');
    expect(jobAfterFirstFail?.attempts).toBe(1);
    expect(jobAfterFirstFail?.retryCount).toBe(1);
    expect(jobAfterFirstFail?.error).toContain('Mock Handler Failure');
    expect(new Date(jobAfterFirstFail?.runAt || 0).getTime()).toBeGreaterThan(Date.now());

    // Fake runAt back to past to trigger second poll immediately
    await prisma.job.update({
      where: { id: job?.id },
      data: { runAt: new Date(Date.now() - 10000) },
    });

    // Second Poll -> Ultimate Failure -> Marked as FAILED
    // @ts-ignore
    await JobWorker.pollJobs();

    const jobAfterSecondFail = await prisma.job.findUnique({ where: { id: job?.id } });
    expect(jobAfterSecondFail?.status).toBe('FAILED');
    expect(jobAfterSecondFail?.attempts).toBe(2);
    expect(jobAfterSecondFail?.retryCount).toBe(1); // retryCount is attempts before final crash, or stays same
  });

  test('Should enforce concurrent distributed lock exclusion', async () => {
    const payload = { lock: true };
    const job = await QueueService.enqueue(testQueueName, payload);

    // Acquire the lock key manually first to simulate another worker running it.
    // JobWorker now uses acquireRedlock(`job:${id}`) which (with the `lock:`
    // prefix added by acquireRedlock) resolves to the key `lock:job:${id}`.
    const lockKey = `lock:job:${job?.id}`;
    const locked = await redisService.acquireLock(lockKey, 30);
    expect(locked).toBe(true);

    const handler = jest.fn();
    JobWorker.registerHandler(testQueueName, handler);

    // Attempt poll -> should skip because lock is busy
    // @ts-ignore
    await JobWorker.pollJobs();

    expect(handler).not.toHaveBeenCalled();

    const freshJob = await prisma.job.findUnique({ where: { id: job?.id } });
    expect(freshJob?.status).toBe('PENDING'); // Kept pending since lock was skipped

    // Release and run again
    await redisService.releaseLock(lockKey);
    // @ts-ignore
    await JobWorker.pollJobs();

    expect(handler).toHaveBeenCalled();
    const updatedJob = await prisma.job.findUnique({ where: { id: job?.id } });
    expect(updatedJob?.status).toBe('SUCCEEDED');
  });
});
