import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLElement) {
    if (node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }

    if (node.tagName.toLowerCase() === 'img') {
      // 强制添加 no-referrer，绕过跨域图床对手机端防盗链拦截
      node.setAttribute('referrerpolicy', 'no-referrer');
      // 移动端手机 WebView 移除 lazy loading，确保立即发起图片渲染
      node.removeAttribute('loading');
      node.setAttribute('decoding', 'async');
      node.setAttribute('crossorigin', 'anonymous');

      // 移除原 HTML 中可能存在的硬编码死宽高，避免移动端折叠或溢出
      node.removeAttribute('width');
      node.removeAttribute('height');

      let src = node.getAttribute('src') || '';
      const dataSrc =
        node.getAttribute('data-src') ||
        node.getAttribute('data-original') ||
        node.getAttribute('data-url');

      if (!src && dataSrc) {
        src = dataSrc;
        node.setAttribute('src', dataSrc);
      }

      // 手机端全站 HTTPS 环境下将 http:// 图片自动升级为 https://，避免 Mixed Content 阻断
      if (src.startsWith('http://') && !src.includes('localhost') && !src.includes('127.0.0.1')) {
        const upgraded = src.replace(/^http:\/\//i, 'https://');
        node.setAttribute('src', upgraded);
        src = upgraded;
      }

      // 高可用图片降级：如果手机端网络直连 CDN 失败，自动尝试同源代理
      if (src.startsWith('http')) {
        const proxyUrl = `/api/mirror/image-proxy?url=${encodeURIComponent(src)}`;
        node.setAttribute(
          'onerror',
          `if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${proxyUrl}';}`,
        );
      }
    }
  }
});

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'address',
      'article',
      'aside',
      'footer',
      'header',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hgroup',
      'main',
      'nav',
      'section',
      'blockquote',
      'dd',
      'div',
      'dl',
      'dt',
      'figcaption',
      'figure',
      'hr',
      'li',
      'ol',
      'p',
      'pre',
      'ul',
      'a',
      'abbr',
      'b',
      'bdi',
      'bdo',
      'br',
      'cite',
      'code',
      'data',
      'dfn',
      'em',
      'i',
      'kbd',
      'mark',
      'q',
      'rb',
      'rp',
      'rt',
      'rtc',
      'ruby',
      's',
      'samp',
      'small',
      'span',
      'strong',
      'sub',
      'sup',
      'time',
      'u',
      'var',
      'wbr',
      'caption',
      'col',
      'colgroup',
      'table',
      'tbody',
      'td',
      'tfoot',
      'th',
      'thead',
      'tr',
      'img',
      'video',
    ],
    ALLOWED_ATTR: [
      'href',
      'name',
      'target',
      'rel',
      'src',
      'alt',
      'class',
      'controls',
      'style',
      'loading',
      'decoding',
      'referrerpolicy',
      'data-src',
      'data-original',
      'data-url',
      'width',
      'height',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
};
