import axios from 'axios';
import * as cheerio from 'cheerio';
import { performWebSearch } from './search.service';
import { callLLMWithFailover } from './ai.service';
import { logger } from '../utils/logger';

export interface ExternalSearchResult {
  title: string;
  link: string;
  snippet: string;
  site: string;
}

export interface ExternalSearchResponse {
  aiAnalysis: string;
  results: Record<string, ExternalSearchResult[]>;
}

/**
 * Scrapes/searches Blender resources from 6 major platforms:
 * 1. extensions.blender.org (API + local search)
 * 2. www.blenderx.cn (HTTP GET + Cheerio)
 * 3. budeco.top (Fallback site search via performWebSearch)
 * 4. superhivemarket.com (Fallback site search via performWebSearch)
 * 5. www.gfxcamp.com (HTTP GET + Cheerio)
 * 6. www.blendermx.com (HTTP GET + Cheerio)
 */

// 1. extensions.blender.org
async function searchBlenderExtensions(query: string): Promise<ExternalSearchResult[]> {
  try {
    const res = await fetch('https://extensions.blender.org/api/v1/extensions/');
    if (!res.ok) {
      throw new Error(`extensions.blender.org API responded with status ${res.status}`);
    }
    const json = (await res.json()) as { version: string; data: any[] };
    if (!json.data || !Array.isArray(json.data)) return [];

    const keyword = query.toLowerCase().trim();
    const matches = json.data.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const tagline = (item.tagline || '').toLowerCase();
      const tags: string[] = Array.isArray(item.tags)
        ? item.tags.map((t: string) => t.toLowerCase())
        : [];
      return (
        name.includes(keyword) ||
        tagline.includes(keyword) ||
        tags.some((t: string) => t.includes(keyword))
      );
    });

    return matches.slice(0, 10).map((item) => {
      const typePlural = item.type === 'add-on' ? 'add-ons' : 'themes';
      return {
        title: `[${item.type}] ${item.name} - ${item.tagline || ''}`,
        link: `https://extensions.blender.org/${typePlural}/${item.id}/`,
        snippet: `Version: ${item.version || ''}. Maintainer: ${item.maintainer || ''}. License: ${item.license || ''}. Tags: ${(item.tags || []).join(', ')}`,
        site: 'extensions.blender.org',
      };
    });
  } catch (err: any) {
    logger.error(`[External Search] extensions.blender.org search error: ${err.message}`);
    return [];
  }
}

