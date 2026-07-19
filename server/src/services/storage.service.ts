import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  ListObjectsV2CommandOutput,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import type { Readable } from 'stream';
import { logger } from '../utils/logger';
import { decryptSecretIfNeeded, ENCRYPTED_VALUE_RE } from '../utils/crypto';
import {
  calculateTotalUsageBytes,
  fetchOfficialBucketUsage,
  getDashboardPayloadBytes,
  resolveCloudflareAccountId,
  resolveCloudflareApiToken,
} from '../utils/cloudflare-r2';
import { getR2ObjectCacheControl, resolveR2ContentType } from '../utils/r2-cache-control';

// Re-export for backward compatibility — consumers should import from utils/crypto directly.
export { decryptSecretIfNeeded, ENCRYPTED_VALUE_RE };

export interface StorageConfigData {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  cloudflareAccountId?: string | null;
  cloudflareApiToken?: string | null;
}

export interface BucketUsageResult {
  totalBytes: number;
  dashboardBytes: number;
  payloadBytes: number;
  metadataBytes: number;
  objectCount: number;
  uploadCount: number;
  source: 'cloudflare-graphql' | 'cloudflare-usage-api' | 'list-objects';
  warning?: string;
  resolvedBucketName?: string;
  scannedBytes?: number | null;
  scannedObjectCount?: number | null;
}

export class StorageService {
  private clients = new Map<string, S3Client>();

  /**
   * Instantiates a new S3Client dynamically based on the configuration and caches it.
   */
  private getS3Client(config: StorageConfigData): S3Client {
    const decryptedSecret = decryptSecretIfNeeded(config.secretAccessKey);
    // Use a SHA-256 hash as the cache key to avoid storing the plaintext
    // secretAccessKey in the Map (safe against memory dumps / heap snapshots).
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${config.endpoint}:${config.accessKeyId}:${decryptedSecret}`)
      .digest('hex');
    let client = this.clients.get(cacheKey);
    if (!client) {
      client = new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: decryptedSecret,
        },
      });
      this.clients.set(cacheKey, client);
    }
    return client;
  }

  /**
   * Generates a simple presigned upload URL for a key.
   */
  public async getPresignedUploadUrl(
    config: StorageConfigData,
    key: string,
    mimetype: string,
    expiresIn = 3600,
  ): Promise<string> {
    const client = this.getS3Client(config);
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: mimetype,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Initiates a multipart upload and returns the UploadId.
   */
  public async initiateMultipartUpload(
    config: StorageConfigData,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const client = this.getS3Client(config);
    const resolvedContentType = resolveR2ContentType(key, mimetype);
    const command = new CreateMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: resolvedContentType,
      CacheControl: getR2ObjectCacheControl(key, resolvedContentType),
    });
    const res = await client.send(command);
    return res.UploadId!;
  }

  /**
   * Generates a presigned upload URL for a specific part in a multipart upload.
   */
  public async getPresignedUploadPartUrl(
    config: StorageConfigData,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600,
  ): Promise<string> {
    const client = this.getS3Client(config);
    const command = new UploadPartCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Generates a presigned download GET URL for a key with custom response header overrides.
   */
  public async getPresignedDownloadUrl(
    config: StorageConfigData,
    key: string,
    filename: string,
    expiresIn = 3600,
  ): Promise<string> {
    const client = this.getS3Client(config);
    const safeName = encodeURIComponent(filename);
    const enforcedExpiresIn = Math.min(expiresIn, 900);
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    });
    return getSignedUrl(client, command, { expiresIn: enforcedExpiresIn });
  }

  /**
   * Generates a presigned view GET URL for a key (inline display, e.g. for image or 3D model).
   */
  public async getPresignedViewUrl(
    config: StorageConfigData,
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const client = this.getS3Client(config);
    const enforcedExpiresIn = Math.min(expiresIn, 900);
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ResponseCacheControl: 'private, max-age=3600',
    });
    return getSignedUrl(client, command, { expiresIn: enforcedExpiresIn });
  }

  /**
   * Retrieves an object as a stream from the bucket.
   */
  public async getObjectStream(
    config: StorageConfigData,
    key: string,
    range?: string,
  ): Promise<{
    stream: Readable;
    contentLength?: number;
    contentType?: string;
    contentRange?: string;
    eTag?: string;
    status: number;
  }> {
    const client = this.getS3Client(config);
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Range: range,
    });
    const response = await client.send(command);
    return {
      stream: response.Body as Readable,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      contentRange: response.ContentRange,
      eTag: response.ETag,
      status: range ? 206 : 200,
    };
  }

  /**
   * Rewrites an object's HTTP cache metadata without downloading it through the app server.
   * R2 performs the copy inside the bucket, so large models never traverse the Hong Kong host.
   */
  public async applyCacheControlMetadata(
    config: StorageConfigData,
    key: string,
    contentType?: string,
  ): Promise<void> {
    const client = this.getS3Client(config);
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

  /**
   * Completes a multipart upload on R2.
   */
  public async completeMultipartUpload(
    config: StorageConfigData,
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
  ): Promise<string> {
    const client = this.getS3Client(config);
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });
    await client.send(command);
    const publicUrlBase = config.publicUrl.replace(/\/$/, '');
    return `${publicUrlBase}/${key}`;
  }

  /**
   * Aborts an active multipart upload.
   */
  public async abortMultipartUpload(
    config: StorageConfigData,
    key: string,
    uploadId: string,
  ): Promise<void> {
    const client = this.getS3Client(config);
    const command = new AbortMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
    });
    await client.send(command);
  }

  /**
   * Deletes a file from the S3/R2 bucket.
   */
  public async deleteFile(config: StorageConfigData, key: string): Promise<void> {
    try {
      const client = this.getS3Client(config);
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      await client.send(command);
      logger.info(`[StorageService] File deleted from bucket: ${key}`);
    } catch (error) {
      logger.error(`[StorageService] Delete failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Tests the connection to an S3/R2 bucket by attempting to write and delete a small test file.
   */
  /**
   * Dynamically configures CORS rules on the R2 bucket to prevent browser CORS blocks.
   */
  public async configureCors(config: StorageConfigData): Promise<void> {
    const client = this.getS3Client(config);
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

  /**
   * Tests the connection to an S3/R2 bucket by attempting to write and delete a small test file,
   * and configures CORS.
   */
  public async testConnection(config: StorageConfigData): Promise<boolean> {
    const testKey = `test-connection-${Date.now()}.txt`;
    const client = this.getS3Client(config);

    try {
      // 1. Try to upload a small test file
      const putCommand = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: testKey,
        Body: 'Cloudflare R2 connection test success.',
        ContentType: 'text/plain',
      });
      await client.send(putCommand);

      // 2. Clean up test file
      const deleteCommand = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: testKey,
      });
      await client.send(deleteCommand);

