import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

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

      const response = await fetch(originalUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(
          `[ThumbnailLocalizer] Failed to download ${originalUrl}: HTTP ${response.status}`,
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
    concurrency: number = 5,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const queue = items.filter((item) => item.thumbnailUrl);

    for (let i = 0; i < queue.length; i += concurrency) {
      const chunk = queue.slice(i, i + concurrency);
      const promises = chunk.map(async (item) => {
        const localized = await this.localize(item.thumbnailUrl, sourceId);
        if (localized) {
          results.set(item.id, localized);
        }
      });
      await Promise.all(promises);

      if (i + concurrency < queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
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
