import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  content?: string;
  domain: string;
  publishedAt?: string;
}

export interface WebSearchOptions {
  includePageContent?: boolean;
  maxResults?: number;
  pageContentLength?: number;
  recencyDays?: number;
  requireFreshness?: boolean;
  trustedFreshDomains?: string[];
  maxSearchEngines?: number;
  enableFallbackSearch?: boolean;
  alwaysRunFallbackSearch?: boolean;
}

/** Maximum number of top results to fetch full page content for. */
const PAGE_CONTENT_FETCH_LIMIT = 8;

const DEFAULT_SEARCH_OPTIONS: Required<WebSearchOptions> = {
  includePageContent: true,
  maxResults: 6,
  pageContentLength: 1200,
  recencyDays: 0,
  requireFreshness: false,
  trustedFreshDomains: [],
  maxSearchEngines: 4,
  enableFallbackSearch: true,
  alwaysRunFallbackSearch: false,
};

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

function summarizeSearchError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? ` status=${error.response.status}` : '';
    const code = error.code ? ` code=${error.code}` : '';
    return `${error.message}${status}${code}`.trim();
  }

  return error instanceof Error ? error.message : String(error);
}

function logSearchWarning(engine: string, error: unknown): void {
  console.warn(`[Web Search] ${engine} unavailable: ${summarizeSearchError(error)}`);
}

function cleanSearchQuery(query: string): string {
  return query
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(
      /^(请帮我|帮我|我想|麻烦|请你|可以帮我|帮忙)?(搜索|查一下|查询|找一下|了解一下|看看|研究一下)\s*/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanYahooUrl(link: string): string {
  if (!link.includes('/RU=')) return link;

  const match = link.match(/\/RU=([^/]+)/);
  if (!match?.[1]) return link;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return link;
  }
}

/**
 * Attempts to extract the real target URL from known search-engine redirect wrappers
 * (Baidu /link?url=, Sogou /link?url=, 360 /link?m=). Falls back to the original link
 * if it cannot decode or if the link is not a recognised redirect format.
 *
 * NOTE: This does NOT make a network request — it only decodes the encoded URL embedded
 * in the redirect query parameter.
 */
function cleanRedirectUrl(link: string, engineDomain: string): string {
  try {
    const url = new URL(link);
    if (!url.hostname.includes(engineDomain)) return link;

    // Baidu: https://www.baidu.com/link?url=<base64-like>
    // Sogou: https://www.sogou.com/link?url=<encoded>
    // 360:   https://www.so.com/link?m=<encoded>
    const encoded = url.searchParams.get('url') || url.searchParams.get('m');
    if (!encoded) return link;

    const decoded = decodeURIComponent(encoded);
    // Validate it looks like a real URL before trusting it
    const target = new URL(decoded);
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      return decoded;
    }
  } catch {
    // Ignore – return original
  }
  return link;
}

function normalizeUrl(link: string): string {
  try {
    const url = new URL(link);
    url.hash = '';
    return url.toString();
  } catch {
    return link.trim();
  }
}

function getDomain(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const normalized = normalizeUrl(result.link);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    deduped.push({
      ...result,
      link: normalized,
      domain: result.domain || getDomain(normalized),
    });
  }

  return deduped;
}

function parseDateCandidate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return undefined;
}

