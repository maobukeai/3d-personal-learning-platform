import {
  ListObjectsV2Command,
  HeadObjectCommand,
  ListObjectsV2CommandOutput,
  GetObjectCommand,
  PutBucketCorsCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';
import { getR2ObjectCacheControl, resolveR2ContentType } from '../../utils/r2-cache-control';
import { getS3Client } from './s3-client';
import type { StorageConfigData } from './types';

export async function getObjectMetadata(config: StorageConfigData, key: string) {
  try {
    const client = getS3Client(config);
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });
    return await client.send(command);
  } catch (error) {
    logger.error(`[StorageService] Fetch metadata failed for key ${key}:`, error);
    throw error;
  }
}

export async function applyCacheControlMetadata(
  config: StorageConfigData,
  key: string,
  contentType?: string,
): Promise<void> {
  const client = getS3Client(config);
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
  const resolvedContentType = resolveR2ContentType(key, contentType || head.ContentType);
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      CopySource: `${config.bucketName}/${encodedKey}`,
      MetadataDirective: 'REPLACE',
      CacheControl: getR2ObjectCacheControl(key, resolvedContentType),
      ContentType: resolvedContentType,
      ContentDisposition: head.ContentDisposition,
      ContentEncoding: head.ContentEncoding,
      ContentLanguage: head.ContentLanguage,
      Metadata: head.Metadata,
    }),
  );
}

export async function configureCors(config: StorageConfigData): Promise<void> {
  const client = getS3Client(config);
  try {
    const command = new PutBucketCorsCommand({
      Bucket: config.bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'Accept-Ranges', 'Content-Range'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });
    await client.send(command);
    logger.info(
      `[StorageService] CORS rules configured successfully for bucket: ${config.bucketName}`,
    );
  } catch (error) {
    logger.error(
      `[StorageService] Failed to configure CORS rules for bucket ${config.bucketName}:`,
      error,
    );
    throw error;
  }
}

export async function testConnection(config: StorageConfigData): Promise<boolean> {
  const testKey = `test-connection-${Date.now()}.txt`;
  const client = getS3Client(config);

  try {
    const putCommand = new (await import('@aws-sdk/client-s3')).PutObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
      Body: 'Cloudflare R2 connection test success.',
      ContentType: 'text/plain',
    });
    await client.send(putCommand);

    const deleteCommand = new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
    });
    await client.send(deleteCommand);

    try {
      await configureCors(config);
    } catch (corsError) {
      logger.warn(
        `[StorageService] Unable to automatically configure CORS during connection test: ${corsError instanceof Error ? corsError.message : String(corsError)}`,
      );
    }

    return true;
  } catch (error) {
    logger.error('[StorageService] Test connection failed:', error);
    throw error;
  }
}

export async function listFolderContents(
  config: StorageConfigData,
  prefix = '',
  options?: { continuationToken?: string; maxKeys?: number },
): Promise<{
  folders: Array<{ key: string; name: string }>;
  files: Array<{ key: string; name: string; size: number; lastModified?: Date }>;
  truncated: boolean;
  nextContinuationToken?: string;
}> {
  const client = getS3Client(config);
  const normalizedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
  const folders: Array<{ key: string; name: string }> = [];
  const files: Array<{ key: string; name: string; size: number; lastModified?: Date }> = [];

  const response = (await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: normalizedPrefix,
      Delimiter: '/',
      ContinuationToken: options?.continuationToken,
      MaxKeys: options?.maxKeys ?? 1000,
    }),
  )) as ListObjectsV2CommandOutput;

  for (const commonPrefix of response.CommonPrefixes || []) {
    if (!commonPrefix.Prefix) continue;
    const name = commonPrefix.Prefix.slice(normalizedPrefix.length).replace(/\/$/, '');
    if (name) folders.push({ key: commonPrefix.Prefix, name });
  }

  for (const obj of response.Contents || []) {
    if (!obj.Key || obj.Key === normalizedPrefix) continue;
    const name = obj.Key.slice(normalizedPrefix.length);
    if (!name || name.includes('/')) continue;
    files.push({
      key: obj.Key,
      name,
      size: obj.Size || 0,
      lastModified: obj.LastModified,
    });
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    folders,
    files,
    truncated: response.IsTruncated || false,
    nextContinuationToken: response.NextContinuationToken,
  };
}

