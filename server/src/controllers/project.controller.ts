import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: { userId: req.userId as string }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { name: true, email: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  const { title, description, dueDate, color, tags } = req.body;
  try {
    const project = await prisma.project.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        color: color || 'bg-accent',
        tags,
        members: {
          create: {
            userId: req.userId as string,
            role: 'OWNER'
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, progress, status, dueDate, color, tags } = req.body;
  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string }
    });
    if (!member) return res.status(403).json({ error: 'Access denied' });

    const updateData: any = {
      title,
      description,
      status,
      color,
      tags
    };

    if (progress !== undefined) updateData.progress = parseInt(progress);
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const project = await prisma.project.update({
      where: { id },
      data: updateData
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string, role: 'OWNER' }
    });
    if (!member) return res.status(403).json({ error: 'Only owners can delete projects' });

    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
