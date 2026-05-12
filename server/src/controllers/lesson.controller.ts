import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getLessonsByCourse = async (req: AuthRequest, res: Response) => {
  const courseId = req.params.courseId as string;
  try {
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      orderBy: { order: 'asc' }
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
      where: { id }
    });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createLesson = async (req: AuthRequest, res: Response) => {
  const { title, content, videoUrl, courseId, order } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: { title, content, videoUrl, courseId, order }
    });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLesson = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order } = req.body;
  try {
    const lesson = await prisma.lesson.update({
      where: { id },
      data: { title, content, videoUrl, order }
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
