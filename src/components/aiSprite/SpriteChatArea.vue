<script setup lang="ts">
import { defineAsyncComponent, nextTick, ref } from 'vue';
import {
  Sparkles,
  Plus,
  Trash2,
  Minimize2,
  Maximize2,
  X,
  Menu,
  Brain,
  ChevronUp,
  ChevronDown,
  Globe,
  Copy,
  Check,
  RefreshCw,
  Image,
  Cpu,
  Database,
  Cloud,
  Settings,
  Square,
  Send,
  Pencil,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3/lib/es/MdPreview.mjs'));
import 'md-editor-v3/lib/style.css';

interface MessageSource {
  title: string;
  link: string;
  domain: string;
  publishedAt?: string;
  evidenceTier?: 'primary' | 'strong' | 'context' | 'weak';
  evidenceType?: string;
  sourceIndex?: number;
  credibilityScore?: number;
  freshnessLabel?: string;
  dateConfidence?: 'known' | 'unknown';
  qualitySignals?: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sessionId?: string;
  sessionTitle?: string;
  createdAt?: string;
  reasoning?: string;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
  sources?: MessageSource[];
  isSourcesExpanded?: boolean;
}

interface AiModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  isAuto?: boolean;
}

const props = defineProps<{
  isMobile: boolean;
  showMobileSidebar: boolean;
  currentConversationTitle: string;
  currentConversationMeta: string;
  isFullscreen: boolean;
  isOpen: boolean;
  shouldShowLandingState: boolean;
  activeSessionMessages: Message[];
  currentSessionId: string;
  isGenerating: boolean;
  isTyping: boolean;
  uploadedImages: { url: string; name: string }[];
  isUploading: boolean;
  uploadError: string;
  inputMessage: string;
  chatMode: 'default' | 'search' | 'research';
  availableAiModels: AiModel[];
  currentModel: AiModel | null;
  showModelDropdown: boolean;
  isDark: boolean;
  copiedIndex: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:showMobileSidebar', val: boolean): void;
  (e: 'update:isFullscreen', val: boolean): void;
  (e: 'update:isOpen', val: boolean): void;
  (e: 'update:inputMessage', val: string): void;
  (e: 'update:chatMode', val: 'default' | 'search' | 'research'): void;
  (e: 'update:showModelDropdown', val: boolean): void;
  (e: 'select-model', id: string): void;
  (e: 'start-new-chat'): void;
  (e: 'clear-history'): void;
  (e: 'copy-message', content: string, id: string): void;
  (e: 'regenerate-response'): void;
  (e: 'drag-start', event: MouseEvent): void;
  (e: 'upload-files', files: FileList): void;
  (e: 'remove-image', index: number): void;
  (e: 'handle-send'): void;
  (e: 'handle-stop'): void;
  (e: 'paste', event: ClipboardEvent): void;
  (e: 'edit-message', id: string, newContent: string): void;
}>();

const chatContainer = ref<HTMLDivElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const providerMeta: Record<
  string,
  { color: string; bg: string; border: string; label: string; lucideIcon: any }
> = {
  AGNES: {
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.2)',
    label: 'Agnes',
    lucideIcon: Cpu,
  },
  DEEPSEEK: {
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.2)',
    label: 'DeepSeek',
    lucideIcon: Cpu,
  },
  OPENAI: {
    color: '#10a37f',
    bg: 'rgba(16,163,127,0.08)',
    border: 'rgba(16,163,127,0.2)',
    label: 'OpenAI',
    lucideIcon: Sparkles,
  },
  OLLAMA: {
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.2)',
    label: 'Ollama',
    lucideIcon: Database,
  },
  QWEN: {
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.08)',
    border: 'rgba(234,88,12,0.2)',
    label: 'Qwen',
    lucideIcon: Globe,
  },
  GEMINI: {
    color: '#db2777',
    bg: 'rgba(219,39,119,0.08)',
    border: 'rgba(219,39,119,0.2)',
    label: 'Gemini',
    lucideIcon: Sparkles,
  },
  AZURE: {
    color: '#0284c7',
    bg: 'rgba(2,132,199,0.08)',
    border: 'rgba(2,132,199,0.2)',
    label: 'Azure',
    lucideIcon: Cloud,
  },
  CUSTOM: {
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.2)',
    label: 'Custom',
    lucideIcon: Settings,
  },
};

