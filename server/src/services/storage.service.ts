import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, ListObjectsV2CommandOutput, DeleteObjectsCommand, GetObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';

const ENCRYPTED_VALUE_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

function decryptSecretIfNeeded(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!ENCRYPTED_VALUE_RE.test(raw)) return raw;
  try {
    return decrypt(raw);
  } catch (err) {
    logger.error('[StorageService] Failed to decrypt secretAccessKey:', err);
    return raw;
  }
}

export interface StorageConfigData {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export class StorageService {
  private clients = new Map<string, S3Client>();

  /**
   * Instantiates a new S3Client dynamically based on the configuration and caches it.
   */
  private getS3Client(config: StorageConfigData): S3Client {
    const decryptedSecret = decryptSecretIfNeeded(config.secretAccessKey);
    const cacheKey = `${config.endpoint}-${config.accessKeyId}-${decryptedSecret}`;
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
   * Uploads a local file to the configured S3/R2 bucket.
   * Returns the public access URL of the uploaded file.
   */
  public async uploadFile(
    config: StorageConfigData,
    localFilePath: string,
    key: string,
    mimetype: string,
    retries = 5,
    delay = 1000,
  ): Promise<string> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        const client = this.getS3Client(config);
        const stats = await fs.promises.stat(localFilePath);
        const fileStream = fs.createReadStream(localFilePath);

        const command = new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: fileStream,
          ContentLength: stats.size,
          ContentType: mimetype,
        });

        await client.send(command);

        let baseUrl = config.publicUrl.endsWith('/')
          ? config.publicUrl.slice(0, -1)
          : config.publicUrl;
        if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
          baseUrl = `https://${baseUrl}`;
        }

        // Ensure key doesn't start with leading slash to avoid double slash
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;

        return `${baseUrl}/${cleanKey}`;
      } catch (error) {
        attempt++;
        if (attempt >= retries) {
          logger.error(`[StorageService] Upload failed for key ${key} after ${retries} attempts:`, error);
          throw error;
        }
        const backoff = delay * Math.pow(2, attempt) + Math.random() * 500;
        logger.warn(
          `[StorageService] Upload failed for key ${key} (attempt ${attempt}/${retries}). Retrying in ${Math.round(
            backoff,
          )}ms... Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    // All paths above either return (success) or throw (max retries reached).
    // This line is unreachable but keeps TypeScript happy.
    throw new Error('[StorageService] Unexpected: uploadFile reached end without returning or throwing');
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
              ExposeHeaders: ['ETag', 'Content-Length', 'Accept-Ranges'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      });
      await client.send(command);
      logger.info(`[StorageService] CORS rules configured successfully for bucket: ${config.bucketName}`);
    } catch (error) {
      logger.error(`[StorageService] Failed to configure CORS rules for bucket ${config.bucketName}:`, error);
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
            `Error: ${corsError instanceof Error ? corsError.message : String(corsError)}`
        );
      }

      return true;
    } catch (error) {
      logger.error('[StorageService] Test connection failed:', error);
      throw error;
    }
  }

  /**
   * Lists up to 1000 objects in the R2 bucket.
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
   * Calculates the total actual size of all objects in the R2 bucket.
   */
  public async getActualBucketSize(config: StorageConfigData): Promise<number> {
    const client = this.getS3Client(config);
    let totalSize = 0;
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
            totalSize += obj.Size || 0;
          }
        }
        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }
      return totalSize;
    } catch (error) {
      logger.error(`[StorageService] Failed to calculate actual bucket size for ${config.bucketName}:`, error);
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
      logger.error(`[StorageService] Failed to list all objects with prefix ${prefix} for ${config.bucketName}:`, error);
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
  public async uploadJsonString(config: StorageConfigData, key: string, jsonContent: string): Promise<string> {
    try {
      const client = this.getS3Client(config);
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: jsonContent,
        ContentType: 'application/json',
      });
      await client.send(command);
      let baseUrl = config.publicUrl.endsWith('/') ? config.publicUrl.slice(0, -1) : config.publicUrl;
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
