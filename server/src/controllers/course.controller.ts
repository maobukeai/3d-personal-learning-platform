import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToAll } from '../services/socket.service';
import { parseBilibiliUrl } from '../utils/bilibili';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const getAllCourses = async (req: AuthRequest, res: Response) => {
  const { categoryId, search, difficulty, sort } = req.query;
  try {
    let orderBy: any = { createdAt: 'desc' };
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
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });

    res.json(coursesWithAvgRating);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCourseCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { courses: true } },
      },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const parseBilibili = async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Bilibili URL is required' });
  }

  try {
    const metadata = await parseBilibiliUrl(url);
    res.json(metadata);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to parse Bilibili URL' });
  }
};

export const getCourseById = async (req: AuthRequest, res: Response) => {
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
          select: { enrollments: true, reviews: true },
        },
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const avgRating =
      course.reviews.length > 0
        ? course.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / course.reviews.length
        : 0;

    let userEnrollment = null;
    let lessonProgressMap: Record<string, boolean> = {};
    if (req.userId) {
      userEnrollment = await prisma.enrollment.findFirst({
        where: { userId: req.userId, courseId: id, teamId: req.workspaceId },
      });

      const progressRecords = await prisma.lessonProgress.findMany({
        where: { userId: req.userId, lessonId: { in: course.lessons.map((l: any) => l.id) } },
      });
      progressRecords.forEach((p: any) => {
        lessonProgressMap[p.lessonId] = p.completed;
      });
    }

    const totalDuration = course.lessons.reduce(
      (sum: number, l: any) => sum + (l.duration || 0),
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
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
      userId: req.userId,
      action: AuditAction.CREATE_COURSE,
      module: AuditModule.COURSE,
      description: `Created course: ${course.title}`,
      newValue: course,
      req,
    });

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourseWithLessons = async (req: AuthRequest, res: Response) => {
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
          lessons.map((lesson: any) =>
            tx.lesson.create({
              data: {
                title: lesson.title,
                videoUrl: lesson.videoUrl,
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
        userId: req.userId,
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
    console.error('Batch create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const oldCourse = await prisma.course.findUnique({ where: { id } });
    if (!oldCourse) return res.status(404).json({ error: 'Course not found' });

    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_COURSE,
      module: AuditModule.COURSE,
      description: `Updated course: ${course.title}`,
      oldValue: oldCourse,
      newValue: course,
      req,
    });

    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    await prisma.course.delete({ where: { id } });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_COURSE,
      module: AuditModule.COURSE,
      description: `Deleted course: ${course.title}`,
      oldValue: course,
      req,
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const enrollInCourse = async (req: AuthRequest, res: Response) => {
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
      userId: req.userId,
      action: 'ENROLL_COURSE',
      module: AuditModule.COURSE,
      description: `Enrolled in course: ${enrollment.course.title}`,
      newValue: enrollment,
      req,
    });

    res.status(201).json(enrollment);
  } catch (error) {
    if ((error as any).code === 'P2002') {
      return res
        .status(400)
        .json({ error: 'You are already enrolled in this course in this workspace' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyEnrollments = async (req: AuthRequest, res: Response) => {
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
          ? e.course.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
            e.course.reviews.length
          : 0;
      const { reviews, ...courseRest } = e.course as any;
      return { ...e, course: { ...courseRest, avgRating: Math.round(avgRating * 10) / 10 } };
    });

    res.json(enrollmentsWithRating);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProgress = async (req: AuthRequest, res: Response) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Lesson Progress ---

export const getLessonProgress = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.params;
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLessonComplete = async (req: AuthRequest, res: Response) => {
  const { lessonId } = req.params;
  const { completed } = req.body;
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: req.userId as string, lessonId },
      },
      update: { completed, completedAt: completed ? new Date() : null },
      create: {
        userId: req.userId as string,
        lessonId,
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Course Reviews ---

export const getCourseReviews = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.params;
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createReview = async (req: AuthRequest, res: Response) => {
  const { courseId, rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
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
      return res.status(400).json({ error: 'You have already reviewed this course' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  try {
    const existing = await prisma.courseReview.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteReview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.courseReview.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.courseReview.delete({ where: { id } });
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Course Notes ---

export const getLessonNotes = async (req: AuthRequest, res: Response) => {
  const { lessonId } = req.params;
  try {
    const notes = await prisma.courseNote.findMany({
      where: { userId: req.userId as string, lessonId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNote = async (req: AuthRequest, res: Response) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNote = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content, timestamp } = req.body;
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const note = await prisma.courseNote.update({
      where: { id },
      data: { content, timestamp: timestamp !== undefined ? timestamp : undefined },
    });
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNote = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.courseNote.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.courseNote.delete({ where: { id } });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
