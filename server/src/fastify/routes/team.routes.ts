import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { checkTeamQuota } from '../../utils/quota';
import {
  auditService,
  AuditAction,
  AuditModule,
  type AuditRequest,
} from '../../services/audit.service';
import { createNotification } from '../../utils/notification';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import { getUploadedFileUrl, deleteCloudOrLocalFileByUrl } from '../../utils/file';
import type { UploadedFile } from '../../types/upload';
import { logger } from '../../utils/logger';
import {
  addMemberDirectlySchema,
  applyToTeamSchema,
  createTeamSchema,
  inviteToTeamSchema,
  respondToApplicationSchema,
  respondToInvitationSchema,
  updateMemberRoleSchema,
  updateTeamSchema,
} from '../../utils/schemas-batch1';
import {
  normalizeEmail,
  normalizeTeamVisibility,
  normalizeManagedRole,
  parseBooleanDecision,
} from '../../controllers/team/helpers';

/**
 * Fastify 团队路由（铁律六·1 渐进式迁移）。
 *
 * 业务逻辑从 Express team.controller.ts（team-query / team-mgmt / team-member）
 * 移植而来，仅适配 Fastify request/reply 签名；复用同款 prisma / auditService /
 * notification / quota / speakeasy 等共享模块。
 *
 * 挂载前缀: /api/fastify/teams
 *
 * 文件上传端点（使用 @fastify/multipart / fastifyUpload 中间件）：
 *  - POST /:teamId/upload-avatar
 *  - POST /:teamId/upload-cover
 *
 * 路由级限流：/teams/public 对齐 Express shareLimiter (30/min)。
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const requireUserId = (request: FastifyRequest): string => {
  if (!request.userId) {
    throw new AppError('登录会话已过期，请重新登录', 401, 'UNAUTHORIZED');
  }
  return request.userId;
};

/**
 * 构造一个最小化的 Express Request 适配器，仅供 auditService.log({ req }) 使用。
 *
 * auditService 仅访问：req.headers / req.ip / req.socket.remoteAddress。
 * FastifyRequest 提供 request.headers 与 request.ip；request.raw.socket
 * 即底层 Node.js socket（含 remoteAddress）。
 */
const buildAuditReq = (request: FastifyRequest): AuditRequest => ({
  headers: request.headers,
  ip: request.ip,
  socket: request.raw.socket,
});

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const teamIdParamsSchema = z.object({
  teamId: z.string().min(1),
});

const invitationIdParamsSchema = z.object({
  invitationId: z.string().min(1),
});

const teamMemberParamsSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
});

const deleteTeamBodySchema = z.object({
  code: z.string().optional(),
});

// shareLimiter: 30/min
const SHARE_RATE_LIMIT = { max: 30, timeWindow: '1 minute' };

