import { getMarkedInstance } from './markdownParser';

const marked = getMarkedInstance();

export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface TiptapDoc {
  type: 'doc';
  content: TiptapNode[];
}

const convertInlineTokens = (tokens: any[], parentMarks: TiptapMark[] = []): TiptapNode[] => {
  const nodes: TiptapNode[] = [];
  for (const token of tokens) {
    if (token.type === 'text') {
      nodes.push({
        type: 'text',
        text: token.text,
        marks: parentMarks.length > 0 ? parentMarks : undefined,
      });
    } else if (token.type === 'strong') {
      nodes.push(...convertInlineTokens(token.tokens || [], [...parentMarks, { type: 'bold' }]));
    } else if (token.type === 'em') {
      nodes.push(...convertInlineTokens(token.tokens || [], [...parentMarks, { type: 'italic' }]));
    } else if (token.type === 'del') {
      nodes.push(...convertInlineTokens(token.tokens || [], [...parentMarks, { type: 'strike' }]));
    } else if (token.type === 'codespan') {
      nodes.push({
        type: 'text',
        text: token.text,
        marks: [...parentMarks, { type: 'code' }],
      });
    } else if (token.type === 'link') {
      nodes.push(
        ...convertInlineTokens(token.tokens || [], [
          ...parentMarks,
          { type: 'link', attrs: { href: token.href } },
        ]),
      );
    } else if (token.type === 'katexInline') {
      nodes.push({
        type: 'katexInline',
        attrs: { math: token.math },
      });
    } else if (token.type === 'br') {
      nodes.push({
        type: 'text',
        text: '\n',
        marks: parentMarks.length > 0 ? parentMarks : undefined,
      });
    } else {
      nodes.push({
        type: 'text',
        text: token.text || token.raw || '',
        marks: parentMarks.length > 0 ? parentMarks : undefined,
      });
    }
  }
  return nodes;
};

const convertBlockTokens = (tokens: any[]): TiptapNode[] => {
  const nodes: TiptapNode[] = [];
  for (const token of tokens) {
    if (token.type === 'space') {
      continue;
    }
    switch (token.type) {
      case 'heading':
        nodes.push({
          type: 'heading',
          attrs: { level: token.depth },
          content: convertInlineTokens(token.tokens || []),
        });
        break;
      case 'paragraph':
        nodes.push({
          type: 'paragraph',
          content: convertInlineTokens(token.tokens || []),
        });
        break;
      case 'blockquote':
        nodes.push({
          type: 'blockquote',
          content: convertBlockTokens(token.tokens || []),
        });
        break;
      case 'hr':
        nodes.push({
          type: 'horizontalRule',
        });
        break;
      case 'list': {
        const isTaskList =
          token.items && token.items.some((item: any) => item.task || item.checked !== undefined);
        const listType = isTaskList ? 'taskList' : token.ordered ? 'orderedList' : 'bulletList';
        const attrs: Record<string, any> = {};
        if (token.ordered && token.start !== undefined && token.start !== 1 && token.start !== '') {
          attrs.start = Number(token.start);
        }

        const listItems = token.items.map((item: any) => {
          const itemType = isTaskList ? 'taskItem' : 'listItem';
          const itemAttrs: Record<string, any> = {};
          if (isTaskList) {
            itemAttrs.checked = !!item.checked;
          }
          return {
            type: itemType,
            attrs: isTaskList ? itemAttrs : undefined,
            content: convertBlockTokens(item.tokens || []),
          };
        });

        nodes.push({
          type: listType,
          attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
          content: listItems,
        });
        break;
      }
      case 'code':
        if (token.lang === 'mermaid') {
          nodes.push({
            type: 'mermaidBlock',
            attrs: { code: token.text },
          });
        } else {
          nodes.push({
            type: 'codeBlock',
            attrs: { language: token.lang || null },
            content: token.text ? [{ type: 'text', text: token.text }] : undefined,
          });
        }
        break;
      case 'table': {
        const tableRows: TiptapNode[] = [];
        if (token.header && token.header.length > 0) {
          const headerCells = token.header.map((cell: any, idx: number) => {
            const align = token.align && token.align[idx] ? token.align[idx] : 'left';
            return {
              type: 'tableHeader',
              attrs: { align },
              content: [
                {
                  type: 'paragraph',
                  content: convertInlineTokens(
                    cell.tokens || [{ type: 'text', text: cell.text || cell }],
                  ),
                },
              ],
            };
          });
          tableRows.push({ type: 'tableRow', content: headerCells });
        }
        if (token.rows && token.rows.length > 0) {
          token.rows.forEach((row: any) => {
            const bodyCells = row.map((cell: any, idx: number) => {
              const align = token.align && token.align[idx] ? token.align[idx] : 'left';
              return {
                type: 'tableCell',
                attrs: { align },
                content: [
                  {
                    type: 'paragraph',
                    content: convertInlineTokens(
                      cell.tokens || [{ type: 'text', text: cell.text || cell }],
                    ),
                  },
                ],
              };
            });
            tableRows.push({ type: 'tableRow', content: bodyCells });
          });
        }
        nodes.push({
          type: 'table',
          content: tableRows,
        });
        break;
      }
      case 'katexBlock':
        nodes.push({
          type: 'katexBlock',
          attrs: { math: token.math },
        });
        break;
      case 'customAlert':
        nodes.push({
          type: 'customAlert',
          attrs: { alertType: token.alertType },
          content: convertBlockTokens(token.tokens || []),
        });
        break;
      case 'bilibiliCard':
        nodes.push({
          type: 'bilibiliCard',
          attrs: { bvid: token.bvid, url: token.url },
        });
        break;
      default:
        if (token.tokens) {
          nodes.push(...convertBlockTokens(token.tokens));
        } else if (token.text) {
          nodes.push({
            type: 'paragraph',
            content: [{ type: 'text', text: token.text }],
          });
        }
    }
  }
  return nodes;
};

