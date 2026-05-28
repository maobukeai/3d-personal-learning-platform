import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { checkProjectQuota } from '../utils/quota';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';
import {
  AIChatMessage as ServiceAIChatMessage,
  callLLM,
  streamLLMChat,
} from '../services/ai.service';
import { getAIModelById, settingsService } from '../services/settings.service';
import { parseBaiduNetdiskLink } from '../utils/baiduNetdisk';
import { hasPromptInjection } from '../utils/security';
import {
  PROJECT_GENERATION_PROMPT,
  AI_SPRITE_CHAT_PROMPT,
  BAIDU_NETDISK_ANALYSIS_PROMPT,
  getCoPlanChatPrompt,
} from '../config/prompts';

type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_AI_CHAT_MESSAGES = 12;
const MAX_AI_CHAT_MESSAGE_CHARS = 12000;
const MAX_AI_CHAT_TOTAL_CHARS = 36000;
const MAX_AI_HISTORY_ITEMS = 80;

const redactSensitiveContent = (content: string): string =>
  content
    .replace(
      /\b(?:api[_-]?key|token|secret|password|passwd|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;]+)/gi,
      (match) => match.replace(/([:=]\s*)([^\s,;]+)/, '$1[已脱敏]'),
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [已脱敏]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱已脱敏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已脱敏]');

const normalizeAiChatMessages = (messages: unknown): AiChatMessage[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-MAX_AI_CHAT_MESSAGES)
    .map((message) => {
      if (!message || typeof message !== 'object') return null;
      const raw = message as Record<string, unknown>;
      const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null;
      const content = typeof raw.content === 'string' ? raw.content.trim() : '';

      if (!role || !content) return null;

      return {
        role,
        content:
          content.length > MAX_AI_CHAT_MESSAGE_CHARS
            ? content.slice(0, MAX_AI_CHAT_MESSAGE_CHARS)
            : content,
      };
    })
    .filter((message): message is AiChatMessage => Boolean(message));
};

const cleanPromptContextValue = (value: unknown, maxLength = 120): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const buildAiChatContextPrompt = (context: unknown, req: AuthRequest): string => {
  if (!context || typeof context !== 'object') return '';

  const requestContext = context as Record<string, unknown>;
  const path = cleanPromptContextValue(requestContext.path, 240);
  const title = cleanPromptContextValue(requestContext.title);
  if (!path) return '';

  const lines = [
    '【当前可信页面上下文】',
    `页面路径: ${path}`,
    `页面标题: ${title || '未提供'}`,
    `用户角色: ${req.user?.role || 'GUEST'}`,
    `工作空间: ${req.workspaceId || '未认证访客'}`,
  ];

  if (path.includes('/assets/') || path.includes('/models') || path.includes('/my-works')) {
    lines.push(
      '场景: 3D 资产查看/管理。',
      '回答重点: WebGL/Three.js 渲染、材质贴图、光照、相机控制、格式兼容、性能优化和资产质量检查。',
    );
  } else if (
    path.includes('/work') ||
    path.includes('/tasks') ||
    path.includes('/team-tasks') ||
    path.includes('/project/')
  ) {
    lines.push(
      '场景: 项目协作或任务看板。',
      '回答重点: 任务拆解、优先级、依赖关系、风险控制、验收标准、团队协作节奏。',
    );
  } else if (path.includes('/academy') || path.includes('/course') || path.includes('/lesson')) {
    lines.push('场景: 课程学习。', '回答重点: 知识点解释、练习设计、阶段复盘、学习效果验证。');
  } else if (path.includes('/notes') || path.includes('/roadmaps')) {
    lines.push(
      '场景: 知识沉淀或学习路线。',
      '回答重点: 笔记结构、复习策略、路线里程碑、可衡量学习成果。',
    );
  } else if (path.includes('/admin')) {
    lines.push(
      '场景: 管理后台。',
      '回答重点: 配置安全、权限边界、审计、运营治理。不要暴露或要求用户提供密钥明文。',
    );
  }

  return lines.join('\n');
};

const checkTeamProjectPermission = async (
  userId: string,
  workspaceId: string | undefined,
): Promise<boolean> => {
  if (!workspaceId) {
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'ADMIN') {
    return true;
  }

  const team = await prisma.team.findUnique({
    where: { id: workspaceId },
    select: { type: true, ownerId: true },
  });

  if (!team) {
    return true;
  }

  if (team.type === 'PERSONAL') {
    return team.ownerId === userId;
  }

  const member = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: workspaceId,
        userId: userId,
      },
    },
    select: { role: true },
  });

  return !!member && (member.role === 'OWNER' || member.role === 'ADMIN');
};

