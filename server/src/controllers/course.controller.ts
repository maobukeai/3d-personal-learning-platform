import type { FastifyReply, FastifyRequest } from 'fastify';

import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import {
  auditService,
  AuditAction,
  AuditModule,
  type AuditRequest,
} from '../services/audit.service';
import { parseBilibiliUrl } from '../utils/bilibili';
import { AppError } from '../utils/error';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';
import redisService from '../services/redis.service';
import { deleteCloudOrLocalFileByUrl } from '../utils/file';
import { withRowLock } from '../utils/dbLock';
import { withRedlock } from '../utils/withRedlock';

export const getAllCourses = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { categoryId, search, difficulty, sort } = request.query as {
    categoryId?: string;
    search?: string;
    difficulty?: string;
    sort?: string;
  };
  try {
    const cacheKey = `courses:list:${categoryId || 'all'}:${search || 'none'}:${difficulty || 'all'}:${sort || 'default'}`;
    const cached = await redisService.get<unknown>(cacheKey);
    if (cached) {
      reply.send(cached);
      return;
    }

    let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'popular') orderBy = { enrollments: { _count: 'desc' } };
    else if (sort === 'rating') orderBy = { reviews: { _count: 'desc' } };
    else if (sort === 'newest') orderBy = { createdAt: 'desc' };

    const courses = await prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        AND: [
          categoryId ? { categoryId: categoryId as string } : {},
          search ? { title: { contains: search as string } } : {},
          difficulty ? { difficulty: difficulty as string } : {},
        ],
      },
      include: {
        category: true,
        _count: {
          select: { lessons: true, enrollments: true, reviews: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy,
    });

    const coursesWithAvgRating = courses.map((course) => {
      const { reviews, ...rest } = course;
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
            reviews.length
          : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });

    await redisService.set(cacheKey, coursesWithAvgRating, 30);

    reply.send(coursesWithAvgRating);
  } catch (error) {
    throw error;
  }
};

export const getCourseCategories = async (
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { courses: true } },
      },
    });
    reply.send(categories);
  } catch (error) {
    throw error;
  }
};

export const parseBilibili = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { url } = request.body as { url: string };
  if (!url) {
    throw new AppError('Bilibili URL is required', 400);
  }

  try {
    const metadata = await parseBilibiliUrl(url);
    reply.send(metadata);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to parse Bilibili URL',
      400,
    );
  }
};

export const getCourseById = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
        category: true,
        reviews: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { enrollments: true, reviews: true, lessons: true },
        },
      },
    });
    if (!course) throw new AppError('Course not found', 404);

    // Guests can only access published courses
    if (!request.userId && course.status !== 'PUBLISHED') {
      throw new AppError('无权访问未发布课程', 403, 'COURSE_FORBIDDEN');
    }

    const avgRating =
      course.reviews.length > 0
        ? course.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
          course.reviews.length
        : 0;

    let userEnrollment = null;
    let lessonProgressMap: Record<string, boolean> = {};
    if (request.userId) {
      userEnrollment = await prisma.enrollment.findFirst({
        where: { userId: request.userId, courseId: id, teamId: request.workspaceId },
      });

      const progressRecords = await prisma.lessonProgress.findMany({
        where: { userId: request.userId, lessonId: { in: course.lessons.map((l) => l.id) } },
      });
      progressRecords.forEach((p) => {
        lessonProgressMap[p.lessonId] = p.completed;
      });
    }

    const totalDuration = course.lessons.reduce(
      (sum: number, l: { duration: number | null }) => sum + (l.duration || 0),
      0,
    );

    reply.send({
      ...course,
      avgRating: Math.round(avgRating * 10) / 10,
      userEnrollment,
      lessonProgressMap,
      totalDuration,
    });
  } catch (error) {
    throw error;
  }
};

