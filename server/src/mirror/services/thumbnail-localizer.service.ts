import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as cheerio from 'cheerio';

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
  private baseDir: string;
  private baseUrl: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'uploads', 'mirror');
    this.baseUrl = '/uploads/mirror';
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

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

  async localize(originalUrl: string | null | undefined, sourceId: string): Promise<string | null> {
    if (!originalUrl) return null;

    try {
      const url = new URL(originalUrl);
      await this.assertPublicHttpUrl(url);
      const ext = this.getExtension(url.pathname) || '.jpg';
      const hash = crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 12);
      const sourceDir = path.join(this.baseDir, sourceId);

      if (!fs.existsSync(sourceDir)) {
        fs.mkdirSync(sourceDir, { recursive: true });
      }

      const fileName = `${hash}${ext}`;
      const filePath = path.join(sourceDir, fileName);
      const localUrl = `${this.baseUrl}/${sourceId}/${fileName}`;

      if (fs.existsSync(filePath)) {
        return localUrl;
      }

      // Add Referer matching the origin domain to bypass hotlink protection
      const referer = `${url.protocol}//${url.host}`;
      let response: Response | null = null;
      let lastError: any = null;
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
          `[ThumbnailLocalizer] Failed to download ${originalUrl} after ${retries + 1} attempts: ${lastError?.message}`,
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

      if (response.body) {
        let bytesWritten = 0;
        let limitedStream: Readable;
        limitedStream = Readable.fromWeb(response.body as any).on('data', (chunk) => {
          bytesWritten += Buffer.byteLength(chunk);
          if (bytesWritten > MAX_IMAGE_BYTES) {
            limitedStream.destroy(new Error('Image exceeds maximum size'));
          }
        });
        await pipeline(limitedStream, fs.createWriteStream(filePath));
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          logger.warn(
            `[ThumbnailLocalizer] Image too large: ${originalUrl} (${buffer.byteLength} bytes)`,
          );
          return originalUrl;
        }
        fs.writeFileSync(filePath, buffer);
      }

      return localUrl;
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

  deleteSourceFiles(sourceId: string): void {
    const sourceDir = path.join(this.baseDir, sourceId);
    if (fs.existsSync(sourceDir)) {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  }

  async cleanupOrphanedImages(
    sourceId: string,
  ): Promise<{ deletedCount: number; savedBytes: number }> {
    try {
      const sourceDir = path.join(this.baseDir, sourceId);
      if (!fs.existsSync(sourceDir)) {
        return { deletedCount: 0, savedBytes: 0 };
      }

      // 1. Get all resources belonging to this source from the database
      const resources = await prisma.mirrorResource.findMany({
        where: { sourceId },
        select: { thumbnailUrl: true, contentHtml: true },
      });

      // 2. Extract referenced filenames
      const referencedFiles = new Set<string>();
      for (const r of resources) {
        if (r.thumbnailUrl && r.thumbnailUrl.startsWith(`/uploads/mirror/${sourceId}/`)) {
          referencedFiles.add(path.basename(r.thumbnailUrl));
        }
        if (r.contentHtml && r.contentHtml.includes(`/uploads/mirror/${sourceId}/`)) {
          const regex = new RegExp(`/uploads/mirror/${sourceId}/([^"'\\s>)]+)`, 'g');
          let match;
          while ((match = regex.exec(r.contentHtml)) !== null) {
            if (match[1]) {
              const part = match[1].split(/[?#]/)[0];
              if (part) {
                referencedFiles.add(path.basename(part));
              }
            }
          }
        }
      }

      // 3. Scan directory and delete orphaned files
      const filenames = fs.readdirSync(sourceDir);
      let deletedCount = 0;
      let savedBytes = 0;

      for (const filename of filenames) {
        const filePath = path.join(sourceDir, filename);
        if (fs.statSync(filePath).isFile()) {
          if (!referencedFiles.has(filename)) {
            const size = fs.statSync(filePath).size;
            fs.unlinkSync(filePath);
            deletedCount++;
            savedBytes += size;
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `[ThumbnailLocalizer] Cleaned up ${deletedCount} orphaned files for source ${sourceId}, saved ${(savedBytes / 1024 / 1024).toFixed(2)} MB.`,
        );
      }

      return { deletedCount, savedBytes };
    } catch (e) {
      logger.error(
        `[ThumbnailLocalizer] Failed to cleanup orphaned images for source ${sourceId}:`,
        e instanceof Error ? e.message : String(e),
      );
      return { deletedCount: 0, savedBytes: 0 };
    }
  }

  private getExtension(pathname: string): string {
    const ext = path.extname(pathname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
    return allowed.includes(ext) ? ext : '.jpg';
  }
}

export const thumbnailLocalizer = new ThumbnailLocalizer();