export const getAllProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.ProjectWhereInput = {
      teamId: req.workspaceId || null,
      OR: [
        { visibility: 'PUBLIC' },
        {
          members: {
            some: { userId: req.userId as string },
          },
        },
      ],
    };
    const projects = await prisma.project.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: { name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const {
    title,
    description,
    dueDate,
    color,
    tags,
    visibility,
    maxMembers,
    memberIds,
    inviteUserIds,
  } = req.body;
  const userId = req.userId as string;

  if (!title) {
    return next(new AppError('Project title is required', 400));
  }

  try {
    // Verify team workspace project creation permissions
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中创建项目', 403));
    }

    // Check quota
    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || 'Project quota exceeded', 403));
    }

    const membersData: Prisma.ProjectMemberCreateWithoutProjectInput[] = [
      {
        user: { connect: { id: userId } },
        role: 'OWNER',
      },
    ];

    if (memberIds && Array.isArray(memberIds)) {
      const existingMemberIds = new Set([userId]);
      for (const uid of memberIds) {
        if (uid && typeof uid === 'string' && !existingMemberIds.has(uid)) {
          membersData.push({
            user: { connect: { id: uid } },
            role: 'MEMBER',
          });
          existingMemberIds.add(uid);
        }
      }
    }

    const project = await prisma.project.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        color: color || 'bg-accent',
        tags,
        visibility: visibility || 'PRIVATE',
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : 10,
        teamId: req.workspaceId || null,
        members: {
          create: membersData,
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Created project: ${project.title}`,
      newValue: project,
      req,
    });

    if (inviteUserIds && Array.isArray(inviteUserIds) && inviteUserIds.length > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitations = inviteUserIds
        .filter((uid: string) => uid !== req.userId)
        .map((uid: string) => ({
          projectId: project.id,
          inviterId: req.userId as string,
          inviteeId: uid,
          status: 'PENDING',
          expiresAt,
        }));

      if (invitations.length > 0) {
        await prisma.projectInvitation.createMany({ data: invitations });

        // Retrieve the created invitations to get their auto-generated IDs
        const createdInvitations = await prisma.projectInvitation.findMany({
          where: {
            projectId: project.id,
            inviteeId: { in: inviteUserIds.filter((uid: string) => uid !== req.userId) },
            status: 'PENDING',
          },
        });

        await createNotificationBatch(
          createdInvitations.map((inv) => ({
            type: 'PROJECT_INVITE',
            title: '项目邀请',
            content: `你被邀请加入项目「${title}」`,
            userId: inv.inviteeId,
            link: `/projects/${project.id}?invitationId=${inv.id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    }

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, progress, status, dueDate, color, tags, visibility, maxMembers } =
    req.body;
  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
    });
    if (!project) {
      return next(new AppError('Project not found in this workspace', 404));
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string, role: 'OWNER' },
    });
    if (!member) {
      return next(new AppError('Only owners can update project settings', 403));
    }

    const updateData: Prisma.ProjectUpdateInput = {
      title,
      description,
      status,
      color,
      tags,
      visibility,
      maxMembers: maxMembers ? parseInt(maxMembers, 10) : undefined,
    };

    if (progress !== undefined) updateData.progress = parseInt(progress, 10);
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Updated project: ${updated.title}`,
      oldValue: project,
      newValue: updated,
      req,
    });

    // Notify other project members about the update
    try {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== req.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'SYSTEM',
            title: '项目变更通知',
            content: `你参与的项目「${updated.title}」有新的更新或内容变更。`,
            userId: uid,
            link: `/projects/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      console.error('Failed to send project update notifications:', notifErr);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
          },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
            participants: {
              select: {
                id: true,
                userId: true,
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        discussions: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            reactions: {
              include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitee: { select: { id: true, name: true, avatarUrl: true, email: true } },
          },
        },
        roadmap: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!project || (project.teamId || null) !== (req.workspaceId || null)) {
      return next(new AppError('Project not found', 404));
    }

    const isMember = project.members.some((m) => m.userId === req.userId);
    if (project.visibility !== 'PUBLIC' && !isMember) {
      return next(new AppError('Access denied: private project', 403));
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
};

export const joinProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId as string;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!project || (project.teamId || null) !== (req.workspaceId || null)) {
      return next(new AppError('Project not found', 404));
    }

    if (project.visibility !== 'PUBLIC' || project.status === 'COMPLETED') {
      return next(new AppError('Cannot join this project', 400));
    }

    if (project.members.length >= project.maxMembers) {
      return next(new AppError('Project is full', 400));
    }

    const existingMember = project.members.find((m) => m.userId === userId);
    if (existingMember) {
      return next(new AppError('Already a member', 400));
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId,
        role: 'MEMBER',
      },
    });

    // Notify project owner
    try {
      const projectOwner = project.members.find((m) => m.role === 'OWNER');
      if (projectOwner && projectOwner.userId !== userId) {
        await createNotification({
          type: 'SYSTEM',
          title: '成员加入项目通知',
          content: `用户「${req.user?.name || req.user?.email || '新成员'}」加入了你的项目「${project.title}」。`,
          userId: projectOwner.userId,
          link: `/projects/${id}`,
          category: 'TEAM_ACTIVITY' as const,
        });
      }
    } catch (notifErr) {
      console.error('Failed to send project join notification:', notifErr);
    }

    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
};