// 2. www.blenderx.cn
async function searchBlenderX(query: string): Promise<ExternalSearchResult[]> {
  try {
    const res = await axios.get(`https://www.blenderx.cn/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 4000,
    });
    const $ = cheerio.load(res.data);
    const results: ExternalSearchResult[] = [];

    $('.post.grid')
      .slice(0, 10)
      .each((i, el) => {
        const titleEl = $(el).find('h3 a');
        const title = titleEl.attr('title') || titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const snippet = $(el).find('.excerpt').text().trim();
        if (title && link) {
          results.push({
            title,
            link,
            snippet,
            site: 'www.blenderx.cn',
          });
        }
      });

    return results;
  } catch (err: any) {
    logger.error(`[External Search] blenderx.cn search error: ${err.message}`);
    return [];
  }
}

// 3. budeco.top (Fallback site search)
async function searchBudeco(query: string): Promise<ExternalSearchResult[]> {
  try {
    const results = await performWebSearch(`site:budeco.top ${query}`, {
      maxResults: 6,
      includePageContent: false,
      maxSearchEngines: 2,
      enableFallbackSearch: false,
    });
    return results
      .filter((r) => r.link.includes('budeco.top'))
      .map((r) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        site: 'budeco.top',
      }));
  } catch (err: any) {
    logger.error(`[External Search] budeco.top search error: ${err.message}`);
    return [];
  }
}

export function normalizeResourceUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  try {
    const urlObj = new URL(urlStr);
    
    // 处理 superhivemarket / blendermarket 的 /products/slug 子路径
    if (urlObj.hostname.includes('superhivemarket.com') || urlObj.hostname.includes('blendermarket.com')) {
      const match = urlObj.pathname.match(/^(\/products\/[^\/]+)/);
      if (match && match[1]) {
        return `${urlObj.origin}${match[1]}`;
      }
    }
    
    // 清除常见的子功能后缀: /ratings, /docs, /changelog, /reviews, /comments, /faq
    let cleanPath = urlObj.pathname.replace(/\/(ratings|docs|changelog|reviews|comments|faq|discussion)\/?$/i, '');
    cleanPath = cleanPath.replace(/\/+$/, '');
    
    return `${urlObj.origin}${cleanPath}`;
  } catch {
    return urlStr;
  }
}

// 4. superhivemarket.com (Fallback site search)
async function searchSuperHive(query: string): Promise<ExternalSearchResult[]> {
  try {
    const results = await performWebSearch(`site:superhivemarket.com ${query}`, {
      maxResults: 10,
      includePageContent: false,
      maxSearchEngines: 2,
      enableFallbackSearch: false,
    });
    
    const uniqueMap = new Map<string, ExternalSearchResult>();

    results
      .filter((r) => r.link.includes('superhivemarket.com') || r.link.includes('blendermarket.com'))
      .forEach((r) => {
        const normalizedLink = normalizeResourceUrl(r.link);
        if (!uniqueMap.has(normalizedLink)) {
          // 清理标题中的多余后缀
          let cleanTitle = r.title
            .replace(/\s*-\s*Ratings\s*-\s*Superhive.*/i, '')
            .replace(/\s*-\s*Docs\s*-\s*Superhive.*/i, '')
            .replace(/\s*-\s*Changelog\s*-\s*Superhive.*/i, '');

          uniqueMap.set(normalizedLink, {
            title: cleanTitle,
            link: normalizedLink,
            snippet: r.snippet,
            site: 'superhivemarket.com',
          });
        }
      });

    return Array.from(uniqueMap.values());
  } catch (err: any) {
    logger.error(`[External Search] superhivemarket.com search error: ${err.message}`);
    return [];
  }
}

// 5. www.gfxcamp.com
async function searchGfxCamp(query: string): Promise<ExternalSearchResult[]> {
  try {
    const res = await axios.get(`https://www.gfxcamp.com/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 4000,
    });
    const $ = cheerio.load(res.data);
    const results: ExternalSearchResult[] = [];

    $('article, .post, .grid-item')
      .slice(0, 10)
      .each((i, el) => {
        const titleEl = $(el).find('.entry-title a, h2 a, .post-title a').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        let snippet = $(el).find('.entry-summary, .entry-content, p').text().trim();
        if (snippet.length > 200) {
          snippet = snippet.substring(0, 200) + '...';
        }
        if (title && link) {
          results.push({
            title,
            link,
            snippet,
            site: 'www.gfxcamp.com',
          });
        }
      });

    // Fallback Cheerio parse for h2 links
    if (results.length === 0) {
      $('h2 a')
        .slice(0, 10)
        .each((i, el) => {
          const title = $(el).text().trim();
          const link = $(el).attr('href') || '';
          if (title && link) {
            results.push({
              title,
              link,
              snippet: '',
              site: 'www.gfxcamp.com',
            });
          }
        });
    }

    return results;
  } catch (err: any) {
    logger.error(`[External Search] gfxcamp.com search error: ${err.message}`);
    return [];
  }
}