const getProviderMeta = (provider: string) => providerMeta[provider] || providerMeta.CUSTOM;

const chatModeOptions = [
  { value: 'default', label: '普通对话', icon: Sparkles },
  { value: 'search', label: '联网搜索', icon: Globe },
  { value: 'research', label: '深度研究', icon: Brain },
] as const;

// Auto-growing textarea logic locally
const handleTextareaInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  target.style.height = `${Math.min(200, target.scrollHeight)}px`;
  emit('update:inputMessage', target.value);
};

// Keyboard actions inside textarea
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (!props.isGenerating && !props.isTyping) {
      emit('handle-send');
    }
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) {
    emit('upload-files', target.files);
  }
};

const handlePaste = (event: ClipboardEvent) => {
  emit('paste', event);
};

const messageRefs = new Map<string, HTMLElement>();
const setMessageRef = (id: string, element: Element | null) => {
  if (element instanceof HTMLElement) {
    messageRefs.set(id, element);
  } else {
    messageRefs.delete(id);
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const focusTextarea = () => {
  textareaRef.value?.focus();
};

const resetTextareaHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
};

const editingMessageId = ref<string | null>(null);
const editingContent = ref<string>('');
const editingImages = ref<{ url: string; name: string }[]>([]);
const editTextareaRef = ref<HTMLTextAreaElement | null>(null);

const parseImagesFromMarkdown = (content: string) => {
  const images: { url: string; name: string }[] = [];
  const regex = /!\[([^\]]*?)\]\(([^)]+?)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push({
      name: match[1],
      url: match[2],
    });
  }
  const cleanText = content.replace(/!\[[^\]]*?\]\([^)]+?\)/g, '').trim();
  return { images, cleanText };
};

const startEditMessage = (msg: Message) => {
  editingMessageId.value = msg.id;
  const parsed = parseImagesFromMarkdown(msg.content);
  editingImages.value = parsed.images;
  editingContent.value = parsed.cleanText;
  nextTick(() => {
    editTextareaRef.value?.focus();
  });
};

const handleEditKeydown = (event: KeyboardEvent, msg: Message) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    saveAndSubmitEdit(msg);
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
};

const saveAndSubmitEdit = (msg: Message) => {
  const trimmedText = editingContent.value.trim();
  let finalContent = trimmedText;
  if (editingImages.value.length > 0) {
    const imageMarkdown = editingImages.value
      .map((image) => `![${image.name}](${image.url})`)
      .join('\n');
    finalContent = trimmedText ? `${imageMarkdown}\n\n${trimmedText}` : imageMarkdown;
  }

  if (!finalContent.trim()) return;

  if (finalContent === msg.content) {
    cancelEdit();
    return;
  }

  emit('edit-message', msg.id, finalContent);
  cancelEdit();
};

const cancelEdit = () => {
  editingMessageId.value = null;
  editingContent.value = '';
  editingImages.value = [];
};

defineExpose({
  scrollToBottom,
  focusTextarea,
  resetTextareaHeight,
  chatContainer,
  messageRefs,
  textareaRef,
});
</script>

