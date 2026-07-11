import { describe, it, expect } from 'vitest';
import { markdownToTiptapContent, tiptapContentToMarkdown } from './markdownConverter';

describe('Milestone 3 Markdown & Tiptap Support', () => {
  describe('1. Complex Round-trip Markdown Conversion', () => {
    it('should round-trip simple elements (headers, blockquotes, bold/italic, links)', () => {
      const originalMd = `# Header 1

## Header 2

> This is a blockquote.
> It has multiple lines.

This is **bold** text and _italic_ text and **_bold-italic_** text.

Here is a [link to Google](https://google.com) and an image ![Alt text](https://example.com/img.png).`;

      const tiptapJson = markdownToTiptapContent(originalMd);
      const convertedMd = tiptapContentToMarkdown(tiptapJson);

      const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
      expect(normalize(convertedMd)).toContain('# Header 1');
      expect(normalize(convertedMd)).toContain('## Header 2');
      expect(normalize(convertedMd)).toContain('This is a blockquote. It has multiple lines.');
      expect(normalize(convertedMd)).toContain('This is **bold** text and *italic* text');
      expect(normalize(convertedMd)).toContain('[link to Google](https://google.com)');
      expect(normalize(convertedMd)).toContain('![Alt text](https://example.com/img.png)');
    });

    it('should round-trip Custom Nodes (Mermaid, Bilibili, KaTeX block/inline, Alerts)', () => {
      const originalMd = `::: info
This is an alert info box.
:::

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

$$
f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx
$$

This is an inline formula $E = mc^2$ in a paragraph.

[video](https://www.bilibili.com/video/BV1xx411c7m9)`;

      const tiptapJson = markdownToTiptapContent(originalMd);
      const convertedMd = tiptapContentToMarkdown(tiptapJson);

      expect(tiptapJson.content.some((n: any) => n.type === 'customAlert')).toBe(true);
      expect(tiptapJson.content.some((n: any) => n.type === 'mermaidBlock')).toBe(true);
      expect(tiptapJson.content.some((n: any) => n.type === 'katexBlock')).toBe(true);
      expect(tiptapJson.content.some((n: any) => n.type === 'bilibiliCard')).toBe(true);

      const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
      expect(normalize(convertedMd)).toContain('::: info This is an alert info box. :::');
      expect(normalize(convertedMd)).toContain('```mermaid graph TD A --> B ```');
      expect(normalize(convertedMd)).toContain(
        '$$ f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx $$',
      );
      expect(normalize(convertedMd)).toContain('$E = mc^2$');
      expect(normalize(convertedMd)).toContain(
        '[video](https://www.bilibili.com/video/BV1xx411c7m9)',
      );
    });
  });

  describe('2. Isolation / Non-corruption of Math & Alerts in Code Contexts', () => {
    it('should NOT parse Math Formulas inside code blocks', () => {
      const md = `\`\`\`latex
$$e = mc^2$$
\\\\[ x^2 \\\\]
\`\`\``;
      const tiptapJson = markdownToTiptapContent(md);

      const hasKatexNode = (node: any): boolean => {
        if (node.type === 'katexBlock' || node.type === 'katexInline') return true;
        if (node.content) return node.content.some(hasKatexNode);
        return false;
      };
      expect(hasKatexNode(tiptapJson)).toBe(false);
      expect(tiptapJson.content[0].type).toBe('codeBlock');
      expect(tiptapJson.content[0].attrs.language).toBe('latex');

      const convertedMd = tiptapContentToMarkdown(tiptapJson);
      expect(convertedMd.trim()).toBe(md.trim());
    });

    it('should NOT parse Math Formulas inside inline code', () => {
      const md = `This is code: \`$$a^2 + b^2 = c^2$$\` and \`$E=mc^2$\`.`;
      const tiptapJson = markdownToTiptapContent(md);

      const hasKatexNode = (node: any): boolean => {
        if (node.type === 'katexBlock' || node.type === 'katexInline') return true;
        if (node.content) return node.content.some(hasKatexNode);
        return false;
      };
      expect(hasKatexNode(tiptapJson)).toBe(false);

      const convertedMd = tiptapContentToMarkdown(tiptapJson);
      expect(convertedMd.trim()).toBe(md.trim());
    });

    it('should NOT parse Alert Boxes inside code blocks', () => {
      const md = `\`\`\`markdown
::: info
This alert box is inside code block
:::
\`\`\``;
      const tiptapJson = markdownToTiptapContent(md);

      const hasAlertNode = (node: any): boolean => {
        if (node.type === 'customAlert') return true;
        if (node.content) return node.content.some(hasAlertNode);
        return false;
      };
      expect(hasAlertNode(tiptapJson)).toBe(false);
      expect(tiptapJson.content[0].type).toBe('codeBlock');

      const convertedMd = tiptapContentToMarkdown(tiptapJson);
      expect(convertedMd.trim()).toBe(md.trim());
    });

    it('should NOT parse Alert Boxes inside inline code', () => {
      const md = `This is inline code: \`::: warning alert :::\`.`;
      const tiptapJson = markdownToTiptapContent(md);

      const hasAlertNode = (node: any): boolean => {
        if (node.type === 'customAlert') return true;
        if (node.content) return node.content.some(hasAlertNode);
        return false;
      };
      expect(hasAlertNode(tiptapJson)).toBe(false);

      const convertedMd = tiptapContentToMarkdown(tiptapJson);
      expect(convertedMd.trim()).toBe(md.trim());
    });
  });

  describe('3. GFM Tables & Task Lists', () => {
    it('should handle GFM Table cell inline formatting and alignments', () => {
      const md = `| Left | Center | Right |
| :--- | :---: | ---: |
| **Bold** in cell | *Italic* in cell | \`code\` in cell |`;

      const tiptapJson = markdownToTiptapContent(md);

      expect(tiptapJson.content[0].type).toBe('table');
      const tableRow1 = tiptapJson.content[0].content[0];
      const tableRow2 = tiptapJson.content[0].content[1];

      expect(tableRow1.content[0].attrs.align).toBe('left');
      expect(tableRow1.content[1].attrs.align).toBe('center');
      expect(tableRow1.content[2].attrs.align).toBe('right');

      expect(tableRow2.content[0].attrs.align).toBe('left');
      expect(tableRow2.content[1].attrs.align).toBe('center');
      expect(tableRow2.content[2].attrs.align).toBe('right');

      const convertedMd = tiptapContentToMarkdown(tiptapJson);

      const normalizeLines = (str: string) =>
        str
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join('\n');
      const normalizedMd = normalizeLines(convertedMd);

      expect(normalizedMd).toContain('| Left | Center | Right |');
      expect(normalizedMd).toContain('| :--- | :---: | ---: |');
      expect(normalizedMd).toContain('Bold');
      expect(normalizedMd).toContain('code');
    });

    it('should handle GFM Task Lists correctly', () => {
      const md = `- [ ] Uncompleted task item
- [x] Completed task item`;

      const tiptapJson = markdownToTiptapContent(md);

      const taskList = tiptapJson.content[0];
      expect(taskList.type).toBe('taskList');
      expect(taskList.content[0].type).toBe('taskItem');
      expect(taskList.content[0].attrs.checked).toBe(false);
      expect(taskList.content[1].type).toBe('taskItem');
      expect(taskList.content[1].attrs.checked).toBe(true);

      const convertedMd = tiptapContentToMarkdown(tiptapJson);
      expect(convertedMd).toContain('- [ ] Uncompleted');
      expect(convertedMd).toContain('- [x] Completed');
    });
  });
});