export const markdownToTiptapJson = (markdown: string): TiptapDoc => {
  if (markdown === undefined || markdown === null) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  if (markdown.trim() === '') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const tokens = marked.lexer(markdown) as unknown as any[];
  const content = convertBlockTokens(tokens);
  if (content.length === 0) {
    /* c8 ignore next -- defensive guard: marked.lexer always produces tokens for non-empty input */
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return {
    type: 'doc',
    content,
  };
};

const serializeInline = (content: any[] | undefined): string => {
  if (!content) return '';
  let result = '';
  for (const node of content) {
    if (node.type === 'text') {
      let text = node.text || '';
      if (node.marks) {
        const sortedMarks = [...node.marks];
        for (const mark of sortedMarks) {
          if (mark.type === 'bold') {
            text = `**${text}**`;
          } else if (mark.type === 'italic') {
            text = `*${text}*`;
          } else if (mark.type === 'strike') {
            text = `~~${text}~~`;
          } else if (mark.type === 'code') {
            text = `\`${text}\``;
          } else if (mark.type === 'link') {
            text = `[${text}](${mark.attrs?.href})`;
          } else if (mark.type === 'highlight') {
            const colorAttr = mark.attrs?.color
              ? ` style="background-color:${mark.attrs.color}"`
              : '';
            text = `<mark${colorAttr}>${text}</mark>`;
          }
        }
      }
      result += text;
    } else if (node.type === 'katexInline') {
      result += `$${node.attrs?.math}$`;
    } else {
      if (node.content) {
        result += serializeInline(node.content);
      }
    }
  }
  return result;
};

export const tiptapJsonToMarkdown = (node: any): string => {
  if (!node) return '';

  if (node.type === 'doc') {
    if (!node.content || node.content.length === 0) return '';
    return node.content
      .map(tiptapJsonToMarkdown)
      .filter((s: string) => s !== '')
      .join('\n\n');
  }

  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level) + ' ';
      const content = serializeInline(node.content);
      return prefix + content;
    }
    case 'paragraph': {
      return serializeInline(node.content);
    }
    case 'blockquote': {
      if (!node.content) return '';
      const inner = node.content
        .map(tiptapJsonToMarkdown)
        .filter((s: string) => s !== '')
        .join('\n\n');
      return inner
        .split('\n')
        .map((line: string) => `> ${line}`)
        .join('\n');
    }
    case 'horizontalRule': {
      return '---';
    }
    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = node.content ? node.content.map((n: any) => n.text).join('') : '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'mermaidBlock': {
      const code = node.attrs?.code || '';
      return `\`\`\`mermaid\n${code}\n\`\`\``;
    }
    case 'katexBlock': {
      const math = node.attrs?.math || '';
      return `$$\n${math}\n$$`;
    }
    case 'customAlert': {
      const type = node.attrs?.alertType || 'info';
      if (!node.content) return `::: ${type}\n:::`;
      const inner = node.content
        .map(tiptapJsonToMarkdown)
        .filter((s: string) => s !== '')
        .join('\n\n');
      return `::: ${type}\n${inner}\n:::`;
    }
    case 'bilibiliCard': {
      const url = node.attrs?.url || `https://www.bilibili.com/video/${node.attrs?.bvid}`;
      return `[video](${url})`;
    }
    case 'taskList': {
      if (!node.content) return '';
      return node.content
        .map((item: any) => {
          const checked = item.attrs?.checked ? '[x]' : '[ ]';
          const inner = item.content ? item.content.map(tiptapJsonToMarkdown).join('\n\n') : '';
          return `- ${checked} ${inner}`;
        })
        .join('\n');
    }
    case 'orderedList': {
      if (!node.content) return '';
      const start = node.attrs?.start !== undefined ? node.attrs.start : 1;
      return node.content
        .map((item: any, idx: number) => {
          const num = start + idx;
          const inner = item.content ? item.content.map(tiptapJsonToMarkdown).join('\n\n') : '';
          const lines = inner.split('\n');
          const body = lines
            .map((line: string, lineIdx: number) => {
              if (lineIdx === 0) return `${num}. ${line}`;
              return '   ' + line;
            })
            .join('\n');
          return body;
        })
        .join('\n');
    }
    case 'bulletList': {
      if (!node.content) return '';
      return node.content
        .map((item: any) => {
          const inner = item.content ? item.content.map(tiptapJsonToMarkdown).join('\n\n') : '';
          const lines = inner.split('\n');
          const body = lines
            .map((line: string, lineIdx: number) => {
              if (lineIdx === 0) return `- ${line}`;
              return '  ' + line;
            })
            .join('\n');
          return body;
        })
        .join('\n');
    }
    case 'listItem': {
      if (!node.content) return '';
      return node.content.map(tiptapJsonToMarkdown).join('\n\n');
    }
    case 'taskItem': {
      if (!node.content) return '';
      return node.content.map(tiptapJsonToMarkdown).join('\n\n');
    }
    case 'table': {
      if (!node.content || node.content.length === 0) return '';
      const rows = node.content;
      let markdown = '';
      let alignments: string[] = [];

      rows.forEach((row: any, rowIndex: number) => {
        if (!row.content) return;
        const cellTexts = row.content.map((cell: any, cellIndex: number) => {
          if (rowIndex === 0) {
            const align = cell.attrs?.align || 'left';
            if (align === 'center') alignments.push(':---:');
            else if (align === 'right') alignments.push('---:');
            else if (align === 'left') alignments.push(':---');
            else alignments.push('---');
          }
          const cellContent = cell.content ? cell.content.map(tiptapJsonToMarkdown).join(' ') : '';
          return cellContent.replace(/\|/g, '\\|');
        });

        markdown += `| ${cellTexts.join(' | ')} |\n`;

        if (rowIndex === 0) {
          markdown += `| ${alignments.join(' | ')} |\n`;
        }
      });
      return markdown.trim();
    }
    default: {
      if (node.content) {
        return node.content
          .map(tiptapJsonToMarkdown)
          .filter((s: string) => s !== '')
          .join('\n\n');
      }
      return '';
    }
  }
};

export const verifyRoundTrip = (
  markdown: string,
): { ok: boolean; original: string; roundtripped: string; diff?: string } => {
  const json = markdownToTiptapJson(markdown);
  const roundtripped = tiptapJsonToMarkdown(json);
  const norm = (s: string) =>
    s
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\n\s*\n/g, '\n');
  const ok = norm(markdown) === norm(roundtripped);
  return {
    ok,
    original: markdown,
    roundtripped,
  };
};