export const createCourse = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { title, description, thumbnail, categoryId, difficulty, status } = request.body as {
    title: string;
    description: string;
    thumbnail?: string;
    categoryId?: string;
    difficulty?: string;
    status?: string;
  };
  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        thumbnail,
        categoryId: categoryId || null,
        difficulty: difficulty || 'BEGINNER',
        status: status || 'PUBLISHED',
      },
    });

    await auditService.log({
      userId: request.userId as string,
      action: AuditAction.CREATE_COURSE,
      module: AuditModule.COURSE,
      description: `Created course: ${course.title}`,
      newValue: course,
      req: request as unknown as AuditRequest,
    });

    reply.status(201).send(course);
  } catch (error) {
    throw error;
  }
};

export const createCourseWithLessons = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { title, description, thumbnail, lessons, categoryId, difficulty } = request.body as {
    title: string;
    description: string;
    thumbnail?: string;
    lessons?: Array<{
      title: string;
      videoUrl?: string;
      order: number;
      content?: string;
      duration?: number;
    }>;
    categoryId?: string;
    difficulty?: string;
  };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title,
          description,
          thumbnail,
          categoryId: categoryId || null,
          difficulty: difficulty || 'BEGINNER',
        },
      });

      if (lessons && Array.isArray(lessons)) {
        await Promise.all(
          lessons.map(
            (lesson: {
              title: string;
              videoUrl?: string;
              order: number;
              content?: string;
              duration?: number;
            }) =>
              tx.lesson.create({
                data: {
                  title: lesson.title,
                  videoUrl: lesson.videoUrl || null,
                  order: lesson.order,
                  courseId: course.id,
                  content: lesson.content || '',
                  duration: lesson.duration || 0,
                },
              }),
          ),
        );
      }

      const finalCourse = await tx.course.findUnique({
        where: { id: course.id },
        include: { lessons: true },
      });

      await auditService.log({
        userId: request.userId as string,
        action: AuditAction.CREATE_COURSE,
        module: AuditModule.COURSE,
        description: `Created course with lessons: ${course.title}`,
        newValue: finalCourse,
        req: request as unknown as AuditRequest,
        tx,
      });

      return finalCourse;
    });

    reply.status(201).send(result);
  } catch (error) {
    throw error;
  }
};

export const updateCourse = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  const { title, description, thumbnail, categoryId, difficulty, status } = request.body as {
    title: string;
    description: string;
    thumbnail?: string;
    categoryId?: string;
    difficulty?: string;
    status?: string;
  };
  try {
    const oldCourse = await prisma.course.findUnique({ where: { id } });
    if (!oldCourse) throw new AppError('Course not found', 404);

    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status },
    });

    await auditService.log({
      userId: request.userId as string,
      action: AuditAction.UPDATE_COURSE,
      module: AuditModule.COURSE,
      description: `Updated course: ${course.title}`,
      oldValue: oldCourse,
      newValue: course,
      req: request as unknown as AuditRequest,
    });

    reply.send(course);
  } catch (error) {
    throw error;
  }
};

