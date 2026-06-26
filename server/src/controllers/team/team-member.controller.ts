import { Response, NextFunction } from 'express';

import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createNotification } from '../../utils/notification';
import { AppError } from '../../utils/error';
import { normalizeEmail, normalizeManagedRole, parseBooleanDecision } from './helpers';

export const inviteToTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.body.teamId as string;
  const inviterId = req.userId as string;

  try {
    const inviteeEmail = normalizeEmail(req.body.inviteeEmail);

    // Check if team exists and user is owner/admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    if (team.type === 'PERSONAL') {
      return next(new AppError('个人空间不允许邀请其他成员', 400));
    }

    const member = team.members.find((m) => m.userId === inviterId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return next(new AppError('Unauthorized to invite', 403));
    }

    // Check if already invited or member
    const existingMember = await prisma.user.findFirst({
      where: {
        email: inviteeEmail,
        teamMemberships: { some: { teamId } },
      },
    });
    if (existingMember) return next(new AppError('User is already a member', 400));

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        teamId,
        inviteeEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) return next(new AppError('该邮箱已有待处理的邀请', 400));

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        inviterId,
        inviteeEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Create notification for invitee if they exist
    const invitee = await prisma.user.findUnique({ where: { email: inviteeEmail } });
    if (invitee) {
      await createNotification({
        type: 'TEAM',
        title: '收到团队邀请',
        content: `${req.user?.name || '有人'} 邀请你加入团队: ${team.name}`,
        userId: invitee.id,
        link: `/team/${teamId}?invitationId=${invitation.id}`,
        category: 'TEAM_ACTIVITY',
      });
    }
    res.status(201).json(invitation);
  } catch (error) {
    next(error);
  }
};

export const getMyInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('User not found', 404));

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        inviteeEmail: user.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        team: { select: { name: true, avatarUrl: true } },
      },
    });
    res.json(invitations);
  } catch (error) {
    next(error);
  }
};

export const respondToInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { invitationId, accept } = req.body;
  const userId = req.userId as string;

  try {
    const shouldAccept = parseBooleanDecision(accept, 'accept');
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      return next(new AppError('Invitation not found or already processed', 404));
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' },
      });
      return next(new AppError('邀请已过期', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || normalizeEmail(user.email) !== normalizeEmail(invitation.inviteeEmail)) {
      return next(new AppError('Unauthorized', 403));
    }

    if (shouldAccept) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: invitation.teamId, userId } },
      });
      if (existingMembership) {
        await prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        });
        return next(new AppError('你已经是该团队的成员', 400));
      }

      await prisma.$transaction([
        prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        }),
        prisma.teamMember.create({
          data: {
            teamId: invitation.teamId,
            userId,
            role: 'MEMBER',
          },
        }),
      ]);
      res.json({ message: 'Joined team successfully' });
    } else {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' },
      });
      res.json({ message: 'Invitation rejected' });
    }
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    const currentMember = team.members.find((m) => m.userId === req.userId);
    if (!currentMember) {
      return next(new AppError('Unauthorized', 403));
    }

    const isSelfRemoval = req.userId === userId;
    if (isSelfRemoval && (team.visibility === 'PUBLIC' || team.name === '公共空间')) {
      return next(new AppError('公共空间不允许退出', 400));
    }

    if (isSelfRemoval && currentMember.role === 'OWNER') {
      return next(new AppError('团队所有者不能退出，请先转让所有权', 400));
    }

    if (!isSelfRemoval && !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return next(new AppError('Unauthorized', 403));
    }

    const targetMember = team.members.find((m) => m.userId === userId);
    if (!targetMember) return next(new AppError('Member not found', 404));

    // Cannot remove owner
    if (targetMember.role === 'OWNER') return next(new AppError('Cannot remove owner', 400));

    // Admins cannot remove other admins (only owner can)
    if (
      currentMember.role === 'ADMIN' &&
      targetMember.role === 'ADMIN' &&
      team.ownerId !== req.userId
    ) {
      return next(new AppError('Admins cannot remove other admins', 403));
    }

    await prisma.teamMember.delete({ where: { id: targetMember.id } });
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const applyToTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { teamId, message } = req.body;
  const userId = req.userId as string;

  try {
    // Check if team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return next(new AppError('Team not found', 404));
    if (team.type === 'PERSONAL') return next(new AppError('Cannot apply to personal space', 400));
    if (team.visibility === 'PRIVATE')
      return next(new AppError('私密团队不支持申请加入，请通过邀请加入', 400));

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existingMember) return next(new AppError('Already a member', 400));

    // Create or update application
    const application = await prisma.teamApplication.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { message, status: 'PENDING' },
      create: { teamId, userId, message },
    });

    // Notify owner
    await createNotification({
      type: 'TEAM',
      title: '新的人员加入申请',
      content: `${req.user?.name || '有人'} 申请加入你的团队: ${team.name}`,
      userId: team.ownerId,
      link: `/team/${teamId}`,
      category: 'TEAM_ACTIVITY',
    });

    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
};

