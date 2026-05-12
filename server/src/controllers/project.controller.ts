import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createNotification, createNotificationBatch } from '../utils/notification';

export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const where: any = {
      teamId: req.workspaceId,
      members: {
        some: { userId: req.userId as string }
      }
    };
    const projects = await prisma.project.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: { name: true, email: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  const { title, description, dueDate, color, tags, visibility, maxMembers, memberIds, inviteUserIds } = req.body;
  try {
    const membersData: any[] = [
      { userId: req.userId as string, role: 'OWNER' }
    ];

    if (memberIds && memberIds.length > 0) {
      const existingMemberIds = new Set([req.userId as string]);
      for (const uid of memberIds) {
        if (!existingMemberIds.has(uid)) {
          membersData.push({ userId: uid, role: 'MEMBER' });
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
        maxMembers: maxMembers ? parseInt(maxMembers) : 10,
        teamId: req.workspaceId as any,
        members: {
          create: membersData
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (inviteUserIds && inviteUserIds.length > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitations = inviteUserIds
        .filter((uid: string) => uid !== req.userId)
        .map((uid: string) => ({
          projectId: project.id,
          inviterId: req.userId as string,
          inviteeId: uid,
          status: 'PENDING',
          expiresAt
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
              category: 'TEAM_ACTIVITY' as const
            }))
        );
      }
    }

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, progress, status, dueDate, color, tags, visibility, maxMembers } = req.body;
  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId } as any
    });
    if (!project) return res.status(404).json({ error: 'Project not found in this workspace' });

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string, role: 'OWNER' }
    });
    if (!member) return res.status(403).json({ error: 'Only owners can update project settings' });

    const updateData: any = {
      title,
      description,
      status,
      color,
      tags,
      visibility,
      maxMembers: maxMembers ? parseInt(maxMembers) : undefined
    };

    if (progress !== undefined) updateData.progress = parseInt(progress);
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.project.update({
      where: { id },
      data: updateData
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } }
          }
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
            participants: {
              select: {
                id: true,
                userId: true,
                user: { select: { id: true, name: true, avatarUrl: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        discussions: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            reactions: {
              include: { user: { select: { id: true, name: true, avatarUrl: true } } }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitee: { select: { id: true, name: true, avatarUrl: true, email: true } }
          }
        }
      }
    });

    if (!project || project.teamId !== req.workspaceId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId as string;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: true }
    });

    if (!project || project.teamId !== req.workspaceId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.visibility !== 'PUBLIC' && project.status === '已完成') {
      return res.status(400).json({ error: 'Cannot join this project' });
    }

    if (project.members.length >= project.maxMembers) {
      return res.status(400).json({ error: 'Project is full' });
    }

    const existingMember = project.members.find(m => m.userId === userId);
    if (existingMember) return res.status(400).json({ error: 'Already a member' });

    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId,
        role: 'MEMBER'
      }
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addDiscussion = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { content, type, images, fileUrl, fileName, fileSize } = req.body;
  const userId = req.userId as string;

  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId }
    });

    if (!member) return res.status(403).json({ error: 'Only project members can participate in discussions' });

    const discussion = await prisma.projectDiscussion.create({
      data: {
        projectId: id,
        userId,
        content,
        type: type || 'TEXT',
        images: images || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    });

    res.status(201).json(discussion);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProjectTask = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, assigneeId, dueDate, participantIds } = req.body;

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: 'TODO',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: id,
        assigneeId: assigneeId || null,
        userId: req.userId as string,
        teamId: req.workspaceId as any,
        participants: participantIds && participantIds.length > 0 ? {
          create: participantIds.map((userId: string) => ({ userId }))
        } : undefined
      } as any,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        participants: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    await recalcProjectProgress(id);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function recalcProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true }
  });
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'DONE').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  await prisma.project.update({
    where: { id: projectId },
    data: { progress }
  });
  return progress;
}

