<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  defineAsyncComponent,
  nextTick,
  type ComponentPublicInstance,
} from 'vue';
import { useI18n } from 'vue-i18n';
import type { ToolbarNames } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { ElMessage } from 'element-plus';
import {
  Sparkles,
  Send,
  Square,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import MarkdownAiPanel from './markdownEditor/MarkdownAiPanel.vue';

const MdEditor = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdEditor));
const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
const NormalToolbar = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.NormalToolbar));

const { locale } = useI18n();

// ────────────────────────────────────────────────────────────────
// Props / Emits
// ────────────────────────────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    height?: string;
    previewOnly?: boolean;
    autoFocus?: boolean;
    autoHeight?: boolean;
    preview?: boolean;
    htmlPreview?: boolean;
    uploadUrl?: string;
    uploadField?: string;
    simple?: boolean;
  }>(),
  {
    placeholder: '请输入内容，支持 Markdown 格式...',
    height: '500px',
    previewOnly: false,
    autoFocus: false,
    autoHeight: false,
    preview: true,
    htmlPreview: false,
    uploadUrl: '',
    uploadField: 'file',
    simple: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const text = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
});

// ────────────────────────────────────────────────────────────────
// Refs
// ────────────────────────────────────────────────────────────────
const editorId = ref(`md-editor-${Math.random().toString(36).substring(2, 11)}`);
const editorRef = ref<ComponentPublicInstance | null>(null);

// ────────────────────────────────────────────────────────────────
// Panel state (for sub-component)
// ────────────────────────────────────────────────────────────────
const showPanel = ref(false);
const savedSel = ref({ start: 0, end: 0, text: '' });
const ctxMode = ref<'full' | 'selected'>('full');

const getEditorTextarea = (): HTMLTextAreaElement | null => {
  if (!editorRef.value?.$el) return null;
  return (
    editorRef.value.$el.querySelector('.md-editor-input-wrapper textarea') ??
    editorRef.value.$el.querySelector('.md-editor-input textarea') ??
    editorRef.value.$el.querySelector('textarea')
  );
};

const captureSelection = () => {
  const ta = getEditorTextarea();
  if (!ta) return;
  const s = ta.selectionStart ?? 0;
  const e = ta.selectionEnd ?? 0;
  const t = ta.value.substring(s, e);
  savedSel.value = { start: s, end: e, text: t };
  ctxMode.value = t.length > 0 ? 'selected' : 'full';
};

const openPanel = () => {
  captureSelection();
  showPanel.value = true;
};

const closePanel = () => {
  showPanel.value = false;
};

const togglePanel = () => (showPanel.value ? closePanel() : openPanel());

const onEditorInteract = () => {
  if (!showPanel.value) return;
  captureSelection();
};

const handleAiApply = (payload: { mode: 'replace' | 'append' | 'copy'; content: string }) => {
  applyResult(payload.mode, payload.content);
};

