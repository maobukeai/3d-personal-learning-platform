import sanitizeHtmlLib from 'sanitize-html';
import { logger } from './logger';

/**
 * Safely sanitizes an HTML or Markdown string by stripping dangerous scripts, style tags,
 * event handlers, javascript: hrefs, and high-risk elements using the sanitize-html library.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';

  try {
    return sanitizeHtmlLib(html, {
      allowedTags: [
        'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'pre', 'code', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'span', 'div', 'hr', 'sup', 'sub', 'del', 's', 'details', 'summary',
      ],
      allowedAttributes: {
        a: ['href', 'class'],
        img: ['src', 'alt', 'width', 'height', 'class'],
        '*': ['class'],
      },
      disallowedTagsMode: 'discard',
    });
  } catch (error) {
    logger.error('[SanitizeUtil] Error sanitizing HTML content:', error);
    return '';
  }
}
