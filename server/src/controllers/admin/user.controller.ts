import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { sanitizeUser } from '../../utils/auth';
import { AppError } from '../../middlewares/error.middleware';

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return next(new AppError('邮箱和密码为必填项', 400));
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('该邮箱已被注册', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role || 'USER',
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      // 1. 创建个人工作区（PERSONAL 类型团队）
      await tx.team.create({
        data: {
          name: `${name || user.email} 的个人空间`,
          description: '个人专属创作与协作空间',
          type: 'PERSONAL',
          visibility: 'PRIVATE',
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });

      // 2. 查找或创建公共空间 - 使用并发安全的方式
      let publicTeam = await tx.team.findUnique({
        where: { name_type: { name: '公共空间', type: 'TEAM' } },
      });

      if (!publicTeam) {
        // 尝试创建公共空间，如果并发创建失败则重新查找
        try {
          publicTeam = await tx.team.create({
            data: {
              name: '公共空间',
              description: '全站公共协作与创作空间',
              type: 'TEAM',
              visibility: 'PUBLIC',
              ownerId: user.id,
              members: {
                create: {
                  userId: user.id,
                  role: 'OWNER',
                },
              },
            },
          });
        } catch (e) {
          // 如果唯一约束冲突，说明有其他请求先创建了公共空间，重新查找
          publicTeam = await tx.team.findUnique({
            where: { name_type: { name: '公共空间', type: 'TEAM' } },
          });
          if (!publicTeam) {
            throw e; // 如果还是找不到，抛出原始错误
          }
        }
      }

      // 将用户添加到公共团队作为成员
      if (publicTeam.ownerId !== user.id) {
        await tx.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId: publicTeam.id,
              userId: user.id,
            },
          },
          update: {},
          create: {
            teamId: publicTeam.id,
            userId: user.id,
            role: 'MEMBER',
          },
        });
      }

      return user;
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_USER,
      module: AuditModule.USER,
      description: `管理员创建了新用户 ${result.email}`,
      newValue: sanitizeUser(result),
      req,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { name, email, role, status } = req.body;

  try {
    const oldUser = await prisma.user.findUnique({ where: { id: id as any } });
    if (!oldUser) return next(new AppError('用户不存在', 404));

    // Prevent self-demotion or self-banning if you are an admin
    if (id === req.userId && (role !== 'ADMIN' || status === 'BANNED')) {
      return next(new AppError('不能修改自己的管理员权限或封禁自己', 400));
    }

    const updatedUser = await prisma.user.update({
      where: { id: id as any },
      data: { name, email, role, status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `管理员更新了用户 ${updatedUser.email} 的资料`,
      oldValue: sanitizeUser(oldUser),
      newValue: updatedUser,
      req,
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return next(new AppError('密码长度至少为 6 位', 400));
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: id as any } });
    if (!user) return next(new AppError('用户不存在', 404));

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: id as any },
      data: { password: hashedPassword },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.RESET_PASSWORD,
      module: AuditModule.USER,
      description: `管理员重置了用户 ${user.email} 的密码`,
      req,
    });

    res.json({ message: '用户密码已成功重置' });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { role } = req.body;

  const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
  if (!validRoles.includes(role)) {
    return next(new AppError('Invalid role value', 400));
  }

  try {
    const oldUser = await prisma.user.findUnique({ where: { id: id as any } });
    if (!oldUser) return next(new AppError('用户不存在', 404));

    const updatedUser = await prisma.user.update({
      where: { id: id as any },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_USER,
      module: AuditModule.USER,
      description: `管理员修改了用户 ${updatedUser.email} 的角色为 ${role}`,
      oldValue: { role: oldUser.role },
      newValue: { role },
      req,
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    // Prevent self-deletion
    if (id === req.userId) {
      return next(new AppError('不能删除自己的账户', 400));
    }

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({ where: { id: id as any } });
    if (!userToDelete) {
      return next(new AppError('用户不存在', 404));
    }

    // Prevent deleting the last admin
    if (userToDelete.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return next(new AppError('不能删除最后一个管理员账户', 400));
      }
    }

    await prisma.user.delete({ where: { id: id as any } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_USER,
      module: AuditModule.USER,
      description: `管理员删除了用户 ${userToDelete.email}`,
      oldValue: sanitizeUser(userToDelete),
      req,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
