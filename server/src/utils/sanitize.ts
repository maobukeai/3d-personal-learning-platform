import { logger } from './logger';

/**
 * Lightweight Markdown-aware sanitizer (铁律五·1：后端唯一合法格式为 Markdown 字符串).
 *
 * The backend must NOT apply an HTML allow-list sanitizer to Markdown content, because that
 * strips legitimate inline HTML produced by the Tiptap AST serializer (e.g. `<u>`, `<mark>`),
 * breaking Markdown round-trip fidelity. Instead, the backend only neutralizes clearly
 * dangerous patterns (scripts, event handlers, javascript: URIs). Full XSS defense stays at
 * the rendering layer, where the frontend DOMPurify (SafeHtml.vue) applies a strict allow-list.
 *
 * This function is idempotent and preserves all legitimate Markdown syntax and inline HTML.
 */
export function sanitizeMarkdown(md: string | null | undefined): string {
  if (!md) return '';

  try {
    return (
      md
        // 1. Strip <script>...</script> blocks (including content)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        // 2. Strip <style>...</style> blocks (including content)
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        // 3. Remove all on* event handler attributes (onclick, onload, onerror, ...)
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        // 4. Neutralize javascript:, vbscript: and data:text/html URIs in href/src
        .replace(/(href|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match) => {
          if (/=\s*["']?\s*(javascript|vbscript|data:text\/html):/i.test(match)) {
            return match.replace(/(javascript|vbscript|data:text\/html)/i, '');
          }
          return match;
        })
    );
  } catch (error) {
    logger.error('[SanitizeUtil] Error sanitizing Markdown content:', error);
    return '';
  }
}
