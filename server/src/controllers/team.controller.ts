import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';

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
            user: { select: { name: true, avatarUrl: true, email: true } }
          }
        },
        _count: {
          select: { members: true }
        }
      }
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  const { name, description, avatarUrl } = req.body;
  const userId = req.userId as string;

  try {
    const team = await prisma.team.create({
      data: {
        name,
        description,
        avatarUrl,
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
    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTeamMembers = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true }
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
      const notification = await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: '收到团队邀请',
          content: `${req.user?.name || '有人'} 邀请你加入团队: ${team.name}`,
          userId: invitee.id,
          link: '/settings?tab=notifications' // Or wherever invitations are managed
        }
      });
      emitToUser(invitee.id, 'new_notification', notification);
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
            user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } }
          }
        },
        invitations: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if user is a member
    const isMember = (team as any).members.some((m: any) => m.userId === req.userId);
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

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

    // Verify invitee email matches user email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.inviteeEmail) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (accept) {
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
  const { name, description, avatarUrl } = req.body;
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
      data: { name, description, avatarUrl }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can delete team' });

    await prisma.team.delete({ where: { id: teamId } });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
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
    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
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

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  const { role } = req.body;

  if (!['ADMIN', 'MEMBER'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can change roles' });

    const targetMember = (team as any).members.find((m: any) => m.userId === userId);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    await prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role }
    });

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
