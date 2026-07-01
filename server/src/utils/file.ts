import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import prisma from '../services/prisma';
import { storageService } from '../services/storage.service';
import { buildDecryptedStorageConfig } from './crypto';
import unzipper from 'unzipper';
import axios from 'axios';
import iconv from 'iconv-lite';
import type { Request } from 'express';
import type { UploadedFile } from '../types/upload';

/**
 * Returns the public URL for an uploaded file.
 * Prefers the cloud storage URL (R2/S3) if available,
 * otherwise constructs a local URL from the request context.
 *
 * @param req      - Express Request (used to build the fallback URL)
 * @param file     - Multer file object (may have an `.url` property after cloud upload)
 * @param subfolder - The uploads subfolder (e.g. 'assets', 'materials', 'tasks')
 */
export function getUploadedFileUrl(
  req: Request,
  file: Express.Multer.File,
  subfolder: string,
): string {
  return (
    (file as UploadedFile).url ||
    `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${file.filename}`
  );
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
 * Safely deletes a file from its URL, supporting both local files and R2 cloud files.
 * If R2 is used, it also retrieves the file metadata to decrement usedBytes atomically.
 */
export async function deleteCloudOrLocalFileByUrl(
  url: string | null | undefined,
): Promise<boolean> {
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
              const decryptedConfig = buildDecryptedStorageConfig(config);
              try {
                const meta = await storageService.getObjectMetadata(decryptedConfig, key);
                size = meta.ContentLength || 0;
              } catch (metaErr) {
                logger.warn(
                  `[FileUtil] Failed to fetch object metadata for key ${key} before deletion:`,
                  metaErr,
                );
              }

              // 2. Delete file from S3 bucket
              await storageService.deleteFile(decryptedConfig, key);
              logger.info(
                `[FileUtil] Deleted file from R2 bucket ${config.bucketName}: key=${key}`,
              );

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

    // Fallback: Delete from local disk (use async fs.promises to avoid blocking the event loop).
    const filePath = urlToPath(url);
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
        logger.info(`[FileUtil] Deleted local file: ${filePath}`);
        return true;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        // ENOENT means the file is already gone — not an error.
        if (code !== 'ENOENT') {
          logger.error(`[FileUtil] Failed to delete local file at ${filePath}:`, err);
        }
      }
    }
  } catch (err) {
    logger.error(`[FileUtil] Error in deleteCloudOrLocalFileByUrl for url ${url}:`, err);
  }

  return false;
}

interface CacheEntry {
  files: string[];
  expiresAt: number;
}

const zipFilesCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 200;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const decodeEntryPath = (file: any): string => {
  const pathBuffer = file.pathBuffer || file.props?.pathBuffer;
  const isUnicode = file.isUnicode ?? file.props?.flags?.isUnicode;
  if (pathBuffer && !isUnicode) {
    try {
      // Decode using GBK for legacy Chinese ZIP files created on Windows
      return iconv.decode(pathBuffer, 'gbk');
    } catch {
      // Fallback
    }
  }
  return file.path;
};

/**
 * Safely parses a local ZIP file and returns a list of files.
 */
export const parseZipLocal = async (localFilePath: string): Promise<string[]> => {
  try {
    // unzipper.Open.file throws ENOENT if the file is missing — no need for
    // a prior fs.existsSync (which is a sync call that blocks the event loop).
    const directory = await unzipper.Open.file(localFilePath);
    return directory.files
      .map((file) => decodeEntryPath(file))
      .filter((filePath) => {
        const name = filePath.toLowerCase();
        return !name.includes('__macosx') && !name.includes('.ds_store') && !filePath.endsWith('/');
      });
  } catch (error) {
    logger.error(`[FileUtil] Failed to parse local ZIP package at ${localFilePath}:`, error);
  }
  return [];
};

/**
 * Safely opens a remote or local ZIP package file and returns its directory.
 */
export const getZipFileDirectory = async (
  packageUrl: string | null,
): Promise<unzipper.CentralDirectory | null> => {
  if (!packageUrl) return null;

  try {
    // If it's a local uploads file URL, extract the path and open it locally
    if (packageUrl.includes('/uploads/')) {
      const relativePart = packageUrl.split('/uploads/').pop();
      if (relativePart) {
        const localPath = path.join(process.cwd(), 'uploads', relativePart);
        // unzipper.Open.file throws if the file is missing — catch and treat
        // as "not found" rather than calling fs.existsSync synchronously.
        try {
          return await unzipper.Open.file(localPath);
        } catch (openErr) {
          const code = (openErr as NodeJS.ErrnoException)?.code;
          if (code !== 'ENOENT') throw openErr;
        }
      }
    }

    if (packageUrl.startsWith('http://') || packageUrl.startsWith('https://')) {
      logger.info(`[FileUtil] Fetching remote ZIP: ${packageUrl}`);
      const response = await axios.get(packageUrl, { responseType: 'arraybuffer', timeout: 15000 });
      return await unzipper.Open.buffer(response.data);
    }
  } catch (error) {
    logger.error(`[FileUtil] Failed to open ZIP directory for ${packageUrl}:`, error);
  }
  return null;
};

/**
 * Safely parses a remote or local ZIP file URL and returns a list of files, caching results.
 */
export const getZipFileNames = async (packageUrl: string | null): Promise<string[]> => {
  if (!packageUrl) return [];

  if (zipFilesCache.has(packageUrl)) {
    const entry = zipFilesCache.get(packageUrl);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.files;
      } else {
        zipFilesCache.delete(packageUrl);
      }
    }
  }

  try {
    const directory = await getZipFileDirectory(packageUrl);
    if (directory) {
      const files = directory.files
        .map((file) => decodeEntryPath(file))
        .filter((filePath) => {
          const name = filePath.toLowerCase();
          return (
            !name.includes('__macosx') && !name.includes('.ds_store') && !filePath.endsWith('/')
          );
        });

      if (zipFilesCache.size >= MAX_CACHE_SIZE) {
        const firstKey = zipFilesCache.keys().next().value;
        if (firstKey) {
          zipFilesCache.delete(firstKey);
        }
      }
      zipFilesCache.set(packageUrl, {
        files,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return files;
    }
  } catch (error) {
    logger.error(
      `[FileUtil] Failed to read ZIP file names from package URL: ${packageUrl}:`,
      error,
    );
  }
  return [];
};