const applyResult = async (mode: 'replace' | 'append' | 'copy', result: string) => {
  if (!result) return;

  if (mode === 'copy') {
    await navigator.clipboard.writeText(result);
    ElMessage.success('已复制到剪贴板');
    return;
  }
  if (mode === 'append') {
    text.value = text.value.trimEnd() + '\n\n' + result;
    ElMessage.success('已追加到文档末尾');
    nextTick(() => {
      const ta = getEditorTextarea();
      if (ta) {
        ta.scrollTop = ta.scrollHeight;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
    return;
  }
  if (mode === 'replace') {
    const hasSelection = savedSel.value.text.trim().length > 0;
    if (!hasSelection) {
      text.value = result;
      savedSel.value = { start: 0, end: result.length, text: result };
      ctxMode.value = 'full';
      ElMessage.success('已替换全文');
      nextTick(() => getEditorTextarea()?.focus());
      return;
    }

    const ta = getEditorTextarea();
    if (!ta) {
      ElMessage.error('无法定位编辑器，请重试');
      return;
    }
    text.value =
      text.value.slice(0, savedSel.value.start) + result + text.value.slice(savedSel.value.end);
    ElMessage.success('已替换选中内容');
    const newEnd = savedSel.value.start + result.length;
    savedSel.value = { start: savedSel.value.start, end: newEnd, text: result };
    nextTick(() => {
      ta.focus();
      ta.setSelectionRange(newEnd, newEnd);
    });
  }
};

// ────────────────────────────────────────────────────────────────
// Editor config
// ────────────────────────────────────────────────────────────────
const editorLanguage = computed(() => (locale.value === 'zh-CN' ? 'zh-CN' : 'en-US'));

const toolbars = computed<ToolbarNames[]>(() => {
  if (isMobile.value) {
    return [
      'bold',
      'italic',
      'title',
      'quote',
      'unorderedList',
      'orderedList',
      'code',
      'link',
      'image',
      'table',
      'preview',
      'revoke',
      'next',
    ];
  }
  if (props.simple) {
    return [
      'bold',
      'italic',
      '-',
      'quote',
      'unorderedList',
      'orderedList',
      '-',
      'link',
      'image',
      '-',
      'revoke',
      'next',
      'preview',
      '-',
      0,
    ];
  }
  return [
    'bold',
    'underline',
    'italic',
    '-',
    'strikeThrough',
    'title',
    'sub',
    'sup',
    'quote',
    'unorderedList',
    'orderedList',
    'task',
    '-',
    'codeRow',
    'code',
    'link',
    'image',
    'table',
    'mermaid',
    'katex',
    '-',
    'revoke',
    'next',
    'save',
    'preview',
    'htmlPreview',
    '-',
    0,
  ];
});

const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const isDark = ref(document.documentElement.classList.contains('dark'));
let themeObserver: MutationObserver | null = null;

const handleUploadImg = async (files: FileList, callback: (urls: string[]) => void) => {
  if (!props.uploadUrl) {
    ElMessage.warning('当前编辑器未配置图片上传服务');
    return;
  }
  try {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append(props.uploadField || 'image', files[i]);
      const { data } = await api.post(props.uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.url) urls.push(data.url);
      else throw new Error('服务器响应中未包含文件链接');
    }
    callback(urls);
    ElMessage.success('图片上传成功');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '图片上传失败，请重试'));
  }
};

// ────────────────────────────────────────────────────────────────
// Inline AI logic for simple/top toolbar
// ────────────────────────────────────────────────────────────────
const isGeneratingInline = ref(false);
const inlineActionType = ref<'polish' | 'format' | 'generate' | ''>('');
const inlinePrompt = ref('');
const previousText = ref('');
const canUndoInline = ref(false);
const inlineAbortCtrl = ref<AbortController | null>(null);

const stopInlineGeneration = () => {
  if (inlineAbortCtrl.value) {
    inlineAbortCtrl.value.abort();
    inlineAbortCtrl.value = null;
  }
  isGeneratingInline.value = false;
  inlineActionType.value = '';
};

const undoInlineAI = () => {
  if (canUndoInline.value) {
    text.value = previousText.value;
    canUndoInline.value = false;
    ElMessage.success('已还原至 AI 修改前的状态');
  }
};

