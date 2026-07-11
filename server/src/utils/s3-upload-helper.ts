import prisma from '../services/prisma';
import { buildDecryptedStorageConfig } from './crypto';
import { gbToBytes } from './quota';

/**
 * Retrieves the active storage configuration for the given storage type.
 * Falls back to 'ALL' if no specific config is active.
 */
export const getActiveStorageConfig = async (storageType: string) => {
  let configs = await prisma.storageConfig.findMany({
    where: {
      status: 'ACTIVE',
      assetType: storageType,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  if (configs.length === 0 && storageType !== 'ALL') {
    configs = await prisma.storageConfig.findMany({
      where: {
        status: 'ACTIVE',
        assetType: 'ALL',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  const config = configs[0] || null;
  if (config) {
    config.usedBytes = Math.max(0, config.usedBytes);
  }
  return config;
};

/**
 * Resolves and decrypts the active storage configuration.
 */
export const getDecryptedActiveStorageConfig = async (storageType: string) => {
  const raw = await getActiveStorageConfig(storageType);
  if (!raw) return null;
  return {
    raw,
    config: buildDecryptedStorageConfig(raw),
  };
};

/**
 * Maps frontend upload fieldname to backend asset type configuration.
 */
export const getStorageTypeForField = (fieldname?: string): string => {
  if (!fieldname) return 'ALL';
  if (fieldname === 'temporary_file') {
    return 'TEMPORARY_NETDISK';
  }
  if (fieldname === 'asset' || fieldname === 'thumbnail') {
    return 'ASSET';
  }
  if (fieldname === 'material' || fieldname === 'preview') {
    return 'MATERIAL';
  }
  if (fieldname === 'plugin_file' || fieldname === 'plugin_preview' || fieldname === 'plugin') {
    return 'PLUGIN';
  }
  if (
    fieldname === 'software_file' ||
    fieldname === 'software_preview' ||
    fieldname === 'software'
  ) {
    return 'SOFTWARE';
  }
  return 'ALL';
};

/**
 * Generates a sanitized and unique S3 object key.
 */
export const generateS3Key = (filename: string, folderPrefix: string): string => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const sanitized = filename
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
    .replace(/\s+/g, '_');
  return `${folderPrefix}/${uniqueSuffix}/${sanitized}`;
};

/** Minimal shape of a storage config needed for quota validation. */
export interface StorageQuotaConfig {
  limitGb: number;
  usedBytes: number;
}

/**
 * Validates if the file size fits within the cloud storage configuration limit.
 */
export const checkQuota = async (
  rawConfig: StorageQuotaConfig,
  size?: number,
): Promise<boolean> => {
  if (!size) return true;
  const limitBytes = gbToBytes(rawConfig.limitGb);
  return rawConfig.usedBytes + size <= limitBytes;
};

/**
 * Atomically increments the used storage bytes.
 */
export const incrementConfigUsedBytes = async (configId: string, size: number) => {
  await prisma.storageConfig.update({
    where: { id: configId },
    data: { usedBytes: { increment: size } },
  });
};