<template>
  <section class="ai-main flex min-w-0 flex-1 flex-col">
    <header
      class="flex items-center justify-between gap-3 border-b px-4 py-4 md:px-6 select-none cursor-move"
      style="border-color: rgba(148, 163, 184, 0.14)"
      @mousedown="emit('drag-start', $event)"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <!-- Mobile Sidebar Toggle -->
          <button
            v-if="isMobile"
            type="button"
            class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
            title="历史会话"
            @click="emit('update:showMobileSidebar', !showMobileSidebar)"
          >
            <Menu class="h-4 w-4" />
          </button>

          <div class="ai-logo ai-logo--small md:hidden">
            <Sparkles class="h-3.5 w-3.5" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {{ currentConversationTitle }}
            </p>
            <p class="text-xs text-slate-400">{{ currentConversationMeta }}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Mobile New Chat Button -->
        <button
          type="button"
          class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 md:hidden"
          title="新建对话"
          @click="emit('start-new-chat')"
        >
          <Plus class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-rose-500"
          title="清空历史"
          @click="emit('clear-history')"
        >
          <Trash2 class="h-4 w-4" />
        </button>
        <!-- Fullscreen Toggle (Desktop Only) -->
        <button
          v-if="!isMobile"
          type="button"
          class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
          :title="isFullscreen ? '退出全屏' : '全屏'"
          @click="emit('update:isFullscreen', !isFullscreen)"
        >
          <component :is="isFullscreen ? Minimize2 : Maximize2" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
          title="关闭"
          @click="emit('update:isOpen', false)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </header>

    <div
      ref="chatContainer"
      class="ai-chat-content relative min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6 ai-scrollbar"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          class="absolute left-[-120px] top-[10%] h-72 w-72 rounded-full bg-rose-200/30 blur-3xl"
        ></div>
        <div
          class="absolute right-[-120px] top-[38%] h-72 w-72 rounded-full bg-amber-100/45 blur-3xl"
        ></div>
      </div>

      <div class="relative mx-auto w-full max-w-4xl space-y-5">
        <div
          v-if="shouldShowLandingState"
          class="flex min-h-[260px] flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <div class="ai-empty-badge">
            <Sparkles class="h-7 w-7" />
          </div>
          <div>
            <p class="text-lg font-semibold text-slate-700 dark:text-slate-200">
              有什么可以帮忙的吗？
            </p>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              你可以让我整理学习路线、分析项目、解释代码，或者继续处理当前任务。
            </p>
          </div>
        </div>

        <div
          v-for="(msg, index) in activeSessionMessages"
          :key="msg.id"
          :ref="(el) => setMessageRef(msg.id, el as Element | null)"
          class="flex gap-3"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <template v-if="msg.role === 'assistant'">
            <div class="ai-logo ai-logo--small mt-1 hidden shrink-0 md:flex">
              <Sparkles class="h-3.5 w-3.5" />
            </div>
          </template>

          <div class="group max-w-[92%] md:max-w-[90%]">
            <div
              class="rounded-[22px] px-[18px] py-[12px] shadow-xs"
              :class="
                msg.role === 'user'
                  ? editingMessageId === msg.id
                    ? 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-auto'
                    : 'ai-user-bubble ml-auto'
                  : 'ai-assistant-bubble'
              "
            >
              <div
                v-if="msg.role === 'assistant' && (msg.reasoning || msg.isThinking)"
                class="mb-2.5 border-b border-dashed border-slate-200/80 pb-2.5 text-xs text-slate-500"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 text-left font-medium transition hover:text-slate-700 dark:hover:text-slate-300"
                  @click="msg.isThinkingExpanded = !msg.isThinkingExpanded"
                >
                  <Brain
                    class="h-3.5 w-3.5"
                    :class="msg.isThinking ? 'animate-pulse text-rose-400' : ''"
                  />
                  <span>{{ msg.isThinking ? '思考中...' : '思考过程' }}</span>
                  <component
                    :is="msg.isThinkingExpanded ? ChevronUp : ChevronDown"
                    class="ml-auto h-3.5 w-3.5 text-slate-400"
                  />
                </button>
                <div
                  v-show="msg.isThinkingExpanded"
                  class="thinking-content mt-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 px-3 py-2 leading-6 ai-scrollbar border border-slate-100 dark:border-slate-800"
                >
                  <span
                    v-if="!msg.reasoning && msg.isThinking"
                    class="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500"
                  >
                    <span
                      class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600"
                    ></span>
                    <span
                      class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600 [animation-delay:0.15s]"
                    ></span>
                    <span
                      class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-600 [animation-delay:0.3s]"
                    ></span>
                  </span>
                  <span v-else>{{ msg.reasoning }}</span>
                </div>
              </div>

              <!-- Collapsible Reference Sources -->
              <div
                v-if="msg.role === 'assistant' && msg.sources && msg.sources.length > 0"
                class="mb-2.5 border-b border-dashed border-slate-200/80 pb-2.5 text-xs text-slate-500"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 text-left font-medium transition hover:text-slate-700 dark:hover:text-slate-300"
                  @click="msg.isSourcesExpanded = !msg.isSourcesExpanded"
                >
                  <Globe class="h-3.5 w-3.5 text-blue-500" />
                  <span>参考来源 ({{ msg.sources.length }})</span>
                  <component
                    :is="msg.isSourcesExpanded ? ChevronUp : ChevronDown"
                    class="ml-auto h-3.5 w-3.5 text-slate-400"
                  />
                </button>
                <div
                  v-show="msg.isSourcesExpanded"
                  class="mt-2 max-h-[220px] overflow-y-auto rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 p-2.5 leading-6 ai-scrollbar border border-slate-100 dark:border-slate-800"
                >
                  <div class="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                    <a
                      v-for="(source, sIdx) in msg.sources"
                      :key="source.link"
                      :href="source.link"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex flex-col gap-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-2.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs transition"
                    >
                      <div class="flex items-center justify-between gap-1.5">
                        <span
                          class="shrink-0 rounded-md bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
                        >
                          [{{ sIdx + 1 }}]
                        </span>
                        <span
                          class="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500"
                        >
                          <span class="truncate">
                            {{ source.domain || 'unknown' }}
                          </span>
                          <span
                            v-if="source.publishedAt"
                            class="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          >
                            {{ source.publishedAt.slice(0, 10) }}
                          </span>
                        </span>
                      </div>
                      <p
                        class="line-clamp-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-normal hover:text-blue-500 dark:hover:text-blue-400 transition"
                        :title="source.title"
                      >
                        {{ source.title }}
                      </p>
                    </a>
                  </div>
                </div>
              </div>

              <div v-if="msg.role === 'user' && editingMessageId === msg.id" class="flex flex-col gap-2 min-w-[240px] sm:min-w-[320px] py-1">
                <!-- Image Previews for editing -->
                <div v-if="editingImages.length > 0" class="flex flex-wrap gap-2 mb-2">
                  <div
                    v-for="(image, imgIdx) in editingImages"
                    :key="image.url"
                    class="group relative h-12 w-12 overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 dark:bg-slate-800/80"
                  >
                    <img
                      :src="getAssetUrl(image.url)"
                      :alt="image.name"
                      class="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      class="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 cursor-pointer"
                      title="删除图片"
                      @click="editingImages.splice(imgIdx, 1)"
                    >
                      <X class="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  ref="editTextareaRef"
                  v-model="editingContent"
                  rows="3"
                  class="w-full resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  @keydown="handleEditKeydown($event, msg)"
                />
                <div class="flex justify-end gap-2 text-[11px]">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700 transition"
                    @click="saveAndSubmitEdit(msg)"
                  >
                    保存并提交
                  </button>
                </div>
              </div>
              <MdPreview
                v-else
                :model-value="msg.content"
                :theme="isDark ? 'dark' : 'light'"
                class="ai-preview"
              />
            </div>

            <div
              class="mt-2 flex items-center gap-3 px-1 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <button
                v-if="msg.role === 'user' && !isGenerating && !isTyping"
                type="button"
                class="flex items-center gap-1 transition hover:text-slate-700"
                @click="startEditMessage(msg)"
              >
                <Pencil class="h-3.5 w-3.5" />
                <span>编辑</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1 transition hover:text-slate-700"
                @click="emit('copy-message', msg.content, msg.id)"
              >
                <component :is="copiedIndex === msg.id ? Check : Copy" class="h-3.5 w-3.5" />
                <span>{{ copiedIndex === msg.id ? '已复制' : '复制内容' }}</span>
              </button>
              <button
                v-if="
                  msg.role === 'assistant' &&
                  index === activeSessionMessages.length - 1 &&
                  !isGenerating &&
                  !isTyping
                "
                type="button"
                class="flex items-center gap-1 transition hover:text-slate-700"
                @click="emit('regenerate-response')"
              >
                <RefreshCw class="h-3.5 w-3.5" />
                <span>重新生成</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer
      class="border-t px-4 pb-4 pt-3 md:px-6 md:pb-5"
      style="border-color: rgba(148, 163, 184, 0.14)"
    >
      <div class="mx-auto max-w-4xl">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          class="hidden"
          @change="handleFileChange"
        />

        <div
          v-if="uploadedImages.length > 0 || isUploading"
          class="mb-3 flex flex-wrap gap-2 rounded-[22px] border border-slate-200/80 bg-white/70 p-3"
        >
          <div
            v-for="(image, imgIdx) in uploadedImages"
            :key="image.url"
            class="group relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-200/80"
          >
            <img
              :src="getAssetUrl(image.url)"
              :alt="image.name"
              class="h-full w-full object-cover"
            />
            <button
              type="button"
              class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              @click="emit('remove-image', imgIdx)"
            >
              <X class="h-3 w-3" />
            </button>
          </div>

          <div
            v-if="isUploading"
            class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white"
          >
            <span
              class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
            ></span>
          </div>
        </div>

        <p v-if="uploadError" class="mb-2 px-1 text-xs text-rose-500">{{ uploadError }}</p>

        <div
          class="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-900/80 p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
        >
          <textarea
            ref="textareaRef"
            :value="inputMessage"
            class="min-h-[36px] w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="输入你的问题或需求，按 Enter 发送，Shift + Enter 换行"
            :disabled="isGenerating || isTyping"
            rows="1"
            @input="handleTextareaInput"
            @keydown="handleKeydown"
            @paste="handlePaste"
          />

          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                title="上传图片"
                @click="triggerFileInput"
              >
                <Image class="h-3.5 w-3.5" />
              </button>

              <div
                class="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-0.5"
              >
                <button
                  v-for="option in chatModeOptions"
                  :key="option.value"
                  type="button"
                  class="flex h-7 items-center justify-center rounded-md px-2 text-[10px] sm:text-xs font-medium transition"
                  :class="
                    chatMode === option.value
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  "
                  :title="option.label"
                  @click="emit('update:chatMode', option.value)"
                >
                  <component :is="option.icon" class="h-3.5 w-3.5" />
                  <span class="hidden sm:inline ml-1">{{ option.label }}</span>
                </button>
              </div>

              <div
                v-if="availableAiModels.length > 0"
                class="model-select-dropdown-container relative"
              >
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] sm:text-xs font-medium transition hover:opacity-90"
                  :style="
                    currentModel?.id === '__AUTO__'
                      ? 'background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; border-color: transparent;'
                      : `background: ${getProviderMeta(currentModel?.provider || '').bg}; color: ${getProviderMeta(currentModel?.provider || '').color}; border-color: ${getProviderMeta(currentModel?.provider || '').border};`
                  "
                  @click.stop="emit('update:showModelDropdown', !showModelDropdown)"
                >
                  <component
                    v-if="currentModel?.id !== '__AUTO__'"
                    :is="getProviderMeta(currentModel?.provider || '').lucideIcon"
                    class="h-3.5 w-3.5"
                  />
                  <Sparkles v-else class="h-3.5 w-3.5" />
                  <span class="hidden sm:inline">{{ currentModel?.name || '自动' }}</span>
                  <ChevronDown class="h-3.5 w-3.5" />
                </button>

                <Transition name="fade">
                  <div
                    v-if="showModelDropdown"
                    class="absolute bottom-[calc(100%+10px)] left-0 z-20 min-w-[280px] overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl"
                    style="
                      box-shadow:
                        0 20px 48px rgba(15, 23, 42, 0.14),
                        0 0 0 1px rgba(148, 163, 184, 0.08);
                    "
                  >
                    <!-- Header -->
                    <div
                      class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5"
                    >
                      <Cpu class="h-4 w-4 text-slate-400" />
                      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400"
                        >选择 AI 模型</span
                      >
                    </div>

                    <!-- Options -->
                    <div class="max-h-[300px] overflow-y-auto p-1.5 space-y-0.5 ai-scrollbar">
                      <button
                        v-for="model in availableAiModels"
                        :key="model.id"
                        type="button"
                        class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition"
                        :class="
                          model.id === '__AUTO__'
                            ? 'bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 hover:from-indigo-100 hover:to-violet-100 dark:hover:from-indigo-900/40 dark:hover:to-violet-900/40 border border-indigo-200/60 dark:border-indigo-700/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        "
                        @click="
                          emit('select-model', model.id);
                          emit('update:showModelDropdown', false);
                        "
                      >
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <Sparkles v-if="model.id === '__AUTO__'" class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span
                              class="truncate text-xs font-semibold"
                              :class="model.id === '__AUTO__' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'"
                            >
                              {{ model.name }}
                            </span>
                          </div>
                          <p v-if="model.id === '__AUTO__'" class="mt-0.5 text-[9px] text-indigo-500/80 dark:text-indigo-400/70">
                            按优先级自动选择，失败时无缝切换
                          </p>
                        </div>
                        <Check
                          v-if="currentModel?.id === model.id"
                          class="ml-2 h-4 w-4 shrink-0"
                          :class="model.id === '__AUTO__' ? 'text-indigo-500' : 'text-emerald-500'"
                        />
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="isGenerating || isTyping"
                type="button"
                class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition hover:bg-rose-600"
                @click="emit('handle-stop')"
              >
                <Square class="h-3.5 w-3.5 fill-current" />
                <span class="hidden sm:inline">停止生成</span>
              </button>
              <button
                v-else
                type="button"
                :disabled="!inputMessage.trim() && uploadedImages.length === 0"
                class="ai-send-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                @click="emit('handle-send')"
              >
                <Send class="h-3.5 w-3.5" />
                <span class="hidden sm:inline">发送</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </section>
