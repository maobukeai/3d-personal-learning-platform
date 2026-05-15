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
    const [assets, materials, showcases, users] = await Promise.all([
      prisma.asset.findMany({ select: { url: true, thumbnail: true } }),
      prisma.material.findMany({ select: { fileUrl: true, previewUrl: true } }),
      prisma.showcase.findMany({ select: { thumbnailUrl: true, images: true } }),
      prisma.user.findMany({ select: { avatarUrl: true } }),
    ]);

    const validPaths = new Set<string>();

    const addPath = (url: string | null | undefined) => {
      const p = urlToPath(url);
      if (p) validPaths.add(path.normalize(p));
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

    // 2. Scan upload directories
    const uploadDirs = ['assets', 'materials', 'showcase', 'avatars'];
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
