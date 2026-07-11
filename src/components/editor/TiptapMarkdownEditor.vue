<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ElMessageBox, ElMessage } from '@/utils/feedbackBridge';
import DOMPurify from 'dompurify';
import api from '@/utils/api';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Code as CodeIcon,
  Link2,
  Unlink,
} from 'lucide-vue-next';

import { markdownToHtml, htmlToMarkdown } from '@/utils/markdownParser';
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

interface Props {
  modelValue: string;
  autoFocus?: boolean;
  noteId?: number | string;
  previewOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoFocus: false,
  previewOnly: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

let debounceTimer: any = null;
let localSaveTimer: any = null;
let remoteSaveTimer: any = null;

const saveStatus = ref<'idle' | 'pending' | 'saving' | 'success' | 'error'>('idle');

const badgeText = computed(() => {
  switch (saveStatus.value) {
    case 'idle':
      return '已同步';
    case 'pending':
      return '有未保存的修改...';
    case 'saving':
      return '正在保存...';
    case 'success':
      return '同步成功';
    case 'error':
      return '保存失败，请检查网络';
  }
  return '';
});

const badgeColorClass = computed(() => {
  switch (saveStatus.value) {
    case 'idle':
    case 'success':
      return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    case 'pending':
      return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    case 'saving':
      return 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    case 'error':
      return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  }
  return '';
});

// Configure DOMPurify hook to secure clipboard paste:
// - Whitelist only player.bilibili.com iframes
// - Strip styles (except highlight background-colors)
DOMPurify.removeHook('uponSanitizeElement');
DOMPurify.addHook('uponSanitizeElement', (node) => {
  const el = node as Element;
  if (el.tagName === 'IFRAME') {
    const src = el.getAttribute('src') || '';
    if (!/^(https?:)?\/\/player\.bilibili\.com\//.test(src)) {
      el.parentNode?.removeChild(el);
    }
  }

  if (node.nodeType === 1) {
    const element = node as HTMLElement;
    if (element.hasAttribute('style')) {
      const style = element.getAttribute('style') || '';
      const bgMatch = style.match(/background-color\s*:\s*([^;]+)/i);
      const isSpanOrMark = element.tagName === 'SPAN' || element.tagName === 'MARK';
      if (isSpanOrMark && bgMatch) {
        element.setAttribute('style', `background-color: ${bgMatch[1]}`);
      } else {
        element.removeAttribute('style');
      }
    }
  }
});

// Helper to sanitize HTML content using DOMPurify
const sanitizeContent = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'data-math',
      'data-code',
      'data-bvid',
      'data-url',
      'data-type',
      'data-checked',
      'contenteditable',
      'align',
      'style',
    ],
  });
};

// Check if draft exists in localStorage
const getInitialContent = () => {
  if (props.noteId && !props.previewOnly) {
    const draft = localStorage.getItem(`note-draft-${props.noteId}`);
    if (draft) {
      saveStatus.value = 'pending';
      return draft;
    }
  }
  return props.modelValue;
};

// Image upload and insert logic
const uploadAndInsertImage = async (file: File, view: any) => {
  const blobUrl = URL.createObjectURL(file);

  // 1. Insert temporary image node using local blob URL
  const { schema } = view.state;
  const node = schema.nodes.image.create({ src: blobUrl, alt: file.name });
  const transaction = view.state.tr.replaceSelectionWith(node);
  view.dispatch(transaction);

  // 2. Upload file to /api/resources/upload-temp
  const formData = new FormData();
  formData.append('temp', file);

  try {
    const response = await api.post('/api/resources/upload-temp', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Find node with src === blobUrl in the document
    let foundPos = -1;
    view.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'image' && node.attrs.src === blobUrl) {
        foundPos = pos;
        return false;
      }
    });

    if (foundPos !== -1) {
      // Replace with remote URL
      const tr = view.state.tr.setNodeMarkup(foundPos, undefined, {
        ...view.state.doc.nodeAt(foundPos)?.attrs,
        src: response.data.filePath,
      });
      view.dispatch(tr);
    }
  } catch (err) {
    ElMessage.error('图片上传失败，已撤销');

    // Rollback: delete the image node
    let foundPos = -1;
    view.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'image' && node.attrs.src === blobUrl) {
        foundPos = pos;
        return false;
      }
    });

    if (foundPos !== -1) {
      const node = view.state.doc.nodeAt(foundPos);
      if (node) {
        const tr = view.state.tr.delete(foundPos, foundPos + node.nodeSize);
        view.dispatch(tr);
      }
    }
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

