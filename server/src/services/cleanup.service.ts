import { logger } from '../utils/logger';
import prisma from './prisma';
import fs from 'fs';
import path from 'path';

export const cleanupMirrorTempDirectories = async (forceAll = false) => {
  const mirrorDir = path.join(process.cwd(), 'uploads', 'mirror');
  if (!fs.existsSync(mirrorDir)) return;

  try {
    const entries = fs.readdirSync(mirrorDir);
    let deletedCount = 0;

    // Fetch active mirror source IDs to identify orphaned source directories
    const activeSources = await prisma.mirrorSource.findMany({
      select: { id: true },
    });
    const activeSourceIds = new Set(activeSources.map((s) => s.id));
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const entry of entries) {
      const fullPath = path.join(mirrorDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const isTempFolder = entry.startsWith('temp-import-') || entry.startsWith('temp-');
        const isOrphanedSourceFolder = uuidRegex.test(entry) && !activeSourceIds.has(entry);

        if (isTempFolder || isOrphanedSourceFolder) {
          const ageMs = Date.now() - stat.mtimeMs;
          // Delete immediately if forceAll is true, or if folder is older than 2 hours
          if (forceAll || ageMs > 2 * 60 * 60 * 1000) {
            try {
              fs.rmSync(fullPath, { recursive: true, force: true });
              deletedCount++;
              if (isOrphanedSourceFolder) {
                logger.info(`[Cleanup] Deleted orphaned mirror source directory: ${entry}`);
              }
            } catch (rmErr) {
              logger.error(`[Cleanup Error] Failed to delete directory ${fullPath}:`, rmErr);
            }
          }
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(`[Cleanup] Deleted ${deletedCount} expired/orphaned mirror directories.`);
    }
  } catch (err) {
    logger.error('[Cleanup Error] Failed to cleanup mirror directories:', err);
  }
};

export const cleanupLeftoverUploads = async (forceAll = false) => {
  const feedbackDir = path.join(process.cwd(), 'uploads', 'feedback');
  if (!fs.existsSync(feedbackDir)) return;

  try {
    const entries = fs.readdirSync(feedbackDir);
    let deletedCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(feedbackDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && entry.startsWith('file-') && entry.endsWith('.zip')) {
        const ageMs = Date.now() - stat.mtimeMs;
        if (forceAll || ageMs > 2 * 60 * 60 * 1000) {
          try {
            fs.unlinkSync(fullPath);
            deletedCount++;
          } catch (unlinkErr) {
            logger.error(`[Cleanup Error] Failed to delete file ${fullPath}:`, unlinkErr);
          }
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        `[Cleanup] Deleted ${deletedCount} leftover mirror import ZIP files from uploads/feedback.`,
      );
    }
  } catch (err) {
    logger.error('[Cleanup Error] Failed to cleanup leftover upload files:', err);
  }
};

export const cleanupExpiredData = async (forceAll = false) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    // Clean up temporary mirror directories and orphaned source directories
    await cleanupMirrorTempDirectories(forceAll);
    // Clean up leftover uploaded zip files
    await cleanupLeftoverUploads(forceAll);
    const [
      deletedCodes,
      deletedTokens,
      deletedTeamInvites,
      deletedProjectInvites,
      deletedAiMessages,
    ] = await prisma.$transaction([
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
      prisma.aiMessage.deleteMany({
        where: { createdAt: { lt: thirtyDaysAgo } },
      }),
    ]);

    if (
      deletedCodes.count > 0 ||
      deletedTokens.count > 0 ||
      deletedTeamInvites.count > 0 ||
      deletedProjectInvites.count > 0 ||
      deletedAiMessages.count > 0
    ) {
      logger.info(
        `[Cleanup] Database cleanup complete: ` +
          `Deleted ${deletedCodes.count} expired verification codes, ` +
          `Deleted ${deletedTokens.count} expired refresh tokens, ` +
          `Deleted ${deletedTeamInvites.count} expired team invitations, ` +
          `Deleted ${deletedProjectInvites.count} expired project invitations, ` +
          `Deleted ${deletedAiMessages.count} expired AI historical messages.`,
      );
    }
  } catch (error) {
    logger.error('[Cleanup Error] Failed to run database cleanup:', error);
  }
};

let cleanupInterval: NodeJS.Timeout | null = null;

export const startCleanupJob = (intervalMs = 60 * 60 * 1000) => {
  // Run immediately on start (forcing all orphaned temp and source directories to clean up)
  cleanupExpiredData(true);

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    cleanupExpiredData(false);
  }, intervalMs);

  if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  logger.info(`[Cleanup] Background cleanup job started (interval: ${intervalMs / 1000}s).`);
};

export const stopCleanupJob = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[Cleanup] Background cleanup job stopped.');
  }
};
