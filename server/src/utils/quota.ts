import prisma from '../services/prisma';
import { redisService } from '../services/redis.service';

export const gbToBytes = (gb: number): number => gb * 1_000_000_000;

const USER_PLAN_CACHE_TTL = 60; // seconds

export interface QuotaStatus {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
}

/**
 * Gets the current subscription plan for a user.
 * Defaults to FREE plan if no active subscription exists.
 * Result is cached in Redis/memory for 60 seconds to avoid repeated DB queries
 * on every quota check (asset upload, project creation, etc.).
 */
async function getUserPlan(userId: string) {
  const cacheKey = `user_plan:${userId}`;
  const cached = await redisService.get<{
    id: string;
    name: string;
    maxAssets: number;
    maxStorage: number;
    maxTeams: number;
    maxProjects: number;
    priority: number;
  }>(cacheKey);
  if (cached) return cached;

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (subscription && subscription.status === 'ACTIVE') {
    await redisService.set(cacheKey, subscription.plan, USER_PLAN_CACHE_TTL);
    return subscription.plan;
  }

  // Fallback to FREE plan
  const freePlan = await prisma.subscriptionPlan.findFirst({
    where: { name: 'FREE' },
  });

  if (freePlan) {
    await redisService.set(cacheKey, freePlan, USER_PLAN_CACHE_TTL);
  }

  return freePlan;
}

/**
 * Checks if the user (or team) has enough storage space left.
 */
export async function checkStorageQuota(
  userId: string,
  incomingSizeMB: number = 0,
  teamId?: string,
): Promise<QuotaStatus> {
  // If teamId is provided, the quota is tied to the team owner's plan
  let ownerId = userId;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team) ownerId = team.ownerId;
  }

  const plan = await getUserPlan(ownerId);
  if (!plan) return { allowed: true };

  // Sum up all assets and materials for the owner OR the specific team
  // In a team context, we usually care about the team's total usage
  const where = teamId ? { teamId } : { userId: ownerId, teamId: null };

  const [assetStorage, materialStorage] = await Promise.all([
    prisma.asset.aggregate({
      where,
      _sum: { size: true },
    }),
    prisma.material.aggregate({
      where,
      _sum: { fileSize: true },
    }),
  ]);

  const usedMB = (assetStorage._sum.size || 0) + (materialStorage._sum.fileSize || 0);
  const incomingGB = incomingSizeMB / 1024;
  const usedGB = usedMB / 1024;
  const limitGB = plan.maxStorage;

  if (usedGB + incomingGB > limitGB) {
    return {
      allowed: false,
      message: `超出存储配额。${teamId ? '团队' : '个人'}当前已用 ${usedGB.toFixed(2)}GB / 限制 ${limitGB}GB`,
      current: usedGB,
      limit: limitGB,
    };
  }

  return { allowed: true, current: usedGB, limit: limitGB };
}

/**
 * Checks if the user (or team) can create another team.
 */
export async function checkTeamQuota(userId: string): Promise<QuotaStatus> {
  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: true };

  const teamCount = await prisma.team.count({
    where: { ownerId: userId, type: 'TEAM' },
  });

  if (teamCount >= plan.maxTeams) {
    return {
      allowed: false,
      message: `已达到团队创建上限 (${plan.maxTeams})，请升级订阅。`,
      current: teamCount,
      limit: plan.maxTeams,
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
    where: { userId, role: 'OWNER' },
  });

  if (projectCount >= plan.maxProjects) {
    return {
      allowed: false,
      message: `已达到项目创建上限 (${plan.maxProjects})，请升级订阅。`,
      current: projectCount,
      limit: plan.maxProjects,
    };
  }

  return { allowed: true, current: projectCount, limit: plan.maxProjects };
}

/**
 * Checks if the user (or team) can upload another asset.
 */
export async function checkAssetQuota(userId: string, teamId?: string): Promise<QuotaStatus> {
  let ownerId = userId;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team) ownerId = team.ownerId;
  }

  const plan = await getUserPlan(ownerId);
  if (!plan) return { allowed: true };

  const where = teamId ? { teamId } : { userId: ownerId, teamId: null };
  const assetCount = await prisma.asset.count({ where });

  if (assetCount >= plan.maxAssets) {
    return {
      allowed: false,
      message: `已达到资产上传上限 (${plan.maxAssets})，请升级订阅。`,
      current: assetCount,
      limit: plan.maxAssets,
    };
  }

  return { allowed: true, current: assetCount, limit: plan.maxAssets };
}
