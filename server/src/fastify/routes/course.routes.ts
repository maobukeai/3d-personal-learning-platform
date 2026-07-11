import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../utils/error';
import { fastifyAuthenticate, fastifyOptionalAuthenticate } from '../auth/fastify-auth';
import * as courseController from '../../controllers/course.controller';
import {
  courseSchema,
  enrollCourseSchema,
  updateProgressSchema,
  toggleLessonCompleteSchema,
  toggleLessonCompleteParamsSchema,
  createReviewSchema,
  updateReviewSchema,
  createNoteSchema,
  updateNoteSchema,
} from '../../utils/schemas';

/**
 * Fastify 课程路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/courses
 *
 * 路由级限流：shareLimiter (30/min) 对齐 Express share-rate-limit。
 */

// --- Params schemas ---

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const courseIdParamsSchema = z.object({
  courseId: z.string().min(1),
});

const lessonIdParamsSchema = z.object({
  lessonId: z.string().min(1),
});

// shareLimiter: 30/min（对齐 Express share-rate-limit）
const SHARE_RATE_LIMIT = { max: 30, timeWindow: '1 minute' };

const requireAdmin = (request: FastifyRequest): void => {
  if (request.user?.role !== 'ADMIN') {
    throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
  }
};

export const registerCourseRoutes = (app: FastifyInstance): void => {
  // GET /courses —— 课程列表（公开浏览，可选鉴权）
  app.get(
    '/courses',
    {
      preHandler: [fastifyOptionalAuthenticate],
      config: { rateLimit: SHARE_RATE_LIMIT },
    },
    courseController.getAllCourses,
  );

  // GET /courses/categories —— 课程分类
  app.get('/courses/categories', courseController.getCourseCategories);

  // GET /courses/my-enrollments —— 我的选课
  app.get(
    '/courses/my-enrollments',
    { preHandler: [fastifyAuthenticate] },
    courseController.getMyEnrollments,
  );

  // POST /courses/enroll —— 选课
  app.post(
    '/courses/enroll',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: enrollCourseSchema },
    },
    courseController.enrollInCourse,
  );

  // PATCH /courses/progress —— 更新学习进度
  app.patch(
    '/courses/progress',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: updateProgressSchema },
    },
    courseController.updateProgress,
  );

  // POST /courses/parse-bilibili —— 解析 B 站视频（管理员）
  app.post(
    '/courses/parse-bilibili',
    {
      preHandler: [fastifyAuthenticate],
    },
    async (request, reply) => {
      requireAdmin(request);
      await courseController.parseBilibili(request, reply);
    },
  );

  // GET /courses/:id —— 课程详情（公开浏览，可选鉴权）
  app.get(
    '/courses/:id',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema },
      config: { rateLimit: SHARE_RATE_LIMIT },
    },
    courseController.getCourseById,
  );

  // POST /courses —— 创建课程（管理员）
  app.post(
    '/courses',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: courseSchema },
    },
    async (request, reply) => {
      requireAdmin(request);
      await courseController.createCourse(request, reply);
    },
  );

  // PUT /courses/:id —— 更新课程（管理员）
  app.put(
    '/courses/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: courseSchema },
    },
    async (request, reply) => {
      requireAdmin(request);
      await courseController.updateCourse(request, reply);
    },
  );

  // DELETE /courses/:id —— 删除课程（管理员）
  app.delete(
    '/courses/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      requireAdmin(request);
      await courseController.deleteCourse(request, reply);
    },
  );

  // ── 章节进度 ──────────────────────────────────────────────────────────

  // GET /courses/:courseId/lesson-progress
  app.get(
    '/courses/:courseId/lesson-progress',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: courseIdParamsSchema },
    },
    courseController.getLessonProgress,
  );

  // PATCH /courses/lessons/:lessonId/complete
  app.patch(
    '/courses/lessons/:lessonId/complete',
    {
      preHandler: [fastifyAuthenticate],
      schema: {
        params: toggleLessonCompleteParamsSchema,
        body: toggleLessonCompleteSchema,
      },
    },
    courseController.toggleLessonComplete,
  );

  // ── 课程评价 ──────────────────────────────────────────────────────────

  // GET /courses/:courseId/reviews —— 公开评价列表
  app.get(
    '/courses/:courseId/reviews',
    { schema: { params: courseIdParamsSchema } },
    courseController.getCourseReviews,
  );

  app.post(
    '/courses/reviews',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: createReviewSchema },
    },
    courseController.createReview,
  );

  app.put(
    '/courses/reviews/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: updateReviewSchema },
    },
    courseController.updateReview,
  );

  app.delete(
    '/courses/reviews/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    courseController.deleteReview,
  );

  // ── 课程笔记 ──────────────────────────────────────────────────────────

  app.get(
    '/courses/lessons/:lessonId/notes',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: lessonIdParamsSchema },
    },
    courseController.getLessonNotes,
  );

  app.post(
    '/courses/notes',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: createNoteSchema },
    },
    courseController.createNote,
  );

  app.put(
    '/courses/notes/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: updateNoteSchema },
    },
    courseController.updateNote,
  );

  app.delete(
    '/courses/notes/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    courseController.deleteNote,
  );
};