const triggerInlineAI = async (type: 'polish' | 'format' | 'generate') => {
  if (isGeneratingInline.value) return;

  const currentText = text.value.trim();

  if (type !== 'generate' && !currentText) {
    ElMessage.warning('内容框为空，请先输入粗稿或基础文本');
    return;
  }
  if (type === 'generate' && !inlinePrompt.value.trim()) {
    ElMessage.warning('请输入创作要求，例如：“写一段关于大理石材质的说明”');
    return;
  }

  previousText.value = text.value;
  canUndoInline.value = true;

  isGeneratingInline.value = true;
  inlineActionType.value = type;
  inlineAbortCtrl.value = new AbortController();

  let action = 'polish';
  let instruction = '';
  let requestPrompt = '';

  if (type === 'polish') {
    action = 'polish';
    instruction = '请在保留原文主旨的基础上，润色文字，纠正错别字，优化语法，使语言流畅且更为专业。只输出润色后的Markdown正文。';
  } else if (type === 'format') {
    action = 'polish';
    instruction = '请在保持原文核心信息的基础上进行 Markdown 格式排版。请整理出合理的层级结构，添加适当的二级或三级标题（如：基本特性、使用场景、技术规格等），并使用无序列表或加粗元素，只输出最终排版完成的 Markdown 文本。';
  } else if (type === 'generate') {
    action = 'generate';
    requestPrompt = inlinePrompt.value;
    instruction = '请根据用户指令撰写一段高质量的产品/材质/插件的描述内容。使用标准的 Markdown 格式排版，确保条理清晰、格式美观。只输出最终的 Markdown 文本。';
  }

  text.value = '';

  try {
    const response = await fetch('/api/ai/write-assist', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        action,
        text: currentText,
        prompt: action === 'generate' ? requestPrompt : undefined,
        instruction: instruction || undefined,
        scope: 'full',
        tone: 'balanced',
        length: 'balanced',
        format: type === 'format' ? 'outline' : 'keep',
      }),
      signal: inlineAbortCtrl.value.signal,
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取数据');

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.text) {
          text.value += payload.text;
        }
      },
      () => {
        isGeneratingInline.value = false;
        inlineActionType.value = '';
        inlineAbortCtrl.value = null;
        if (type === 'generate') {
          inlinePrompt.value = '';
        }
        ElMessage.success('AI 协同排版完成');
      },
      (err) => {
        if (err.name === 'AbortError') return;
        text.value = previousText.value;
        ElMessage.error(`AI 协同处理出错：${err.message}`);
        isGeneratingInline.value = false;
        inlineActionType.value = '';
        inlineAbortCtrl.value = null;
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    text.value = previousText.value;
    const message = error instanceof Error ? error.message : 'AI 生成失败，请重试';
    ElMessage.error(message);
    isGeneratingInline.value = false;
    inlineActionType.value = '';
    inlineAbortCtrl.value = null;
  }
};

const handleResize = () => {
  checkMobile();
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', handleResize);
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  themeObserver?.disconnect();
  stopInlineGeneration();
});
</script>

