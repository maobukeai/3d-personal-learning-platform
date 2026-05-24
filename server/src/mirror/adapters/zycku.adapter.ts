import {
  BaseAdapter,
  RawCategory,
  RawResource,
  RawResourcePage,
  AdapterConfig,
} from './base.adapter';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

interface WpApiPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  link: string;
  date: string;
  modified: string;
  categories: number[];
  tags: number[];
  featured_media: number;
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    'wp:term'?: Array<Array<{ id: number; name: string; slug: string }>>;
  };
}

interface WpApiCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

export class ZyckuAdapter extends BaseAdapter {
  private restApiAvailable: boolean | null = null;
  private restApiBase: string;

  constructor(config: AdapterConfig) {
    super({ ...config, baseUrl: config.baseUrl.replace(/\/+$/, '') });
    this.restApiBase = `${this.config.baseUrl}/wp-json/wp/v2`;
  }

  private async checkRestApi(signal?: AbortSignal): Promise<boolean> {
    if (this.restApiAvailable !== null) return this.restApiAvailable;
    try {
      const res = await this.withRetry(
        () =>
          fetch(`${this.restApiBase}/posts?per_page=1`, {
            headers: { 'User-Agent': this.userAgent },
            signal: signal || AbortSignal.timeout(8000),
          }),
        1,
      );
      this.restApiAvailable = res.ok;
    } catch {
      this.restApiAvailable = false;
    }
    console.log(`[ZyckuAdapter] REST API available: ${this.restApiAvailable}`);
    return this.restApiAvailable;
  }

