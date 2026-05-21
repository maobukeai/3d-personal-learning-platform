import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as cheerio from 'cheerio';

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

  async localize(originalUrl: string | null | undefined, sourceId: string): Promise<string | null> {
    if (!originalUrl) return null;

    try {
      const url = new URL(originalUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
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
          response = await fetch(originalUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: referer,
              Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              Connection: 'keep-alive',
            },
            signal: AbortSignal.timeout(5000),
          });
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
        } catch (e: any) {
          lastError = e;
          if (attempt < retries) {
            const delayMs = 1000 * Math.pow(2, attempt) + Math.random() * 200;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      if (!response || !response.ok) {
        console.warn(
          `[ThumbnailLocalizer] Failed to download ${originalUrl} after ${retries + 1} attempts: ${lastError?.message}`,
        );
        return originalUrl;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        console.warn(`[ThumbnailLocalizer] Not an image: ${originalUrl} (${contentType})`);
        return originalUrl;
      }

      if (response.body) {
        await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(filePath));
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
      }

      return localUrl;
    } catch (e: any) {
      console.warn(`[ThumbnailLocalizer] Error localizing ${originalUrl}: ${e.message}`);
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
    } catch (e: any) {
      console.warn(`[ThumbnailLocalizer] Error localizing HTML content images: ${e.message}`);
      return htmlContent;
    }
  }

  deleteSourceFiles(sourceId: string): void {
    const sourceDir = path.join(this.baseDir, sourceId);
    if (fs.existsSync(sourceDir)) {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  }

  private getExtension(pathname: string): string {
    const ext = path.extname(pathname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
    return allowed.includes(ext) ? ext : '.jpg';
  }
}

export const thumbnailLocalizer = new ThumbnailLocalizer();
