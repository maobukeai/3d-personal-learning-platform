import { Prisma } from '@prisma/client';

type WorkspaceTx = Prisma.TransactionClient;

const PERSONAL_WORKSPACE_DESCRIPTION = '个人专属创作与协作空间';
const PUBLIC_WORKSPACE_NAME = '公共空间';
const PUBLIC_WORKSPACE_DESCRIPTION = '全站公共协作与创作空间';

type ProvisionUserWorkspacesOptions = {
  userId: string;
  displayName?: string | null;
  includePublicWorkspace?: boolean;
};

export const createPersonalWorkspace = async (
  tx: WorkspaceTx,
  options: Pick<ProvisionUserWorkspacesOptions, 'userId' | 'displayName'>,
) => {
  return tx.team.create({
    data: {
      name: `${options.displayName || '用户'} 的个人空间`,
      description: PERSONAL_WORKSPACE_DESCRIPTION,
      type: 'PERSONAL',
      visibility: 'PRIVATE',
      ownerId: options.userId,
      members: {
        create: {
          userId: options.userId,
          role: 'OWNER',
        },
      },
    },
  });
};

export const ensurePublicWorkspaceMembership = async (tx: WorkspaceTx, userId: string) => {
  let publicTeam = await tx.team.findUnique({
    where: { name_type: { name: PUBLIC_WORKSPACE_NAME, type: 'TEAM' } },
  });

  if (!publicTeam) {
    try {
      publicTeam = await tx.team.create({
        data: {
          name: PUBLIC_WORKSPACE_NAME,
          description: PUBLIC_WORKSPACE_DESCRIPTION,
          type: 'TEAM',
          visibility: 'PUBLIC',
          ownerId: userId,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });
    } catch (error) {
      publicTeam = await tx.team.findUnique({
        where: { name_type: { name: PUBLIC_WORKSPACE_NAME, type: 'TEAM' } },
      });
      if (!publicTeam) {
        throw error;
      }
    }
  }

  if (publicTeam.ownerId !== userId) {
    await tx.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: publicTeam.id,
          userId,
        },
      },
      update: {},
      create: {
        teamId: publicTeam.id,
        userId,
        role: 'MEMBER',
      },
    });
  }

  return publicTeam;
};

export const provisionUserWorkspaces = async (
  tx: WorkspaceTx,
  options: ProvisionUserWorkspacesOptions,
) => {
  const personalTeam = await createPersonalWorkspace(tx, options);
  const publicTeam = options.includePublicWorkspace
    ? await ensurePublicWorkspaceMembership(tx, options.userId)
    : null;

  return {
    personalTeam,
    publicTeam,
  };
};
