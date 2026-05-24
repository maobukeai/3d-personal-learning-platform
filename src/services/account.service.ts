import api from '@/utils/api';

export const fetchRecoveryCodes = async () => {
  const { data } = await api.get('/api/auth/2fa/recovery-codes');
  return data.recoveryCodes as string[];
};

export const regenerateRecoveryCodes = async () => {
  const { data } = await api.post('/api/auth/2fa/recovery-codes/regenerate');
  return data.recoveryCodes as string[];
};

export const sendEmailChangeCode = (newEmail: string) =>
  api.post('/api/auth/email/send-code-new', { newEmail });

export const changeEmail = (newEmail: string, code: string) =>
  api.put('/api/auth/email/change', { newEmail, code });

export const fetchTrustedDevices = async () => {
  const { data } = await api.get('/api/auth/trusted-devices');
  return data;
};

export const revokeTrustedDevice = (deviceId: string) =>
  api.delete(`/api/auth/trusted-devices/${deviceId}`);

export const deleteAccount = (twoFactorCode?: string) =>
  api.delete('/api/auth/account', {
    data: twoFactorCode ? { twoFactorCode } : {},
  });

export const exportAccountData = async () => {
  const [profileRes, teamsRes] = await Promise.all([
    api.get('/api/auth/me'),
    api.get('/api/teams'),
  ]);

  return {
    exportDate: new Date().toISOString(),
    profile: profileRes.data,
    teams: teamsRes.data,
  };
};
