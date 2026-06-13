/**
 * Crypto helper functions for string encryption/decryption
 * Uses AES-256-GCM (v2) with backward compatibility for legacy RC4 (hex) data.
 */
import crypto from 'crypto';

const V2_PREFIX = 'enc:v2:';

function deriveKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Legacy RC4 decryption for backward compatibility with existing data.
 */
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
  // Try AES-256-GCM v2 format first
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

  // Fallback to legacy RC4 hex format for backward compatibility
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return rc4(key, str);
}
