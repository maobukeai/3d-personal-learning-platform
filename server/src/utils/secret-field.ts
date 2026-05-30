import { logger } from './logger';
import crypto from 'crypto';

const PREFIX = 'enc:v1:';

const getPrimarySecret = (): string | null => {
  return process.env.DATABASE_ENCRYPTION_KEY || process.env.EMAIL_ACCOUNT_ENCRYPTION_KEY || null;
};

const getSecretKey = (secret: string | null): Buffer | null => {
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

export const isEncryptedSecret = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX);

export const encryptSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  const secret = getPrimarySecret();

  if (!secret) {
    throw new Error(
      'Missing encryption key configuration. Please set DATABASE_ENCRYPTION_KEY in your .env file to use a dedicated database encryption key.',
    );
  }

  const key = getSecretKey(secret);
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

  const primarySecret = getPrimarySecret();
  const legacySecret = process.env.JWT_SECRET || process.env.SECRET_KEY || null;

  if (!primarySecret && !legacySecret) {
    throw new Error(
      'Encrypted secret cannot be read without DATABASE_ENCRYPTION_KEY or JWT_SECRET configuration.',
    );
  }

  const [ivRaw, tagRaw, encryptedRaw] = value.slice(PREFIX.length).split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted secret format');
  }

  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const encrypted = Buffer.from(encryptedRaw, 'base64url');

  // Try decrypting with primary key first
  if (primarySecret) {
    try {
      const key = getSecretKey(primarySecret)!;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (_err) {
      // If decryption fails and there is no legacy key, throw error
      if (!legacySecret) {
        throw new Error('Decryption failed: Invalid encryption key.');
      }
    }
  }

  // Fallback to legacy key
  if (legacySecret) {
    try {
      const key = getSecretKey(legacySecret)!;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const result = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      logger.warn(
        '[SecurityWarning] Decrypted credentials using legacy JWT_SECRET fallback. Please re-save settings to use the dedicated database encryption key.',
      );
      return result;
    } catch (_err) {
      throw new Error('Decryption failed: Invalid primary and legacy encryption keys.');
    }
  }

  throw new Error('Decryption failed.');
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