  async fetchCategories(signal?: AbortSignal): Promise<RawCategory[]> {
    const apiAvailable = await this.checkRestApi(signal);
    if (apiAvailable) {
      try {
        return await this.fetchCategoriesViaApi(signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        console.warn(
          `[ZyckuAdapter] REST API categories failed, falling back to HTML: ${e instanceof Error ? e.message : String(e)}`,
        );
        this.restApiAvailable = false;
      }
    }
    return this.fetchCategoriesViaHtml(signal);
  }

  private async fetchCategoriesViaApi(signal?: AbortSignal): Promise<RawCategory[]> {
    const categories: RawCategory[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${this.restApiBase}/categories?per_page=100&page=${page}&hide_empty=true`;
      const res = await this.withRetry(() =>
        fetch(url, {
          headers: { 'User-Agent': this.userAgent },
          signal: signal || AbortSignal.timeout(15000),
        }),
      );
      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const data: WpApiCategory[] = await res.json();
      if (data.length === 0) {
        break;
      }

      for (const cat of data) {
        categories.push({
          externalId: String(cat.id),
          name: cat.name,
          slug: cat.slug,
          parentExternalId: cat.parent > 0 ? String(cat.parent) : undefined,
        });
      }

      const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
      hasMore = page < totalPages;
      page++;
    }

    return categories;
  }

  private async fetchCategoriesViaHtml(signal?: AbortSignal): Promise<RawCategory[]> {
    const html = await this.fetchHtml(this.config.baseUrl, signal);
    const $ = this.parseHtml(html);

    const categories: RawCategory[] = [];
    const seen = new Set<string>();

    $('a[href*="/category/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const name = $el.text().trim();

      if (!name || !href || name === '视频教程') return;

      let slug: string;
      try {
        const url = new URL(href, this.config.baseUrl);
        const match = url.pathname.match(/\/category\/(.+)/);
        slug = match?.[1] || '';
      } catch {
        slug = '';
      }

      if (!slug) return;

      const externalId = slug;
      if (seen.has(externalId)) return;
      seen.add(externalId);

      categories.push({ externalId, name, slug: slug || undefined });
    });

    if (categories.length === 0) {
      return [
        { externalId: 'course', name: '视频教程', slug: 'course' },
        { externalId: 'course/modeling', name: '建模渲染', slug: 'course/modeling' },
        { externalId: 'course/animation', name: '动画动效', slug: 'course/animation' },
        { externalId: 'course/aigc', name: 'AIGC', slug: 'course/aigc' },
        { externalId: 'course/illustration', name: '绘画插画', slug: 'course/illustration' },
        { externalId: 'course/design', name: '平面设计', slug: 'course/design' },
        { externalId: 'course/photography', name: '摄影修图', slug: 'course/photography' },
        { externalId: 'model', name: '3D模型', slug: 'model' },
        { externalId: 'texture', name: '材质贴图', slug: 'texture' },
        { externalId: 'software', name: '常用软件', slug: 'software' },
      ];
    }

    return categories;
  }

  async fetchResources(
    page: number,
    categorySlug?: string,
    signal?: AbortSignal,
  ): Promise<RawResourcePage> {
    const apiAvailable = await this.checkRestApi(signal);
    if (apiAvailable) {
      try {
        return await this.fetchResourcesViaApi(page, categorySlug, signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        console.warn(
          `[ZyckuAdapter] REST API resources failed, falling back to HTML: ${e instanceof Error ? e.message : String(e)}`,
        );
        this.restApiAvailable = false;
      }
    }
    return this.fetchResourcesViaHtml(page, categorySlug, signal);
  }

  private async fetchResourcesViaApi(
    page: number,
    categorySlug?: string,
    signal?: AbortSignal,
  ): Promise<RawResourcePage> {
    const params = new URLSearchParams({
      per_page: '20',
      page: String(page),
      orderby: 'date',
      order: 'desc',
      _embed: '1',
    });

    if (categorySlug) {
      const catUrl = `${this.restApiBase}/categories?slug=${encodeURIComponent(categorySlug)}`;
      const catRes = await this.withRetry(() =>
        fetch(catUrl, {
          headers: { 'User-Agent': this.userAgent },
          signal: signal || AbortSignal.timeout(10000),
        }),
      );
      if (catRes.ok) {
        const cats: WpApiCategory[] = await catRes.json();
        if (cats.length > 0) {
          params.set('categories', String(cats[0]!.id));
        }
      }
    }

    const url = `${this.restApiBase}/posts?${params.toString()}`;
    const res = await this.withRetry(() =>
      fetch(url, {
        headers: { 'User-Agent': this.userAgent },
        signal: signal || AbortSignal.timeout(15000),
      }),
    );

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const posts: WpApiPost[] = await res.json();
    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
    const totalItems = parseInt(res.headers.get('X-WP-Total') || '0', 10);

    const resources: RawResource[] = posts.map((post) => this.wpPostToRawResource(post));

    return { resources, currentPage: page, totalPages, totalItems };
  }

  private async fetchResourcesViaHtml(
    page: number,
    categorySlug?: string,
    signal?: AbortSignal,
  ): Promise<RawResourcePage> {
    let url: string;
    if (categorySlug) {
      url =
        page === 1
          ? `${this.config.baseUrl}/category/${categorySlug}`
          : `${this.config.baseUrl}/category/${categorySlug}/page/${page}`;
    } else {
      url = page === 1 ? this.config.baseUrl : `${this.config.baseUrl}/page/${page}`;
    }

    let html: string;
    try {
      html = await this.fetchHtml(url, signal);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      return { resources: [], currentPage: page, totalPages: page, totalItems: 0 };
    }

    const $ = this.parseHtml(html);
    const resources: RawResource[] = [];

    $('.grids .grid').each((_, el) => {
      const $el = $(el);

      const $titleLink = $el.find('h3 a').first();
      const href = $titleLink.attr('href') || '';
      const title = $titleLink.text().trim();

      if (!title || !href) return;

      const externalId = this.extractExternalId(href);

      const $img = $el.find('img.thumb').first();
      const thumbnailUrl = $img.attr('data-src') || $img.attr('src') || undefined;

      const description = $el.find('.excerpt').first().text().trim() || undefined;

      const categoryName = $el.find('.cat a').first().text().trim() || undefined;
      const categoryHref = $el.find('.cat a').first().attr('href') || '';
      const categorySlugMatch = categoryHref.match(/\/category\/(.+)/);
      const categoryExternalId = categorySlugMatch?.[1] || categoryName;

      const tags: string[] = [];
      if (categoryName) tags.push(categoryName);

      let publishedAt: Date | undefined;
      const timeText = $el.find('.grid-meta .time').text().trim();
      if (timeText) {
        const parsed = new Date(timeText);
        if (!isNaN(parsed.getTime())) {
          publishedAt = parsed;
        }
      }

      const contentHash = this.computeHash(title, description, JSON.stringify(tags));

      resources.push({
        externalId,
        title,
        description,
        thumbnailUrl,
        contentUrl: href,
        tags: tags.length > 0 ? tags : undefined,
        categoryExternalId: categoryExternalId || categorySlug || undefined,
        resourceType: 'COURSE',
        publishedAt,
        contentHash,
      });
    });

    let totalPages = page;
    $('.page-numbers, .pagination a, .nav-links a').each((_, el) => {
      const num = parseInt($(el).text().trim(), 10);
      if (!isNaN(num) && num > totalPages) {
        totalPages = num;
      }
    });

    if (resources.length > 0 && totalPages === page) {
      const nextLink = $('a.next, .pagination .next, .nav-links .next').attr('href');
      if (nextLink) {
        totalPages = page + 1;
      }
    }

    return { resources, currentPage: page, totalPages, totalItems: 0 };
  }

  async fetchResourceDetail(externalId: string, signal?: AbortSignal): Promise<RawResource | null> {
    const apiAvailable = await this.checkRestApi(signal);
    if (apiAvailable) {
      try {
        return await this.fetchResourceDetailViaApi(externalId, signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        console.warn(`[ZyckuAdapter] REST API detail failed, falling back to HTML: ${e instanceof Error ? e.message : String(e)}`);
        this.restApiAvailable = false;
      }
    }
    return this.fetchResourceDetailViaHtml(externalId, signal);
  }

  private async fetchResourceDetailViaApi(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<RawResource | null> {
    const url = `${this.restApiBase}/posts/${externalId}?_embed=1`;
    const res = await this.withRetry(() =>
      fetch(url, {
        headers: { 'User-Agent': this.userAgent },
        signal: signal || AbortSignal.timeout(15000),
      }),
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API returned ${res.status}`);
    }

    const post: WpApiPost = await res.json();
    return this.wpPostToRawResource(post, true);
  }

