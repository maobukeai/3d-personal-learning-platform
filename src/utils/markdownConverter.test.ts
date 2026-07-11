import { describe, it, expect } from 'vitest';
import { markdownToTiptapContent, tiptapContentToMarkdown } from './markdownConverter';
import { markdownToHtml } from './markdownParser';

describe('markdownConverter', () => {
  it('should convert headers correctly', () => {
    const md = '# Header 1\n\n## Header 2';
    const json = markdownToTiptapContent(md);
    expect(json.type).toBe('doc');
    expect(json.content[0].type).toBe('heading');
    expect(json.content[0].attrs.level).toBe(1);
    expect(json.content[1].type).toBe('heading');
    expect(json.content[1].attrs.level).toBe(2);

    const backToMd = tiptapContentToMarkdown(json);
    expect(backToMd.trim()).toBe(md.trim());
  });

  it('should convert lists correctly', () => {
    const md = '- Item 1\n- Item 2';
    const json = markdownToTiptapContent(md);
    console.log('LIST TIPTAP JSON:', JSON.stringify(json, null, 2));

    // Also let's check the HTML
    console.log('LIST HTML FROM PARSER:', markdownToHtml(md));

    const backToMd = tiptapContentToMarkdown(json);
    console.log('LIST CONVERTED BACK TO MD:', JSON.stringify(backToMd));
    expect(json.content[0].type).toBe('bulletList');

    expect(backToMd.trim()).toBe(md.trim());
  });

  it('should convert quotes correctly', () => {
    const md = '> This is a quote';
    const json = markdownToTiptapContent(md);
    expect(json.content[0].type).toBe('blockquote');

    const backToMd = tiptapContentToMarkdown(json);
    expect(backToMd.trim()).toBe(md.trim());
  });

  it('should convert tables correctly', () => {
    const md = '| Col 1 | Col 2 |\n| --- | --- |\n| Val 1 | Val 2 |';
    const json = markdownToTiptapContent(md);
    expect(json.content[0].type).toBe('table');

    const backToMd = tiptapContentToMarkdown(json);
    expect(backToMd.replace(/\s+/g, '')).toBe(md.replace(/\s+/g, ''));
  });

  it('should convert code blocks correctly', () => {
    const md = '```javascript\nconst a = 1;\n```';
    const json = markdownToTiptapContent(md);
    expect(json.content[0].type).toBe('codeBlock');

    const backToMd = tiptapContentToMarkdown(json);
    expect(backToMd.replace(/\s+/g, '')).toBe(md.replace(/\s+/g, ''));
  });

  it('should convert bold and italic markers correctly', () => {
    const md = 'This is **bold** and *italic* content.';
    const json = markdownToTiptapContent(md);
    const paragraph = json.content[0];
    expect(paragraph.type).toBe('paragraph');

    const backToMd = tiptapContentToMarkdown(json);
    expect(backToMd.trim()).toBe(md.trim());
  });

  it('should handle empty or null values gracefully', () => {
    expect(markdownToTiptapContent('')).toEqual({ type: 'doc', content: [] });
    expect(tiptapContentToMarkdown(null)).toBe('');
  });
});
