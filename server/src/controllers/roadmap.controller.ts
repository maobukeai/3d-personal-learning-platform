import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAllRoadmaps = async (req: AuthRequest, res: Response) => {
  try {
    const roadmaps = await prisma.roadmap.findMany({
      where: {
        OR: [{ creatorId: null }, { creatorId: req.userId as string }],
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(roadmaps);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRoadmapProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await prisma.userRoadmapProgress.findMany({
      where: { userId: req.userId as string },
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStepProgress = async (req: AuthRequest, res: Response) => {
  const { stepId, completed } = req.body;
  try {
    const progress = await prisma.userRoadmapProgress.upsert({
      where: {
        userId_roadmapStepId: {
          userId: req.userId as string,
          roadmapStepId: stepId,
        },
      },
      update: { completed },
      create: {
        userId: req.userId as string,
        roadmapStepId: stepId,
        completed,
      },
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRoadmap = async (req: AuthRequest, res: Response) => {
  const { title, description, steps } = req.body;
  if (!title) {
    return res.status(400).json({ error: '标题是必填项' });
  }

  try {
    const roadmap = await prisma.$transaction(async (tx) => {
      const rm = await tx.roadmap.create({
        data: {
          title,
          description: description || '',
          creatorId: req.userId as string,
        },
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
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.status(201).json(fullRoadmap);
  } catch (error: any) {
    console.error('Create custom roadmap error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateRoadmap = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, steps } = req.body;
  if (!title) {
    return res.status(400).json({ error: '标题是必填项' });
  }

  try {
    const existing = await prisma.roadmap.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: '学习路径不存在' });
    }
    if (existing.creatorId !== req.userId) {
      return res.status(403).json({ error: '权限不足，您无法编辑此学习路径' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.roadmap.update({
        where: { id },
        data: {
          title,
          description: description || '',
        },
      });

      if (steps && Array.isArray(steps)) {
        // Delete all existing steps for this roadmap (UserRoadmapProgress will cascade delete)
        await tx.roadmapStep.deleteMany({ where: { roadmapId: id } });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const subtasksJson =
            step.subtasks && Array.isArray(step.subtasks) ? JSON.stringify(step.subtasks) : null;
          await tx.roadmapStep.create({
            data: {
              roadmapId: id,
              title: step.title || `阶段 ${i + 1}`,
              description: step.description || '',
              subtasks: subtasksJson,
              order: i + 1,
            },
          });
        }
      }
    });

    const fullRoadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json(fullRoadmap);
  } catch (error: any) {
    console.error('Update custom roadmap error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteRoadmap = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.roadmap.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: '学习路径不存在' });
    }
    if (existing.creatorId !== req.userId) {
      return res.status(403).json({ error: '权限不足，您无法删除此学习路径' });
    }

    await prisma.roadmap.delete({ where: { id } });
    res.json({ message: '学习路径已成功删除' });
  } catch (error: any) {
    console.error('Delete custom roadmap error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
