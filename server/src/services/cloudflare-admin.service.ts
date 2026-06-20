import { encrypt, ENCRYPTED_VALUE_RE, decryptSecretIfNeeded } from '../utils/crypto';
import prisma from './prisma';

// Re-export for convenience — the canonical definitions live in utils/crypto.
export { ENCRYPTED_VALUE_RE };

const API_BASE = 'https://api.cloudflare.com/client/v4';
const CONFIG_TOKEN_KEY = 'CLOUDFLARE_DOMAIN_API_TOKEN';
const CONFIG_ACCOUNT_KEY = 'CLOUDFLARE_DOMAIN_ACCOUNT_ID';

export interface CloudflareDomainConfig {
  apiToken: string;
  accountId: string | null;
  hasToken: boolean;
}

export interface CloudflareZoneSummary {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  plan: string;
  nameServers: string[];
  createdOn: string;
  modifiedOn: string;
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
  data?: any;
  createdOn: string;
  modifiedOn: string;
}


async function cloudflareRequest<T>(
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const body = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: T;
    result_info?: { page?: number; per_page?: number; total_count?: number; total_pages?: number };
  };

  if (!response.ok || !body.success) {
    const message = body.errors?.[0]?.message || `Cloudflare API failed (${response.status})`;
    throw new Error(message);
  }

  return body.result as T;
}

