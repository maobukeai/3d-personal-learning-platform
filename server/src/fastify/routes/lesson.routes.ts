import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';
import { fastifyAuthenticate, type SafeUser } from '../auth/fastify-auth';
import { lessonSchema } from '../../utils/schemas';
import { deleteTutorialLessonWithImages } from '../../services/tutorial-content.service';

/**
 * Fastify 课程章节（Lesson）路由（铁律六·1 渐进式迁移）。
 * 复用 Express 同款 Prisma 单例 + JWT 鉴权。
 *
 * 挂载前缀: /api/fastify/lessons
 *  - GET /course/:courseId   按课程列出章节（鉴权）
 *  - GET /:id                 章节详情（鉴权）
 *  - POST /                   创建章节（管理员）
 *  - PUT /:id                  更新章节（管理员）
 *  - DELETE /:id               删除章节（管理员）
 *
 * lessonLimiter（120/min）已在 Fastify 全局 rateLimit（100/min）覆盖；
 * 如需更宽限，可在路由级 config.rateLimit 放开。此处保持全局默认。
 */

interface AuthReq extends FastifyRequest {
  user?: SafeUser;
  userId?: string;
}

const asAuth = (request: FastifyRequest): AuthReq => request as AuthReq;

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const courseIdParamsSchema = z.object({
  courseId: z.string().min(1),
});

export const registerLessonRoutes = (app: FastifyInstance): void => {
  // GET /lessons/course/:courseId —— 按课程列出章节
  app.get(
    '/lessons/course/:courseId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: courseIdParamsSchema },
    },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      const lessons = await prisma.lesson.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
      });
      return reply.send(lessons);
    },
  );

  // GET /lessons/:id —— 章节详情
  app.get(
    '/lessons/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const lesson = await prisma.lesson.findUnique({ where: { id } });
      if (!lesson) {
        throw new AppError('Lesson not found', 404, 'LESSON_NOT_FOUND');
      }
      return reply.send(lesson);
    },
  );

  // POST /lessons —— 创建章节（管理员）
  app.post(
    '/lessons',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: lessonSchema },
    },
    async (request, reply) => {
      const req = asAuth(request);
      if (req.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
      }

      const body = request.body as {
        title: string;
        content?: string | null;
        videoUrl?: string | null;
        courseId: string;
        order: number | string;
        duration?: number | string | null;
        hotspots?: unknown;
        sceneConfig?: unknown;
      };

      // noteCreate/lessonSchema 已保证 title/courseId/order 存在
      const parsedOrder =
        typeof body.order === 'number' ? body.order : parseInt(String(body.order), 10);
      const parsedDuration =
        typeof body.duration === 'number'
          ? body.duration
          : body.duration
            ? parseInt(String(body.duration), 10)
            : 0;

      const lesson = await prisma.lesson.create({
        data: {
          title: body.title,
          content: body.content ?? undefined,
          videoUrl: body.videoUrl ?? undefined,
          courseId: body.courseId,
          order: parsedOrder,
          duration: parsedDuration,
          hotspots: body.hotspots
            ? typeof body.hotspots === 'string'
              ? body.hotspots
              : JSON.stringify(body.hotspots)
            : null,
          sceneConfig: body.sceneConfig
            ? typeof body.sceneConfig === 'string'
              ? body.sceneConfig
              : JSON.stringify(body.sceneConfig)
            : null,
        },
      });

      return reply.status(201).send(lesson);
    },
  );

  // PUT /lessons/:id —— 更新章节（管理员）
  app.put(
    '/lessons/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: lessonSchema },
    },
    async (request, reply) => {
      const req = asAuth(request);
      const { id } = request.params as { id: string };
      if (req.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
      }

      const body = request.body as {
        title?: string;
        content?: string | null;
        videoUrl?: string | null;
        order?: number | string;
        duration?: number | string | null;
        hotspots?: unknown;
        sceneConfig?: unknown;
      };

      const lessonExists = await prisma.lesson.findUnique({ where: { id } });
      if (!lessonExists) {
        throw new AppError('Lesson not found', 404, 'LESSON_NOT_FOUND');
      }

      const updateData: Prisma.LessonUpdateInput = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.videoUrl !== undefined) {
        if (lessonExists.videoUrl && body.videoUrl !== lessonExists.videoUrl) {
          deleteCloudOrLocalFileByUrl(lessonExists.videoUrl).catch(() => {});
        }
        updateData.videoUrl = body.videoUrl;
      }
      if (body.order !== undefined) {
        updateData.order =
          typeof body.order === 'number' ? body.order : parseInt(String(body.order), 10);
      }
      if (body.duration !== undefined) {
        updateData.duration =
          typeof body.duration === 'number' ? body.duration : parseInt(String(body.duration), 10);
      }
      if (body.hotspots !== undefined) {
        updateData.hotspots =
          typeof body.hotspots === 'string' ? body.hotspots : JSON.stringify(body.hotspots);
      }
      if (body.sceneConfig !== undefined) {
        updateData.sceneConfig =
          typeof body.sceneConfig === 'string'
            ? body.sceneConfig
            : JSON.stringify(body.sceneConfig);
      }

      const lesson = await prisma.lesson.update({ where: { id }, data: updateData });
      return reply.send(lesson);
    },
  );

  // DELETE /lessons/:id —— 删除章节（管理员）
  app.delete(
    '/lessons/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const req = asAuth(request);
      const { id } = request.params as { id: string };
      if (req.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden: Admin access required', 403, 'ADMIN_REQUIRED');
      }

      const lessonExists = await prisma.lesson.findUnique({ where: { id } });
      if (!lessonExists) {
        throw new AppError('Lesson not found', 404, 'LESSON_NOT_FOUND');
      }

      if (lessonExists.videoUrl) {
        deleteCloudOrLocalFileByUrl(lessonExists.videoUrl).catch(() => {});
      }

      await deleteTutorialLessonWithImages(id);
      return reply.send({ message: 'Lesson deleted successfully' });
    },
  );
};
