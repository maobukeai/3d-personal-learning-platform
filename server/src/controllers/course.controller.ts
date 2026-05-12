import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAllCourses = async (req: AuthRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { lessons: true }
        }
      }
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCourseById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCourse = async (req: AuthRequest, res: Response) => {
  const { title, description, thumbnail } = req.body;
  try {
    const course = await prisma.course.create({
      data: { title, description, thumbnail }
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, thumbnail } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail }
    });
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCourse = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.course.delete({ where: { id } });
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
        courseId
      }
    });
    res.status(201).json(enrollment);
  } catch (error) {
    if ((error as any).code === 'P2002') {
      return res.status(400).json({ error: 'You are already enrolled in this course' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyEnrollments = async (req: AuthRequest, res: Response) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.userId as string },
      include: {
        course: {
          include: {
            _count: { select: { lessons: true } }
          }
        }
      }
    });
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProgress = async (req: AuthRequest, res: Response) => {
  const { courseId, progress } = req.body;
  try {
    const enrollment = await prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId: req.userId as string,
          courseId
        }
      },
      data: { progress }
    });
    res.json(enrollment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
