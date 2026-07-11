import { Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';

// Mermaid Node
export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.mermaid-block',
        getAttrs: (element) => ({
          code: (element as HTMLElement).getAttribute('data-code') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'mermaid-block', 'data-code': HTMLAttributes.code }),
      ['pre', { class: 'mermaid' }, HTMLAttributes.code],
    ];
  },
});

// KaTeX Block Node
export const KatexBlock = Node.create({
  name: 'katexBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      math: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.katex-block',
        getAttrs: (element) => ({
          math: (element as HTMLElement).getAttribute('data-math') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let rendered: string;
    try {
      rendered = katex.renderToString(HTMLAttributes.math || '', {
        displayMode: true,
        throwOnError: false,
      });
    } catch (e) {
      rendered = `Error: ${HTMLAttributes.math}`;
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'katex-block', 'data-math': HTMLAttributes.math }),
      ['span', { domHtml: 'true' }, rendered], // Note: we'll handle setting innerHTML safely
    ];
  },
});

// KaTeX Inline Node
export const KatexInline = Node.create({
  name: 'katexInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      math: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.katex-inline',
        getAttrs: (element) => ({
          math: (element as HTMLElement).getAttribute('data-math') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let rendered: string;
    try {
      rendered = katex.renderToString(HTMLAttributes.math || '', {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      rendered = HTMLAttributes.math;
    }

    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'katex-inline', 'data-math': HTMLAttributes.math }),
      ['span', { domHtml: 'true' }, rendered],
    ];
  },
});

// Bilibili Card Node
export const BilibiliCard = Node.create({
  name: 'bilibiliCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      bvid: {
        default: '',
      },
      url: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.bilibili-card',
        getAttrs: (element) => ({
          bvid: (element as HTMLElement).getAttribute('data-bvid') || '',
          url: (element as HTMLElement).getAttribute('data-url') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const embedUrl = `//player.bilibili.com/player.html?bvid=${HTMLAttributes.bvid}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'bilibili-card my-4',
        'data-bvid': HTMLAttributes.bvid,
        'data-url': HTMLAttributes.url,
      }),
      [
        'div',
        {
          class:
            'bilibili-video-wrapper relative w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-white/10',
        },
        [
          'iframe',
          {
            src: embedUrl,
            scrolling: 'no',
            border: '0',
            frameborder: 'no',
            framespacing: '0',
            allowfullscreen: 'true',
            class: 'absolute top-0 left-0 w-full h-full border-0',
          },
        ],
      ],
    ];
  },
});

// Custom Alert Node
export const CustomAlert = Node.create({
  name: 'customAlert',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info', // 'info' | 'warning' | 'error' | 'success' | 'tip'
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.custom-alert',
        getAttrs: (element) => {
          const className = (element as HTMLElement).className || '';
          const match = className.match(/alert-(\w+)/);
          return {
            type: match ? match[1] : 'info',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `custom-alert alert-${HTMLAttributes.type || 'info'} p-4 my-4 rounded-xl border border-white/10 backdrop-blur-md`,
      }),
      0,
    ];
  },
});

export { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
