import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  MermaidBlock,
  KatexBlock,
  KatexInline,
  BilibiliCard,
  CustomAlert,
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from '@/components/markdownEditor/extensions/customNodes';
import { markdownToHtml, htmlToMarkdown } from '@/utils/markdownParser';

let headlessEditor: Editor | null = null;

function getHeadlessEditor(): Editor {
  if (!headlessEditor) {
    headlessEditor = new Editor({
      extensions: [
        StarterKit.configure({
          link: false,
          underline: false,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-accent hover:underline cursor-pointer',
          },
        }),
        Underline,
        Highlight.configure({ multicolor: true }),
        Image.configure({
          HTMLAttributes: {
            class: 'rounded-xl max-w-full my-4 border border-white/10 shadow-md',
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: 'flex gap-2 items-start my-1',
          },
        }),
        MermaidBlock,
        KatexBlock,
        KatexInline,
        BilibiliCard,
        CustomAlert,
        Table,
        TableRow,
        TableCell,
        TableHeader,
      ],
    });
  }
  return headlessEditor;
}

/**
 * Converts Markdown text into a JSON object structure compatible with Tiptap.
 */
export function markdownToTiptapContent(markdown: string): any {
  if (markdown === undefined || markdown === null || markdown === '') {
    return {
      type: 'doc',
      content: [],
    };
  }
  // Convert Markdown -> HTML
  const html = markdownToHtml(markdown);
  // Parse HTML -> Tiptap JSON content
  const editor = getHeadlessEditor();
  editor.commands.setContent(html, { emitUpdate: false });
  return editor.getJSON();
}

/**
 * Converts Tiptap document JSON back to standard Markdown text.
 */
export function tiptapContentToMarkdown(content: any): string {
  if (!content) return '';
  // Parse Tiptap JSON -> HTML
  const editor = getHeadlessEditor();
  editor.commands.setContent(content, { emitUpdate: false });
  const html = editor.getHTML();
  // Convert HTML -> Markdown
  return htmlToMarkdown(html);
}
