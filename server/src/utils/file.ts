import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import prisma from '../services/prisma';
import { storageService } from '../services/storage.service';
import { decrypt } from './crypto';

/** Matches the encrypted format produced by `encrypt()`: iv(24hex):tag(32hex):ciphertext */
const ENCRYPTED_VALUE_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function getDecryptedSecret(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!ENCRYPTED_VALUE_RE.test(raw)) return raw;
  try {
    return decrypt(raw);
  } catch (err) {
    logger.error('[FileUtil] Failed to decrypt secretAccessKey:', err);
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

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

/**
 * Converts a URL (e.g., http://localhost:3000/uploads/assets/file.glb)
 * to a local file path relative to the project root.
 */
export function urlToPath(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parts = url.split('/uploads/');
    if (parts.length < 2) return null;

    // parts[1] is something like "assets/file.glb"
    const relativePart = parts[1];
    if (!relativePart) return null;

    const relativePath = decodeURIComponent(relativePart).replace(/\\/g, '/');

    const resolvedPath = path.resolve(uploadsRoot, relativePath);
    const relativeToUploads = path.relative(uploadsRoot, resolvedPath);
    if (relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) {
      logger.warn('[FileUtil] Refusing to resolve path outside uploads:', url);
      return null;
    }

    return resolvedPath;
  } catch (error) {
    logger.error('[FileUtil] Error parsing URL to path:', error);
    return null;
  }
}

/**
 * Safely deletes a file if it exists.
 */
export function deleteFile(filePath: string | null): boolean {
  if (!filePath) return false;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    logger.error(`[FileUtil] Failed to delete file at ${filePath}:`, error);
  }
  return false;
}



/**
 * Safely deletes a file from its URL.
 * @deprecated Use `deleteCloudOrLocalFileByUrl` instead. This function only supports local files.
 */
export function deleteFileByUrl(url: string | null | undefined): boolean {
  const filePath = urlToPath(url);
  return deleteFile(filePath);
}

/**
 * Safely deletes a file from its URL, supporting both local files and R2 cloud files.
 * If R2 is used, it also retrieves the file metadata to decrement usedBytes atomically.
 */
export async function deleteCloudOrLocalFileByUrl(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;

  try {
    const urlLower = url.toLowerCase().trim();

    // Check if it is a cloud URL
    if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
      const parsedUrl = new URL(url);
      const urlHost = parsedUrl.host.toLowerCase();

      // Query only configs whose publicUrl host matches the URL host, avoiding a full table scan
      const configs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          publicUrl: {
            contains: urlHost,
          },
        },
      });

      for (const config of configs) {
        let baseUrl = config.publicUrl.endsWith('/')
          ? config.publicUrl.slice(0, -1)
          : config.publicUrl;
        if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
          baseUrl = `https://${baseUrl}`;
        }
        
        const baseUrlLower = baseUrl.toLowerCase();

        // If the URL matches this cloud storage public URL prefix
        if (urlLower.startsWith(baseUrlLower)) {
          const pathname = parsedUrl.pathname;
          const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

          if (key) {
            try {
              // 1. Get object metadata to find size
              let size = 0;
              const decryptedConfig = toDecryptedConfig(config);
              try {
                const meta = await storageService.getObjectMetadata(decryptedConfig, key);
                size = meta.ContentLength || 0;
              } catch (metaErr) {
                logger.warn(`[FileUtil] Failed to fetch object metadata for key ${key} before deletion:`, metaErr);
              }

              // 2. Delete file from S3 bucket
              await storageService.deleteFile(decryptedConfig, key);
              logger.info(`[FileUtil] Deleted file from R2 bucket ${config.bucketName}: key=${key}`);

              // 3. Decrement usedBytes
              if (size > 0) {
                await prisma.storageConfig.update({
                  where: { id: config.id },
                  data: { usedBytes: { decrement: size } },
                });
              }
              return true;
            } catch (r2Err) {
              logger.error(`[FileUtil] Failed to delete file from R2 key=${key}:`, r2Err);
            }
          }
        }
      }
    }

    // Fallback: Delete from local disk
    const filePath = urlToPath(url);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[FileUtil] Deleted local file: ${filePath}`);
      return true;
    }
  } catch (err) {
    logger.error(`[FileUtil] Error in deleteCloudOrLocalFileByUrl for url ${url}:`, err);
  }

  return false;
}
