import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createNotification, createNotificationBatch } from '../utils/notification';
import { checkProjectQuota } from '../utils/quota';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';

export const getAllProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.ProjectWhereInput = {
      teamId: req.workspaceId || null,
      members: {
        some: { userId: req.userId as string },
      },
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
    // Check quota
    const quota = await checkProjectQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || 'Project quota exceeded', 403));
    }

    const membersData: Prisma.ProjectMemberCreateWithoutProjectInput[] = [{
      user: { connect: { id: userId } },
      role: 'OWNER',
    }];

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

        await createNotificationBatch(
          inviteUserIds
            .filter((uid: string) => uid !== req.userId)
            .map((uid: string) => ({
              type: 'PROJECT_INVITE',
              title: '项目邀请',
              content: `你被邀请加入项目「${title}」`,
              userId: uid,
              link: `/projects/${project.id}`,
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
      },
    });

    if (!project || project.teamId !== req.workspaceId) {
      return next(new AppError('Project not found', 404));
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

    if (!project || project.teamId !== req.workspaceId) {
      return next(new AppError('Project not found', 404));
    }

    if (project.visibility !== 'PUBLIC' && project.status === 'COMPLETED') {
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

    res.status(201).json(task);
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

    await prisma.project.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_PROJECT,
      module: AuditModule.PROJECT,
      description: `Deleted project: ${project.title}`,
      oldValue: project,
      req,
    });

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
    const existingInvitations = await prisma.projectInvitation.findMany({
      where: { projectId: id, status: 'PENDING', inviteeId: { in: userIds } },
    });
    const existingInviteeIds = new Set(existingInvitations.map((i) => i.inviteeId));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = userIds
      .filter(
        (uid: string) =>
          uid !== inviterId && !existingMemberIds.has(uid) && !existingInviteeIds.has(uid),
      )
      .map((uid: string) => ({
        projectId: id,
        inviterId,
        inviteeId: uid,
        status: 'PENDING',
        expiresAt,
      }));

    if (invitations.length === 0) {
      return next(new AppError('所有用户已是成员或已有待处理邀请', 400));
    }

    await prisma.projectInvitation.createMany({ data: invitations });

    await createNotificationBatch(
      invitations.map((inv) => ({
        type: 'PROJECT_INVITE',
        title: '项目邀请',
        content: `你被邀请加入项目「${project.title}」`,
        userId: inv.inviteeId,
        link: `/projects/${id}`,
        category: 'TEAM_ACTIVITY' as const,
      })),
    );

    res.status(201).json({ invited: invitations.length });
  } catch (error) {
    next(error);
  }
};

export const acceptProjectInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const rejectProjectInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const addDiscussionReaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    if (discussion.project.teamId !== req.workspaceId) {
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
    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
};