function inferPublishedAt(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) continue;

    const isoMatch = value.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2];
      const day = isoMatch[3];
      if (!year || !month || !day) continue;
      const parsed = parseDateCandidate(
        `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      );
      if (parsed) return parsed;
    }

    const monthMatch = value.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+20\d{2}\b/i,
    );
    if (monthMatch) {
      const parsed = parseDateCandidate(monthMatch[0]);
      if (parsed) return parsed;
    }
  }

  return undefined;
}

function isTrustedFreshDomain(domain: string, trustedFreshDomains: string[]): boolean {
  const normalizedDomain = domain.toLowerCase();
  return trustedFreshDomains.some((trustedDomain) => {
    const normalizedTrusted = trustedDomain.toLowerCase();
    return (
      normalizedDomain === normalizedTrusted || normalizedDomain.endsWith(`.${normalizedTrusted}`)
    );
  });
}

function isFreshEnough(
  result: SearchResult,
  recencyDays: number,
  requireFreshness: boolean,
  trustedFreshDomains: string[],
): boolean {
  if (!recencyDays) return true;

  if (!result.publishedAt) {
    return !requireFreshness || isTrustedFreshDomain(result.domain, trustedFreshDomains);
  }

  const publishedTime = new Date(result.publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return false;

  const cutoffTime = Date.now() - recencyDays * 24 * 60 * 60 * 1000;
  return publishedTime >= cutoffTime;
}

async function fetchPageContent(
  url: string,
  maxLength: number,
): Promise<{ content: string; publishedAt?: string }> {
  // 1. Try Jina Reader first (bypasses Cloudflare, parses JS, returns clean text/markdown)
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await axios.get(jinaUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: 'text/plain, text/markdown',
      },
      timeout: 6000,
    });

    if (response.data && typeof response.data === 'string') {
      const cleanedText = response.data.replace(/\s+/g, ' ').trim();
      if (cleanedText.length > 150) {
        return {
          content: cleanedText.slice(0, maxLength),
          publishedAt: inferPublishedAt(cleanedText),
        };
      }
    }
  } catch (err) {
    console.warn(
      `[Web Search] Jina Reader failed for ${url}, falling back to direct scraper: ${summarizeSearchError(err)}`,
    );
  }

  // 2. Fallback to direct axios/cheerio scraper
  try {
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 5000,
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'];
    if (typeof contentType !== 'string' || !contentType.includes('text/html')) {
      return { content: '' };
    }

    const $ = cheerio.load(response.data);
    const publishedAt = inferPublishedAt(
      $('meta[property="article:published_time"]').attr('content'),
      $('meta[name="pubdate"]').attr('content'),
      $('meta[name="publishdate"]').attr('content'),
      $('meta[name="date"]').attr('content'),
      $('time[datetime]').first().attr('datetime'),
      $('time').first().text(),
    );

    $('script, style, nav, footer, iframe, header, noscript').remove();

    const mainText =
      $('article').first().text() ||
      $('main').first().text() ||
      $('#content').first().text() ||
      $('.content').first().text() ||
      $('body').text();

    return {
      content: mainText.replace(/\s+/g, ' ').trim().slice(0, maxLength),
      publishedAt,
    };
  } catch {
    return { content: '' };
  }
}

async function performYahooSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const fetchPage = async (start: number) => {
    try {
      const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}${start > 1 ? `&b=${start}` : ''}`;
      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 8000,
      });

      const $ = cheerio.load(response.data);
      $('.compTitle').each((_, element) => {
        if (results.length >= maxResults) return false;

        const anchor = $(element).find('a').first();
        if (!anchor.length) return;

        const rawLink = anchor.attr('href') || '';
        const link = cleanYahooUrl(rawLink);
        const title = anchor.find('h3').text().trim() || anchor.text().trim();

        const container = $(element).closest('.dd, .algo-sr, li, .web-res');
        const snippet = (
          container.find('.compText').text().trim() || $(element).next('.compText').text().trim()
        ).replace(/\s+/g, ' ');

        if (!title || !link || link.includes('search.yahoo.com')) return;

        results.push({
          title,
          link,
          snippet,
          domain: getDomain(link),
          publishedAt: inferPublishedAt(title, snippet),
        });
      });
    } catch (error) {
      logSearchWarning(`Yahoo start=${start}`, error);
    }
  };

  await fetchPage(1);
  if (results.length < maxResults && maxResults > 10) {
    await fetchPage(11);
  }

  return results;
}

async function performAskSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const fetchPage = async (page: number) => {
    try {
      const url = `https://www.ask.com/web?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 5000,
      });

      const $ = cheerio.load(response.data);
      $('.web-result').each((_, element) => {
        if (results.length >= maxResults) return false;

        const titleNode = $(element).find('.web-result-title').first();
        const title = titleNode.text().trim();
        const link = titleNode.attr('href') || '';
        const snippet = $(element)
          .find('.web-result-description')
          .text()
          .trim()
          .replace(/\s+/g, ' ');

        if (!title || !link || link.includes('ask.com')) return;

        results.push({
          title,
          link,
          snippet,
          domain: getDomain(link),
          publishedAt: inferPublishedAt(title, snippet),
        });
      });
    } catch (error) {
      logSearchWarning(`Ask page=${page}`, error);
    }
  };

  await fetchPage(1);
  if (results.length < maxResults && maxResults > 10) {
    await fetchPage(2);
  }

  return results;
}

function cleanDuckDuckGoUrl(link: string): string {
  if (link.includes('uddg=')) {
    const match = link.match(/[?&]uddg=([^&]+)/);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return link;
      }
    }
  }
  return link;
}

async function performDuckDuckGoSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.result').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('.result__title a').first();
      if (!anchor.length) return;

      const rawLink = anchor.attr('href') || '';
      const link = cleanDuckDuckGoUrl(rawLink);
      const title = anchor.text().trim();
      const snippet = $(element).find('.result__snippet').text().trim().replace(/\s+/g, ' ');

      if (!title || !link || link.includes('duckduckgo.com')) return;

      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('DuckDuckGo', error);
  }
  return results;
}

async function performEcosiaSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const fetchPage = async (page: number) => {
    try {
      const url = `https://www.ecosia.org/search?q=${encodeURIComponent(query)}${page > 1 ? `&p=${page - 1}` : ''}`;
      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 6000,
      });

      const $ = cheerio.load(response.data);
      $('.result, [data-test-id="result"]').each((_, element) => {
        if (results.length >= maxResults) return false;

        const anchor = $(element).find('a.result-title, .result__title a, h2 a').first();
        if (!anchor.length) return;

        const link = anchor.attr('href') || '';
        const title = anchor.text().trim();
        const snippet = $(element)
          .find('.result-snippet, .result__snippet, p')
          .text()
          .trim()
          .replace(/\s+/g, ' ');

        if (!title || !link || link.includes('ecosia.org')) return;

        results.push({
          title,
          link,
          snippet,
          domain: getDomain(link),
          publishedAt: inferPublishedAt(title, snippet),
        });
      });
    } catch (error) {
      logSearchWarning('Ecosia', error);
    }
  };

  await fetchPage(1);
  if (results.length < maxResults && maxResults > 10) {
    await fetchPage(2);
  }
  return results;
}

