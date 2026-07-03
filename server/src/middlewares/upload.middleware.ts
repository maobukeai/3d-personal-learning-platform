import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import prisma from '../services/prisma';
import { storageService } from '../services/storage.service';
import { decryptSecretIfNeeded } from '../utils/crypto';
import { UploadedFile } from '../types/upload';
import { optimizeImage } from '../utils/image';
import { gbToBytes } from '../utils/quota';

/** Async delete-if-exists. Swallows ENOENT so callers don't need existsSync. */
const safeUnlink = (p: string): Promise<void> =>
  fs.promises.unlink(p).catch((err: unknown) => {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      logger.warn(`[UploadMiddleware] Failed to unlink ${p}:`, err);
    }
  });

const getStorageTypeForField = (file: Express.Multer.File, req: Request): string => {
  const fieldname = file.fieldname;
  if (req.originalUrl.includes('/showcase') || req.baseUrl.includes('showcase')) {
    return 'SHOWCASE';
  }
  if (fieldname === 'asset' || (fieldname === 'thumbnail' && req.baseUrl.includes('asset'))) {
    return 'ASSET';
  }
  if (fieldname === 'material' || (fieldname === 'preview' && req.baseUrl.includes('material'))) {
    return 'MATERIAL';
  }
  if (fieldname === 'plugin_file' || fieldname === 'plugin_preview') {
    return 'PLUGIN';
  }
  if (
    fieldname === 'mirror_image' ||
    req.originalUrl.includes('/mirror') ||
    req.baseUrl.includes('mirror')
  ) {
    return 'MIRROR';
  }
  return 'ALL';
};

/** All image-purpose upload field names — used for size limits and extension checks. */
const IMAGE_FIELD_NAMES = [
  'logo',
  'favicon',
  'avatar',
  'cover',
  'manual_image',
  'mirror_image',
  'image',
  'images',
  'thumbnail',
  'banner',
  'banner_image',
  'preview',
  'plugin_preview',
  'task_image',
] as const;
type ImageFieldName = (typeof IMAGE_FIELD_NAMES)[number];

const isImageField = (fieldname: string): fieldname is ImageFieldName =>
  (IMAGE_FIELD_NAMES as readonly string[]).includes(fieldname);

/** Maps upload field names to their target upload directory. */
const FIELD_TO_DIR: Record<string, string> = {
  cover: './uploads/covers',
  attachment: './uploads/feedback',
  file: './uploads/feedback',
  files: './uploads/feedback',
  message_file: './uploads/messages',
  asset: './uploads/assets',
  package: './uploads/assets',
  material: './uploads/materials',
  preview: './uploads/materials',
  thumbnail: './uploads/assets',
  logo: './uploads/branding',
  favicon: './uploads/branding',
  images: './uploads/discussions',
  manual_image: './uploads/manual',
  mirror_image: './uploads/mirror',
  image: './uploads/ai',
  plugin_file: './uploads/plugins',
  plugin_preview: './uploads/plugins',
  banner: './uploads/banners',
  banner_image: './uploads/banners',
  task_image: './uploads/tasks',
  temp: './uploads/temp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir: string;

    // Showcase context overrides thumbnail/images destination
    if (
      (file.fieldname === 'thumbnail' || file.fieldname === 'images') &&
      req.baseUrl.includes('showcase')
    ) {
      dir = './uploads/showcase';
    } else {
      dir = FIELD_TO_DIR[file.fieldname] ?? './uploads/avatars';
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
  },
});