export const registerTeamRoutes = (app: FastifyInstance): void => {
  // ── 公开端点 ──────────────────────────────────────────────────────────

  // GET /teams/public —— 公开团队列表
  app.get('/teams/public', { config: { rateLimit: SHARE_RATE_LIMIT } }, async (request, reply) => {
    const query = request.query as { search?: string; category?: string };
    const { search, category } = query;

    const teams = await prisma.team.findMany({
      where: {
        type: 'TEAM',
        visibility: 'PUBLIC',
        ...(category && category !== '全部' ? { category } : {}),
        ...(search
          ? {
              OR: [{ name: { contains: search } }, { description: { contains: search } }],
            }
          : {}),
      },
      include: {
        _count: { select: { members: true } },
        owner: { select: { name: true, avatarUrl: true } },
        members: {
          take: 5,
          include: {
            user: { select: { name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return reply.send(teams);
  });

  // ── 鉴权端点 ──────────────────────────────────────────────────────────

  // GET /teams —— 我的团队列表
  app.get('/teams', { preHandler: [fastifyAuthenticate] }, async (request, reply) => {
    const userId = requireUserId(request);
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(teams);
  });

  // GET /teams/stats —— 团队统计
  app.get('/teams/stats', { preHandler: [fastifyAuthenticate] }, async (_request, reply) => {
    const count = await prisma.team.count({
      where: {
        type: 'TEAM',
      },
    });
    return reply.send({ activeTeamsCount: count });
  });

  // POST /teams —— 创建团队
  app.post(
    '/teams',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: createTeamSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const {
        name,
        description,
        avatarUrl,
        visibility = 'PUBLIC',
        category,
      } = request.body as {
        name: string;
        description?: string;
        avatarUrl?: string;
        visibility?: string;
        category?: string;
      };

      if (!name || !name.trim()) {
        throw new AppError('团队名称不能为空', 400);
      }

      const quota = await checkTeamQuota(userId);
      if (!quota.allowed) {
        throw new AppError(quota.message || 'Quota exceeded', 403);
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
        req: buildAuditReq(request),
      });

      return reply.status(201).send(team);
    },
  );

  // ── 邀请 ─────────────────────────────────────────────────────────────

  // GET /teams/invitations/my —— 我的待处理邀请
  app.get(
    '/teams/invitations/my',
    { preHandler: [fastifyAuthenticate] },
    async (request, reply) => {
      const userId = requireUserId(request);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('User not found', 404);

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
      return reply.send(invitations);
    },
  );

  // POST /teams/invitations/respond —— 接受/拒绝邀请
  app.post(
    '/teams/invitations/respond',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: respondToInvitationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { invitationId, accept } = request.body as {
        invitationId: string;
        accept: unknown;
      };

      const shouldAccept = parseBooleanDecision(accept, 'accept');
      const invitation = await prisma.teamInvitation.findUnique({
        where: { id: invitationId },
        include: { team: true },
      });

      if (!invitation || invitation.status !== 'PENDING') {
        throw new AppError('Invitation not found or already processed', 404);
      }

      if (invitation.expiresAt < new Date()) {
        await prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'REJECTED' },
        });
        throw new AppError('邀请已过期', 400);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || normalizeEmail(user.email) !== normalizeEmail(invitation.inviteeEmail)) {
        throw new AppError('Unauthorized', 403);
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
          throw new AppError('你已经是该团队的成员', 400);
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
        return reply.send({ message: 'Joined team successfully' });
      } else {
        await prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: 'REJECTED' },
        });
        return reply.send({ message: 'Invitation rejected' });
      }
    },
  );

  // DELETE /teams/invitations/:invitationId —— 取消邀请
  app.delete(
    '/teams/invitations/:invitationId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: invitationIdParamsSchema },
    },
    async (request, reply) => {
      const currentUserId = requireUserId(request);
      const { invitationId } = request.params as { invitationId: string };

      const invitation = await prisma.teamInvitation.findUnique({
        where: { id: invitationId },
        include: { team: { include: { members: true } } },
      });

      if (!invitation) throw new AppError('Invitation not found', 404);

      const currentMember = invitation.team.members.find((m) => m.userId === currentUserId);
      if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
        throw new AppError('Unauthorized', 403);
      }

      await prisma.teamInvitation.delete({ where: { id: invitationId } });
      return reply.send({ message: 'Invitation cancelled' });
    },
  );

  // POST /teams/invite —— 邀请成员
  app.post(
    '/teams/invite',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: inviteToTeamSchema },
    },
    async (request, reply) => {
      const inviterId = requireUserId(request);
      const { teamId, inviteeEmail } = request.body as {
        teamId: string;
        inviteeEmail: string;
      };
      const normalizedEmail = normalizeEmail(inviteeEmail);

      // Check if team exists and user is owner/admin
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      if (team.type === 'PERSONAL') {
        throw new AppError('个人空间不允许邀请其他成员', 400);
      }

      const member = team.members.find((m) => m.userId === inviterId);
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new AppError('Unauthorized to invite', 403);
      }

      // Check if already invited or member
      const existingMember = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          teamMemberships: { some: { teamId } },
        },
      });
      if (existingMember) throw new AppError('User is already a member', 400);

      const existingInvitation = await prisma.teamInvitation.findFirst({
        where: {
          teamId,
          inviteeEmail: normalizedEmail,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      });
      if (existingInvitation) throw new AppError('该邮箱已有待处理的邀请', 400);

      const invitation = await prisma.teamInvitation.create({
        data: {
          teamId,
          inviterId,
          inviteeEmail: normalizedEmail,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Create notification for invitee if they exist
      const invitee = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (invitee) {
        await createNotification({
          type: 'TEAM',
          title: '收到团队邀请',
          content: `${request.user?.name || '有人'} 邀请你加入团队: ${team.name}`,
          userId: invitee.id,
          link: `/team/${teamId}?invitationId=${invitation.id}`,
          category: 'TEAM_ACTIVITY',
        });
      }
      return reply.status(201).send(invitation);
    },
  );

  // ── 申请加入 ──────────────────────────────────────────────────────────

  // POST /teams/apply —— 申请加入团队
  app.post(
    '/teams/apply',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: applyToTeamSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId, message } = request.body as { teamId: string; message?: string };

      // Check if team exists
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) throw new AppError('Team not found', 404);
      if (team.type === 'PERSONAL') {
        throw new AppError('Cannot apply to personal space', 400);
      }
      if (team.visibility === 'PRIVATE') {
        throw new AppError('私密团队不支持申请加入，请通过邀请加入', 400);
      }

      // Check if already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      if (existingMember) throw new AppError('Already a member', 400);

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
        content: `${request.user?.name || '有人'} 申请加入你的团队: ${team.name}`,
        userId: team.ownerId,
        link: `/team/${teamId}`,
        category: 'TEAM_ACTIVITY',
      });

      return reply.status(201).send(application);
    },
  );

  // POST /teams/applications/respond —— 处理加入申请
  app.post(
    '/teams/applications/respond',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: respondToApplicationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { applicationId, accept } = request.body as {
        applicationId: string;
        accept: unknown;
      };

      const shouldAccept = parseBooleanDecision(accept, 'accept');
      const application = await prisma.teamApplication.findUnique({
        where: { id: applicationId },
        include: { team: true },
      });

      if (!application || application.status !== 'PENDING') {
        throw new AppError('Application not found or already processed', 404);
      }

      // Check if user is owner/admin of the team
      const member = await prisma.teamMember.findFirst({
        where: { teamId: application.teamId, userId, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!member) throw new AppError('Unauthorized', 403);

      if (shouldAccept) {
        const existingMembership = await prisma.teamMember.findUnique({
          where: {
            teamId_userId: { teamId: application.teamId, userId: application.userId },
          },
        });
        if (existingMembership) {
          await prisma.teamApplication.update({
            where: { id: applicationId },
            data: { status: 'APPROVED' },
          });
          throw new AppError('该用户已经是团队成员', 400);
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

        return reply.send({ message: 'Application approved' });
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

        return reply.send({ message: 'Application rejected' });
      }
    },
  );

  // ── 直接添加成员 ──────────────────────────────────────────────────────

  // POST /teams/members —— 直接添加成员
  app.post(
    '/teams/members',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: addMemberDirectlySchema },
    },
    async (request, reply) => {
      const currentUserId = requireUserId(request);
      const { teamId, userId } = request.body as {
        teamId: string;
        userId: string;
        role?: string;
      };
      const role = normalizeManagedRole((request.body as { role?: string }).role);

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      if (team.type === 'PERSONAL') {
        throw new AppError('个人空间不允许添加其他成员', 400);
      }

      // Check permissions
      const currentMember = team.members.find((m) => m.userId === currentUserId);
      if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
        throw new AppError('Unauthorized to add members', 403);
      }

      if (role === 'ADMIN' && currentMember.role !== 'OWNER') {
        throw new AppError('Only owner can add admin members', 403);
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!targetUser) {
        throw new AppError('User not found', 404);
      }

      // Check if user already a member
      const existingMember = team.members.find((m) => m.userId === userId);
      if (existingMember) throw new AppError('User is already a member', 400);

      const newMember = await prisma.teamMember.create({
        data: {
          teamId,
          userId,
          role,
        },
      });

      return reply.status(201).send(newMember);
    },
  );

  // ── 参数路由 ──────────────────────────────────────────────────────────

  // GET /teams/:teamId/overview —— 团队总览
  app.get(
    '/teams/:teamId/overview',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  role: true,
                  createdAt: true,
                  subscription: { include: { plan: true } },
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
          invitations: {
            where: { status: 'PENDING', expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
          },
          applications: {
            where: { status: 'PENDING' },
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!team) throw new AppError('Team not found', 404);

      const currentMember = team.members.find((member) => member.userId === userId);
      if (!currentMember && request.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden', 403);
      }

      const now = new Date();
      const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [projects, tasks, assetsCount, materialsCount, showcasesCount] = await Promise.all([
        prisma.project.findMany({
          where: { teamId },
          include: {
            members: {
              select: {
                userId: true,
                role: true,
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
            _count: {
              select: { tasks: true, discussions: true, invitations: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.findMany({
          where: { teamId },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, title: true, color: true } },
            participants: {
              select: {
                userId: true,
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        }),
        prisma.asset.count({ where: { teamId } }),
        prisma.material.count({ where: { teamId } }),
        prisma.showcase.count({ where: { teamId } }),
      ]);

      const isTaskOverdue = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' && !!task.dueDate && task.dueDate < now;

      const isTaskDueSoon = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' &&
        !!task.dueDate &&
        task.dueDate >= now &&
        task.dueDate <= nextSevenDays;

      const tasksByAssignee = new Map<string, typeof tasks>();
      for (const task of tasks) {
        if (!task.assigneeId) continue;
        const assignedTasks = tasksByAssignee.get(task.assigneeId) || [];
        assignedTasks.push(task);
        tasksByAssignee.set(task.assigneeId, assignedTasks);
      }

      const projectsByMember = new Map<string, typeof projects>();
      for (const project of projects) {
        for (const member of project.members) {
          const memberProjects = projectsByMember.get(member.userId) || [];
          memberProjects.push(project);
          projectsByMember.set(member.userId, memberProjects);
        }
      }

      const tasksByProject = new Map<string, typeof tasks>();
      for (const task of tasks) {
        if (!task.projectId) continue;
        const projectTasks = tasksByProject.get(task.projectId) || [];
        projectTasks.push(task);
        tasksByProject.set(task.projectId, projectTasks);
      }

      const memberOverview = team.members.map((member) => {
        const assignedTasks = tasksByAssignee.get(member.userId) || [];
        const memberProjects = projectsByMember.get(member.userId) || [];
        const doneTasks = assignedTasks.filter((task) => task.status === 'DONE').length;
        const overdueTasks = assignedTasks.filter(isTaskOverdue).length;
        const dueSoonTasks = assignedTasks.filter(isTaskDueSoon).length;
        const activeTasks = assignedTasks.filter((task) => task.status !== 'DONE').length;
        const recentlyCompleted = assignedTasks.filter(
          (task) => task.status === 'DONE' && task.updatedAt >= lastSevenDays,
        ).length;
        const lastTaskAt = assignedTasks.reduce<Date | null>((latest, task) => {
          if (!latest || task.updatedAt > latest) return task.updatedAt;
          return latest;
        }, null);

        return {
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
          metrics: {
            projects: memberProjects.length,
            assignedTasks: assignedTasks.length,
            activeTasks,
            doneTasks,
            dueSoonTasks,
            overdueTasks,
            recentlyCompleted,
            completionRate: assignedTasks.length
              ? Math.round((doneTasks / assignedTasks.length) * 100)
              : 0,
            lastTaskAt,
          },
        };
      });

      const projectOverview = projects.map((project) => {
        const projectTasks = tasksByProject.get(project.id) || [];
        const done = projectTasks.filter((task) => task.status === 'DONE').length;
        const overdue = projectTasks.filter(isTaskOverdue).length;
        const dueSoon = projectTasks.filter(isTaskDueSoon).length;
        const unassigned = projectTasks.filter(
          (task) => !task.assigneeId && task.status !== 'DONE',
        ).length;

        return {
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,
          progress: project.progress,
          dueDate: project.dueDate,
          color: project.color,
          visibility: project.visibility,
          updatedAt: project.updatedAt,
          membersCount: project.members.length,
          ownerIds: project.members
            .filter((member) => member.role === 'OWNER')
            .map((member) => member.userId),
          tasks: {
            total: projectTasks.length,
            todo: projectTasks.filter((task) => task.status === 'TODO').length,
            inProgress: projectTasks.filter((task) => task.status === 'IN_PROGRESS').length,
            done,
            overdue,
            dueSoon,
            unassigned,
            completionRate: projectTasks.length
              ? Math.round((done / projectTasks.length) * 100)
              : 0,
          },
          counts: project._count,
        };
      });

      const overdueTasks = tasks.filter(isTaskOverdue);
      const dueSoonTasks = tasks.filter(isTaskDueSoon);
      const doneTasks = tasks.filter((task) => task.status === 'DONE');
      const activeProjects = projects.filter((project) => project.status === 'IN_PROGRESS');
      const completedProjects = projects.filter((project) => project.status === 'COMPLETED');
      const projectProgressTotal = projects.reduce(
        (sum, project) => sum + (project.progress || 0),
        0,
      );

      return reply.send({
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          avatarUrl: team.avatarUrl,
          coverUrl: team.coverUrl,
          type: team.type,
          visibility: team.visibility,
          category: team.category,
          ownerId: team.ownerId,
          owner: team.owner,
          createdAt: team.createdAt,
        },
        currentUserRole: currentMember?.role || (request.user?.role === 'ADMIN' ? 'ADMIN' : null),
        capabilities: {
          canManage:
            !!currentMember &&
            ['OWNER', 'ADMIN'].includes(currentMember.role) &&
            team.type !== 'PERSONAL',
          canInvite:
            !!currentMember &&
            ['OWNER', 'ADMIN'].includes(currentMember.role) &&
            team.type !== 'PERSONAL',
          canUpdateRoles: currentMember?.role === 'OWNER',
          canRemoveMembers:
            !!currentMember &&
            ['OWNER', 'ADMIN'].includes(currentMember.role) &&
            team.type !== 'PERSONAL',
          canLeave: !!currentMember && currentMember.role !== 'OWNER' && team.type !== 'PERSONAL',
        },
        counts: {
          members: team.members.length,
          admins: team.members.filter((member) => ['OWNER', 'ADMIN'].includes(member.role)).length,
          pendingInvitations: team.invitations.length,
          pendingApplications: team.applications.length,
          projects: projects.length,
          activeProjects: activeProjects.length,
          completedProjects: completedProjects.length,
          tasks: tasks.length,
          todoTasks: tasks.filter((task) => task.status === 'TODO').length,
          inProgressTasks: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
          doneTasks: doneTasks.length,
          overdueTasks: overdueTasks.length,
          dueSoonTasks: dueSoonTasks.length,
          unassignedTasks: tasks.filter((task) => !task.assigneeId && task.status !== 'DONE')
            .length,
          completedThisWeek: doneTasks.filter((task) => task.updatedAt >= lastSevenDays).length,
          averageProjectProgress: projects.length
            ? Math.round(projectProgressTotal / projects.length)
            : 0,
          assets: assetsCount,
          materials: materialsCount,
          showcases: showcasesCount,
        },
        projects: projectOverview,
        members: memberOverview,
        tasks: {
          dueSoon: dueSoonTasks.slice(0, 8),
          overdue: overdueTasks.slice(0, 8),
          recentlyUpdated: tasks
            .slice()
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 8),
        },
        invitations: team.invitations,
        applications: team.applications,
      });
    },
  );

  // GET /teams/:teamId/collaboration-insights —— 协作洞察
  app.get(
    '/teams/:teamId/collaboration-insights',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
            },
            orderBy: { joinedAt: 'asc' },
          },
          invitations: {
            where: { status: 'PENDING', expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
          },
          applications: {
            where: { status: 'PENDING' },
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!team) throw new AppError('Team not found', 404);

      const currentMember = team.members.find((member) => member.userId === userId);
      if (!currentMember && request.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden', 403);
      }

      const now = new Date();
      const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [projects, tasks, discussions] = await Promise.all([
        prisma.project.findMany({
          where: { teamId },
          include: {
            members: {
              select: {
                userId: true,
                role: true,
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
            _count: { select: { discussions: true, invitations: true, tasks: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.findMany({
          where: { teamId },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, title: true, color: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        }),
        prisma.projectDiscussion.findMany({
          where: { project: { teamId } },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, title: true, color: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
      ]);

      const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
      const daysLeft = (dueDate?: Date | null) => {
        if (!dueDate) return null;
        return Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      };
      const isOverdue = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' && !!task.dueDate && task.dueDate < now;
      const isDueSoon = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' &&
        !!task.dueDate &&
        task.dueDate >= now &&
        task.dueDate <= nextSevenDays;

      const tasksByProject = new Map<string, typeof tasks>();
      const tasksByAssignee = new Map<string, typeof tasks>();
      const projectsByMember = new Map<string, typeof projects>();

      for (const task of tasks) {
        if (task.projectId) {
          const projectTasks = tasksByProject.get(task.projectId) || [];
          projectTasks.push(task);
          tasksByProject.set(task.projectId, projectTasks);
        }
        if (task.assigneeId) {
          const memberTasks = tasksByAssignee.get(task.assigneeId) || [];
          memberTasks.push(task);
          tasksByAssignee.set(task.assigneeId, memberTasks);
        }
      }

      for (const project of projects) {
        for (const member of project.members) {
          const memberProjects = projectsByMember.get(member.userId) || [];
          memberProjects.push(project);
          projectsByMember.set(member.userId, memberProjects);
        }
      }

      const projectHealth = projects
        .map((project) => {
          const projectTasks = tasksByProject.get(project.id) || [];
          const done = projectTasks.filter((task) => task.status === 'DONE').length;
          const overdue = projectTasks.filter(isOverdue).length;
          const dueSoon = projectTasks.filter(isDueSoon).length;
          const unassigned = projectTasks.filter(
            (task) => task.status !== 'DONE' && !task.assigneeId,
          ).length;
          const left = daysLeft(project.dueDate);
          const reasons: string[] = [];
          let score = 100;

          if (overdue > 0) {
            score -= overdue * 18;
            reasons.push(`${overdue} 个逾期任务`);
          }
          if (unassigned > 0) {
            score -= unassigned * 8;
            reasons.push(`${unassigned} 个任务待分配`);
          }
          if (dueSoon > 0) {
            score -= dueSoon * 5;
            reasons.push(`${dueSoon} 个任务 7 天内到期`);
          }
          if (project.status === 'PAUSED') {
            score -= 12;
            reasons.push('项目已暂停');
          }
          if (left !== null && left < 0) {
            score -= 18;
            reasons.push(`项目已超期 ${Math.abs(left)} 天`);
          }
          if (projectTasks.length === 0) {
            score -= 10;
            reasons.push('尚未拆解任务');
          }

          const healthScore = clampScore(score);
          const riskLevel = healthScore < 55 ? 'HIGH' : healthScore < 78 ? 'MEDIUM' : 'LOW';

          return {
            id: project.id,
            title: project.title,
            status: project.status,
            progress: project.progress,
            dueDate: project.dueDate,
            daysLeft: left,
            membersCount: project.members.length,
            discussionCount: project._count.discussions,
            taskCount: projectTasks.length,
            doneTasks: done,
            activeTasks: projectTasks.filter((task) => task.status !== 'DONE').length,
            overdueTasks: overdue,
            dueSoonTasks: dueSoon,
            unassignedTasks: unassigned,
            completionRate: projectTasks.length
              ? Math.round((done / projectTasks.length) * 100)
              : 0,
            healthScore,
            riskLevel,
            reasons: reasons.length ? reasons : ['节奏稳定'],
            updatedAt: project.updatedAt,
          };
        })
        .sort((a, b) => {
          if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

      const averageActiveTasks = team.members.length
        ? tasks.filter((task) => task.status !== 'DONE').length / team.members.length
        : 0;

      const memberCapacity = team.members
        .map((member) => {
          const assignedTasks = tasksByAssignee.get(member.userId) || [];
          const memberProjects = projectsByMember.get(member.userId) || [];
          const activeTasks = assignedTasks.filter((task) => task.status !== 'DONE').length;
          const doneTasks = assignedTasks.filter((task) => task.status === 'DONE').length;
          const overdueTasks = assignedTasks.filter(isOverdue).length;
          const dueSoonTasks = assignedTasks.filter(isDueSoon).length;
          const completedThisWeek = assignedTasks.filter(
            (task) => task.status === 'DONE' && task.updatedAt >= lastSevenDays,
          ).length;
          const capacityScore = clampScore(
            100 - activeTasks * 9 - overdueTasks * 18 - dueSoonTasks * 4 + completedThisWeek * 4,
          );
          const focus =
            overdueTasks > 0
              ? '需要协助'
              : activeTasks > averageActiveTasks + 3
                ? '负载偏高'
                : activeTasks === 0
                  ? '可承接'
                  : '稳定推进';

          return {
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            user: member.user,
            projects: memberProjects.length,
            assignedTasks: assignedTasks.length,
            activeTasks,
            doneTasks,
            overdueTasks,
            dueSoonTasks,
            completedThisWeek,
            completionRate: assignedTasks.length
              ? Math.round((doneTasks / assignedTasks.length) * 100)
              : 0,
            capacityScore,
            focus,
            lastActiveAt:
              assignedTasks.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
                ?.updatedAt || member.joinedAt,
          };
        })
        .sort((a, b) => {
          if (a.capacityScore !== b.capacityScore) return a.capacityScore - b.capacityScore;
          return b.activeTasks - a.activeTasks;
        });

      const overdueTasks = tasks.filter(isOverdue);
      const dueSoonTasks = tasks.filter(isDueSoon);
      const unassignedTasks = tasks.filter((task) => task.status !== 'DONE' && !task.assigneeId);
      const doneTasks = tasks.filter((task) => task.status === 'DONE');
      const activeTasks = tasks.filter((task) => task.status !== 'DONE');
      const completedThisWeek = doneTasks.filter((task) => task.updatedAt >= lastSevenDays);
      const highRiskProjects = projectHealth.filter((project) => project.riskLevel === 'HIGH');
      const recommendedAssignee =
        memberCapacity.find((member) => member.overdueTasks === 0) || memberCapacity[0] || null;

      const actionItems = [
        ...overdueTasks.slice(0, 6).map((task) => ({
          id: `task-overdue-${task.id}`,
          type: 'TASK_OVERDUE',
          severity: 'critical',
          title: task.title,
          description: `${task.project?.title || '独立任务'} 已逾期，需要立即推进`,
          dueDate: task.dueDate,
          projectId: task.projectId,
          assignee: task.assignee,
          targetRoute: `/work${task.projectId ? `?projectId=${task.projectId}` : ''}`,
        })),
        ...unassignedTasks.slice(0, 6).map((task) => ({
          id: `task-unassigned-${task.id}`,
          type: 'TASK_UNASSIGNED',
          severity: 'high',
          title: task.title,
          description: `${task.project?.title || '独立任务'} 缺少负责人`,
          dueDate: task.dueDate,
          projectId: task.projectId,
          assignee: null,
          targetRoute: `/work${task.projectId ? `?projectId=${task.projectId}` : ''}`,
        })),
        ...dueSoonTasks.slice(0, 6).map((task) => ({
          id: `task-due-${task.id}`,
          type: 'TASK_DUE_SOON',
          severity: 'medium',
          title: task.title,
          description: `${task.project?.title || '独立任务'} 即将到期`,
          dueDate: task.dueDate,
          projectId: task.projectId,
          assignee: task.assignee,
          targetRoute: `/work${task.projectId ? `?projectId=${task.projectId}` : ''}`,
        })),
        ...team.applications.slice(0, 4).map((application) => ({
          id: `application-${application.id}`,
          type: 'TEAM_APPLICATION',
          severity: 'medium',
          title: application.user.name || application.user.email || '新的加入申请',
          description: application.message || '等待管理员处理加入申请',
          dueDate: null,
          projectId: null,
          assignee: application.user,
          targetRoute: '/members',
        })),
      ]
        .sort((a, b) => {
          const weight = { critical: 0, high: 1, medium: 2 };
          return (
            weight[a.severity as keyof typeof weight] - weight[b.severity as keyof typeof weight]
          );
        })
        .slice(0, 10);

      const operationalLanes = [
        {
          key: 'overdue',
          label: '逾期清理',
          count: overdueTasks.length,
          severity: overdueTasks.length > 0 ? 'critical' : 'low',
          targetRoute: '/work',
        },
        {
          key: 'unassigned',
          label: '待分配',
          count: unassignedTasks.length,
          severity: unassignedTasks.length > 0 ? 'high' : 'low',
          targetRoute: '/work',
        },
        {
          key: 'dueSoon',
          label: '7 天交付',
          count: dueSoonTasks.length,
          severity: dueSoonTasks.length > 0 ? 'medium' : 'low',
          targetRoute: '/work',
        },
        {
          key: 'riskProjects',
          label: '风险项目',
          count: projectHealth.filter((project) => project.riskLevel !== 'LOW').length,
          severity: highRiskProjects.length > 0 ? 'high' : 'low',
          targetRoute: '/team-tasks',
        },
      ];

      const activity = [
        ...tasks.slice(0, 10).map((task) => ({
          id: `task-${task.id}`,
          type: 'TASK',
          title: task.title,
          description: task.project?.title || '独立任务',
          actor: task.assignee || null,
          project: task.project,
          createdAt: task.updatedAt,
          targetRoute: `/work${task.projectId ? `?projectId=${task.projectId}` : ''}`,
        })),
        ...projects.slice(0, 8).map((project) => ({
          id: `project-${project.id}`,
          type: 'PROJECT',
          title: project.title,
          description: `进度 ${project.progress}% · ${project.members.length} 人参与`,
          actor: team.owner,
          project: { id: project.id, title: project.title, color: project.color },
          createdAt: project.updatedAt,
          targetRoute: `/work?projectId=${project.id}`,
        })),
        ...discussions.map((discussion) => ({
          id: `discussion-${discussion.id}`,
          type: 'DISCUSSION',
          title: discussion.content.slice(0, 48) || '项目讨论',
          description: discussion.project.title,
          actor: discussion.user,
          project: discussion.project,
          createdAt: discussion.createdAt,
          targetRoute: `/project/${discussion.projectId}`,
        })),
        ...team.invitations.slice(0, 6).map((invitation) => ({
          id: `invitation-${invitation.id}`,
          type: 'INVITATION',
          title: invitation.inviteeEmail,
          description: '团队邀请待确认',
          actor: team.owner,
          project: null,
          createdAt: invitation.createdAt,
          targetRoute: '/members',
        })),
        ...team.applications.slice(0, 6).map((application) => ({
          id: `application-activity-${application.id}`,
          type: 'APPLICATION',
          title: application.user.name || application.user.email || '加入申请',
          description: application.message || '申请加入团队',
          actor: application.user,
          project: null,
          createdAt: application.createdAt,
          targetRoute: '/members',
        })),
      ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 14);

      const healthScore = clampScore(
        96 -
          overdueTasks.length * 7 -
          unassignedTasks.length * 4 -
          highRiskProjects.length * 8 -
          team.applications.length * 2 -
          Math.max(0, activeTasks.length - team.members.length * 5) * 2 +
          completedThisWeek.length * 2,
      );

      return reply.send({
        team: {
          id: team.id,
          name: team.name,
          type: team.type,
          visibility: team.visibility,
          owner: team.owner,
        },
        generatedAt: now,
        summary: {
          healthScore,
          members: team.members.length,
          projects: projects.length,
          activeProjects: projects.filter((project) => project.status === 'IN_PROGRESS').length,
          tasks: tasks.length,
          activeTasks: activeTasks.length,
          completedTasks: doneTasks.length,
          completedThisWeek: completedThisWeek.length,
          overdueTasks: overdueTasks.length,
          dueSoonTasks: dueSoonTasks.length,
          unassignedTasks: unassignedTasks.length,
          pendingInvitations: team.invitations.length,
          pendingApplications: team.applications.length,
          highRiskProjects: highRiskProjects.length,
          averageProjectProgress: projects.length
            ? Math.round(
                projects.reduce((sum, project) => sum + (project.progress || 0), 0) /
                  projects.length,
              )
            : 0,
        },
        projectHealth,
        memberCapacity,
        recommendedAssignee: recommendedAssignee
          ? {
              user: recommendedAssignee.user,
              capacityScore: recommendedAssignee.capacityScore,
              activeTasks: recommendedAssignee.activeTasks,
              overdueTasks: recommendedAssignee.overdueTasks,
              completedThisWeek: recommendedAssignee.completedThisWeek,
              reason:
                recommendedAssignee.overdueTasks > 0
                  ? '仍有逾期任务，建议只承接关键协助'
                  : recommendedAssignee.activeTasks === 0
                    ? '当前无活跃任务，适合承接新派发'
                    : `当前 ${recommendedAssignee.activeTasks} 个活跃任务，容量分 ${recommendedAssignee.capacityScore}`,
            }
          : null,
        operationalLanes,
        actionItems,
        activity,
      });
    },
  );

  // GET /teams/:teamId —— 团队详情
  app.get(
    '/teams/:teamId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };

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
                    include: { plan: true },
                  },
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      });

      if (!team) throw new AppError('Team not found', 404);

      const isMember = team.members.some((m) => m.userId === userId);

      if (isMember) {
        const [invitations, applications] = await Promise.all([
          prisma.teamInvitation.findMany({
            where: { teamId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.teamApplication.findMany({
            where: { teamId, status: 'PENDING' },
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        return reply.send({
          ...team,
          invitations,
          applications,
        });
      } else {
        if (team.visibility !== 'PUBLIC') {
          throw new AppError('Forbidden', 403);
        }
        return reply.send(team);
      }
    },
  );

  // PATCH /teams/:teamId —— 更新团队
  app.patch(
    '/teams/:teamId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema, body: updateTeamSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };
      const { name, description, avatarUrl, visibility, category } = request.body as {
        name?: string;
        description?: string;
        avatarUrl?: string;
        visibility?: string;
        category?: string;
      };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      const member = team.members.find((m) => m.userId === userId);
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new AppError('Unauthorized', 403);
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
        userId,
        action: AuditAction.UPDATE_USER, // Keep aligned with existing audit setup
        module: AuditModule.TEAM,
        description: `Updated team: ${updated.name}`,
        oldValue: team,
        newValue: updated,
        req: buildAuditReq(request),
      });

      return reply.send(updated);
    },
  );

  // POST /teams/:teamId/upload-avatar —— 上传团队头像
  app.post(
    '/teams/:teamId/upload-avatar',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'avatar', maxCount: 1 }])],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };
      const file = (request as FastifyRequest & { file?: UploadedFile }).file;
      if (!file) {
        throw new AppError('请选择要上传的头像图片', 400);
      }

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      const member = team.members.find((m) => m.userId === userId);
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new AppError('Unauthorized', 403);
      }

      const avatarUrl = getUploadedFileUrl(request, file, 'avatars');

      // Unlink old avatar if it existed
      if (team.avatarUrl) {
        deleteCloudOrLocalFileByUrl(team.avatarUrl).catch((err) => {
          logger.error('[TeamRoutes] Failed to delete old team avatar:', err);
        });
      }

      const updated = await prisma.team.update({
        where: { id: teamId },
        data: { avatarUrl },
      });

      await auditService.log({
        userId,
        action: AuditAction.UPDATE_USER, // Keep aligned with existing audit setup
        module: AuditModule.TEAM,
        description: `Updated team avatar for: ${updated.name}`,
        req: buildAuditReq(request),
      });

      return reply.send(updated);
    },
  );

  // POST /teams/:teamId/upload-cover —— 上传团队封面
  app.post(
    '/teams/:teamId/upload-cover',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'cover', maxCount: 1 }])],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };
      const file = (request as FastifyRequest & { file?: UploadedFile }).file;
      if (!file) {
        throw new AppError('请选择要上传的封面图片', 400);
      }

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      const member = team.members.find((m) => m.userId === userId);
      if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
        throw new AppError('Unauthorized', 403);
      }

      const coverUrl = getUploadedFileUrl(request, file, 'covers');

      // Unlink old cover if it existed
      if (team.coverUrl) {
        deleteCloudOrLocalFileByUrl(team.coverUrl).catch((err) => {
          logger.error('[TeamRoutes] Failed to delete old team cover:', err);
        });
      }

      const updated = await prisma.team.update({
        where: { id: teamId },
        data: { coverUrl },
      });

      await auditService.log({
        userId,
        action: AuditAction.UPDATE_TEAM,
        module: AuditModule.TEAM,
        description: `Updated team cover for: ${updated.name}`,
        req: buildAuditReq(request),
      });

      return reply.send(updated);
    },
  );

  // DELETE /teams/:teamId —— 删除团队（含 2FA / 邮箱验证码校验）
  app.delete(
    '/teams/:teamId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema, body: deleteTeamBodySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };
      const { code } = request.body as { code?: string };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
      });

      if (!team) throw new AppError('Team not found', 404);
      if (team.ownerId !== userId) throw new AppError('Only owner can delete team', 403);
      if (team.name === '公共空间' || team.type === 'PERSONAL') {
        throw new AppError('不能删除系统预置或个人空间', 400);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('用户不存在', 404);

      if (user.twoFactorEnabled) {
        if (!code) {
          return reply.status(400).send({ error: '需要两步验证码', twoFactorRequired: true });
        }
        const isValid = speakeasy.totp.verify({
          secret: user.twoFactorSecret!,
          encoding: 'base32',
          token: code,
          window: 1,
        });
        if (!isValid) throw new AppError('两步验证码错误', 400);
      } else {
        if (!code) {
          return reply
            .status(400)
            .send({ error: '需要邮箱验证码', emailVerificationRequired: true });
        }
        const record = await prisma.verificationCode.findFirst({
          where: {
            email: user.email,
            code,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!record) throw new AppError('验证码错误或已过期', 400);

        // Clean up verification code
        await prisma.verificationCode.delete({ where: { id: record.id } });
      }

      await prisma.team.delete({ where: { id: teamId } });

      await auditService.log({
        userId,
        action: AuditAction.DELETE_TEAM,
        module: AuditModule.TEAM,
        description: `Deleted team: ${team.name}`,
        oldValue: team,
        req: buildAuditReq(request),
      });

      return reply.send({ message: 'Team deleted successfully' });
    },
  );

  // ── 成员管理 ──────────────────────────────────────────────────────────

  // GET /teams/:teamId/members —— 团队成员列表
  app.get(
    '/teams/:teamId/members',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamIdParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { teamId } = request.params as { teamId: string };

      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) throw new AppError('Team not found', 404);

      if (team.visibility === 'PRIVATE') {
        const membership = await prisma.teamMember.findFirst({
          where: { teamId, userId },
        });
        if (!membership) throw new AppError('Forbidden', 403);
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
                include: { plan: true },
              },
            },
          },
        },
      });
      return reply.send(members);
    },
  );

  // GET /teams/:teamId/members/:userId/insight —— 成员洞察
  app.get(
    '/teams/:teamId/members/:userId/insight',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamMemberParamsSchema },
    },
    async (request, reply) => {
      const currentUserId = requireUserId(request);
      const { teamId, userId: targetUserId } = request.params as {
        teamId: string;
        userId: string;
      };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
            },
          },
        },
      });

      if (!team) throw new AppError('Team not found', 404);

      const currentMember = team.members.find((member) => member.userId === currentUserId);
      if (!currentMember && request.user?.role !== 'ADMIN') {
        throw new AppError('Forbidden', 403);
      }

      const targetMember = team.members.find((member) => member.userId === targetUserId);
      if (!targetMember) throw new AppError('Member not found', 404);

      const now = new Date();
      const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const lastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [projects, tasks] = await Promise.all([
        prisma.project.findMany({
          where: {
            teamId,
            members: { some: { userId: targetUserId } },
          },
          include: {
            members: {
              where: { userId: targetUserId },
              select: { role: true, joinedAt: true },
            },
            _count: { select: { discussions: true, tasks: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.findMany({
          where: {
            teamId,
            OR: [
              { assigneeId: targetUserId },
              { userId: targetUserId },
              { participants: { some: { userId: targetUserId } } },
            ],
          },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, title: true, color: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        }),
      ]);

      const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
      const isOverdue = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' && !!task.dueDate && task.dueDate < now;
      const isDueSoon = (task: (typeof tasks)[number]) =>
        task.status !== 'DONE' &&
        !!task.dueDate &&
        task.dueDate >= now &&
        task.dueDate <= nextSevenDays;
      const toTaskCard = (task: (typeof tasks)[number]) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        project: task.project
          ? { id: task.project.id, title: task.project.title, color: task.project.color }
          : null,
        assignee: task.assignee,
        targetRoute: `/work${task.projectId ? `?projectId=${task.projectId}` : ''}`,
      });

      const assignedTasks = tasks.filter((task) => task.assigneeId === targetUserId);
      const createdTasks = tasks.filter((task) => task.userId === targetUserId);
      const activeTasks = tasks.filter((task) => task.status !== 'DONE');
      const doneTasks = tasks.filter((task) => task.status === 'DONE');
      const overdueTasks = tasks.filter(isOverdue);
      const dueSoonTasks = tasks.filter(isDueSoon);
      const completedThisWeek = doneTasks.filter((task) => task.updatedAt >= lastSevenDays);
      const capacityScore = clampScore(
        100 -
          activeTasks.length * 8 -
          overdueTasks.length * 18 -
          dueSoonTasks.length * 5 +
          completedThisWeek.length * 5,
      );

      const projectCards = projects.map((project) => {
        const memberTasks = tasks.filter((task) => task.projectId === project.id);
        const projectDoneTasks = memberTasks.filter((task) => task.status === 'DONE').length;
        const projectOverdueTasks = memberTasks.filter(isOverdue).length;

        return {
          id: project.id,
          title: project.title,
          progress: project.progress,
          status: project.status,
          dueDate: project.dueDate,
          role: project.members[0]?.role || 'MEMBER',
          taskCount: memberTasks.length,
          projectTaskCount: project._count.tasks,
          discussionCount: project._count.discussions,
          activeTasks: memberTasks.filter((task) => task.status !== 'DONE').length,
          overdueTasks: projectOverdueTasks,
          completionRate: memberTasks.length
            ? Math.round((projectDoneTasks / memberTasks.length) * 100)
            : 0,
          updatedAt: project.updatedAt,
          targetRoute: `/work?projectId=${project.id}`,
        };
      });

      const recommendations = [];
      const firstOverdueTask = overdueTasks[0];
      if (firstOverdueTask) {
        recommendations.push({
          id: 'overdue',
          severity: 'critical',
          title: '先处理逾期任务',
          description: `${overdueTasks.length} 个任务已经逾期，建议先清空阻塞项。`,
          targetRoute: firstOverdueTask.projectId
            ? `/work?projectId=${firstOverdueTask.projectId}`
            : '/work',
        });
      }
      if (activeTasks.length >= 6) {
        recommendations.push({
          id: 'rebalance',
          severity: 'high',
          title: '拆分当前负载',
          description: `当前仍有 ${activeTasks.length} 个活跃任务，适合转派或拆成更小交付。`,
          targetRoute: '/work',
        });
      }
      const firstDueSoonTask = dueSoonTasks[0];
      if (firstDueSoonTask) {
        recommendations.push({
          id: 'due-soon',
          severity: 'medium',
          title: '锁定 7 天内交付',
          description: `${dueSoonTasks.length} 个任务即将到期，建议同步验收标准。`,
          targetRoute: firstDueSoonTask.projectId
            ? `/work?projectId=${firstDueSoonTask.projectId}`
            : '/work',
        });
      }
      if (activeTasks.length === 0) {
        recommendations.push({
          id: 'available',
          severity: 'low',
          title: '可承接新任务',
          description: '当前没有进行中的任务，可以进入新项目或支援风险成员。',
          targetRoute: '/work',
        });
      }
      if (recommendations.length === 0) {
        recommendations.push({
          id: 'steady',
          severity: 'low',
          title: '节奏稳定',
          description: '负载、交付和风险都处在可控区间，保持当前协作节奏。',
          targetRoute: '/work',
        });
      }

      const lastActiveAt =
        tasks.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.updatedAt ||
        targetMember.joinedAt;

      return reply.send({
        member: targetMember,
        stats: {
          projects: projects.length,
          assignedTasks: assignedTasks.length,
          createdTasks: createdTasks.length,
          activeTasks: activeTasks.length,
          doneTasks: doneTasks.length,
          overdueTasks: overdueTasks.length,
          dueSoonTasks: dueSoonTasks.length,
          completedThisWeek: completedThisWeek.length,
          completionRate: tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0,
          capacityScore,
          lastActiveAt,
        },
        tasks: {
          active: activeTasks.slice(0, 8).map(toTaskCard),
          overdue: overdueTasks.slice(0, 8).map(toTaskCard),
          dueSoon: dueSoonTasks.slice(0, 8).map(toTaskCard),
          recent: tasks
            .slice()
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 8)
            .map(toTaskCard),
        },
        projects: projectCards,
        recommendations: recommendations.slice(0, 4),
      });
    },
  );

  // DELETE /teams/:teamId/members/:userId —— 移除成员
  app.delete(
    '/teams/:teamId/members/:userId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamMemberParamsSchema },
    },
    async (request, reply) => {
      const currentUserId = requireUserId(request);
      const { teamId, userId } = request.params as { teamId: string; userId: string };

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      const currentMember = team.members.find((m) => m.userId === currentUserId);
      if (!currentMember) {
        throw new AppError('Unauthorized', 403);
      }

      const isSelfRemoval = currentUserId === userId;
      if (isSelfRemoval && (team.visibility === 'PUBLIC' || team.name === '公共空间')) {
        throw new AppError('公共空间不允许退出', 400);
      }

      if (isSelfRemoval && currentMember.role === 'OWNER') {
        throw new AppError('团队所有者不能退出，请先转让所有权', 400);
      }

      if (!isSelfRemoval && !['OWNER', 'ADMIN'].includes(currentMember.role)) {
        throw new AppError('Unauthorized', 403);
      }

      const targetMember = team.members.find((m) => m.userId === userId);
      if (!targetMember) throw new AppError('Member not found', 404);

      // Cannot remove owner
      if (targetMember.role === 'OWNER') throw new AppError('Cannot remove owner', 400);

      // Admins cannot remove other admins (only owner can)
      if (
        currentMember.role === 'ADMIN' &&
        targetMember.role === 'ADMIN' &&
        team.ownerId !== currentUserId
      ) {
        throw new AppError('Admins cannot remove other admins', 403);
      }

      await prisma.teamMember.delete({ where: { id: targetMember.id } });
      return reply.send({ message: 'Member removed successfully' });
    },
  );

  // PATCH /teams/:teamId/members/:userId/role —— 更新成员角色
  app.patch(
    '/teams/:teamId/members/:userId/role',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: teamMemberParamsSchema, body: updateMemberRoleSchema },
    },
    async (request, reply) => {
      const currentUserId = requireUserId(request);
      const { teamId, userId } = request.params as { teamId: string; userId: string };
      const role = normalizeManagedRole((request.body as { role: string }).role, '');

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: true },
      });

      if (!team) throw new AppError('Team not found', 404);

      const currentMember = team.members.find((m) => m.userId === currentUserId);
      if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
        throw new AppError('Unauthorized', 403);
      }

      const targetMember = team.members.find((m) => m.userId === userId);
      if (!targetMember) throw new AppError('Member not found', 404);

      // Only OWNER can promote/demote ADMINs
      if ((targetMember.role === 'ADMIN' || role === 'ADMIN') && currentMember.role !== 'OWNER') {
        throw new AppError('Only owner can manage admin roles', 403);
      }

      if (targetMember.role === 'OWNER') {
        throw new AppError('Cannot change owner role', 400);
      }

      const updated = await prisma.teamMember.update({
        where: { id: targetMember.id },
        data: { role },
      });

      return reply.send(updated);
    },
  );
};