export const addDiscussion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { content, type, images, fileUrl, fileName, fileSize } = req.body;
  const userId = req.userId as string;

  if (!content) {
    return next(new AppError('Content is required', 400));
  }

  try {
    // 首先检查项目是否在当前工作区
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    // 再检查用户是否是项目成员
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId },
    });

    if (!member) {
      return next(new AppError('Only project members can participate in discussions', 403));
    }

    const discussion = await prisma.projectDiscussion.create({
      data: {
        projectId: id,
        userId,
        content,
        type: type || 'TEXT',
        images: images || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    res.status(201).json(discussion);
  } catch (error) {
    next(error);
  }
};

export const createProjectTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, assigneeId, dueDate, participantIds } = req.body;

  if (!title) {
    return next(new AppError('Task title is required', 400));
  }

  try {
    // 检查项目是否在当前工作区并且用户是项目成员
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
      include: {
        members: {
          where: { userId: req.userId },
        },
      },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    if (!project.members || project.members.length === 0) {
      return next(new AppError('Not authorized to create tasks in this project', 403));
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: 'TODO',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: id,
        assigneeId: assigneeId || null,
        userId: req.userId as string,
        teamId: req.workspaceId || null,
        participants:
          participantIds && Array.isArray(participantIds) && participantIds.length > 0
            ? {
                create: participantIds.map((userId: string) => ({ userId })),
              }
            : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    await recalcProjectProgress(id);

    // Notify other project members about the new task
    try {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== req.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'TASK',
            title: '任务看板变更通知',
            content: `项目看板中新增了任务「${task.title}」。`,
            userId: uid,
            link: `/projects/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      console.error('Failed to send task creation notifications:', notifErr);
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const batchCreateProjectTasks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.id as string;
  const { tasks } = req.body;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return next(new AppError('Tasks array is required', 400));
  }

  try {
    // 检查项目是否在当前工作区并且用户是项目成员
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
      include: {
        members: {
          where: { userId: req.userId },
        },
      },
    });

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    if (!project.members || project.members.length === 0) {
      return next(new AppError('Not authorized to create tasks in this project', 403));
    }

    const createdTasks = [];
    for (const t of tasks) {
      if (!t.title) continue;

      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description || null,
          status: 'TODO',
          priority: t.priority || 'MEDIUM',
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          projectId: id,
          assigneeId: t.assigneeId || null,
          userId: req.userId as string,
          teamId: req.workspaceId || null,
          participants:
            t.participantIds && Array.isArray(t.participantIds) && t.participantIds.length > 0
              ? {
                  create: t.participantIds.map((userId: string) => ({ userId })),
                }
              : undefined,
        },
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          participants: {
            select: {
              id: true,
              userId: true,
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      });
      createdTasks.push(task);
    }

    await recalcProjectProgress(id);

    // Notify other project members about batch tasks creation
    try {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== req.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'TASK',
            title: '任务看板变更通知',
            content: `项目看板中批量添加了 ${createdTasks.length} 个新任务。`,
            userId: uid,
            link: `/projects/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      console.error('Failed to send batch task creation notifications:', notifErr);
    }

    res.status(201).json(createdTasks);
  } catch (error) {
    next(error);
  }
};

async function recalcProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true },
  });
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  await prisma.project.update({
    where: { id: projectId },
    data: { progress },
  });
  return progress;
}

