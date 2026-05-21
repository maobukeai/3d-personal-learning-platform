import prisma from '../services/prisma';
import fs from 'fs';
import path from 'path';
import { urlToPath } from '../utils/file';

/**
 * Storage Cleanup Engine
 * Scans upload directories and removes files that are no longer referenced in the database.
 */
export async function cleanupOrphanedFiles() {
  console.log('[CleanupEngine] Starting storage cleanup...');

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
    ] = await Promise.all([
      prisma.asset.findMany({ select: { url: true, thumbnail: true } }),
      prisma.material.findMany({ select: { fileUrl: true, previewUrl: true } }),
      prisma.showcase.findMany({ select: { thumbnailUrl: true, images: true } }),
      prisma.user.findMany({ select: { avatarUrl: true } }),
      prisma.manualResource.findMany({ select: { thumbnailUrl: true, contentHtml: true } }),
      prisma.mirrorResource.findMany({ select: { thumbnailUrl: true, contentHtml: true } }),
      prisma.manualStation.findMany({ select: { iconUrl: true } }),
      prisma.mirrorSource.findMany({ select: { iconUrl: true } }),
    ]);

    const validPaths = new Set<string>();

    const addPath = (url: string | null | undefined) => {
      const p = urlToPath(url);
      if (p) validPaths.add(path.normalize(p));
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
        } catch {}
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

    // 2. Scan upload directories (now including manual and mirror)
    const uploadDirs = ['assets', 'materials', 'showcase', 'avatars', 'manual', 'mirror'];
    const baseDir = path.join(__dirname, '../../uploads');

    for (const dir of uploadDirs) {
      const fullDir = path.join(baseDir, dir);
      if (!fs.existsSync(fullDir)) continue;

      const files = fs.readdirSync(fullDir);
      for (const file of files) {
        const filePath = path.normalize(path.join(fullDir, file));

        // Skip directories
        if (fs.statSync(filePath).isDirectory()) continue;

        stats.scanned++;

        if (!validPaths.has(filePath)) {
          try {
            fs.unlinkSync(filePath);
            stats.deleted++;
            console.log(`[CleanupEngine] Deleted orphan: ${filePath}`);
          } catch (err) {
            stats.errors++;
            console.error(`[CleanupEngine] Error deleting ${filePath}:`, err);
          }
        }
      }
    }

    console.log(
      `[CleanupEngine] Cleanup finished. Scanned: ${stats.scanned}, Deleted: ${stats.deleted}, Errors: ${stats.errors}`,
    );
  } catch (error) {
    console.error('[CleanupEngine] Critical error during cleanup:', error);
  }

  return stats;
}

// Enable direct execution when called as a script (e.g. ts-node src/scripts/cleanup-storage.ts)
if (require.main === module) {
  cleanupOrphanedFiles()
    .then((stats) => {
      console.log('[CleanupEngine] Direct execution completed successfully:', stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[CleanupEngine] Direct execution failed:', err);
      process.exit(1);
    });
}

