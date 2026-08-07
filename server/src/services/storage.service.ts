import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { logger } from '../utils/logger';
import { decryptSecretIfNeeded, ENCRYPTED_VALUE_RE } from '../utils/crypto';
import { getR2ObjectCacheControl, resolveR2ContentType } from '../utils/r2-cache-control';
import {
  getS3Client,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  getPresignedViewUrl,
  uploadBuffer,
} from './storage/s3-client';
import {
  getObjectMetadata,
  applyCacheControlMetadata,
  configureCors,
  testConnection,
  listFolderContents,
  searchBucketObjects,
  renameFile,
  listAllObjects,
  listAllObjectsWithPrefix,
  getObjectString,
  listCommonPrefixes,
} from './storage/file-operations';
import {
  getOfficialBucketUsageOnly,
  getBucketUsage,
  getActualBucketSize,
} from './storage/bucket-usage';
import type { StorageConfigData, BucketUsageResult } from './storage/types';

export { decryptSecretIfNeeded, ENCRYPTED_VALUE_RE, StorageConfigData, BucketUsageResult };

export class StorageService {
  public getS3Client = getS3Client;
  public getPresignedUploadUrl = getPresignedUploadUrl;
  public getPresignedDownloadUrl = getPresignedDownloadUrl;
  public getPresignedViewUrl = getPresignedViewUrl;
  public uploadBuffer = uploadBuffer;

  public getObjectMetadata = getObjectMetadata;
  public applyCacheControlMetadata = applyCacheControlMetadata;
  public configureCors = configureCors;
  public testConnection = testConnection;
  public listFolderContents = listFolderContents;
  public searchBucketObjects = searchBucketObjects;
  public renameFile = renameFile;
  public listAllObjects = listAllObjects;
  public listAllObjectsWithPrefix = listAllObjectsWithPrefix;
  public getObjectString = getObjectString;
  public listCommonPrefixes = listCommonPrefixes;

  public getOfficialBucketUsageOnly = getOfficialBucketUsageOnly;
  public getBucketUsage = getBucketUsage;
  public getActualBucketSize = getActualBucketSize;

  public async initiateMultipartUpload(
    config: StorageConfigData,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const client = getS3Client(config);
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

  public async getPresignedUploadPartUrl(
    config: StorageConfigData,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600,
  ): Promise<string> {
    const client = getS3Client(config);
    const command = new UploadPartCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  public async completeMultipartUpload(
    config: StorageConfigData,
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
  ): Promise<string> {
    const client = getS3Client(config);
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

  public async abortMultipartUpload(
    config: StorageConfigData,
    key: string,
    uploadId: string,
  ): Promise<void> {
    const client = getS3Client(config);
    const command = new AbortMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      UploadId: uploadId,
    });
    await client.send(command);
  }

  public async deleteFile(config: StorageConfigData, key: string): Promise<void> {
    try {
      const client = getS3Client(config);
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

  public async deleteFilesBulk(config: StorageConfigData, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      const client = getS3Client(config);
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
        const output = await client.send(command);
        if (output.Errors && output.Errors.length > 0) {
          logger.warn(
            `[StorageService] ${output.Errors.length} objects failed to delete in bulk operation`,
            { errors: output.Errors, bucket: config.bucketName },
          );
        }
      }
      logger.info(`[StorageService] Bulk deleted ${keys.length} files from bucket`);
    } catch (error) {
      logger.error(`[StorageService] Bulk delete failed for keys:`, error);
      throw error;
    }
  }

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
    const client = getS3Client(config);
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

  public async uploadJsonString(
    config: StorageConfigData,
    key: string,
    jsonContent: string,
  ): Promise<string> {
    try {
      const client = getS3Client(config);
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
}

export const storageService = new StorageService();
