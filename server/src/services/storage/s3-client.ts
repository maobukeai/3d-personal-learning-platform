import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { decryptSecretIfNeeded } from '../../utils/crypto';
import { getR2ObjectCacheControl, resolveR2ContentType } from '../../utils/r2-cache-control';
import type { StorageConfigData } from './types';

const clientsMap = new Map<string, S3Client>();

export function getS3Client(config: StorageConfigData): S3Client {
  const decryptedSecret = decryptSecretIfNeeded(config.secretAccessKey);
  const cacheKey = crypto
    .createHash('sha256')
    .update(`${config.endpoint}:${config.accessKeyId}:${decryptedSecret}`)
    .digest('hex');
  let client = clientsMap.get(cacheKey);
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: decryptedSecret,
      },
    });
    clientsMap.set(cacheKey, client);
  }
  return client;
}

export async function getPresignedUploadUrl(
  config: StorageConfigData,
  key: string,
  mimetype: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: mimetype,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  config: StorageConfigData,
  key: string,
  filename: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client(config);
  const safeName = encodeURIComponent(filename);
  const enforcedExpiresIn = Math.min(expiresIn, 900);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
  });
  return getSignedUrl(client, command, { expiresIn: enforcedExpiresIn });
}

export async function getPresignedViewUrl(
  config: StorageConfigData,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client(config);
  const enforcedExpiresIn = Math.min(expiresIn, 900);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ResponseCacheControl: 'private, max-age=3600',
  });
  return getSignedUrl(client, command, { expiresIn: enforcedExpiresIn });
}

export async function uploadBuffer(
  config: StorageConfigData,
  buffer: Buffer,
  key: string,
  mimetype: string,
): Promise<string> {
  const client = getS3Client(config);
  const resolvedContentType = resolveR2ContentType(key, mimetype);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: buffer,
    ContentType: resolvedContentType,
    CacheControl: getR2ObjectCacheControl(key, resolvedContentType),
  });
  await client.send(command);
  let baseUrl = config.publicUrl.endsWith('/') ? config.publicUrl.slice(0, -1) : config.publicUrl;
  if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
    baseUrl = `https://${baseUrl}`;
  }
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  return `${baseUrl}/${cleanKey}`;
}
