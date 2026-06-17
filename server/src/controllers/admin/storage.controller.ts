import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../../middlewares/auth.middleware';
import prisma from '../../services/prisma';
import { storageService, decryptSecretIfNeeded } from '../../services/storage.service';
import { logger } from '../../utils/logger';
import { auditService, AuditModule } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';
import { encrypt } from '../../utils/crypto';
import { resolveCloudflareApiToken } from '../../utils/cloudflare-r2';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the decrypted secretAccessKey for internal use (storageService calls).
 * Safely handles both legacy plaintext and new encrypted values.
 */
function getDecryptedSecret(raw: string | null | undefined): string {
  return decryptSecretIfNeeded(raw);
}

/**
 * Builds a full StorageConfigData object with decrypted credentials,
 * ready to be passed to storageService.
 */
function toDecryptedConfig(raw: Record<string, any>) {
  return {
    endpoint: raw.endpoint,
    accessKeyId: raw.accessKeyId ?? '',
    secretAccessKey: getDecryptedSecret(raw.secretAccessKey),
    bucketName: raw.bucketName,
    publicUrl: raw.publicUrl,
    cloudflareAccountId: raw.cloudflareAccountId ?? null,
    cloudflareApiToken: getDecryptedSecret(raw.cloudflareApiToken),
  };
}

/**
 * Returns a safe API response payload — decrypts secrets for admin display.
 */
function prepareConfigResponse(config: Record<string, any>) {
  return {
    ...config,
    secretAccessKey: getDecryptedSecret(config.secretAccessKey),
    cloudflareApiToken: getDecryptedSecret(config.cloudflareApiToken),
  };
}

async function getSharedCloudflareApiTokens(): Promise<string[]> {
  const configs = await prisma.storageConfig.findMany({
    select: { cloudflareApiToken: true },
  });

  return configs
    .map((config) => getDecryptedSecret(config.cloudflareApiToken))
    .filter((token) => !!token);
}

function buildUsageResponse(usage: Awaited<ReturnType<typeof storageService.getBucketUsage>>) {
  return {
    actualSize: usage.dashboardBytes,
    dashboardBytes: usage.dashboardBytes,
    totalBytes: usage.totalBytes,
    payloadBytes: usage.payloadBytes,
    metadataBytes: usage.metadataBytes,
    objectCount: usage.objectCount,
    uploadCount: usage.uploadCount,
    source: usage.source,
    warning: usage.warning,
    resolvedBucketName: usage.resolvedBucketName,
    displayUnit: 'decimal' as const,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const getConfigs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.storageConfig.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(configs.map(prepareConfigResponse));
  } catch (error) {
    next(error);
  }
};

