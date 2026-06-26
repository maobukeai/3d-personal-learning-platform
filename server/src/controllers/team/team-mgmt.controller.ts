import { Response, NextFunction } from 'express';
import fs from 'fs';
import speakeasy from 'speakeasy';

import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { checkTeamQuota } from '../../utils/quota';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { getUploadedFileUrl } from '../../utils/file';
import { normalizeTeamVisibility } from './helpers';

export const createTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, description, avatarUrl, visibility = 'PUBLIC', category } = req.body;
  const userId = req.userId as string;

  if (!name || !name.trim()) {
    return next(new AppError('团队名称不能为空', 400));
  }

  try {
    const quota = await checkTeamQuota(userId);
    if (!quota.allowed) {
      return next(new AppError(quota.message || 'Quota exceeded', 403));
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        description,
        avatarUrl,
        visibility: normalizeTeamVisibility(visibility, 'PUBLIC'),
        category,
        type: 'TEAM',
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });

    await auditService.log({
      userId,
      action: AuditAction.CREATE_TEAM,
      module: AuditModule.TEAM,
      description: `Created team: ${team.name}`,
      newValue: team,
      req,
    });

    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const { name, description, avatarUrl, visibility, category } = req.body;
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    const member = team.members.find((m) => m.userId === req.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return next(new AppError('Unauthorized', 403));
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined && { name: name.trim() || team.name }),
        ...(description !== undefined && { description }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(visibility !== undefined && {
          visibility: normalizeTeamVisibility(visibility, team.visibility),
        }),
        ...(category !== undefined && { category }),
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER, // Keep aligned with existing audit setup
      module: AuditModule.TEAM,
      description: `Updated team: ${updated.name}`,
      oldValue: team,
      newValue: updated,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const uploadTeamAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    const member = team.members.find((m) => m.userId === req.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return next(new AppError('Unauthorized', 403));
    }

    const avatarUrl = getUploadedFileUrl(req, req.file, 'avatars');

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { avatarUrl },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.TEAM,
      description: `Updated team avatar for: ${updated.name}`,
      req,
    });

    res.json(updated);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

export const uploadTeamCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return next(new AppError('Team not found', 404));

    const member = team.members.find((m) => m.userId === req.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return next(new AppError('Unauthorized', 403));
    }

    const coverUrl = getUploadedFileUrl(req, req.file, 'covers');

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { coverUrl },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_TEAM,
      module: AuditModule.TEAM,
      description: `Updated team cover for: ${updated.name}`,
      req,
    });

    res.json(updated);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId as string;
  const { code } = req.body;

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) return next(new AppError('Team not found', 404));
    if (team.ownerId !== req.userId) return next(new AppError('Only owner can delete team', 403));
    if (team.name === '公共空间' || team.type === 'PERSONAL') {
      return next(new AppError('不能删除系统预置或个人空间', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) return next(new AppError('用户不存在', 404));

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
      if (!isValid) return next(new AppError('两步验证码错误', 400));
    } else {
      if (!code) {
        return res.status(400).json({ error: '需要邮箱验证码', emailVerificationRequired: true });
      }
      const record = await prisma.verificationCode.findFirst({
        where: {
          email: user.email,
          code,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) return next(new AppError('验证码错误或已过期', 400));

      // Clean up verification code
      await prisma.verificationCode.delete({ where: { id: record.id } });
    }

    await prisma.team.delete({ where: { id: teamId } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_TEAM,
      module: AuditModule.TEAM,
      description: `Deleted team: ${team.name}`,
      oldValue: team,
      req,
    });

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    next(error);
  }
};
