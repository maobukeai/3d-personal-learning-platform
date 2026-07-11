import request from 'supertest';
import bcrypt from 'bcryptjs';
import { performance } from 'perf_hooks';

// 1. Mock bullmq before any other imports
const mockJobsDb = new Map<string, any>();
const mockQueueAdd = jest.fn().mockImplementation((type, data, opts) => {
  const job = {
    id: data.jobId,
    name: type,
    data,
    opts,
    remove: jest.fn().mockImplementation(async () => {
      mockJobsDb.delete(data.jobId);
      return true;
    }),
  };
  mockJobsDb.set(data.jobId, job);
  return job;
});

const mockQueueGetJob = jest.fn().mockImplementation(async (jobId) => {
  return mockJobsDb.get(jobId) || null;
});

// Mock ioredis to support BullMQ initialization
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };
  });
});

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => {
      return {
        add: mockQueueAdd,
        getJob: mockQueueGetJob,
      };
    }),
    Worker: jest.fn().mockImplementation((name, processor, opts) => {
      (global as any).mockWorkerProcessor = processor;
      return {
        on: jest.fn(),
      };
    }),
  };
});

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
  optimize3DAsset: jest.fn(),
  executeAssetAnalysis: jest.fn().mockResolvedValue({
    polyCount: 100,
    drawCalls: 5,
    materialCount: 2,
    textureCount: 1,
  }),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import {
  updateProgressSchema,
  createReviewSchema,
  createNoteSchema,
} from '../../src/utils/schemas';
import { cancelBullMQJob, initBullMQ } from '../../src/services/bullmq.service';
import { redisService } from '../../src/services/redis.service';

