import type { FastifyInstance, FastifyRequest } from 'fastify';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { createNotification, createNotificationBatch } from '../../utils/notification';
import { awardPoints, deductPoints, PointsAction } from '../../services/points.service';
import { logTaskActivity } from '../../services/taskActivity.service';
import { getShanghaiStartOfDay, getShanghaiEndOfDay } from '../../utils/date';
import { TaskStatus } from '../../types/task';
import { taskSchema } from '../../utils/schemas';
import { fastifyAuthenticate, fastifyResolveWorkspace } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import type { UploadedFile } from '../../types/upload';

/**
 * Fastify 任务路由（铁律六·1 渐进式迁移）。
 *
 * 挂载前缀: /api/fastify/tasks
 *
 * 业务逻辑从 Express task.controller.ts / taskComment.controller.ts 移植而来，
 * 仅适配 Fastify request/reply 签名；复用同款 prisma / auditService /
 * notification / points / taskActivity 等共享模块。
 *
 * 跳过端点（保留在 Express，因使用 multer 文件上传）：
 *  - POST /upload-image （upload.single('task_image')）
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const requireUserId = (request: FastifyRequest): string => {
  if (!request.userId) {
    throw new AppError('登录会话已过期，请重新登录', 401, 'UNAUTHORIZED');
  }
  return request.userId;
};

const requireWorkspaceId = (request: FastifyRequest): string | null => {
  return request.workspaceId || null;
};

/**
 * 构造一个最小化的 Express Request 适配器，仅供 auditService.log({ req }) 使用。
 *
 * auditService 仅访问：req.headers / req.ip / req.socket.remoteAddress。
 * FastifyRequest 提供 request.headers 与 request.ip；request.raw.socket
 * 即底层 Node.js socket（含 remoteAddress）。
 */
const buildAuditReq = (request: FastifyRequest) => ({
  headers: request.headers,
  ip: request.ip,
  socket: request.raw.socket,
});

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

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const idParamsSchema = z.object({
  id: z.string().min(1, 'Task id is required'),
});

const taskIdParamsSchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
});

const taskCommentParamsSchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
  commentId: z.string().min(1, 'Comment id is required'),
});

const dependencyParamsSchema = z.object({
  id: z.string().min(1, 'Task id is required'),
  dependsOnId: z.string().min(1, 'Dependency id is required'),
});

const listTasksQuerySchema = z.object({
  date: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
});

const addDependencyBodySchema = z.object({
  dependsOnId: z.string().min(1, 'dependsOnId is required'),
});

const batchCreateBodySchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().optional(),
        description: z.string().optional().nullable(),
        status: z.string().optional(),
        priority: z.string().optional(),
        tags: z.string().optional().nullable(),
        subtasks: z.string().optional().nullable(),
        dueDate: z.string().optional().nullable(),
        assigneeId: z.string().optional().nullable(),
        projectId: z.string().optional().nullable(),
        participantIds: z.array(z.string()).optional(),
      }),
    )
    .min(1, 'tasks must be a non-empty array'),
});

const createCommentBodySchema = z.object({
  content: z.string().min(1, '评论内容不能为空'),
});

// Comment rate limit: 10 per minute per user (matches Express commentLimiter)
const COMMENT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

// ---------------------------------------------------------------------------
// Task access verification（从 taskComment.controller.ts 移植）
// ---------------------------------------------------------------------------

const verifyTaskAccess = async (request: FastifyRequest, taskId: string): Promise<boolean> => {
  const userId = requireUserId(request);
  const teamId = requireWorkspaceId(request);

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      teamId,
      OR: [
        { projectId: null },
        {
          project: {
            members: {
              some: { userId },
            },
          },
        },
      ],
    },
  });

  return Boolean(task);
};

// ---------------------------------------------------------------------------
// Shared Prisma include block（任务详情的标准关联）
// ---------------------------------------------------------------------------