export const updateProjectTask = async (req: AuthRequest, res: Response) => {
  const taskId = req.params.taskId as string;
  const { title, description, status, assigneeId, dueDate } = req.body;

  try {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    if (status !== undefined && task.projectId) {
      const progress = await recalcProjectProgress(task.projectId);
      res.json({ ...task, _projectProgress: progress });
    } else {
      res.json(task);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId } as any
    });
    if (!project) return res.status(404).json({ error: 'Project not found in this workspace' });

    const member = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: req.userId as string, role: 'OWNER' }
    });
    if (!member) return res.status(403).json({ error: 'Only owners can delete projects' });

    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteToProject = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { userIds } = req.body;
  const inviterId = req.userId as string;

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId } as any,
      include: { members: true }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const inviterMember = (project as any).members.find((m: any) => m.userId === inviterId);
    if (!inviterMember) return res.status(403).json({ error: 'Only project members can invite' });

    if (!userIds || !userIds.length) return res.status(400).json({ error: 'No users specified' });

    const existingMemberIds = new Set((project as any).members.map((m: any) => m.userId));
    const existingInvitations = await prisma.projectInvitation.findMany({
      where: { projectId: id, status: 'PENDING', inviteeId: { in: userIds } }
    });
    const existingInviteeIds = new Set(existingInvitations.map(i => i.inviteeId));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = userIds
      .filter((uid: string) => uid !== inviterId && !existingMemberIds.has(uid) && !existingInviteeIds.has(uid))
      .map((uid: string) => ({
        projectId: id,
        inviterId,
        inviteeId: uid,
        status: 'PENDING',
        expiresAt
      }));

    if (invitations.length === 0) {
      return res.status(400).json({ error: '所有用户已是成员或已有待处理邀请' });
    }

    await prisma.projectInvitation.createMany({ data: invitations });

    await createNotificationBatch(
      invitations.map((inv: any) => ({
        type: 'PROJECT_INVITE',
        title: '项目邀请',
        content: `你被邀请加入项目「${project.title}」`,
        userId: inv.inviteeId,
        link: `/projects/${id}`,
        category: 'TEAM_ACTIVITY' as const
      }))
    );

    res.status(201).json({ invited: invitations.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptProjectInvitation = async (req: AuthRequest, res: Response) => {
  const invitationId = req.params.invitationId as string;
  const userId = req.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId }
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.inviteeId !== userId) return res.status(403).json({ error: 'Not your invitation' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation already processed' });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' });

    const project = await prisma.project.findUnique({
      where: { id: invitation.projectId },
      include: { members: true }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.members.length >= project.maxMembers) return res.status(400).json({ error: 'Project is full' });

    await prisma.$transaction([
      prisma.projectInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' }
      }),
      prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: 'MEMBER'
        }
      })
    ]);

    res.json({ message: 'Invitation accepted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectProjectInvitation = async (req: AuthRequest, res: Response) => {
  const invitationId = req.params.invitationId as string;
  const userId = req.userId as string;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id: invitationId }
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.inviteeId !== userId) return res.status(403).json({ error: 'Not your invitation' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation already processed' });

    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: 'REJECTED' }
    });

    res.json({ message: 'Invitation rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addDiscussionReaction = async (req: AuthRequest, res: Response) => {
  const discussionId = req.params.discussionId as string;
  const { emoji } = req.body;
  const userId = req.userId as string;

  try {
    const existing = await prisma.projectDiscussionReaction.findUnique({
      where: { discussionId_userId_emoji: { discussionId, userId, emoji } }
    });

    if (existing) {
      await prisma.projectDiscussionReaction.delete({ where: { id: existing.id } });
      res.json({ removed: true });
    } else {
      const reaction = await prisma.projectDiscussionReaction.create({
        data: { discussionId, userId, emoji },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } }
      });
      res.status(201).json(reaction);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeProjectMember = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { userId: targetUserId } = req.body;
  const requesterId = req.userId as string;

  try {
    const project = await prisma.project.findFirst({
      where: { id, teamId: req.workspaceId } as any,
      include: { members: true }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const requester = (project as any).members.find((m: any) => m.userId === requesterId);
    if (!requester || requester.role !== 'OWNER') return res.status(403).json({ error: 'Only owners can remove members' });

    const target = (project as any).members.find((m: any) => m.userId === targetUserId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'OWNER') return res.status(400).json({ error: 'Cannot remove owner' });

    await prisma.projectMember.delete({ where: { id: target.id } });
    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
