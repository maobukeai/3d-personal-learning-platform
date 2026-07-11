import type { FastifyReply, FastifyRequest } from 'fastify';

import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { checkProjectQuota } from '../utils/quota';
import {
  auditService,
  AuditAction,
  AuditModule,
  type AuditRequest,
} from '../services/audit.service';
import { AppError } from '../utils/error';
import { logger } from '../utils/logger';
import { TaskStatus } from '../types/task';

export const checkTeamProjectPermission = async (
  userId: string,
  workspaceId: string | undefined,
): Promise<boolean> => {
  if (!workspaceId) {
    return true;
  }

  // Run user + team queries concurrently to reduce total DB round-trips from 3 to 2
  const [user, team] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.team.findUnique({
      where: { id: workspaceId },
      select: { type: true, ownerId: true },
    }),
  ]);

  if (user?.role === 'ADMIN') {
    return true;
  }

  if (!team) {
    return true;
  }

  if (team.type === 'PERSONAL') {
    return team.ownerId === userId;
  }

  // Only query teamMember if the team is not PERSONAL and user is not ADMIN
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

type DiscussionUploadFiles = Partial<Record<'images' | 'message_file', Express.Multer.File[]>>;

const getDiscussionUploadUrl = (file: Express.Multer.File) => {
  const url = (file as unknown as { url?: string }).url;
  if (!url) {
    throw new AppError('文件上传失败，未获取到云存储地址', 400);
  }
  return url;
};

export const uploadDiscussionAttachment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const files = (request as unknown as { files?: DiscussionUploadFiles }).files;
    const file =
      (request as unknown as { file?: Express.Multer.File }).file ??
      files?.images?.[0] ??
      files?.message_file?.[0];

    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    reply.status(201).send({
      url: getDiscussionUploadUrl(file),
      fileName: file.originalname,
      fileSize: file.size / (1024 * 1024),
      type: file.fieldname === 'images' ? 'IMAGE' : 'FILE',
    });
  } catch (error) {
    throw error;
  }
};