  private async fetchResourceDetailViaHtml(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<RawResource | null> {
    const url = `${this.config.baseUrl}/${externalId}.html`;

    let html: string;
    try {
      html = await this.fetchHtml(url, signal);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      return null;
    }

    const $ = this.parseHtml(html);

    const title = $('.article-title').first().text().trim() || $('h1').first().text().trim();

    if (!title) return null;

    const $contentImg = $('.article-content img').first();
    const thumbnailUrl = $contentImg.attr('src') || $contentImg.attr('data-src') || undefined;

    const paragraphs: string[] = [];
    const skipPatterns = [
      '资源下载',
      '下载价格',
      '版权声明',
      '资源大小',
      '下载方式',
      '声明：本站',
      '仅供学习',
    ];
    $('.article-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 3 && !skipPatterns.some((p) => text.includes(p))) {
        paragraphs.push(text);
      }
    });
    const description = paragraphs.length > 0 ? paragraphs.join('\n') : undefined;

    const tags: string[] = [];
    $('.article-meta .item-cats a, .article-content .cat a').each((_, el) => {
      const tagText = $(el).text().trim();
      if (tagText) tags.push(tagText);
    });

    const categoryText = tags[0] || undefined;

    let publishedAt: Date | undefined;
    const timeText = $('.article-meta .item').first().text().trim();
    if (timeText) {
      const parsed = new Date(timeText);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    }

    const contentHtml = this.cleanContentHtml($, '.article-content');

