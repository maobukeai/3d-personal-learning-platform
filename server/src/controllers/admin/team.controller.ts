import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { createNotification } from '../../utils/notification';
import { createPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { TaskStatus } from '../../types/task';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

type TeamRiskFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'UNASSIGNED' | 'EMPTY';
type SortDirection = 'asc' | 'desc';

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const getStringParam = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getSortDirection = (value: unknown): SortDirection => (value === 'asc' ? 'asc' : 'desc');

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const maxDate = (...values: Array<Date | string | null | undefined>) => {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
};

const mapCountGroups = <T extends { teamId: string | null; _count: { _all: number } }>(
  groups: T[],
) =>
  new Map(
    groups.filter((group) => group.teamId).map((group) => [group.teamId!, group._count._all]),
  );

const mapMaxDateGroups = <
  Field extends string,
  T extends { teamId: string | null; _max: Record<Field, Date | null> },
>(
  groups: T[],
  field: Field,
) =>
  new Map(
    groups
      .filter((group) => group.teamId && group._max[field])
      .map((group) => [group.teamId!, group._max[field] as Date]),
  );

const buildTeamWhere = (query: Record<string, unknown>, now: Date): Prisma.TeamWhereInput => {
  const q = getStringParam(query.q) || getStringParam(query.search);
  const visibility = getStringParam(query.visibility);
  const category = getStringParam(query.category);
  const risk = (getStringParam(query.risk) || 'ALL') as TeamRiskFilter;
  const and: Prisma.TeamWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { owner: { is: { name: { contains: q } } } },
        { owner: { is: { email: { contains: q } } } },
      ],
    });
  }

  if (risk === 'PENDING') {
    and.push({
      OR: [
        { applications: { some: { status: 'PENDING' } } },
        { invitations: { some: { status: 'PENDING', expiresAt: { gt: now } } } },
      ],
    });
  }

  if (risk === 'OVERDUE') {
    and.push({
      tasks: { some: { status: { not: TaskStatus.DONE }, dueDate: { lt: now } } },
    });
  }

  if (risk === 'UNASSIGNED') {
    and.push({
      tasks: { some: { status: { not: TaskStatus.DONE }, assigneeId: null } },
    });
  }

  if (risk === 'EMPTY') {
    and.push({
      projects: { none: {} },
      tasks: { none: {} },
      assets: { none: {} },
      materials: { none: {} },
      showcases: { none: {} },
    });
  }

  return {
    type: 'TEAM',
    ...(visibility === 'PUBLIC' || visibility === 'PRIVATE' ? { visibility } : {}),
    ...(category ? { category } : {}),
    ...(and.length ? { AND: and } : {}),
  };
};

const buildTeamOrderBy = (query: Record<string, unknown>): Prisma.TeamOrderByWithRelationInput => {
  const sortBy = getStringParam(query.sortBy) || 'createdAt';
  const direction = getSortDirection(query.sortOrder);

  if (sortBy === 'name') return { name: direction };
  if (sortBy === 'updatedAt') return { updatedAt: direction };
  return { createdAt: direction };
};