export const updateProjectTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const taskId = req.params.taskId as string;
  const { title, description, status, assigneeId, dueDate } = req.body;

  try {
    // 检查任务是否在当前工作区并且当前用户是项目成员
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        teamId: req.workspaceId || null,
      },
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

    if (!existingTask) {
      return next(new AppError('Task not found', 404));
    }

    // 检查用户是否是项目成员
    if (!existingTask.project || existingTask.project.members.length === 0) {
      return next(new AppError('Not authorized to update this task', 403));
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    // Notify other project members about task update
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
        console.error('Failed to send task update notifications:', notifErr);
      }
    }

    if (status !== undefined && task.projectId) {
      const progress = await recalcProjectProgress(task.projectId);
      res.json({ ...task, _projectProgress: progress });
    } else {
      res.json(task);
    }
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { deleteTasks, deleteRoadmap } = req.query;
  const shouldDeleteTasks = deleteTasks === 'true';
  const shouldDeleteRoadmap = deleteRoadmap === 'true';

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
    });
    if (!project) {
      return next(new AppError('Project not found in this workspace', 404));
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string, role: 'OWNER' },
    });
    if (!member) {
      return next(new AppError('Only owners can delete projects', 403));
    }

    // Fetch members before deletion
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId: id },
      select: { userId: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Handle Tasks
      if (!shouldDeleteTasks) {
        // Disconnect tasks from the project so they are NOT cascade deleted by database
        await tx.task.updateMany({
          where: { projectId: id },
          data: { projectId: null },
        });
      } else {
        // Explicitly delete tasks
        await tx.task.deleteMany({
          where: { projectId: id },
        });
      }

      // 2. Handle Roadmap
      if (shouldDeleteRoadmap) {
        // Find and delete the associated roadmap
        const associatedRoadmap = await tx.roadmap.findFirst({
          where: { projectId: id },
        });
        if (associatedRoadmap) {
          await tx.roadmap.delete({
            where: { id: associatedRoadmap.id },
          });
        }
      } else {
        // Keep the roadmap but disconnect it from this project so it remains a custom roadmap
        await tx.roadmap.updateMany({
          where: { projectId: id },
          data: { projectId: null },
        });
      }

      // 3. Delete Project itself
      await tx.project.delete({ where: { id } });
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Deleted project: ${project.title} (Delete Tasks: ${shouldDeleteTasks}, Delete Roadmap: ${shouldDeleteRoadmap})`,
      oldValue: project,
      req,
    });

    // Notify other project members about the deletion
    try {
      const targetUserIds = projectMembers.map((m) => m.userId).filter((uid) => uid !== req.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'SYSTEM',
            title: '项目删除通知',
            content: `你参与的项目「${project.title}」已被管理员或创建人删除。`,
            userId: uid,
            link: '/projects',
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      console.error('Failed to send project deletion notifications:', notifErr);
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const inviteToProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { userIds } = req.body;
  const inviterId = req.userId as string;

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
      include: { members: true },
    });
    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    const inviterMember = project.members.find((m) => m.userId === inviterId);
    if (!inviterMember) {
      return next(new AppError('Only project members can invite', 403));
    }

    if (!userIds || !Array.isArray(userIds) || !userIds.length) {
      return next(new AppError('No users specified', 400));
    }

    const existingMemberIds = new Set(project.members.map((m) => m.userId));
    const targetUserIds = userIds.filter((uid: string) => !existingMemberIds.has(uid));

    if (targetUserIds.length > 0) {
      // 1. Delete old PENDING notifications of type PROJECT_INVITE for this project and users
      await prisma.notification.deleteMany({
        where: {
          userId: { in: targetUserIds },
          type: 'PROJECT_INVITE',
          link: {
            contains: `/projects/${id}`,
          },
        },
      });

      // 2. Delete existing PENDING invitations for these userIds in this project
      // to allow resending fresh invitations
      await prisma.projectInvitation.deleteMany({
        where: {
          projectId: id,
          inviteeId: { in: targetUserIds },
          status: 'PENDING',
        },
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = userIds
      .filter((uid: string) => uid !== inviterId && !existingMemberIds.has(uid))
      .map((uid: string) => ({
        projectId: id,
        inviterId,
        inviteeId: uid,
        status: 'PENDING',
        expiresAt,
      }));

    if (invitations.length === 0) {
      return next(new AppError('所有用户已是项目成员', 400));
    }

    await prisma.projectInvitation.createMany({ data: invitations });

    // Retrieve the created invitations to get their auto-generated IDs
    const createdInvitations = await prisma.projectInvitation.findMany({
      where: {
        projectId: id,
        inviteeId: { in: invitations.map((inv) => inv.inviteeId) },
        status: 'PENDING',
      },
    });

    await createNotificationBatch(
      createdInvitations.map((inv) => ({
        type: 'PROJECT_INVITE',
        title: '项目邀请',
        content: `你被邀请加入项目「${project.title}」`,
        userId: inv.inviteeId,
        link: `/projects/${id}?invitationId=${inv.id}`,
        category: 'TEAM_ACTIVITY' as const,
      })),
    );

    res.status(201).json({ invited: invitations.length });
  } catch (error) {
    next(error);
  }
};

export const acceptProjectInvitation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const invitationId = req.params.invitationId as string;
  const userId = req.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      return next(new AppError('Invitation not found', 404));
    }
    if (invitation.inviteeId !== userId) {
      return next(new AppError('Not your invitation', 403));
    }
    if (invitation.status !== 'PENDING') {
      return next(new AppError('Invitation already processed', 400));
    }
    if (invitation.expiresAt < new Date()) {
      return next(new AppError('Invitation expired', 400));
    }

    const project = await prisma.project.findUnique({
      where: { id: invitation.projectId },
      include: { members: true },
    });
    if (!project) {
      return next(new AppError('Project not found', 404));
    }
    if (project.members.length >= project.maxMembers) {
      return next(new AppError('Project is full', 400));
    }

    await prisma.$transaction([
      prisma.projectInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: 'MEMBER',
        },
      }),
    ]);

    res.json({ message: 'Invitation accepted' });
  } catch (error) {
    next(error);
  }
};

export const rejectProjectInvitation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const invitationId = req.params.invitationId as string;
  const userId = req.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      return next(new AppError('Invitation not found', 404));
    }
    if (invitation.inviteeId !== userId) {
      return next(new AppError('Not your invitation', 403));
    }
    if (invitation.status !== 'PENDING') {
      return next(new AppError('Invitation already processed', 400));
    }

    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: 'REJECTED' },
    });

    res.json({ message: 'Invitation rejected' });
  } catch (error) {
    next(error);
  }
};

export const addDiscussionReaction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const discussionId = req.params.discussionId as string;
  const { emoji } = req.body;
  const userId = req.userId as string;

  if (!emoji) {
    return next(new AppError('Emoji is required', 400));
  }

  try {
    // 检查讨论是否在当前工作区并且用户是项目成员
    const discussion = await prisma.projectDiscussion.findFirst({
      where: { id: discussionId },
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

    if (!discussion) {
      return next(new AppError('Discussion not found', 404));
    }

    // 检查讨论所在的项目是否在当前工作区
    if ((discussion.project.teamId || null) !== (req.workspaceId || null)) {
      return next(new AppError('Discussion not found', 404));
    }

    // 检查用户是否是项目成员
    if (!discussion.project.members || discussion.project.members.length === 0) {
      return next(new AppError('Not authorized to add reactions', 403));
    }

    const existing = await prisma.projectDiscussionReaction.findUnique({
      where: { discussionId_userId_emoji: { discussionId, userId, emoji } },
    });

    if (existing) {
      await prisma.projectDiscussionReaction.delete({ where: { id: existing.id } });
      res.json({ removed: true });
    } else {
      const reaction = await prisma.projectDiscussionReaction.create({
        data: { discussionId, userId, emoji },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      res.status(201).json(reaction);
    }
  } catch (error) {
    next(error);
  }
};

export const removeProjectMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { userId: targetUserId } = req.body;
  const requesterId = req.userId as string;

  if (!targetUserId) {
    return next(new AppError('Target userId is required', 400));
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId || null },
      include: { members: true },
    });
    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    const requester = project.members.find((m) => m.userId === requesterId);
    if (!requester || requester.role !== 'OWNER') {
      return next(new AppError('Only owners can remove members', 403));
    }

    const target = project.members.find((m) => m.userId === targetUserId);
    if (!target) {
      return next(new AppError('Member not found', 404));
    }
    if (target.role === 'OWNER') {
      return next(new AppError('Cannot remove owner', 400));
    }

    await prisma.projectMember.delete({ where: { id: target.id } });

    // Notify removed user
    try {
      await createNotification({
        type: 'SYSTEM',
        title: '被移出项目通知',
        content: `你已被管理员移出项目「${project.title}」。`,
        userId: targetUserId,
        link: '/projects',
        category: 'TEAM_ACTIVITY' as const,
      });
    } catch (notifErr) {
      console.error('Failed to send project removal notification:', notifErr);
    }

    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
};

interface ParsedProject {
  title: string;
  description: string;
  tags?: string;
  dueDate?: Date | null;
  color?: string;
  tasks: ParsedTask[];
  roadmap?: ParsedRoadmap;
}

interface ParsedTask {
  title: string;
  description?: string;
  priority: string;
  dueDate?: Date | null;
  subtasks?: { id: string; text: string; done: boolean }[];
}

interface ParsedRoadmap {
  title: string;
  description?: string;
  steps: ParsedRoadmapStep[];
}

interface ParsedRoadmapStep {
  title: string;
  description?: string;
  subtasks: { id: string; text: string; done: boolean }[];
  order: number;
}

export function parseProjectImportText(text: string): ParsedProject {
  const lines = text.split(/\r?\n/);

  const parsed: ParsedProject = {
    title: '未命名导入项目',
    description: '',
    tasks: [],
  };

  let currentSection: 'project' | 'tasks' | 'roadmap' | null = 'project';
  let currentRoadmapStep: ParsedRoadmapStep | null = null;
  let currentTask: ParsedTask | null = null;
  const roadmapSteps: ParsedRoadmapStep[] = [];
  let stepOrder = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    if (line.startsWith('# ')) {
      parsed.title = line
        .substring(2)
        .replace(/^(?:项目|PROJECT)\s*[:|：]\s*/i, '')
        .trim();
      currentSection = 'project';
      continue;
    } else if (line.startsWith('## ')) {
      const secName = line.substring(3).trim();
      if (
        secName.includes('任务') ||
        secName.includes('看板') ||
        secName.toLowerCase().includes('task') ||
        secName.toLowerCase().includes('kanban')
      ) {
        currentSection = 'tasks';
      } else if (
        secName.includes('学习') ||
        secName.includes('路线') ||
        secName.toLowerCase().includes('roadmap') ||
        secName.toLowerCase().includes('learning')
      ) {
        currentSection = 'roadmap';
        const cleanTitle = secName
          .replace(
            /^(?:学习路线|学习规划|学习大纲|学习路径|学习计划|Roadmap|ROADMAP|Learning\s*Roadmap|Learning\s*Plan)\s*[:|：|\-|\s]\s*/i,
            '',
          )
          .trim();
        const finalTitle =
          cleanTitle &&
          cleanTitle !== '学习路线' &&
          cleanTitle !== '学习规划' &&
          cleanTitle !== 'Roadmap'
            ? cleanTitle
            : `学习路线 - ${parsed.title}`;
        parsed.roadmap = {
          title: finalTitle,
          description: `针对项目「${parsed.title}」的专属学习路线`,
          steps: [],
        };
      } else {
        currentSection = null;
      }
      continue;
    }

    if (currentSection === 'project') {
      if (line.startsWith('描述') || line.startsWith('desc') || line.startsWith('Description')) {
        parsed.description = line.replace(/^(?:描述|desc|Description)\s*[:|：]\s*/i, '').trim();
      } else if (line.startsWith('标签') || line.startsWith('tags') || line.startsWith('Tags')) {
        parsed.tags = line.replace(/^(?:标签|tags|Tags)\s*[:|：]\s*/i, '').trim();
      } else if (line.startsWith('截止') || line.startsWith('due') || line.startsWith('Due')) {
        const dateStr = line.replace(/^(?:截止日期|截止|due|DueDate)\s*[:|：]\s*/i, '').trim();
        parsed.dueDate = dateStr ? new Date(dateStr) : null;
      } else if (line.startsWith('颜色') || line.startsWith('color') || line.startsWith('Color')) {
        parsed.color = line.replace(/^(?:颜色|color|Color)\s*[:|：]\s*/i, '').trim();
      } else {
        if (parsed.description) {
          parsed.description += '\n' + line;
        } else {
          parsed.description = line;
        }
      }
    } else if (currentSection === 'tasks') {
      if (line.startsWith('- [ ]') || line.startsWith('- [x]') || line.startsWith('- ')) {
        const leadingSpaces = rawLine.match(/^\s*/)?.[0].length || 0;
        const content = line
          .replace(/^-\s*\[\s*[ x]?\s*\]\s*/, '')
          .replace(/^-\s*/, '')
          .trim();
        if (!content) continue;

        if (leadingSpaces >= 2 && currentTask) {
          currentTask.subtasks = currentTask.subtasks || [];
          currentTask.subtasks.push({
            id: Math.random().toString(36).substring(2, 9),
            text: content,
            done: false,
          });
          continue;
        }

        const parts = content.split('|');
        const taskTitle = (parts[0] || '').trim();
        if (!taskTitle) continue;

        let priority = 'MEDIUM';
        let dueDate: Date | null = null;
        let description = '';

        for (const rawPart of parts.slice(1)) {
          const part = rawPart.trim();
          if (part.startsWith('优先级') || part.toLowerCase().startsWith('priority')) {
            const pVal = part.replace(/^(?:优先级|priority)\s*[:|：]\s*/i, '').trim();
            if (pVal.includes('低') || pVal.toLowerCase() === 'low') priority = 'LOW';
            else if (pVal.includes('高') || pVal.toLowerCase() === 'high') priority = 'HIGH';
            else if (pVal.includes('紧急') || pVal.toLowerCase() === 'urgent') priority = 'URGENT';
            else priority = 'MEDIUM';
          } else if (
            part.startsWith('截止') ||
            part.toLowerCase().startsWith('due') ||
            part.toLowerCase().startsWith('date')
          ) {
            const dVal = part.replace(/^(?:截止|due|date)\s*[:|：]\s*/i, '').trim();
            dueDate = dVal ? new Date(dVal) : null;
          } else if (part.startsWith('描述') || part.toLowerCase().startsWith('desc')) {
            description = part.replace(/^(?:描述|desc)\s*[:|：]\s*/i, '').trim();
          }
        }

        currentTask = {
          title: taskTitle,
          description: description || undefined,
          priority,
          dueDate,
          subtasks: [],
        };
        parsed.tasks.push(currentTask);
      }
    } else if (currentSection === 'roadmap' && parsed.roadmap) {
      const clean = line
        .replace(/^[-*\s\d.\[\]xX]*\s*/, '') // Remove list bullets, numbers, spaces, and checkboxes
        .replace(/^\*\*?/, '') // Remove leading bold/italic stars
        .trim();
      const isStepHeader =
        line.startsWith('### ') ||
        line.startsWith('#### ') ||
        /^(?:阶段|步骤|Step|Phase|Part)\s*[一二三四五六七八九十\d]/i.test(clean) ||
        /^第\s*[一二三四五六七八九十\d]+\s*(?:阶段|步骤|Step|Phase|Part)/i.test(clean);

      if (isStepHeader) {
        if (currentRoadmapStep) {
          roadmapSteps.push(currentRoadmapStep);
        }

        const stepTitle = line
          .replace(/^(?:###|####)\s*/, '')
          .replace(/^[-*\s\d.\[\]xX]*\s*/, '')
          .replace(/^\*\*?/, '')
          .replace(/\*\*?$/, '')
          .trim();

        currentRoadmapStep = {
          title: stepTitle,
          description: '',
          subtasks: [],
          order: stepOrder++,
        };
      } else if (currentRoadmapStep) {
        if (line.startsWith('- [ ]') || line.startsWith('- [x]') || line.startsWith('- ')) {
          const subtaskText = line
            .replace(/^-\s*\[\s*[ x]?\s*\]\s*/, '')
            .replace(/^-\s*/, '')
            .trim();
          if (subtaskText) {
            currentRoadmapStep.subtasks.push({
              id: Math.random().toString(36).substring(2, 9),
              text: subtaskText,
              done: false,
            });
          }
        } else if (
          line.startsWith('描述') ||
          line.startsWith('desc') ||
          line.startsWith('Description')
        ) {
          currentRoadmapStep.description = line
            .replace(/^(?:描述|desc|Description)\s*[:|：]\s*/i, '')
            .trim();
        } else {
          if (currentRoadmapStep.description) {
            currentRoadmapStep.description += '\n' + line;
          } else {
            currentRoadmapStep.description = line;
          }
        }
      }
    }
  }

  if (currentRoadmapStep) {
    roadmapSteps.push(currentRoadmapStep);
  }

  if (parsed.roadmap) {
    parsed.roadmap.steps = roadmapSteps;
  }

  return parsed;
}

export const importProjectFromText = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { text } = req.body;
  const userId = req.userId as string;

  if (!text) {
    return next(new AppError('导入内容不能为空', 400));
  }

  try {
    // Verify team workspace project creation permissions
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中使用导入解析功能', 403));
    }

    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || '项目配额已满，无法导入新项目', 403));
    }

    const parsed = parseProjectImportText(text);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title: parsed.title,
          description: parsed.description || null,
          dueDate: parsed.dueDate || null,
          color: parsed.color || 'bg-accent',
          tags: parsed.tags || null,
          visibility: 'PRIVATE',
          maxMembers: 10,
          teamId: req.workspaceId || null,
          members: {
            create: [
              {
                userId,
                role: 'OWNER',
              },
            ],
          },
        },
      });

      const createdTasks = [];
      for (const t of parsed.tasks) {
        const task = await tx.task.create({
          data: {
            title: t.title,
            description: t.description || null,
            status: 'TODO',
            priority: t.priority,
            dueDate: t.dueDate || null,
            projectId: project.id,
            userId,
            teamId: req.workspaceId || null,
            subtasks: t.subtasks && t.subtasks.length > 0 ? JSON.stringify(t.subtasks) : undefined,
          },
        });
        createdTasks.push(task);
      }

      let roadmap = null;
      if (parsed.roadmap && parsed.roadmap.steps.length > 0) {
        roadmap = await tx.roadmap.create({
          data: {
            title: parsed.roadmap.title,
            description: parsed.roadmap.description || '',
            creatorId: userId,
            projectId: project.id,
          },
        });

        for (const step of parsed.roadmap.steps) {
          await tx.roadmapStep.create({
            data: {
              roadmapId: roadmap.id,
              title: step.title,
              description: step.description || '',
              subtasks: step.subtasks.length > 0 ? JSON.stringify(step.subtasks) : null,
              order: step.order,
            },
          });
        }
      }

      return { project, tasksCount: createdTasks.length, roadmap };
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `导入解析项目: ${result.project.title} (包含看板任务数: ${result.tasksCount})`,
      newValue: result.project,
      req,
    });

    res.status(201).json({
      success: true,
      message: '项目及关联的看板任务、学习路线已成功解析导入！',
      project: result.project,
      roadmap: result.roadmap,
      tasksCount: result.tasksCount,
    });
  } catch (error) {
    next(error);
  }
};

export const aiGenerateProjectText = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return next(new AppError('输入设想不能为空', 400));
  }

  const userId = req.userId as string;

  try {
    // 1. Verify team workspace project creation permissions first
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    // 2. Scan input for security threats and injections
    if (hasPromptInjection(prompt)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }

    const generatedMarkdown = await callLLM(prompt.trim(), PROJECT_GENERATION_PROMPT);

    res.json({
      success: true,
      data: generatedMarkdown,
    });
  } catch (error) {
    next(error);
  }
};

export const aiChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { messages, context, modelId } = req.body;
  const normalizedMessages = normalizeAiChatMessages(messages);

  if (normalizedMessages.length === 0) {
    return next(new AppError('对话内容不能为空', 400));
  }

  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return next(new AppError('最后一条对话内容必须来自用户', 400));
  }

  for (const m of normalizedMessages) {
    const tokenCount = Math.round((m.content?.length || 0) * 0.45);
    if (m.role === 'user' && tokenCount > 5400) {
      return next(new AppError('单个消息长度过长，请精简后再发送。', 400));
    }
    if (m.role === 'user' && hasPromptInjection(m.content)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }
  }

  const totalChars = normalizedMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_AI_CHAT_TOTAL_CHARS) {
    return next(new AppError('对话上下文过长，请清空历史或精简后再发送。', 400));
  }

  const contextPrompt = buildAiChatContextPrompt(context, req);
  const systemPrompt = contextPrompt
    ? `${AI_SPRITE_CHAT_PROMPT}\n\n${contextPrompt}`
    : AI_SPRITE_CHAT_PROMPT;

  const settings = await settingsService.getAll();
  const selectedModel = getAIModelById(
    settings,
    typeof modelId === 'string' ? modelId.trim() : undefined,
  );
  if (!selectedModel || !selectedModel.enabled) {
    return next(new AppError('当前没有可用的 AI 聊天模型，请联系管理员配置。', 503));
  }

  // Save a privacy-preserving version of the user message to database if authenticated.
  if (req.userId) {
    try {
      await prisma.aiMessage.create({
        data: {
          userId: req.userId,
          role: 'user',
          content: redactSensitiveContent(lastMessage.content),
        },
      });
    } catch (dbErr) {
      console.error('[AI Chat] Failed to save user message to DB:', dbErr);
    }
  }

  try {
    await streamLLMChat(
      normalizedMessages,
      systemPrompt,
      res,
      {
        AI_IMPORT_ENABLED: true,
        AI_PROVIDER: selectedModel.provider,
        AI_API_KEY: selectedModel.apiKey || settings.AI_API_KEY,
        AI_API_ENDPOINT: selectedModel.endpoint || settings.AI_API_ENDPOINT,
        AI_MODEL_NAME: selectedModel.modelName,
      },
      req.userId,
    );
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
    } else {
      next(error);
    }
  }
};

export const getAiChatHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    const history = await prisma.aiMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_AI_HISTORY_ITEMS,
    });
    const orderedHistory = history.reverse();
    res.json({
      success: true,
      data: orderedHistory.map((h) => ({
        role: h.role,
        content: h.content,
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const clearAiChatHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  try {
    await prisma.aiMessage.deleteMany({
      where: { userId },
    });
    res.json({
      success: true,
      message: '聊天历史记录已清除',
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAiChatImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new AppError('请选择要上传的图片', 400));
  }
  try {
    const fileUrl = `/uploads/ai/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      name: req.file.originalname,
    });
  } catch (error) {
    next(error);
  }
};

