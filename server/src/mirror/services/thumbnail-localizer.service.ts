import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';
import { gbToBytes } from '../../utils/quota';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { Readable } from 'stream';
import * as cheerio from 'cheerio';
import { storageService } from '../../services/storage.service';

const MAX_REDIRECTS = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === 'metadata.google.internal'
  );
};

const isBlockedIp = (ip: string): boolean => {
  if (ip.startsWith('::ffff:')) {
    return isBlockedIp(ip.slice(7));
  }

  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
    const a = parts[0] ?? -1;
    const b = parts[1] ?? -1;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('2001:db8:')
    );
  }

  return true;
};

class ThumbnailLocalizer {
  private async assertPublicHttpUrl(url: URL): Promise<void> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP(S) image URLs are allowed');
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '');

    if (isBlockedHostname(hostname)) {
      throw new Error('Private or local hostnames are not allowed');
    }

    if (net.isIP(hostname)) {
      if (isBlockedIp(hostname)) {
        throw new Error('Private or reserved IP addresses are not allowed');
      }
      return;
    }

    const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
    if (addresses.length === 0 || addresses.some((entry) => isBlockedIp(entry.address))) {
      throw new Error('Host resolves to a private or reserved IP address');
    }
  }

  private async fetchWithRedirects(originalUrl: URL, referer: string): Promise<Response> {
    let currentUrl = originalUrl;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      await this.assertPublicHttpUrl(currentUrl);

      const response = await fetch(currentUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: referer,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Connection: 'keep-alive',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      if (response.status < 300 || response.status >= 400) {
        return response;
      }

      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      currentUrl = new URL(location, currentUrl);
    }

    throw new Error('Too many redirects');
  }

  /**
   * Downloads a response body into a Buffer while enforcing a hard size limit.
   * Aborts early if the stream exceeds MAX_IMAGE_BYTES to avoid memory pressure.
   */
  private async downloadToBuffer(response: Response): Promise<Buffer> {
    if (!response.body) {
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('Image exceeds maximum size');
      }
      return buf;
    }

    const chunks: Buffer[] = [];
    let bytesWritten = 0;
    const stream = Readable.fromWeb(
      response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
    );

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytesWritten += buf.byteLength;
        if (bytesWritten > MAX_IMAGE_BYTES) {
          stream.destroy(new Error('Image exceeds maximum size'));
          return;
        }
        chunks.push(buf);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Resolves an active storage config for MIRROR assets, falling back to ALL.
   * Returns null when no active config exists.
   */
  private async getActiveConfigs() {
    let configs = await prisma.storageConfig.findMany({
      where: {
        status: 'ACTIVE',
        assetType: 'MIRROR',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    if (configs.length === 0) {
      configs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          assetType: 'ALL',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    }

    return configs;
  }

  /**
   * Derives the MIME type from a file extension.
   */
  private getMimetype(ext: string): string {
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    return 'image/jpeg';
  }

  async localize(originalUrl: string | null | undefined, sourceId: string): Promise<string | null> {
    if (!originalUrl) return null;

    try {
      const url = new URL(originalUrl);
      await this.assertPublicHttpUrl(url);
      const ext = this.getExtension(url.pathname) || '.jpg';
      const hash = crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 12);
      const fileName = `${hash}${ext}`;
      const key = `mirror/${sourceId}/${fileName}`;
      const mimetype = this.getMimetype(ext);

      // Add Referer matching the origin domain to bypass hotlink protection
      const referer = `${url.protocol}//${url.host}`;
      let response: Response | null = null;
      let lastError: unknown = null;
      const retries = 2;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          response = await this.fetchWithRedirects(url, referer);
          if (response.ok) {
            break;
          }
          const errorMsg = `HTTP ${response.status}`;
          lastError = new Error(errorMsg);
          if (response.status >= 400 && response.status < 500) {
            // Do not retry on 4xx client errors (e.g. 403, 404)
            break;
          }
          throw lastError;
        } catch (e) {
          lastError = e;
          if (attempt < retries) {
            const delayMs = 1000 * Math.pow(2, attempt) + Math.random() * 200;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      if (!response || !response.ok) {
        logger.warn(
          `[ThumbnailLocalizer] Failed to download ${originalUrl} after ${retries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        );
        return originalUrl;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        logger.warn(`[ThumbnailLocalizer] Not an image: ${originalUrl} (${contentType})`);
        return originalUrl;
      }

      const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_IMAGE_BYTES) {
        logger.warn(
          `[ThumbnailLocalizer] Image too large: ${originalUrl} (${contentLength} bytes)`,
        );
        return originalUrl;
      }

      // Download into an in-memory buffer (no local disk IO)
      let buffer: Buffer;
      try {
        buffer = await this.downloadToBuffer(response);
      } catch (downloadErr) {
        logger.warn(
          `[ThumbnailLocalizer] Download aborted for ${originalUrl}: ${downloadErr instanceof Error ? downloadErr.message : String(downloadErr)}`,
        );
        return originalUrl;
      }

      // Find active R2 storage configs: prioritize MIRROR, then ALL fallback
      const configs = await this.getActiveConfigs();

      if (configs.length === 0) {
        logger.warn(
          `[ThumbnailLocalizer] No active R2 storage config; returning original URL: ${originalUrl}`,
        );
        return originalUrl;
      }

      const fileBytes = buffer.byteLength;

      for (const config of configs) {
        const limitBytes = gbToBytes(config.limitGb);
        // Try to reserve space atomically
        const updateResult = await prisma.storageConfig.updateMany({
          where: {
            id: config.id,
            status: 'ACTIVE',
            usedBytes: { lte: limitBytes - fileBytes },
          },
          data: {
            usedBytes: { increment: fileBytes },
          },
        });

        if (updateResult.count > 0) {
          try {
            const r2Url = await storageService.uploadBuffer(
              {
                endpoint: config.endpoint,
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
                bucketName: config.bucketName,
                publicUrl: config.publicUrl,
              },
              buffer,
              key,
              mimetype,
            );
            return r2Url;
          } catch (err) {
            logger.error(`[ThumbnailLocalizer] Upload to R2 config [${config.name}] failed:`, err);
            // Revert reserved space
            await prisma.storageConfig.update({
              where: { id: config.id },
              data: { usedBytes: { decrement: fileBytes } },
            });
          }
        }
      }

      // All configs failed — return original URL (no local fallback)
      logger.warn(
        `[ThumbnailLocalizer] All R2 configs failed for ${originalUrl}; returning original URL`,
      );
      return originalUrl;
    } catch (e) {
      logger.warn(
        `[ThumbnailLocalizer] Error localizing ${originalUrl}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return originalUrl;
    }
  }

  async localizeBatch(
    items: Array<{ id: string; thumbnailUrl: string | null }>,
    sourceId: string,
    concurrency: number = 10,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const queue = items.filter((item) => item.thumbnailUrl);
    const executing = new Set<Promise<void>>();

    for (const item of queue) {
      const p = (async () => {
        const localized = await this.localize(item.thumbnailUrl, sourceId);
        if (localized) {
          results.set(item.id, localized);
        }
      })();
      executing.add(p);
      const clean = () => executing.delete(p);
      p.then(clean, clean);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    return results;
  }

  async localizeHtmlContent(
    htmlContent: string | null | undefined,
    sourceId: string,
  ): Promise<string | null | undefined> {
    if (!htmlContent) return htmlContent;
    try {
      const $ = cheerio.load(htmlContent, null, false);
      const imgElements = $('img').toArray();
      const imageUrls: string[] = [];

      for (const el of imgElements) {
        const src = $(el).attr('src');
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
          imageUrls.push(src);
        }
      }

      if (imageUrls.length === 0) return htmlContent;

      const uniqueUrls = Array.from(new Set(imageUrls));
      const urlMap = new Map<string, string>();
      const executing = new Set<Promise<void>>();
      const concurrency = 5;

      for (const originalUrl of uniqueUrls) {
        const p = (async () => {
          const localized = await this.localize(originalUrl, sourceId);
          if (localized) {
            urlMap.set(originalUrl, localized);
          }
        })();
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);

        if (executing.size >= concurrency) {
          await Promise.race(executing);
        }
      }
      await Promise.all(executing);

      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && urlMap.has(src)) {
          $(el).attr('src', urlMap.get(src)!);
        }
      });

      return $.html();
    } catch (e) {
      logger.warn(
        `[ThumbnailLocalizer] Error localizing HTML content images: ${e instanceof Error ? e.message : String(e)}`,
      );
      return htmlContent;
    }
  }

  /**
   * Previously deleted locally-cached files for a source. With zero-local-IO,
   * thumbnails live only in R2 — this is now a no-op kept for API compatibility.
   */
  deleteSourceFiles(_sourceId: string): void {
    // No-op: files are stored in R2, not on local disk.
  }

  /**
   * Previously scanned the local mirror directory and removed orphaned files.
   * With zero-local-IO, there are no local files to clean — returns empty.
   */
  async cleanupOrphanedImages(
    _sourceId: string,
  ): Promise<{ deletedCount: number; savedBytes: number }> {
    return { deletedCount: 0, savedBytes: 0 };
  }

  private getExtension(pathname: string): string {
    const ext = path.extname(pathname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
    return allowed.includes(ext) ? ext : '.jpg';
  }
}

export const thumbnailLocalizer = new ThumbnailLocalizer();
