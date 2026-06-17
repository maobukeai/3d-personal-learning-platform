import {
  calculateTotalUsageBytes,
  formatDecimalBytes,
  getBucketNameCandidates,
  getDashboardPayloadBytes,
  parseCloudflareAccountIdFromEndpoint,
  parseUsageNumber,
  resolveCloudflareAccountId,
} from '../src/utils/cloudflare-r2';

describe('cloudflare-r2 utils', () => {
  it('parses account id from standard R2 endpoint', () => {
    const accountId = '160a4a0512e4ea5efe4af6d7601605ad';
    expect(parseCloudflareAccountIdFromEndpoint(`https://${accountId}.r2.cloudflarestorage.com`)).toBe(
      accountId,
    );
  });

  it('returns null for custom endpoints', () => {
    expect(parseCloudflareAccountIdFromEndpoint('https://cdn.example.com')).toBeNull();
  });

  it('parses usage numbers returned as strings', () => {
    expect(parseUsageNumber('345397577129')).toBe(345397577129);
    expect(parseUsageNumber(undefined)).toBe(0);
  });

  it('calculates dashboard payload bytes from usage result', () => {
    const usage = {
      payloadBytes: 1000,
      metadataBytes: 50,
      infrequentAccessPayloadBytes: 200,
      infrequentAccessMetadataBytes: 10,
      objectCount: 3,
      uploadCount: 1,
    };

    expect(getDashboardPayloadBytes(usage)).toBe(1200);
    expect(calculateTotalUsageBytes(usage)).toBe(1260);
  });

  it('builds bucket name candidates with jurisdiction prefixes', () => {
    expect(getBucketNameCandidates('my-bucket')).toEqual(['my-bucket', 'eu_my-bucket', 'fedramp_my-bucket']);
  });

  it('formats decimal bytes like Cloudflare dashboard', () => {
    expect(formatDecimalBytes(63_788_362_417_675)).toBe('63.79 TB');
  });

  it('prefers explicit account id over endpoint parsing', () => {
    const explicit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const resolved = resolveCloudflareAccountId(
      'https://bbbbbbbbbbbbbbbbbbbbbbbbbbbb.r2.cloudflarestorage.com',
      explicit,
    );
    expect(resolved).toBe(explicit);
  });
});