export const deleteCourse = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: { lessons: true },
    });
    if (!course) throw new AppError('Course not found', 404);

    if (course.thumbnail) {
      deleteCloudOrLocalFileByUrl(course.thumbnail).catch(() => {});
    }

    if (course.lessons && course.lessons.length > 0) {
      for (const lesson of course.lessons) {
        if (lesson.videoUrl) {
          deleteCloudOrLocalFileByUrl(lesson.videoUrl).catch(() => {});
        }
      }
    }

    await prisma.course.delete({ where: { id } });

    await auditService.log({
      userId: request.userId as string,
      action: AuditAction.DELETE_COURSE,
      module: AuditModule.COURSE,
      description: `Deleted course: ${course.title}`,
      oldValue: course,
      req: request as unknown as AuditRequest,
    });

    reply.send({ message: 'Course deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const enrollInCourse = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { courseId } = request.body as { courseId: string };
  try {
    // P-6.3：高并发报名（如秒杀课程）场景下，用 Redlock 串行化同一用户对
    // 同一课程的报名操作，避免唯一约束竞态和重复入账。锁资源粒度为
    // `course:enroll:${courseId}:${userId}`，不阻塞其他用户报名其他课程。
    const enrollment = await withRedlock(
      `course:enroll:${courseId}:${request.userId}`,
      async () => {
        return await prisma.$transaction(async (tx) => {
          const created = await tx.enrollment.create({
            data: {
              userId: request.userId as string,
              courseId,
              teamId: request.workspaceId,
            },
            include: {
              course: { select: { title: true } },
            },
          });

          await auditService.log({
            userId: request.userId as string,
            action: 'ENROLL_COURSE',
            module: AuditModule.COURSE,
            description: `Enrolled in course: ${created.course.title}`,
            newValue: created,
            req: request as unknown as AuditRequest,
            tx,
          });

          return created;
        });
      },
    );

    reply.status(201).send(enrollment);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new AppError('You are already enrolled in this course in this workspace', 400);
    }
    throw error;
  }
};

export const getMyEnrollments = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: request.userId as string,
        teamId: request.workspaceId,
      },
      include: {
        course: {
          include: {
            _count: { select: { lessons: true } },
            reviews: { select: { rating: true } },
          },
        },
      },
    });

    const enrollmentsWithRating = enrollments.map((e) => {
      const avgRating =
        e.course.reviews.length > 0
          ? e.course.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
            e.course.reviews.length
          : 0;
      const { reviews: _reviews, ...courseRest } = e.course;
      return { ...e, course: { ...courseRest, avgRating: Math.round(avgRating * 10) / 10 } };
    });

    reply.send(enrollmentsWithRating);
  } catch (error) {
    throw error;
  }
};

export const updateProgress = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { courseId, progress } = request.body as { courseId: string; progress: number };
  try {
    const enrollment = await prisma.enrollment.update({
      where: {
        userId_courseId_teamId: {
          userId: request.userId as string,
          courseId,
          teamId: request.workspaceId as string,
        },
      },
      data: { progress },
    });
    reply.send(enrollment);
  } catch (error) {
    throw error;
  }
};

// --- Lesson Progress ---

export const getLessonProgress = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { courseId } = request.params as { courseId: string };
  try {
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);

    const progress = await prisma.lessonProgress.findMany({
      where: { userId: request.userId as string, lessonId: { in: lessonIds } },
    });
    reply.send(progress);
  } catch (error) {
    throw error;
  }
};

export const toggleLessonComplete = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { lessonId } = request.params as { lessonId: string };
  const { completed } = request.body as { completed: boolean };
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError('Lesson not found', 404);

    const result = await prisma.$transaction(async (tx) =>
      // 铁律六·3 — 锁定 User 行再读写积分，避免并发完成课时导致积分 lost update。
      // withRowLock 在事务内执行 SELECT ... FOR UPDATE，持有行锁直到事务提交。
      withRowLock(tx, 'User', request.userId as string, async (tx) => {
        // Determine points change based on completion transition
        const existingProgress = await tx.lessonProgress.findUnique({
          where: { userId_lessonId: { userId: request.userId as string, lessonId } },
        });
        const transitioningToComplete =
          completed && (!existingProgress || !existingProgress.completed);
        const transitioningToIncomplete =
          !completed && existingProgress && existingProgress.completed;

        const progress = await tx.lessonProgress.upsert({
          where: {
            userId_lessonId: { userId: request.userId as string, lessonId: lessonId },
          },
          update: { completed, completedAt: completed ? new Date() : null },
          create: {
            userId: request.userId as string,
            lessonId: lessonId,
            completed,
            completedAt: completed ? new Date() : null,
          },
        });

        if (transitioningToComplete) {
          await awardPoints(request.userId as string, PointsAction.COMPLETE_LESSON, tx);
        } else if (transitioningToIncomplete) {
          await deductPoints(request.userId as string, PointsAction.COMPLETE_LESSON, tx);
        }

        const totalLessons = await tx.lesson.count({ where: { courseId: lesson.courseId } });
        const completedCount = await tx.lessonProgress.count({
          where: {
            userId: request.userId as string,
            lesson: { courseId: lesson.courseId },
            completed: true,
          },
        });
        const courseProgress = Math.round((completedCount / totalLessons) * 100);

        await tx.enrollment.updateMany({
          where: { userId: request.userId as string, courseId: lesson.courseId },
          data: { progress: courseProgress },
        });

        return { progress, courseProgress };
      }),
    );

    reply.send({ lessonProgress: result.progress, courseProgress: result.courseProgress });
  } catch (error) {
    throw error;
  }
};