<template>
  <div
    class="mdw"
    :class="{ 'is-dark': isDark, 'h-full': height === '100%', 'mdw--simple': props.simple }"
    @mouseup="onEditorInteract"
    @keyup="onEditorInteract"
  >
    <!-- AI Quick Action Bar -->
    <div v-if="!previewOnly" class="mdw__ai-bar">
      <div class="mdw__ai-btns">
        <div class="mdw__ai-tag" title="AI 智能写作">
          <Sparkles class="w-4 h-4 animate-pulse text-purple-400" />
        </div>
        
        <button
          type="button"
          class="mdw__ai-btn"
          :class="{ 'mdw__ai-btn--loading': isGeneratingInline && inlineActionType === 'polish' }"
          :disabled="isGeneratingInline"
          @click="triggerInlineAI('polish')"
        >
          <span v-if="isGeneratingInline && inlineActionType === 'polish'" class="inline-spinner" />
          <span>✨ 一键润色</span>
        </button>

        <button
          type="button"
          class="mdw__ai-btn mdw__ai-btn--primary"
          :class="{ 'mdw__ai-btn--loading': isGeneratingInline && inlineActionType === 'format' }"
          :disabled="isGeneratingInline"
          @click="triggerInlineAI('format')"
        >
          <span v-if="isGeneratingInline && inlineActionType === 'format'" class="inline-spinner" />
          <span>🪄 智能排版</span>
        </button>

        <button
          v-if="canUndoInline && !isGeneratingInline"
          type="button"
          class="mdw__ai-btn mdw__ai-btn--undo"
          @click="undoInlineAI"
        >
          <span>撤销修改</span>
        </button>

        <button
          v-if="isGeneratingInline"
          type="button"
          class="mdw__ai-btn mdw__ai-btn--stop"
          @click="stopInlineGeneration"
        >
          <Square class="w-2 h-2 fill-current" />
          <span>停止</span>
        </button>
      </div>

      <div class="mdw__ai-input-wrap">
        <input
          v-model="inlinePrompt"
          type="text"
          placeholder="输入您的指令，由 AI 扩写..."
          class="mdw__ai-input"
          :disabled="isGeneratingInline"
          @keydown.enter.prevent="triggerInlineAI('generate')"
        />
        <button
          type="button"
          class="mdw__ai-send"
          :class="{ 'mdw__ai-send--active': inlinePrompt.trim() && !isGeneratingInline }"
          :disabled="!inlinePrompt.trim() || isGeneratingInline"
          @click="triggerInlineAI('generate')"
        >
          <Send class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Preview-only -->
    <MdPreview
      v-if="previewOnly"
      :id="editorId"
      :model-value="modelValue"
      :theme="isDark ? 'dark' : 'light'"
      :transform-img-url="getAssetUrl"
      class="mdw__preview-only"
    />

    <!-- Editor -->
    <MdEditor
      v-else
      :id="editorId"
      ref="editorRef"
      :key="String(props.preview)"
      v-model="text"
      :placeholder="placeholder"
      :style="{ height }"
      :theme="isDark ? 'dark' : 'light'"
      :language="editorLanguage"
      :preview="props.simple ? false : props.preview"
      :html-preview="props.htmlPreview"
      :auto-focus="autoFocus"
      :auto-height="autoHeight"
      :toolbars="toolbars"
      :transform-img-url="getAssetUrl"
      class="mdw__editor"
      @on-upload-img="handleUploadImg"
    >
      <template #defToolbars>
        <NormalToolbar title="AI 协同写作" @on-click="togglePanel">
          <template #trigger>
            <Sparkles
              class="w-4 h-4 cursor-pointer transition-colors duration-200"
              :class="showPanel ? 'text-purple-500' : 'text-purple-400 hover:text-purple-500'"
            />
          </template>
        </NormalToolbar>
      </template>
    </MdEditor>

    <!-- AI Collaborative Panel Component -->
    <MarkdownAiPanel
      :show="showPanel"
      :editor-text="text"
      :selected-text="savedSel.text"
      :is-dark="isDark"
      @close="closePanel"
      @apply="handleAiApply"
    />
  </div>
</template>

<style>
/* ── AI Quick Action Bar ────────────────────────── */
.mdw__ai-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--bg-card) 92%, #8b5cf6) 0%,
    color-mix(in srgb, var(--bg-card) 94%, #14b8a6) 40%,
    var(--bg-card) 100%
  );
  border: 1px solid var(--border-base);
  border-bottom: none;
  border-radius: 0.75rem 0.75rem 0 0;
  flex-wrap: nowrap;
  transition: all 0.3s ease;
}

/* 极简模式下取消编辑器顶部的多余边框和圆角 */
.mdw--simple .md-editor {
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
  border-top: none !important;
}

.mdw__ai-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mdw__ai-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 6px;
}

.mdw__ai-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.mdw__ai-btn:hover:not(:disabled) {
  border-color: #8b5cf6;
  color: #8b5cf6;
  background: color-mix(in srgb, #8b5cf6 8%, transparent);
}

.mdw__ai-btn--primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: none;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(139, 92, 246, 0.2);
}

.mdw__ai-btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(139, 92, 246, 0.35);
}

