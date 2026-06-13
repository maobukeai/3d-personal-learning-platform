import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getShanghaiStartOfDay, getShanghaiEndOfDay } from '../utils/date';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';
import logger from '../utils/logger';

interface BatchCreateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  tags?: string | null;
  subtasks?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  participantIds?: string[];
}

export const getAllTasks = async (req: AuthRequest, res: Response) => {
  const { date, status, priority, projectId, assigneeId } = req.query;
  try {
    const where: Prisma.TaskWhereInput = {
      teamId: req.workspaceId || null,
      OR: [
        { projectId: null },
        {
          project: {
            members: {
              some: { userId: req.userId as string },
            },
          },
        },
      ],
    };

    if (date) {
      const startOfDay = getShanghaiStartOfDay(date as string);
      const endOfDay = getShanghaiEndOfDay(date as string);

      where.dueDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (status) {
      where.status = status as string;
    }

    if (priority) {
      where.priority = priority as string;
    }

    if (projectId) {
      where.projectId = projectId as string;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId as string;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, color: true },
        },
        team: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(tasks);
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  const {
    title,
    description,
    status,
    priority,
    tags,
    subtasks,
    dueDate,
    assigneeId,
    projectId,
    participantIds,
  } = req.body;
  try {
    const effectiveTeamId = req.workspaceId || null;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, teamId: effectiveTeamId },
        include: {
          members: {
            where: { userId: req.userId },
          },
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.members || project.members.length === 0) {
        return res.status(403).json({ error: 'Not authorized to create tasks in this project' });
      }
    }

    if (participantIds && participantIds.length > 0 && effectiveTeamId) {
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: effectiveTeamId },
        select: { userId: true },
      });
      const memberIds = new Set(teamMembers.map((m) => m.userId));
      const invalidParticipants = participantIds.filter((id: string) => !memberIds.has(id));
      if (invalidParticipants.length > 0) {
        return res.status(400).json({ error: '部分指定人员不在该团队中', invalidParticipants });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        tags: tags || null,
        subtasks: subtasks || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        projectId: projectId || null,
        userId: req.userId as string,
        teamId: effectiveTeamId,
        participants:
          participantIds && participantIds.length > 0
            ? {
                create: participantIds.map((userId: string) => ({ userId })),
              }
            : undefined,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, color: true },
        },
        team: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    // Notify assignee
    if (assigneeId && assigneeId !== req.userId) {
      await createNotification({
        type: 'TASK',
        title: '新任务指派',
        content: `${req.user?.name || '有人'} 给您指派了新任务: ${task.title}`,
        userId: assigneeId,
        link: `/tasks?id=${task.id}`,
        category: 'TASK_UPDATE',
      });
    }

    await auditService.log({
      userId: req.userId,
      action: AuditAction.CREATE_TASK,
      module: AuditModule.TASK,
      description: `Created task: ${task.title}`,
      newValue: task,
      req,
    });

    if (task.status === 'DONE') {
      await awardPoints(task.assigneeId || req.userId!, PointsAction.COMPLETE_TASK);
    }

    if (task.projectId) {
      const projectTasks = await prisma.task.findMany({
        where: { projectId: task.projectId },
        select: { status: true },
      });
      const total = projectTasks.length;
      const done = projectTasks.filter((t) => t.status === 'DONE').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      await prisma.project.update({
        where: { id: task.projectId },
        data: { progress },
      });
    }

    // Notify other project members about the new task
    if (task.projectId) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId: task.projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((m) => m.userId)
          .filter((uid) => uid !== req.userId);

        if (targetUserIds.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'TASK',
              title: '任务看板变更通知',
              content: `项目看板中新增了任务「${task.title}」。`,
              userId: uid,
              link: `/projects/${task.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task creation notifications:', notifErr);
      }
    }

    res.status(201).json(task);
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const batchCreateTasks = async (req: AuthRequest, res: Response) => {
  const { tasks } = req.body as { tasks?: BatchCreateTaskInput[] };

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'tasks must be a non-empty array' });
  }

  if (tasks.length > 50) {
    return res.status(400).json({ error: 'Batch task creation is limited to 50 tasks' });
  }

  const invalidTitleIndex = tasks.findIndex((task) => !task.title || !task.title.trim());
  if (invalidTitleIndex >= 0) {
    return res.status(400).json({ error: 'Each task needs a title', index: invalidTitleIndex });
  }

  const normalizedTasks = tasks.map((task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    return {
      title: task.title!.trim(),
      description: task.description || null,
      status: task.status || 'TODO',
      priority: task.priority || 'MEDIUM',
      tags: task.tags || null,
      subtasks: task.subtasks || null,
      dueDate,
      assigneeId: task.assigneeId || null,
      projectId: task.projectId || null,
      participantIds: Array.isArray(task.participantIds) ? task.participantIds : [],
    };
  });

  const invalidDueDateIndex = normalizedTasks.findIndex(
    (task) => task.dueDate && Number.isNaN(task.dueDate.getTime()),
  );
  if (invalidDueDateIndex >= 0) {
    return res.status(400).json({ error: 'Invalid dueDate', index: invalidDueDateIndex });
  }

  try {
    const effectiveTeamId = req.workspaceId || null;
    const projectIds = Array.from(
      new Set(normalizedTasks.map((task) => task.projectId).filter(Boolean)),
    ) as string[];

    if (projectIds.length > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds }, teamId: effectiveTeamId },
        include: {
          members: {
            where: { userId: req.userId },
          },
        },
      });
      const projectById = new Map(projects.map((project) => [project.id, project]));
      const missingProjectId = projectIds.find((id) => !projectById.has(id));

      if (missingProjectId) {
        return res.status(404).json({ error: 'Project not found', projectId: missingProjectId });
      }

      const unauthorizedProjectId = projects.find((project) => project.members.length === 0)?.id;
      if (unauthorizedProjectId) {
        return res.status(403).json({
          error: 'Not authorized to create tasks in this project',
          projectId: unauthorizedProjectId,
        });
      }
    }

    if (effectiveTeamId) {
      const referencedUserIds = Array.from(
        new Set(
          normalizedTasks
            .flatMap((task) => [task.assigneeId, ...task.participantIds])
            .filter(Boolean),
        ),
      ) as string[];

      if (referencedUserIds.length > 0) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: effectiveTeamId, userId: { in: referencedUserIds } },
          select: { userId: true },
        });
        const memberIds = new Set(teamMembers.map((member) => member.userId));
        const invalidUserIds = referencedUserIds.filter((id) => !memberIds.has(id));

        if (invalidUserIds.length > 0) {
          return res.status(400).json({
            error: '部分指定人员不在该团队中',
            invalidUserIds,
          });
        }
      }
    }

    const createdTasks = await prisma.$transaction(
      normalizedTasks.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            tags: task.tags,
            subtasks: task.subtasks,
            dueDate: task.dueDate,
            assigneeId: task.assigneeId,
            projectId: task.projectId,
            userId: req.userId as string,
            teamId: effectiveTeamId,
            participants:
              task.participantIds.length > 0
                ? {
                    create: task.participantIds.map((userId) => ({ userId })),
                  }
                : undefined,
          },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            project: {
              select: { id: true, title: true, color: true },
            },
            team: {
              select: { id: true, name: true, avatarUrl: true },
            },
            participants: {
              select: {
                id: true,
                userId: true,
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        }),
      ),
    );

    await Promise.all(
      projectIds.map(async (projectId) => {
        const projectTasks = await prisma.task.findMany({
          where: { projectId },
          select: { status: true },
        });
        const total = projectTasks.length;
        const done = projectTasks.filter((task) => task.status === 'DONE').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        await prisma.project.update({
          where: { id: projectId },
          data: { progress },
        });
      }),
    );

    await Promise.all(
      createdTasks
        .filter((task) => task.status === 'DONE')
        .map((task) => awardPoints(task.assigneeId || req.userId!, PointsAction.COMPLETE_TASK)),
    );

    await Promise.all(
      createdTasks
        .filter((task) => task.assigneeId && task.assigneeId !== req.userId)
        .map((task) =>
          createNotification({
            type: 'TASK',
            title: '新任务指派',
            content: `${req.user?.name || '有人'} 给您指派了任务: ${task.title}`,
            userId: task.assigneeId as string,
            link: `/tasks?id=${task.id}`,
            category: 'TASK_UPDATE',
          }),
        ),
    );

    for (const projectId of projectIds) {
      try {
        const projectTasks = createdTasks.filter((task) => task.projectId === projectId);
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((member) => member.userId)
          .filter((userId) => userId !== req.userId);

        if (targetUserIds.length > 0 && projectTasks.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((userId) => ({
              type: 'TASK',
              title: '项目任务批量更新',
              content: `项目看板新增了 ${projectTasks.length} 个任务。`,
              userId,
              link: `/projects/${projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send batch task creation notifications:', notifErr);
      }
    }

    await auditService.log({
      userId: req.userId,
      action: AuditAction.CREATE_TASK,
      module: AuditModule.TASK,
      description: `Batch created ${createdTasks.length} tasks`,
      newValue: {
        count: createdTasks.length,
        taskIds: createdTasks.map((task) => task.id),
      },
      req,
    });

    res.status(201).json({ count: createdTasks.length, tasks: createdTasks });
  } catch (error) {
    logger.error('Failed to batch create tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const {
    title,
    description,
    status,
    priority,
    tags,
    subtasks,
    dueDate,
    assigneeId,
    projectId,
    participantIds,
  } = req.body;
  try {
    const existingTask = await prisma.task.findFirst({
      where: { id, teamId: req.workspaceId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: req.userId },
            },
          },
        },
      },
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    // If task belongs to a project, the user must be a member of that project
    if (
      existingTask.projectId &&
      (!existingTask.project || existingTask.project.members.length === 0)
    ) {
      return res.status(403).json({ error: 'Not authorized to update tasks in this project' });
    }

    const effectiveTeamId = req.workspaceId || null;

    // If user is trying to associate task to a new project or change project, check project membership for the target project
    if (projectId && projectId !== existingTask.projectId) {
      const targetProject = await prisma.project.findFirst({
        where: { id: projectId, teamId: effectiveTeamId },
        include: {
          members: {
            where: { userId: req.userId },
          },
        },
      });

      if (!targetProject) {
        return res.status(404).json({ error: 'Target project not found' });
      }

      if (!targetProject.members || targetProject.members.length === 0) {
        return res.status(403).json({ error: 'Not authorized to move tasks to this project' });
      }
    }

    if (participantIds && participantIds.length > 0 && effectiveTeamId) {
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: effectiveTeamId },
        select: { userId: true },
      });
      const memberIds = new Set(teamMembers.map((m) => m.userId));
      const invalidParticipants = participantIds.filter((id: string) => !memberIds.has(id));
      if (invalidParticipants.length > 0) {
        return res.status(400).json({ error: '部分指定人员不在该团队中', invalidParticipants });
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        status,
        priority,
        tags,
        subtasks: subtasks !== undefined ? subtasks : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        assigneeId: assigneeId !== undefined ? assigneeId || null : undefined,
        projectId: projectId !== undefined ? projectId || null : undefined,
        participants: participantIds
          ? {
              deleteMany: {},
              create: participantIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, color: true },
        },
        team: {
          select: { id: true, name: true, avatarUrl: true },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const isStatusChanged = status !== undefined && status !== existingTask.status;
    const transitioningToDone = isStatusChanged && status === 'DONE';
    const transitioningFromDone = isStatusChanged && existingTask.status === 'DONE';

    if (transitioningToDone) {
      await awardPoints(task.assigneeId || req.userId!, PointsAction.COMPLETE_TASK);
    } else if (transitioningFromDone) {
      await deductPoints(task.assigneeId || req.userId!, PointsAction.COMPLETE_TASK);
    }

    // Notify assignee if status changed or re-assigned
    if (
      status &&
      status !== existingTask.status &&
      task.assigneeId &&
      task.assigneeId !== req.userId
    ) {
      await createNotification({
        type: 'TASK',
        title: '任务状态更新',
        content: `任务 "${task.title}" 的状态已更新为 ${status}`,
        userId: task.assigneeId,
        link: `/tasks?id=${task.id}`,
        category: 'TASK_UPDATE',
      });
    } else if (assigneeId && assigneeId !== existingTask.assigneeId && assigneeId !== req.userId) {
      await createNotification({
        type: 'TASK',
        title: '新任务指派',
        content: `${req.user?.name || '有人'} 给您指派了任务: ${task.title}`,
        userId: assigneeId,
        link: `/tasks?id=${task.id}`,
        category: 'TASK_UPDATE',
      });
    }

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_TASK,
      module: AuditModule.TASK,
      description: `Updated task: ${task.title}`,
      oldValue: existingTask,
      newValue: task,
      req,
    });

    const projectIdChanged = task.projectId !== existingTask.projectId;
    const statusChanged = status !== undefined && status !== existingTask.status;

    if (projectIdChanged || statusChanged) {
      if (task.projectId) {
        const projectTasks = await prisma.task.findMany({
          where: { projectId: task.projectId },
          select: { status: true },
        });
        const total = projectTasks.length;
        const done = projectTasks.filter((t) => t.status === 'DONE').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        await prisma.project.update({
          where: { id: task.projectId },
          data: { progress },
        });
      }

      if (existingTask.projectId && projectIdChanged) {
        const oldProjectTasks = await prisma.task.findMany({
          where: { projectId: existingTask.projectId },
          select: { status: true },
        });
        const total = oldProjectTasks.length;
        const done = oldProjectTasks.filter((t) => t.status === 'DONE').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        await prisma.project.update({
          where: { id: existingTask.projectId },
          data: { progress },
        });
      }
    }

    // Notify other project members about task update (status change, etc.)
    if (task.projectId) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId: task.projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((m) => m.userId)
          .filter((uid) => uid !== req.userId);

        if (targetUserIds.length > 0) {
          const detailMsg =
            status && status !== existingTask.status
              ? `状态已更新为「${status === 'DONE' ? '已完成' : status === 'IN_PROGRESS' ? '进行中' : '待办'}」`
              : `内容或属性进行了更新`;
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'TASK',
              title: '任务看板变更通知',
              content: `项目看板任务「${task.title}」的${detailMsg}。`,
              userId: uid,
              link: `/projects/${task.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task update notifications:', notifErr);
      }
    }

    res.json(task);
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existingTask = await prisma.task.findFirst({
      where: { id, teamId: req.workspaceId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: req.userId },
            },
          },
        },
      },
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    // If task belongs to a project, the user must be a member of that project
    if (
      existingTask.projectId &&
      (!existingTask.project || existingTask.project.members.length === 0)
    ) {
      return res.status(403).json({ error: 'Not authorized to delete tasks in this project' });
    }

    await prisma.task.delete({ where: { id } });

    if (existingTask.status === 'DONE') {
      await deductPoints(existingTask.assigneeId || req.userId!, PointsAction.COMPLETE_TASK);
    }

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_TASK,
      module: AuditModule.TASK,
      description: `Deleted task: ${existingTask.title}`,
      oldValue: existingTask,
      req,
    });

    if (existingTask.projectId) {
      const projectTasks = await prisma.task.findMany({
        where: { projectId: existingTask.projectId },
        select: { status: true },
      });
      const total = projectTasks.length;
      const done = projectTasks.filter((t) => t.status === 'DONE').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      await prisma.project.update({
        where: { id: existingTask.projectId },
        data: { progress },
      });
    }

    // Notify other project members about task deletion
    if (existingTask.projectId) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId: existingTask.projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((m) => m.userId)
          .filter((uid) => uid !== req.userId);

        if (targetUserIds.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'TASK',
              title: '任务看板变更通知',
              content: `项目看板任务「${existingTask.title}」已被删除。`,
              userId: uid,
              link: `/projects/${existingTask.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task deletion notifications:', notifErr);
      }
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const where: Prisma.TaskWhereInput = {
      teamId: req.workspaceId || null,
      OR: [
        { projectId: null },
        {
          project: {
            members: {
              some: { userId: req.userId as string },
            },
          },
        },
      ],
    };

    const [total, todo, inProgress, done, overdue] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.count({ where: { ...where, status: 'TODO' } }),
      prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...where, status: 'DONE' } }),
      prisma.task.count({
        where: {
          ...where,
          status: { not: 'DONE' },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    const priorityBreakdown = await prisma.task.groupBy({
      by: ['priority'],
      where,
      _count: { priority: true },
    });

    res.json({
      total,
      todo,
      inProgress,
      done,
      overdue,
      completionRate,
      priorityBreakdown: priorityBreakdown.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.priority;
          return acc;
        },
        {} as Record<string, number>,
      ),
    });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