export const parseNetdiskLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { url, password } = req.body;
  if (!url) {
    return next(new AppError('链接不能为空', 400));
  }

  const userId = req.userId as string;

  try {
    // 1. Verify team workspace permissions first
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    // 2. Validate input and check for prompt injection
    if (hasPromptInjection(url) || hasPromptInjection(password)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }

    // 3. Pre-validate that the URL is actually a Baidu Netdisk share link.
    // We check BEFORE any scraping or AI fallback to prevent AI hallucination on arbitrary URLs.
    const urlTrimmed = url.trim();
    const isBaiduNetdiskUrl =
      /pan\.baidu\.com/i.test(urlTrimmed) &&
      (urlTrimmed.includes('/s/') || urlTrimmed.includes('surl='));
    if (!isBaiduNetdiskUrl) {
      return next(
        new AppError(
          '链接格式不正确。请输入有效的百度网盘分享链接（如 https://pan.baidu.com/s/1xxxxx 或包含 surl= 参数的链接）。',
          400,
        ),
      );
    }

    let parsedData;
    let isFallback = false;

    try {
      // 1. Attempt to fetch actual shared directory contents
      parsedData = await parseBaiduNetdiskLink(url, password);
    } catch (err: any) {
      console.warn(
        'Baidu Netdisk scraping failed. Falling back to LLM simulation. Reason:',
        err.message,
      );
      isFallback = true;

      // 2. Fallback to AI-reconstructed outline
      const userPrompt = `链接：${url}\n密码：${password || '无'}`;
      const aiResponse = await callLLM(userPrompt, BAIDU_NETDISK_ANALYSIS_PROMPT);

      // Clean up AI response
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      try {
        parsedData = JSON.parse(cleanedResponse);
      } catch (parseErr) {
        console.error('Failed to parse AI fallback response as JSON. Raw response:', aiResponse);
        // Fallback to a default structure if parsing fails
        parsedData = {
          title: '百度网盘导入项目',
          directories: [
            {
              name: '01-基础概念与环境搭建',
              files: ['1.1 课程介绍与最终效果展示.mp4', '1.2 Vite与Three.js安装.mp4'],
            },
            {
              name: '02-三维核心要素深入',
              files: ['2.1 渲染器与场景配置.mp4', '2.2 正交与透视相机剖析.mp4'],
            },
          ],
        };
      }
    }

    res.json({
      success: true,
      data: {
        ...parsedData,
        isFallback,
      },
    });
  } catch (error) {
    next(error);
  }
};

