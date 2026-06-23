export interface StorageConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  cloudflareApiToken?: string;
  hasSecretAccessKey?: boolean;
  hasCloudflareApiToken?: boolean;
  remark?: string;
  bucketName: string;
  publicUrl: string;
  limitGb: number;
  usedBytes: number;
  assetType: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  isMasked?: boolean;
}

export interface ExplorerItem {
  type: 'file' | 'folder';
  name: string;
  key: string;
  size?: number;
  lastModified?: string;
  url?: string;
}

export interface RawExplorerItem {
  type?: string;
  name?: string;
  key?: string;
  size?: number;
  lastModified?: string;
  url?: string;
}

export interface AdminSetting {
  key: string;
  value: unknown;
}

export interface StorageConfigForm {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  cloudflareApiToken: string;
  remark: string;
  bucketName: string;
  publicUrl: string;
  limitGb: number;
  usedBytes: number;
  assetType: string;
  priority: number;
  status: string;
}

export interface AssetTypeOption {
  label: string;
  value: string;
}
