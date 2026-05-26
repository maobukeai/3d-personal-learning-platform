import { logger } from '../../utils/logger';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export interface RawCategory {
  externalId: string;
  name: string;
  slug?: string;
  parentExternalId?: string;
}

export interface RawResource {
  externalId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentUrl?: string;
  tags?: string[];
  categoryExternalId?: string;
  resourceType: string;
  publishedAt?: Date;
  contentHash: string;
  contentHtml?: string;
}

export interface RawResourcePage {
  resources: RawResource[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export interface AdapterConfig {
  baseUrl: string;
  syncConfig?: {
    concurrency?: number;
    requestDelay?: number;
    timeout?: number;
    proxy?: string;
    maxRetries?: number;
    retryBaseDelay?: number;
  };
}

export abstract class BaseAdapter {
  protected config: AdapterConfig;
  protected maxRetries: number;
  protected retryBaseDelay: number;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.maxRetries = config.syncConfig?.maxRetries ?? 3;
    this.retryBaseDelay = config.syncConfig?.retryBaseDelay ?? 1000;
  }

  abstract fetchCategories(signal?: AbortSignal): Promise<RawCategory[]>;

  abstract fetchResources(
    page: number,
    categorySlug?: string,
    signal?: AbortSignal,
  ): Promise<RawResourcePage>;

  abstract fetchResourceDetail(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<RawResource | null>;

  abstract hasUpdates(since: Date, signal?: AbortSignal): Promise<boolean>;

  abstract fetchUpdates(since: Date, signal?: AbortSignal): Promise<RawResource[]>;

  protected async fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
    return this.withRetry(async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: signal || AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
      }

      return response.text();
    });
  }

  protected async withRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> {
    const retries = maxRetries ?? this.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        if (this.isNonRetryableError(e)) {
          throw e;
        }

        if (attempt < retries) {
          const delayMs = this.retryBaseDelay * Math.pow(2, attempt) + Math.random() * 500;
          logger.warn(
            `[BaseAdapter] Attempt ${attempt + 1}/${retries + 1} failed: ${e instanceof Error ? e.message : String(e)}. Retrying in ${Math.round(delayMs)}ms...`,
          );
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      if (error.message?.includes('HTTP 4')) return true;
      if (error.message?.includes('HTTP 403')) return true;
      if (error.message?.includes('HTTP 404')) return true;
      if (error.name === 'AbortError') return false;
    }
    return false;
  }

  protected parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  protected computeHash(...parts: (string | undefined)[]): string {
    const content = parts.filter(Boolean).join('|');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