const formatNetdiskInfoForPrompt = (netdiskInfo: any): string => {
  if (!netdiskInfo) return '无网盘资源数据';
  let result = `项目/课程名称: ${netdiskInfo.title || '未命名'}\n`;
  if (netdiskInfo.directories && Array.isArray(netdiskInfo.directories)) {
    netdiskInfo.directories.slice(0, 30).forEach((dir: any) => {
      result += `- 目录: ${dir.name || '未命名'}\n`;
      if (dir.files && Array.isArray(dir.files)) {
        dir.files.slice(0, 80).forEach((file: string) => {
          result += `  * ${file}\n`;
        });
      }
    });
  }
  return result.slice(0, 30000);
};

export const coPlanChatStream = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { messages, netdiskInfo, currentPlan } = req.body;
  const normalizedMessages = normalizeAiChatMessages(messages);

  if (normalizedMessages.length === 0) {
    return next(new AppError('对话内容不能为空', 400));
  }

  if (Array.isArray(messages) && messages.length > 20) {
    return next(new AppError('对话历史记录过长，请重置对话重新开始。', 400));
  }

  for (const m of normalizedMessages) {
    const tokenCount = Math.round((m.content?.length || 0) * 0.45);
    if (m.role === 'user' && tokenCount > 2000) {
      return next(new AppError('单个消息长度不能超过 2000 tokens。', 400));
    }
    if (m.role === 'user' && hasPromptInjection(m.content)) {
      return next(new AppError('检测到潜在的安全威胁或非法指令注入。', 400));
    }
  }

  const userId = req.userId as string;

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中生成项目规划', 403));
    }

    const isNetdisk = !!netdiskInfo;
    const netdiskText = formatNetdiskInfoForPrompt(netdiskInfo);
    const systemPrompt = getCoPlanChatPrompt(isNetdisk);

    // Prepend resource context as the first user message instead of bloating system instructions
    const contextContent = isNetdisk
      ? `【百度网盘资源文件大纲】\n${netdiskText}\n\n【当前待修改的项目学习计划 JSON】\n${JSON.stringify(currentPlan)}`
      : `【当前待修改的项目学习计划 JSON】\n${JSON.stringify(currentPlan)}`;
    const extendedMessages: ServiceAIChatMessage[] = [
      { role: 'user', content: contextContent.slice(0, 32000) },
      ...normalizedMessages,
    ];

    await streamLLMChat(extendedMessages, systemPrompt, res);
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
    } else {
      next(error);
    }
  }
};

