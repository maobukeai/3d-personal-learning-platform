import { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';
import {
  calculateTotalUsageBytes,
  fetchOfficialBucketUsage,
  getDashboardPayloadBytes,
  resolveCloudflareAccountId,
  resolveCloudflareApiToken,
} from '../../utils/cloudflare-r2';
import { getS3Client } from './s3-client';
import type { StorageConfigData, BucketUsageResult } from './types';

export async function getOfficialBucketUsageOnly(
  config: StorageConfigData,
  options?: { sharedApiTokens?: Array<string | null | undefined> },
): Promise<BucketUsageResult | null> {
  const apiToken = resolveCloudflareApiToken(config.cloudflareApiToken, options?.sharedApiTokens);
  const accountId = resolveCloudflareAccountId(config.endpoint, config.cloudflareAccountId);

  if (!apiToken || !accountId) {
    return null;
  }

  try {
    const official = await fetchOfficialBucketUsage(accountId, config.bucketName, apiToken);
    const usage = official.usage;
    const payloadBytes = getDashboardPayloadBytes(usage);
    const metadataBytes = usage.metadataBytes + usage.infrequentAccessMetadataBytes;
    return {
      totalBytes: calculateTotalUsageBytes(usage),
      dashboardBytes: payloadBytes,
      payloadBytes,
      metadataBytes,
      objectCount: usage.objectCount,
      uploadCount: usage.uploadCount,
      source: official.source,
      resolvedBucketName: official.resolvedBucketName,
    };
  } catch (error) {
    logger.warn(
      `[StorageService] Official Cloudflare usage lookup failed for bucket ${config.bucketName} (account ${accountId}):`,
      error,
    );
    return null;
  }
}

export async function sumObjectsByParallelPrefixes(
  config: StorageConfigData,
): Promise<{ bytes: number; count: number }> {
  const client = getS3Client(config);
  let rootBytes = 0;
  let rootCount = 0;
  let isTruncated = true;
  let continuationToken: string | undefined;

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const response = (await client.send(command)) as ListObjectsV2CommandOutput;

    for (const obj of response.Contents || []) {
      rootBytes += obj.Size || 0;
      rootCount += 1;
    }

    isTruncated = response.IsTruncated || false;
    continuationToken = response.NextContinuationToken;
  }

  return { bytes: rootBytes, count: rootCount };
}

export async function getBucketUsage(
  config: StorageConfigData,
  options?: {
    sharedApiTokens?: Array<string | null | undefined>;
    scan?: boolean;
  },
): Promise<BucketUsageResult> {
  const apiToken = resolveCloudflareApiToken(config.cloudflareApiToken, options?.sharedApiTokens);
  const accountId = resolveCloudflareAccountId(config.endpoint, config.cloudflareAccountId);

  let listed: { bytes: number; count: number } | null = null;
  const hasOfficialCredentials = apiToken && accountId;

  if (!hasOfficialCredentials || options?.scan) {
    try {
      listed = await sumObjectsByParallelPrefixes(config);
    } catch (listError) {
      logger.warn(
        `[StorageService] S3 list objects failed for bucket ${config.bucketName}:`,
        listError,
      );
    }
  }

  if (hasOfficialCredentials) {
    try {
      const official = await fetchOfficialBucketUsage(accountId, config.bucketName, apiToken);
      const usage = official.usage;
      const payloadBytes = getDashboardPayloadBytes(usage);
      const metadataBytes = usage.metadataBytes + usage.infrequentAccessMetadataBytes;
      return {
        totalBytes: calculateTotalUsageBytes(usage),
        dashboardBytes: payloadBytes,
        payloadBytes,
        metadataBytes,
        objectCount: usage.objectCount,
        uploadCount: usage.uploadCount,
        source: official.source,
        resolvedBucketName: official.resolvedBucketName,
        scannedBytes: listed ? listed.bytes : null,
        scannedObjectCount: listed ? listed.count : null,
      };
    } catch (error) {
      logger.warn(
        `[StorageService] Cloudflare official usage lookup failed for bucket ${config.bucketName} (account ${accountId}):`,
        error,
      );
    }
  }

  if (!listed) {
    try {
      listed = await sumObjectsByParallelPrefixes(config);
    } catch (listError) {
      logger.warn(
        `[StorageService] S3 list objects fallback failed for bucket ${config.bucketName}:`,
        listError,
      );
    }
  }

  const warning = !apiToken
    ? '未配置可用的 Cloudflare API Token'
    : !accountId
      ? '无法从 Endpoint 解析 Cloudflare Account ID'
      : 'Cloudflare 官方 API 查询失败';

  return {
    totalBytes: listed?.bytes ?? 0,
    dashboardBytes: listed?.bytes ?? 0,
    payloadBytes: listed?.bytes ?? 0,
    metadataBytes: 0,
    objectCount: listed?.count ?? 0,
    uploadCount: 0,
    source: 'list-objects',
    warning,
    scannedBytes: listed?.bytes ?? 0,
    scannedObjectCount: listed?.count ?? 0,
  };
}

export async function getActualBucketSize(
  config: StorageConfigData,
  options?: { sharedApiTokens?: Array<string | null | undefined> },
): Promise<number> {
  const usage = await getBucketUsage(config, options);
  return usage.dashboardBytes;
}