.mdw__ai-btn--undo {
  border-color: #f59e0b;
  color: #f59e0b;
  background: color-mix(in srgb, #f59e0b 6%, transparent);
}
.mdw__ai-btn--undo:hover {
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  border-color: #d97706;
  color: #d97706;
}

.mdw__ai-btn--stop {
  border-color: #ef4444;
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 6%, transparent);
}
.mdw__ai-btn--stop:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
}

.mdw__ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mdw__ai-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 3px 6px;
  flex: 1;
  min-width: 140px;
  max-width: 100%;
  transition: all 0.2s ease;
}

.mdw__ai-input-wrap:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2);
}

.mdw__ai-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 11px;
  color: var(--text-primary);
  height: 20px;
  font-family: inherit;
}

.mdw__ai-input::placeholder {
  color: var(--text-muted);
}

.mdw__ai-send {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: none;
  background: var(--border-base);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  transition: all 0.2s ease;
}

.mdw__ai-send--active {
  background: #8b5cf6;
  color: #ffffff;
  cursor: pointer;
}

.mdw__ai-send--active:hover {
  background: #7c3aed;
}

/* Spinner for loading state */
.inline-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 0.8s linear infinite;
  margin-right: 2px;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* ── Outer wrapper ──────────────────────────────── */
.mdw {
  --md-bk-color: var(--bg-card);
  --md-color: var(--text-primary);
  position: relative;
  width: 100%;
}
.mdw.h-full {
  height: 100%;
}

/* ── Editor ─────────────────────────────────────── */
.mdw__editor {
  width: 100%;
}

.mdw .md-editor {
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--border-base) !important;
  background-color: var(--bg-card) !important;
  transition: border-color 0.2s ease;
}
.mdw .md-editor:focus-within {
  border-color: var(--accent) !important;
}

.mdw .md-editor-toolbar {
  flex-wrap: wrap !important;
}
.mdw .md-editor-toolbar-wrapper {
  background-color: var(--bg-card) !important;
  border-bottom: 1px solid var(--border-base) !important;
  height: auto !important;
}
.mdw .md-editor-content {
  background-color: var(--bg-card) !important;
}
.mdw .md-editor-input {
  background-color: var(--bg-app) !important;
  color: var(--text-primary) !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
}
.mdw .md-editor-preview {
  background-color: var(--bg-card) !important;
  color: var(--text-primary) !important;
}

.mdw img {
  max-width: 90% !important;
  max-height: 55vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  border-radius: 12px !important;
  margin: 24px auto !important;
  display: block !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06) !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  transition:
    transform 0.3s,
    box-shadow 0.3s !important;
}
.mdw img:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1) !important;
}

.mdw .md-editor-content-wrapper::-webkit-scrollbar {
  width: 6px;
}
.mdw .md-editor-content-wrapper::-webkit-scrollbar-track {
  background: transparent;
}
.mdw .md-editor-content-wrapper::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}

.mdw.is-dark .md-editor {
  --md-bk-color: var(--bg-card);
}
.mdw.is-dark .md-editor-toolbar-item svg {
  fill: var(--text-secondary);
}
.mdw.is-dark .md-editor-toolbar-item:hover svg {
  fill: var(--accent);
}

@media (max-width: 767px) {
  .mdw .md-editor-toolbar-wrapper {
    padding: 4px 6px !important;
    overflow-x: hidden !important;
  }
  .mdw .md-editor-toolbar {
    display: flex !important;
    justify-content: space-between !important;
    flex-wrap: nowrap !important;
    overflow-x: hidden !important;
    width: 100% !important;
  }
  .mdw .md-editor-toolbar-item {
    min-width: 26px !important;
    height: 26px !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
  }
  .mdw .md-editor-toolbar-item svg {
    width: 14px !important;
    height: 14px !important;
  }
}

.mdw__preview-only {
  background: transparent !important;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary) !important;
  border: none !important;
}
.mdw__preview-only .md-editor-preview-wrapper {
  padding: 0 !important;
  border: none !important;
}
</style>