const createUploadMiddleware = (config: {
  type: 'single' | 'array' | 'fields';
  fieldname?: string;
  maxCount?: number;
  fields?: multer.Field[];
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await settingsService.getAll();
      let maxFileSize = (settings.MAX_FILE_SIZE || 100) * 1024 * 1024;
      let allowedExtensions: string[] = ['.jpeg', '.jpg', '.png', '.glb', '.gltf'];

      // 处理允许的扩展名 - 支持字符串和数组格式
      if (settings.ALLOWED_EXTENSIONS) {
        if (typeof settings.ALLOWED_EXTENSIONS === 'string') {
          allowedExtensions = (settings.ALLOWED_EXTENSIONS as string)
            .split(',')
            .map((ext) => ext.trim().toLowerCase());
        } else if (Array.isArray(settings.ALLOWED_EXTENSIONS)) {
          allowedExtensions = (settings.ALLOWED_EXTENSIONS as string[]).map((ext) =>
            ext.toLowerCase(),
          );
        }
      }

      // Check if the upload config consists exclusively of system image fields.
      // If there are any non-image fields (like 'asset', 'material', 'plugin_file'),
      // we must use the larger file size limit from the settings.
      const isMessageUpload = config.fieldname === 'message_file';
      const hasNonImageField =
        (config.fieldname && !isImageField(config.fieldname)) ||
        (config.fields && config.fields.some((f) => !isImageField(f.name)));

      const isSystemImage = !hasNonImageField;

      if (isMessageUpload) {
        maxFileSize = 500 * 1024 * 1024; // 500MB limit for chat messages
      } else if (isSystemImage) {
        maxFileSize = 5 * 1024 * 1024;
      }

      // Special override: if importing a mirror source ZIP, the file size limit is 5GB.
      const isMirrorImport =
        config.fieldname === 'file' &&
        (req.originalUrl.includes('/mirror/sources/import') || req.baseUrl.includes('mirror'));

      if (isMirrorImport) {
        maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB
      }

      const dynamicMulter = multer({
        storage: storage,
        limits: {
          fileSize: maxFileSize,
          files: 100,
        },
        fileFilter: (req, file, cb) => {
          if (file.fieldname === 'message_file') {
            return cb(null, true);
          }

          const ext = path.extname(file.originalname).toLowerCase();
          let finalAllowedExtensions = allowedExtensions;

          if (isImageField(file.fieldname)) {
            if (
              file.fieldname === 'images' &&
              (req.originalUrl.includes('/showcase') || req.baseUrl.includes('showcase'))
            ) {
              finalAllowedExtensions = [
                '.png',
                '.jpg',
                '.jpeg',
                '.gif',
                '.webp',
                '.svg',
                '.ico',
                '.mp4',
                '.webm',
                '.mov',
                '.ogg',
              ];
            } else {
              finalAllowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
            }
          } else if (
            file.fieldname === 'file' ||
            file.fieldname === 'excel' ||
            file.fieldname === 'files' ||
            file.fieldname === 'package'
          ) {
            finalAllowedExtensions = [...allowedExtensions, '.xlsx', '.xls', '.zip'];
          } else if (file.fieldname === 'plugin_file') {
            finalAllowedExtensions = [
              '.zip',
              '.rar',
              '.7z',
              '.blend',
              '.js',
              '.ts',
              '.py',
              '.lua',
              '.mjs',
            ];
          } else if (file.fieldname === 'plugin_preview') {
            finalAllowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
          } else if (file.fieldname === 'message_file') {
            finalAllowedExtensions = [
              '.png',
              '.jpg',
              '.jpeg',
              '.gif',
              '.webp',
              '.svg',
              '.webm',
              '.wav',
              '.mp3',
              '.ogg',
              '.m4a',
              '.mp4',
              '.aac',
              '.pdf',
              '.doc',
              '.docx',
              '.xls',
              '.xlsx',
              '.ppt',
              '.pptx',
              '.txt',
              '.zip',
              '.rar',
              '.7z',
              '.glb',
              '.gltf',
              '.fbx',
              '.obj',
              '.stl',
            ];
          }

          if (!finalAllowedExtensions.includes(ext)) {
            logger.error(
              `[UploadError] Extension not allowed: ${ext} for field ${file.fieldname}. Allowed: ${finalAllowedExtensions.join(', ')}`,
            );
            return cb(new Error(`不支持的文件类型: ${ext}`));
          }
          cb(null, true);
        },
      });

      let multerAction;
      if (config.type === 'single') {
        multerAction = dynamicMulter.single(config.fieldname!);
      } else if (config.type === 'array') {
        multerAction = dynamicMulter.array(config.fieldname!, config.maxCount);
      } else {
        multerAction = dynamicMulter.fields(config.fields!);
      }

      multerAction(req, res, async (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const isMirrorImport =
              config.fieldname === 'file' &&
              (req.originalUrl.includes('/mirror/sources/import') ||
                req.baseUrl.includes('mirror'));
            const displayLimit = isMessageUpload
              ? '500MB'
              : isMirrorImport
                ? '5GB'
                : isSystemImage
                  ? '5MB'
                  : `${settings.MAX_FILE_SIZE || 100}MB`;
            logger.error(`[UploadError] LIMIT_FILE_SIZE: file size exceeded (${displayLimit})`);
            return res.status(400).json({ error: `文件大小超过限制 (${displayLimit})` });
          }
          logger.error(`[UploadError] MulterError: ${err instanceof Error ? err.message : err}`);
          return res
            .status(400)
            .json({ error: err instanceof Error ? err.message : 'An error occurred' });
        } else if (err) {
          logger.error(`[UploadError] Unknown error: ${err instanceof Error ? err.message : err}`);
          return res
            .status(400)
            .json({ error: err instanceof Error ? err.message : 'An error occurred' });
        }

        // Decode filename from ISO-8859-1 (latin1) to UTF-8 to fix Multer's filename Mojibake bug
        if (req.file) {
          req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        }
        if (req.files) {
          const filesMap = req.files as
            | { [fieldname: string]: Express.Multer.File[] }
            | Express.Multer.File[];
          if (Array.isArray(filesMap)) {
            for (const file of filesMap) {
              if (file) {
                file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
              }
            }
          } else {
            for (const fieldname in filesMap) {
              const fileList = filesMap[fieldname];
              if (Array.isArray(fileList)) {
                for (const file of fileList) {
                  if (file) {
                    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
                  }
                }
              }
            }
          }
        }

        // Manual size check for dynamic settings
        const files = req.file
          ? { [req.file.fieldname]: [req.file] }
          : (req.files as { [fieldname: string]: Express.Multer.File[] });

        if (files) {
          for (const fieldname in files) {
            const fileList = Array.isArray(files[fieldname])
              ? files[fieldname]
              : [files[fieldname]];
            for (const file of fileList) {
              if (!file) continue;

              let finalMaxFileSize = maxFileSize;
              if (isImageField(file.fieldname)) {
                finalMaxFileSize = 5 * 1024 * 1024;
              }

              if (file.size > finalMaxFileSize) {
                await safeUnlink(file.path);
                const isMirrorImport =
                  file.fieldname === 'file' &&
                  (req.originalUrl.includes('/mirror/sources/import') ||
                    req.baseUrl.includes('mirror'));
                const displayLimit = isMirrorImport
                  ? '5GB'
                  : isImageField(file.fieldname)
                    ? '5MB'
                    : `${settings.MAX_FILE_SIZE || 100}MB`;
                logger.error(
                  `[UploadError] File ${file.originalname} size ${file.size} exceeded limit ${displayLimit}`,
                );
                return res.status(400).json({
                  error: `文件 ${file.originalname} 超过大小限制 (${displayLimit})`,
                });
              }
            }
          }
        }

        // Automatic image optimization for system images
        if (files) {
          try {
            for (const fieldname in files) {
              const fileList = Array.isArray(files[fieldname])
                ? files[fieldname]
                : [files[fieldname]];
              for (const file of fileList) {
                if (!file) continue;

                const ext = path.extname(file.originalname).toLowerCase();
                const isImageExtension = [
                  '.png',
                  '.jpg',
                  '.jpeg',
                  '.bmp',
                  '.tiff',
                  '.webp',
                  '.gif',
                  '.svg',
                ].includes(ext);

                // Optimize if it is a standard image field OR a general file field carrying an image
                const shouldOptimize =
                  (isImageField(file.fieldname) && isImageExtension) ||
                  (['message_file', 'attachment', 'file', 'files'].includes(file.fieldname) &&
                    isImageExtension);

                if (shouldOptimize) {
                  // Validate first (before compression to avoid wasting CPU/memory)
                  await validateSingleFileContent(file);
                  // Optimize (resize, convert to WebP / SVGO)
                  await optimizeImage(file);
                }
              }
            }
          } catch (optimizeError: unknown) {
            logger.error(`[UploadError] Image optimization failed:`, optimizeError);
            // Cleanup all uploaded files in this request on failure to prevent orphans
            for (const fieldname in files) {
              const fileList = Array.isArray(files[fieldname])
                ? files[fieldname]
                : [files[fieldname]];
              for (const file of fileList) {
                if (file) {
                  await safeUnlink(file.path);
                }
              }
            }
            return res.status(400).json({
              error: optimizeError instanceof Error ? optimizeError.message : '图片压缩失败',
            });
          }
        }

        // R2 Cloud Storage Interception
        if (files) {
          const allFiles: Express.Multer.File[] = [];
          for (const fieldname in files) {
            const fileList = Array.isArray(files[fieldname])
              ? files[fieldname]
              : [files[fieldname]];
            for (const file of fileList) {
              if (file) allFiles.push(file);
            }
          }

          // Skip automatic R2 upload interception for direct storage config file uploads,
          // mirror source import zips, and Excel matching link files, which are processed locally.
          if (
            allFiles.length > 0 &&
            !req.originalUrl.includes('/storage-configs/') &&
            !req.originalUrl.includes('/mirror/sources/import') &&
            !req.originalUrl.includes('/match-links')
          ) {
            try {
              // Validate all files content first before uploading to R2
              for (const file of allFiles) {
                await validateSingleFileContent(file);
              }
              const settings = await settingsService.getAll();
              const forceCloud = settings.FORCE_R2_STORAGE === true;

              const activeCount = await prisma.storageConfig.count({
                where: { status: 'ACTIVE' },
              });

              if (forceCloud && activeCount === 0) {
                await Promise.all(allFiles.map((f) => safeUnlink(f.path)));
                return res.status(400).json({
                  error: '暂时维护中',
                });
              }
              if (activeCount > 0) {
                // Find the main file in this request to determine the shared folder name and prefix
                const mainFile =
                  allFiles.find((f) => f.fieldname === 'asset') ||
                  allFiles.find((f) => f.fieldname === 'material') ||
                  allFiles.find((f) => f.fieldname === 'plugin_file') ||
                  allFiles.find((f) => f.fieldname === 'file' || f.fieldname === 'files') ||
                  allFiles[0];

                if (!mainFile) {
                  return next();
                }

                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const mainSanitizedOriginalName = mainFile.originalname
                  // eslint-disable-next-line no-control-regex
                  .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
                  .replace(/\s+/g, '_');
                const mainExtName = path.extname(mainSanitizedOriginalName);
                const mainBaseName =
                  path.basename(mainSanitizedOriginalName, mainExtName) || 'file';
                const sharedFolderName = `${mainBaseName}-${uniqueSuffix}`;

                const getFolderPrefix = (fieldname: string): string => {
                  if (req.originalUrl.includes('/showcase') || req.baseUrl.includes('showcase'))
                    return 'showcase';
                  if (fieldname === 'asset' || fieldname === 'thumbnail') return 'asset';
                  if (fieldname === 'material' || fieldname === 'preview') return 'material';
                  if (fieldname === 'plugin_file' || fieldname === 'plugin_preview')
                    return 'plugin';
                  if (
                    fieldname === 'mirror_image' ||
                    req.originalUrl.includes('/mirror') ||
                    req.baseUrl.includes('mirror')
                  ) {
                    return 'mirror';
                  }
                  return fieldname;
                };
                const folderPrefix = getFolderPrefix(mainFile.fieldname);

                // Pre-fetch all ACTIVE storage configs once and group by assetType.
                // Previously this hit the DB once per uploaded file (N+1 when a
                // request carries multiple files). Falling back from a specific
                // type to 'ALL' is now an in-memory Map lookup.
                const allActiveConfigs = await prisma.storageConfig.findMany({
                  where: { status: 'ACTIVE' },
                  orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
                });
                const configsByType = new Map<string, typeof allActiveConfigs>();
                for (const cfg of allActiveConfigs) {
                  const arr = configsByType.get(cfg.assetType) || [];
                  arr.push(cfg);
                  configsByType.set(cfg.assetType, arr);
                }

                for (const file of allFiles) {
                  const storageType = getStorageTypeForField(file, req);

                  // Specific type first, fall back to 'ALL' if missing.
                  let configs = configsByType.get(storageType) || [];
                  if (configs.length === 0 && storageType !== 'ALL') {
                    configs = configsByType.get('ALL') || [];
                  }

                  if (configs.length === 0) {
                    await Promise.all(allFiles.map((f) => safeUnlink(f.path)));
                    return res.status(400).json({
                      error: `未配置适用于 [${storageType}] 的可用云存储账号`,
                    });
                  }

                  let uploaded = false;
                  let uploadErrorMsg: string | null = null;
                  for (const config of configs) {
                    const limitBytes = gbToBytes(config.limitGb);

                    // Thread-safe atomic space reservation
                    const updateResult = await prisma.storageConfig.updateMany({
                      where: {
                        id: config.id,
                        status: 'ACTIVE',
                        usedBytes: { lte: limitBytes - file.size },
                      },
                      data: {
                        usedBytes: { increment: file.size },
                      },
                    });

                    if (updateResult.count > 0) {
                      try {
                        const sanitizedOriginalName = file.originalname
                          // eslint-disable-next-line no-control-regex
                          .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
                          .replace(/\s+/g, '_');
                        const key = `${folderPrefix}/${sharedFolderName}/${sanitizedOriginalName}`;

                        const r2Url = await storageService.uploadFile(
                          {
                            endpoint: config.endpoint,
                            accessKeyId: config.accessKeyId,
                            secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                            bucketName: config.bucketName,
                            publicUrl: config.publicUrl,
                          },
                          file.path,
                          key,
                          file.mimetype,
                        );

                        (file as UploadedFile).url = r2Url;
                        (file as UploadedFile).r2Key = key;
                        (file as UploadedFile).r2ConfigId = config.id;

                        // Delete local file immediately unless it's a 3D asset file (.glb or .gltf)
                        // or a resource package/plugin ZIP file that needs parsing in controllers.
                        const ext = path.extname(file.originalname).toLowerCase();
                        const is3DAsset =
                          (file.fieldname === 'asset' && (ext === '.glb' || ext === '.gltf')) ||
                          (file.fieldname === 'package' && ext === '.zip') ||
                          (file.fieldname === 'material' && ext === '.zip') ||
                          (file.fieldname === 'plugin_file' && ext === '.zip');

                        if (!is3DAsset) {
                          await safeUnlink(file.path);
                        }

                        uploaded = true;
                        break;
                      } catch (uploadError: unknown) {
                        uploadErrorMsg =
                          (uploadError instanceof Error ? uploadError.message : null) ||
                          String(uploadError);
                        logger.error(
                          `[UploadMiddleware] Upload to R2 config [${config.name}] failed:`,
                          uploadError,
                        );
                        // Revert reserved space
                        await prisma.storageConfig.update({
                          where: { id: config.id },
                          data: { usedBytes: { decrement: file.size } },
                        });
                      }
                    }
                  }

                  if (!uploaded) {
                    await Promise.all(allFiles.map((f) => safeUnlink(f.path)));
                    const errMsg = uploadErrorMsg
                      ? `上传到云存储失败: ${uploadErrorMsg}`
                      : `云存储空间已满 (限额 9.8GB/账号) 且无法保存文件 [${file.originalname}]，请联系管理员。`;
                    return res.status(400).json({
                      error: errMsg,
                    });
                  }
                }
              }
            } catch (storageDbError: unknown) {
              logger.error(
                '[UploadMiddleware] Storage interception DB/validation error:',
                storageDbError,
              );
              await Promise.all(allFiles.map((f) => safeUnlink(f.path)));
              const errorMessage =
                storageDbError instanceof Error ? storageDbError.message : '存储系统初始化失败';
              return res.status(400).json({ error: errorMessage });
            }
          }
        }
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

export const upload = {
  single: (fieldname: string) => createUploadMiddleware({ type: 'single', fieldname }),
  array: (fieldname: string, maxCount?: number) =>
    createUploadMiddleware({ type: 'array', fieldname, maxCount }),
  fields: (fields: multer.Field[]) => createUploadMiddleware({ type: 'fields', fields }),
};

const model3dExtensions = [
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.stl',
  '.dae',
  '.3ds',
  '.blend',
  '.usdz',
  '.abc',
];
const documentExtensions = ['.pdf', '.zip', '.rar', '.7z'];
const imageUploadFields = new Set([
  'logo',
  'favicon',
  'avatar',
  'cover',
  'manual_image',
  'mirror_image',
  'image',
  'images',
  'thumbnail',
  'banner',
  'banner_image',
  'preview',
  'plugin_preview',
  'task_image',
]);

const detectImageMime = (buffer: Buffer): string | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    return 'image/bmp';
  }
  return null;
};