    const contentHash = this.computeHash(title, description, JSON.stringify(tags));

    return {
      externalId,
      title,
      description,
      thumbnailUrl,
      contentUrl: url,
      tags: tags.length > 0 ? tags : undefined,
      categoryExternalId: categoryText,
      resourceType: 'COURSE',
      publishedAt,
      contentHash,
      contentHtml,
    };
  }

  async hasUpdates(since: Date, signal?: AbortSignal): Promise<boolean> {
    const apiAvailable = await this.checkRestApi(signal);
    if (apiAvailable) {
      try {
        return await this.hasUpdatesViaApi(since, signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        this.restApiAvailable = false;
      }
    }
    return this.hasUpdatesViaHtml(since, signal);
  }

  private async hasUpdatesViaApi(since: Date, signal?: AbortSignal): Promise<boolean> {
    const sinceStr = since.toISOString();
    const url = `${this.restApiBase}/posts?per_page=1&orderby=modified&order=desc&modified_after=${sinceStr}`;
    const res = await this.withRetry(
      () =>
        fetch(url, {
          headers: { 'User-Agent': this.userAgent },
          signal: signal || AbortSignal.timeout(10000),
        }),
      1,
    );
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const total = parseInt(res.headers.get('X-WP-Total') || '0', 10);
    return total > 0;
  }

  private async hasUpdatesViaHtml(since: Date, signal?: AbortSignal): Promise<boolean> {
    try {
      const html = await this.fetchHtml(this.config.baseUrl, signal);
      const $ = this.parseHtml(html);

      let hasUpdate = false;

      $('.grid-meta .time').each((_, el) => {
        const dateStr = $(el).text().trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime()) && parsed > since) {
          hasUpdate = true;
          return false;
        }
      });

      return hasUpdate;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      return false;
    }
  }

  async fetchUpdates(since: Date, signal?: AbortSignal): Promise<RawResource[]> {
    const apiAvailable = await this.checkRestApi(signal);
    if (apiAvailable) {
      try {
        return await this.fetchUpdatesViaApi(since, signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        console.warn(`[ZyckuAdapter] REST API updates failed, falling back to HTML: ${e instanceof Error ? e.message : String(e)}`);
        this.restApiAvailable = false;
      }
    }
    return this.fetchUpdatesViaHtml(since, signal);
  }

  private async fetchUpdatesViaApi(since: Date, signal?: AbortSignal): Promise<RawResource[]> {
    const resources: RawResource[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const sinceStr = since.toISOString();
      const url = `${this.restApiBase}/posts?per_page=20&page=${page}&orderby=modified&order=desc&modified_after=${sinceStr}&_embed=1`;
      const res = await this.withRetry(() =>
        fetch(url, {
          headers: { 'User-Agent': this.userAgent },
          signal: signal || AbortSignal.timeout(15000),
        }),
      );

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const posts: WpApiPost[] = await res.json();
      if (posts.length === 0) break;

      for (const post of posts) {
        resources.push(this.wpPostToRawResource(post));
      }

      const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
      hasMore = page < totalPages;
      page++;

      if (hasMore) {
        await this.delay(300);
      }
    }

    return resources;
  }

  private async fetchUpdatesViaHtml(since: Date, signal?: AbortSignal): Promise<RawResource[]> {
    const resources: RawResource[] = [];
    const seenIds = new Set<string>();
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
      if (signal?.aborted) throw new Error('AbortError');
      const pageUrl = page === 1 ? this.config.baseUrl : `${this.config.baseUrl}/page/${page}`;
      const html = await this.fetchHtml(pageUrl, signal);
      const $ = this.parseHtml(html);

      let pageHasNewContent = false;

      $('.grids .grid').each((_, el) => {
        const $el = $(el);

        let publishedAt: Date | undefined;
        const timeText = $el.find('.grid-meta .time').text().trim();
        if (timeText) {
          const parsed = new Date(timeText);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        }

        if (publishedAt && publishedAt > since) {
          pageHasNewContent = true;
        }

        if (!publishedAt || publishedAt > since) {
          const $titleLink = $el.find('h3 a').first();
          const href = $titleLink.attr('href') || '';
          const title = $titleLink.text().trim();

          if (!title || !href || seenIds.has(href)) return;
          seenIds.add(href);

          const externalId = this.extractExternalId(href);

          const $img = $el.find('img.thumb').first();
          const thumbnailUrl = $img.attr('data-src') || $img.attr('src') || undefined;

          const description = $el.find('.excerpt').first().text().trim() || undefined;

          const tags: string[] = [];
          const categoryName = $el.find('.cat a').first().text().trim();
          if (categoryName) tags.push(categoryName);

          const contentHash = this.computeHash(title, description, JSON.stringify(tags));

          resources.push({
            externalId,
            title,
            description,
            thumbnailUrl,
            contentUrl: href,
            tags: tags.length > 0 ? tags : undefined,
            resourceType: 'COURSE',
            publishedAt,
            contentHash,
          });
        }
      });

      hasMore = pageHasNewContent;
      page++;

      if (hasMore) {
        await this.delay(500);
      }
    }

    return resources;
  }

  private wpPostToRawResource(post: WpApiPost, includeContent = false): RawResource {
    const thumbnailUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || undefined;

    const categoryTerms = post._embedded?.['wp:term']?.[0] || [];
    const tagTerms = post._embedded?.['wp:term']?.[1] || [];

    const categoryExternalId = categoryTerms.length > 0 ? String(categoryTerms[0]!.id) : undefined;
    const tags = [...categoryTerms.map((c) => c.name), ...tagTerms.map((t) => t.name)];

    const description = this.stripHtml(post.excerpt.rendered) || undefined;

    let contentHtml: string | undefined;
    if (includeContent) {
      contentHtml = this.sanitizeContentHtml(post.content.rendered);
    }

    const contentHash = this.computeHash(post.title.rendered, description, JSON.stringify(tags));

    return {
      externalId: String(post.id),
      title: this.stripHtml(post.title.rendered),
      description,
      thumbnailUrl,
      contentUrl: post.link,
      tags: tags.length > 0 ? tags : undefined,
      categoryExternalId,
      resourceType: 'COURSE',
      publishedAt: new Date(post.date),
      contentHash,
      contentHtml,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .trim();
  }

  private sanitizeContentHtml(html: string): string | undefined {
    let cleaned = html;
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length < 10) return undefined;
    return cleaned;
  }

  private extractExternalId(href: string): string {
    const match = href.match(/\/(\d+)\.html$/);
    const captured = match?.[1];
    if (captured) return captured;

    const parts = href
      .replace(/\/+$/, '')
      .split('/')
      .filter((p) => p.length > 0);
    const last = parts.length > 0 ? parts[parts.length - 1]! : '';
    const secondLast = parts.length > 1 ? parts[parts.length - 2]! : '';
    return last || secondLast || href;
  }

  private cleanContentHtml($: CheerioAPI, selector: string): string | undefined {
    const $content = $(selector).first();
    if ($content.length === 0) return undefined;

    $content
      .find(
        '.erphpdown-box, .article-copyright, .article-custom-metas, .tips, .tips2, script, style, .social-share, .share, .related-posts',
      )
      .remove();

    $content.find('img').each((_: any, el: any) => {
      const dataSrc = $(el).attr('data-src');
      if (dataSrc) {
        $(el).attr('src', dataSrc);
        $(el).removeAttr('data-src');
      }
      $(el).removeAttr('loading');
      $(el).removeAttr('decoding');
      $(el).removeAttr('fetchpriority');
      $(el).removeAttr('class');
      $(el).attr('style', 'max-width:100%;height:auto;');
    });

    let html = $content.html() || '';
    html = html.replace(/\s{2,}/g, ' ').trim();
    if (html.length < 10) return undefined;
    return html;
  }

  private get userAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  }
}
