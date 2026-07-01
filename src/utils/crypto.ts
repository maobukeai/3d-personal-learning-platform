/**
 * Crypto helper functions for string decryption (used by mirror source credentials)
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

export function decryptText(hex: string, key: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return rc4(key, str);
}