export const createConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      provider,
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
      cloudflareApiToken,
      remark,
      limitGb,
      usedBytes,
      assetType,
      priority,
      status,
    } = req.body;

    if (
      !name ||
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucketName ||
      !publicUrl ||
      !assetType
    ) {
      return next(new AppError('缺少必要参数', 400));
    }

    const config = await prisma.storageConfig.create({
      data: {
        name,
        provider: provider || 'CLOUDFLARE_R2',
        endpoint,
        accessKeyId,
        secretAccessKey: encrypt(secretAccessKey), // 加密存储
        bucketName,
        publicUrl,
        cloudflareApiToken: cloudflareApiToken ? encrypt(cloudflareApiToken) : null,
        remark: remark || null,
        limitGb: parseFloat(limitGb) || 9.8,
        usedBytes: parseFloat(usedBytes) || 0,
        assetType,
        priority: parseInt(priority) || 0,
        status: status || 'ACTIVE',
      },
    });

    if (config.status === 'ACTIVE') {
      try {
        await storageService.configureCors(toDecryptedConfig(config));
      } catch (corsErr) {
        logger.warn(
          `[StorageController] Auto CORS configuration failed on creation for bucket ${config.bucketName}:`,
          corsErr,
        );
      }
    }

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'CREATE_STORAGE_CONFIG',
      description: `Created storage config: ${config.name} (${config.assetType})`,
      newValue: { id: config.id, name: config.name, assetType: config.assetType },
    });

    res.status(201).json(prepareConfigResponse(config));
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const {
      name,
      provider,
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
      cloudflareApiToken,
      remark,
      limitGb,
      usedBytes,
      assetType,
      priority,
      status,
    } = req.body;

    const existing = await prisma.storageConfig.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('配置未找到', 404));
    }

    const updateData: Record<string, any> = {
      name: name !== undefined ? name : existing.name,
      provider: provider !== undefined ? provider : existing.provider,
      endpoint: endpoint !== undefined ? endpoint : existing.endpoint,
      accessKeyId: accessKeyId !== undefined ? accessKeyId : existing.accessKeyId,
      bucketName: bucketName !== undefined ? bucketName : existing.bucketName,
      publicUrl: publicUrl !== undefined ? publicUrl : existing.publicUrl,
      remark: remark !== undefined ? remark : existing.remark,
      limitGb: limitGb !== undefined ? parseFloat(limitGb) : existing.limitGb,
      usedBytes: usedBytes !== undefined ? parseFloat(usedBytes) : existing.usedBytes,
      assetType: assetType !== undefined ? assetType : existing.assetType,
      priority: priority !== undefined ? parseInt(priority) : existing.priority,
      status: status !== undefined ? status : existing.status,
    };

    // Only re-encrypt if the user explicitly provided a new secretAccessKey
    if (secretAccessKey !== undefined) {
      updateData.secretAccessKey = encrypt(secretAccessKey);
    }
    if (cloudflareApiToken !== undefined) {
      updateData.cloudflareApiToken = cloudflareApiToken ? encrypt(cloudflareApiToken) : null;
    }

    const config = await prisma.storageConfig.update({
      where: { id },
      data: updateData,
    });

    if (config.status === 'ACTIVE') {
      try {
        await storageService.configureCors(toDecryptedConfig(config));
      } catch (corsErr) {
        logger.warn(
          `[StorageController] Auto CORS configuration failed on update for bucket ${config.bucketName}:`,
          corsErr,
        );
      }
    }

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'UPDATE_STORAGE_CONFIG',
      description: `Updated storage config: ${config.name} (${config.assetType})`,
      newValue: { id: config.id, name: config.name, assetType: config.assetType },
    });

    res.json(prepareConfigResponse(config));
  } catch (error) {
    next(error);
  }
};

export const deleteConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.storageConfig.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('配置未找到', 404));
    }

    await prisma.storageConfig.delete({ where: { id } });

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'DELETE_STORAGE_CONFIG',
      description: `Deleted storage config: ${existing.name}`,
      oldValue: { id, name: existing.name },
    });

    res.json({ message: '配置已成功删除' });
  } catch (error) {
    next(error);
  }
};

export const testConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl } = req.body;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return next(new AppError('缺少必要参数', 400));
    }

    // secretAccessKey from request body is always plaintext — no decryption needed
    const success = await storageService.testConnection({
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
    });

    res.json({ success });
  } catch (error: any) {
    logger.error('[StorageController] Test connection failed:', error);
    res.status(400).json({
      success: false,
      error: error.message || '连接测试失败，请检查配置参数',
    });
  }
};

export const listBucketFiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const continuationToken =
      typeof req.query.continuationToken === 'string' ? req.query.continuationToken : undefined;

    let baseUrl = raw.publicUrl.endsWith('/') ? raw.publicUrl.slice(0, -1) : raw.publicUrl;
    if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
      baseUrl = `https://${baseUrl}`;
    }
    const cleanKey = (key: string) => (key.startsWith('/') ? key.slice(1) : key);
    const toPublicUrl = (key: string) => `${baseUrl}/${cleanKey(key)}`;

    if (search) {
      const objects = await storageService.searchBucketObjects(config, search, prefix);
      res.json({
        prefix,
        search,
        truncated: objects.length >= 300,
        items: objects.map((obj) => ({
          type: 'file' as const,
          key: obj.key,
          name: obj.key,
          size: obj.size,
          lastModified: obj.lastModified,
          url: toPublicUrl(obj.key),
        })),
      });
      return;
    }

    const { folders, files, truncated, nextContinuationToken } =
      await storageService.listFolderContents(config, prefix, { continuationToken });
    res.json({
      prefix,
      search: null,
      truncated,
      nextContinuationToken,
      items: [
        ...folders.map((folder) => ({
          type: 'folder' as const,
          key: folder.key,
          name: folder.name,
        })),
        ...files.map((file) => ({
          type: 'file' as const,
          key: file.key,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          url: toPublicUrl(file.key),
        })),
      ],
    });
  } catch (error) {
    next(error);
  }
};