export const importProjectFromJson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  let { plan } = req.body;
  const userId = req.userId as string;

  // Defensive unwrapping if the AI wrapped the schema in a top-level "plan" or "project" key
  if (plan && !plan.title) {
    if (plan.plan && plan.plan.title) {
      plan = plan.plan;
    } else if (plan.project && plan.project.title) {
      plan = plan.project;
    }
  }

  if (!plan || !plan.title) {
    return next(new AppError('项目规划数据无效或缺失标题', 400));
  }

  try {
    const hasPermission = await checkTeamProjectPermission(userId, req.workspaceId);
    if (!hasPermission) {
      return next(new AppError('只有团队创建人或管理员才能在团队中导入项目', 403));
    }

    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || '项目配额已满，无法导入新项目', 403));
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create project
      const project = await tx.project.create({
        data: {
          title: plan.title,
          description: plan.description || null,
          dueDate: plan.dueDate ? new Date(plan.dueDate) : null,
          color: plan.color || 'bg-accent',
          tags: plan.tags || null,
          visibility: 'PRIVATE',
          maxMembers: 10,
          teamId: req.workspaceId || null,
          members: {
            create: [
              {
                userId,
                role: 'OWNER',
              },
            ],
          },
        },
      });

      // 2. Create tasks
      const createdTasks = [];
      if (plan.tasks && Array.isArray(plan.tasks)) {
        for (const t of plan.tasks) {
          const task = await tx.task.create({
            data: {
              title: t.title,
              description: t.description || null,
              status: 'TODO',
              priority: t.priority || 'MEDIUM',
              dueDate: t.dueDate ? new Date(t.dueDate) : null,
              projectId: project.id,
              userId,
              teamId: req.workspaceId || null,
              subtasks: t.subtasks && Array.isArray(t.subtasks) ? JSON.stringify(t.subtasks) : null,
            },
          });
          createdTasks.push(task);
        }
      }

      // 3. Create roadmap
      let roadmap = null;
      if (
        plan.roadmap &&
        plan.roadmap.steps &&
        Array.isArray(plan.roadmap.steps) &&
        plan.roadmap.steps.length > 0
      ) {
        const defaultTitles = ['学习路线', '学习规划', '学习大纲', 'Roadmap', 'ROADMAP'];
        const isGenericTitle =
          !plan.roadmap.title || defaultTitles.includes(plan.roadmap.title.trim());
        const roadmapTitle = isGenericTitle ? `学习路线 - ${plan.title}` : plan.roadmap.title;
        const roadmapDesc = plan.roadmap.description || `针对项目「${plan.title}」的专属学习路线`;

        roadmap = await tx.roadmap.create({
          data: {
            title: roadmapTitle,
            description: roadmapDesc,
            creatorId: userId,
            projectId: project.id,
          },
        });

        for (const step of plan.roadmap.steps) {
          await tx.roadmapStep.create({
            data: {
              roadmapId: roadmap.id,
              title: step.title,
              description: step.description || '',
              subtasks:
                step.subtasks && Array.isArray(step.subtasks)
                  ? JSON.stringify(step.subtasks)
                  : null,
              order: step.order,
            },
          });
        }
      }

      return { project, tasksCount: createdTasks.length, roadmap };
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `导入解析项目JSON: ${result.project.title} (包含看板任务数: ${result.tasksCount})`,
      newValue: result.project,
      req,
    });

    res.status(201).json({
      success: true,
      message: '项目及关联的看板任务、学习路线已成功解析导入！',
      project: result.project,
      roadmap: result.roadmap,
      tasksCount: result.tasksCount,
    });
  } catch (error) {
    next(error);
  }
};