</template>

<style scoped>
/* Accent-based Send Button */
.ai-send-btn {
  background: var(--accent) !important;
  box-shadow: 0 10px 20px -5px rgba(var(--accent-rgb), 0.3) !important;
}

.ai-send-btn:hover:not(:disabled) {
  opacity: 0.95;
  box-shadow: 0 12px 24px -5px rgba(var(--accent-rgb), 0.45) !important;
}

.ai-send-btn:disabled {
  opacity: 0.45;
  box-shadow: none !important;
}

.ai-preview {
  background: transparent !important;
}

.ai-preview :deep(.md-editor-preview) {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
  line-height: 1.6 !important;
}

.ai-preview :deep(.md-editor-preview-wrapper) {
  padding: 0 !important;
}

.ai-preview :deep(.md-editor-preview p:first-child) {
  margin-top: 0 !important;
}

.ai-preview :deep(.md-editor-preview p:last-child) {
  margin-bottom: 0 !important;
}

.ai-preview :deep(.md-editor-preview p) {
  margin-top: 4px !important;
  margin-bottom: 4px !important;
}

.ai-preview :deep(.md-editor-preview h1),
.ai-preview :deep(.md-editor-preview h2),
.ai-preview :deep(.md-editor-preview h3),
.ai-preview :deep(.md-editor-preview h4),
.ai-preview :deep(.md-editor-preview h5),
.ai-preview :deep(.md-editor-preview h6) {
  margin-top: 10px !important;
  margin-bottom: 4px !important;
  font-weight: 600 !important;
}