export const renameBucketFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { oldKey, newKey } = req.body as { oldKey?: string; newKey?: string };

    if (!oldKey?.trim() || !newKey?.trim()) {
      return next(new AppError('缺少 oldKey 或 newKey 参数', 400));
    }
    if (oldKey.trim() === newKey.trim()) {
      return next(new AppError('新文件名不能与旧文件名相同', 400));
    }
    if (newKey.includes('//') || newKey.startsWith('/')) {
      return next(new AppError('新 Key 格式不合法', 400));
    }

    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);
    await storageService.renameFile(config, oldKey.trim(), newKey.trim());

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'RENAME_STORAGE_FILE',
      description: `Renamed file ${oldKey} to ${newKey} in storage ${raw.name}`,
      oldValue: { id, oldKey },
      newValue: { id, newKey },
    });

    res.json({ success: true, key: newKey.trim() });
  } catch (error) {
    next(error);
  }
};

export const deleteBucketFilesBulk = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const keys = req.body?.keys;

    if (!Array.isArray(keys) || keys.length === 0) {
      return next(new AppError('缺少 keys 参数', 400));
    }

    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);
    const validKeys = keys.filter((key: unknown) => typeof key === 'string' && key.trim());

    if (validKeys.length === 0) {
      return next(new AppError('没有有效的文件 Key', 400));
    }

    // Estimate deleted bytes from metadata (best-effort, non-blocking)
    let totalDeletedBytes = 0;
    for (const key of validKeys) {
      try {
        const meta = await storageService.getObjectMetadata(config, key);
        totalDeletedBytes += meta.ContentLength || 0;
      } catch (err) {
        logger.error(
          `[StorageController] Failed to fetch object metadata before delete for key ${key}:`,
          err,
        );
      }
    }

    // Use batch delete for efficiency
    await storageService.deleteFilesBulk(config, validKeys);

    if (totalDeletedBytes > 0) {
      await prisma.storageConfig.update({
        where: { id },
        data: {
          usedBytes: {
            decrement: totalDeletedBytes,
          },
        },
      });
    }

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'DELETE_STORAGE_FILES_BULK',
      description: `Bulk deleted ${validKeys.length} files from storage ${raw.name}`,
      oldValue: { id, keys: validKeys, totalBytes: totalDeletedBytes },
    });

    res.json({ success: true, deleted: validKeys.length, totalBytes: totalDeletedBytes });
  } catch (error) {
    next(error);
  }
};

