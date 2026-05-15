import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const getAllTasks = async (req: AuthRequest, res: Response) => {
  const { date, status, priority, projectId, assigneeId } = req.query;
  try {
    const where: any = { teamId: req.workspaceId };

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);

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
  } catch (error) {
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
    dueDate,
    assigneeId,
    projectId,
    teamId,
    participantIds,
  } = req.body;
  try {
    const effectiveTeamId = teamId || req.workspaceId;

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
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
    await auditService.log({
      userId: req.userId,
      action: AuditAction.CREATE_TASK,
      module: AuditModule.TASK,
      description: `Created task: ${task.title}`,
      newValue: task,
      req,
    });

    res.status(201).json(task);
  } catch (error) {
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
    dueDate,
    assigneeId,
    projectId,
    participantIds,
  } = req.body;
  try {
    const existingTask = await prisma.task.findFirst({
      where: { id, teamId: req.workspaceId },
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    // ... quota/validation code ...

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        status,
        priority,
        tags,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        projectId: projectId || null,
        participants: participantIds
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
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_TASK,
      module: AuditModule.TASK,
      description: `Updated task: ${task.title}`,
      oldValue: existingTask,
      newValue: task,
      req,
    });

    if (status !== undefined && task.projectId) {
      // ...
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

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const existingTask = await prisma.task.findFirst({
      where: { id, teamId: req.workspaceId },
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    await prisma.task.delete({ where: { id } });

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

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const where = { teamId: req.workspaceId };

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
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
