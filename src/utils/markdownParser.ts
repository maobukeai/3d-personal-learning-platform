import { Marked } from 'marked';
import TurndownService from 'turndown';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const markedInstance = new Marked();

// Helper to escape HTML attributes
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Scans the string to find the index of the first occurrence of any target patterns
 * that is not enclosed in backticks (inline code or code blocks) and not escaped.
 */
function findOutsideCode(src: string, targets: string[]): { index: number; target: string } | null {
  let index = 0;
  while (index < src.length) {
    // Find the next backtick sequence
    const backtickMatch = src.slice(index).match(/`+/);
    const backtickIndex = backtickMatch ? index + backtickMatch.index! : -1;
    const backtickLen = backtickMatch ? backtickMatch[0].length : 0;

    // Find the first target match
    let earliestTargetIndex = -1;
    let selectedTarget = '';

    for (const target of targets) {
      let targetIndex = src.indexOf(target, index);
      // Make sure target is not escaped by an odd number of backslashes
      while (targetIndex !== -1) {
        let backslashes = 0;
        let k = targetIndex - 1;
        while (k >= 0 && src[k] === '\\') {
          backslashes++;
          k--;
        }
        if (backslashes % 2 !== 0) {
          targetIndex = src.indexOf(target, targetIndex + 1);
          continue;
        }

        if (earliestTargetIndex === -1 || targetIndex < earliestTargetIndex) {
          earliestTargetIndex = targetIndex;
          selectedTarget = target;
        }
        break;
      }
    }

    // If no target is found, we are done
    if (earliestTargetIndex === -1) {
      return null;
    }

    // If target is found before backticks, it is valid
    if (backtickIndex === -1 || earliestTargetIndex < backtickIndex) {
      return { index: earliestTargetIndex, target: selectedTarget };
    }

    // Backticks start first. Find the matching closing backticks.
    const delimiter = backtickMatch![0];
    const closingIndex = src.indexOf(delimiter, backtickIndex + backtickLen);

    if (closingIndex !== -1) {
      // Skip the code span
      index = closingIndex + backtickLen;
    } else {
      // Plain text backticks
      index = backtickIndex + backtickLen;
    }
  }
  return null;
}

// Custom Marked Extensions for KaTeX, Custom Alerts, Bilibili Video Cards

const katexBlockExtension = {
  name: 'katexBlock',
  level: 'block' as const,
  start(src: string) {
    const match = findOutsideCode(src, ['$$', '\\[']);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    // Match $$...$$
    const match1 = /^\$\$([\s\S]+?)\$\$/d.exec(src);
    if (match1) {
      return {
        type: 'katexBlock',
        raw: match1[0],
        math: match1[1].trim(),
      };
    }
    // Match \[...\]
    const match2 = /^\\\[([\s\S]+?)\\\]/d.exec(src);
    if (match2) {
      return {
        type: 'katexBlock',
        raw: match2[0],
        math: match2[1].trim(),
      };
    }
  },
  renderer(token: any) {
    try {
      const rendered = katex.renderToString(token.math, { displayMode: true, throwOnError: false });
      return `<div class="katex-block" data-math="${escapeHtml(token.math)}">${rendered}</div>`;
    } catch {
      return `<div class="katex-block text-red-500" data-math="${escapeHtml(token.math)}">Math Error: ${escapeHtml(token.math)}</div>`;
    }
  },
};

const katexInlineExtension = {
  name: 'katexInline',
  level: 'inline' as const,
  start(src: string) {
    const match = findOutsideCode(src, ['$', '\\(']);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    // Match $...$ where the content inside doesn't start/end with space and doesn't contain newline
    const match1 = /^\$((?!\s)[^$\n]+?(?<!\s))\$/d.exec(src);
    if (match1) {
      return {
        type: 'katexInline',
        raw: match1[0],
        math: match1[1].trim(),
      };
    }
    // Match \(...\)
    const match2 = /^\\\(([\s\S]+?)\\\)/d.exec(src);
    if (match2) {
      return {
        type: 'katexInline',
        raw: match2[0],
        math: match2[1].trim(),
      };
    }
  },
  renderer(token: any) {
    try {
      const rendered = katex.renderToString(token.math, {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="katex-inline" data-math="${escapeHtml(token.math)}">${rendered}</span>`;
    } catch {
      return `<span class="katex-inline text-red-500" data-math="${escapeHtml(token.math)}">${escapeHtml(token.math)}</span>`;
    }
  },
};

