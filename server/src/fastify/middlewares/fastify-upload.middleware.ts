import type { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import prisma from '../../services/prisma';
import { storageService } from '../../services/storage.service';
import { decryptSecretIfNeeded } from '../../utils/crypto';
import { gbToBytes } from '../../utils/quota';
import { optimizeImage, downsampleImageBuffer } from '../../utils/image';
import { validateSingleFileContent } from '../../utils/file-validation';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/error';
import type { UploadedFile } from '../../types/upload';

interface FastifyUploadField {
  name: string;
  maxCount?: number;
}

const IMAGE_FIELD_NAMES = new Set([
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
  'software_preview',
]);

const getStorageTypeForField = (fieldname: string, url: string): string => {
  if (fieldname === 'temporary_file') {
    return 'TEMPORARY_NETDISK';
  }
  if (url.includes('/showcase')) {
    return 'SHOWCASE';
  }
  if (fieldname === 'asset' || (fieldname === 'thumbnail' && url.includes('/assets'))) {
    return 'ASSET';
  }
  if (fieldname === 'material' || (fieldname === 'preview' && url.includes('/materials'))) {
    return 'MATERIAL';
  }
  if (fieldname === 'plugin_file' || fieldname === 'plugin_preview') {
    return 'PLUGIN';
  }
  if (fieldname === 'mirror_image' || url.includes('/mirror')) {
    return 'MIRROR';
  }
  return 'ALL';
};

const getFolderPrefix = (fieldname: string, url: string): string => {
  if (fieldname === 'temporary_file') return 'temporary';
  if (url.includes('/showcase')) return 'showcase';
  if (fieldname === 'asset' || fieldname === 'thumbnail') return 'asset';
  if (fieldname === 'material' || fieldname === 'preview') return 'material';
  if (fieldname === 'plugin_file' || fieldname === 'plugin_preview') return 'plugin';
  if (fieldname === 'mirror_image' || url.includes('/mirror')) return 'mirror';
  return fieldname;
};

export const fastifyUpload = (fields: FastifyUploadField[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.isMultipart()) {
      return;
    }

    try {
      let maxFileSize = 100 * 1024 * 1024;
      let allowedExtensions: string[] = ['.jpeg', '.jpg', '.png', '.glb', '.gltf'];

      // Fetch dynamic settings
      try {
        const { settingsService } = await import('../../services/settings.service');
        const settings = await settingsService.getAll();
        maxFileSize = (settings.MAX_FILE_SIZE || 100) * 1024 * 1024;
        const configuredExtensions = settings.ALLOWED_EXTENSIONS as unknown;
        if (configuredExtensions) {
          if (typeof configuredExtensions === 'string') {
            allowedExtensions = configuredExtensions
              .split(',')
              .map((ext) => ext.trim().toLowerCase());
          } else if (Array.isArray(configuredExtensions)) {
            allowedExtensions = configuredExtensions.map((ext) => String(ext).toLowerCase());
          }
        }
      } catch {
        // Fall back to defaults in tests
      }

      const body: Record<string, unknown> = {};
      const filesMap: Record<string, UploadedFile[]> = {};

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const fieldConfig = fields.find((f) => f.name === part.fieldname);
          if (!fieldConfig) {
            continue;
          }

          const ext = path.extname(part.filename).toLowerCase();
          let finalAllowedExtensions = allowedExtensions;

          if (IMAGE_FIELD_NAMES.has(part.fieldname)) {
            if (part.fieldname === 'images' && request.url.includes('/showcase')) {
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
            part.fieldname === 'file' ||
            part.fieldname === 'excel' ||
            part.fieldname === 'files' ||
            part.fieldname === 'package'
          ) {
            finalAllowedExtensions = [...allowedExtensions, '.xlsx', '.xls', '.zip'];
          } else if (part.fieldname === 'plugin_file') {
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
          } else if (part.fieldname === 'plugin_preview') {
            finalAllowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
          } else if (part.fieldname === 'message_file') {
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
            throw new AppError(`不支持的文件类型: ${ext}`, 400);
          }

          // File size limits check
          let limit = maxFileSize;
          if (part.fieldname === 'message_file') {
            limit = 500 * 1024 * 1024;
          } else if (IMAGE_FIELD_NAMES.has(part.fieldname)) {
            limit = 5 * 1024 * 1024;
          } else if (['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm'].includes(ext)) {
            limit = 200 * 1024 * 1024;
          } else if (part.fieldname === 'file' && request.url.includes('/mirror/sources/import')) {
            limit = 5 * 1024 * 1024 * 1024; // 5GB
          }

          const buffer = await part.toBuffer();
          if (buffer.length > limit) {
            const displayLimit =
              limit >= 1024 * 1024 * 1024
                ? `${(limit / (1024 * 1024 * 1024)).toFixed(0)}GB`
                : `${(limit / (1024 * 1024)).toFixed(0)}MB`;
            throw new AppError(`文件 ${part.filename} 超过大小限制 (${displayLimit})`, 400);
          }

          const fileObj: UploadedFile = {
            fieldname: part.fieldname,
            originalname: part.filename,
            encoding: part.encoding,
            mimetype: part.mimetype,
            buffer,
            size: buffer.length,
          };

          // Optimizations
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

          const isBucketUpload = request.url.includes('/storage-configs/');

          if (isImageExtension && !isBucketUpload) {
            const isMaterialOrAsset = ['material', 'asset'].includes(part.fieldname);
            if (isMaterialOrAsset) {
              await validateSingleFileContent(fileObj);
              try {
                const downsampled = await downsampleImageBuffer(buffer, 1024, 1024);
                fileObj.buffer = downsampled;
                fileObj.size = downsampled.length;
              } catch (downsampleErr) {
                logger.error('[FastifyUpload] Downsampling failed:', downsampleErr);
              }
            } else {
              await validateSingleFileContent(fileObj);
              await optimizeImage(fileObj as unknown as Express.Multer.File);
            }
          }

          const fieldFiles = filesMap[part.fieldname] ?? (filesMap[part.fieldname] = []);
          fieldFiles.push(fileObj);
        } else {
          body[part.fieldname] = part.value;
        }
      }

      // Intercept and upload to R2 Cloud Storage
      const allFiles: UploadedFile[] = Object.values(filesMap).flat();
      if (
        allFiles.length > 0 &&
        !request.url.includes('/storage-configs/') &&
        !request.url.includes('/mirror/sources/import') &&
        !request.url.includes('/match-links')
      ) {
        // Content validation
        for (const file of allFiles) {
          await validateSingleFileContent(file);
        }

        const activeCount = await prisma.storageConfig.count({
          where: { status: 'ACTIVE' },
        });
        if (activeCount === 0) {
          throw new AppError('未配置可用的云存储账号', 400);
        }

        const mainFile =
          allFiles.find((f) => f.fieldname === 'asset') ||
          allFiles.find((f) => f.fieldname === 'material') ||
          allFiles.find((f) => f.fieldname === 'plugin_file') ||
          allFiles.find((f) => f.fieldname === 'file' || f.fieldname === 'files') ||
          allFiles[0];
        if (!mainFile) {
          throw new AppError('未找到可上传的文件', 400);
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const mainSanitizedOriginalName = mainFile.originalname
          // eslint-disable-next-line no-control-regex
          .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
          .replace(/\s+/g, '_');
        const mainExtName = path.extname(mainSanitizedOriginalName);
        const mainBaseName = path.basename(mainSanitizedOriginalName, mainExtName) || 'file';
        const sharedFolderName = `${mainBaseName}-${uniqueSuffix}`;
        const folderPrefix = getFolderPrefix(mainFile.fieldname, request.url);

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
          const storageType = getStorageTypeForField(file.fieldname, request.url);
          let configs = configsByType.get(storageType) || [];
          if (configs.length === 0 && storageType !== 'ALL') {
            configs = configsByType.get('ALL') || [];
          }

          if (configs.length === 0) {
            throw new AppError(`未配置适用于 [${storageType}] 的可用云存储账号`, 400);
          }

          let uploaded = false;
          let uploadErrorMsg: string | null = null;

          for (const config of configs) {
            const limitBytes = gbToBytes(config.limitGb);

            // Reserve DB space atomically
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

                const r2Url = await storageService.uploadBuffer(
                  {
                    endpoint: config.endpoint,
                    accessKeyId: config.accessKeyId,
                    secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                    bucketName: config.bucketName,
                    publicUrl: config.publicUrl,
                  },
                  file.buffer!,
                  key,
                  file.mimetype,
                );

                file.url = r2Url;
                file.r2Key = key;
                file.r2ConfigId = config.id;
                uploaded = true;
                break;
              } catch (uploadError: unknown) {
                uploadErrorMsg =
                  uploadError instanceof Error ? uploadError.message : String(uploadError);
                logger.error(
                  `[FastifyUpload] Upload to R2 config [${config.name}] failed:`,
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
            throw new AppError(
              uploadErrorMsg
                ? `上传到云存储失败: ${uploadErrorMsg}`
                : `云存储空间已满且无法保存文件 [${file.originalname}]，请联系管理员。`,
              400,
            );
          }
        }
      }

      // Map properties onto the request object for compatibility
      request.body = body;
      (request as any).files = filesMap;

      // Extract single file if only one file was expected for a field
      if (fields.length === 1 && fields[0]!.maxCount === 1) {
        const fieldName = fields[0]!.name;
        if (filesMap[fieldName] && filesMap[fieldName][0]) {
          (request as any).file = filesMap[fieldName][0];
        }
      }
    } catch (err: unknown) {
      logger.error('[FastifyUpload] Middleware error:', err);
      const statusCode = err instanceof AppError ? err.statusCode : 400;
      const errorMessage = err instanceof Error && err.message ? err.message : '文件上传与验证失败';
      return reply.status(statusCode).send({
        status: 'error',
        success: false,
        error: errorMessage,
        message: errorMessage,
      });
    }
  };
};
