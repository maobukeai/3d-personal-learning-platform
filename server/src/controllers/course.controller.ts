import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { parseBilibiliUrl } from '../utils/bilibili';
import { AppError } from '../middlewares/error.middleware';

export const getAllCourses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { categoryId, search, difficulty, sort } = req.query;
  try {
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
          ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
          : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });

    res.json(coursesWithAvgRating);
  } catch (error) {
    next(error);
  }
};

export const getCourseCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { courses: true } },
      },
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const parseBilibili = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { url } = req.body;
  if (!url) {
    return next(new AppError('Bilibili URL is required', 400));
  }

  try {
    const metadata = await parseBilibiliUrl(url);
    res.json(metadata);
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to parse Bilibili URL', 400));
  }
};

export const getCourseById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
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
    if (!course) return next(new AppError('Course not found', 404));

    const avgRating =
      course.reviews.length > 0
        ? course.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / course.reviews.length
        : 0;

    let userEnrollment = null;
    let lessonProgressMap: Record<string, boolean> = {};
    if (req.userId) {
      userEnrollment = await prisma.enrollment.findFirst({
        where: { userId: req.userId, courseId: id, teamId: req.workspaceId },
      });

      const progressRecords = await prisma.lessonProgress.findMany({
        where: { userId: req.userId, lessonId: { in: course.lessons.map((l) => l.id) } },
      });
      progressRecords.forEach((p) => {
        lessonProgressMap[p.lessonId] = p.completed;
      });
    }

    const totalDuration = course.lessons.reduce(
      (sum: number, l: { duration: number | null }) => sum + (l.duration || 0),
      0,
    );

    res.json({
      ...course,
      avgRating: Math.round(avgRating * 10) / 10,
      userEnrollment,
      lessonProgressMap,
      totalDuration,
    });
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

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_COURSE,
      module: AuditModule.COURSE,
      description: `Created course: ${course.title}`,
      newValue: course,
      req,
    });

    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
};

export const createCourseWithLessons = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description, thumbnail, lessons, categoryId, difficulty } = req.body;
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
          lessons.map((lesson: { title: string; videoUrl?: string; order: number; content?: string; duration?: number }) =>
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
        userId: req.userId as string,
        action: AuditAction.CREATE_COURSE,
        module: AuditModule.COURSE,
        description: `Created course with lessons: ${course.title}`,
        newValue: finalCourse,
        req,
        tx,
      });

      return finalCourse;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const oldCourse = await prisma.course.findUnique({ where: { id } });
    if (!oldCourse) return next(new AppError('Course not found', 404));

    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_COURSE,
      module: AuditModule.COURSE,
      description: `Updated course: ${course.title}`,
      oldValue: oldCourse,
      newValue: course,
      req,
    });

    res.json(course);
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return next(new AppError('Course not found', 404));

    await prisma.course.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_COURSE,
      module: AuditModule.COURSE,
      description: `Deleted course: ${course.title}`,
      oldValue: course,
      req,
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const enrollInCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId } = req.body;
  try {
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.userId as string,
        courseId,
        teamId: req.workspaceId,
      },
      include: {
        course: { select: { title: true } },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: 'ENROLL_COURSE',
      module: AuditModule.COURSE,
      description: `Enrolled in course: ${enrollment.course.title}`,
      newValue: enrollment,
      req,
    });

    res.status(201).json(enrollment);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return next(new AppError('You are already enrolled in this course in this workspace', 400));
    }
    next(error);
  }
};

export const getMyEnrollments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: req.userId as string,
        teamId: req.workspaceId,
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
      const { reviews, ...courseRest } = e.course;
      return { ...e, course: { ...courseRest, avgRating: Math.round(avgRating * 10) / 10 } };
    });

    res.json(enrollmentsWithRating);
  } catch (error) {
    next(error);
  }
};

export const updateProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId, progress } = req.body;
  try {
    const enrollment = await prisma.enrollment.update({
      where: {
        userId_courseId_teamId: {
          userId: req.userId as string,
          courseId,
          teamId: req.workspaceId as string,
        },
      },
      data: { progress },
    });
    res.json(enrollment);
  } catch (error) {
    next(error);
  }
};

// --- Lesson Progress ---

export const getLessonProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const courseId = req.params.courseId as string;
  try {
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);

    const progress = await prisma.lessonProgress.findMany({
      where: { userId: req.userId as string, lessonId: { in: lessonIds } },
    });
    res.json(progress);
  } catch (error) {
    next(error);
  }
};

export const toggleLessonComplete = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const lessonId = req.params.lessonId as string;
  const { completed } = req.body;
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return next(new AppError('Lesson not found', 404));

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: req.userId as string, lessonId: lessonId },
      },
      update: { completed, completedAt: completed ? new Date() : null },
      create: {
        userId: req.userId as string,
        lessonId: lessonId,
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    const totalLessons = await prisma.lesson.count({ where: { courseId: lesson.courseId } });
    const completedCount = await prisma.lessonProgress.count({
      where: {
        userId: req.userId as string,
        lesson: { courseId: lesson.courseId },
        completed: true,
      },
    });
    const courseProgress = Math.round((completedCount / totalLessons) * 100);

    await prisma.enrollment.updateMany({
      where: { userId: req.userId as string, courseId: lesson.courseId },
      data: { progress: courseProgress },
    });

    res.json({ lessonProgress: progress, courseProgress });
  } catch (error) {
    next(error);
  }
};

// --- Course Reviews ---

export const getCourseReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const courseId = req.params.courseId as string;
  try {
    const reviews = await prisma.courseReview.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { courseId, rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating must be between 1 and 5', 400));
  }
  try {
    const review = await prisma.courseReview.create({
      data: {
        userId: req.userId as string,
        courseId,
        rating,
        comment: comment || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.status(201).json(review);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return next(new AppError('You have already reviewed this course', 400));
    }
    next(error);
  }
};

export const updateReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { rating, comment } = req.body;
  try {
    const existing = await prisma.courseReview.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return next(new AppError('Review not found', 404));
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized', 403));
    }

    const review = await prisma.courseReview.update({
      where: { id },
      data: { rating, comment: comment || null },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.json(review);
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.courseReview.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return next(new AppError('Review not found', 404));
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized', 403));
    }

    await prisma.courseReview.delete({ where: { id } });
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Course Notes ---

export const getLessonNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const lessonId = req.params.lessonId as string;
  try {
    const notes = await prisma.courseNote.findMany({
      where: { userId: req.userId as string, lessonId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    next(error);
  }
};

export const createNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { lessonId, content, timestamp } = req.body;
  try {
    const note = await prisma.courseNote.create({
      data: {
        userId: req.userId as string,
        lessonId,
        content,
        timestamp: timestamp || null,
      },
    });
    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
};

export const updateNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { content, timestamp } = req.body;
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return next(new AppError('Note not found', 404));
    if (existing.userId !== req.userId) {
      return next(new AppError('Not authorized', 403));
    }

    const note = await prisma.courseNote.update({
      where: { id },
      data: { content, timestamp: timestamp !== undefined ? timestamp : undefined },
    });
    res.json(note);
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return next(new AppError('Note not found', 404));
    if (existing.userId !== req.userId) {
      return next(new AppError('Not authorized', 403));
    }

    await prisma.courseNote.delete({ where: { id } });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
};