// Initialize Editor using officially recommended useEditor composable
const editor = useEditor({
  content: sanitizeContent(markdownToHtml(getInitialContent())),
  autofocus: props.autoFocus && !props.previewOnly,
  editable: !props.previewOnly,
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
  editorProps: {
    attributes: {
      class:
        'prose prose-slate dark:prose-invert max-w-none focus:outline-none text-slate-800 dark:text-zinc-200 leading-relaxed font-sans',
    },
    transformPastedHTML(html) {
      return sanitizeContent(html);
    },
    handleDrop(view, event, slice, moved) {
      if (
        !moved &&
        event.dataTransfer &&
        event.dataTransfer.files &&
        event.dataTransfer.files.length > 0
      ) {
        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          event.preventDefault();
          imageFiles.forEach((file) => {
            uploadAndInsertImage(file, view);
          });
          return true;
        }
      }
      return false;
    },
    handlePaste(view, event, slice) {
      if (
        event.clipboardData &&
        event.clipboardData.files &&
        event.clipboardData.files.length > 0
      ) {
        const files = Array.from(event.clipboardData.files);
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          event.preventDefault();
          imageFiles.forEach((file) => {
            uploadAndInsertImage(file, view);
          });
          return true;
        }
      }
      return false;
    },
  },
  onUpdate({ editor: currentEditor }) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const html = currentEditor.getHTML();
      const markdown = htmlToMarkdown(html);
      emit('update:modelValue', markdown);
    }, 400); // 400ms debounce

    if (props.previewOnly) return;

    saveStatus.value = 'pending';

    // 1. Debounce 1s to localStorage
    if (localSaveTimer) clearTimeout(localSaveTimer);
    localSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          `note-draft-${props.noteId || 'temp'}`,
          htmlToMarkdown(currentEditor.getHTML()),
        );
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }, 1000);

    // 2. Debounce 3s to Remote PUT api call
    if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
    if (props.noteId) {
      remoteSaveTimer = setTimeout(async () => {
        saveStatus.value = 'saving';
        try {
          const markdown = htmlToMarkdown(currentEditor.getHTML());
          await api.put(`/api/notes/${props.noteId}`, { content: markdown });
          saveStatus.value = 'success';
          localStorage.removeItem(`note-draft-${props.noteId}`);

          setTimeout(() => {
            if (saveStatus.value === 'success') {
              saveStatus.value = 'idle';
            }
          }, 2000);
        } catch (e) {
          console.error('Failed to autosave to remote:', e);
          saveStatus.value = 'error';
        }
      }, 3000);
    }
  },
});

// Watch for external modelValue updates
watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor.value) return;
    const currentHtml = editor.value.getHTML();
    const currentMarkdown = htmlToMarkdown(currentHtml);
    if (currentMarkdown.trim() !== newVal.trim()) {
      editor.value.commands.setContent(sanitizeContent(markdownToHtml(newVal)), {
        emitUpdate: false,
      });
    }
  },
);

// Watch previewOnly prop to dynamically set editability
watch(
  () => props.previewOnly,
  (newVal) => {
    if (editor.value) {
      editor.value.setEditable(!newVal);
    }
  },
);

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (localSaveTimer) clearTimeout(localSaveTimer);
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
});

// Link action helper
const setLink = () => {
  if (!editor.value) return;
  const previousUrl = editor.value.getAttributes('link').href;
  ElMessageBox.prompt('请输入链接地址：', '插入链接', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: previousUrl,
    inputPattern: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    inputErrorMessage: '请输入有效的 URL 地址',
  })
    .then(({ value }) => {
      if (value === '') {
        editor.value?.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor.value
          ?.chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: value || '' })
          .run();
      }
    })
    .catch(() => {});
};

// Recursive JSON AST check for empty content
const isEditorContentEmpty = (json: any): boolean => {
  if (!json) return true;

  if (json.type === 'text') {
    return !json.text || json.text.trim() === '';
  }

  const mediaTypes = ['image', 'bilibiliCard', 'mermaidBlock', 'katexBlock', 'katexInline'];
  if (mediaTypes.includes(json.type)) {
    return false;
  }

  if (json.content && Array.isArray(json.content)) {
    return json.content.every((child: any) => isEditorContentEmpty(child));
  }

  return true;
};

const getMarkdownContent = (): string => {
  if (!editor.value) return '';
  const html = editor.value.getHTML();
  return htmlToMarkdown(html);
};

const isEmpty = (): boolean => {
  if (!editor.value) return true;
  const json = editor.value.getJSON();
  return isEditorContentEmpty(json);
};

defineExpose({
  getMarkdownContent,
  isEmpty,
});
</script>

