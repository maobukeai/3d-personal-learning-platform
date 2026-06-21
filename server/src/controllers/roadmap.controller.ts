import { logger } from '../utils/logger';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createPaginationMeta, getPaginationParams } from '../utils/pagination';
import { createNotificationBatch } from '../utils/notification';

export const getAllRoadmaps = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 100, 200);
    const where: Prisma.RoadmapWhereInput = {
      OR: [
        { creatorId: null },
        { creatorId: req.userId as string },
        {
          project: {
            members: {
              some: {
                userId: req.userId as string,
              },
            },
          },
        },
      ],
    };

    const [total, roadmaps] = await prisma.$transaction([
      prisma.roadmap.count({ where }),
      prisma.roadmap.findMany({
        where,
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
          project: {
            select: {
              id: true,
              teamId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: roadmaps,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRoadmapProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await prisma.userRoadmapProgress.findMany({
      where: { userId: req.userId as string },
    });
    res.json(progress);
  } catch (_error) {
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
  } catch (_error) {
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
        project: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    res.status(201).json(fullRoadmap);
  } catch (error) {
    logger.error('Create custom roadmap error:', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal server error' });
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
    const userRole = req.user?.role;
    if (existing.creatorId !== req.userId && userRole !== 'ADMIN') {
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
        project: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    // Notify other project members about the roadmap update
    if (existing.projectId) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId: existing.projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((m) => m.userId)
          .filter((uid) => uid !== req.userId);

        if (targetUserIds.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'SYSTEM',
              title: '学习路线变更通知',
              content: `项目绑定的学习路线「${title}」已进行调整与更新。`,
              userId: uid,
              link: `/projects/${existing.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send roadmap update notifications:', notifErr);
      }
    }

    res.json(fullRoadmap);
  } catch (error) {
    logger.error('Update custom roadmap error:', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

export const deleteRoadmap = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.roadmap.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: '学习路径不存在' });
    }
    const userRole = req.user?.role;
    if (existing.creatorId !== req.userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: '权限不足，您无法删除此学习路径' });
    }

    await prisma.roadmap.delete({ where: { id } });
    res.json({ message: '学习路径已成功删除' });
  } catch (error) {
    logger.error('Delete custom roadmap error:', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
