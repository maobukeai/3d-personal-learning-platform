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