<template>
  <div class="tiptap-markdown-editor w-full relative">
    <!-- Autosave state badge -->
    <div
      v-if="!props.previewOnly"
      class="absolute top-3 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass-real-physical glass-panel-extreme border border-white/10 select-none shadow-md"
    >
      <span :class="['w-1.5 h-1.5 rounded-full', badgeColorClass]"></span>
      <span class="text-slate-700 dark:text-zinc-300">{{ badgeText }}</span>
    </div>

    <!-- Selection Bubble Menu using Tiptap's BubbleMenu component -->
    <BubbleMenu
      v-if="editor && !props.previewOnly"
      :editor="editor"
      :options="{ strategy: 'absolute', placement: 'top' }"
      class="flex items-center gap-1 p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-xl rounded-xl z-50 transition-all duration-150 pointer-events-auto"
    >
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('bold') }"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        title="加粗"
      >
        <BoldIcon class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('italic') }"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        title="斜体"
      >
        <ItalicIcon class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('underline') }"
        @mousedown.prevent="editor.chain().focus().toggleUnderline().run()"
        title="下划线"
      >
        <UnderlineIcon class="w-3.5 h-3.5" />
      </button>
      <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('heading', { level: 1 }) }"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        title="标题 1"
      >
        <Heading1 class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('heading', { level: 2 }) }"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        title="标题 2"
      >
        <Heading2 class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('heading', { level: 3 }) }"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        title="标题 3"
      >
        <Heading3 class="w-3.5 h-3.5" />
      </button>
      <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('bulletList') }"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        title="无序列表"
      >
        <List class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('orderedList') }"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        title="有序列表"
      >
        <ListOrdered class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('blockquote') }"
        @mousedown.prevent="editor.chain().focus().toggleBlockquote().run()"
        title="引用"
      >
        <Quote class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('code') }"
        @mousedown.prevent="editor.chain().focus().toggleCode().run()"
        title="行内代码"
      >
        <CodeIcon class="w-3.5 h-3.5" />
      </button>
      <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
      <button
        type="button"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-zinc-400"
        :class="{ 'bg-accent/15 text-accent!': editor.isActive('link') }"
        @mousedown.prevent="setLink"
        title="添加链接"
      >
        <Link2 class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="editor.isActive('link')"
        type="button"
        class="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors text-slate-600 dark:text-zinc-400"
        @mousedown.prevent="editor.chain().focus().unsetLink().run()"
        title="取消链接"
      >
        <Unlink class="w-3.5 h-3.5" />
      </button>
    </BubbleMenu>

    <!-- Tiptap Editor Canvas with Typora-style single column wrapper -->
    <div
      class="tiptap-editor-container min-h-[55vh] max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm transition-colors duration-200"
    >
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style>
/* Typora style styling for editor elements */
.tiptap-editor-container .ProseMirror {
  outline: none;
  min-height: 55vh;
  padding: 2.5rem 2rem;
}

/* Headings styling */
.tiptap-editor-container .ProseMirror h1 {
  font-size: 1.875rem;
  font-weight: 800;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
}

.tiptap-editor-container .ProseMirror h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.tiptap-editor-container .ProseMirror h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

/* Bullet list & ordered list */
.tiptap-editor-container .ProseMirror ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.tiptap-editor-container .ProseMirror ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* Blockquote */
.tiptap-editor-container .ProseMirror blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--text-secondary);
  font-style: italic;
  background: rgba(0, 0, 0, 0.02);
}

.dark .tiptap-editor-container .ProseMirror blockquote {
  background: rgba(255, 255, 255, 0.02);
}

/* Inline code */
.tiptap-editor-container .ProseMirror p code {
  background: rgba(0, 0, 0, 0.05);
  color: #e06c75;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
  font-family: monospace;
}

.dark .tiptap-editor-container .ProseMirror p code {
  background: rgba(255, 255, 255, 0.08);
  color: #e5c07b;
}

/* Code block (standard fenced blocks) */
.tiptap-editor-container .ProseMirror pre {
  background: #282c34;
  color: #abb2bf;
  font-family: monospace;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: 1rem 0;
  overflow-x: auto;
}

.tiptap-editor-container .ProseMirror pre code {
  background: none;
  color: inherit;
  font-size: 0.9em;
  padding: 0;
}

/* Custom GFM Table Styling in Editor */
.tiptap-editor-container table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.tiptap-editor-container th,
.tiptap-editor-container td {
  border: 1px solid var(--border-base);
  padding: 8px 12px;
  text-align: left;
}

.tiptap-editor-container th {
  background-color: rgba(0, 0, 0, 0.02);
  font-weight: bold;
}

.dark .tiptap-editor-container th {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Task list checkbox items */
.tiptap-editor-container ul[data-type='taskList'] {
  list-style: none;
  padding-left: 0.5rem;
}

.tiptap-editor-container ul[data-type='taskList'] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tiptap-editor-container ul[data-type='taskList'] input[type='checkbox'] {
  margin-top: 0.3rem;
  cursor: pointer;
}
</style>