export async function searchBucketObjects(
  config: StorageConfigData,
  query: string,
  prefix = '',
  maxResults = 300,
): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
  const client = getS3Client(config);
  const normalizedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
  const needle = query.trim().toLowerCase();
  const results: Array<{ key: string; size: number; lastModified?: Date }> = [];
  let isTruncated = true;
  let continuationToken: string | undefined;

  const maxScanPages = 5;
  let scannedPages = 0;

  while (isTruncated && results.length < maxResults && scannedPages < maxScanPages) {
    const response = (await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: normalizedPrefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    )) as ListObjectsV2CommandOutput;

    for (const obj of response.Contents || []) {
      if (!obj.Key || !obj.Key.toLowerCase().includes(needle)) continue;
      results.push({
        key: obj.Key,
        size: obj.Size || 0,
        lastModified: obj.LastModified,
      });
      if (results.length >= maxResults) break;
    }

    isTruncated = response.IsTruncated || false;
    continuationToken = response.NextContinuationToken;
    scannedPages += 1;
  }

  return results;
}

export async function renameFile(
  config: StorageConfigData,
  oldKey: string,
  newKey: string,
): Promise<void> {
  if (oldKey === newKey) return;
  const client = getS3Client(config);
  const encodedSource = `${config.bucketName}/${oldKey.split('/').map(encodeURIComponent).join('/')}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucketName,
      CopySource: encodedSource,
      Key: newKey,
    }),
  );

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: oldKey,
    }),
  );
}

export async function listAllObjects(
  config: StorageConfigData,
): Promise<{ Key: string; Size: number }[]> {
  const client = getS3Client(config);
  const allObjects: { Key: string; Size: number }[] = [];
  let isTruncated = true;
  let continuationToken: string | undefined = undefined;

  try {
    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
      });
      const response = (await client.send(command)) as ListObjectsV2CommandOutput;
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            allObjects.push({
              Key: obj.Key,
              Size: obj.Size || 0,
            });
          }
        }
      }
      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }
    return allObjects;
  } catch (error) {
    logger.error(`[StorageService] Failed to list all objects for ${config.bucketName}:`, error);
    throw error;
  }
}

export async function listAllObjectsWithPrefix(
  config: StorageConfigData,
  prefix: string,
): Promise<{ Key: string; Size: number }[]> {
  const client = getS3Client(config);
  const allObjects: { Key: string; Size: number }[] = [];
  let isTruncated = true;
  let continuationToken: string | undefined = undefined;

  try {
    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const response = (await client.send(command)) as ListObjectsV2CommandOutput;
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            allObjects.push({
              Key: obj.Key,
              Size: obj.Size || 0,
            });
          }
        }
      }
      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }
    return allObjects;
  } catch (error) {
    logger.error(
      `[StorageService] Failed to list all objects with prefix ${prefix} for ${config.bucketName}:`,
      error,
    );
    throw error;
  }
}

export async function getObjectString(config: StorageConfigData, key: string): Promise<string> {
  try {
    const client = getS3Client(config);
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });
    const response = await client.send(command);
    const bodyString = await response.Body?.transformToString();
    return bodyString || '';
  } catch (error) {
    logger.error(`[StorageService] Failed to get object string for key ${key}:`, error);
    throw error;
  }
}

export async function listCommonPrefixes(
  config: StorageConfigData,
  prefix: string,
  delimiter: string = '/',
): Promise<string[]> {
  try {
    const client = getS3Client(config);
    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: prefix,
      Delimiter: delimiter,
    });
    const response = await client.send(command);
    return (response.CommonPrefixes || []).map((cp) => cp.Prefix || '').filter(Boolean);
  } catch (error) {
    logger.error(`[StorageService] List common prefixes failed for prefix ${prefix}:`, error);
    throw error;
  }
}
