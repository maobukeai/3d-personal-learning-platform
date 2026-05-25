import { logger } from '../../utils/logger';
import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { parseBilibiliUrl } from '../../utils/bilibili';
import { parseYoutubeUrl } from '../../utils/youtube';
import { parseGithubUrl } from '../../utils/github';
import { AppError } from '../../middlewares/error.middleware';
import { createPaginationMeta, getPaginationParams } from '../../utils/pagination';

export const parseExternalLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { url } = req.body;
  if (!url) {
    return next(new AppError('URL is required', 400));
  }

  try {
    let metadata;
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      metadata = await parseBilibiliUrl(url);
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata = await parseYoutubeUrl(url);
    } else if (url.includes('github.com')) {
      metadata = await parseGithubUrl(url);
    } else {
      return next(new AppError('不支持的平台，目前仅支持 B站、YouTube 和 GitHub。', 400));
    }
    res.json(metadata);
  } catch (error) {
    logger.error('Parse link error:', error);
    next(new AppError((error instanceof Error ? error.message : '解析链接失败'), 400));
  }
};

export const createCourseWithLessons = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { title, description, thumbnail, lessons, categoryId } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title,
          description,
          thumbnail,
          categoryId: categoryId || null,
        },
      });

      if (lessons && Array.isArray(lessons)) {
        await Promise.all(
          lessons.map((lesson: { title: string; videoUrl: string; order: number; content?: string }) =>
            tx.lesson.create({
              data: {
                title: lesson.title,
                videoUrl: lesson.videoUrl,
                order: lesson.order,
                courseId: course.id,
                content: lesson.content || '',
              },
            }),
          ),
        );
      }

      return await tx.course.findUnique({
        where: { id: course.id },
        include: { lessons: { orderBy: { order: 'asc' } } },
      });
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// --- Course Category Management ---

export const getAllCourseCategories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const createCourseCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.create({
      data: { name, order: order ? parseInt(order) : 0 },
    });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCourseCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.update({
      where: { id },
      data: { name, order: order !== undefined ? parseInt(order) : undefined },
    });
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const deleteCourseCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.courseCategory.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Course Management ---

export const getAllCourses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: { orderBy: { order: 'asc' } },
        category: true,
        _count: { select: { enrollments: true, reviews: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const coursesWithStats = courses.map((course) => {
      const { reviews, ...rest } = course;
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
          : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });
    res.json(coursesWithStats);
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
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
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status },
    });
    res.json(course);
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.course.delete({ where: { id } });
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createLesson = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId, title, content, videoUrl, order, duration, hotspots, sceneConfig } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        title,
        content,
        videoUrl,
        order: parseInt(order),
        duration: duration ? parseInt(duration) : 0,
        hotspots: hotspots
          ? typeof hotspots === 'string'
            ? hotspots
            : JSON.stringify(hotspots)
          : null,
        sceneConfig: sceneConfig
          ? typeof sceneConfig === 'string'
            ? sceneConfig
            : JSON.stringify(sceneConfig)
          : null,
      },
    });
    res.status(201).json(lesson);
  } catch (error) {
    next(error);
  }
};

export const updateLesson = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order, duration, hotspots, sceneConfig } = req.body;
  try {
    const updateData: Partial<Prisma.LessonUpdateInput> = { title, content, videoUrl };
    if (order !== undefined) updateData.order = parseInt(order);
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (hotspots !== undefined) {
      updateData.hotspots = typeof hotspots === 'string' ? hotspots : JSON.stringify(hotspots);
    }
    if (sceneConfig !== undefined) {
      updateData.sceneConfig =
        typeof sceneConfig === 'string' ? sceneConfig : JSON.stringify(sceneConfig);
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
    });
    res.json(lesson);
  } catch (error) {
    next(error);
  }
};

export const deleteLesson = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.lesson.delete({ where: { id } });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Roadmap Management ---