const customAlertExtension = {
  name: 'customAlert',
  level: 'block' as const,
  start(src: string) {
    const match = findOutsideCode(src, [':::']);
    return match ? match.index : -1;
  },
  tokenizer(this: any, src: string) {
    const match = /^:::\s*(\w+)\r?\n([\s\S]+?)\r?\n:::/d.exec(src);
    if (match) {
      const text = match[2];
      const tokens: any[] = [];
      this.lexer.blockTokens(text, tokens);
      return {
        type: 'customAlert',
        raw: match[0],
        alertType: match[1],
        tokens,
      };
    }
  },
  renderer(this: any, token: any) {
    const htmlContent = this.parser.parse(token.tokens);
    return `<div class="custom-alert alert-${token.alertType}">${htmlContent}</div>`;
  },
};

const bilibiliCardExtension = {
  name: 'bilibiliCard',
  level: 'block' as const,
  start(src: string) {
    const match = findOutsideCode(src, ['[video]', 'bilibili.com/video/']);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    // Format 1: [video](url)
    const matchCard =
      /^\[video\]\((https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)[^\s]*?)\)(?:\s*(?:\r?\n|$))/d.exec(
        src,
      );
    if (matchCard) {
      return {
        type: 'bilibiliCard',
        raw: matchCard[0],
        url: matchCard[1],
        bvid: matchCard[2],
      };
    }
    // Format 2: Standalone Bilibili URL on its own line
    const matchUrl =
      /^(https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)[^\s]*?)(?:\s*(?:\r?\n|$))/d.exec(
        src,
      );
    if (matchUrl) {
      return {
        type: 'bilibiliCard',
        raw: matchUrl[0],
        url: matchUrl[1],
        bvid: matchUrl[2],
      };
    }
  },
  renderer(token: any) {
    return `<div class="bilibili-card" data-bvid="${token.bvid}" data-url="${token.url}"></div>`;
  },
};

