import { logger } from '../utils/logger';
import prisma from '../services/prisma';
import fs from 'fs';
import path from 'path';
import { urlToPath } from '../utils/file';
import { storageService } from '../services/storage.service';
import { buildDecryptedStorageConfig } from '../utils/crypto';

/**
 * Helper to parse prisma schema and extract fields of type String/Json
 * that match upload resource naming patterns.
 */
function parsePrismaSchema(schemaContent: string): Record<string, string[]> | null {
  try {
    const modelBlocks = schemaContent.match(/model\s+\w+\s*\{[\s\S]*?\}/g) || [];
    const fieldsMap: Record<string, string[]> = {};

    for (const block of modelBlocks) {
      const nameMatch = block.match(/model\s+(\w+)/);
      if (!nameMatch || !nameMatch[1]) continue;
      const modelName = nameMatch[1];
      const camelModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

      const fields: string[] = [];
      const lines = block.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) continue;

        const fieldName = parts[0];
        const fieldType = parts[1];
        if (!fieldName || !fieldType) continue;

        // We only care about String or Json fields
        const isStringOrJson = fieldType.startsWith('String') || fieldType.startsWith('Json');
        if (!isStringOrJson) continue;

        const fieldLower = fieldName.toLowerCase();

        const matchesPattern =
          // Direct file/URL fields
          fieldLower.endsWith('url') ||
          fieldLower.endsWith('thumbnail') ||
          fieldLower.endsWith('image') ||
          fieldLower.endsWith('video') ||
          fieldLower.endsWith('file') ||
          fieldLower.endsWith('avatar') ||
          fieldLower.endsWith('cover') ||
          fieldLower.endsWith('icon') ||
          fieldLower.endsWith('attachment') ||
          fieldLower.endsWith('logo') ||
          fieldLower.endsWith('favicon') ||
          fieldLower.endsWith('preview') ||
          fieldLower.endsWith('path') ||
          fieldLower.endsWith('key') ||
          fieldLower === 'images' ||
          fieldLower === 'files' ||
          // Value fields in settings
          fieldLower === 'value' ||
          // Content fields containing Markdown/HTML/JSON that may embed upload URLs
          fieldLower === 'content' ||
          fieldLower === 'contenthtml' ||
          fieldLower === 'description' ||
          fieldLower === 'summary' ||
          fieldLower === 'body' ||
          fieldLower === 'message' ||
          fieldLower === 'text' ||
          fieldLower === 'detail' ||
          fieldLower === 'guide' ||
          fieldLower.endsWith('guide') ||
          fieldLower.endsWith('description') ||
          fieldLower.endsWith('content');

        if (matchesPattern) {
          fields.push(fieldName);
        }
      }

      if (fields.length > 0) {
        fieldsMap[camelModelName] = fields;
      }
    }

    return fieldsMap;
  } catch (err) {
    logger.error('[CleanupEngine] Error in parsePrismaSchema:', err);
    return null;
  }
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
    const validPaths = new Set<string>();
    const validDbStrings = new Set<string>();
    const activeMirrorSourceIds = new Set<string>();

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

    // Fallback fields mapping in case schema file cannot be parsed
    const FALLBACK_FIELDS: Record<string, string[]> = {
      asset: ['url', 'thumbnail'],
      material: ['fileUrl', 'previewUrl'],
      showcase: ['thumbnailUrl', 'images', 'videoUrl'],
      user: ['avatarUrl', 'coverUrl'],
      conversation: ['avatarUrl'],
      manualResource: ['thumbnailUrl', 'contentHtml', 'contentUrl'],
      mirrorResource: ['thumbnailUrl', 'contentHtml', 'contentUrl'],
      manualStation: ['iconUrl'],
      mirrorSource: ['id', 'iconUrl'],
      team: ['avatarUrl', 'coverUrl'],
      course: ['thumbnail'],
      lesson: ['videoUrl', 'content'],
      discussion: ['images', 'content'],
      comment: ['content'],
      feedback: ['attachmentUrl'],
      message: ['content'],
      projectDiscussion: ['fileUrl', 'images', 'content'],
      aiMessage: ['content'],
      systemSetting: ['value'],
      userSetting: ['value'],
      task: ['description'],
      taskComment: ['content'],
      showcaseComment: ['content'],
      courseNote: ['content'],
      note: ['content'],
      noteComment: ['content'],
      banner: ['imageUrl'],
      assetVersion: ['url', 'thumbnail'],
      plugin: ['fileUrl', 'previewUrl', 'installGuide'],
    };

    // Dynamically parse the schema to find all referencing fields
    let fieldsMap = FALLBACK_FIELDS;
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      try {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const parsed = parsePrismaSchema(schemaContent);
        if (parsed && Object.keys(parsed).length > 0) {
          fieldsMap = parsed;
          logger.info(
            `[CleanupEngine] Dynamically loaded ${Object.keys(fieldsMap).length} models from prisma schema.`,
          );
        }
      } catch (schemaErr) {
        logger.error(
          '[CleanupEngine] Failed to dynamically parse schema, using fallback:',
          schemaErr,
        );
      }
    } else {
      logger.warn(
        `[CleanupEngine] schema.prisma not found at ${schemaPath}, using fallback fields.`,
      );
    }

    // Query each model and extract paths
    await Promise.all(
      Object.entries(fieldsMap).map(async ([modelName, fields]) => {
        const delegate = (prisma as any)[modelName];
        if (!delegate || typeof delegate.findMany !== 'function') {
          return;
        }

        // Build select object
        const selectObj: Record<string, boolean> = {};
        for (const field of fields) {
          selectObj[field] = true;
        }

        // Always query 'id' for mirrorSource to build activeMirrorSourceIds
        if (modelName === 'mirrorSource') {
          selectObj['id'] = true;
        }

        try {
          const records = await delegate.findMany({ select: selectObj });
          for (const record of records) {
            // Special handling for mirrorSource ID
            if (modelName === 'mirrorSource' && record.id) {
              activeMirrorSourceIds.add(record.id);
            }

            for (const field of fields) {
              const val = record[field];
              if (!val) continue;

              if (typeof val === 'string') {
                const trimmed = val.trim();
                // Check if it's a JSON array
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                  try {
                    const parsedArray = JSON.parse(trimmed);
                    if (Array.isArray(parsedArray)) {
                      parsedArray.forEach((item) => {
                        if (typeof item === 'string') {
                          addPath(item);
                        }
                      });
                      continue;
                    }
                  } catch (_) {
                    // Not a valid JSON array, process as normal string
                  }
                }

                // Add as direct path/URL
                addPath(val);
                // Extract embedded URLs (for Markdown/HTML text)
                extractUploadUrls(val).forEach(addPath);
              } else if (typeof val === 'object') {
                try {
                  const str = JSON.stringify(val);
                  extractUploadUrls(str).forEach(addPath);
                } catch (_) {}
              }
            }
          }
        } catch (queryErr) {
          logger.error(`[CleanupEngine] Failed to query model ${modelName}:`, queryErr);
        }
      }),
    );

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
          logger.info(
            `[CleanupEngine] Scanning R2 bucket: ${config.bucketName} (${config.name})...`,
          );
          const decryptedConfig = buildDecryptedStorageConfig(config);
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
              logger.info(
                `[CleanupEngine] Found orphaned R2 object: ${obj.Key} (Size: ${obj.Size})`,
              );
            }
          }

          if (orphanedKeys.length > 0) {
            try {
              logger.info(
                `[CleanupEngine] Bulk deleting ${orphanedKeys.length} orphaned objects from bucket ${config.bucketName}...`,
              );
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
              logger.error(
                `[CleanupEngine] Error bulk deleting objects from ${config.bucketName}:`,
                err,
              );
            }
          }

          if (bucketDeletedCount > 0) {
            logger.info(
              `[CleanupEngine] Cleaned bucket ${config.bucketName}: Deleted ${bucketDeletedCount} files, freed ${bucketDeletedBytes} bytes.`,
            );
          } else {
            logger.info(
              `[CleanupEngine] Bucket ${config.bucketName} is clean. No orphaned files deleted.`,
            );
          }
        } catch (bucketErr) {
          stats.errors++;
          logger.error(
            `[CleanupEngine] Failed to run cleanup for bucket ${config.bucketName}:`,
            bucketErr,
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrencyLimit, activeConfigs.length) }, () =>
      runWorker(),
    );
    await Promise.all(workers);

    // 2. Scan upload directories dynamically by reading all subdirectories of uploads/
    const baseDir = path.resolve(__dirname, '../../uploads');
    const uploadDirs: string[] = [];

    if (fs.existsSync(baseDir)) {
      try {
        const entries = fs.readdirSync(baseDir);
        for (const entry of entries) {
          const fullPath = path.join(baseDir, entry);
          if (fs.statSync(fullPath).isDirectory()) {
            // Exclude temporary backups or system/hidden directories
            if (entry !== 'temp_backups' && !entry.startsWith('.')) {
              uploadDirs.push(entry);
            }
          }
        }
      } catch (dirErr) {
        logger.error('[CleanupEngine] Failed to read uploads directory:', dirErr);
      }
    }

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
