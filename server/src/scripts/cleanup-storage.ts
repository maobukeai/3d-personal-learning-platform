import { logger } from '../utils/logger';
import prisma from '../services/prisma';
import fs from 'fs';
import path from 'path';
import { urlToPath } from '../utils/file';
import { storageService } from '../services/storage.service';
import { decrypt } from '../utils/crypto';

/** Matches the encrypted format produced by `encrypt()`: iv(24hex):tag(32hex):ciphertext */
const ENCRYPTED_VALUE_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function getDecryptedSecret(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!ENCRYPTED_VALUE_RE.test(raw)) return raw;
  try {
    return decrypt(raw);
  } catch (err) {
    logger.error('[CleanupEngine] Failed to decrypt secretAccessKey:', err);
    return raw;
  }
}

function toDecryptedConfig(raw: any) {
  return {
    endpoint: raw.endpoint,
    accessKeyId: raw.accessKeyId ?? '',
    secretAccessKey: getDecryptedSecret(raw.secretAccessKey),
    bucketName: raw.bucketName,
    publicUrl: raw.publicUrl,
  };
}

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
      prisma.mirrorSource.findMany({ select: { id: true, iconUrl: true } }),
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
    const validDbStrings = new Set<string>();
    const activeMirrorSourceIds = new Set<string>(mirrorSources.map((s) => s.id));

    const addPath = (url: string | null | undefined) => {
      if (!url) return;
      const urlLower = url.toLowerCase().trim();
      validDbStrings.add(urlLower);

      // Extract path portion if it contains folder pattern (e.g. assets/xxx)
      // to match relative paths or key names in R2
      const parts = urlLower.split('/uploads/');
      if (parts.length >= 2 && parts[1]) {
        validDbStrings.add(parts[1]);
      }

      // Prepend protocol if missing to ensure reliable URL parsing
      let cleanUrl = urlLower;
      if (!/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith('/')) {
        cleanUrl = `https://${cleanUrl}`;
      }

      try {
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
          const parsedUrl = new URL(cleanUrl);
          const pathname = parsedUrl.pathname;
          const cleanKey = pathname.startsWith('/') ? pathname.slice(1) : pathname;
          if (cleanKey) {
            validDbStrings.add(cleanKey);
          }
          const hostAndPath = parsedUrl.host + parsedUrl.pathname;
          validDbStrings.add(hostAndPath);
          validDbStrings.add(`https://${hostAndPath}`);
          validDbStrings.add(`http://${hostAndPath}`);
        }
      } catch (_e) {
        // ignore invalid URLs
      }

      const p = urlToPath(url);
      if (p) validPaths.add(path.resolve(p).toLowerCase());
    };

    // Helper to extract relative upload URLs from Markdown/HTML text (supporting http absolute URLs as well)
    const extractUploadUrls = (text: string | null | undefined): string[] => {
      if (!text) return [];
      const urls: string[] = [];
      const regex = /(\/uploads\/|https?:\/\/)[^\s)""']+/g;
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

    // 1.5. Clean up S3 / Cloudflare R2 Storage Buckets
    logger.info('[CleanupEngine] Scanning active Cloudflare R2 configurations for cleanup...');
    const activeConfigs = await prisma.storageConfig.findMany({
      where: { status: 'ACTIVE' },
    });

    const concurrencyLimit = 5;
    let configIndex = 0;

    const runWorker = async () => {
      while (configIndex < activeConfigs.length) {
        const config = activeConfigs[configIndex++];
        if (!config) break;

        try {
          logger.info(`[CleanupEngine] Scanning R2 bucket: ${config.bucketName} (${config.name})...`);
          const decryptedConfig = toDecryptedConfig(config);
          const objects = await storageService.listAllObjects(decryptedConfig);
          
          let baseUrl = config.publicUrl.endsWith('/')
            ? config.publicUrl.slice(0, -1)
            : config.publicUrl;
          if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
            baseUrl = `https://${baseUrl}`;
          }

          let bucketDeletedCount = 0;
          let bucketDeletedBytes = 0;
          const orphanedKeys: string[] = [];

          for (const obj of objects) {
            if (!obj.Key) continue;
            
            // Protect mirror assets only for sources that currently exist in the database
            if (obj.Key.startsWith('mirror/')) {
              const parts = obj.Key.split('/');
              const sourceId = parts[1];
              if (sourceId && activeMirrorSourceIds.has(sourceId)) {
                continue;
              }
            }

            const cleanKey = obj.Key.startsWith('/') ? obj.Key.slice(1) : obj.Key;
            const fileUrl = `${baseUrl}/${cleanKey}`.toLowerCase();
            const keyLower = obj.Key.toLowerCase();

            // Check if key or URL is referenced in the DB whitelist
            const isReferenced = validDbStrings.has(fileUrl) || validDbStrings.has(keyLower);

            if (!isReferenced) {
              orphanedKeys.push(obj.Key);
              bucketDeletedBytes += obj.Size;
              logger.info(`[CleanupEngine] Found orphaned R2 object: ${obj.Key} (Size: ${obj.Size})`);
            }
          }

          if (orphanedKeys.length > 0) {
            try {
              logger.info(`[CleanupEngine] Bulk deleting ${orphanedKeys.length} orphaned objects from bucket ${config.bucketName}...`);
              await storageService.deleteFilesBulk(decryptedConfig, orphanedKeys);
              
              // Decrement the DB configuration usedBytes count in a single update
              await prisma.storageConfig.update({
                where: { id: config.id },
                data: {
                  usedBytes: { decrement: bucketDeletedBytes },
                },
              });
              
              stats.deleted += orphanedKeys.length;
              bucketDeletedCount = orphanedKeys.length;
            } catch (err) {
              stats.errors += orphanedKeys.length;
              logger.error(`[CleanupEngine] Error bulk deleting objects from ${config.bucketName}:`, err);
            }
          }

          if (bucketDeletedCount > 0) {
            logger.info(`[CleanupEngine] Cleaned bucket ${config.bucketName}: Deleted ${bucketDeletedCount} files, freed ${bucketDeletedBytes} bytes.`);
          } else {
            logger.info(`[CleanupEngine] Bucket ${config.bucketName} is clean. No orphaned files deleted.`);
          }
        } catch (bucketErr) {
          stats.errors++;
          logger.error(`[CleanupEngine] Failed to run cleanup for bucket ${config.bucketName}:`, bucketErr);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, activeConfigs.length) },
      () => runWorker(),
    );
    await Promise.all(workers);

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

    // 3. Scan and cleanup mirror temporary & orphaned UUID directories
    logger.info('[CleanupEngine] Scanning and cleaning mirror directories...');
    try {
      const { cleanupMirrorTempDirectories } = await import('../services/cleanup.service');
      await cleanupMirrorTempDirectories(true);
    } catch (mirrorCleanupErr) {
      logger.error('[CleanupEngine] Failed to cleanup mirror directories:', mirrorCleanupErr);
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
