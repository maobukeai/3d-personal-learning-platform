import { Marked, type Token, type TokenizerThis } from 'marked';
import * as Y from 'yjs';

/**
 * P10 阶段4：服务端 Markdown → Y.Doc 重建工具。
 *
 * 当 Redis 缓存未命中时，从 Postgres/MySQL Note.content（Markdown 字符串）重建 Y.Doc。
 * 重建路径：Markdown → marked.lexer → Tiptap JSON → Y.XmlFragment（y-prosemirror 格式）。
 *
 * 关键约束：
 *  - 不能 import 前端代码（src/utils/tiptapAst.ts 依赖 markdownParser.ts 的 katex CSS import）
 *  - 此模块是 tiptapAst.ts + markdownParser.ts 纯逻辑的服务端等价物
 *  - 只需要 marked.lexer()（tokenizers），不需要 renderers（无 HTML 渲染、无 katex CSS）
 *  - Y.XmlFragment 存储在 ydoc.getXmlFragment('prosemirror')，与 y-prosemirror ySyncPlugin 一致
 */

// ────────────────────────────────────────────────────────────────
// 类型定义（与前端 tiptapAst.ts 对齐）
// ────────────────────────────────────────────────────────────────

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapDoc {
  type: 'doc';
  content: TiptapNode[];
}

interface MarkedToken {
  type: string;
  raw?: string;
  text?: string;
  lang?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | string;
  items?: MarkedToken[];
  task?: boolean;
  checked?: boolean;
  tokens?: MarkedToken[];
  header?: MarkedToken[];
  align?: (string | null)[];
  rows?: MarkedToken[][];
  math?: string;
  alertType?: string;
  bvid?: string;
  url?: string;
  href?: string;
  title?: string | null;
}

// ────────────────────────────────────────────────────────────────
// marked 实例（带自定义 tokenizers，无 renderers/CSS）
// ────────────────────────────────────────────────────────────────

/**
 * 在 code span 之外查找目标模式的索引（复制自 markdownParser.ts，纯逻辑）。
 */