      // 3. Automatically configure CORS rules
      try {
        await this.configureCors(config);
      } catch (corsError) {
        logger.warn(
          `[StorageService] Unable to automatically configure CORS during connection test. ` +
            `This is common if the API token permissions are read/write only. ` +
            `Error: ${corsError instanceof Error ? corsError.message : String(corsError)}`,
        );
      }

      return true;
    } catch (error) {
      logger.error('[StorageService] Test connection failed:', error);
      throw error;
    }
  }

  /**
   * Lists one page of folders and files for a directory level (fast; use continuation for more).
   */
  public async listFolderContents(
    config: StorageConfigData,
    prefix = '',
    options?: { continuationToken?: string; maxKeys?: number },
  ): Promise<{
    folders: Array<{ key: string; name: string }>;
    files: Array<{ key: string; name: string; size: number; lastModified?: Date }>;
    truncated: boolean;
    nextContinuationToken?: string;
  }> {
    const client = this.getS3Client(config);
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

  /**
   * Renames an object by copy + delete (S3/R2 has no native rename).
   */
  public async renameFile(
    config: StorageConfigData,
    oldKey: string,
    newKey: string,
  ): Promise<void> {
    if (oldKey === newKey) return;
    const client = this.getS3Client(config);
    const encodedSource = `${config.bucketName}/${oldKey.split('/').map(encodeURIComponent).join('/')}`;

    await client.send(
      new CopyObjectCommand({
        Bucket: config.bucketName,
        CopySource: encodedSource,
        Key: newKey,
      }),
    );

    await this.deleteFile(config, oldKey);
  }

  /**
   * Searches object keys in a bucket (capped for responsiveness).
   */
  public async searchBucketObjects(
    config: StorageConfigData,
    query: string,
    prefix = '',
    maxResults = 300,
  ): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
    const client = this.getS3Client(config);
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

  /**
   * Lists up to 1000 objects in the R2 bucket (legacy flat list).
   */
  public async listFiles(config: StorageConfigData, prefix?: string) {
    try {
      const client = this.getS3Client(config);
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
      });
      const response = await client.send(command);
      return response.Contents || [];
    } catch (error) {
      logger.error(`[StorageService] List files failed for bucket ${config.bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves an object's head metadata (like ContentLength/size).
   */
  public async getObjectMetadata(config: StorageConfigData, key: string) {
    try {
      const client = this.getS3Client(config);
      const command = new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      const response = await client.send(command);
      return response;
    } catch (error) {
      logger.error(`[StorageService] Fetch metadata failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Returns bucket usage aligned with the Cloudflare dashboard when an API token is available.
   * Falls back to parallel S3 list scanning when the native Usage API is not configured.
   */
  public async getOfficialBucketUsageOnly(
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

  public async getBucketUsage(
    config: StorageConfigData,
    options?: {
      sharedApiTokens?: Array<string | null | undefined>;
      scan?: boolean;
    },
  ): Promise<BucketUsageResult> {
    const apiToken = resolveCloudflareApiToken(config.cloudflareApiToken, options?.sharedApiTokens);
    const accountId = resolveCloudflareAccountId(config.endpoint, config.cloudflareAccountId);

    let listed: { bytes: number; count: number } | null = null;

    // We only perform the real-time S3 listing scan if:
    // 1. We don't have official Cloudflare API credentials (since S3 listing is our only option).
    // 2. Or, if the scan flag is explicitly requested (e.g. options?.scan === true).
    const hasOfficialCredentials = apiToken && accountId;
    if (!hasOfficialCredentials || options?.scan) {
      try {
        listed = await this.sumObjectsByParallelPrefixes(config);
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

    // Fallback to S3 scan if official API query failed or is not configured
    if (!listed) {
      try {
        listed = await this.sumObjectsByParallelPrefixes(config);
      } catch (listError) {
        logger.warn(
          `[StorageService] S3 list objects fallback failed for bucket ${config.bucketName}:`,
          listError,
        );
      }
    }

    const warning = !apiToken
      ? '未配置可用的 Cloudflare API Token，当前结果为对象扫描值，通常低于官网 Metrics 中的 Bucket size。请为该账号配置 API Token。'
      : !accountId
        ? '无法从 Endpoint 解析 Cloudflare Account ID，当前结果为对象扫描值。请填写 Account ID 或检查 Endpoint。'
        : 'Cloudflare 官方 API 查询失败，当前结果为对象扫描值，可能与官网不一致。请检查 API Token 权限是否覆盖该账号。';

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

  /**
   * Calculates the total actual size of all objects in the R2 bucket.
   */
  public async getActualBucketSize(
    config: StorageConfigData,
    options?: { sharedApiTokens?: Array<string | null | undefined> },
  ): Promise<number> {
    const usage = await this.getBucketUsage(config, options);
    return usage.dashboardBytes;
  }

  private async sumObjectsForPrefix(
    config: StorageConfigData,
    prefix: string,
  ): Promise<{ bytes: number; count: number }> {
    const client = this.getS3Client(config);
    let totalBytes = 0;
    let objectCount = 0;
    let isTruncated = true;
    let continuationToken: string | undefined;

    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const response = (await client.send(command)) as ListObjectsV2CommandOutput;

      for (const obj of response.Contents || []) {
        totalBytes += obj.Size || 0;
        objectCount += 1;
      }

      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }

    return { bytes: totalBytes, count: objectCount };
  }

  private async sumObjectsByParallelPrefixes(
    config: StorageConfigData,
  ): Promise<{ bytes: number; count: number }> {
    const client = this.getS3Client(config);
    const folderPrefixes: string[] = [];
    let rootBytes = 0;
    let rootCount = 0;
    let isTruncated = true;
    let continuationToken: string | undefined;

    try {
      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: config.bucketName,
          Delimiter: '/',
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });
        const response = (await client.send(command)) as ListObjectsV2CommandOutput;

        for (const commonPrefix of response.CommonPrefixes || []) {
          if (commonPrefix.Prefix) folderPrefixes.push(commonPrefix.Prefix);
        }

        for (const obj of response.Contents || []) {
          rootBytes += obj.Size || 0;
          rootCount += 1;
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      if (folderPrefixes.length === 0) {
        return this.sumObjectsForPrefix(config, '');
      }

      const folderTotals = await Promise.all(
        folderPrefixes.map((prefix) => this.sumObjectsForPrefix(config, prefix)),
      );

      const folderBytes = folderTotals.reduce((sum, item) => sum + item.bytes, 0);
      const folderCount = folderTotals.reduce((sum, item) => sum + item.count, 0);

      return {
        bytes: rootBytes + folderBytes,
        count: rootCount + folderCount,
      };
    } catch (error) {
      logger.error(
        `[StorageService] Failed to calculate actual bucket size for ${config.bucketName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Lists all objects in the R2 bucket (paginated recursively to fetch all items).
   */
  public async listAllObjects(config: StorageConfigData): Promise<{ Key: string; Size: number }[]> {
    const client = this.getS3Client(config);
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

  /**
   * Lists all objects in the R2 bucket matching a specific prefix (paginated recursively).
   */
  public async listAllObjectsWithPrefix(
    config: StorageConfigData,
    prefix: string,
  ): Promise<{ Key: string; Size: number }[]> {
    const client = this.getS3Client(config);
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

  /**
   * Deletes multiple files from the S3/R2 bucket in bulk (up to 1000 keys per request chunk).
   */
  public async deleteFilesBulk(config: StorageConfigData, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      const client = this.getS3Client(config);
      const chunkSize = 1000;
      for (let i = 0; i < keys.length; i += chunkSize) {
        const batchKeys = keys.slice(i, i + chunkSize);
        const command = new DeleteObjectsCommand({
          Bucket: config.bucketName,
          Delete: {
            Objects: batchKeys.map((key) => ({ Key: key })),
            Quiet: true,
          },
        });
        await client.send(command);
      }
      logger.info(`[StorageService] Bulk deleted ${keys.length} files from bucket`);
    } catch (error) {
      logger.error(`[StorageService] Bulk delete failed for keys:`, error);
      throw error;
    }
  }

  /**
   * Retrieves an object from the bucket and returns it as a string.
   */
  public async getObjectString(config: StorageConfigData, key: string): Promise<string> {
    try {
      const client = this.getS3Client(config);
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

  /**
   * Uploads a string directly to the bucket.
   */
  public async uploadJsonString(
    config: StorageConfigData,
    key: string,
    jsonContent: string,
  ): Promise<string> {
    try {
      const client = this.getS3Client(config);
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: jsonContent,
        ContentType: 'application/json',
        CacheControl: getR2ObjectCacheControl(key, 'application/json'),
      });
      await client.send(command);
      let baseUrl = config.publicUrl.endsWith('/')
        ? config.publicUrl.slice(0, -1)
        : config.publicUrl;
      if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
        baseUrl = `https://${baseUrl}`;
      }
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      return `${baseUrl}/${cleanKey}`;
    } catch (error) {
      logger.error(`[StorageService] Upload JSON string failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Uploads a Buffer directly to the bucket.
   */
  public async uploadBuffer(
    config: StorageConfigData,
    buffer: Buffer,
    key: string,
    mimetype: string,
  ): Promise<string> {
    try {
      const client = this.getS3Client(config);
      const resolvedContentType = resolveR2ContentType(key, mimetype);
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: resolvedContentType,
        CacheControl: getR2ObjectCacheControl(key, resolvedContentType),
      });
      await client.send(command);
      let baseUrl = config.publicUrl.endsWith('/')
        ? config.publicUrl.slice(0, -1)
        : config.publicUrl;
      if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
        baseUrl = `https://${baseUrl}`;
      }
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      return `${baseUrl}/${cleanKey}`;
    } catch (error) {
      logger.error(`[StorageService] Upload buffer failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Lists common prefixes (subdirectories) under a specified prefix with a delimiter.
   */
  public async listCommonPrefixes(
    config: StorageConfigData,
    prefix: string,
    delimiter: string = '/',
  ): Promise<string[]> {
    try {
      const client = this.getS3Client(config);
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
}

export const storageService = new StorageService();