const looksLikeExecutableContent = (buffer: Buffer): boolean => {
  const text = buffer.subarray(0, 4096).toString('utf8').toLowerCase();
  return (
    text.includes('<script') ||
    text.includes('<!doctype html') ||
    text.includes('<html') ||
    text.includes('<?php') ||
    text.startsWith('#!/bin/sh') ||
    text.startsWith('#!/usr/bin/env') ||
    text.startsWith('@echo off')
  );
};

export const validateSingleFileContent = async (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'message_file') {
    // For chat message files, allow all formats, but block PHP files for security
    if (ext === '.php' || ext === '.php5' || ext === '.phtml') {
      await safeUnlink(file.path);
      throw new Error('安全限制：不允许上传 PHP 脚本文件');
    }
    // Check looksLikeExecutableContent but only if it's HTML or SVG to prevent HTML-based XSS
    if (ext === '.html' || ext === '.htm' || ext === '.svg') {
      const buffer = await fs.promises.readFile(file.path);
      if (looksLikeExecutableContent(buffer)) {
        await safeUnlink(file.path);
        throw new Error('安全限制：不允许上传包含脚本的 HTML/SVG 文件');
      }
    }
    return;
  }

  if (
    model3dExtensions.includes(ext) ||
    documentExtensions.includes(ext) ||
    ((file.fieldname === 'plugin_file' || file.fieldname === 'temp') && ['.js', '.ts', '.py', '.lua', '.mjs'].includes(ext))
  ) {
    return;
  }

  if (ext === '.svg') {
    const content = await fs.promises.readFile(file.path, 'utf8');
    const hasScript = /<script\b[^>]*>/i.test(content);
    const hasEventHandlers = /\bon[a-z]+\s*=/i.test(content);
    const hasJavascriptUrl = /href\s*=\s*["']\s*javascript:/i.test(content);
    if (hasScript || hasEventHandlers || hasJavascriptUrl) {
      await safeUnlink(file.path);
      throw new Error('安全验证失败：SVG文件包含潜在的安全隐患');
    }

    if (!content.includes('<svg') && !content.includes('http://www.w3.org/2000/svg')) {
      await safeUnlink(file.path);
      throw new Error('无效的SVG图片内容');
    }
    return;
  }

  const buffer = await fs.promises.readFile(file.path);
  if (buffer.length > 0) {
    const imageMime = detectImageMime(buffer);

    if (imageUploadFields.has(file.fieldname)) {
      if (!imageMime) {
        await safeUnlink(file.path);
        throw new Error('无效的图片文件内容');
      }
    }

    if (looksLikeExecutableContent(buffer)) {
      await safeUnlink(file.path);
      throw new Error('不允许上传可执行或脚本文件');
    }
  }
};

export const validateFileContent = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.file
    ? [req.file]
    : req.files
      ? (Object.values(req.files).flat() as Express.Multer.File[])
      : [];
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      // If the file was already uploaded to R2 and deleted locally, skip local content check
      if ((file as UploadedFile).url) {
        continue;
      }
      await validateSingleFileContent(file);
    }
    next();
  } catch (error: unknown) {
    logger.error('File validation error:', error);
    await Promise.all(files.map((f) => safeUnlink(f.path)));
    const errMsg = error instanceof Error ? error.message : '文件验证失败';
    return res.status(400).json({ error: errMsg });
  }
};
