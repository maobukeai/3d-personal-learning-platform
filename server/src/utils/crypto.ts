/**
 * Crypto helper functions for string encryption/decryption
 *
 * Two separate encryption schemes:
 * 1. encryptText / decryptText  — two-argument (text + key), used for mirror source credentials
 * 2. encrypt / decrypt           — zero-key (key from STORAGE_ENCRYPTION_KEY env), used for SecretAccessKey
 */
import crypto from 'crypto';

// ─── Scheme 1: encryptText / decryptText (two-argument, used by mirror sources) ─

const V2_PREFIX = 'enc:v2:';

function deriveKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

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
  const derivedKey = deriveKey(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${V2_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptText(hex: string, key: string): string {
  if (hex.startsWith(V2_PREFIX)) {
    const parts = hex.slice(V2_PREFIX.length).split(':');
    const [ivRaw, tagRaw, encryptedRaw] = parts;
    if (ivRaw && tagRaw && encryptedRaw) {
      const derivedKey = deriveKey(key);
      const iv = Buffer.from(ivRaw, 'base64url');
      const tag = Buffer.from(tagRaw, 'base64url');
      const encrypted = Buffer.from(encryptedRaw, 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    }
  }

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
  if (!keyHex) {
    // Fallback to deriving a 32-byte key from DATABASE_ENCRYPTION_KEY if STORAGE_ENCRYPTION_KEY is not set
    const dbKey = process.env.DATABASE_ENCRYPTION_KEY || 'dev-secret-key-change-in-production';
    return crypto.createHash('sha256').update(dbKey).digest();
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'STORAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).',
    );
  }
  return Buffer.from(keyHex, 'hex');
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
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
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