async function performBingSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const fetchPage = async (page: number) => {
    try {
      const first = (page - 1) * 10 + 1;
      const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&first=${first}`;
      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 6000,
      });

      const $ = cheerio.load(response.data);
      $('.b_algo').each((_, element) => {
        if (results.length >= maxResults) return false;

        const anchor = $(element).find('h2 a').first();
        if (!anchor.length) return;

        const link = anchor.attr('href') || '';
        const title = anchor.text().trim();
        const snippet = $(element)
          .find('.b_caption p, .b_lineclamp, .b_algoSlug, p')
          .text()
          .trim()
          .replace(/\s+/g, ' ');

        if (!title || !link || link.includes('bing.com')) return;

        results.push({
          title,
          link,
          snippet,
          domain: getDomain(link),
          publishedAt: inferPublishedAt(title, snippet),
        });
      });
    } catch (error) {
      logSearchWarning('Bing', error);
    }
  };

  await fetchPage(1);
  if (results.length < maxResults && maxResults > 10) {
    await fetchPage(2);
  }
  return results;
}

async function performBaiduSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.result, .c-container').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('h3 a, h3.t a, .t a').first();
      if (!anchor.length) return;

      const rawLink = anchor.attr('href') || '';
      const title = anchor.text().trim();

      let snippet = $(element)
        .find('.c-abstract, .content-right_87W7x, .c-span18, .c-span24')
        .text()
        .trim();
      if (!snippet) {
        const temp = $(element).clone();
        temp.find('h3, style, script, .op-se-share, .c-recommend').remove();
        snippet = temp.text().trim();
      }
      snippet = snippet.replace(/\s+/g, ' ');

      if (!title || !rawLink) return;
      // Allow only baidu redirect links (which encode the real destination)
      if (rawLink.includes('baidu.com') && !rawLink.includes('baidu.com/link')) return;

      // Attempt to decode the real destination URL so domain scoring is accurate
      const link = cleanRedirectUrl(rawLink, 'baidu.com');
      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('Baidu', error);
  }
  return results;
}

async function performSogouSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.rb, .results > div, .vrwrap, .vr-title').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('h3 a, .vr-title a, a').first();
      if (!anchor.length) return;

      const rawLink = anchor.attr('href') || '';
      const title = anchor.text().trim();
      let snippet = $(element).find('.space-txt, .abstract, p').text().trim();
      if (!snippet) {
        const temp = $(element).clone();
        temp.find('h3, style, script, .vr-title, a').remove();
        snippet = temp.text().trim();
      }
      snippet = snippet.replace(/\s+/g, ' ');

      if (!title || !rawLink) return;
      if (rawLink.includes('sogou.com') && !rawLink.includes('sogou.com/link')) return;

      const absoluteLink = rawLink.startsWith('/') ? `https://www.sogou.com${rawLink}` : rawLink;
      // Attempt to decode the real destination URL so domain scoring is accurate
      const link = cleanRedirectUrl(absoluteLink, 'sogou.com');
      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('Sogou', error);
  }
  return results;
}

