import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getShanghaiStartOfDay, getShanghaiEndOfDay } from '../utils/date';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';
import logger from '../utils/logger';
import { TaskStatus } from '../types/task';
import { logTaskActivity } from '../services/taskActivity.service';
import { getUploadedFileUrl } from '../utils/file';

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

export const getAllTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    timeEstimate,
    timeSpent,
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

    let targetParticipantIds = participantIds || [];
    let targetAssigneeId = assigneeId || null;
    if (participantIds && participantIds.length > 0) {
      targetAssigneeId = participantIds[0];
    } else if (targetAssigneeId) {
      targetParticipantIds = [targetAssigneeId];
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || TaskStatus.TODO,
        priority: priority || 'MEDIUM',
        tags: tags || null,
        subtasks: subtasks || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: targetAssigneeId,
        projectId: projectId || null,
        userId: req.userId as string,
        teamId: effectiveTeamId,
        timeEstimate: timeEstimate !== undefined ? Number(timeEstimate) : 0,
        timeSpent: timeSpent !== undefined ? Number(timeSpent) : 0,
        participants:
          targetParticipantIds.length > 0
            ? {
                create: targetParticipantIds.map((userId: string) => ({ userId })),
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
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
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
        link: `/work?id=${task.id}`,
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

    await logTaskActivity({
      taskId: task.id,
      userId: req.userId as string,
      action: 'CREATE',
      description: '创建了任务',
      newValue: JSON.stringify({ title: task.title }),
    });

    if (task.status === TaskStatus.DONE) {
      await awardPoints(task.assigneeId || req.userId!, PointsAction.COMPLETE_TASK);
    }

    if (task.projectId) {
      const projectTasks = await prisma.task.findMany({
        where: { projectId: task.projectId },
        select: { status: true },
      });
      const total = projectTasks.length;
      const done = projectTasks.filter((t) => t.status === TaskStatus.DONE).length;
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
              link: `/project/${task.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task creation notifications:', notifErr);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const batchCreateTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    let participantIds = Array.isArray(task.participantIds) ? task.participantIds : [];
    let assigneeId = task.assigneeId || null;
    if (task.participantIds && task.participantIds.length > 0) {
      assigneeId = task.participantIds[0] || null;
    } else if (assigneeId) {
      participantIds = [assigneeId];
    }

    return {
      title: task.title!.trim(),
      description: task.description || null,
      status: task.status || TaskStatus.TODO,
      priority: task.priority || 'MEDIUM',
      tags: task.tags || null,
      subtasks: task.subtasks || null,
      dueDate,
      assigneeId,
      projectId: task.projectId || null,
      participantIds,
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

    // Single round-trip to fetch all tasks for the affected projects and
    // compute progress per project in memory (avoids one findMany + one
    // update per projectId — N+1).
    const projectIdSet = new Set(projectIds);
    const allAffectedTasks = await prisma.task.findMany({
      where: { projectId: { in: Array.from(projectIdSet) } },
      select: { projectId: true, status: true },
    });
    const progressByProject = new Map<string, { total: number; done: number }>();
    for (const t of allAffectedTasks) {
      // Prisma types projectId as `string | null`; tasks without a project
      // don't contribute to any project's progress, so skip them.
      if (!t.projectId) continue;
      const entry = progressByProject.get(t.projectId) || { total: 0, done: 0 };
      entry.total += 1;
      if (t.status === TaskStatus.DONE) entry.done += 1;
      progressByProject.set(t.projectId, entry);
    }
    await Promise.all(
      Array.from(projectIdSet).map((projectId) => {
        const entry = progressByProject.get(projectId) || { total: 0, done: 0 };
        const progress = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0;
        return prisma.project.update({
          where: { id: projectId },
          data: { progress },
        });
      }),
    );

    await Promise.all(
      createdTasks
        .filter((task) => task.status === TaskStatus.DONE)
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
            link: `/work?id=${task.id}`,
            category: 'TASK_UPDATE',
          }),
        ),
    );

    // Single round-trip to fetch all members of all affected projects at
    // once (avoids one findMany per projectId — N+1), then group in memory.
    const allProjectMembers = await prisma.projectMember.findMany({
      where: { projectId: { in: Array.from(projectIdSet) } },
      select: { projectId: true, userId: true },
    });
    const membersByProject = new Map<string, string[]>();
    for (const m of allProjectMembers) {
      const arr = membersByProject.get(m.projectId) || [];
      arr.push(m.userId);
      membersByProject.set(m.projectId, arr);
    }

    for (const projectId of projectIds) {
      try {
        const projectTasks = createdTasks.filter((task) => task.projectId === projectId);
        const memberUserIds = membersByProject.get(projectId) || [];
        const targetUserIds = memberUserIds.filter((userId) => userId !== req.userId);

        if (targetUserIds.length > 0 && projectTasks.length > 0) {
          await createNotificationBatch(
            targetUserIds.map((userId) => ({
              type: 'TASK',
              title: '项目任务批量更新',
              content: `项目看板新增了 ${projectTasks.length} 个任务。`,
              userId,
              link: `/project/${projectId}`,
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
    next(error);
  }
};

export const updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    timeEstimate,
    timeSpent,
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
        participants: {
          select: { userId: true },
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

    // Check dependencies if status is changing to DONE
    if (status === TaskStatus.DONE && existingTask.status !== TaskStatus.DONE) {
      const incompleteDependencies = await prisma.taskDependency.findMany({
        where: {
          taskId: id,
          dependsOn: {
            status: { not: TaskStatus.DONE },
          },
        },
        include: {
          dependsOn: {
            select: {
              title: true,
            },
          },
        },
      });

      if (incompleteDependencies.length > 0) {
        const blockedByTitles = incompleteDependencies
          .map((dep) => `「${dep.dependsOn.title}」`)
          .join(', ');
        return res.status(400).json({
          error: `该任务的前置依赖任务尚未完成，无法关闭。未完成的前置任务: ${blockedByTitles}`,
        });
      }
    }

    let targetAssigneeId = assigneeId !== undefined ? assigneeId || null : existingTask.assigneeId;
    let targetParticipantIds =
      participantIds !== undefined
        ? [...participantIds]
        : existingTask.participants.map((p) => p.userId);

    if (participantIds !== undefined) {
      targetAssigneeId = participantIds[0] || null;
    } else if (assigneeId !== undefined) {
      if (targetAssigneeId) {
        if (!targetParticipantIds.includes(targetAssigneeId)) {
          targetParticipantIds = [targetAssigneeId, ...targetParticipantIds];
        }
      }
    }

    if (status && (status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE)) {
      if (!targetAssigneeId) {
        targetAssigneeId = req.userId;
        if (!targetParticipantIds.includes(req.userId as string)) {
          targetParticipantIds = [req.userId as string, ...targetParticipantIds];
        }
      }
    }

    const existingParticipantIds = existingTask.participants.map((p) => p.userId);
    const participantListChanged =
      targetParticipantIds.length !== existingParticipantIds.length ||
      !targetParticipantIds.every((id) => existingParticipantIds.includes(id));

    const dbParticipantIds = participantListChanged ? targetParticipantIds : undefined;

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
        assigneeId: targetAssigneeId,
        projectId: projectId !== undefined ? projectId || null : undefined,
        timeEstimate: timeEstimate !== undefined ? Number(timeEstimate) : undefined,
        timeSpent: timeSpent !== undefined ? Number(timeSpent) : undefined,
        participants:
          dbParticipantIds !== undefined
            ? {
                deleteMany: {},
                create: dbParticipantIds.map((userId: string) => ({ userId })),
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
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    const isStatusChanged = status !== undefined && status !== existingTask.status;
    const transitioningToDone = isStatusChanged && status === TaskStatus.DONE;
    const transitioningFromDone = isStatusChanged && existingTask.status === TaskStatus.DONE;

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
        link: `/work?id=${task.id}`,
        category: 'TASK_UPDATE',
      });
    } else if (assigneeId && assigneeId !== existingTask.assigneeId && assigneeId !== req.userId) {
      await createNotification({
        type: 'TASK',
        title: '新任务指派',
        content: `${req.user?.name || '有人'} 给您指派了任务: ${task.title}`,
        userId: assigneeId,
        link: `/work?id=${task.id}`,
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

    if (task.title !== existingTask.title) {
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_TITLE',
        description: `修改任务标题为 "${task.title}"`,
        oldValue: existingTask.title,
        newValue: task.title,
      });
    }

    if (task.description !== existingTask.description) {
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_DESCRIPTION',
        description: '修改了任务描述',
        oldValue: existingTask.description || null,
        newValue: task.description || null,
      });
    }

    if (task.status !== existingTask.status) {
      const statusMap: Record<string, string> = {
        TODO: '待办',
        IN_PROGRESS: '进行中',
        DONE: '已完成',
      };
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_STATUS',
        description: `将任务状态修改为 "${statusMap[task.status] || task.status}"`,
        oldValue: existingTask.status,
        newValue: task.status,
      });
    }

    if (task.priority !== existingTask.priority) {
      const priorityMap: Record<string, string> = {
        LOW: '低',
        MEDIUM: '中',
        HIGH: '高',
        URGENT: '紧急',
      };
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_PRIORITY',
        description: `将优先级修改为 "${priorityMap[task.priority] || task.priority}"`,
        oldValue: existingTask.priority,
        newValue: task.priority,
      });
    }

    if (task.assigneeId !== existingTask.assigneeId) {
      const desc = task.assigneeId
        ? `将任务指派给 "${task.assignee?.name || '未知用户'}"`
        : '取消了任务指派';
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_ASSIGNEE',
        description: desc,
        oldValue: existingTask.assigneeId || null,
        newValue: task.assigneeId || null,
      });
    }

    const taskDueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null;
    const existingDueDateStr = existingTask.dueDate
      ? new Date(existingTask.dueDate).toISOString().split('T')[0]
      : null;
    if (taskDueDateStr !== existingDueDateStr) {
      const desc = taskDueDateStr ? `将截止日期修改为 "${taskDueDateStr}"` : '移除了截止日期';
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_DUE_DATE',
        description: desc,
        oldValue: existingDueDateStr,
        newValue: taskDueDateStr,
      });
    }

    if (task.projectId !== existingTask.projectId) {
      const desc = task.projectId
        ? `关联了项目 "${task.project?.title || '未知项目'}"`
        : '取消了关联项目';
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_PROJECT',
        description: desc,
        oldValue: existingTask.projectId || null,
        newValue: task.projectId || null,
      });
    }

    if (task.timeEstimate !== existingTask.timeEstimate) {
      const toHours = (min: number | null) => (min != null ? min / 60 : null);
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_TIME_ESTIMATE',
        description: `将预计工时修改为 ${toHours(task.timeEstimate) ?? '未设置'} 小时`,
        oldValue: String(toHours(existingTask.timeEstimate) ?? '未设置'),
        newValue: String(toHours(task.timeEstimate) ?? '未设置'),
      });
    }

    if (task.timeSpent !== existingTask.timeSpent) {
      const toHours = (min: number | null) => (min != null ? min / 60 : null);
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_TIME_SPENT',
        description: `将已耗工时修改为 ${toHours(task.timeSpent) ?? '未设置'} 小时`,
        oldValue: String(toHours(existingTask.timeSpent) ?? '未设置'),
        newValue: String(toHours(task.timeSpent) ?? '未设置'),
      });
    }

    if (task.subtasks !== existingTask.subtasks) {
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_SUBTASKS',
        description: '更新了子任务',
        oldValue: existingTask.subtasks || null,
        newValue: task.subtasks || null,
      });
    }

    if (dbParticipantIds !== undefined) {
      await logTaskActivity({
        taskId: task.id,
        userId: req.userId as string,
        action: 'UPDATE_PARTICIPANTS',
        description: '更新了参与人员',
      });
    }

    const projectIdChanged = task.projectId !== existingTask.projectId;
    const statusChanged = status !== undefined && status !== existingTask.status;

    if (projectIdChanged || statusChanged) {
      if (task.projectId) {
        const projectTasks = await prisma.task.findMany({
          where: { projectId: task.projectId },
          select: { status: true },
        });
        const total = projectTasks.length;
        const done = projectTasks.filter((t) => t.status === TaskStatus.DONE).length;
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
        const done = oldProjectTasks.filter((t) => t.status === TaskStatus.DONE).length;
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
              ? `状态已更新为「${status === TaskStatus.DONE ? '已完成' : status === TaskStatus.IN_PROGRESS ? '进行中' : '待办'}」`
              : `内容或属性进行了更新`;
          await createNotificationBatch(
            targetUserIds.map((uid) => ({
              type: 'TASK',
              title: '任务看板变更通知',
              content: `项目看板任务「${task.title}」的${detailMsg}。`,
              userId: uid,
              link: `/project/${task.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task update notifications:', notifErr);
      }
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    if (existingTask.status === TaskStatus.DONE) {
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
      const done = projectTasks.filter((t) => t.status === TaskStatus.DONE).length;
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
              link: `/project/${existingTask.projectId}`,
              category: 'TEAM_ACTIVITY' as const,
            })),
          );
        }
      } catch (notifErr) {
        logger.error('Failed to send task deletion notifications:', notifErr);
      }
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      prisma.task.count({ where: { ...where, status: TaskStatus.TODO } }),
      prisma.task.count({ where: { ...where, status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { ...where, status: TaskStatus.DONE } }),
      prisma.task.count({
        where: {
          ...where,
          status: { not: TaskStatus.DONE },
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
    next(error);
  }
};

export const addTaskDependency = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const dependsOnId = req.body.dependsOnId as string;

  try {
    if (id === dependsOnId) {
      return res.status(400).json({ error: '任务不能依赖于其自身' });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    const dependsOn = await prisma.task.findUnique({ where: { id: dependsOnId } });

    if (!task || !dependsOn) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if duplicate
    const existing = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnId: {
          taskId: id,
          dependsOnId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: '依赖关系已存在' });
    }

    // Check if cyclic dependency
    const cyclic = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnId: {
          taskId: dependsOnId,
          dependsOnId: id,
        },
      },
    });

    if (cyclic) {
      return res.status(400).json({ error: '检测到循环依赖关系 (任务之间不能互为依赖)' });
    }

    await prisma.taskDependency.create({
      data: {
        taskId: id,
        dependsOnId,
      },
    });

    await logTaskActivity({
      taskId: id,
      userId: req.userId as string,
      action: 'ADD_DEPENDENCY',
      description: `添加了前置依赖任务 "${dependsOn.title}"`,
      newValue: JSON.stringify({ dependsOnId, title: dependsOn.title }),
    });

    // Return the updated task with full dependencies/dependents
    const updatedTask = await prisma.task.findUnique({
      where: { id },
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
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    res.status(201).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

export const deleteTaskDependency = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const dependsOnId = req.params.dependsOnId as string;

  try {
    const dependency = await prisma.taskDependency.findUnique({
      where: {
        taskId_dependsOnId: {
          taskId: id,
          dependsOnId,
        },
      },
    });

    if (!dependency) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    const dependsOn = await prisma.task.findUnique({ where: { id: dependsOnId } });
    const dependsOnTitle = dependsOn ? dependsOn.title : '未知任务';

    await prisma.taskDependency.delete({
      where: {
        taskId_dependsOnId: {
          taskId: id,
          dependsOnId,
        },
      },
    });

    await logTaskActivity({
      taskId: id,
      userId: req.userId as string,
      action: 'REMOVE_DEPENDENCY',
      description: `移除了前置依赖任务 "${dependsOnTitle}"`,
      oldValue: JSON.stringify({ dependsOnId, title: dependsOnTitle }),
    });

    // Return updated task
    const updatedTask = await prisma.task.findUnique({
      where: { id },
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
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependents: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
};

export const uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    const parts = req.file.destination ? req.file.destination.split(/[/\\]/) : [];
    const subFolder = parts[parts.length - 1] || 'tasks';
    const attachmentUrl = getUploadedFileUrl(req, req.file, subFolder);
    res.json({ url: attachmentUrl });
  } catch (error) {
    next(error);
  }
};

export const getTaskActivities = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const taskId = req.params.id as string;
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        teamId: req.workspaceId || null,
        OR: [
          { projectId: null, userId: req.userId as string },
          {
            project: {
              members: {
                some: { userId: req.userId as string },
              },
            },
          },
        ],
      },
    });

    if (!task) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const activities = await prisma.taskActivity.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(activities);
  } catch (error) {
    next(error);
  }
};