describe('Empirical Challenger M5 Verification Tests', () => {
  const suffix = Date.now();
  const testUserEmail = `challenger-test-${suffix}@example.com`;
  const password = 'password123';
  let userId = '';
  let cookies: string[] = [];
  let courseId = '';
  let lessonId = '';

  beforeAll(async () => {
    // Cleanup leftovers
    await prisma.user.deleteMany({ where: { email: testUserEmail } });

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: await bcrypt.hash(password, 10),
        name: 'Challenger User',
        role: 'USER',
        points: 100,
      },
    });
    userId = user.id;

    // Login to get cookies
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserEmail, password });
    cookies = loginRes.get('Set-Cookie') || [];

    // Create course
    const course = await prisma.course.create({
      data: {
        title: `Challenger Course ${suffix}`,
        description: 'Test Course',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;

    // Create lesson
    const lesson = await prisma.lesson.create({
      data: {
        courseId: course.id,
        title: 'Challenger Lesson 1',
        content: 'Content',
        order: 1,
      },
    });
    lessonId = lesson.id;

    // Force Redis enabled and mock getNewRedisConnection for testing BullMQ
    redisService.isRedisEnabled = true;
    jest.spyOn(redisService, 'getNewRedisConnection').mockReturnValue({
      on: jest.fn(),
    } as any);
    initBullMQ();
  });

  afterAll(async () => {
    // Cleanup DB
    await prisma.courseNote.deleteMany({ where: { userId } });
    await prisma.courseReview.deleteMany({ where: { userId } });
    await prisma.lessonProgress.deleteMany({ where: { userId } });
    await prisma.enrollment.deleteMany({ where: { userId } });
    await prisma.discussion.deleteMany({ where: { userId } });
    await prisma.lesson.deleteMany({ where: { courseId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('Task 1: Zod Schema Boundaries', () => {
    it('should correctly validate updateProgressSchema', async () => {
      // 1. Negative progress input should fail
      const resultNeg = updateProgressSchema.safeParse({ courseId: 'c1', progress: -5 });
      expect(resultNeg.success).toBe(false);
      if (!resultNeg.success) {
        expect(resultNeg.error.issues[0]?.message).toContain('at least 0');
      }

      // 2. Out-of-bound progress input (> 100) should fail
      const resultOob = updateProgressSchema.safeParse({ courseId: 'c1', progress: 105 });
      expect(resultOob.success).toBe(false);
      if (!resultOob.success) {
        expect(resultOob.error.issues[0]?.message).toContain('cannot exceed 100');
      }

      // 3. Valid progress should succeed
      const resultOk = updateProgressSchema.safeParse({ courseId: 'c1', progress: 75 });
      expect(resultOk.success).toBe(true);

      // 4. Extra fields should be stripped during parse (but safeParse itself returns them in data, because Zod does not strip on parse unless using strict or transform, wait - let's see how our middleware handles it)
      const parsedData = updateProgressSchema.parse({
        courseId: 'c1',
        progress: 75,
        extraField: 'someValue',
      });
      // In zod, parsing returns the object. By default, it includes the extra fields in javascript output UNLESS we strip or use strict. Wait! Let's check:
      expect((parsedData as any).extraField).toBeUndefined(); // Let's check if extra fields are actually blocked/stripped by Zod schemas in this project.
    });

    it('should correctly validate createReviewSchema', async () => {
      // 1. Rating must be between 1 and 5
      const ratingZero = createReviewSchema.safeParse({ courseId: 'c1', rating: 0 });
      expect(ratingZero.success).toBe(false);

      const ratingSix = createReviewSchema.safeParse({ courseId: 'c1', rating: 6 });
      expect(ratingSix.success).toBe(false);

      // 2. Rating must be integer
      const ratingFloat = createReviewSchema.safeParse({ courseId: 'c1', rating: 4.5 });
      expect(ratingFloat.success).toBe(false);

      // 3. Comment exceeding max length should fail
      const commentLong = createReviewSchema.safeParse({
        courseId: 'c1',
        rating: 5,
        comment: 'a'.repeat(1001),
      });
      expect(commentLong.success).toBe(false);
    });

    it('should correctly validate createNoteSchema', async () => {
      // 1. Negative timestamp should fail
      const noteNeg = createNoteSchema.safeParse({
        lessonId: 'l1',
        content: 'note',
        timestamp: -1,
      });
      expect(noteNeg.success).toBe(false);

      // 2. Valid note should succeed
      const noteOk = createNoteSchema.safeParse({ lessonId: 'l1', content: 'note', timestamp: 10 });
      expect(noteOk.success).toBe(true);
    });
  });

  describe('Task 2: Prisma Transaction Rollbacks', () => {
    it('rolls back course enrollment when audit log write fails', async () => {
      // Mock $transaction to intercept the transaction client tx and mock its auditLog.create method
      const originalTransaction = prisma.$transaction;
      const txMockSpy = jest.spyOn(prisma, '$transaction').mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          return originalTransaction.call(prisma, async (tx: any) => {
            jest
              .spyOn(tx.auditLog, 'create')
              .mockRejectedValueOnce(new Error('Simulated Database Failure in Audit Log'));
            return arg(tx);
          });
        }
        return originalTransaction.call(prisma, arg);
      });

      // Call course enrollment
      const res = await request(app)
        .post('/api/courses/enroll')
        .set('Cookie', cookies)
        .send({ courseId });

      // The enrollment API should fail due to the propagated exception
      expect(res.status).not.toBe(201);

      // Check that the enrollment record was NOT persisted (rolled back)
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId_teamId: {
            userId,
            courseId,
            teamId: res.body.teamId || '',
          },
        },
      });
      expect(enrollment).toBeNull();

      txMockSpy.mockRestore();
    });

    it('rolls back lesson progress updates when points awarding fails', async () => {
      // Mock $transaction to intercept the transaction client tx and mock its user.update method
      const originalTransaction = prisma.$transaction;
      const txMockSpy = jest.spyOn(prisma, '$transaction').mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          return originalTransaction.call(prisma, async (tx: any) => {
            jest
              .spyOn(tx.user, 'update')
              .mockRejectedValueOnce(new Error('Simulated Database Failure in User Points Update'));
            return arg(tx);
          });
        }
        return originalTransaction.call(prisma, arg);
      });

      // Complete a lesson
      const res = await request(app)
        .patch(`/api/courses/lessons/${lessonId}/complete`)
        .set('Cookie', cookies)
        .send({ completed: true });

      // The complete lesson API should fail due to the propagated exception
      expect(res.status).not.toBe(200);

      // Check that lessonProgress was NOT persisted (rolled back)
      const progress = await prisma.lessonProgress.findUnique({
        where: {
          userId_lessonId: { userId, lessonId },
        },
      });
      expect(progress).toBeNull();

      txMockSpy.mockRestore();
    });
  });

  describe('Task 3 & 4: BullMQ Job Queue Processing, Event Loop Blocking, and Cancellation', () => {
    it('verifies that the Worker processor executes jobs, and check event loop delay under load', async () => {
      const processor = (global as any).mockWorkerProcessor;
      expect(processor).toBeDefined();

      // Enqueue job in DB
      const jobDb = await prisma.job.create({
        data: {
          queueName: 'image-optimization',
          type: 'image-optimization',
          payload: JSON.stringify({ file: { path: 'dummy.jpg', originalname: 'dummy.jpg' } }),
          status: 'PENDING',
        },
      });

      // Mock the optimizeImage handler
      const imageModule = require('../../src/utils/image');
      const spyOptimize = jest.spyOn(imageModule, 'optimizeImage').mockResolvedValueOnce(undefined);

      // Call worker processor directly
      const result = await processor({
        data: {
          jobId: jobDb.id,
          payload: { file: { path: 'dummy.jpg', originalname: 'dummy.jpg' } },
          type: 'image-optimization',
        },
      });

      expect(result).toBeDefined();
      expect(spyOptimize).toHaveBeenCalled();

      // Check DB updated to SUCCEEDED
      const updatedJob = await prisma.job.findUnique({ where: { id: jobDb.id } });
      expect(updatedJob?.status).toBe('SUCCEEDED');

      spyOptimize.mockRestore();
    });

    it('measures event loop lag when executing high request load of worker jobs', async () => {
      const processor = (global as any).mockWorkerProcessor;
      const imageModule = require('../../src/utils/image');
      const spyOptimize = jest.spyOn(imageModule, 'optimizeImage').mockImplementation(async () => {
        // Simulate a small CPU/IO delay
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      const start = performance.now();
      let eventLoopTicks = 0;
      let maxLag = 0;

      // Track event loop ticks
      const interval = setInterval(() => {
        const tickStart = performance.now();
        setImmediate(() => {
          const lag = performance.now() - tickStart;
          if (lag > maxLag) maxLag = lag;
          eventLoopTicks++;
        });
      }, 5);

      // Enqueue and run 20 jobs concurrently (simulating load)
      const jobPromises = Array.from({ length: 20 }).map(async (_, idx) => {
        const jobDb = await prisma.job.create({
          data: {
            queueName: 'image-optimization',
            type: 'image-optimization',
            payload: JSON.stringify({ file: { path: `dummy-${idx}.jpg` } }),
            status: 'PENDING',
          },
        });

        return processor({
          data: {
            jobId: jobDb.id,
            payload: { file: { path: `dummy-${idx}.jpg` } },
            type: 'image-optimization',
          },
        });
      });

      await Promise.all(jobPromises);
      clearInterval(interval);

      const duration = performance.now() - start;
      console.log(`Processed 20 mock image-optimization jobs in ${duration.toFixed(2)}ms`);
      console.log(`Max event loop lag measured during worker load: ${maxLag.toFixed(2)}ms`);

      // Verify that event loop ticks were processed and event loop lag remained reasonable
      expect(eventLoopTicks).toBeGreaterThan(0);
      expect(maxLag).toBeLessThan(100); // Expect event loop lag to remain under 100ms for async jobs

      spyOptimize.mockRestore();
    });

    it('verifies that job cancellation prevents worker execution and removes job from queue', async () => {
      // 1. Enqueue job
      const jobDb = await prisma.job.create({
        data: {
          queueName: 'image-optimization',
          type: 'image-optimization',
          payload: JSON.stringify({ file: { path: 'dummy-cancel.jpg' } }),
          status: 'PENDING',
          idempotencyKey: `cancel-test-${suffix}`,
        },
      });

      // Add to mock queue
      await mockQueueAdd('image-optimization', {
        jobId: jobDb.id,
        payload: {},
        type: 'image-optimization',
      });
      expect(mockJobsDb.has(jobDb.id)).toBe(true);

      // 2. Mark CANCELLED in DB and call cancelBullMQJob
      await prisma.job.update({
        where: { id: jobDb.id },
        data: { status: 'CANCELLED' },
      });
      const cancelled = await cancelBullMQJob(jobDb.id);
      expect(cancelled).toBe(true);

      // Verify removed from BullMQ queue
      expect(mockJobsDb.has(jobDb.id)).toBe(false);

      // 3. Try to process the cancelled job with the worker
      const processor = (global as any).mockWorkerProcessor;
      const spyOptimize = jest.spyOn(require('../../src/utils/image'), 'optimizeImage');

      await processor({
        data: {
          jobId: jobDb.id,
          payload: {},
          type: 'image-optimization',
        },
      });

      // The worker should abort early and NOT call the optimization handler
      expect(spyOptimize).not.toHaveBeenCalled();

      spyOptimize.mockRestore();
    });
  });
});
