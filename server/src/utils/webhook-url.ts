import dns from 'dns/promises';
import net from 'net';
import { AppError } from '../middlewares/error.middleware';

type LookupAddress = {
  address: string;
  family: number;
};

export type WebhookDnsLookup = (hostname: string) => Promise<LookupAddress[]>;

type NormalizeWebhookUrlOptions = {
  maxLength?: number;
  lookup?: WebhookDnsLookup;
};

const normalizeHostname = (hostname: string): string =>
  hostname
    .replace(/^\[|\]$/g, '')
    .trim()
    .toLowerCase();

const getIPv4Octets = (hostname: string): number[] | null => {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
};

const isPrivateOrReservedIPv4 = (hostname: string): boolean => {
  const octets = getIPv4Octets(hostname);
  if (!octets) return false;
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  const c = octets[2] ?? 0;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
};

const isPrivateOrReservedIPv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrReservedIPv4(normalized.replace('::ffff:', ''));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
};

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname.endsWith('.local') ||
  hostname.endsWith('.internal') ||
  hostname.endsWith('.lan');

const isLoopbackHost = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1') {
    return true;
  }
  const octets = getIPv4Octets(hostname);
  return Boolean(octets && octets[0] === 127);
};

const isPrivateOrReservedHost = (hostname: string): boolean => {
  const ipType = net.isIP(hostname);
  if (ipType === 4) return isPrivateOrReservedIPv4(hostname);
  if (ipType === 6) return isPrivateOrReservedIPv6(hostname);
  return isLocalHostname(hostname);
};

const lookupWebhookHost: WebhookDnsLookup = (hostname) =>
  dns.lookup(hostname, { all: true, verbatim: true });

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const assertPublicResolvedAddresses = async (
  hostname: string,
  lookup: WebhookDnsLookup,
): Promise<void> => {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedHost(hostname)) {
      throw new AppError(
        'Webhook 地址不能指向本机、内网或保留地址',
        400,
        'AI_BOT_WEBHOOK_PRIVATE_HOST',
      );
    }
    return;
  }

  if (isPrivateOrReservedHost(hostname)) {
    throw new AppError(
      'Webhook 地址不能指向本机、内网或保留地址',
      400,
      'AI_BOT_WEBHOOK_PRIVATE_HOST',
    );
  }

  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname);
  } catch (_error) {
    throw new AppError('Webhook 地址域名无法解析', 400, 'AI_BOT_WEBHOOK_HOST_UNRESOLVABLE');
  }

  if (!addresses.length) {
    throw new AppError('Webhook 地址域名无法解析', 400, 'AI_BOT_WEBHOOK_HOST_UNRESOLVABLE');
  }

  const privateAddress = addresses.find((item) =>
    isPrivateOrReservedHost(normalizeHostname(item.address)),
  );
  if (privateAddress) {
    throw new AppError(
      'Webhook 地址解析到了本机、内网或保留地址',
      400,
      'AI_BOT_WEBHOOK_PRIVATE_HOST',
    );
  }
};

const assertSafeWebhookTarget = async (url: URL, lookup: WebhookDnsLookup): Promise<void> => {
  const hostname = normalizeHostname(url.hostname);
  const allowDevelopmentLocalHttp =
    process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && isLoopbackHost(hostname);

  if (url.protocol === 'http:' && !allowDevelopmentLocalHttp) {
    throw new AppError('Webhook 地址必须使用 HTTPS', 400, 'AI_BOT_WEBHOOK_HTTPS_REQUIRED');
  }

  if (!allowDevelopmentLocalHttp) {
    await assertPublicResolvedAddresses(hostname, lookup);
  }
};

export const assertSafeWebhookUrl = async (
  value: string,
  options: Pick<NormalizeWebhookUrlOptions, 'lookup'> = {},
): Promise<void> => {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    await assertSafeWebhookTarget(parsed, options.lookup ?? lookupWebhookHost);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Webhook 地址必须是有效的 HTTP/HTTPS URL', 400, 'AI_BOT_WEBHOOK_INVALID');
  }
};

export const normalizeWebhookUrl = async (
  value: unknown,
  options: NormalizeWebhookUrlOptions = {},
): Promise<string | null> => {
  const webhookUrl = normalizeOptionalText(value, options.maxLength ?? 2000);
  if (!webhookUrl) return null;

  try {
    const parsed = new URL(webhookUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    await assertSafeWebhookTarget(parsed, options.lookup ?? lookupWebhookHost);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Webhook 地址必须是有效的 HTTP/HTTPS URL', 400, 'AI_BOT_WEBHOOK_INVALID');
  }

  return webhookUrl;
};
