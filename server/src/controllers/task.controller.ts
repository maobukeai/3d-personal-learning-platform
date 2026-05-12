import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAllTasks = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  const { title, description, status, dueDate } = req.body;
  try {
    const task = await prisma.task.create({
      data: { 
        title, 
        description, 
        status: status || 'TODO',
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: req.userId as string
      }
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, status, dueDate } = req.body;
  try {
    // Check ownership
    const existingTask = await prisma.task.findFirst({
      where: { id, userId: req.userId as string }
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const task = await prisma.task.update({
      where: { id },
      data: { 
        title, 
        description, 
        status,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    // Check ownership
    const existingTask = await prisma.task.findFirst({
      where: { id, userId: req.userId as string }
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