export const getAllRoadmaps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 50, 200);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where: Prisma.RoadmapWhereInput = {
      creatorId: null, // Exclude user-created roadmaps
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { description: { contains: q } }],
          }
        : {}),
    };

    const [total, roadmaps] = await prisma.$transaction([
      prisma.roadmap.count({ where }),
      prisma.roadmap.findMany({
        where,
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: roadmaps,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const createRoadmap = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description, steps } = req.body;
  try {
    const roadmap = await prisma.$transaction(async (tx) => {
      const rm = await tx.roadmap.create({
        data: { title, description },
      });

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const subtasksJson =
            step.subtasks && Array.isArray(step.subtasks) ? JSON.stringify(step.subtasks) : null;
          await tx.roadmapStep.create({
            data: {
              roadmapId: rm.id,
              title: step.title || `阶段 ${i + 1}`,
              description: step.description || '',
              subtasks: subtasksJson,
              order: i + 1,
            },
          });
        }
      }

      return rm;
    });

    const fullRoadmap = await prisma.roadmap.findUnique({
      where: { id: roadmap.id },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    res.status(201).json(fullRoadmap);
  } catch (error) {
    next(error);
  }
};

export const updateRoadmap = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, steps } = req.body;
  try {
    const roadmap = await prisma.$transaction(async (tx) => {
      // 1. Update the roadmap metadata
      const rm = await tx.roadmap.update({
        where: { id },
        data: { title, description },
      });

      if (steps && Array.isArray(steps)) {
        // 2. Load existing steps from database
        const existingSteps = await tx.roadmapStep.findMany({
          where: { roadmapId: id },
        });
        const existingStepIds = existingSteps.map((s) => s.id);

        // 3. Identify steps to delete
        const incomingStepIds = steps.filter((s: { id?: string }) => s.id).map((s: { id?: string }) => s.id as string);
        const stepsToDelete = existingStepIds.filter((dbId) => !incomingStepIds.includes(dbId));

        if (stepsToDelete.length > 0) {
          await tx.roadmapStep.deleteMany({
            where: { id: { in: stepsToDelete } },
          });
        }

        // 4. Create or update steps sequentially to enforce correct ordering
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const orderValue = i + 1;
          const subtasksJson =
            step.subtasks && Array.isArray(step.subtasks) ? JSON.stringify(step.subtasks) : null;

          if (step.id && existingStepIds.includes(step.id)) {
            // Update existing step
            await tx.roadmapStep.update({
              where: { id: step.id },
              data: {
                title: step.title || `阶段 ${orderValue}`,
                description: step.description || '',
                subtasks: subtasksJson,
                order: orderValue,
              },
            });
          } else {
            // Create new step
            await tx.roadmapStep.create({
              data: {
                roadmapId: id,
                title: step.title || `阶段 ${orderValue}`,
                description: step.description || '',
                subtasks: subtasksJson,
                order: orderValue,
              },
            });
          }
        }
      }

      return rm;
    });

    const fullRoadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    res.json(fullRoadmap);
  } catch (error) {
    next(error);
  }
};

export const deleteRoadmap = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmap.delete({ where: { id } });
    res.json({ message: 'Roadmap deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createRoadmapStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { roadmapId, title, description, order } = req.body;
  try {
    const step = await prisma.roadmapStep.create({
      data: { roadmapId, title, description, order: parseInt(order) },
    });
    res.status(201).json(step);
  } catch (error) {
    next(error);
  }
};

export const updateRoadmapStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, order } = req.body;
  try {
    const updateData: Partial<Prisma.RoadmapStepUpdateInput> = { title, description };
    if (order !== undefined) updateData.order = parseInt(order);

    const step = await prisma.roadmapStep.update({
      where: { id },
      data: updateData,
    });
    res.json(step);
  } catch (error) {
    next(error);
  }
};

export const deleteRoadmapStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmapStep.delete({ where: { id } });
    res.json({ message: 'Roadmap step deleted successfully' });
  } catch (error) {
    next(error);
  }
};
