import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error';

import { deleteCloudOrLocalFileByUrl } from '../utils/file';

export const getLessonsByCourse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const courseId = req.params.courseId as string;
  try {
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });
    res.json(lessons);
  } catch (error) {
    next(error);
  }
};

export const getLessonById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
    });
    if (!lesson) {
      return next(new AppError('Lesson not found', 404));
    }
    res.json(lesson);
  } catch (error) {
    next(error);
  }
};

export const createLesson = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, content, videoUrl, courseId, order, hotspots, sceneConfig, duration } = req.body;
  if (!title || !courseId || order === undefined) {
    return next(new AppError('Title, courseId, and order are required', 400));
  }
  try {
    const parsedOrder = typeof order === 'number' ? order : parseInt(order, 10);
    const parsedDuration =
      typeof duration === 'number' ? duration : duration ? parseInt(duration, 10) : 0;

    const lesson = await prisma.lesson.create({
      data: {
        title,
        content,
        videoUrl,
        courseId,
        order: parsedOrder,
        duration: parsedDuration,
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
  const { title, content, videoUrl, order, hotspots, sceneConfig, duration } = req.body;
  try {
    const lessonExists = await prisma.lesson.findUnique({ where: { id } });
    if (!lessonExists) {
      return next(new AppError('Lesson not found', 404));
    }

    const updateData: Prisma.LessonUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (videoUrl !== undefined) {
      if (lessonExists.videoUrl && videoUrl !== lessonExists.videoUrl) {
        deleteCloudOrLocalFileByUrl(lessonExists.videoUrl).catch(() => {});
      }
      updateData.videoUrl = videoUrl;
    }
    if (order !== undefined) {
      updateData.order = typeof order === 'number' ? order : parseInt(order, 10);
    }
    if (duration !== undefined) {
      updateData.duration = typeof duration === 'number' ? duration : parseInt(duration, 10);
    }
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
    const lessonExists = await prisma.lesson.findUnique({ where: { id } });
    if (!lessonExists) {
      return next(new AppError('Lesson not found', 404));
    }

    if (lessonExists.videoUrl) {
      deleteCloudOrLocalFileByUrl(lessonExists.videoUrl).catch(() => {});
    }

    await prisma.lesson.delete({ where: { id } });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    next(error);
  }
};