// --- Course Reviews ---

export const getCourseReviews = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { courseId } = request.params as { courseId: string };
  try {
    const reviews = await prisma.courseReview.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(reviews);
  } catch (error) {
    throw error;
  }
};

export const createReview = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { courseId, rating, comment } = request.body as {
    courseId: string;
    rating: number;
    comment?: string;
  };
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }
  try {
    const review = await prisma.$transaction(async (tx) => {
      return tx.courseReview.create({
        data: {
          userId: request.userId as string,
          courseId,
          rating,
          comment: comment || null,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    });
    reply.status(201).send(review);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new AppError('You have already reviewed this course', 400);
    }
    throw error;
  }
};

export const updateReview = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  const { rating, comment } = request.body as { rating: number; comment?: string };
  try {
    const review = await prisma.$transaction(async (tx) => {
      const existing = await tx.courseReview.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existing) throw new AppError('Review not found', 404);
      if (existing.userId !== request.userId && request.user?.role !== 'ADMIN') {
        throw new AppError('Not authorized', 403);
      }

      return tx.courseReview.update({
        where: { id },
        data: { rating, comment: comment || null },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    });
    reply.send(review);
  } catch (error) {
    throw error;
  }
};

export const deleteReview = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  try {
    const existing = await prisma.courseReview.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) throw new AppError('Review not found', 404);
    if (existing.userId !== request.userId && request.user?.role !== 'ADMIN') {
      throw new AppError('Not authorized', 403);
    }

    await prisma.courseReview.delete({ where: { id } });
    reply.send({ message: 'Review deleted successfully' });
  } catch (error) {
    throw error;
  }
};

// --- Course Notes ---

export const getLessonNotes = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { lessonId } = request.params as { lessonId: string };
  try {
    const notes = await prisma.courseNote.findMany({
      where: { userId: request.userId as string, lessonId },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(notes);
  } catch (error) {
    throw error;
  }
};

export const createNote = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { lessonId, content, timestamp } = request.body as {
    lessonId: string;
    content: string;
    timestamp?: number;
  };
  try {
    const note = await prisma.$transaction(async (tx) => {
      return tx.courseNote.create({
        data: {
          userId: request.userId as string,
          lessonId,
          content,
          timestamp: timestamp || null,
        },
      });
    });
    reply.status(201).send(note);
  } catch (error) {
    throw error;
  }
};

export const updateNote = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  const { content, timestamp } = request.body as { content: string; timestamp?: number };
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) throw new AppError('Note not found', 404);
    if (existing.userId !== request.userId) {
      throw new AppError('Not authorized', 403);
    }

    const note = await prisma.courseNote.update({
      where: { id },
      data: { content, timestamp: timestamp !== undefined ? timestamp : undefined },
    });
    reply.send(note);
  } catch (error) {
    throw error;
  }
};

export const deleteNote = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) throw new AppError('Note not found', 404);
    if (existing.userId !== request.userId) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.courseNote.delete({ where: { id } });
    reply.send({ message: 'Note deleted successfully' });
  } catch (error) {
    throw error;
  }
};
