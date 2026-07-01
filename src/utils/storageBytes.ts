export function formatCloudflareBytes(bytes: number, decimals = 2): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  const value = bytes / 1000 ** exponent;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export function getQuotaLimitBytes(limitGb: number): number {
  return limitGb * 1000 * 1000 * 1000;
}

export function getUsagePercentage(usedBytes: number, limitGb: number): number {
  if (usedBytes <= 0) return 0;
  const limitBytes = getQuotaLimitBytes(limitGb);
  const percentage = (usedBytes / limitBytes) * 100;
  return Math.min(Number.parseFloat(percentage.toFixed(3)), 100);
}

export function isOfficialCloudflareUsage(
  source: 'cloudflare-graphql' | 'cloudflare-usage-api' | 'list-objects' | null | undefined,
): boolean {
  return source === 'cloudflare-graphql' || source === 'cloudflare-usage-api';
}