export const getAllProjects = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    const where: Prisma.ProjectWhereInput = {
      teamId: request.workspaceId || null,
      OR: [
        { visibility: 'PUBLIC' },
        {
          members: {
            some: { userId: request.userId as string },
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
    reply.send(projects);
  } catch (error) {
    throw error;
  }
};

export const createProject = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
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
  } = request.body as {
    title: string;
    description?: string;
    dueDate?: string;
    color?: string;
    tags?: string;
    visibility?: string;
    maxMembers?: string | number;
    memberIds?: string[];
    inviteUserIds?: string[];
  };
  const userId = request.userId as string;

  if (!title) {
    throw new AppError('Project title is required', 400);
  }

  try {
    // Verify team workspace project creation permissions
    const hasPermission = await checkTeamProjectPermission(userId, request.workspaceId);
    if (!hasPermission) {
      throw new AppError('只有团队创建人或管理员才能在团队中创建项目', 403);
    }

    // Check quota
    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      throw new AppError(quota.message || 'Project quota exceeded', 403);
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
        maxMembers: maxMembers ? parseInt(String(maxMembers), 10) : 10,
        teamId: request.workspaceId || null,
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
      req: request as unknown as AuditRequest,
    });

    if (inviteUserIds && Array.isArray(inviteUserIds) && inviteUserIds.length > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitations = inviteUserIds
        .filter((uid: string) => uid !== request.userId)
        .map((uid: string) => ({
          projectId: project.id,
          inviterId: request.userId as string,
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
            inviteeId: { in: inviteUserIds.filter((uid: string) => uid !== request.userId) },
            status: 'PENDING',
          },
        });

        await createNotificationBatch(
          createdInvitations.map((inv) => ({
            type: 'PROJECT_INVITE',
            title: '项目邀请',
            content: `你被邀请加入项目「${title}」`,
            userId: inv.inviteeId,
            link: `/project/${project.id}?invitationId=${inv.id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    }

    reply.status(201).send(project);
  } catch (error) {
    throw error;
  }
};

export const updateProject = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { title, description, progress, status, dueDate, color, tags, visibility, maxMembers } =
    request.body as {
      title?: string;
      description?: string;
      progress?: string | number;
      status?: string;
      dueDate?: string;
      color?: string;
      tags?: string;
      visibility?: string;
      maxMembers?: string | number;
    };
  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
    });
    if (!project) {
      throw new AppError('Project not found in this workspace', 404);
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: request.userId as string, role: 'OWNER' },
    });
    if (!member) {
      throw new AppError('Only owners can update project settings', 403);
    }

    const updateData: Prisma.ProjectUpdateInput = {
      title,
      description,
      status,
      color,
      tags,
      visibility,
      maxMembers: maxMembers ? parseInt(String(maxMembers), 10) : undefined,
    };

    if (progress !== undefined) updateData.progress = parseInt(String(progress), 10);
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: request.userId as string,
      action: AuditAction.UPDATE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Updated project: ${updated.title}`,
      oldValue: project,
      newValue: updated,
      req: request as unknown as AuditRequest,
    });

    // Notify other project members about the update
    try {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const targetUserIds = projectMembers
        .map((m) => m.userId)
        .filter((uid) => uid !== request.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'SYSTEM',
            title: '项目变更通知',
            content: `你参与的项目「${updated.title}」有新的更新或内容变更。`,
            userId: uid,
            link: `/project/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      logger.error('Failed to send project update notifications:', notifErr);
    }

    reply.send(updated);
  } catch (error) {
    throw error;
  }
};

export const getProjectById = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
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

    if (!project || (project.teamId || null) !== (request.workspaceId || null)) {
      throw new AppError('Project not found', 404);
    }

    const isMember = project.members.some((m) => m.userId === request.userId);
    if (project.visibility !== 'PUBLIC' && !isMember) {
      throw new AppError('Access denied: private project', 403);
    }

    reply.send(project);
  } catch (error) {
    throw error;
  }
};

export const joinProject = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const userId = request.userId as string;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!project || (project.teamId || null) !== (request.workspaceId || null)) {
      throw new AppError('Project not found', 404);
    }

    if (project.visibility !== 'PUBLIC' || project.status === 'COMPLETED') {
      throw new AppError('Cannot join this project', 400);
    }

    if (project.members.length >= project.maxMembers) {
      throw new AppError('Project is full', 400);
    }

    const existingMember = project.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new AppError('Already a member', 400);
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
          content: `用户「${request.user?.name || request.user?.email || '新成员'}」加入了你的项目「${project.title}」。`,
          userId: projectOwner.userId,
          link: `/project/${id}`,
          category: 'TEAM_ACTIVITY' as const,
        });
      }
    } catch (notifErr) {
      logger.error('Failed to send project join notification:', notifErr);
    }

    reply.status(201).send(member);
  } catch (error) {
    throw error;
  }
};

export const addDiscussion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { content, type, images, fileUrl, fileName, fileSize } = request.body as {
    content?: string;
    type?: string;
    images?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  };
  const userId = request.userId as string;

  if (!content) {
    throw new AppError('Content is required', 400);
  }

  try {
    // 首先检查项目是否在当前工作区
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // 再检查用户是否是项目成员
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId },
    });

    if (!member) {
      throw new AppError('Only project members can participate in discussions', 403);
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

    reply.status(201).send(discussion);
  } catch (error) {
    throw error;
  }
};

export const createProjectTask = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { title, description, assigneeId, dueDate, participantIds } = request.body as {
    title?: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    participantIds?: string[];
  };

  if (!title) {
    throw new AppError('Task title is required', 400);
  }

  try {
    // 检查项目是否在当前工作区并且用户是项目成员
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
      include: {
        members: {
          where: { userId: request.userId },
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (!project.members || project.members.length === 0) {
      throw new AppError('Not authorized to create tasks in this project', 403);
    }

    let targetParticipantIds = participantIds || [];
    let targetAssigneeId = assigneeId || null;
    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      targetAssigneeId = participantIds[0] ?? null;
    } else if (targetAssigneeId) {
      targetParticipantIds = [targetAssigneeId];
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: TaskStatus.TODO,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: id,
        assigneeId: targetAssigneeId,
        userId: request.userId as string,
        teamId: request.workspaceId || null,
        participants:
          targetParticipantIds.length > 0
            ? {
                create: targetParticipantIds.map((userId: string) => ({ userId })),
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
      const targetUserIds = projectMembers
        .map((m) => m.userId)
        .filter((uid) => uid !== request.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'TASK',
            title: '任务看板变更通知',
            content: `项目看板中新增了任务「${task.title}」。`,
            userId: uid,
            link: `/project/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      logger.error('Failed to send task creation notifications:', notifErr);
    }

    reply.status(201).send(task);
  } catch (error) {
    throw error;
  }
};

export const batchCreateProjectTasks = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { tasks } = request.body as {
    tasks: Array<{
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
      participantIds?: string[];
    }>;
  };

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    throw new AppError('Tasks array is required', 400);
  }

  try {
    // 检查项目是否在当前工作区并且用户是项目成员
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
      include: {
        members: {
          where: { userId: request.userId },
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (!project.members || project.members.length === 0) {
      throw new AppError('Not authorized to create tasks in this project', 403);
    }

    const tasksData = tasks
      .filter((t: { title?: string }) => t.title)
      .map(
        (t: {
          title: string;
          description?: string;
          priority?: string;
          dueDate?: string;
          assigneeId?: string;
          participantIds?: string[];
        }) => {
          let targetParticipantIds = t.participantIds || [];
          let targetAssigneeId = t.assigneeId || null;
          if (t.participantIds && t.participantIds.length > 0) {
            targetAssigneeId = t.participantIds[0] || null;
          } else if (targetAssigneeId) {
            targetParticipantIds = [targetAssigneeId];
          }
          return {
            title: t.title,
            description: t.description || null,
            status: TaskStatus.TODO,
            priority: t.priority || 'MEDIUM',
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            projectId: id,
            assigneeId: targetAssigneeId,
            userId: request.userId as string,
            teamId: request.workspaceId || null,
            subtasks: null,
            participantIds: targetParticipantIds,
          };
        },
      );

    const createdTasks = await prisma.$transaction(
      tasksData.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            projectId: task.projectId,
            assigneeId: task.assigneeId,
            userId: task.userId,
            teamId: task.teamId,
            subtasks: task.subtasks,
            participants:
              task.participantIds.length > 0
                ? {
                    create: task.participantIds.map((userId) => ({ userId })),
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
        }),
      ),
    );

    await recalcProjectProgress(id);

    // Notify other project members about batch tasks creation
    try {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const targetUserIds = projectMembers
        .map((m) => m.userId)
        .filter((uid) => uid !== request.userId);

      if (targetUserIds.length > 0) {
        await createNotificationBatch(
          targetUserIds.map((uid) => ({
            type: 'TASK',
            title: '任务看板变更通知',
            content: `项目看板中批量添加了 ${createdTasks.length} 个新任务。`,
            userId: uid,
            link: `/project/${id}`,
            category: 'TEAM_ACTIVITY' as const,
          })),
        );
      }
    } catch (notifErr) {
      logger.error('Failed to send batch task creation notifications:', notifErr);
    }

    reply.status(201).send(createdTasks);
  } catch (error) {
    throw error;
  }
};