async function perform360Search(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://www.so.com/s?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.res-list, .result, li.res-list').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('h3 a, h3.title a, .res-title a').first();
      if (!anchor.length) return;

      const rawLink = anchor.attr('href') || '';
      const title = anchor.text().trim();
      let snippet = $(element).find('.res-desc, .abstract, p').text().trim();
      if (!snippet) {
        const temp = $(element).clone();
        temp.find('h3, style, script').remove();
        snippet = temp.text().trim();
      }
      snippet = snippet.replace(/\s+/g, ' ');

      if (!title || !rawLink || (rawLink.includes('so.com') && !rawLink.includes('so.com/link')))
        return;

      // Attempt to decode the real destination URL so domain scoring is accurate
      const link = cleanRedirectUrl(rawLink, 'so.com');
      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('360', error);
  }
  return results;
}

async function performBraveSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.snippet, .result, div[class*="result"]').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('a.title, h2 a, h3 a, a').first();
      if (!anchor.length) return;

      const link = anchor.attr('href') || '';
      const title = anchor.text().trim();
      let snippet = $(element).find('.snippet-description, .snippet-content, p').text().trim();
      if (!snippet) {
        const temp = $(element).clone();
        temp.find('h2, h3, style, script, a').remove();
        snippet = temp.text().trim();
      }
      snippet = snippet.replace(/\s+/g, ' ');

      if (!title || !link || link.startsWith('/') || link.includes('brave.com')) return;

      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('Brave', error);
  }
  return results;
}

async function performGoogleSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
      timeout: 6000,
    });

    const $ = cheerio.load(response.data);
    $('.g, .jhp').each((_, element) => {
      if (results.length >= maxResults) return false;

      const anchor = $(element).find('a').first();
      const titleNode = $(element).find('h3').first();
      if (!anchor.length || !titleNode.length) return;

      const link = anchor.attr('href') || '';
      const title = titleNode.text().trim();
      const snippet = $(element)
        .find('.VwiC3b, .yDYN2d, .s3U0Mr, .IsZvec')
        .text()
        .trim()
        .replace(/\s+/g, ' ');

      if (!title || !link || link.startsWith('/') || link.includes('google.com')) return;

      results.push({
        title,
        link,
        snippet,
        domain: getDomain(link),
        publishedAt: inferPublishedAt(title, snippet),
      });
    });
  } catch (error) {
    logSearchWarning('Google', error);
  }
  return results;
}

export async function performWebSearch(
  rawQuery: string,
  options: WebSearchOptions = {},
): Promise<SearchResult[]> {
  const query = cleanSearchQuery(rawQuery);
  if (!query) return [];

  const mergedOptions = {
    ...DEFAULT_SEARCH_OPTIONS,
    ...options,
  };

  const hasChinese = /[\u4e00-\u9fa5]/.test(query);

  type SearchRunner = () => Promise<SearchResult[]>;
  let primarySearches: SearchRunner[];
  let fallbackSearches: SearchRunner[];

  if (hasChinese) {
    // Chinese query optimization: prefer engines that are more stable in server-side scraping.
    primarySearches = [
      () => performBingSearch(query, mergedOptions.maxResults),
      () => performYahooSearch(query, mergedOptions.maxResults),
      () => performDuckDuckGoSearch(query, mergedOptions.maxResults),
      () => performBaiduSearch(query, mergedOptions.maxResults),
    ];
    fallbackSearches = [
      () => performSogouSearch(query, mergedOptions.maxResults),
      () => performAskSearch(query, mergedOptions.maxResults),
      () => perform360Search(query, mergedOptions.maxResults),
    ];
  } else {
    // English/general query optimization: avoid noisy engines unless we need fallbacks.
    primarySearches = [
      () => performBingSearch(query, mergedOptions.maxResults),
      () => performYahooSearch(query, mergedOptions.maxResults),
      () => performDuckDuckGoSearch(query, mergedOptions.maxResults),
      () => performGoogleSearch(query, mergedOptions.maxResults),
    ];
    fallbackSearches = [
      () => performAskSearch(query, mergedOptions.maxResults),
      () => performBraveSearch(query, mergedOptions.maxResults),
      () => performEcosiaSearch(query, mergedOptions.maxResults),
    ];
  }

  primarySearches = primarySearches.slice(0, mergedOptions.maxSearchEngines);
  fallbackSearches = fallbackSearches.slice(0, Math.max(1, mergedOptions.maxSearchEngines - 1));

  const primaryRuns = await Promise.allSettled(primarySearches.map((runSearch) => runSearch()));
  let results: SearchResult[] = primaryRuns.flatMap((run) =>
    run.status === 'fulfilled' ? run.value : [],
  );

  results = dedupeResults(results);

  // If we don't have enough results, query fallbacks in parallel
  if (
    mergedOptions.enableFallbackSearch &&
    (mergedOptions.alwaysRunFallbackSearch || results.length < mergedOptions.maxResults)
  ) {
    const fallbackRuns = await Promise.allSettled(fallbackSearches.map((runSearch) => runSearch()));
    const fallbackResults = fallbackRuns.flatMap((run) =>
      run.status === 'fulfilled' ? run.value : [],
    );
    results.push(...fallbackResults);
    results = dedupeResults(results);
  }

  if (!mergedOptions.includePageContent || results.length === 0) {
    return results.slice(0, mergedOptions.maxResults);
  }

  const candidateResults = results.slice(
    0,
    Math.max(mergedOptions.maxResults * 2, mergedOptions.maxResults),
  );

  await Promise.allSettled(
    candidateResults
      .slice(0, Math.min(PAGE_CONTENT_FETCH_LIMIT, candidateResults.length))
      .map(async (result) => {
        const page = await fetchPageContent(result.link, mergedOptions.pageContentLength);
        if (page.content) {
          result.content = page.content;
        }
        if (!result.publishedAt && page.publishedAt) {
          result.publishedAt = page.publishedAt;
        }
      }),
  );

  return candidateResults
    .filter((result) =>
      isFreshEnough(
        result,
        mergedOptions.recencyDays,
        mergedOptions.requireFreshness,
        mergedOptions.trustedFreshDomains,
      ),
    )
    .slice(0, mergedOptions.maxResults);
}