const taskInclude = {
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
} as const;

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerTaskRoutes = (app: FastifyInstance): void => {
  // All task routes require authentication + workspace resolution
  const auth = { preHandler: [fastifyAuthenticate, fastifyResolveWorkspace] };

  // GET /stats —— 任务统计
  app.get(
    '/stats',
    {
      ...auth,
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const teamId = requireWorkspaceId(request);

      const where: Prisma.TaskWhereInput = {
        teamId,
        OR: [
          { projectId: null },
          {
            project: {
              members: {
                some: { userId },
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

      return reply.send({
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
    },
  );

  // GET / —— 获取任务列表
  app.get(
    '/',
    {
      ...auth,
      schema: { querystring: listTasksQuerySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const teamId = requireWorkspaceId(request);
      const { date, status, priority, projectId, assigneeId } = request.query as {
        date?: string;
        status?: string;
        priority?: string;
        projectId?: string;
        assigneeId?: string;
      };

      const where: Prisma.TaskWhereInput = {
        teamId,
        OR: [
          { projectId: null },
          {
            project: {
              members: {
                some: { userId },
              },
            },
          },
        ],
      };

      if (date) {
        const startOfDay = getShanghaiStartOfDay(date);
        const endOfDay = getShanghaiEndOfDay(date);

        where.dueDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }

      if (status) {
        where.status = status;
      }

      if (priority) {
        where.priority = priority;
      }

      if (projectId) {
        where.projectId = projectId;
      }

      if (assigneeId) {
        where.assigneeId = assigneeId;
      }

      const tasks = await prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      });

      return reply.send(tasks);
    },
  );

  // POST / —— 创建任务
  app.post(
    '/',
    {
      ...auth,
      schema: { body: taskSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const userName = request.user?.name;
      const teamId = requireWorkspaceId(request);
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
      } = request.body as {
        title: string;
        description?: string | null;
        status?: string;
        priority?: string;
        tags?: string | null;
        subtasks?: string | null;
        dueDate?: string | null;
        assigneeId?: string | null;
        projectId?: string | null;
        participantIds?: string[] | null;
        timeEstimate?: number | string | null;
        timeSpent?: number | string | null;
      };

      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, teamId },
          include: {
            members: {
              where: { userId },
            },
          },
        });

        if (!project) {
          throw new AppError('Project not found', 404);
        }

        if (!project.members || project.members.length === 0) {
          throw new AppError('Not authorized to create tasks in this project', 403);
        }
      }

      const normalizedParticipantIds = participantIds || [];
      if (normalizedParticipantIds.length > 0 && teamId) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId },
          select: { userId: true },
        });
        const memberIds = new Set(teamMembers.map((m) => m.userId));
        const invalidParticipants = normalizedParticipantIds.filter(
          (id: string) => !memberIds.has(id),
        );
        if (invalidParticipants.length > 0) {
          throw new AppError('部分指定人员不在该团队中', 400, 'INVALID_PARTICIPANTS', {
            invalidParticipants,
          });
        }
      }

      let targetParticipantIds = normalizedParticipantIds;
      let targetAssigneeId = assigneeId || null;
      if (normalizedParticipantIds.length > 0) {
        targetAssigneeId = normalizedParticipantIds[0]!;
      } else if (targetAssigneeId) {
        targetParticipantIds = [targetAssigneeId];
      }

      const task = await prisma.task.create({
        data: {
          title,
          description: description ?? null,
          status: status || TaskStatus.TODO,
          priority: priority || 'MEDIUM',
          tags: tags || null,
          subtasks: subtasks || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: targetAssigneeId,
          projectId: projectId || null,
          userId,
          teamId,
          timeEstimate: timeEstimate !== undefined ? Number(timeEstimate) : 0,
          timeSpent: timeSpent !== undefined ? Number(timeSpent) : 0,
          participants:
            targetParticipantIds.length > 0
              ? {
                  create: targetParticipantIds.map((uId: string) => ({ userId: uId })),
                }
              : undefined,
        },
        include: taskInclude,
      });

      // Notify assignee
      if (assigneeId && assigneeId !== userId) {
        await createNotification({
          type: 'TASK',
          title: '新任务指派',
          content: `${userName || '有人'} 给您指派了新任务: ${task.title}`,
          userId: assigneeId,
          link: `/work?id=${task.id}`,
          category: 'TASK_UPDATE',
        });
      }

      await auditService.log({
        userId,
        action: AuditAction.CREATE_TASK,
        module: AuditModule.TASK,
        description: `Created task: ${task.title}`,
        newValue: task,
        req: buildAuditReq(request),
      });

      await logTaskActivity({
        taskId: task.id,
        userId,
        action: 'CREATE',
        description: '创建了任务',
        newValue: JSON.stringify({ title: task.title }),
      });

      if (task.status === TaskStatus.DONE) {
        await awardPoints(task.assigneeId || userId, PointsAction.COMPLETE_TASK);
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
          const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== userId);

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
        } catch {
          // non-fatal notification failure
        }
      }

      return reply.status(201).send(task);
    },
  );

  // POST /batch —— 批量创建任务
  app.post(
    '/batch',
    {
      ...auth,
      schema: { body: batchCreateBodySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const userName = request.user?.name;
      const teamId = requireWorkspaceId(request);
      const { tasks } = request.body as { tasks: BatchCreateTaskInput[] };

      if (tasks.length > 50) {
        throw new AppError('Batch task creation is limited to 50 tasks', 400);
      }

      const invalidTitleIndex = tasks.findIndex((task) => !task.title || !task.title.trim());
      if (invalidTitleIndex >= 0) {
        throw new AppError('Each task needs a title', 400, 'VALIDATION_ERROR', {
          index: invalidTitleIndex,
        });
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
        throw new AppError('Invalid dueDate', 400, 'VALIDATION_ERROR', {
          index: invalidDueDateIndex,
        });
      }

      const projectIds = Array.from(
        new Set(normalizedTasks.map((task) => task.projectId).filter(Boolean)),
      ) as string[];

      if (projectIds.length > 0) {
        const projects = await prisma.project.findMany({
          where: { id: { in: projectIds }, teamId },
          include: {
            members: {
              where: { userId },
            },
          },
        });
        const projectById = new Map(projects.map((project) => [project.id, project]));
        const missingProjectId = projectIds.find((id) => !projectById.has(id));

        if (missingProjectId) {
          throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND', {
            projectId: missingProjectId,
          });
        }

        const unauthorizedProjectId = projects.find((project) => project.members.length === 0)?.id;
        if (unauthorizedProjectId) {
          throw new AppError('Not authorized to create tasks in this project', 403, 'FORBIDDEN', {
            projectId: unauthorizedProjectId,
          });
        }
      }

      if (teamId) {
        const referencedUserIds = Array.from(
          new Set(
            normalizedTasks
              .flatMap((task) => [task.assigneeId, ...task.participantIds])
              .filter(Boolean),
          ),
        ) as string[];

        if (referencedUserIds.length > 0) {
          const teamMembers = await prisma.teamMember.findMany({
            where: { teamId, userId: { in: referencedUserIds } },
            select: { userId: true },
          });
          const memberIds = new Set(teamMembers.map((member) => member.userId));
          const invalidUserIds = referencedUserIds.filter((id) => !memberIds.has(id));

          if (invalidUserIds.length > 0) {
            throw new AppError('部分指定人员不在该团队中', 400, 'INVALID_PARTICIPANTS', {
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
              userId,
              teamId,
              participants:
                task.participantIds.length > 0
                  ? {
                      create: task.participantIds.map((uId) => ({ userId: uId })),
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
          .map((task) => awardPoints(task.assigneeId || userId, PointsAction.COMPLETE_TASK)),
      );

      await Promise.all(
        createdTasks
          .filter((task) => task.assigneeId && task.assigneeId !== userId)
          .map((task) =>
            createNotification({
              type: 'TASK',
              title: '新任务指派',
              content: `${userName || '有人'} 给您指派了任务: ${task.title}`,
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
          const targetUserIds = memberUserIds.filter((uId) => uId !== userId);

          if (targetUserIds.length > 0 && projectTasks.length > 0) {
            await createNotificationBatch(
              targetUserIds.map((uId) => ({
                type: 'TASK',
                title: '项目任务批量更新',
                content: `项目看板新增了 ${projectTasks.length} 个任务。`,
                userId: uId,
                link: `/project/${projectId}`,
                category: 'TEAM_ACTIVITY' as const,
              })),
            );
          }
        } catch {
          // non-fatal notification failure
        }
      }

      await auditService.log({
        userId,
        action: AuditAction.CREATE_TASK,
        module: AuditModule.TASK,
        description: `Batch created ${createdTasks.length} tasks`,
        newValue: {
          count: createdTasks.length,
          taskIds: createdTasks.map((task) => task.id),
        },
        req: buildAuditReq(request),
      });

      return reply.status(201).send({ count: createdTasks.length, tasks: createdTasks });
    },
  );

  // PUT /:id —— 更新任务
  app.put(
    '/:id',
    {
      ...auth,
      schema: { params: idParamsSchema, body: taskSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const teamId = requireWorkspaceId(request);
      const { id } = request.params as { id: string };
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
      } = request.body as {
        title?: string;
        description?: string | null;
        status?: string;
        priority?: string;
        tags?: string | null;
        subtasks?: string | null;
        dueDate?: string | null;
        assigneeId?: string | null;
        projectId?: string | null;
        participantIds?: string[] | null;
        timeEstimate?: number | string | null;
        timeSpent?: number | string | null;
      };

      const existingTask = await prisma.task.findFirst({
        where: { id, teamId: teamId || undefined },
        include: {
          project: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
          participants: {
            select: { userId: true },
          },
        },
      });
      if (!existingTask) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      // If task belongs to a project, the user must be a member of that project
      if (
        existingTask.projectId &&
        (!existingTask.project || existingTask.project.members.length === 0)
      ) {
        throw new AppError('Not authorized to update tasks in this project', 403);
      }

      // If user is trying to associate task to a new project or change project,
      // check project membership for the target project
      if (projectId && projectId !== existingTask.projectId) {
        const targetProject = await prisma.project.findFirst({
          where: { id: projectId, teamId: teamId || undefined },
          include: {
            members: {
              where: { userId },
            },
          },
        });

        if (!targetProject) {
          throw new AppError('Target project not found', 404);
        }

        if (!targetProject.members || targetProject.members.length === 0) {
          throw new AppError('Not authorized to move tasks to this project', 403);
        }
      }

      const normalizedParticipantIds = participantIds || [];
      if (normalizedParticipantIds.length > 0 && teamId) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId },
          select: { userId: true },
        });
        const memberIds = new Set(teamMembers.map((m) => m.userId));
        const invalidParticipants = normalizedParticipantIds.filter(
          (id: string) => !memberIds.has(id),
        );
        if (invalidParticipants.length > 0) {
          throw new AppError('部分指定人员不在该团队中', 400, 'INVALID_PARTICIPANTS', {
            invalidParticipants,
          });
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
          throw new AppError(
            `该任务的前置依赖任务尚未完成，无法关闭。未完成的前置任务: ${blockedByTitles}`,
            400,
          );
        }
      }

      let targetAssigneeId =
        assigneeId !== undefined ? assigneeId || null : existingTask.assigneeId;
      let targetParticipantIds =
        participantIds !== undefined
          ? [...(participantIds || [])]
          : existingTask.participants.map((p) => p.userId);

      if (participantIds !== undefined) {
        targetAssigneeId = (participantIds || [])[0] || null;
      } else if (assigneeId !== undefined) {
        if (targetAssigneeId) {
          if (!targetParticipantIds.includes(targetAssigneeId)) {
            targetParticipantIds = [targetAssigneeId, ...targetParticipantIds];
          }
        }
      }

      if (status && (status === TaskStatus.IN_PROGRESS || status === TaskStatus.DONE)) {
        if (!targetAssigneeId) {
          targetAssigneeId = userId;
          if (!targetParticipantIds.includes(userId)) {
            targetParticipantIds = [userId, ...targetParticipantIds];
          }
        }
      }

      const existingParticipantIds = existingTask.participants.map((p) => p.userId);
      const participantListChanged =
        targetParticipantIds.length !== existingParticipantIds.length ||
        !targetParticipantIds.every((pid) => existingParticipantIds.includes(pid));

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
                  create: dbParticipantIds.map((uId: string) => ({ userId: uId })),
                }
              : undefined,
        },
        include: taskInclude,
      });

      const isStatusChanged = status !== undefined && status !== existingTask.status;
      const transitioningToDone = isStatusChanged && status === TaskStatus.DONE;
      const transitioningFromDone = isStatusChanged && existingTask.status === TaskStatus.DONE;

      if (transitioningToDone) {
        await awardPoints(task.assigneeId || userId, PointsAction.COMPLETE_TASK);
      } else if (transitioningFromDone) {
        await deductPoints(task.assigneeId || userId, PointsAction.COMPLETE_TASK);
      }

      // Notify assignee if status changed or re-assigned
      if (
        status &&
        status !== existingTask.status &&
        task.assigneeId &&
        task.assigneeId !== userId
      ) {
        await createNotification({
          type: 'TASK',
          title: '任务状态更新',
          content: `任务 "${task.title}" 的状态已更新为 ${status}`,
          userId: task.assigneeId,
          link: `/work?id=${task.id}`,
          category: 'TASK_UPDATE',
        });
      } else if (assigneeId && assigneeId !== existingTask.assigneeId && assigneeId !== userId) {
        await createNotification({
          type: 'TASK',
          title: '新任务指派',
          content: `${request.user?.name || '有人'} 给您指派了任务: ${task.title}`,
          userId: assigneeId,
          link: `/work?id=${task.id}`,
          category: 'TASK_UPDATE',
        });
      }

      await auditService.log({
        userId,
        action: AuditAction.UPDATE_TASK,
        module: AuditModule.TASK,
        description: `Updated task: ${task.title}`,
        oldValue: existingTask,
        newValue: task,
        req: buildAuditReq(request),
      });

      if (task.title !== existingTask.title) {
        await logTaskActivity({
          taskId: task.id,
          userId,
          action: 'UPDATE_TITLE',
          description: `修改任务标题为 "${task.title}"`,
          oldValue: existingTask.title,
          newValue: task.title,
        });
      }

      if (task.description !== existingTask.description) {
        await logTaskActivity({
          taskId: task.id,
          userId,
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
          userId,
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
          userId,
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
          userId,
          action: 'UPDATE_ASSIGNEE',
          description: desc,
          oldValue: existingTask.assigneeId || null,
          newValue: task.assigneeId || null,
        });
      }

      const taskDueDateStr = task.dueDate
        ? new Date(task.dueDate).toISOString().split('T')[0]
        : null;
      const existingDueDateStr = existingTask.dueDate
        ? new Date(existingTask.dueDate).toISOString().split('T')[0]
        : null;
      if (taskDueDateStr !== existingDueDateStr) {
        const desc = taskDueDateStr ? `将截止日期修改为 "${taskDueDateStr}"` : '移除了截止日期';
        await logTaskActivity({
          taskId: task.id,
          userId,
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
          userId,
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
          userId,
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
          userId,
          action: 'UPDATE_TIME_SPENT',
          description: `将已耗工时修改为 ${toHours(task.timeSpent) ?? '未设置'} 小时`,
          oldValue: String(toHours(existingTask.timeSpent) ?? '未设置'),
          newValue: String(toHours(task.timeSpent) ?? '未设置'),
        });
      }

      if (task.subtasks !== existingTask.subtasks) {
        await logTaskActivity({
          taskId: task.id,
          userId,
          action: 'UPDATE_SUBTASKS',
          description: '更新了子任务',
          oldValue: existingTask.subtasks || null,
          newValue: task.subtasks || null,
        });
      }

      if (dbParticipantIds !== undefined) {
        await logTaskActivity({
          taskId: task.id,
          userId,
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
          const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== userId);

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
        } catch {
          // non-fatal notification failure
        }
      }

      return reply.send(task);
    },
  );

  // DELETE /:id —— 删除任务
  app.delete(
    '/:id',
    {
      ...auth,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const teamId = requireWorkspaceId(request);
      const { id } = request.params as { id: string };

      const existingTask = await prisma.task.findFirst({
        where: { id, teamId: teamId || undefined },
        include: {
          project: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });
      if (!existingTask) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      }

      // If task belongs to a project, the user must be a member of that project
      if (
        existingTask.projectId &&
        (!existingTask.project || existingTask.project.members.length === 0)
      ) {
        throw new AppError('Not authorized to delete tasks in this project', 403);
      }

      await prisma.task.delete({ where: { id } });

      if (existingTask.status === TaskStatus.DONE) {
        await deductPoints(existingTask.assigneeId || userId, PointsAction.COMPLETE_TASK);
      }

      await auditService.log({
        userId,
        action: AuditAction.DELETE_TASK,
        module: AuditModule.TASK,
        description: `Deleted task: ${existingTask.title}`,
        oldValue: existingTask,
        req: buildAuditReq(request),
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
          const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== userId);

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
        } catch {
          // non-fatal notification failure
        }
      }

      return reply.send({ message: 'Task deleted successfully' });
    },
  );

  // GET /:id/activities —— 获取任务活动记录
  app.get(
    '/:id/activities',
    {
      ...auth,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const teamId = requireWorkspaceId(request);
      const { id: taskId } = request.params as { id: string };

      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          teamId,
          OR: [
            { projectId: null, userId },
            {
              project: {
                members: {
                  some: { userId },
                },
              },
            },
          ],
        },
      });

      if (!task) {
        throw new AppError('任务不存在或无权访问', 404, 'TASK_NOT_FOUND');
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

      return reply.send(activities);
    },
  );

  // -------------------------------------------------------------------------
  // Task comments
  // -------------------------------------------------------------------------

  // GET /:taskId/comments —— 获取任务评论列表
  app.get(
    '/:taskId/comments',
    {
      ...auth,
      schema: { params: taskIdParamsSchema },
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };

      const hasAccess = await verifyTaskAccess(request, taskId);
      if (!hasAccess) {
        throw new AppError('任务不存在或无权访问', 404, 'TASK_NOT_FOUND');
      }

      const comments = await prisma.taskComment.findMany({
        where: { taskId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send(comments);
    },
  );

  // POST /:taskId/comments —— 创建任务评论（含事务化活动记录）
  app.post(
    '/:taskId/comments',
    {
      ...auth,
      schema: { params: taskIdParamsSchema, body: createCommentBodySchema },
      config: { rateLimit: COMMENT_RATE_LIMIT },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { taskId } = request.params as { taskId: string };
      const { content } = request.body as { content: string };

      const hasAccess = await verifyTaskAccess(request, taskId);
      if (!hasAccess) {
        throw new AppError('任务不存在或无权访问', 404, 'TASK_NOT_FOUND');
      }

      const comment = await prisma.$transaction(async (tx) => {
        const newComment = await tx.taskComment.create({
          data: {
            content: content.trim(),
            taskId,
            userId,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        });

        await logTaskActivity({
          taskId,
          userId,
          action: 'ADD_COMMENT',
          description: `发表了评论: "${newComment.content}"`,
          newValue: JSON.stringify({ commentId: newComment.id, content: newComment.content }),
          tx,
        });

        return newComment;
      });

      return reply.status(201).send(comment);
    },
  );

  // DELETE /:taskId/comments/:commentId —— 删除任务评论
  app.delete(
    '/:taskId/comments/:commentId',
    {
      ...auth,
      schema: { params: taskCommentParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { taskId, commentId } = request.params as {
        taskId: string;
        commentId: string;
      };

      const comment = await prisma.taskComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
      }

      if (comment.taskId !== taskId) {
        throw new AppError('评论不存在', 404, 'COMMENT_NOT_FOUND');
      }

      if (comment.userId !== userId && request.user?.role !== 'ADMIN') {
        throw new AppError('无权删除此评论', 403, 'FORBIDDEN');
      }

      await prisma.taskComment.delete({
        where: { id: commentId },
      });

      await logTaskActivity({
        taskId,
        userId,
        action: 'DELETE_COMMENT',
        description: '删除了评论',
        oldValue: JSON.stringify({ commentId: comment.id, content: comment.content }),
      });

      return reply.send({ message: '评论删除成功' });
    },
  );

  // -------------------------------------------------------------------------
  // Task dependencies
  // -------------------------------------------------------------------------

  // POST /:id/dependencies —— 添加任务依赖
  app.post(
    '/:id/dependencies',
    {
      ...auth,
      schema: { params: idParamsSchema, body: addDependencyBodySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const { dependsOnId } = request.body as { dependsOnId: string };

      if (id === dependsOnId) {
        throw new AppError('任务不能依赖于其自身', 400);
      }

      const task = await prisma.task.findUnique({ where: { id } });
      const dependsOn = await prisma.task.findUnique({ where: { id: dependsOnId } });

      if (!task || !dependsOn) {
        throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
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
        throw new AppError('依赖关系已存在', 400);
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
        throw new AppError('检测到循环依赖关系 (任务之间不能互为依赖)', 400);
      }

      await prisma.taskDependency.create({
        data: {
          taskId: id,
          dependsOnId,
        },
      });

      await logTaskActivity({
        taskId: id,
        userId,
        action: 'ADD_DEPENDENCY',
        description: `添加了前置依赖任务 "${dependsOn.title}"`,
        newValue: JSON.stringify({ dependsOnId, title: dependsOn.title }),
      });

      // Return the updated task with full dependencies/dependents
      const updatedTask = await prisma.task.findUnique({
        where: { id },
        include: taskInclude,
      });

      return reply.status(201).send(updatedTask);
    },
  );

  // DELETE /:id/dependencies/:dependsOnId —— 删除任务依赖
  app.delete(
    '/:id/dependencies/:dependsOnId',
    {
      ...auth,
      schema: { params: dependencyParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id, dependsOnId } = request.params as { id: string; dependsOnId: string };

      const dependency = await prisma.taskDependency.findUnique({
        where: {
          taskId_dependsOnId: {
            taskId: id,
            dependsOnId,
          },
        },
      });

      if (!dependency) {
        throw new AppError('Dependency not found', 404);
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
        userId,
        action: 'REMOVE_DEPENDENCY',
        description: `移除了前置依赖任务 "${dependsOnTitle}"`,
        oldValue: JSON.stringify({ dependsOnId, title: dependsOnTitle }),
      });

      // Return updated task
      const updatedTask = await prisma.task.findUnique({
        where: { id },
        include: taskInclude,
      });

      return reply.send(updatedTask);
    },
  );

  // POST /upload-image —— 上传任务相关的图片/附件
  app.post(
    '/upload-image',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'task_image', maxCount: 1 }])],
    },
    async (request, reply) => {
      const file = (request as FastifyRequest & { file?: UploadedFile }).file;
      if (!file) {
        throw new AppError('没有上传文件', 400);
      }
      if (!file.url) {
        throw new Error(`文件上传失败：未获取到云存储地址 (field=${file.fieldname})`);
      }
      return reply.send({ url: file.url });
    },
  );
};
