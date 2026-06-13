/**
 * TOTP (RFC 6238) dynamic verification code generator using Web Crypto API.
 */

export function decodeBase32(secret: string): Uint8Array {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.replace(/[\s=]/g, '').toUpperCase();
  const len = cleanSecret.length;
  if (len === 0) return new Uint8Array(0);

  const buffer = new Uint8Array(Math.floor((len * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < len; i++) {
    const val = base32chars.indexOf(cleanSecret[i]);
    if (val === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

export async function generateTOTP(secret: string): Promise<{ code: string; timeLeft: number }> {
  try {
    const keyBytes = decodeBase32(secret);
    if (keyBytes.length === 0) {
      return { code: '------', timeLeft: 0 };
    }
    const epoch = Math.round(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const timeLeft = 30 - (epoch % 30);

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(0, 0, false);
    counterView.setUint32(4, counter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes as any,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      counterBuffer
    );

    const hmacResult = new Uint8Array(signature);
    const offset = hmacResult[hmacResult.length - 1] & 0xf;

    const codeInt =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const codeStr = (codeInt % 1000000).toString().padStart(6, '0');
    return { code: codeStr, timeLeft };
  } catch (err) {
    console.error('Failed to generate TOTP:', err);
    return { code: '------', timeLeft: 0 };
  }
}
