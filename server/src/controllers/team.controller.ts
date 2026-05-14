import { Request, Response } from 'express';
import fs from 'fs';
import speakeasy from 'speakeasy';

import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';
import { createNotification } from '../utils/notification';
import { checkTeamQuota } from '../utils/quota';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const getTeams = async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: { userId: req.userId as string }
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } }
          }
        },
        _count: {
          select: { members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicTeams = async (req: AuthRequest, res: Response) => {
  const { search, category } = req.query;
  const userId = req.userId as string;

  try {
    const teams = await prisma.team.findMany({
      where: {
        type: 'TEAM',
        visibility: 'PUBLIC',
        ...(category && category !== '全部' ? { category: category as string } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search as string } },
            { description: { contains: search as string } }
          ]
        } : {})
      },
      include: {
        _count: { select: { members: true } },
        owner: { select: { name: true, avatarUrl: true } },
        members: {
          take: 5,
          include: {
            user: { select: { name: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  const { name, description, avatarUrl, visibility = 'PUBLIC', category } = req.body;
  const userId = req.userId as string;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '团队名称不能为空' });
  }

  try {
    const quota = await checkTeamQuota(userId);
    if (!quota.allowed) {
      return res.status(403).json({ error: quota.message });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description,
        avatarUrl,
        visibility,
        category,
        type: 'TEAM',
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      },
      include: {
        members: true
      }
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_TEAM,
      module: AuditModule.TEAM,
      description: `Created team: ${team.name}`,
      newValue: team,
      req
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeamMembers = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.visibility === 'PRIVATE') {
      const membership = await prisma.teamMember.findFirst({
        where: { teamId, userId: req.userId as string }
      });
      if (!membership) return res.status(403).json({ error: 'Forbidden' });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { 
            id: true, 
            name: true, 
            email: true, 
            avatarUrl: true, 
            role: true,
            subscription: {
              include: { plan: true }
            }
          }
        }

      }
    });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteToTeam = async (req: AuthRequest, res: Response) => {
  const teamId = req.body.teamId as string;
  const inviterId = req.userId as string;
  const inviteeEmail = req.body.inviteeEmail as string;

  try {
    // Check if team exists and user is owner/admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });
    
    if (team.type === 'PERSONAL') {
      return res.status(400).json({ error: '个人空间不允许邀请其他成员' });
    }

    const member = team.members.find(m => m.userId === inviterId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ error: 'Unauthorized to invite' });
    }

    // Check if already invited or member
    const existingMember = await prisma.user.findFirst({
      where: {
        email: inviteeEmail,
        teamMemberships: { some: { teamId } }
      }
    });
    if (existingMember) return res.status(400).json({ error: 'User is already a member' });

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        teamId,
        inviteeEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });
    if (existingInvitation) return res.status(400).json({ error: '该邮箱已有待处理的邀请' });

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        inviterId,
        inviteeEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Create notification for invitee if they exist
    const invitee = await prisma.user.findUnique({ where: { email: inviteeEmail } });
    if (invitee) {
      await createNotification({
        type: 'SYSTEM',
        title: '收到团队邀请',
        content: `${req.user?.name || '有人'} 邀请你加入团队: ${team.name}`,
        userId: invitee.id,
        link: `/team/${teamId}?invitationId=${invitation.id}`,
        category: 'TEAM_ACTIVITY'
      });
    }
    res.status(201).json(invitation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyInvitations = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        inviteeEmail: user.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      include: {
        team: { select: { name: true, avatarUrl: true } }
      }
    });
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeamById = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { 
              select: { 
                id: true, 
                name: true, 
                email: true, 
                avatarUrl: true, 
                role: true,
                subscription: {
                  include: { plan: true }
                }
              } 
            }

          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const isMember = team.members.some((m: any) => m.userId === req.userId);

    if (isMember) {
      const [invitations, applications] = await Promise.all([
        prisma.teamInvitation.findMany({
          where: { teamId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.teamApplication.findMany({
          where: { teamId, status: 'PENDING' },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);
      (team as any).invitations = invitations;
      (team as any).applications = applications;
    } else {
      if (team.visibility !== 'PUBLIC') {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondToInvitation = async (req: AuthRequest, res: Response) => {
  const { invitationId, accept } = req.body;
  const userId = req.userId as string;

  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true }
    });

    if (!invitation || invitation.status !== 'PENDING') {
      return res.status(404).json({ error: 'Invitation not found or already processed' });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' }
      });
      return res.status(400).json({ error: '邀请已过期' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.inviteeEmail) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (accept) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: invitation.teamId, userId } }
      });
      if (existingMembership) {
        await prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' }
        });
        return res.status(400).json({ error: '你已经是该团队的成员' });
      }

      await prisma.$transaction([
        prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' }
        }),
        prisma.teamMember.create({
          data: {
            teamId: invitation.teamId,
            userId,
            role: 'MEMBER'
          }
        })
      ]);
      res.json({ message: 'Joined team successfully' });
    } else {
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: 'REJECTED' }
      });
      res.json({ message: 'Invitation rejected' });
    }
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const updateTeam = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const { name, description, avatarUrl, visibility, category } = req.body;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const member = (team as any).members.find((m: any) => m.userId === req.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined && { name: name.trim() || team.name }),
        ...(description !== undefined && { description }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(visibility !== undefined && { visibility }),
        ...(category !== undefined && { category })
      }
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_USER, // Need to add UPDATE_TEAM to AuditAction enum
      module: AuditModule.TEAM,
      description: `Updated team: ${updated.name}`,
      oldValue: team,
      newValue: updated,
      req
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadTeamAvatar = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const member = (team as any).members.find((m: any) => m.userId === req.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { avatarUrl }
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.TEAM,
      description: `Updated team avatar for: ${updated.name}`,
      req
    });

    res.json(updated);
  } catch (error) {
    console.error('Upload team avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const { code } = req.body;
  
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can delete team' });
    if (team.name === '公共空间' || team.type === 'PERSONAL') {
      return res.status(400).json({ error: '不能删除系统预置或个人空间' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (user.twoFactorEnabled) {
      if (!code) {
        return res.status(400).json({ error: '需要两步验证码', twoFactorRequired: true });
      }
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: code,
        window: 1,
      });
      if (!isValid) return res.status(400).json({ error: '两步验证码错误' });
    } else {
      if (!code) {
        return res.status(400).json({ error: '需要邮箱验证码', emailVerificationRequired: true });
      }
      const record = await prisma.verificationCode.findFirst({
        where: { 
          email: user.email, 
          code, 
          expiresAt: { gt: new Date() } 
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!record) return res.status(400).json({ error: '验证码错误或已过期' });
      
      // Clean up verification code
      await prisma.verificationCode.delete({ where: { id: record.id } });
    }

    await prisma.team.delete({ where: { id: teamId } });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_TEAM,
      module: AuditModule.TEAM,
      description: `Deleted team: ${team.name}`,
      oldValue: team,
      req
    });

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const currentMember = (team as any).members.find((m: any) => m.userId === req.userId);
    if (!currentMember) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const isSelfRemoval = req.userId === userId;
    if (isSelfRemoval && (team.visibility === 'PUBLIC' || team.name === '公共空间')) {
      return res.status(400).json({ error: '公共空间不允许退出' });
    }

    if (isSelfRemoval && currentMember.role === 'OWNER') {
      return res.status(400).json({ error: '团队所有者不能退出，请先转让所有权' });
    }
    
    if (!isSelfRemoval && !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const targetMember = (team as any).members.find((m: any) => m.userId === userId);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    // Cannot remove owner
    if (targetMember.role === 'OWNER') return res.status(400).json({ error: 'Cannot remove owner' });
    
    // Admins cannot remove other admins (only owner can)
    if (currentMember.role === 'ADMIN' && targetMember.role === 'ADMIN' && team.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Admins cannot remove other admins' });
    }

    await prisma.teamMember.delete({ where: { id: targetMember.id } });
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const applyToTeam = async (req: AuthRequest, res: Response) => {
  const { teamId, message } = req.body;
  const userId = req.userId as string;

  try {
    // Check if team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.type === 'PERSONAL') return res.status(400).json({ error: 'Cannot apply to personal space' });
    if (team.visibility === 'PRIVATE') return res.status(400).json({ error: '私密团队不支持申请加入，请通过邀请加入' });

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });
    if (existingMember) return res.status(400).json({ error: 'Already a member' });

    // Create or update application
    const application = await prisma.teamApplication.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { message, status: 'PENDING' },
      create: { teamId, userId, message }
    });

    // Notify owner
    await createNotification({
      type: 'SYSTEM',
      title: '新的人员加入申请',
      content: `${req.user?.name || '有人'} 申请加入你的团队: ${team.name}`,
      userId: team.ownerId,
      link: `/team/${teamId}`,
      category: 'TEAM_ACTIVITY'
    });

    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeamApplications = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const userId = req.userId as string;

  try {
    // Check if user is owner/admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId, role: { in: ['OWNER', 'ADMIN'] } }
    });
    if (!member) return res.status(403).json({ error: 'Unauthorized' });

    const applications = await prisma.teamApplication.findMany({
      where: { teamId, status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondToApplication = async (req: AuthRequest, res: Response) => {
  const { applicationId, accept } = req.body;
  const userId = req.userId as string;

  try {
    const application = await prisma.teamApplication.findUnique({
      where: { id: applicationId },
      include: { team: true }
    });

    if (!application || application.status !== 'PENDING') {
      return res.status(404).json({ error: 'Application not found or already processed' });
    }

    // Check if user is owner/admin of the team
    const member = await prisma.teamMember.findFirst({
      where: { teamId: application.teamId, userId, role: { in: ['OWNER', 'ADMIN'] } }
    });
    if (!member) return res.status(403).json({ error: 'Unauthorized' });

    if (accept) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: application.teamId, userId: application.userId } }
      });
      if (existingMembership) {
        await prisma.teamApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' }
        });
        return res.status(400).json({ error: '该用户已经是团队成员' });
      }

      await prisma.$transaction([
        prisma.teamApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' }
        }),
        prisma.teamMember.create({
          data: {
            teamId: application.teamId,
            userId: application.userId,
            role: 'MEMBER'
          }
        })
      ]);

      // Notify applicant
      await createNotification({
        type: 'SYSTEM',
        title: '加入申请已通过',
        content: `你加入团队"${application.team.name}" 的申请已被批准！`,
        userId: application.userId,
        link: `/team/${application.teamId}`,
        category: 'TEAM_ACTIVITY'
      });

      res.json({ message: 'Application approved' });
    } else {
      await prisma.teamApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' }
      });

      await createNotification({
        type: 'SYSTEM',
        title: '加入申请未通过',
        content: `你加入团队"${application.team.name}" 的申请已被拒绝。`,
        userId: application.userId,
        category: 'TEAM_ACTIVITY'
      });

      res.json({ message: 'Application rejected' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const addMemberDirectly = async (req: AuthRequest, res: Response) => {
  const { teamId, userId, role = 'MEMBER' } = req.body;
  const currentUserId = req.userId as string;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role, only ADMIN or MEMBER allowed' });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.type === 'PERSONAL') {
      return res.status(400).json({ error: '个人空间不允许添加其他成员' });
    }

    // Check permissions
    const currentMember = team.members.find(m => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Unauthorized to add members' });
    }

    // Check if user already a member
    const existingMember = team.members.find(m => m.userId === userId);
    if (existingMember) return res.status(400).json({ error: 'User is already a member' });

    const newMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role
      }
    });

    res.status(201).json(newMember);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  const { teamId, userId } = req.params;
  const { role } = req.body;
  const currentUserId = req.userId as string;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const currentMember = team.members.find(m => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const targetMember = team.members.find(m => m.userId === userId);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    // Only OWNER can promote/demote ADMINs
    if ((targetMember.role === 'ADMIN' || role === 'ADMIN') && currentMember.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owner can manage admin roles' });
    }

    if (targetMember.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    const updated = await prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelInvitation = async (req: AuthRequest, res: Response) => {
  const { invitationId } = req.params;
  const currentUserId = req.userId as string;

  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: { include: { members: true } } }
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

    const currentMember = invitation.team.members.find(m => m.userId === currentUserId);
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.teamInvitation.delete({ where: { id: invitationId } });
    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