.ai-preview :deep(.md-editor-preview ul),
.ai-preview :deep(.md-editor-preview ol) {
  margin-top: 4px !important;
  margin-bottom: 4px !important;
  padding-left: 20px !important;
}

.ai-preview :deep(.md-editor-preview li) {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}

.ai-preview :deep(.md-editor-preview img) {
  max-width: 220px !important;
  max-height: 150px !important;
  border-radius: 12px !important;
  object-fit: cover !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08) !important;
}

.ai-preview :deep(.md-editor-code pre) {
  border-radius: 16px !important;
  padding: 14px 16px !important;
  font-size: 11px !important;
}

.ai-preview :deep(.md-editor-preview blockquote) {
  margin: 12px 0 !important;
  border-left: 3px solid rgba(244, 114, 182, 0.5) !important;
  background: rgba(255, 241, 242, 0.7) !important;
  color: inherit !important;
  border-radius: 14px !important;
  padding: 12px 14px !important;
}

.dark .ai-preview :deep(.md-editor-preview blockquote) {
  background: rgba(30, 41, 59, 0.75) !important;
}

.ai-preview :deep(.md-editor-preview code) {
  border-radius: 8px !important;
  padding: 2px 6px !important;
}

@media (max-width: 768px) {
  .ai-preview :deep(.md-editor-preview) {
    line-height: 1.55 !important;
  }
  .ai-preview :deep(.md-editor-code pre) {
    padding: 10px 12px !important;
    border-radius: 10px !important;
  }
}
</style>

