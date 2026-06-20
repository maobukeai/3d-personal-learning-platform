import api from '@/utils/api';

export interface BackupConfig {
  url: string;
  username: string;
  dir: string;
  retentionDays: number;
  hasPassword?: boolean;
}

export interface RemoteBackupFile {
  name: string;
  size: number;
  lastModified: string;
}

export interface BackupListResponse {
  backups: RemoteBackupFile[];
  lastBackup: string | null;
  lastRestore: string | null;
}

export const fetchBackupConfig = async (): Promise<BackupConfig> => {
  const { data } = await api.get('/api/backup/config');
  return data;
};

export const saveBackupConfig = async (
  payload: Partial<BackupConfig> & { password?: string },
): Promise<any> => {
  const { data } = await api.post('/api/backup/config', payload);
  return data;
};

export const testBackupConfig = async (
  payload: Partial<BackupConfig> & { password?: string },
): Promise<any> => {
  const { data } = await api.post('/api/backup/test', payload);
  return data;
};

export const runBackup = async (categories: string[]): Promise<any> => {
  const { data } = await api.post('/api/backup/run', { categories });
  return data;
};

export const fetchBackupsList = async (): Promise<BackupListResponse> => {
  const { data } = await api.get('/api/backup/list');
  return data;
};

export const restoreBackup = async (
  filename: string,
  restoreCategories: string[],
): Promise<any> => {
  const { data } = await api.post('/api/backup/restore', { filename, restoreCategories });
  return data;
};

export const deleteBackup = async (filename: string): Promise<any> => {
  const { data } = await api.delete(`/api/backup/${filename}`);
  return data;
};