function findOutsideCode(src: string, targets: string[]): { index: number; target: string } | null {
  let index = 0;
  while (index < src.length) {
    const backtickMatch = src.slice(index).match(/`+/);
    const backtickIndex = backtickMatch ? index + (backtickMatch.index ?? 0) : -1;
    const backtickLen = backtickMatch ? backtickMatch[0].length : 0;

    let earliestTargetIndex = -1;
    let selectedTarget = '';

    for (const target of targets) {
      let targetIndex = src.indexOf(target, index);
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

    if (earliestTargetIndex === -1) {
      return null;
    }
    if (backtickIndex === -1 || earliestTargetIndex < backtickIndex) {
      return { index: earliestTargetIndex, target: selectedTarget };
    }

    const delimiter = backtickMatch![0];
    const closingIndex = src.indexOf(delimiter, backtickIndex + backtickLen);
    if (closingIndex !== -1) {
      index = closingIndex + backtickLen;
    } else {
      index = backtickIndex + backtickLen;
    }
  }
  return null;
}

const katexBlockExtension = {
  name: 'katexBlock',
  level: 'block' as const,
  start(src: string) {
    const match = findOutsideCode(src, ['$$', '\\[']);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    const match1 = /^\$\$([\s\S]+?)\$\$/d.exec(src);
    if (match1) {
      return { type: 'katexBlock', raw: match1[0], math: match1[1]!.trim() };
    }
    const match2 = /^\\\[([\s\S]+?)\\\]/d.exec(src);
    if (match2) {
      return { type: 'katexBlock', raw: match2[0], math: match2[1]!.trim() };
    }
    return undefined;
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
    const match1 = /^\$((?!\s)[^$\n]+?(?<!\s))\$/d.exec(src);
    if (match1) {
      return { type: 'katexInline', raw: match1[0], math: match1[1]!.trim() };
    }
    const match2 = /^\\\(([\s\S]+?)\\\)/d.exec(src);
    if (match2) {
      return { type: 'katexInline', raw: match2[0], math: match2[1]!.trim() };
    }
    return undefined;
  },
};

const customAlertExtension = {
  name: 'customAlert',
  level: 'block' as const,
  start(src: string) {
    const match = findOutsideCode(src, [':::']);
    return match ? match.index : -1;
  },
  tokenizer(this: TokenizerThis, src: string) {
    const match = /^:::\s*(\w+)\r?\n([\s\S]+?)\r?\n:::/d.exec(src);
    if (match) {
      const text = match[2]!;
      const tokens: Token[] = [];
      this.lexer.blockTokens(text, tokens);
      return { type: 'customAlert', raw: match[0], alertType: match[1], tokens };
    }
    return undefined;
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
    const matchCard =
      /^\[video\]\((https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)[^\s]*?)\)(?:\s*(?:\r?\n|$))/d.exec(
        src,
      );
    if (matchCard) {
      return { type: 'bilibiliCard', raw: matchCard[0], url: matchCard[1], bvid: matchCard[2] };
    }
    const matchUrl =
      /^(https?:\/\/www\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)[^\s]*?)(?:\s*(?:\r?\n|$))/d.exec(
        src,
      );
    if (matchUrl) {
      return { type: 'bilibiliCard', raw: matchUrl[0], url: matchUrl[1], bvid: matchUrl[2] };
    }
    return undefined;
  },
};

const markedInstance = new Marked();
markedInstance.use({
  extensions: [
    katexBlockExtension,
    katexInlineExtension,
    customAlertExtension,
    bilibiliCardExtension,
  ],
});

// ────────────────────────────────────────────────────────────────
// Markdown → Tiptap JSON（复制自 tiptapAst.ts 纯逻辑）
// ────────────────────────────────────────────────────────────────

const convertInlineTokens = (tokens: MarkedToken[]): TiptapNode[] => {
  const nodes: TiptapNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'escape': {
        const text = token.text || '';
        if (text) nodes.push({ type: 'text', text });
        break;
      }
      case 'codespan': {
        nodes.push({ type: 'text', text: token.text || '', marks: [{ type: 'code' }] });
        break;
      }
      case 'strong': {
        const inner = convertInlineTokens(token.tokens || []);
        applyMark(inner, { type: 'bold' });
        nodes.push(...inner);
        break;
      }
      case 'em': {
        const inner = convertInlineTokens(token.tokens || []);
        applyMark(inner, { type: 'italic' });
        nodes.push(...inner);
        break;
      }
      case 'del': {
        const inner = convertInlineTokens(token.tokens || []);
        applyMark(inner, { type: 'strike' });
        nodes.push(...inner);
        break;
      }
      case 'link': {
        const inner = convertInlineTokens(token.tokens || []);
        applyMark(inner, {
          type: 'link',
          attrs: { href: token.href || '', target: '_blank', rel: 'noopener noreferrer nofollow' },
        });
        nodes.push(...inner);
        break;
      }
      case 'katexInline': {
        nodes.push({ type: 'katexInline', attrs: { math: token.math || '' } });
        break;
      }
      case 'image': {
        nodes.push({
          type: 'image',
          attrs: { src: token.href || '', alt: token.text || '', title: token.title || '' },
        });
        break;
      }
      case 'br': {
        nodes.push({ type: 'hardBreak' });
        break;
      }
      default: {
        if (token.text) nodes.push({ type: 'text', text: token.text });
        break;
      }
    }
  }
  return nodes;
};

const applyMark = (nodes: TiptapNode[], mark: TiptapMark): void => {
  for (const node of nodes) {
    if (node.type === 'text') {
      node.marks = [...(node.marks || []), mark];
    } else if (node.content) {
      applyMark(node.content, mark);
    }
  }
};

const convertTableRow = (cells: MarkedToken[], isHeader: boolean): TiptapNode => {
  const tableCells: TiptapNode[] = cells.map((cell) => {
    const cellType = isHeader ? 'tableHeader' : 'tableCell';
    const align = (cell as unknown as { align?: string | null }).align;
    const attrs: Record<string, unknown> = { align: align || 'left' };
    return {
      type: cellType,
      attrs,
      content: [{ type: 'paragraph', content: convertInlineTokens(cell.tokens || []) }],
    };
  });
  return { type: 'tableRow', content: tableCells };
};

const convertBlockTokens = (tokens: MarkedToken[]): TiptapNode[] => {
  const nodes: TiptapNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        nodes.push({
          type: 'heading',
          attrs: { level: (token.depth || 1) as 1 | 2 | 3 | 4 | 5 | 6 },
          content: convertInlineTokens(token.tokens || []),
        });
        break;
      }
      case 'paragraph': {
        const inline = convertInlineTokens(token.tokens || []);
        if (inline.length > 0) {
          nodes.push({ type: 'paragraph', content: inline });
        } else {
          nodes.push({ type: 'paragraph' });
        }
        break;
      }
      case 'code': {
        const lang = token.lang || '';
        if (lang === 'mermaid') {
          nodes.push({ type: 'mermaidBlock', attrs: { code: token.text || '' } });
        } else {
          nodes.push({
            type: 'codeBlock',
            attrs: { language: lang },
            content: [{ type: 'text', text: token.text || '' }],
          });
        }
        break;
      }
      case 'katexBlock': {
        nodes.push({ type: 'katexBlock', attrs: { math: token.math || '' } });
        break;
      }
      case 'customAlert': {
        nodes.push({
          type: 'customAlert',
          attrs: { alertType: token.alertType || 'info' },
          content: convertBlockTokens(token.tokens || []),
        });
        break;
      }
      case 'bilibiliCard': {
        nodes.push({
          type: 'bilibiliCard',
          attrs: { bvid: token.bvid || '', url: token.url || '' },
        });
        break;
      }
      case 'blockquote': {
        nodes.push({ type: 'blockquote', content: convertBlockTokens(token.tokens || []) });
        break;
      }
      case 'hr': {
        nodes.push({ type: 'horizontalRule' });
        break;
      }
      case 'list': {
        const isTaskList = token.items?.some((item) => item.task) ?? false;
        const listType = token.ordered ? 'orderedList' : isTaskList ? 'taskList' : 'bulletList';
        const listItems: TiptapNode[] = [];
        for (const item of token.items || []) {
          const itemContent = convertBlockTokens(item.tokens || []);
          if (isTaskList && item.task) {
            listItems.push({
              type: 'taskItem',
              attrs: { checked: !!item.checked },
              content: itemContent.length > 0 ? itemContent : [{ type: 'paragraph' }],
            });
          } else {
            listItems.push({
              type: 'listItem',
              content: itemContent.length > 0 ? itemContent : [{ type: 'paragraph' }],
            });
          }
        }
        const attrs: Record<string, unknown> = {};
        if (token.ordered && token.start !== undefined && token.start !== '' && token.start !== 1) {
          attrs.start = token.start;
        }
        nodes.push({
          type: listType,
          ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
          content: listItems,
        });
        break;
      }
      case 'table': {
        const tableRows: TiptapNode[] = [];
        if (token.header && token.header.length > 0) {
          tableRows.push(convertTableRow(token.header, true));
        }
        if (token.rows) {
          for (const row of token.rows) {
            tableRows.push(convertTableRow(row, false));
          }
        }
        nodes.push({ type: 'table', content: tableRows });
        break;
      }
      case 'space':
      case 'html':
        break;
      case 'text': {
        const inline = convertInlineTokens(token.tokens || []);
        if (inline.length > 0) {
          nodes.push({ type: 'paragraph', content: inline });
        }
        break;
      }
      default: {
        if (token.tokens && token.tokens.length > 0) {
          nodes.push(...convertBlockTokens(token.tokens));
        }
        break;
      }
    }
  }
  return nodes;
};

/**
 * Markdown 字符串 → Tiptap JSON 文档（与前端 markdownToTiptapJson 等价）。
 */
export const markdownToTiptapJson = (markdown: string): TiptapDoc => {
  if (!markdown || !markdown.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const tokens = markedInstance.lexer(markdown) as unknown as MarkedToken[];
  const content = convertBlockTokens(tokens);
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }
  return { type: 'doc', content };
};

// ────────────────────────────────────────────────────────────────
// Tiptap JSON → Y.XmlFragment（y-prosemirror 兼容格式）
// ────────────────────────────────────────────────────────────────

/**
 * 将 marks 转换为 Y.XmlText delta attributes。
 *
 * y-prosemirror 的 marksToAttributes 对非重叠 mark 用 mark name 作 key，
 * 对重叠 mark 用 `${name}--${hash}` 作 key。重建场景中每个 text run 最多
 * 一个同类 mark，因此直接用 mark name 作 key 即可。
 * 读取时 yattr2markname 会剥离 hash 后缀，纯 name 也能正确解析。
 */
const marksToDeltaAttrs = (marks?: TiptapMark[]): Record<string, Record<string, unknown>> => {
  if (!marks || marks.length === 0) return {};
  const attrs: Record<string, Record<string, unknown>> = {};
  for (const mark of marks) {
    attrs[mark.type] = mark.attrs || {};
  }
  return attrs;
};

/**
 * 将 Tiptap inline 节点数组转换为 Y.XmlText / Y.XmlElement 子节点数组。
 * 连续的 text 节点合并到同一个 Y.XmlText（与 y-prosemirror 行为一致）。
 */
const buildInlineNodes = (nodes: TiptapNode[]): (Y.XmlText | Y.XmlElement)[] => {
  const result: (Y.XmlText | Y.XmlElement)[] = [];
  const textDeltas: { insert: string; attributes?: Record<string, Record<string, unknown>> }[] = [];

  const flushTextDeltas = () => {
    if (textDeltas.length > 0) {
      const ytext = new Y.XmlText();
      ytext.applyDelta(textDeltas);
      result.push(ytext);
      textDeltas.length = 0;
    }
  };

  for (const node of nodes) {
    if (node.type === 'text') {
      textDeltas.push({
        insert: node.text || '',
        attributes: marksToDeltaAttrs(node.marks),
      });
    } else {
      flushTextDeltas();
      // atom inline nodes → Y.XmlElement
      const el = new Y.XmlElement(node.type);
      if (node.attrs) {
        for (const [key, val] of Object.entries(node.attrs)) {
          if (val !== null && val !== undefined) {
            el.setAttribute(key, val as string);
          }
        }
      }
      result.push(el);
    }
  }
  flushTextDeltas();
  return result;
};

/**
 * 将单个 Tiptap 块节点转换为 Y.XmlElement。
 */
const buildBlockNode = (node: TiptapNode): Y.XmlElement => {
  const el = new Y.XmlElement(node.type);
  if (node.attrs) {
    for (const [key, val] of Object.entries(node.attrs)) {
      if (val !== null && val !== undefined) {
        el.setAttribute(key, val as string);
      }
    }
  }
  const children: (Y.XmlText | Y.XmlElement)[] = [];

  if (node.content) {
    // 判断 content 是 inline 级还是 block 级
    const isInlineContent = node.content.every(
      (child) =>
        child.type === 'text' ||
        child.type === 'hardBreak' ||
        child.type === 'image' ||
        child.type === 'katexInline',
    );

    if (isInlineContent) {
      children.push(...buildInlineNodes(node.content));
    } else {
      for (const child of node.content) {
        children.push(buildBlockNode(child));
      }
    }
  }

  if (children.length > 0) {
    el.insert(0, children);
  }
  return el;
};

/**
 * 将 Tiptap JSON 文档写入 Y.Doc 的 Y.XmlFragment（key: 'prosemirror'）。
 *
 * 与 y-prosemirror 的 ySyncPlugin 使用的 key 一致：
 *   ydoc.getXmlFragment('prosemirror')
 *
 * 客户端连接后，ySyncPlugin 会从该 Y.XmlFragment 渲染 ProseMirror 编辑器。
 */
export const tiptapJsonToYDoc = (ydoc: Y.Doc, doc: TiptapDoc): void => {
  const yFragment = ydoc.getXmlFragment('prosemirror');
  const elements = (doc.content || []).map((node) => buildBlockNode(node));
  if (elements.length > 0) {
    yFragment.insert(0, elements);
  }
};

/**
 * 完整重建：Markdown 字符串 → Y.Doc（含 Y.XmlFragment）。
 */
export const rebuildYDocFromMarkdown = (ydoc: Y.Doc, markdown: string): void => {
  const tiptapDoc = markdownToTiptapJson(markdown);
  tiptapJsonToYDoc(ydoc, tiptapDoc);
};
