import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { createPaginationMeta, getPaginationParams } from '../utils/pagination';
import { createNotificationBatch } from '../utils/notification';

export const getAllRoadmaps = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      request.query as Record<string, unknown>,
      100,
      200,
    );
    const where: Prisma.RoadmapWhereInput = {
      OR: [
        { creatorId: null },
        { creatorId: request.userId as string },
        {
          project: {
            members: {
              some: {
                userId: request.userId as string,
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

    reply.send({
      data: roadmaps,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (_error) {
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getMyRoadmapProgress = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const progress = await prisma.userRoadmapProgress.findMany({
      where: { userId: request.userId as string },
    });
    reply.send(progress);
  } catch (_error) {
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const updateStepProgress = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { stepId, completed } = request.body as { stepId: string; completed: boolean };
  try {
    const progress = await prisma.userRoadmapProgress.upsert({
      where: {
        userId_roadmapStepId: {
          userId: request.userId as string,
          roadmapStepId: stepId,
        },
      },
      update: { completed },
      create: {
        userId: request.userId as string,
        roadmapStepId: stepId,
        completed,
      },
    });
    reply.send(progress);
  } catch (_error) {
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createRoadmap = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { title, description, steps } = request.body as {
    title: string;
    description?: string;
    steps?: Array<{ title?: string; description?: string; subtasks?: unknown[] }>;
  };
  if (!title) {
    reply.status(400).send({ error: '标题是必填项' });
    return;
  }

  try {
    const roadmap = await prisma.$transaction(async (tx) => {
      const rm = await tx.roadmap.create({
        data: {
          title,
          description: description || '',
          creatorId: request.userId as string,
        },
      });

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          if (!step) continue;
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

    reply.status(201).send(fullRoadmap);
  } catch (error) {
    logger.error('Create custom roadmap error:', error);
    reply
      .status(500)
      .send({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

export const updateRoadmap = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const { title, description, steps } = request.body as {
    title: string;
    description?: string;
    steps?: Array<{ title?: string; description?: string; subtasks?: unknown[] }>;
  };
  if (!title) {
    reply.status(400).send({ error: '标题是必填项' });
    return;
  }

  try {
    const existing = await prisma.roadmap.findUnique({ where: { id } });
    if (!existing) {
      reply.status(404).send({ error: '学习路径不存在' });
      return;
    }
    const userRole = request.user?.role;
    if (existing.creatorId !== request.userId && userRole !== 'ADMIN') {
      reply.status(403).send({ error: '权限不足，您无法编辑此学习路径' });
      return;
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
          if (!step) continue;
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
          .filter((uid) => uid !== request.userId);

        if (targetUserIds.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'SYSTEM',
              title: '学习路线变更通知',
              content: `项目绑定的学习路线「${title}」已进行调整与更新。`,
              userId: uid,
              link: `/project/${existing.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send roadmap update notifications:', notifErr);
      }
    }

    reply.send(fullRoadmap);
  } catch (error) {
    logger.error('Update custom roadmap error:', error);
    reply
      .status(500)
      .send({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

export const deleteRoadmap = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  try {
    const existing = await prisma.roadmap.findUnique({ where: { id } });
    if (!existing) {
      reply.status(404).send({ error: '学习路径不存在' });
      return;
    }
    const userRole = request.user?.role;
    if (existing.creatorId !== request.userId && userRole !== 'ADMIN') {
      reply.status(403).send({ error: '权限不足，您无法删除此学习路径' });
      return;
    }

    await prisma.roadmap.delete({ where: { id } });
    reply.send({ message: '学习路径已成功删除' });
  } catch (error) {
    logger.error('Delete custom roadmap error:', error);
    reply
      .status(500)
      .send({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