class CloudflareAdminService {
  async getConfig(): Promise<CloudflareDomainConfig> {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [CONFIG_TOKEN_KEY, CONFIG_ACCOUNT_KEY] } },
    });
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const apiToken = decryptSecretIfNeeded(map[CONFIG_TOKEN_KEY]);
    return {
      apiToken,
      accountId: map[CONFIG_ACCOUNT_KEY] || null,
      hasToken: !!apiToken,
    };
  }

  async saveConfig(apiToken: string, accountId?: string | null): Promise<CloudflareDomainConfig> {
    const trimmedToken = apiToken.trim();
    if (trimmedToken) {
      await prisma.systemSetting.upsert({
        where: { key: CONFIG_TOKEN_KEY },
        update: { value: encrypt(trimmedToken) },
        create: { key: CONFIG_TOKEN_KEY, value: encrypt(trimmedToken) },
      });
    }

    if (accountId !== undefined) {
      await prisma.systemSetting.upsert({
        where: { key: CONFIG_ACCOUNT_KEY },
        update: { value: accountId?.trim() || '' },
        create: { key: CONFIG_ACCOUNT_KEY, value: accountId?.trim() || '' },
      });
    }

    return this.getConfig();
  }

  async clearConfig(): Promise<void> {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: [CONFIG_TOKEN_KEY, CONFIG_ACCOUNT_KEY] } },
    });
  }

  async verifyToken(apiToken: string) {
    const response = await fetch(`${API_BASE}/user/tokens/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
      },
    });

    const body = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: {
        id?: string;
        status?: string;
        expires_on?: string;
      };
    };

    if (!response.ok || !body.success) {
      const message = body.errors?.[0]?.message || `Token 验证失败 (${response.status})`;
      throw new Error(message);
    }

    return body.result || {};
  }

  private async requireToken(): Promise<string> {
    const config = await this.getConfig();
    if (!config.apiToken) {
      throw new Error('请先在 Cloudflare 域名管理页面配置 API Token');
    }
    return config.apiToken;
  }

  async listZones(): Promise<CloudflareZoneSummary[]> {
    const config = await this.getConfig();
    if (!config.apiToken) {
      throw new Error('请先在 Cloudflare 域名管理页面配置 API Token');
    }
    const apiToken = config.apiToken;
    const zones: CloudflareZoneSummary[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const query = new URLSearchParams({
        page: String(page),
        per_page: '50',
      });
      if (config.accountId) {
        query.set('account.id', config.accountId);
      }

      const response = await fetch(`${API_BASE}/zones?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
        },
      });

      const body = (await response.json()) as {
        success?: boolean;
        errors?: Array<{ message?: string }>;
        result?: Array<Record<string, unknown>>;
        result_info?: { total_pages?: number };
      };

      if (!response.ok || !body.success) {
        const message = body.errors?.[0]?.message || `获取域名列表失败 (${response.status})`;
        throw new Error(message);
      }

      totalPages = body.result_info?.total_pages || 1;
      for (const zone of body.result || []) {
        const plan = zone.plan as { name?: string } | undefined;
        zones.push({
          id: String(zone.id),
          name: String(zone.name),
          status: String(zone.status || 'unknown'),
          paused: Boolean(zone.paused),
          type: String(zone.type || 'full'),
          plan: plan?.name || 'Free',
          nameServers: Array.isArray(zone.name_servers) ? zone.name_servers.map(String) : [],
          createdOn: String(zone.created_on || ''),
          modifiedOn: String(zone.modified_on || ''),
        });
      }
      page += 1;
    }

    return zones;
  }

  async getZone(zoneId: string) {
    const apiToken = await this.requireToken();
    return cloudflareRequest<Record<string, unknown>>(apiToken, `/zones/${zoneId}`);
  }

  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    const apiToken = await this.requireToken();
    const records: CloudflareDnsRecord[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const query = new URLSearchParams({ page: String(page), per_page: '100' });
      const response = await fetch(`${API_BASE}/zones/${zoneId}/dns_records?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
        },
      });

      const body = (await response.json()) as {
        success?: boolean;
        errors?: Array<{ message?: string }>;
        result?: Array<Record<string, unknown>>;
        result_info?: { total_pages?: number };
      };

      if (!response.ok || !body.success) {
        const message = body.errors?.[0]?.message || `获取 DNS 记录失败 (${response.status})`;
        throw new Error(message);
      }

      totalPages = body.result_info?.total_pages || 1;
      for (const record of body.result || []) {
        records.push({
          id: String(record.id),
          type: String(record.type),
          name: String(record.name),
          content: String(record.content),
          proxied: Boolean(record.proxied),
          ttl: Number(record.ttl || 1),
          priority: record.priority !== undefined ? Number(record.priority) : undefined,
          data: record.data,
          createdOn: String(record.created_on || ''),
          modifiedOn: String(record.modified_on || ''),
        });
      }
      page += 1;
    }

    return records;
  }

  async createDnsRecord(zoneId: string, payload: any) {
    const apiToken = await this.requireToken();
    return cloudflareRequest(apiToken, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDnsRecord(zoneId: string, recordId: string, payload: any) {
    const apiToken = await this.requireToken();
    return cloudflareRequest(apiToken, `/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteDnsRecord(zoneId: string, recordId: string) {
    const apiToken = await this.requireToken();
    return cloudflareRequest(apiToken, `/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async getZoneSettings(zoneId: string) {
    const apiToken = await this.requireToken();
    try {
      const ssl = await cloudflareRequest<{ value: string; modified_on?: string }>(
        apiToken,
        `/zones/${zoneId}/settings/ssl`,
      );

      let sslStatus = 'unknown';
      try {
        const verification = await cloudflareRequest<{
          certificate_status?: string;
          verification_status?: string;
        }>(apiToken, `/zones/${zoneId}/ssl/verification`);
        sslStatus = verification.certificate_status || verification.verification_status || 'unknown';
      } catch {
        sslStatus = ssl.value === 'off' ? 'disabled' : 'active';
      }

      return {
        sslMode: ssl.value,
        sslStatus,
        sslModifiedOn: ssl.modified_on || null,
      };
    } catch (error) {
      return {
        sslMode: 'unknown',
        sslStatus: 'unknown',
        sslModifiedOn: null,
      };
    }
  }

  async setZonePaused(zoneId: string, paused: boolean) {
    const apiToken = await this.requireToken();
    return cloudflareRequest<{ id: string; paused: boolean; status: string }>(apiToken, `/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ paused }),
    });
  }
}

export const cloudflareAdminService = new CloudflareAdminService();