// 6. www.blendermx.com
async function searchBlenderMX(query: string): Promise<ExternalSearchResult[]> {
  try {
    const res = await axios.get(`https://www.blendermx.com/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 4000,
    });
    const $ = cheerio.load(res.data);
    const results: ExternalSearchResult[] = [];

    $('.post.grid')
      .slice(0, 10)
      .each((i, el) => {
        const titleEl = $(el).find('h3 a');
        const title = titleEl.attr('title') || titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const snippet = $(el).find('.excerpt').text().trim();
        if (title && link) {
          results.push({
            title,
            link,
            snippet,
            site: 'www.blendermx.com',
          });
        }
      });

    return results;
  } catch (err: any) {
    logger.error(`[External Search] blendermx.com search error: ${err.message}`);
    return [];
  }
}

/**
 * Searches all 6 websites in parallel and feeds results to the LLM for summary & curation.
 */
export async function searchAndAnalyze(query: string): Promise<ExternalSearchResponse> {
  const keyword = query.trim();
  if (!keyword) {
    return {
      aiAnalysis: '请输入搜索关键词。',
      results: {},
    };
  }

  // Concurrent searches
  const [extRes, bxRes, budecoRes, superRes, gfxRes, mxRes] = await Promise.allSettled([
    searchBlenderExtensions(keyword),
    searchBlenderX(keyword),
    searchBudeco(keyword),
    searchSuperHive(keyword),
    searchGfxCamp(keyword),
    searchBlenderMX(keyword),
  ]);

  const results: Record<string, ExternalSearchResult[]> = {
    'extensions.blender.org': extRes.status === 'fulfilled' ? extRes.value : [],
    'www.blenderx.cn': bxRes.status === 'fulfilled' ? bxRes.value : [],
    'budeco.top': budecoRes.status === 'fulfilled' ? budecoRes.value : [],
    'superhivemarket.com': superRes.status === 'fulfilled' ? superRes.value : [],
    'www.gfxcamp.com': gfxRes.status === 'fulfilled' ? gfxRes.value : [],
    'www.blendermx.com': mxRes.status === 'fulfilled' ? mxRes.value : [],
  };

  const hasResults = Object.values(results).some((list) => list.length > 0);

  if (!hasResults) {
    return {
      aiAnalysis: `没有在任何合作网站中找到与 “${keyword}” 相关的直接资源。您可以尝试更换关键词，或者点击弹框下方的网站图标直接进入对应站点搜索。`,
      results,
    };
  }

  // Format matches for LLM prompt
  const formattedResults = Object.entries(results)
    .filter(([, list]) => list.length > 0)
    .map(([site, list]) => {
      const itemsText = list
        .map(
          (item, idx) => `  ${idx + 1}. [${item.title}](${item.link})\n     描述: ${item.snippet}`,
        )
        .join('\n');
      return `### ${site}\n${itemsText}`;
    })
    .join('\n\n');

  const systemPrompt = `你是一个专业的 3D 数字化设计与技术资源推荐助手。你的任务是分析从各大 Blender 资源网站爬取到的检索结果，并为用户归纳提炼出最匹配、最有价值的资源链接。
你必须遵守以下输出规则以保障快速而精炼的输出：
1. 快速提炼并以最精简、清晰的段落和列表进行整理，优先推荐最相关的 2-4 个优质链接。
2. 避免冗长的开场白和结语，让整个回复结构紧凑，以显著缩短生成字数和延迟。
3. 筛选出最符合用户搜索词的推荐链接，必须在 Markdown 中直接以 [资源名称](链接地址) 形式输出超链接，方便用户点击跳转。
4. 给出推荐理由（例如：官方免费、功能强大、汉化资源、包含工程文件、有使用教程等）。
5. 结构清晰，排版美观，使用 Markdown 格式。不要输出系统密钥、敏感配置或无用废话。`;

  const prompt = `用户正在寻找的 3D/Blender 资源关键词是："${keyword}"

以下是各大 Blender 资源网站上实时检索到的结果：

${formattedResults}

请帮用户对这些结果进行分析与提炼，给出最推荐的资源链接及推荐原因。`;

  let aiAnalysis: string;
  try {
    aiAnalysis = await callLLMWithFailover(prompt, systemPrompt);
  } catch (err: any) {
    logger.error(`[External Search] AI analysis failover error: ${err.message}`);
    aiAnalysis =
      `资源抓取成功，但 AI 分析暂时不可用。以下是检索到的推荐链接：\n\n` +
      Object.entries(results)
        .filter(([, list]) => list.length > 0)
        .map(([site, list]) => {
          return (
            `**${site}**:\n` + list.map((item) => `- [${item.title}](${item.link})`).join('\n')
          );
        })
        .join('\n\n');
  }

  return {
    aiAnalysis,
    results,
  };
}