export const deleteBucketFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { key } = req.body;

    if (!key) return next(new AppError('缺少 Key 参数', 400));

    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);

    // Get object size first to decrement usedBytes atomically
    let objectSize = 0;
    try {
      const meta = await storageService.getObjectMetadata(config, key);
      objectSize = meta.ContentLength || 0;
    } catch (err) {
      logger.error(
        `[StorageController] Failed to fetch object metadata before delete for key ${key}:`,
        err,
      );
    }

    // Delete from S3/R2
    await storageService.deleteFile(config, key);

    // Decrement usedBytes atomically
    if (objectSize > 0) {
      await prisma.storageConfig.update({
        where: { id },
        data: {
          usedBytes: {
            decrement: objectSize,
          },
        },
      });
    }

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'DELETE_STORAGE_FILE',
      description: `Deleted file ${key} from storage ${raw.name}`,
      oldValue: { id, key, size: objectSize },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const uploadDirectFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const file = req.file;

    if (!file) return next(new AppError('请选择要上传的文件', 400));

    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return next(new AppError('配置未找到', 404));
    }

    const config = toDecryptedConfig(raw);

    // Check capacity limit
    const limitBytes = raw.limitGb * 1024 * 1024 * 1024;
    const updateResult = await prisma.storageConfig.updateMany({
      where: {
        id: raw.id,
        status: 'ACTIVE',
        usedBytes: { lte: limitBytes - file.size },
      },
      data: {
        usedBytes: { increment: file.size },
      },
    });

    if (updateResult.count === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return next(new AppError('云端存储容量已满，无法上传', 400));
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginalName = file.originalname
      .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
      .replace(/\s+/g, '_');
    const extName = path.extname(sanitizedOriginalName);
    const baseName = path.basename(sanitizedOriginalName, extName) || 'file';
    const prefixRaw =
      typeof req.body?.prefix === 'string' ? req.body.prefix.trim().replace(/^\//, '') : '';
    const normalizedPrefix = prefixRaw && !prefixRaw.endsWith('/') ? `${prefixRaw}/` : prefixRaw;
    const key = normalizedPrefix
      ? `${normalizedPrefix}${sanitizedOriginalName}`
      : `manual/${baseName}-${uniqueSuffix}/${sanitizedOriginalName}`;

    const r2Url = await storageService.uploadFile(config, file.path, key, file.mimetype);

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'UPLOAD_STORAGE_FILE',
      description: `Uploaded file ${key} to storage ${raw.name}`,
      newValue: { id, key, size: file.size, url: r2Url },
    });

    res.json({ success: true, url: r2Url, key });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
};

export const getActualSize = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);
    const sharedApiTokens = await getSharedCloudflareApiTokens();
    const usage = await storageService.getBucketUsage(config, { sharedApiTokens });
    res.json(buildUsageResponse(usage));
  } catch (error) {
    next(error);
  }
};

export const syncActualSize = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const raw = await prisma.storageConfig.findUnique({ where: { id } });
    if (!raw) return next(new AppError('配置未找到', 404));

    const config = toDecryptedConfig(raw);
    const sharedApiTokens = await getSharedCloudflareApiTokens();
    const usage = await storageService.getBucketUsage(config, { sharedApiTokens });

    const updated = await prisma.storageConfig.update({
      where: { id },
      data: { usedBytes: usage.dashboardBytes },
    });

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'SYNC_STORAGE_SIZE',
      description: `Synchronized storage config ${raw.name} capacity to Cloudflare dashboard payload size: ${usage.dashboardBytes} bytes (${usage.source})`,
      newValue: { id, usedBytes: usage.dashboardBytes, source: usage.source },
    });

    res.json({
      ...prepareConfigResponse(updated),
      usage,
    });
  } catch (error) {
    next(error);
  }
};