// Custom marked list/listitem and code renderers
const customRenderer = {
  code(token: any) {
    const { text, lang } = token;
    if (lang === 'mermaid') {
      return `<div class="mermaid-block" data-code="${escapeHtml(text)}"><pre class="mermaid">${escapeHtml(text)}</pre></div>`;
    }
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(text)}</code></pre>`;
  },
  list(this: any, token: any) {
    const ordered = token.ordered;
    const start = token.start;
    const isTaskList = token.items && token.items.some((item: any) => item.task);

    const type = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 && start !== '' ? ` start="${start}"` : '';
    const dataAttr = isTaskList ? ' data-type="taskList"' : '';

    let body = '';
    for (const item of token.items) {
      body += this.listitem(item);
    }

    return `<${type}${startAttr}${dataAttr}>\n${body}</${type}>\n`;
  },
  listitem(this: any, item: any) {
    let itemBody = this.parser.parse(item.tokens);
    if (item.task) {
      const checked = item.checked ? 'true' : 'false';
      itemBody = itemBody.replace(/<input\s+[^>]*type="checkbox"[^>]*>/i, '').trim();
      return `<li data-type="taskItem" data-checked="${checked}">${itemBody}</li>\n`;
    }
    return `<li>${itemBody}</li>\n`;
  },
};

markedInstance.use({
  extensions: [
    katexBlockExtension,
    katexInlineExtension,
    customAlertExtension,
    bilibiliCardExtension,
  ],
  renderer: customRenderer,
});

export const getMarkedInstance = () => markedInstance;

// ────────────────────────────────────────────────────────────────
// Markdown -> HTML Parser
// ────────────────────────────────────────────────────────────────
export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  return markedInstance.parse(markdown) as string;
};

// ────────────────────────────────────────────────────────────────
// HTML -> Markdown Serializer
// ────────────────────────────────────────────────────────────────
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  // 1. Mermaid Blocks
  turndownService.addRule('mermaid', {
    filter: (node) => {
      return node.nodeName === 'DIV' && node.classList.contains('mermaid-block');
    },
    replacement: (content, node) => {
      const code = (node as HTMLElement).getAttribute('data-code') || '';
      return `\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
    },
  });

  // 2. KaTeX Block Math
  turndownService.addRule('katex-block', {
    filter: (node) => {
      return node.nodeName === 'DIV' && node.classList.contains('katex-block');
    },
    replacement: (content, node) => {
      const math = (node as HTMLElement).getAttribute('data-math') || '';
      return `\n$$\n${math}\n$$\n`;
    },
  });

  // 3. KaTeX Inline Math
  turndownService.addRule('katex-inline', {
    filter: (node) => {
      return node.nodeName === 'SPAN' && node.classList.contains('katex-inline');
    },
    replacement: (content, node) => {
      const math = (node as HTMLElement).getAttribute('data-math') || '';
      return `$${math}$`;
    },
  });

  // 4. Bilibili Video Cards
  turndownService.addRule('bilibili-card', {
    filter: (node) => {
      return node.nodeName === 'DIV' && node.classList.contains('bilibili-card');
    },
    replacement: (content, node) => {
      const bvid = (node as HTMLElement).getAttribute('data-bvid') || '';
      const url =
        (node as HTMLElement).getAttribute('data-url') || `https://www.bilibili.com/video/${bvid}`;
      return `\n[video](${url})\n`;
    },
  });

  // 5. Custom Alerts / Highlights
  turndownService.addRule('custom-alert', {
    filter: (node) => {
      return node.nodeName === 'DIV' && node.className.includes('custom-alert');
    },
    replacement: (content, node) => {
      const className = (node as HTMLElement).className;
      const typeMatch = className.match(/alert-(\w+)/);
      const type = typeMatch ? typeMatch[1] : 'info';
      return `\n::: ${type}\n${content.trim()}\n:::\n`;
    },
  });

  // 6. GFM Tables
  turndownService.addRule('table-gfm', {
    filter: 'table',
    replacement: (content, node) => {
      const table = node as HTMLTableElement;
      let markdown = '\n\n';
      const rows = Array.from(table.rows);

      let alignments: string[] = [];

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.cells);

        if (rowIndex === 0) {
          alignments = cells.map((cell) => {
            const align = cell.getAttribute('align') || cell.style.textAlign || '';
            if (align === 'center') return ':---:';
            if (align === 'right') return '---:';
            if (align === 'left') return ':---';
            return '---';
          });
        }

        const cellContents = cells.map((cell) => {
          const cellHtml = cell.innerHTML;
          const cellMd = turndownService
            .turndown(cellHtml)
            .trim()
            .replace(/\r?\n/g, ' ')
            .replace(/\|/g, '\\|');
          return cellMd;
        });

        markdown += `| ${cellContents.join(' | ')} |\n`;

        if (rowIndex === 0) {
          markdown += `| ${alignments.join(' | ')} |\n`;
        }
      });

      return markdown + '\n';
    },
  });

  // 7. Prevent nested <p> in <li> from adding extra line breaks
  turndownService.addRule('paragraph-inside-list', {
    filter: (node) => {
      return node.nodeName === 'P' && node.parentNode?.nodeName === 'LI';
    },
    replacement: (content, node) => {
      let prev = node.previousSibling;
      while (prev && prev.nodeType === 3 && !prev.textContent?.trim()) {
        prev = prev.previousSibling;
      }
      return prev ? '\n' + content : content;
    },
  });

  // 8. List Items (Regular & Task Lists)
  turndownService.addRule('list-item-custom', {
    filter: 'li',
    replacement: (content, node, options) => {
      content = content.replace(/^\n+/, '').trimEnd().replace(/\n/g, '\n    ');

      const isTask = (node as HTMLElement).getAttribute('data-type') === 'taskItem';
      if (isTask) {
        const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
        const checkbox = checked ? '[x] ' : '[ ] ';
        const prefix = options.bulletListMarker + ' ' + checkbox;
        return prefix + content + (node.nextSibling ? '\n' : '');
      }

      const parent = node.parentNode;
      const isOrdered = parent && parent.nodeName === 'OL';
      if (isOrdered) {
        const siblings = Array.from(parent.children);
        const liSiblings = siblings.filter((n) => n.nodeName === 'LI');
        const index = liSiblings.indexOf(node) + 1;
        const start = (parent as HTMLElement).getAttribute('start');
        const startIndex = start ? parseInt(start, 10) + index - 1 : index;
        return startIndex + '. ' + content + (node.nextSibling ? '\n' : '');
      }

      return options.bulletListMarker + ' ' + content + (node.nextSibling ? '\n' : '');
    },
  });

  return turndownService.turndown(html);
};
