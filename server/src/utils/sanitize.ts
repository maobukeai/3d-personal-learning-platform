import { logger } from './logger';

/**
 * Safely sanitizes an HTML or Markdown string by stripping dangerous scripts, style tags,
 * event handlers (e.g. onerror, onload, onclick), javascript: hrefs, and high-risk elements.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';

  try {
    return (
      html
        // 1. Remove script tags and their contents
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // 2. Remove style tags and their contents
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // 3. Remove event handlers like onload, onerror, onclick, onmouseover, etc.
        .replace(/\s+on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
        // 4. Remove javascript: pseudo-protocol in href or src attribute values
        .replace(/(href|src)\s*=\s*(["']\s*javascript:[^"']*["']|javascript:[^\s>]+)/gi, '$1="#"')
        // 5. Remove high-risk elements (iframe, embed, object, link, meta, base, form elements)
        .replace(/<(iframe|object|embed|link|meta|base|form|input|button|textarea)\b[^>]*>/gi, '')
        .replace(/<\/(iframe|object|embed|link|meta|base|form|input|button|textarea)>/gi, '')
    );
  } catch (error) {
    logger.error('[SanitizeUtil] Error sanitizing HTML content:', error);
    return '';
  }
}
