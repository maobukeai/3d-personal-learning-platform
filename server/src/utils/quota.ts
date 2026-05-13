import prisma from '../services/prisma';

export interface QuotaStatus {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
}

/**
 * Gets the current subscription plan for a user.
 * Defaults to FREE plan if no active subscription exists.
 */
async function getUserPlan(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true }
  });

  if (subscription && subscription.status === 'ACTIVE') {
    return subscription.plan;
  }

  // Fallback to FREE plan
  const freePlan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'FREE' }
  });

  return freePlan;
}

/**
 * Checks if the user has enough storage space left.
 * Note: getStorageUsage in subscription controller only checks Assets, 
 * but a full check should include Materials and potentially others.
 */
export async function checkStorageQuota(userId: string, incomingSizeMB: number = 0): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: true }; // Should not happen

  const [assetStorage, materialStorage] = await Promise.all([
    prisma.asset.aggregate({
      where: { userId },
      _sum: { size: true }
    }),
    prisma.material.aggregate({
      where: { userId },
      _sum: { fileSize: true }
    })
  ]);

  const usedMB = (assetStorage._sum.size || 0) + (materialStorage._sum.size || 0); // Note: Material uses fileSize, Asset uses size
  const incomingGB = incomingSizeMB / 1024;
  const usedGB = usedMB / 1024;
  const limitGB = plan.maxStorage;

  if (usedGB + incomingGB > limitGB) {
    return {
      allowed: false,
      message: `超出存储配额。当前已用 ${usedGB.toFixed(2)}GB / 限制 ${limitGB}GB`,
      current: usedGB,
      limit: limitGB
    };
  }

  return { allowed: true, current: usedGB, limit: limitGB };
}

/**
 * Checks if the user can create another team.
 */
export async function checkTeamQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: true };

  const teamCount = await prisma.team.count({
    where: { ownerId: userId, type: 'TEAM' }
  });

  if (teamCount >= plan.maxTeams) {
    return {
      allowed: false,
      message: `已达到团队创建上限 (${plan.maxTeams})，请升级订阅。`,
      current: teamCount,
      limit: plan.maxTeams
    };
  }

  return { allowed: true, current: teamCount, limit: plan.maxTeams };
}

/**
 * Checks if the user can create another project.
 */
export async function checkProjectQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: true };

  const projectCount = await prisma.projectMember.count({
    where: { userId, role: 'OWNER' }
  });

  if (projectCount >= plan.maxProjects) {
    return {
      allowed: false,
      message: `已达到项目创建上限 (${plan.maxProjects})，请升级订阅。`,
      current: projectCount,
      limit: plan.maxProjects
    };
  }

  return { allowed: true, current: projectCount, limit: plan.maxProjects };
}

/**
 * Checks if the user can upload another asset.
 */
export async function checkAssetQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: true };

  const assetCount = await prisma.asset.count({
    where: { userId }
  });

  if (assetCount >= plan.maxAssets) {
    return {
      allowed: false,
      message: `已达到资产上传上限 (${plan.maxAssets})，请升级订阅。`,
      current: assetCount,
      limit: plan.maxAssets
    };
  }

  return { allowed: true, current: assetCount, limit: plan.maxAssets };
}
