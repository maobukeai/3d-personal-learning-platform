import api from '@/utils/api';

export interface TrustedDevice {
  id: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCurrent?: boolean;
}

export interface RecoveryCodeSummary {
  count: number;
}

export interface AccountDataExport {
  exportDate: string;
  profile: unknown;
  userSettings: Record<string, string>;
  notificationPreferences: unknown;
  teams: unknown[];
  assets: unknown[];
  projects: unknown[];
  notes: unknown[];
  discussions: unknown[];
  showcases: unknown[];
  counts: Record<string, number>;
  exportedCounts?: Record<string, number>;
  exportLimits?: {
    perCollection: number;
  };
  truncated?: Record<string, boolean>;
}

export interface DeleteAccountPayload {
  password?: string;
  twoFactorCode?: string;
}

export interface UserSettingPayload {
  key: string;
  value: string;
}

export const fetchRecoveryCodes = async (): Promise<RecoveryCodeSummary> => {
  const { data } = await api.get('/api/auth/2fa/recovery-codes');
  return { count: data.count ?? 0 };
};

export const regenerateRecoveryCodes = async (payload: {
  password?: string;
  code?: string;
}): Promise<string[]> => {
  const { data } = await api.post('/api/auth/2fa/recovery-codes/regenerate', payload);
  return data.recoveryCodes as string[];
};

export const sendEmailChangeCode = (newEmail: string) =>
  api.post('/api/auth/email/send-code-new', { newEmail });

export const changeEmail = (newEmail: string, code: string) =>
  api.put('/api/auth/email/change', { newEmail, code });

export const fetchTrustedDevices = async (currentToken?: string): Promise<TrustedDevice[]> => {
  const { data } = await api.get('/api/auth/trusted-devices', {
    params: currentToken ? { currentToken } : undefined,
  });
  return data;
};

export const revokeTrustedDevice = (deviceId: string) =>
  api.delete(`/api/auth/trusted-devices/${deviceId}`);

export const deleteAccount = (payload: DeleteAccountPayload) =>
  api.delete('/api/auth/account', { data: payload });

export const fetchUserSettings = async (): Promise<Record<string, string>> => {
  const { data } = await api.get('/api/auth/user-settings');
  return data || {};
};

export const updateUserSettings = async (settings: UserSettingPayload[]) => {
  const { data } = await api.post('/api/auth/user-settings', { settings });
  return data;
};

export const exportAccountData = async (): Promise<AccountDataExport> => {
  const { data } = await api.get('/api/auth/account/export');
  return data;
};
