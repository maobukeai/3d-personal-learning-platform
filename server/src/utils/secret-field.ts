import crypto from 'crypto';

const PREFIX = 'enc:v1:';

const getSecretKey = (): Buffer | null => {
  const secret =
    process.env.EMAIL_ACCOUNT_ENCRYPTION_KEY || process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

export const isEncryptedSecret = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX);

export const encryptSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  const key = getSecretKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
};

export const decryptSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;

  const key = getSecretKey();
  if (!key) {
    throw new Error('Encrypted secret cannot be read without EMAIL_ACCOUNT_ENCRYPTION_KEY');
  }

  const [ivRaw, tagRaw, encryptedRaw] = value.slice(PREFIX.length).split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted secret format');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const maskProxyUrl = (value: string | null | undefined): string | null => {
  const proxyUrl = decryptSecret(value);
  if (!proxyUrl) return null;

  try {
    const url = new URL(proxyUrl);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '***';
  }
};
