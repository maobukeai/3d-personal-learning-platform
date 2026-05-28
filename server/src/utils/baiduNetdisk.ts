import axios from 'axios';
import { logger } from './logger';

export interface BaiduNetdiskDirectory {
  name: string;
  files: string[];
}

export interface BaiduNetdiskParsedData {
  title: string;
  directories: BaiduNetdiskDirectory[];
  isFallback?: boolean;
}

/**
 * Helper to manage and merge cookies across requests (a minimal Cookie Jar)
 */
class CookieJar {
  private cookies: Record<string, string> = {};

  public addCookies(setCookieHeaders: string[] | undefined) {
    if (!setCookieHeaders) return;
    for (const header of setCookieHeaders) {
      const firstPart = header.split(';')[0];
      if (!firstPart) continue;

      const parts = firstPart.split('=');
      if (parts.length >= 2) {
        const key = parts[0]?.trim();
        const val = parts.slice(1).join('=').trim();
        if (key) {
          this.cookies[key] = val;
        }
      }
    }
  }

  public getCookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

/**
 * Custom file comparison logic that sorts files by their logical course lesson numbers.
 * Supports normalizing specific prefixes such as editing (106_0 -> 0), shooting (10_10 -> 10), and color grading (100_10 -> 30).
 * Falls back to standard Intl.Collator natural sort for unmatched cases.
 */
function compareBaiduFiles(a: string, b: string): number {
  const collator = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' });
  return collator.compare(a, b);
}

/**
 * Parses a Baidu Netdisk share link, verifies password, and lists its contents.
 * Throws an error if it cannot bypass the verification/captcha blocks.
 */
export async function parseBaiduNetdiskLink(
  url: string,
  password?: string,
): Promise<BaiduNetdiskParsedData> {
  const surlMatch =
    url.match(/surl=([^&]+)/) || url.match(/\/s\/1([^?&]+)/) || url.match(/\/s\/([^?&]+)/);
  if (!surlMatch || !surlMatch[1]) {
    throw new Error('未能在链接中识别到正确的分享码（surl）');
  }

  let surl = surlMatch[1];
  if (surl.startsWith('1')) {
    surl = surl.substring(1);
  }

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const jar = new CookieJar();
  const initUrl = `https://pan.baidu.com/share/init?surl=${surl}`;

  logger.info(`Baidu Netdisk parsing started for surl: ${surl}`);

  // 1. Fetch share init page to grab initial cookies and share metadata (uk, shareid)
  const initRes = await axios.get(initUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    timeout: 10000,
  });

  jar.addCookies(initRes.headers['set-cookie']);
  const html = initRes.data;