export const syncAllActualSizes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.storageConfig.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    const sharedApiTokens = await getSharedCloudflareApiTokens();

    const results: Array<{
      id: string;
      name: string;
      bucketName: string;
      status: 'synced' | 'skipped' | 'failed';
      reason?: string;
      dashboardBytes?: number;
      source?: string;
    }> = [];

    for (const raw of configs) {
      const config = toDecryptedConfig(raw);
      const apiToken = resolveCloudflareApiToken(config.cloudflareApiToken, sharedApiTokens);

      if (!apiToken) {
        results.push({
          id: raw.id,
          name: raw.name,
          bucketName: raw.bucketName,
          status: 'skipped',
          reason: '未配置 Cloudflare API Token',
        });
        continue;
      }

      try {
        const usage = await storageService.getOfficialBucketUsageOnly(config, { sharedApiTokens });
        if (!usage) {
          results.push({
            id: raw.id,
            name: raw.name,
            bucketName: raw.bucketName,
            status: 'skipped',
            reason: 'Cloudflare 官方 API 不可用（Token 无权限或 Account ID 不匹配）',
          });
          continue;
        }

        await prisma.storageConfig.update({
          where: { id: raw.id },
          data: { usedBytes: usage.dashboardBytes },
        });

        results.push({
          id: raw.id,
          name: raw.name,
          bucketName: raw.bucketName,
          status: 'synced',
          dashboardBytes: usage.dashboardBytes,
          source: usage.source,
        });
      } catch (error) {
        results.push({
          id: raw.id,
          name: raw.name,
          bucketName: raw.bucketName,
          status: 'failed',
          reason: error instanceof Error ? error.message : '同步失败',
        });
      }
    }

    const synced = results.filter((item) => item.status === 'synced').length;
    const skipped = results.filter((item) => item.status === 'skipped').length;
    const failed = results.filter((item) => item.status === 'failed').length;

    await auditService.log({
      req,
      userId: req.userId!,
      module: AuditModule.SETTINGS,
      action: 'SYNC_ALL_STORAGE_SIZE',
      description: `Bulk synced R2 storage usage via Cloudflare API: synced=${synced}, skipped=${skipped}, failed=${failed}`,
      newValue: { synced, skipped, failed },
    });

    res.json({
      success: true,
      synced,
      skipped,
      failed,
      total: results.length,
      results,
    });
  } catch (error) {
    next(error);
  }
};

export const exportConfigs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.storageConfig.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const exported = configs.map((config) => {
      return {
        name: config.name,
        provider: config.provider,
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: getDecryptedSecret(config.secretAccessKey),
        bucketName: config.bucketName,
        publicUrl: config.publicUrl,
        cloudflareApiToken: getDecryptedSecret(config.cloudflareApiToken),
        remark: config.remark,
        limitGb: config.limitGb,
        usedBytes: config.usedBytes,
        assetType: config.assetType,
        priority: config.priority,
        status: config.status,
      };
    });

    res.setHeader('Content-Disposition', 'attachment; filename=storage_configs_export.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(exported);
  } catch (error) {
    next(error);
  }
};

export const importConfigs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) {
      return next(new AppError('无效的配置数据格式', 400));
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const raw of configs) {
      const {
        name,
        provider = 'CLOUDFLARE_R2',
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl,
        cloudflareApiToken,
        remark,
        limitGb = 9.8,
        usedBytes = 0,
        assetType,
        priority = 0,
        status = 'ACTIVE',
      } = raw;

      if (
        !name ||
        !endpoint ||
        !accessKeyId ||
        !secretAccessKey ||
        !bucketName ||
        !publicUrl ||
        !assetType
      ) {
        continue;
      }

      const existing = await prisma.storageConfig.findFirst({
        where: {
          OR: [
            { name },
            {
              endpoint,
              bucketName,
              assetType,
            },
          ],
        },
      });

      const encryptedSecret = encrypt(secretAccessKey);

      if (existing) {
        await prisma.storageConfig.update({
          where: { id: existing.id },
          data: {
            provider,
            endpoint,
            accessKeyId,
            secretAccessKey: encryptedSecret,
            bucketName,
            publicUrl,
            cloudflareApiToken: cloudflareApiToken ? encrypt(cloudflareApiToken) : null,
            remark: remark || null,
            limitGb,
            usedBytes,
            assetType,
            priority,
            status,
          },
        });
        updatedCount++;
      } else {
        await prisma.storageConfig.create({
          data: {
            name,
            provider,
            endpoint,
            accessKeyId,
            secretAccessKey: encryptedSecret,
            bucketName,
            publicUrl,
            cloudflareApiToken: cloudflareApiToken ? encrypt(cloudflareApiToken) : null,
            remark: remark || null,
            limitGb,
            usedBytes,
            assetType,
            priority,
            status,
          },
        });
        importedCount++;
      }
    }

    res.json({
      success: true,
      message: `导入配置完成：新增 ${importedCount} 个，更新 ${updatedCount} 个。`,
    });
  } catch (error) {
    next(error);
  }
};
