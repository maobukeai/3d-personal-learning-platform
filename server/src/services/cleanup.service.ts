import prisma from './prisma';

export const cleanupExpiredData = async () => {
  const now = new Date();
  try {
    const [deletedCodes, deletedTokens, deletedTeamInvites, deletedProjectInvites] = await prisma.$transaction([
      prisma.verificationCode.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.teamInvitation.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.projectInvitation.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    if (
      deletedCodes.count > 0 ||
      deletedTokens.count > 0 ||
      deletedTeamInvites.count > 0 ||
      deletedProjectInvites.count > 0
    ) {
      console.log(
        `[Cleanup] Database cleanup complete: ` +
          `Deleted ${deletedCodes.count} expired verification codes, ` +
          `Deleted ${deletedTokens.count} expired refresh tokens, ` +
          `Deleted ${deletedTeamInvites.count} expired team invitations, ` +
          `Deleted ${deletedProjectInvites.count} expired project invitations.`
      );
    }
  } catch (error) {
    console.error('[Cleanup Error] Failed to run database cleanup:', error);
  }
};

let cleanupInterval: NodeJS.Timeout | null = null;

export const startCleanupJob = (intervalMs = 60 * 60 * 1000) => {
  // Run immediately on start
  cleanupExpiredData();

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    cleanupExpiredData();
  }, intervalMs);

  console.log(`[Cleanup] Background cleanup job started (interval: ${intervalMs / 1000}s).`);
};

export const stopCleanupJob = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Cleanup] Background cleanup job stopped.');
  }
};