export const getAllTeams = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const now = new Date();
    const { page, limit, skip } = getPaginationParams(req.query, 30, 100);
    const where = buildTeamWhere(req.query, now);
    const orderBy = buildTeamOrderBy(req.query);

    const [
      total,
      teams,
      visibilityGroups,
      totalMembers,
      totalProjects,
      totalTasks,
      totalAssets,
      totalMaterials,
      totalShowcases,
      pendingApplications,
      pendingInvitations,
      overdueTeams,
      pendingTeams,
      emptyTeams,
      categoryRows,
    ] = await prisma.$transaction([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        include: {
          owner: { select: userSelect },
          members: {
            include: { user: { select: userSelect } },
            orderBy: { joinedAt: 'asc' },
          },
          _count: {
            select: {
              members: true,
              assets: true,
              projects: true,
              tasks: true,
              materials: true,
              showcases: true,
              invitations: true,
              applications: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.team.groupBy({
        by: ['visibility'],
        where: { type: 'TEAM' },
        _count: { _all: true },
      }),
      prisma.teamMember.count({ where: { team: { type: 'TEAM' } } }),
      prisma.project.count({ where: { team: { type: 'TEAM' } } }),
      prisma.task.count({ where: { team: { type: 'TEAM' } } }),
      prisma.asset.count({ where: { team: { type: 'TEAM' } } }),
      prisma.material.count({ where: { team: { type: 'TEAM' } } }),
      prisma.showcase.count({ where: { team: { type: 'TEAM' } } }),
      prisma.teamApplication.count({ where: { team: { type: 'TEAM' }, status: 'PENDING' } }),
      prisma.teamInvitation.count({
        where: { team: { type: 'TEAM' }, status: 'PENDING', expiresAt: { gt: now } },
      }),
      prisma.team.count({
        where: {
          type: 'TEAM',
          tasks: { some: { status: { not: TaskStatus.DONE }, dueDate: { lt: now } } },
        },
      }),
      prisma.team.count({
        where: {
          type: 'TEAM',
          OR: [
            { applications: { some: { status: 'PENDING' } } },
            { invitations: { some: { status: 'PENDING', expiresAt: { gt: now } } } },
          ],
        },
      }),
      prisma.team.count({
        where: {
          type: 'TEAM',
          projects: { none: {} },
          tasks: { none: {} },
          assets: { none: {} },
          materials: { none: {} },
          showcases: { none: {} },
        },
      }),
      prisma.team.findMany({
        where: { type: 'TEAM', category: { not: null } },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    const teamIds = teams.map((team) => team.id);
    const [
      pageTasks,
      projectLatestGroups,
      projectProgressGroups,
      assetLatestGroups,
      materialLatestGroups,
      showcaseLatestGroups,
      pendingInvitationGroups,
      pendingApplicationGroups,
    ] =
      teamIds.length > 0
        ? await Promise.all([
            prisma.task.findMany({
              where: { teamId: { in: teamIds } },
              select: {
                teamId: true,
                status: true,
                dueDate: true,
                updatedAt: true,
                assigneeId: true,
              },
            }),
            prisma.project.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds } },
              _max: { updatedAt: true },
            }),
            prisma.project.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds } },
              _avg: { progress: true },
            }),
            prisma.asset.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds } },
              _max: { updatedAt: true },
            }),
            prisma.material.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds } },
              _max: { updatedAt: true },
            }),
            prisma.showcase.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds } },
              _max: { updatedAt: true },
            }),
            prisma.teamInvitation.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds }, status: 'PENDING', expiresAt: { gt: now } },
              _count: { _all: true },
            }),
            prisma.teamApplication.groupBy({
              by: ['teamId'],
              where: { teamId: { in: teamIds }, status: 'PENDING' },
              _count: { _all: true },
            }),
          ])
        : [[], [], [], [], [], [], [], []];

    const tasksByTeamId = new Map<string, typeof pageTasks>();
    for (const task of pageTasks) {
      if (!task.teamId) continue;
      const list = tasksByTeamId.get(task.teamId) || [];
      list.push(task);
      tasksByTeamId.set(task.teamId, list);
    }

    const projectLatestByTeamId = mapMaxDateGroups(projectLatestGroups, 'updatedAt');
    const assetLatestByTeamId = mapMaxDateGroups(assetLatestGroups, 'updatedAt');
    const materialLatestByTeamId = mapMaxDateGroups(materialLatestGroups, 'updatedAt');
    const showcaseLatestByTeamId = mapMaxDateGroups(showcaseLatestGroups, 'updatedAt');
    const pendingInvitationsByTeamId = mapCountGroups(pendingInvitationGroups);
    const pendingApplicationsByTeamId = mapCountGroups(pendingApplicationGroups);
    const progressByTeamId = new Map(
      projectProgressGroups
        .filter((group) => group.teamId)
        .map((group) => [group.teamId!, Math.round(group._avg.progress || 0)]),
    );

    const data = teams.map((team) => {
      const tasks = tasksByTeamId.get(team.id) || [];
      const activeTasks = tasks.filter((task) => task.status !== TaskStatus.DONE);
      const doneTasks = tasks.filter((task) => task.status === TaskStatus.DONE);
      const overdueTasks = activeTasks.filter((task) => task.dueDate && task.dueDate < now).length;
      const dueSoonTasks = activeTasks.filter((task) => {
        if (!task.dueDate || task.dueDate < now) return false;
        return task.dueDate.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000;
      }).length;
      const unassignedTasks = activeTasks.filter((task) => !task.assigneeId).length;
      const pendingTeamApplications = pendingApplicationsByTeamId.get(team.id) || 0;
      const pendingTeamInvitations = pendingInvitationsByTeamId.get(team.id) || 0;
      const healthScore = clampScore(
        96 -
          overdueTasks * 12 -
          unassignedTasks * 6 -
          pendingTeamApplications * 3 -
          Math.max(0, activeTasks.length - Math.max(1, team.members.length) * 5) * 2 +
          doneTasks.length,
      );

      return {
        ...team,
        metrics: {
          healthScore,
          riskLevel: healthScore < 60 ? 'HIGH' : healthScore < 80 ? 'MEDIUM' : 'LOW',
          activeTasks: activeTasks.length,
          doneTasks: doneTasks.length,
          overdueTasks,
          dueSoonTasks,
          unassignedTasks,
          completionRate: tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0,
          averageProjectProgress: progressByTeamId.get(team.id) || 0,
          pendingApplications: pendingTeamApplications,
          pendingInvitations: pendingTeamInvitations,
          admins: team.members.filter((member) => ['OWNER', 'ADMIN'].includes(member.role)).length,
          resourceTotal:
            (team._count?.assets || 0) +
            (team._count?.materials || 0) +
            (team._count?.showcases || 0),
          lastActivityAt: maxDate(
            team.updatedAt,
            tasks.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
              ?.updatedAt,
            projectLatestByTeamId.get(team.id),
            assetLatestByTeamId.get(team.id),
            materialLatestByTeamId.get(team.id),
            showcaseLatestByTeamId.get(team.id),
          ),
        },
      };
    });

    if (getStringParam(req.query.sortBy) === 'health') {
      const direction = getSortDirection(req.query.sortOrder);
      data.sort((a, b) =>
        direction === 'asc'
          ? a.metrics.healthScore - b.metrics.healthScore
          : b.metrics.healthScore - a.metrics.healthScore,
      );
    }

    const visibilityCount = new Map(
      visibilityGroups.map((group) => [group.visibility, group._count._all]),
    );

    reply.send({
      data,
      pagination: createPaginationMeta(page, limit, total),
      summary: {
        totalTeams: visibilityGroups.reduce((sum, group) => sum + group._count._all, 0),
        filteredTeams: total,
        publicTeams: visibilityCount.get('PUBLIC') || 0,
        privateTeams: visibilityCount.get('PRIVATE') || 0,
        totalMembers,
        totalProjects,
        totalTasks,
        totalResources: totalAssets + totalMaterials + totalShowcases,
        totalAssets,
        totalMaterials,
        totalShowcases,
        pendingApplications,
        pendingInvitations,
        overdueTeams,
        pendingTeams,
        emptyTeams,
      },
      filters: {
        categories: categoryRows
          .map((row) => row.category)
          .filter((category): category is string => Boolean(category)),
      },
    });
  } catch (error) {
    throw error;
  }
};

