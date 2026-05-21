import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const getAllTeams = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teams = await prisma.team.findMany({
      where: {
        type: 'TEAM',
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, description, avatarUrl, ownerId } = req.body;
  const creatorId = ownerId || req.userId;

  if (!name) {
    return next(new AppError('Team name is required', 400));
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          description,
          avatarUrl,
          ownerId: creatorId,
          type: 'TEAM',
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: creatorId,
          role: 'OWNER',
        },
      });

      return newTeam;
    });

    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { name, description, avatarUrl, ownerId } = req.body;

  try {
    const team = await prisma.$transaction(async (tx) => {
      const oldTeam = await tx.team.findUnique({ where: { id: id as any } });
      if (!oldTeam) throw new AppError('Team not found', 404);

      const updatedTeam = await tx.team.update({
        where: { id: id as any },
        data: { name, description, avatarUrl, ownerId },
      });

      if (ownerId && ownerId !== oldTeam.ownerId) {
        // Remove old owner as owner in members
        await tx.teamMember.updateMany({
          where: { teamId: id, role: 'OWNER' },
          data: { role: 'MEMBER' },
        });

        // Add or update new owner
        const existingMember = await tx.teamMember.findUnique({
          where: { teamId_userId: { teamId: id, userId: ownerId } },
        });

        if (existingMember) {
          await tx.teamMember.update({
            where: { id: existingMember.id },
            data: { role: 'OWNER' },
          });
        } else {
          await tx.teamMember.create({
            data: { teamId: id, userId: ownerId, role: 'OWNER' },
          });
        }
      }

      return updatedTeam;
    });

    res.json(team);
  } catch (error) {
    next(error);
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.team.delete({ where: { id: id as any } });
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateTeamMemberRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  const { role } = req.body;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return next(new AppError('Invalid role', 400));
  }

  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) return next(new AppError('Member not found', 404));
    if (member.role === 'OWNER') return next(new AppError('Cannot change owner role', 400));

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: { role },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) return next(new AppError('Member not found', 404));
    if (member.role === 'OWNER') return next(new AppError('Cannot remove owner', 400));

    await prisma.teamMember.delete({ where: { id: member.id } });
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};
