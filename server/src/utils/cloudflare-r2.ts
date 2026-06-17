export function parseCloudflareAccountIdFromEndpoint(endpoint: string): string | null {
  if (!endpoint) return null;

  try {
    const normalized = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
    const url = new URL(normalized);
    const hostMatch = url.hostname.match(/^([a-f0-9]{32})\.r2\.cloudflarestorage\.com$/i);
    if (hostMatch?.[1]) return hostMatch[1].toLowerCase();
  } catch {
    return null;
  }

  return null;
}

export function parseUsageNumber(value: string | number | bigint | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return 0;

  try {
    const asBigInt = BigInt(trimmed);
    const asNumber = Number(asBigInt);
    return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : 0;
  } catch {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}

export interface CloudflareR2UsageApiResult {
  payloadBytes: number;
  metadataBytes: number;
  infrequentAccessPayloadBytes: number;
  infrequentAccessMetadataBytes: number;
  objectCount: number;
  uploadCount: number;
}

export function calculateTotalUsageBytes(usage: CloudflareR2UsageApiResult): number {
  return (
    usage.payloadBytes +
    usage.metadataBytes +
    usage.infrequentAccessPayloadBytes +
    usage.infrequentAccessMetadataBytes
  );
}

export function getDashboardPayloadBytes(usage: CloudflareR2UsageApiResult): number {
  return usage.payloadBytes + usage.infrequentAccessPayloadBytes;
}

export function getBucketNameCandidates(bucketName: string, jurisdiction?: string | null): string[] {
  const candidates = new Set<string>();
  const trimmed = bucketName.trim();
  if (!trimmed) return [];

  candidates.add(trimmed);

  if (jurisdiction?.trim()) {
    candidates.add(`${jurisdiction.trim()}_${trimmed}`);
  }

  for (const prefix of ['eu', 'fedramp']) {
    candidates.add(`${prefix}_${trimmed}`);
  }

  return Array.from(candidates);
}

async function postCloudflareGraphql<T>(apiToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok || body.errors?.length) {
    const message = body.errors?.[0]?.message || `Cloudflare GraphQL failed (${response.status})`;
    throw new Error(message);
  }

  if (!body.data) {
    throw new Error('Cloudflare GraphQL returned empty data');
  }

  return body.data;
}

const R2_STORAGE_GRAPHQL_QUERY = `
  query R2BucketStorage($accountTag: string!, $bucketName: string!, $startDate: Time!, $endDate: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        r2StorageAdaptiveGroups(
          limit: 1
          filter: {
            bucketName: $bucketName
            datetime_geq: $startDate
            datetime_leq: $endDate
          }
          orderBy: [datetime_DESC]
        ) {
          max {
            payloadSize
            metadataSize
            objectCount
            uploadCount
          }
        }
      }
    }
  }
`;

type GraphqlStorageResponse = {
  viewer: {
    accounts: Array<{
      r2StorageAdaptiveGroups: Array<{
        max: {
          payloadSize?: string | number | null;
          metadataSize?: string | number | null;
          objectCount?: string | number | null;
          uploadCount?: string | number | null;
        } | null;
      }>;
    }>;
  };
};

export async function fetchCloudflareR2BucketUsageFromGraphQL(
  accountId: string,
  bucketName: string,
  apiToken: string,
): Promise<CloudflareR2UsageApiResult> {
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

  const data = await postCloudflareGraphql<GraphqlStorageResponse>(apiToken, R2_STORAGE_GRAPHQL_QUERY, {
    accountTag: accountId,
    bucketName,
    startDate,
    endDate,
  });

  const max = data.viewer.accounts[0]?.r2StorageAdaptiveGroups[0]?.max;
  if (!max) {
    throw new Error(`Cloudflare GraphQL returned no storage data for bucket ${bucketName}`);
  }

  return {
    payloadBytes: parseUsageNumber(max.payloadSize),
    metadataBytes: parseUsageNumber(max.metadataSize),
    infrequentAccessPayloadBytes: 0,
    infrequentAccessMetadataBytes: 0,
    objectCount: parseUsageNumber(max.objectCount),
    uploadCount: parseUsageNumber(max.uploadCount),
  };
}

export async function fetchCloudflareR2BucketUsage(
  accountId: string,
  bucketName: string,
  apiToken: string,
): Promise<CloudflareR2UsageApiResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucketName)}/usage`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    },
  });

  const body = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: Record<string, string | number | null | undefined>;
  };

  if (!response.ok || !body.success) {
    const message =
      body.errors?.[0]?.message || `Cloudflare R2 usage API failed (${response.status})`;
    throw new Error(message);
  }

  const result = body.result || {};
  return {
    payloadBytes: parseUsageNumber(result.payloadSize),
    metadataBytes: parseUsageNumber(result.metadataSize),
    infrequentAccessPayloadBytes: parseUsageNumber(result.infrequentAccessPayloadSize),
    infrequentAccessMetadataBytes: parseUsageNumber(result.infrequentAccessMetadataSize),
    objectCount: parseUsageNumber(result.objectCount),
    uploadCount: parseUsageNumber(result.uploadCount),
  };
}

export async function fetchOfficialBucketUsage(
  accountId: string,
  bucketName: string,
  apiToken: string,
  jurisdiction?: string | null,
): Promise<{ usage: CloudflareR2UsageApiResult; source: 'cloudflare-graphql' | 'cloudflare-usage-api'; resolvedBucketName: string }> {
  const candidates = getBucketNameCandidates(bucketName, jurisdiction);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const usage = await fetchCloudflareR2BucketUsageFromGraphQL(accountId, candidate, apiToken);
      return { usage, source: 'cloudflare-graphql', resolvedBucketName: candidate };
    } catch (graphqlError) {
      lastError = graphqlError instanceof Error ? graphqlError : new Error(String(graphqlError));
    }

    try {
      const usage = await fetchCloudflareR2BucketUsage(accountId, candidate, apiToken);
      return { usage, source: 'cloudflare-usage-api', resolvedBucketName: candidate };
    } catch (usageError) {
      lastError = usageError instanceof Error ? usageError : new Error(String(usageError));
    }
  }

  throw lastError || new Error('Unable to fetch official Cloudflare bucket usage');
}

export function resolveCloudflareAccountId(endpoint: string, explicitAccountId?: string | null): string | null {
  if (explicitAccountId?.trim()) return explicitAccountId.trim();
  if (process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) return process.env.CLOUDFLARE_ACCOUNT_ID.trim();
  return parseCloudflareAccountIdFromEndpoint(endpoint);
}

export function resolveCloudflareApiToken(
  explicitApiToken?: string | null,
  sharedApiTokens: Array<string | null | undefined> = [],
): string | null {
  if (explicitApiToken?.trim()) return explicitApiToken.trim();
  if (process.env.CLOUDFLARE_R2_API_TOKEN?.trim()) return process.env.CLOUDFLARE_R2_API_TOKEN.trim();

  for (const token of sharedApiTokens) {
    if (token?.trim()) return token.trim();
  }

  return null;
}

export function formatDecimalBytes(bytes: number, decimals = 2): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  const value = bytes / 1000 ** exponent;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}
