/**
 * Crypto helper functions for string encryption/decryption
 *
 * Two separate encryption schemes:
 * 1. encryptText / decryptText  — two-argument (text + key), used for mirror source credentials
 * 2. encrypt / decrypt           — zero-key (key from STORAGE_ENCRYPTION_KEY env), used for SecretAccessKey
 */
import crypto from 'crypto';
import { logger } from './logger';
import { config } from '../config/env';

// ─── Scheme 1: encryptText / decryptText (two-argument, used by mirror sources) ─

function rc4(key: string, str: string): string {
  const s: number[] = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    const si = s[i] as number;
    j = (j + si + key.charCodeAt(i % key.length)) % 256;
    const temp = s[i] as number;
    s[i] = s[j] as number;
    s[j] = temp;
  }
  let i = 0;
  j = 0;
  let res = '';
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    const si = s[i] as number;
    j = (j + si) % 256;
    const temp = s[i] as number;
    s[i] = s[j] as number;
    s[j] = temp;
    const val = s[((s[i] as number) + (s[j] as number)) % 256] as number;
    res += String.fromCharCode(str.charCodeAt(y) ^ val);
  }
  return res;
}

export function encryptText(text: string, key: string): string {
  const encrypted = rc4(key, text);
  let hex = '';
  for (let i = 0; i < encrypted.length; i++) {
    hex += encrypted.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export function decryptText(hex: string, key: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return rc4(key, str);
}

// ─── Scheme 2: encrypt / decrypt (env-key, used for SecretAccessKey) ────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.STORAGE_ENCRYPTION_KEY;
  if (keyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error('STORAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    return Buffer.from(keyHex, 'hex');
  }

  // STORAGE_ENCRYPTION_KEY is missing. In production, this is a fatal misconfiguration.
  // In development, allow deriving from DATABASE_ENCRYPTION_KEY (which must be set).
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: STORAGE_ENCRYPTION_KEY environment variable must be set in production ' +
        '(64-character hex string, 32 bytes).',
    );
    process.exit(1);
  }

  const dbKey = process.env.DATABASE_ENCRYPTION_KEY;
  if (!dbKey) {
    throw new Error(
      'STORAGE_ENCRYPTION_KEY (or DATABASE_ENCRYPTION_KEY as dev fallback) is not set. ' +
        'Provide a 64-character hex STORAGE_ENCRYPTION_KEY, or set DATABASE_ENCRYPTION_KEY for dev.',
    );
  }
  return crypto.createHash('sha256').update(dbKey).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM with the key from STORAGE_ENCRYPTION_KEY env var.
 * Returns format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts a string produced by `encrypt()`.
 * Throws if the ciphertext is tampered with or the key is wrong.
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0]!, 'hex');
  const authTag = Buffer.from(parts[1]!, 'hex');
  const ciphertext = parts[2]!;

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`,
    );
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    throw new Error('Decryption failed: ciphertext has been tampered with or key is incorrect');
  }

  return decrypted;
}

// ─── Storage secret helpers (unified) ─────────────────────────────────────────

/** Matches the encrypted format produced by `encrypt()`: iv(24hex):tag(32hex):ciphertext */
export const ENCRYPTED_VALUE_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

/**
 * Safely decrypts a secret value, handling legacy plaintext values.
 * Returns the original value if it doesn't match the encrypted format or decryption fails.
 */
export function decryptSecretIfNeeded(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!ENCRYPTED_VALUE_RE.test(raw)) return raw;
  try {
    return decrypt(raw);
  } catch (err) {
    logger.error('[Crypto] Failed to decrypt secret:', err);
    return '';
  }
}

/**
 * Minimal shape of a Prisma StorageConfig record needed to build a decrypted config.
 * Both required and optional (Cloudflare) fields are covered.
 */
interface StorageConfigRecord {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  cloudflareAccountId?: string | null;
  cloudflareApiToken?: string | null;
}

/**
 * Converts a raw Prisma StorageConfig record (with potentially encrypted credentials)
 * into a plain config object with decrypted secretAccessKey / cloudflareApiToken.
 * Cloudflare fields are included when present on the source record.
 */
export function buildDecryptedStorageConfig(raw: StorageConfigRecord) {
  return {
    endpoint: raw.endpoint,
    accessKeyId: raw.accessKeyId ?? '',
    secretAccessKey: decryptSecretIfNeeded(raw.secretAccessKey),
    bucketName: raw.bucketName,
    publicUrl: raw.publicUrl,
    cloudflareAccountId: raw.cloudflareAccountId ?? null,
    cloudflareApiToken: decryptSecretIfNeeded(raw.cloudflareApiToken),
  };
}

export function generateBackendSignedUrl(
  path: string,
  queryParams: Record<string, string>,
  expiresInSeconds = 900,
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const urlObj = new URL(path, 'http://localhost'); // dummy host
  for (const [k, v] of Object.entries(queryParams)) {
    urlObj.searchParams.set(k, v);
  }
  urlObj.searchParams.set('expires', String(expires));

  // Sort search params for consistency
  urlObj.searchParams.sort();

  const message = urlObj.pathname + '?' + urlObj.searchParams.toString();
  const signature = crypto.createHmac('sha256', config.JWT_SECRET).update(message).digest('hex');

  urlObj.searchParams.set('signature', signature);
  return urlObj.pathname + urlObj.search;
}

export function validateBackendSignedUrl(path: string, query: Record<string, unknown>): boolean {
  const { signature, expires, ...rest } = query;
  if (!signature || !expires) {
    return false;
  }

  const expiresTime = parseInt(String(expires), 10);
  if (isNaN(expiresTime) || expiresTime < Date.now() / 1000) {
    return false; // Expired
  }

  // Enforce maximum lifetime limit (e.g. 1 hour / 3600 seconds)
  const maxLifetime = 3600;
  if (expiresTime > Date.now() / 1000 + maxLifetime) {
    return false; // Exceeds lifetime limit enforcement
  }

  const urlObj = new URL(path, 'http://localhost');
  for (const [k, v] of Object.entries(rest)) {
    urlObj.searchParams.set(k, String(v));
  }
  urlObj.searchParams.set('expires', String(expires));
  urlObj.searchParams.sort();

  const message = urlObj.pathname + '?' + urlObj.searchParams.toString();
  const expectedSignature = crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(message)
    .digest('hex');

  return signature === expectedSignature;
}