async function recalcProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true },
  });
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  await prisma.project.update({
    where: { id: projectId },
    data: { progress },
  });
  return progress;
}

export const updateProjectTask = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const taskId = (request.params as { taskId: string }).taskId;
  const { title, description, status, assigneeId, dueDate, participantIds } = request.body as {
    title?: string;
    description?: string;
    status?: string;
    assigneeId?: string | null;
    dueDate?: string;
    participantIds?: string[];
  };

  try {
    // 检查任务是否在当前工作区并且当前用户是项目成员
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        teamId: request.workspaceId || null,
      },
      include: {
        project: {
          include: {
            members: {
              where: { userId: request.userId },
            },
          },
        },
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!existingTask) {
      throw new AppError('Task not found', 404);
    }

    // 检查用户是否是项目成员
    if (!existingTask.project || existingTask.project.members.length === 0) {
      throw new AppError('Not authorized to update this task', 403);
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
        targetAssigneeId = request.userId ?? null;
        if (!targetParticipantIds.includes(request.userId as string)) {
          targetParticipantIds = [request.userId as string, ...targetParticipantIds];
        }
      }
    }

    const existingParticipantIds = existingTask.participants.map((p) => p.userId);
    const participantListChanged =
      targetParticipantIds.length !== existingParticipantIds.length ||
      !targetParticipantIds.every((id) => existingParticipantIds.includes(id));

    const dbParticipantIds = participantListChanged ? targetParticipantIds : undefined;

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        assigneeId: targetAssigneeId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        participants:
          dbParticipantIds !== undefined
            ? {
                deleteMany: {},
                create: dbParticipantIds.map((userId: string) => ({ userId })),
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

    // Notify other project members about task update
    if (task.projectId) {
      try {
        const projectMembers = await prisma.projectMember.findMany({
          where: { projectId: task.projectId },
          select: { userId: true },
        });
        const targetUserIds = projectMembers
          .map((m) => m.userId)
          .filter((uid) => uid !== request.userId);

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

    if (status !== undefined && task.projectId) {
      const progress = await recalcProjectProgress(task.projectId);
      reply.send({ ...task, _projectProgress: progress });
    } else {
      reply.send(task);
    }
  } catch (error) {
    throw error;
  }
};

export const deleteProject = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const query = request.query as Record<string, unknown>;
  const deleteTasks = query.deleteTasks;
  const deleteRoadmap = query.deleteRoadmap;
  const shouldDeleteTasks = deleteTasks === 'true';
  const shouldDeleteRoadmap = deleteRoadmap === 'true';

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
    });
    if (!project) {
      throw new AppError('Project not found in this workspace', 404);
    }

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: request.userId as string, role: 'OWNER' },
    });
    if (!member) {
      throw new AppError('Only owners can delete projects', 403);
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
      userId: request.userId as string,
      action: AuditAction.DELETE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Deleted project: ${project.title} (Delete Tasks: ${shouldDeleteTasks}, Delete Roadmap: ${shouldDeleteRoadmap})`,
      oldValue: project,
      req: request as unknown as AuditRequest,
    });

    // Notify other project members about the deletion
    try {
      const targetUserIds = projectMembers
        .map((m) => m.userId)
        .filter((uid) => uid !== request.userId);

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
      logger.error('Failed to send project deletion notifications:', notifErr);
    }

    reply.send({ message: 'Project deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const inviteToProject = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { userIds } = request.body as { userIds?: string[] };
  const inviterId = request.userId as string;

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
      include: { members: true },
    });
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const inviterMember = project.members.find((m) => m.userId === inviterId);
    if (!inviterMember) {
      throw new AppError('Only project members can invite', 403);
    }

    if (!userIds || !Array.isArray(userIds) || !userIds.length) {
      throw new AppError('No users specified', 400);
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
            contains: `/project/${id}`,
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
      throw new AppError('所有用户已是项目成员', 400);
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
        link: `/project/${id}?invitationId=${inv.id}`,
        category: 'TEAM_ACTIVITY' as const,
      })),
    );

    reply.status(201).send({ invited: invitations.length });
  } catch (error) {
    throw error;
  }
};

export const acceptProjectInvitation = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const invitationId = (request.params as { invitationId: string }).invitationId;
  const userId = request.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }
    if (invitation.inviteeId !== userId) {
      throw new AppError('Not your invitation', 403);
    }
    if (invitation.status !== 'PENDING') {
      throw new AppError('Invitation already processed', 400);
    }
    if (invitation.expiresAt < new Date()) {
      throw new AppError('Invitation expired', 400);
    }

    const project = await prisma.project.findUnique({
      where: { id: invitation.projectId },
      include: { members: true },
    });
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    if (project.members.length >= project.maxMembers) {
      throw new AppError('Project is full', 400);
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

    reply.send({ message: 'Invitation accepted' });
  } catch (error) {
    throw error;
  }
};

export const rejectProjectInvitation = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const invitationId = (request.params as { invitationId: string }).invitationId;
  const userId = request.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new AppError('Invitation not found', 404);
    }
    if (invitation.inviteeId !== userId) {
      throw new AppError('Not your invitation', 403);
    }
    if (invitation.status !== 'PENDING') {
      throw new AppError('Invitation already processed', 400);
    }

    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: 'REJECTED' },
    });

    reply.send({ message: 'Invitation rejected' });
  } catch (error) {
    throw error;
  }
};

export const addDiscussionReaction = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const discussionId = (request.params as { discussionId: string }).discussionId;
  const { emoji } = request.body as { emoji?: string };
  const userId = request.userId as string;

  if (!emoji) {
    throw new AppError('Emoji is required', 400);
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
      throw new AppError('Discussion not found', 404);
    }

    // 检查讨论所在的项目是否在当前工作区
    if ((discussion.project.teamId || null) !== (request.workspaceId || null)) {
      throw new AppError('Discussion not found', 404);
    }

    // 检查用户是否是项目成员
    if (!discussion.project.members || discussion.project.members.length === 0) {
      throw new AppError('Not authorized to add reactions', 403);
    }

    const existing = await prisma.projectDiscussionReaction.findUnique({
      where: { discussionId_userId_emoji: { discussionId, userId, emoji } },
    });

    if (existing) {
      await prisma.projectDiscussionReaction.delete({ where: { id: existing.id } });
      reply.send({ removed: true });
    } else {
      const reaction = await prisma.projectDiscussionReaction.create({
        data: { discussionId, userId, emoji },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      reply.status(201).send(reaction);
    }
  } catch (error) {
    throw error;
  }
};

export const removeProjectMember = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const { userId: targetUserId } = request.body as { userId?: string };
  const requesterId = request.userId as string;

  if (!targetUserId) {
    throw new AppError('Target userId is required', 400);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: request.workspaceId || null },
      include: { members: true },
    });
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const requester = project.members.find((m) => m.userId === requesterId);
    if (!requester || requester.role !== 'OWNER') {
      throw new AppError('Only owners can remove members', 403);
    }

    const target = project.members.find((m) => m.userId === targetUserId);
    if (!target) {
      throw new AppError('Member not found', 404);
    }
    if (target.role === 'OWNER') {
      throw new AppError('Cannot remove owner', 400);
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
      logger.error('Failed to send project removal notification:', notifErr);
    }

    reply.send({ message: 'Member removed' });
  } catch (error) {
    throw error;
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
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { text } = request.body as { text?: string };
  const userId = request.userId as string;

  if (!text) {
    throw new AppError('导入内容不能为空', 400);
  }

  try {
    // Verify team workspace project creation permissions
    const hasPermission = await checkTeamProjectPermission(userId, request.workspaceId);
    if (!hasPermission) {
      throw new AppError('只有团队创建人或管理员才能在团队中使用导入解析功能', 403);
    }

    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      throw new AppError(quota.message || '项目配额已满，无法导入新项目', 403);
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
          teamId: request.workspaceId || null,
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
            status: TaskStatus.TODO,
            priority: t.priority,
            dueDate: t.dueDate || null,
            projectId: project.id,
            userId,
            teamId: request.workspaceId || null,
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
      req: request as unknown as AuditRequest,
    });

    reply.status(201).send({
      success: true,
      message: '项目及关联的看板任务、学习路线已成功解析导入！',
      project: result.project,
      roadmap: result.roadmap,
      tasksCount: result.tasksCount,
    });
  } catch (error) {
    throw error;
  }
};

export const deleteDiscussion = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  const discussionId = (request.params as { discussionId: string }).discussionId;

  try {
    const discussion = await prisma.projectDiscussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      throw new AppError('Discussion not found', 404);
    }

    // Verify ownership: message sender can delete their own message
    const isSender = discussion.userId === userId;

    if (isSender) {
      await prisma.projectDiscussion.delete({
        where: { id: discussionId },
      });
      return reply.status(200).send({ success: true });
    }

    // Otherwise, check if user is a member with OWNER role in the project
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: discussion.projectId,
        userId,
        role: 'OWNER',
      },
    });

    if (!member) {
      throw new AppError('Permission denied', 403);
    }

    await prisma.projectDiscussion.delete({
      where: { id: discussionId },
    });

    reply.status(200).send({ success: true });
  } catch (error) {
    throw error;
  }
};
