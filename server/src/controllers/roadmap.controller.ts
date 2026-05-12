import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAllRoadmaps = async (req: AuthRequest, res: Response) => {
  try {
    const roadmaps = await prisma.roadmap.findMany({
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    });
    res.json(roadmaps);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRoadmapProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await prisma.userRoadmapProgress.findMany({
      where: { userId: req.userId as string }
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
          roadmapStepId: stepId
        }
      },
      update: { completed },
      create: {
        userId: req.userId as string,
        roadmapStepId: stepId,
        completed
      }
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