  // Extract shareid & uk (prefer share_uk, then uk)
  const shareidMatch =
    html.match(/shareid\s*[:=]\s*["']?(\d+)["']?/) || html.match(/"shareid"\s*:\s*(\d+)/);
  const shareUkMatch =
    html.match(/share_uk\s*[:=]\s*["']?(\d+)["']?/) ||
    html.match(/"share_uk"\s*:\s*["']?(\d+)["']?/);
  const ukMatch = html.match(/uk\s*[:=]\s*["']?(\d+)["']?/) || html.match(/"uk"\s*:\s*(\d+)/);

  const shareid = shareidMatch ? shareidMatch[1] : null;
  const uk = shareUkMatch ? shareUkMatch[1] : ukMatch ? ukMatch[1] : null;

  if (!shareid || !uk) {
    throw new Error('未能在网盘页面中提取到分享人特征码 (uk/shareid)，该链接可能失效');
  }

  // 2. Perform passcode verification if password exists or was matched in URL
  if (password) {
    const verifyUrl = `https://pan.baidu.com/share/verify?surl=${surl}&t=${Date.now()}&channel=chunlei&web=1&app_id=250528&clienttype=0`;
    const requestBody = `pwd=${password}&vcode=&vcode_str=`;

    const verifyRes = await axios.post(verifyUrl, requestBody, {
      headers: {
        'User-Agent': userAgent,
        Referer: initUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar.getCookieHeader(),
      },
      timeout: 10000,
    });

    if (verifyRes.data && verifyRes.data.errno !== 0) {
      logger.warn(`Baidu password verification returned non-zero errno: ${verifyRes.data.errno}`);
      throw new Error(`提取码验证错误: ${verifyRes.data.err_msg || '未知错误'}`);
    }

    jar.addCookies(verifyRes.headers['set-cookie']);
  }

  // 3. Recursive traversal of shared folder contents
  const allDirectories: BaiduNetdiskDirectory[] = [];
  const visitedPaths = new Set<string>();
  let requestCount = 0;
  const maxRequests = 12; // Safeguard against massive folder trees
  let shareTitle = '';

  async function traverseFolder(dirPath: string, isRoot: boolean) {
    if (visitedPaths.has(dirPath) || requestCount >= maxRequests) {
      return;
    }
    visitedPaths.add(dirPath);
    requestCount++;

    const rootParam = isRoot ? 1 : 0;
    const listUrl = `https://pan.baidu.com/share/list?shareid=${shareid}&uk=${uk}&dir=${encodeURIComponent(
      dirPath,
    )}&order=name&desc=0&num=100&page=1&root=${rootParam}&t=${Date.now()}&channel=chunlei&web=1&app_id=250528&clienttype=0`;

    const res = await axios.get(listUrl, {
      headers: {
        'User-Agent': userAgent,
        Referer: initUrl,
        Cookie: jar.getCookieHeader(),
      },
      timeout: 10000,
    });

    if (res.data && res.data.errno === 0 && res.data.list) {
      // Extract title from the response if available
      if (res.data.title && !shareTitle) {
        shareTitle = res.data.title;
      }

      const files: string[] = [];
      const subdirs: string[] = [];

      for (const item of res.data.list) {
        const isDir = item.isdir === '1' || item.isdir === 1;
        if (isDir) {
          subdirs.push(item.path);
        } else {
          files.push(item.server_filename);
        }
      }

      // Sort directories naturally, and files using custom logical lesson order
      const collator = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' });
      subdirs.sort((a, b) => collator.compare(a, b));
      files.sort(compareBaiduFiles);

      // Add to directories if it has files
      if (files.length > 0) {
        // Clean the directory name for presentation
        let displayName: string;
        if (dirPath === '/' || dirPath === '%2F') {
          displayName = shareTitle || '根目录';
        } else {
          // Get the base name of the folder path
          const pathParts = dirPath.split('/');
          displayName = pathParts[pathParts.length - 1] || dirPath;
        }

        allDirectories.push({
          name: displayName,
          files,
        });
      }

      // Traverse subdirectories
      for (const subdirPath of subdirs) {
        await traverseFolder(subdirPath, false);
      }
    } else {
      logger.warn(`Baidu list API returned error for dir ${dirPath}: ${JSON.stringify(res.data)}`);
      if (res.data && res.data.errno !== 0) {
        throw new Error(`获取文件列表失败，网盘响应码: ${res.data.errno}`);
      }
    }
  }

  // Start traversing from share root
  await traverseFolder('%2F', true);

  // If we traversed but found no title, set a default from the share owner or structure
  if (!shareTitle) {
    const firstDir = allDirectories[0];
    shareTitle = firstDir ? firstDir.name : '未命名网盘课程';
  }

  // Clean title (remove leading slash if present)
  if (shareTitle.startsWith('/')) {
    shareTitle = shareTitle.substring(1);
    const lastSlashIdx = shareTitle.lastIndexOf('/');
    if (lastSlashIdx !== -1) {
      shareTitle = shareTitle.substring(lastSlashIdx + 1);
    }
  }

  return {
    title: shareTitle,
    directories: allDirectories,
  };
}
