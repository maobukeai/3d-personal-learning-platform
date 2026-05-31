import { logger } from '../utils/logger';
import prisma from '../services/prisma';
import fs from 'fs';
import path from 'path';
import { urlToPath } from '../utils/file';

/**
 * Storage Cleanup Engine
 * Scans upload directories and removes files that are no longer referenced in the database.
 */
export async function cleanupOrphanedFiles() {
  logger.info('[CleanupEngine] Starting storage cleanup...');

  const stats = {
    scanned: 0,
    deleted: 0,
    errors: 0,
  };

  try {
    // 1. Collect all valid file paths from DB
    const [
      assets,
      materials,
      showcases,
      users,
      manualResources,
      mirrorResources,
      manualStations,
      mirrorSources,
      teams,
      courses,
      lessons,
      discussions,
      comments,
      feedbacks,
      messages,
      projectDiscussions,
      aiMessages,
      settings,
    ] = await Promise.all([
      prisma.asset.findMany({ select: { url: true, thumbnail: true } }),
      prisma.material.findMany({ select: { fileUrl: true, previewUrl: true } }),
      prisma.showcase.findMany({ select: { thumbnailUrl: true, images: true } }),
      prisma.user.findMany({ select: { avatarUrl: true } }),
      prisma.manualResource.findMany({ select: { thumbnailUrl: true, contentHtml: true } }),
      prisma.mirrorResource.findMany({ select: { thumbnailUrl: true, contentHtml: true } }),
      prisma.manualStation.findMany({ select: { iconUrl: true } }),
      prisma.mirrorSource.findMany({ select: { iconUrl: true } }),
      prisma.team.findMany({ select: { avatarUrl: true, coverUrl: true } }),
      prisma.course.findMany({ select: { thumbnail: true } }),
      prisma.lesson.findMany({ select: { videoUrl: true } }),
      prisma.discussion.findMany({ select: { images: true, content: true } }),
      prisma.comment.findMany({ select: { content: true } }),
      prisma.feedback.findMany({ select: { attachmentUrl: true } }),
      prisma.message.findMany({ select: { content: true } }),
      prisma.projectDiscussion.findMany({ select: { fileUrl: true, images: true, content: true } }),
      prisma.aiMessage.findMany({ select: { content: true } }),
      prisma.systemSetting.findMany({
        where: { key: { in: ['PLATFORM_LOGO_URL', 'PLATFORM_FAVICON_URL'] } },
      }),
    ]);

    const validPaths = new Set<string>();

    const addPath = (url: string | null | undefined) => {
      const p = urlToPath(url);
      if (p) validPaths.add(path.resolve(p).toLowerCase());
    };

    // Helper to extract relative upload URLs from Markdown/HTML text
    const extractUploadUrls = (text: string | null | undefined): string[] => {
      if (!text) return [];
      const urls: string[] = [];
      const regex = /\/uploads\/[^\s)""']+/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        let url = match[0];
        // Clean trailing symbols often included in regex matches
        if (url.endsWith(')') || url.endsWith('"') || url.endsWith("'")) {
          url = url.slice(0, -1);
        }
        urls.push(url);
      }
      return urls;
    };

    assets.forEach((a) => {
      addPath(a.url);
      addPath(a.thumbnail);
    });
    materials.forEach((m) => {
      addPath(m.fileUrl);
      addPath(m.previewUrl);
    });
    showcases.forEach((s) => {
      addPath(s.thumbnailUrl);
      if (s.images) {
        try {
          const imgs = JSON.parse(s.images);
          if (Array.isArray(imgs)) imgs.forEach(addPath);
        } catch (_err) {
          if (typeof s.images === 'string') addPath(s.images);
        }
      }
    });
    users.forEach((u) => addPath(u.avatarUrl));

    // Add manual resources & stations
    manualResources.forEach((mr) => {
      addPath(mr.thumbnailUrl);
      extractUploadUrls(mr.contentHtml).forEach(addPath);
    });
    manualStations.forEach((ms) => {
      addPath(ms.iconUrl);
    });

    // Add mirror resources & sources
    mirrorResources.forEach((mr) => {
      addPath(mr.thumbnailUrl);
      extractUploadUrls(mr.contentHtml).forEach(addPath);
    });
    mirrorSources.forEach((ms) => {
      addPath(ms.iconUrl);
    });

    // Add teams
    teams.forEach((t) => {
      addPath(t.avatarUrl);
      addPath(t.coverUrl);
    });

    // Add courses & lessons
    courses.forEach((c) => addPath(c.thumbnail));
    lessons.forEach((l) => addPath(l.videoUrl));

    // Add discussions & comments
    discussions.forEach((d) => {
      if (d.images) {
        try {
          const imgs = JSON.parse(d.images);
          if (Array.isArray(imgs)) imgs.forEach(addPath);
        } catch (_err) {
          if (typeof d.images === 'string') addPath(d.images);
        }
      }
      extractUploadUrls(d.content).forEach(addPath);
    });
    comments.forEach((c) => {
      extractUploadUrls(c.content).forEach(addPath);
    });

    // Add feedbacks
    feedbacks.forEach((f) => addPath(f.attachmentUrl));

    // Add messages
    messages.forEach((msg) => {
      if (msg.content.startsWith('/uploads/messages/') || msg.content.startsWith('http')) {
        addPath(msg.content);
      }
      extractUploadUrls(msg.content).forEach(addPath);
    });

    // Add project discussions
    projectDiscussions.forEach((pd) => {
      addPath(pd.fileUrl);
      if (pd.images) {
        try {
          const imgs = JSON.parse(pd.images);
          if (Array.isArray(imgs)) imgs.forEach(addPath);
        } catch (_err) {
          if (typeof pd.images === 'string') addPath(pd.images);
        }
      }
      extractUploadUrls(pd.content).forEach(addPath);
    });

    // Add AI chat images embedded as Markdown image URLs.
    aiMessages.forEach((msg) => {
      extractUploadUrls(msg.content).forEach(addPath);
    });

    // Add settings
    settings.forEach((s) => {
      addPath(s.value);
    });

    // 2. Scan upload directories (now including manual, mirror, branding, discussions, feedback, and messages)
    const uploadDirs = [
      'assets',
      'materials',
      'showcase',
      'avatars',
      'manual',
      'mirror',
      'branding',
      'discussions',
      'feedback',
      'messages',
      'ai',
    ];
    const baseDir = path.join(__dirname, '../../uploads');

    for (const dir of uploadDirs) {
      const fullDir = path.join(baseDir, dir);
      if (!fs.existsSync(fullDir)) continue;

      const files = fs.readdirSync(fullDir);
      for (const file of files) {
        const filePath = path.resolve(path.join(fullDir, file));

        // Skip directories
        if (fs.statSync(filePath).isDirectory()) continue;

        stats.scanned++;

        if (!validPaths.has(filePath.toLowerCase())) {
          try {
            fs.unlinkSync(filePath);
            stats.deleted++;
            logger.info(`[CleanupEngine] Deleted orphan: ${filePath}`);
          } catch (err) {
            stats.errors++;
            logger.error(`[CleanupEngine] Error deleting ${filePath}:`, err);
          }
        }
      }
    }

    logger.info(
      `[CleanupEngine] Cleanup finished. Scanned: ${stats.scanned}, Deleted: ${stats.deleted}, Errors: ${stats.errors}`,
    );
  } catch (error) {
    logger.error('[CleanupEngine] Critical error during cleanup:', error);
  }

  return stats;
}

// Enable direct execution when called as a script (e.g. ts-node src/scripts/cleanup-storage.ts)
if (require.main === module) {
  cleanupOrphanedFiles()
    .then((stats) => {
      logger.info('[CleanupEngine] Direct execution completed successfully:', stats);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('[CleanupEngine] Direct execution failed:', err);
      process.exit(1);
    });
}
