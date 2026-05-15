import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getLessonsByCourse = async (req: AuthRequest, res: Response) => {
  const courseId = req.params.courseId as string;
  try {
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLessonById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
    });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createLesson = async (req: AuthRequest, res: Response) => {
  const { title, content, videoUrl, courseId, order, hotspots, sceneConfig } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: {
        title,
        content,
        videoUrl,
        courseId,
        order,
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order, hotspots, sceneConfig } = req.body;
  try {
    const updateData: any = { title, content, videoUrl, order };
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.lesson.delete({ where: { id } });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