export const getTeamDetail = async (req: AdminRequest, reply: FastifyReply) => {
  const teamId = req.params.id as string;
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, type: 'TEAM' },
      include: {
        owner: { select: userSelect },
        members: {
          include: { user: { select: userSelect } },
          orderBy: { joinedAt: 'asc' },
        },
        invitations: {
          where: { status: 'PENDING', expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
        },
        applications: {
          where: { status: 'PENDING' },
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            members: true,
            assets: true,
            projects: true,
            tasks: true,
            materials: true,
            showcases: true,
            invitations: true,
            applications: true,
          },
        },
      },
    });

    if (!team) throw new AppError('Team not found', 404);

    const [projects, tasks, assets, materials, showcases] = await Promise.all([
      prisma.project.findMany({
        where: { teamId },
        include: {
          members: {
            select: {
              userId: true,
              role: true,
              user: { select: userSelect },
            },
          },
          _count: { select: { tasks: true, discussions: true, invitations: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      prisma.task.findMany({
        where: { teamId },
        include: {
          assignee: { select: userSelect },
          project: { select: { id: true, title: true, color: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.asset.findMany({
        where: { teamId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          thumbnail: true,
          updatedAt: true,
          user: { select: userSelect },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.material.findMany({
        where: { teamId },
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          previewUrl: true,
          updatedAt: true,
          user: { select: userSelect },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.showcase.findMany({
        where: { teamId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          thumbnailUrl: true,
          updatedAt: true,
          user: { select: userSelect },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);

    const isOverdue = (task: (typeof tasks)[number]) =>
      task.status !== TaskStatus.DONE && !!task.dueDate && task.dueDate < now;
    const isDueSoon = (task: (typeof tasks)[number]) =>
      task.status !== TaskStatus.DONE &&
      !!task.dueDate &&
      task.dueDate >= now &&
      task.dueDate <= nextSevenDays;

    const tasksByAssignee = new Map<string, typeof tasks>();
    const tasksByProject = new Map<string, typeof tasks>();
    const projectsByMember = new Map<string, typeof projects>();

    for (const task of tasks) {
      if (task.assigneeId) {
        const assigned = tasksByAssignee.get(task.assigneeId) || [];
        assigned.push(task);
        tasksByAssignee.set(task.assigneeId, assigned);
      }
      if (task.projectId) {
        const projectTasks = tasksByProject.get(task.projectId) || [];
        projectTasks.push(task);
        tasksByProject.set(task.projectId, projectTasks);
      }
    }

    for (const project of projects) {
      for (const member of project.members) {
        const memberProjects = projectsByMember.get(member.userId) || [];
        memberProjects.push(project);
        projectsByMember.set(member.userId, memberProjects);
      }
    }

    const overdueTasks = tasks.filter(isOverdue);
    const dueSoonTasks = tasks.filter(isDueSoon);
    const unassignedTasks = tasks.filter(
      (task) => task.status !== TaskStatus.DONE && !task.assigneeId,
    );
    const doneTasks = tasks.filter((task) => task.status === TaskStatus.DONE);
    const activeTasks = tasks.filter((task) => task.status !== TaskStatus.DONE);
    const completedThisWeek = doneTasks.filter((task) => task.updatedAt >= lastSevenDays);

    const members = team.members.map((member) => {
      const assignedTasks = tasksByAssignee.get(member.userId) || [];
      const memberProjects = projectsByMember.get(member.userId) || [];
      const memberDoneTasks = assignedTasks.filter((task) => task.status === TaskStatus.DONE);
      const memberActiveTasks = assignedTasks.filter((task) => task.status !== TaskStatus.DONE);
      const memberOverdueTasks = assignedTasks.filter(isOverdue);
      const memberDueSoonTasks = assignedTasks.filter(isDueSoon);
      const lastTask = assignedTasks
        .slice()
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

      return {
        ...member,
        metrics: {
          projects: memberProjects.length,
          assignedTasks: assignedTasks.length,
          activeTasks: memberActiveTasks.length,
          doneTasks: memberDoneTasks.length,
          overdueTasks: memberOverdueTasks.length,
          dueSoonTasks: memberDueSoonTasks.length,
          completedThisWeek: memberDoneTasks.filter((task) => task.updatedAt >= lastSevenDays)
            .length,
          completionRate: assignedTasks.length
            ? Math.round((memberDoneTasks.length / assignedTasks.length) * 100)
            : 0,
          capacityScore: clampScore(
            100 -
              memberActiveTasks.length * 8 -
              memberOverdueTasks.length * 18 -
              memberDueSoonTasks.length * 5,
          ),
          lastActiveAt: lastTask?.updatedAt || member.joinedAt,
        },
      };
    });

    const projectHealth = projects.map((project) => {
      const projectTasks = tasksByProject.get(project.id) || [];
      const projectDoneTasks = projectTasks.filter((task) => task.status === TaskStatus.DONE);
      const projectOverdueTasks = projectTasks.filter(isOverdue);
      const projectDueSoonTasks = projectTasks.filter(isDueSoon);
      const projectUnassignedTasks = projectTasks.filter(
        (task) => task.status !== TaskStatus.DONE && !task.assigneeId,
      );
      const healthScore = clampScore(
        100 -
          projectOverdueTasks.length * 18 -
          projectUnassignedTasks.length * 8 -
          projectDueSoonTasks.length * 5 -
          (projectTasks.length === 0 ? 10 : 0),
      );

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
        counts: project._count,
        tasks: {
          total: projectTasks.length,
          active: projectTasks.filter((task) => task.status !== TaskStatus.DONE).length,
          done: projectDoneTasks.length,
          overdue: projectOverdueTasks.length,
          dueSoon: projectDueSoonTasks.length,
          unassigned: projectUnassignedTasks.length,
          completionRate: projectTasks.length
            ? Math.round((projectDoneTasks.length / projectTasks.length) * 100)
            : 0,
        },
        healthScore,
        riskLevel: healthScore < 60 ? 'HIGH' : healthScore < 80 ? 'MEDIUM' : 'LOW',
      };
    });

    const healthScore = clampScore(
      96 -
        overdueTasks.length * 10 -
        unassignedTasks.length * 5 -
        team.applications.length * 3 -
        Math.max(0, activeTasks.length - Math.max(1, team.members.length) * 5) * 2 +
        completedThisWeek.length * 2,
    );

    const actionItems = [
      ...overdueTasks.slice(0, 8).map((task) => ({
        id: `task-overdue-${task.id}`,
        type: 'TASK_OVERDUE',
        severity: 'critical',
        title: task.title,
        dueDate: task.dueDate,
        assignee: task.assignee,
        project: task.project,
      })),
      ...unassignedTasks.slice(0, 8).map((task) => ({
        id: `task-unassigned-${task.id}`,
        type: 'TASK_UNASSIGNED',
        severity: 'high',
        title: task.title,
        dueDate: task.dueDate,
        assignee: null,
        project: task.project,
      })),
      ...dueSoonTasks.slice(0, 8).map((task) => ({
        id: `task-due-${task.id}`,
        type: 'TASK_DUE_SOON',
        severity: 'medium',
        title: task.title,
        dueDate: task.dueDate,
        assignee: task.assignee,
        project: task.project,
      })),
      ...team.applications.slice(0, 8).map((application) => ({
        id: `application-${application.id}`,
        type: 'TEAM_APPLICATION',
        severity: 'medium',
        title: application.user.name || application.user.email || 'New application',
        application,
      })),
    ].slice(0, 12);

    const activity = [
      ...tasks.slice(0, 10).map((task) => ({
        id: `task-${task.id}`,
        type: 'TASK',
        title: task.title,
        actor: task.assignee,
        project: task.project,
        createdAt: task.updatedAt,
      })),
      ...projects.slice(0, 8).map((project) => ({
        id: `project-${project.id}`,
        type: 'PROJECT',
        title: project.title,
        actor: team.owner,
        project: { id: project.id, title: project.title, color: project.color },
        createdAt: project.updatedAt,
      })),
      ...team.applications.slice(0, 8).map((application) => ({
        id: `application-${application.id}`,
        type: 'APPLICATION',
        title: application.user.name || application.user.email || 'Application',
        actor: application.user,
        createdAt: application.createdAt,
      })),
      ...team.invitations.slice(0, 8).map((invitation) => ({
        id: `invitation-${invitation.id}`,
        type: 'INVITATION',
        title: invitation.inviteeEmail,
        actor: null,
        createdAt: invitation.createdAt,
      })),
      ...assets.slice(0, 4).map((asset) => ({
        id: `asset-${asset.id}`,
        type: 'ASSET',
        title: asset.title,
        actor: asset.user,
        createdAt: asset.updatedAt,
      })),
      ...materials.slice(0, 4).map((material) => ({
        id: `material-${material.id}`,
        type: 'MATERIAL',
        title: material.title,
        actor: material.user,
        createdAt: material.updatedAt,
      })),
      ...showcases.slice(0, 4).map((showcase) => ({
        id: `showcase-${showcase.id}`,
        type: 'SHOWCASE',
        title: showcase.title,
        actor: showcase.user,
        createdAt: showcase.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 16);

    reply.send({
      team,
      counts: {
        members: team.members.length,
        admins: team.members.filter((member) => ['OWNER', 'ADMIN'].includes(member.role)).length,
        projects: projects.length,
        activeProjects: projects.filter((project) => project.status === 'IN_PROGRESS').length,
        tasks: tasks.length,
        activeTasks: activeTasks.length,
        doneTasks: doneTasks.length,
        overdueTasks: overdueTasks.length,
        dueSoonTasks: dueSoonTasks.length,
        unassignedTasks: unassignedTasks.length,
        completedThisWeek: completedThisWeek.length,
        assets: team._count.assets,
        materials: team._count.materials,
        showcases: team._count.showcases,
        pendingApplications: team.applications.length,
        pendingInvitations: team.invitations.length,
        averageProjectProgress: projects.length
          ? Math.round(
              projects.reduce((sum, project) => sum + (project.progress || 0), 0) / projects.length,
            )
          : 0,
        healthScore,
      },
      members,
      projectHealth,
      tasks: {
        overdue: overdueTasks.slice(0, 8),
        dueSoon: dueSoonTasks.slice(0, 8),
        unassigned: unassignedTasks.slice(0, 8),
        recentlyUpdated: tasks.slice(0, 10),
      },
      resources: { assets, materials, showcases },
      invitations: team.invitations,
      applications: team.applications,
      actionItems,
      activity,
      generatedAt: now,
    });
  } catch (error) {
    throw error;
  }
};

export const batchUpdateTeams = async (req: AdminRequest, reply: FastifyReply) => {
  const { ids, visibility, category } = req.body as {
    ids?: string[];
    visibility?: string;
    category?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Team ids are required', 400);
  }

  const data: Prisma.TeamUpdateManyMutationInput = {};
  if (visibility === 'PUBLIC' || visibility === 'PRIVATE') data.visibility = visibility;
  if (typeof category === 'string') data.category = category.trim() || null;

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid update fields provided', 400);
  }

  try {
    const result = await prisma.team.updateMany({
      where: { id: { in: ids }, type: 'TEAM' },
      data,
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_TEAM,
      module: AuditModule.TEAM,
      description: `Batch updated ${result.count} teams`,
      newValue: { ids, ...data },
      req,
    });

    reply.send({ updated: result.count });
  } catch (error) {
    throw error;
  }
};

export const batchDeleteTeams = async (req: AdminRequest, reply: FastifyReply) => {
  const { ids } = req.body as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Team ids are required', 400);
  }

  try {
    const teams = await prisma.team.findMany({
      where: { id: { in: ids }, type: 'TEAM' },
      select: { id: true, name: true },
    });

    const result = await prisma.team.deleteMany({
      where: { id: { in: teams.map((team) => team.id) }, type: 'TEAM' },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_TEAM,
      module: AuditModule.TEAM,
      description: `Batch deleted ${result.count} teams`,
      oldValue: teams,
      req,
    });

    reply.send({ deleted: result.count });
  } catch (error) {
    throw error;
  }
};

export const respondToTeamApplication = async (req: AdminRequest, reply: FastifyReply) => {
  const applicationId = req.params.applicationId as string;
  const { accept } = req.body as { accept?: boolean };

  try {
    const application = await prisma.teamApplication.findUnique({
      where: { id: applicationId },
      include: {
        team: true,
        user: { select: userSelect },
      },
    });

    if (!application || application.status !== 'PENDING') {
      throw new AppError('Application not found or already processed', 404);
    }

    if (accept) {
      await prisma.$transaction(async (tx) => {
        await tx.teamApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' },
        });

        const existingMember = await tx.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: application.teamId,
              userId: application.userId,
            },
          },
        });

        if (!existingMember) {
          await tx.teamMember.create({
            data: {
              teamId: application.teamId,
              userId: application.userId,
              role: 'MEMBER',
            },
          });
        }
      });

      await createNotification({
        type: 'TEAM',
        title: '团队申请已通过',
        content: `你加入团队「${application.team.name}」的申请已通过。`,
        userId: application.userId,
        link: `/team/${application.teamId}`,
        category: 'TEAM_ACTIVITY',
      });
    } else {
      await prisma.teamApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED' },
      });

      await createNotification({
        type: 'TEAM',
        title: '团队申请未通过',
        content: `你加入团队「${application.team.name}」的申请未通过。`,
        userId: application.userId,
        category: 'TEAM_ACTIVITY',
      });
    }

    await auditService.log({
      userId: req.userId,
      action: accept ? AuditAction.JOIN_TEAM : AuditAction.UPDATE_TEAM,
      module: AuditModule.TEAM,
      description: `${accept ? 'Approved' : 'Rejected'} team application for ${application.team.name}`,
      newValue: {
        applicationId,
        teamId: application.teamId,
        userId: application.userId,
        status: accept ? 'APPROVED' : 'REJECTED',
      },
      req,
    });

    reply.send({
      message: accept ? 'Application approved' : 'Application rejected',
      status: accept ? 'APPROVED' : 'REJECTED',
    });
  } catch (error) {
    throw error;
  }
};

export const cancelTeamInvitation = async (req: AdminRequest, reply: FastifyReply) => {
  const invitationId = req.params.invitationId as string;

  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) throw new AppError('Invitation not found', 404);

    await prisma.teamInvitation.delete({ where: { id: invitationId } });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.INVITE_TEAM,
      module: AuditModule.TEAM,
      description: `Cancelled invitation for ${invitation.inviteeEmail}`,
      oldValue: {
        invitationId,
        teamId: invitation.teamId,
        inviteeEmail: invitation.inviteeEmail,
      },
      req,
    });

    reply.send({ message: 'Invitation cancelled' });
  } catch (error) {
    throw error;
  }
};

export const createTeam = async (req: AdminRequest, reply: FastifyReply) => {
  const { name, description, avatarUrl, coverUrl, visibility, category, ownerId } = req.body;
  const creatorId = ownerId || req.userId;

  if (!name) {
    throw new AppError('Team name is required', 400);
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name,
          description,
          avatarUrl,
          coverUrl,
          visibility: visibility || 'PRIVATE',
          category,
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

    reply.status(201).send(team);
  } catch (error) {
    throw error;
  }
};

export const updateTeam = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { name, description, avatarUrl, coverUrl, visibility, category, ownerId } = req.body;

  try {
    const team = await prisma.$transaction(async (tx) => {
      const oldTeam = await tx.team.findUnique({ where: { id: id } });
      if (!oldTeam) throw new AppError('Team not found', 404);

      if (avatarUrl && avatarUrl !== oldTeam.avatarUrl && oldTeam.avatarUrl) {
        deleteCloudOrLocalFileByUrl(oldTeam.avatarUrl).catch(() => {});
      }
      if (coverUrl && coverUrl !== oldTeam.coverUrl && oldTeam.coverUrl) {
        deleteCloudOrLocalFileByUrl(oldTeam.coverUrl).catch(() => {});
      }

      const updatedTeam = await tx.team.update({
        where: { id: id },
        data: { name, description, avatarUrl, coverUrl, visibility, category, ownerId },
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

    reply.send(team);
  } catch (error) {
    throw error;
  }
};

export const deleteTeam = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    const team = await prisma.team.findUnique({ where: { id } });
    if (team) {
      if (team.avatarUrl) deleteCloudOrLocalFileByUrl(team.avatarUrl).catch(() => {});
      if (team.coverUrl) deleteCloudOrLocalFileByUrl(team.coverUrl).catch(() => {});
    }

    await prisma.team.delete({ where: { id: id } });
    reply.send({ message: 'Team deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const addTeamMember = async (req: AdminRequest, reply: FastifyReply) => {
  const teamId = req.params.teamId as string;
  const { userId, role = 'MEMBER' } = req.body as { userId?: string; role?: string };

  if (!userId) {
    throw new AppError('User is required', 400);
  }

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  try {
    const [team, user, existingMember] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId } }),
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } }),
    ]);

    if (!team) throw new AppError('Team not found', 404);
    if (team.type === 'PERSONAL') {
      throw new AppError('Cannot add members to a personal workspace', 400);
    }
    if (!user) throw new AppError('User not found', 404);
    if (existingMember) throw new AppError('User is already a member', 400);

    const member = await prisma.teamMember.create({
      data: { teamId, userId, role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    reply.status(201).send(member);
  } catch (error) {
    throw error;
  }
};

export const updateTeamMemberRole = async (req: AdminRequest, reply: FastifyReply) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  const { role } = req.body;

  if (!['ADMIN', 'MEMBER'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) throw new AppError('Member not found', 404);
    if (member.role === 'OWNER') throw new AppError('Cannot change owner role', 400);

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: { role },
    });
    reply.send(updated);
  } catch (error) {
    throw error;
  }
};

export const removeTeamMember = async (req: AdminRequest, reply: FastifyReply) => {
  const teamId = req.params.teamId as string;
  const userId = req.params.userId as string;
  try {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) throw new AppError('Member not found', 404);
    if (member.role === 'OWNER') throw new AppError('Cannot remove owner', 400);

    await prisma.teamMember.delete({ where: { id: member.id } });
    reply.send({ message: 'Member removed successfully' });
  } catch (error) {
    throw error;
  }
};
