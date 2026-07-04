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

/**
 * Moves a temporary file from uploads/temp to a target subfolder inside uploads.
 * If the file is a remote URL or not found locally, returns it unmodified.
 */
export function moveTempFileToDestination(req: Request, urlOrPath: string, subfolder: string): string {
  if (!urlOrPath) return '';
  
  const localPath = urlToPath(urlOrPath);
  if (localPath && fs.existsSync(localPath)) {
    const filename = path.basename(localPath);
    const destDir = path.resolve(process.cwd(), 'uploads', subfolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, filename);
    fs.renameSync(localPath, destPath);
    
    return `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${filename}`;
  }
  
  return urlOrPath;
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
  knownSizeBytes?: number,
): Promise<boolean> {
  if (!url) return false;

  try {
    const urlLower = url.toLowerCase().trim();

    // Check if it is a cloud URL
    if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
      const parsedUrl = new URL(url);
      const urlHost = parsedUrl.host.toLowerCase();

      // Query configs matching host, fallback to all active configs if direct host match is empty
      let configs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          publicUrl: {
            contains: urlHost,
          },
        },
      });

      if (configs.length === 0) {
        configs = await prisma.storageConfig.findMany({
          where: { status: 'ACTIVE' },
        });
      }

      for (const config of configs) {
        let baseUrl = config.publicUrl.endsWith('/')
          ? config.publicUrl.slice(0, -1)
          : config.publicUrl;
        if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
          baseUrl = `https://${baseUrl}`;
        }

        const baseUrlLower = baseUrl.toLowerCase();

        // If the URL matches this cloud storage public URL prefix or key matches
        if (urlLower.startsWith(baseUrlLower) || configs.length === 1) {
          const pathname = parsedUrl.pathname;
          const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

          if (key) {
            try {
              // 1. Get object metadata to find size if not provided
              let size = knownSizeBytes || 0;
              const decryptedConfig = buildDecryptedStorageConfig(config);
              if (!size) {
                try {
                  const meta = await storageService.getObjectMetadata(decryptedConfig, key);
                  size = meta.ContentLength || 0;
                } catch (metaErr) {
                  logger.warn(
                    `[FileUtil] Failed to fetch object metadata for key ${key} before deletion:`,
                    metaErr,
                  );
                }
              }

              // 2. Delete file from S3 bucket
              await storageService.deleteFile(decryptedConfig, key);
              logger.info(
                `[FileUtil] Deleted file from R2 bucket ${config.bucketName}: key=${key}`,
              );

              // 3. Decrement usedBytes safely
              if (size > 0) {
                const currentConfig = await prisma.storageConfig.findUnique({
                  where: { id: config.id },
                });
                if (currentConfig) {
                  await prisma.storageConfig.update({
                    where: { id: config.id },
                    data: { usedBytes: Math.max(0, currentConfig.usedBytes - size) },
                  });
                }
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
      const lowerUrl = packageUrl.toLowerCase();
      const isZip = lowerUrl.endsWith('.zip') || lowerUrl.includes('.zip?') ||
                    lowerUrl.endsWith('.rar') || lowerUrl.includes('.rar?') ||
                    lowerUrl.endsWith('.7z') || lowerUrl.includes('.7z?');
      if (!isZip) {
        return null;
      }
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

/**
 * Resolves the file size in MB of a local path or a remote URL (including cloud storage URLs).
 */
export async function getFileSizeInMb(urlOrPath: string | null | undefined): Promise<number> {
  if (!urlOrPath) return 0;

  const urlLower = urlOrPath.toLowerCase().trim();
  if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
    try {
      const parsedUrl = new URL(urlOrPath);
      const urlHost = parsedUrl.host.toLowerCase();

      // Find if we have a matching active cloud storage configuration
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

        if (urlLower.startsWith(baseUrlLower)) {
          const pathname = parsedUrl.pathname;
          const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

          if (key) {
            try {
              const decryptedConfig = buildDecryptedStorageConfig(config);
              const meta = await storageService.getObjectMetadata(decryptedConfig, key);
              const sizeBytes = meta.ContentLength || 0;
              if (sizeBytes > 0) {
                return parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
              }
            } catch (r2Err) {
              logger.warn(`[FileUtil] Failed to fetch object metadata from R2 config ${config.name} for key ${key}:`, r2Err);
            }
          }
        }
      }
    } catch (err) {
      logger.error('[FileUtil] Error checking cloud storage for size:', err);
    }

    // Fallback: Perform a HEAD request using Axios to fetch Content-Length header
    try {
      const response = await axios.head(urlOrPath, { timeout: 5000 });
      const contentLength = response.headers['content-length'];
      if (contentLength) {
        const sizeBytes = parseInt(String(contentLength), 10);
        if (!isNaN(sizeBytes) && sizeBytes > 0) {
          return parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
        }
      }
    } catch (axiosErr) {
      logger.warn(`[FileUtil] Axios HEAD request failed for ${urlOrPath}:`, axiosErr);
      // Try GET request with a range header to avoid downloading the whole file if HEAD is not supported
      try {
        const response = await axios.get(urlOrPath, {
          headers: { Range: 'bytes=0-0' },
          timeout: 5000,
        });
        const contentRange = response.headers['content-range'];
        if (contentRange) {
          const match = String(contentRange).match(/\/(\d+)$/);
          if (match) {
            const sizeBytes = parseInt(match[1] || '0', 10);
            if (!isNaN(sizeBytes) && sizeBytes > 0) {
              return parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
            }
          }
        }
        const contentLength = response.headers['content-length'];
        if (contentLength) {
          const sizeBytes = parseInt(String(contentLength), 10);
          if (!isNaN(sizeBytes) && sizeBytes > 0) {
            return parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
          }
        }
      } catch (getErr) {
        logger.warn(`[FileUtil] Axios GET range request failed for ${urlOrPath}:`, getErr);
      }
    }
  }

  // 2. If it's a local file path or resolved from URL
  const localPath = urlToPath(urlOrPath) || urlOrPath;
  try {
    if (fs.existsSync(localPath)) {
      const sizeBytes = fs.statSync(localPath).size;
      return parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
    }
  } catch (err) {
    logger.error(`[FileUtil] Error getting local file size for ${localPath}:`, err);
  }

  return 0;
}