export const getTeamApplications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const userId = req.userId as string;

  try {
    // Check if user is owner/admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) return next(new AppError('Unauthorized', 403));

    const applications = await prisma.teamApplication.findMany({
      where: { teamId, status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  } catch (error) {
    next(error);
  }
};

export const respondToApplication = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { applicationId, accept } = req.body;
  const userId = req.userId as string;

  try {
    const shouldAccept = parseBooleanDecision(accept, 'accept');
    const application = await prisma.teamApplication.findUnique({
      where: { id: applicationId },
      include: { team: true },
    });

    if (!application || application.status !== 'PENDING') {
      return next(new AppError('Application not found or already processed', 404));
    }

    // Check if user is owner/admin of the team
    const member = await prisma.teamMember.findFirst({
      where: { teamId: application.teamId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) return next(new AppError('Unauthorized', 403));

    if (shouldAccept) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: application.teamId, userId: application.userId } },
      });
      if (existingMembership) {
        await prisma.teamApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' },
        });
        return next(new AppError('该用户已经是团队成员', 400));
      }

      await prisma.$transaction([
        prisma.teamApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' },
        }),
        prisma.teamMember.create({
          data: {
            teamId: application.teamId,
            userId: application.userId,
            role: 'MEMBER',
          },
        }),
      ]);

      // Notify applicant
      await createNotification({
        type: 'TEAM',
        title: '加入申请已通过',
        content: `你加入团队"${application.team.name}" 的申请已被批准！`,
        userId: application.userId,
        link: `/team/${application.teamId}`,
        category: 'TEAM_ACTIVITY',
      });

      res.json({ message: 'Application approved' });
    } else {
      await prisma.teamApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' },
      });

      await createNotification({
        type: 'TEAM',
        title: '加入申请未通过',
        content: `你加入团队"${application.team.name}" 的申请已被拒绝。`,
        userId: application.userId,
        category: 'TEAM_ACTIVITY',
      });

      res.json({ message: 'Application rejected' });
    }
  } catch (error) {
    next(error);
  }
};

export const addMemberDirectly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { teamId, userId } = req.body;
  const currentUserId = req.userId as string;

  try {
    const role = normalizeManagedRole(req.body.role);
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    if (team.type === 'PERSONAL') {
      return next(new AppError('个人空间不允许添加其他成员', 400));
    }

    // Check permissions
    const currentMember = team.members.find((m) => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return next(new AppError('Unauthorized to add members', 403));
    }

    if (role === 'ADMIN' && currentMember.role !== 'OWNER') {
      return next(new AppError('Only owner can add admin members', 403));
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) {
      return next(new AppError('User not found', 404));
    }

    // Check if user already a member
    const existingMember = team.members.find((m) => m.userId === userId);
    if (existingMember) return next(new AppError('User is already a member', 400));

    const newMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
    });

    res.status(201).json(newMember);
  } catch (error) {
    next(error);
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  const currentUserId = req.userId as string;

  try {
    const role = normalizeManagedRole(req.body.role, '');
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    const currentMember = team.members.find((m) => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return next(new AppError('Unauthorized', 403));
    }

    const targetMember = team.members.find((m) => m.userId === userId);
    if (!targetMember) return next(new AppError('Member not found', 404));

    // Only OWNER can promote/demote ADMINs
    if ((targetMember.role === 'ADMIN' || role === 'ADMIN') && currentMember.role !== 'OWNER') {
      return next(new AppError('Only owner can manage admin roles', 403));
    }

    if (targetMember.role === 'OWNER') {
      return next(new AppError('Cannot change owner role', 400));
    }

    const updated = await prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const cancelInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const invitationId = req.params.invitationId as string;
  const currentUserId = req.userId as string;

  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: { include: { members: true } } },
    });

    if (!invitation) return next(new AppError('Invitation not found', 404));

    const currentMember = invitation.team.members.find((m) => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return next(new AppError('Unauthorized', 403));
    }

    await prisma.teamInvitation.delete({ where: { id: invitationId } });
    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    next(error);
  }
};