export function formatSearchResultsAsPrompt(results: SearchResult[], title: string): string {
  if (results.length === 0) {
    return '';
  }

  const lines = [`${title}`];

  results.forEach((result, index) => {
    lines.push(
      `[${index + 1}] ${result.title}`,
      `URL: ${result.link}`,
      `Domain: ${result.domain || 'unknown'}`,
      result.publishedAt ? `Published: ${result.publishedAt.slice(0, 10)}` : 'Published: unknown',
      `Summary: ${result.snippet || 'No summary available.'}`,
    );

    if (result.content) {
      lines.push(`Excerpt: ${result.content}`);
    }

    lines.push('');
  });

  return lines.join('\n').trim();
}

const EASTMONEY_MAIN_INDEX_SECIDS = [
  { secid: '1.000001', name: '上证指数', link: 'https://quote.eastmoney.com/zs000001.html' },
  { secid: '0.399001', name: '深证成指', link: 'https://quote.eastmoney.com/zs399001.html' },
  { secid: '0.399006', name: '创业板指', link: 'https://quote.eastmoney.com/zs399006.html' },
  { secid: '1.000300', name: '沪深300', link: 'https://quote.eastmoney.com/zs000300.html' },
  { secid: '1.000905', name: '中证500', link: 'https://quote.eastmoney.com/zs000905.html' },
];

export async function fetchAshareMarketSnapshot(): Promise<SearchResult[]> {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get';
    const response = await axios.get(url, {
      params: {
        fltt: 2,
        secids: EASTMONEY_MAIN_INDEX_SECIDS.map((item) => item.secid).join(','),
        fields: 'f12,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18',
      },
      headers: DEFAULT_HEADERS,
      timeout: 5000,
    });

    const rows = response.data?.data?.diff;
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const lines = rows.map((row: Record<string, unknown>) => {
      const code = String(row.f12 || '');
      const name = String(row.f14 || '');
      const latest = row.f2 ?? 'N/A';
      const change = row.f4 ?? 'N/A';
      const pct = row.f3 ?? 'N/A';
      const open = row.f17 ?? 'N/A';
      const prevClose = row.f18 ?? 'N/A';
      const high = row.f15 ?? 'N/A';
      const low = row.f16 ?? 'N/A';
      return `${name}(${code}) 最新=${latest}, 涨跌=${change}, 涨跌幅=${pct}%, 今开=${open}, 昨收=${prevClose}, 最高=${high}, 最低=${low}`;
    });

    return [
      {
        title: '东方财富 A股主要指数实时行情快照',
        link: 'https://quote.eastmoney.com/center/gridlist.html#hszs',
        domain: 'quote.eastmoney.com',
        publishedAt: new Date().toISOString(),
        snippet: lines.join('；'),
        content: [
          '数据来源：东方财富行情中心主要 A 股指数实时行情接口。',
          '该数据用于提供研究时点的市场基准，不构成投资建议。',
          ...lines,
        ].join('\n'),
      },
    ];
  } catch (error) {
    logSearchWarning('Eastmoney market snapshot', error);
    return [];
  }
}
