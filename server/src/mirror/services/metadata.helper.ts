import prisma from '../../services/prisma';
import { storageService } from '../../services/storage.service';
import { logger } from '../../utils/logger';

/** Matches the encrypted format produced by `encrypt()` */
const ENCRYPTED_VALUE_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

/** Safely decrypts secretAccessKey, handling legacy plaintext values. */
function decryptSecret(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!ENCRYPTED_VALUE_RE.test(raw)) return raw;
  try {
    // Lazy-import to avoid circular dependency — crypto.ts doesn't import anything from mirror/
    const { decrypt } = require('../../utils/crypto');
    return decrypt(raw);
  } catch {
    return raw;
  }
}

/**
 * Converts a raw Prisma StorageConfig (with potentially encrypted secretAccessKey)
 * to a StorageConfigData object with decrypted credentials.
 */
function toDecryptedConfig(raw: Record<string, any>) {
  return {
    endpoint: raw.endpoint,
    accessKeyId: raw.accessKeyId ?? '',
    secretAccessKey: decryptSecret(raw.secretAccessKey),
    bucketName: raw.bucketName,
    publicUrl: raw.publicUrl,
  };
}

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
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (configs.length === 0 && storageType !== 'ALL') {
    configs = await prisma.storageConfig.findMany({
      where: {
        status: 'ACTIVE',
        assetType: 'ALL',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  return configs[0] || null;
};

/**
 * Queries database records for a mirror source, compiles its structure,
 * and uploads the resulting metadata.json to Cloudflare R2 bucket.
 */
export const uploadSourceMetadataToR2 = async (sourceId: string): Promise<void> => {
  try {
    const activeConfig = await getActiveStorageConfig('MIRROR');
    if (!activeConfig) {
      logger.info(`[MetadataHelper] No active cloud storage configuration for MIRROR, skipping metadata upload.`);
      return;
    }

    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      logger.error(`[MetadataHelper] Mirror source ${sourceId} not found for metadata upload.`);
      return;
    }

    const categories = await prisma.mirrorCategory.findMany({
      where: { sourceId },
    });
    const resources = await prisma.mirrorResource.findMany({
      where: { sourceId },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.externalId]));

    const metadata = {
      version: '1.0',
      source: {
        id: source.id,
        name: source.name,
        displayName: source.displayName,
        baseUrl: source.baseUrl,
        adapterType: source.adapterType,
        status: source.status,
        syncStatus: 'IDLE',
        syncInterval: source.syncInterval,
        syncConfig: source.syncConfig,
        minPlanPriority: source.minPlanPriority,
        iconUrl: source.iconUrl,
        description: source.description,
      },
      categories: categories.map((c) => ({
        externalId: c.externalId,
        name: c.name,
        slug: c.slug,
        parentExternalId: c.parentExternalId,
        order: c.order,
        resourceCount: c.resourceCount,
      })),
      resources: resources.map((r) => ({
        externalId: r.externalId,
        categoryExternalId: r.categoryId ? categoryMap.get(r.categoryId) : null,
        title: r.title,
        description: r.description,
        thumbnailUrl: r.thumbnailUrl,
        contentUrl: r.contentUrl,
        tags: r.tags,
        externalData: r.externalData,
        contentHtml: r.contentHtml,
        resourceType: r.resourceType,
        viewCount: r.viewCount,
        publishedAt:
          r.publishedAt && !isNaN(r.publishedAt.getTime()) ? r.publishedAt.toISOString() : null,
        contentHash: r.contentHash,
      })),
    };

    const key = `mirror/${sourceId}/metadata.json`;
    await storageService.uploadJsonString(
      toDecryptedConfig(activeConfig),
      key,
      JSON.stringify(metadata, null, 2),
    );
    logger.info(`[MetadataHelper] Uploaded metadata.json for source ${sourceId} to R2 successfully.`);
  } catch (error) {
    logger.error(`[MetadataHelper] Failed to upload metadata.json for source ${sourceId} to R2:`, error);
  }
};
