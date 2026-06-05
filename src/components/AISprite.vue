<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import {
  Send,
  X,
  Trash2,
  Copy,
  Check,
  Square,
  Brain,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  RefreshCw,
  Image,
  Cpu,
  Sparkles,
  Database,
  Globe,
  Cloud,
  Settings,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import UserAvatar from '@/components/UserAvatar.vue';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import { useDragAndResize } from '@/composables/useDragAndResize';
import { useHolidayTheme } from '@/composables/useHolidayTheme';
import api, { getAssetUrl } from '@/utils/api';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3/lib/es/MdPreview.mjs'));
import('md-editor-v3/lib/style.css');

// State management stores
const authStore = useAuthStore();
const systemStore = useSystemStore();
const route = useRoute();

// UI State Variables
const isOpen = ref(false);
const isGenerating = ref(false);
const isTyping = ref(false);
const inputMessage = ref('');
const showBubble = ref(true);
const streamMeta = ref<{ provider?: string; model?: string; requestId?: string } | null>(null);
const selectedModelId = ref(localStorage.getItem('ai_sprite_model_id') || '');

// Multimodal Upload States
const uploadedImages = ref<{ url: string; name: string }[]>([]);
const isUploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadError = ref('');

const MAX_UPLOAD_IMAGES = 4;
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_UPLOAD_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
let uploadErrorTimer: ReturnType<typeof setTimeout> | null = null;

const showUploadError = (message: string) => {
  uploadError.value = message;
  if (uploadErrorTimer) {
    clearTimeout(uploadErrorTimer);
  }
  uploadErrorTimer = setTimeout(() => {
    uploadError.value = '';
    uploadErrorTimer = null;
  }, 3000);
};

const redactLocalMessage = (content: string) =>
  content
    .replace(
      /\b(?:api[_-]?key|token|secret|password|passwd|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;]+)/gi,
      (match) => match.replace(/([:=]\s*)([^\s,;]+)/, '$1[已脱敏]'),
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [已脱敏]');

const canAttachImage = (file: File) => {
  if (uploadedImages.value.length >= MAX_UPLOAD_IMAGES) {
    showUploadError(`最多可附加 ${MAX_UPLOAD_IMAGES} 张图片`);
    return false;
  }
  if (!SUPPORTED_UPLOAD_IMAGE_TYPES.has(file.type)) {
    showUploadError('仅支持 PNG、JPG、WebP 图片');
    return false;
  }
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    showUploadError('单张图片不能超过 5MB');
    return false;
  }
  return true;
};

/**
 * Triggers the hidden file input.
 */
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

/**
 * Uploads selected image files.
 */
const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  isUploading.value = true;
  try {
    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i];
      if (file.type.startsWith('image/')) {
        await uploadAndAppendImage(file);
      }
    }
  } finally {
    isUploading.value = false;
    target.value = '';
  }
};

/**
 * Captures image files pasted from clipboard.
 */
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        isUploading.value = true;
        try {
          await uploadAndAppendImage(file);
        } finally {
          isUploading.value = false;
        }
      }
    }
  }
};

/**
 * Uploads an image to backend and adds it to the attached list.
 */
const uploadAndAppendImage = async (file: File) => {
  if (!canAttachImage(file)) return;

  const formData = new FormData();
  formData.append('image', file);

  const csrfToken = document.cookie.match(/csrfToken=([^;]+)/)?.[1] || '';

  try {
    const response = await fetch('/api/projects/ai-chat/upload', {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = errText || `Upload HTTP error: ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        message = parsed.error || parsed.message || message;
      } catch {}
      throw new Error(message);
    }

    const result = await response.json();
    if (result.success && result.url) {
      uploadedImages.value.push({
        url: result.url,
        name: result.name || file.name,
      });
      await scrollToBottom();
    } else {
      throw new Error(result.error || '图片上传失败');
    }
  } catch (error) {
    console.error('Failed to upload image:', error);
    showUploadError(error instanceof Error ? error.message : '图片上传失败');
  }
};

/**
 * Removes attached image by index.
 */
const removeUploadedImage = (idx: number) => {
  uploadedImages.value.splice(idx, 1);
};

// DOM reference for auto-scroll
const chatContainer = ref<HTMLDivElement | null>(null);

/**
 * Scroll conversation messages container to bottom.
 */
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// Composable state helpers for drag, resize, and holiday checking
const {
  chatBoxWidth,
  chatBoxHeight,
  isResizing,
  isMaximized,
  position,
  getHasMoved,
  onDragStart,
  onResizeStart,
  toggleMaximize,
  adjustBoxSizeForViewport,
} = useDragAndResize({
  initialWidth: 380,
  initialHeight: 480,
  storageWidthKey: 'ai_sprite_chat_width',
  storageHeightKey: 'ai_sprite_chat_height',
  onPostScroll: scrollToBottom,
});

const { currentHoliday } = useHolidayTheme();

const availableAiModels = computed(() =>
  (systemStore.settings.AI_MODEL_OPTIONS || []).filter((model) => model.enabled),
);

watch(
  availableAiModels,
  (models) => {
    if (models.length === 0) {
      selectedModelId.value = '';
      return;
    }

    const storedModel = models.find((model) => model.id === selectedModelId.value);
    if (!storedModel) {
      selectedModelId.value = models.find((model) => model.isDefault)?.id || models[0].id;
    }
  },
  { immediate: true },
);

watch(selectedModelId, (modelId) => {
  if (modelId) {
    localStorage.setItem('ai_sprite_model_id', modelId);
  } else {
    localStorage.removeItem('ai_sprite_model_id');
  }
});

const showModelDropdown = ref(false);
const currentModel = computed(() => {
  return availableAiModels.value.find((m) => m.id === selectedModelId.value) || availableAiModels.value[0];
});

const providerMeta: Record<string, { color: string; bg: string; border: string; label: string; lucideIcon: any }> = {
  DEEPSEEK: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)', label: 'DeepSeek', lucideIcon: Cpu },
  OPENAI: { color: '#10a37f', bg: 'rgba(16,163,127,0.08)', border: 'rgba(16,163,127,0.25)', label: 'OpenAI', lucideIcon: Sparkles },
  OLLAMA: { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', label: 'Ollama', lucideIcon: Database },
  QWEN: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.25)', label: 'Qwen', lucideIcon: Globe },
  GEMINI: { color: '#db2777', bg: 'rgba(219,39,119,0.08)', border: 'rgba(219,39,119,0.25)', label: 'Gemini', lucideIcon: Sparkles },
  AZURE: { color: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.25)', label: 'Azure', lucideIcon: Cloud },
  CUSTOM: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)', label: 'Custom', lucideIcon: Settings },
};
const getProviderMeta = (provider: string) => providerMeta[provider] || providerMeta.CUSTOM;

const handleDocumentClickForModel = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.model-select-dropdown-container')) {
    showModelDropdown.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', handleDocumentClickForModel);
});

onUnmounted(() => {
  window.removeEventListener('click', handleDocumentClickForModel);
});

// Active LLM Stream Reader & Copy States
let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
const copiedIndex = ref<number | null>(null);

const isDark = ref(document.documentElement.classList.contains('dark'));
let darkObserver: MutationObserver | null = null;
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Chat message contract
interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
}

const createGreetingMessage = (): Message => ({
  role: 'assistant',
  content:
    '您好，我是平台的 AI 企业学习顾问。可以协助您处理 3D 技术问答、项目拆解、学习路线规划、资产质量检查和平台使用问题。请直接描述目标、当前进展或遇到的阻塞点。',
});

const loadGuestHistory = () => {
  const saved = sessionStorage.getItem('ai_sprite_chat_history');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        messages.value = parsed
          .filter((msg) => msg?.role === 'user' || msg?.role === 'assistant')
          .slice(-40);
        return;
      }
    } catch (e) {
      console.warn('Failed to parse local AI chat history:', e);
    }
  }
  messages.value = [createGreetingMessage()];
};

// Initial chat prompt message history
const messages = ref<Message[]>([createGreetingMessage()]);

/**
 * Handles clicks on the mascot sprite. Ignores trigger if dragging just occurred.
 */
const handleSpriteClick = () => {
  if (getHasMoved()) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    showBubble.value = false;
    adjustBoxSizeForViewport();
    scrollToBottom();
  } else {
    isMaximized.value = false;
  }
};

// Loads conversation history. If authenticated, fetches from the database. Otherwise, falls back to sessionStorage.
const loadHistory = async () => {
  if (!authStore.isAuthenticated) {
    loadGuestHistory();
    return;
  }

  try {
    const response = await api.get('/api/projects/ai-chat/history');
    if (response.data && response.data.success && response.data.data.length > 0) {
      messages.value = response.data.data
        .filter((msg: any) => msg?.role === 'user' || msg?.role === 'assistant')
        .slice(-80)
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          reasoning: '',
          isThinking: false,
          isThinkingExpanded: false,
        }));
    } else {
      messages.value = [createGreetingMessage()];
    }
  } catch (error: any) {
    if (error?.response?.status !== 401) {
      console.error('Failed to fetch AI chat history from server:', error);
    }
    loadGuestHistory();
  }
};

// Watch authentication state changes to load corresponding history dynamically
watch(
  () => authStore.isAuthenticated,
  () => {
    loadHistory();
  },
  { immediate: true },
);

// Initialize session state on mount
onMounted(() => {
  // Auto fade out bubble tip after 8 seconds
  setTimeout(() => {
    showBubble.value = false;
  }, 8000);

  // Observe dark class changes on documentElement
  darkObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        isDark.value = document.documentElement.classList.contains('dark');
      }
    });
  });
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

onUnmounted(() => {
  handleStop();
  if (uploadErrorTimer) {
    clearTimeout(uploadErrorTimer);
  }
  if (darkObserver) {
    darkObserver.disconnect();
  }
});

/**
 * Persists messages in session storage.
 */
const saveHistory = () => {
  if (!authStore.isAuthenticated) {
    const safeMessages = messages.value.slice(-40).map((message) => ({
      ...message,
      content: redactLocalMessage(message.content),
      reasoning: undefined,
      isThinking: false,
      isThinkingExpanded: false,
    }));
    sessionStorage.setItem('ai_sprite_chat_history', JSON.stringify(safeMessages));
  }
};

// Typewriter queue: chars pending display + interval handle
const typewriterQueue = ref<{ type: 'text' | 'reasoning'; char: string }[]>([]);
let typewriterTimer: ReturnType<typeof setInterval> | null = null;
let typewriterTargetIndex = -1;

/**
 * Drain one character per tick from the typewriter queue into the message.
 * Scroll happens via requestAnimationFrame at most once per frame.
 */
const startTypewriter = (targetIdx: number) => {
  if (typewriterTimer !== null) return; // already running
  if (targetIdx < 0 || !messages.value[targetIdx]) return;
  typewriterTargetIndex = targetIdx;

  typewriterTimer = setInterval(() => {
    // Drain up to 12 chars per tick (~720 chars/s) — fast enough to keep up with any LLM
    // but still creates a smooth character-by-character visual effect.
    const batch = Math.min(12, typewriterQueue.value.length);
    if (batch === 0) return;
    for (let i = 0; i < batch; i++) {
      const item = typewriterQueue.value.shift();
      if (item !== undefined && messages.value[typewriterTargetIndex]) {
        const msg = messages.value[typewriterTargetIndex];
        if (item.type === 'reasoning') {
          msg.isThinking = true;
          if (!msg.reasoning) msg.reasoning = '';
          msg.reasoning += item.char;
        } else {
          msg.isThinking = false;
          msg.content += item.char;
        }
      }
    }
    // Smart auto-scroll: only scroll if the user is already near the bottom
    const container = chatContainer.value;
    if (container) {
      const threshold = 80;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, 16); // ~60 fps
};

const stopTypewriter = () => {
  if (typewriterTimer !== null) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
};

/**
 * Flush remaining queued chars instantly (used when stream ends or user stops).
 */
const flushTypewriterQueue = (targetIdx: number) => {
  stopTypewriter();
  if (targetIdx < 0 || !messages.value[targetIdx]) {
    typewriterQueue.value = [];
    return;
  }
  while (typewriterQueue.value.length > 0) {
    const item = typewriterQueue.value.shift();
    if (item !== undefined) {
      const msg = messages.value[targetIdx];
      if (item.type === 'reasoning') {
        if (!msg.reasoning) msg.reasoning = '';
        msg.reasoning += item.char;
      } else {
        msg.content += item.char;
      }
    }
  }
};

const adjustTextareaHeight = () => {
  const ta = textareaRef.value;
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(120, ta.scrollHeight)}px`;
};

watch(inputMessage, () => {
  nextTick(adjustTextareaHeight);
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const regenerateResponse = async () => {
  if (isGenerating.value || isTyping.value) return;

  let lastUserMsgIndex = -1;
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      lastUserMsgIndex = i;
      break;
    }
  }

  if (lastUserMsgIndex === -1) return;

  messages.value = messages.value.slice(0, lastUserMsgIndex + 1);
  const lastUserText = messages.value.pop()?.content || '';
  inputMessage.value = lastUserText;
  await handleSend();
};

/**
 * Streams the conversation reply from the backend Server-Sent Events (SSE) API.
 * Uses the browser native fetch API to read chunks on-the-fly.
 * Characters are fed into a typewriter queue to always show smooth char-by-char output.
 */
const handleSend = async () => {
  if (isGenerating.value || isTyping.value) return;

  const textMsg = inputMessage.value.trim();
  if (!textMsg && uploadedImages.value.length === 0) return;

  let userMsg = textMsg;
  if (uploadedImages.value.length > 0) {
    const imageMarkdown = uploadedImages.value
      .map((img) => `![${img.name}](${img.url})`)
      .join('\n');
    userMsg = textMsg ? `${imageMarkdown}\n\n${textMsg}` : imageMarkdown;
  }

  messages.value.push({ role: 'user', content: userMsg });
  inputMessage.value = '';
  uploadedImages.value = [];

  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  });
  saveHistory();
  await scrollToBottom();

  isGenerating.value = true;
  typewriterQueue.value = [];
  streamMeta.value = null;

  try {
    const chatHistory = messages.value.slice(-10);
    // Invoke direct native fetch to stream chunked SSE payloads
    const response = await fetch('/api/projects/ai-chat', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        messages: chatHistory,
        modelId: selectedModelId.value || undefined,
        context: {
          path: route?.path || '',
          title: document.title || '',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response, `HTTP error: ${response.status}`));
    }

    if (!response.body) {
      throw new Error('Readable stream not supported in this browser environment.');
    }

    isGenerating.value = false;
    isTyping.value = true;

    // Insert an empty assistant message block for append-streaming
    messages.value.push({
      role: 'assistant',
      content: '',
      reasoning: '',
      isThinking: false,
      isThinkingExpanded: true,
    });
    const targetIndex = messages.value.length - 1;

    // Start typewriter draining the queue into the message
    startTypewriter(targetIndex);

    activeReader = response.body.getReader();

    await parseSSEStream(
      activeReader,
      (payload) => {
        if (payload.event === 'meta') {
          streamMeta.value = {
            provider: payload.provider,
            model: payload.model,
            requestId: payload.requestId,
          };
        } else if (payload.event === 'heartbeat' || payload.event === 'done') {
          return;
        } else if (payload.error) {
          for (const ch of `\n[错误: ${payload.error}]`) {
            typewriterQueue.value.push({ type: 'text', char: ch });
          }
        } else if (payload.reasoning) {
          for (const ch of payload.reasoning) {
            typewriterQueue.value.push({ type: 'reasoning', char: ch });
          }
        } else if (payload.text) {
          for (const ch of payload.text) {
            typewriterQueue.value.push({ type: 'text', char: ch });
          }
        }
      },
      () => {},
      (err) => {
        throw err;
      },
    );

    // Stream ended — wait for typewriter to fully drain the queue, then stop it cleanly.
    await new Promise<void>((resolve) => {
      const waitDrain = setInterval(() => {
        if (typewriterQueue.value.length === 0) {
          clearInterval(waitDrain);
          resolve();
        }
      }, 20);
    });

    // Auto collapse thinking process after generation completes successfully
    if (messages.value[targetIndex]) {
      messages.value[targetIndex].isThinkingExpanded = false;
    }
  } catch (error: any) {
    console.error('AI streaming chat error:', error);
    isGenerating.value = false;
    flushTypewriterQueue(typewriterTargetIndex); // flush any pending chars on error
    const errMsg = error.message || '连接失败';
    messages.value.push({ role: 'assistant', content: `AI 服务暂时不可用：${errMsg}` });
  } finally {
    stopTypewriter();
    isTyping.value = false;
    activeReader = null;
    saveHistory();
    await scrollToBottom();
  }
};

const clearHistory = async () => {
  messages.value = [
    {
      role: 'assistant',
      content: '历史记录已清空。请告诉我新的目标、问题或需要分析的上下文。',
    },
  ];
  streamMeta.value = null;
  if (authStore.isAuthenticated) {
    try {
      await api.delete('/api/projects/ai-chat/history');
    } catch (error) {
      console.error('Failed to clear AI chat history on server:', error);
    }
  } else {
    saveHistory();
  }
};

/**
 * Stops/cancels the active stream reader generation.
 */
const handleStop = () => {
  if (activeReader) {
    try {
      activeReader.cancel();
    } catch (e) {
      console.error('Failed to cancel active reader:', e);
    }
    activeReader = null;
  }
  // Flush remaining queued typewriter chars instantly on stop
  flushTypewriterQueue(typewriterTargetIndex);
  typewriterQueue.value = [];
  isGenerating.value = false;
  isTyping.value = false;
};

/**
 * Safe clipboard copy utility supporting navigator.clipboard (HTTPS)
 * and standard document.execCommand fallback (HTTP / local development).
 */
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success ? Promise.resolve() : Promise.reject(new Error('Copy command failed'));
  } catch (err) {
    document.body.removeChild(textarea);
    return Promise.reject(err);
  }
};

/**
 * Copies the message text content to the clipboard.
 */
const copyMessage = (text: string, index: number) => {
  copyToClipboard(text)
    .then(() => {
      copiedIndex.value = index;
      setTimeout(() => {
        if (copiedIndex.value === index) {
          copiedIndex.value = null;
        }
      }, 2000);
    })
    .catch((err) => {
      console.error('Failed to copy message:', err);
    });
};
</script>

<template>
  <div
    v-if="systemStore.settings.AI_IMPORT_ENABLED"
    class="fixed z-[99] flex flex-col items-end elf-parent-container"
    :style="
      isMaximized
        ? { top: '24px', left: '24px', right: '24px', bottom: '24px' }
        : { bottom: position.bottom + 'px', right: position.right + 'px' }
    "
    :class="{ 'elf-parent-maximized': isMaximized }"
  >
    <!-- Bubble Tip -->
    <Transition name="fade">
      <div
        v-if="showBubble && !isOpen"
        class="mb-3 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold relative max-w-xs break-all animate-bounce-slow pointer-events-none select-none"
        style="
          background: var(--bg-card);
          border: 1px solid var(--border-base);
          color: var(--text-secondary);
        "
      >
        <span>需要项目、3D 或代码支持时，可以随时打开 AI 顾问。</span>
        <!-- Arrow -->
        <div
          class="absolute bottom-[-6px] right-6 w-3 h-3 rotate-45 border-r border-b"
          style="background: var(--bg-card); border-color: var(--border-base)"
        ></div>
      </div>
    </Transition>

    <!-- Chat Box -->
    <Transition name="slide-fade">
      <div
        v-if="isOpen"
        class="mb-4 rounded-3xl shadow-2xl border flex flex-col overflow-hidden relative backdrop-blur-md animate-none elf-chat-box"
        :class="[
          isResizing ? '' : 'transition-all duration-300',
          isMaximized ? 'is-maximized' : '',
        ]"
        :style="{
          width: isMaximized ? '100%' : chatBoxWidth + 'px',
          height: isMaximized ? '100%' : chatBoxHeight + 'px',
          backgroundColor: 'rgba(var(--bg-card-rgb, 255, 255, 255), 0.85)',
          borderColor: 'var(--border-base)',
        }"
      >
        <!-- Drag resize handles (resizes from top, left, and top-left edges) -->
        <!-- Left edge -->
        <div
          v-if="!isMaximized"
          class="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-30 select-none"
          @mousedown="onResizeStart($event, 'left')"
          @touchstart="onResizeStart($event, 'left')"
        ></div>
        <!-- Top edge -->
        <div
          v-if="!isMaximized"
          class="absolute left-0 right-0 top-0 h-2 cursor-n-resize z-30 select-none"
          @mousedown="onResizeStart($event, 'top')"
          @touchstart="onResizeStart($event, 'top')"
        ></div>
        <!-- Top-left corner -->
        <div
          v-if="!isMaximized"
          class="absolute left-0 top-0 w-4 h-4 cursor-nw-resize z-40 select-none"
          @mousedown="onResizeStart($event, 'top-left')"
          @touchstart="onResizeStart($event, 'top-left')"
        ></div>
        <!-- Top-left visual corner bracket cue -->
        <div
          v-if="!isMaximized"
          class="absolute left-2 top-2 w-2.5 h-2.5 border-l-2 border-t-2 border-slate-400/40 dark:border-slate-500/40 rounded-tl pointer-events-none z-30 elf-resize-bracket"
        ></div>
        <!-- Chat Header (draggable handle to move dialogue window) -->
        <div
          class="px-5 py-3 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-accent/10 to-transparent select-none"
          :class="isMaximized ? '' : 'cursor-grab active:cursor-grabbing'"
          style="border-color: var(--border-base)"
          @mousedown="isMaximized ? undefined : onDragStart($event, isOpen)"
          @touchstart="isMaximized ? undefined : onDragStart($event, isOpen)"
        >
          <div class="flex items-center gap-2.5">
            <!-- Miniature Glowing Mascot inside chat header -->
            <div
              class="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-md relative border overflow-hidden"
              style="border-color: var(--accent)"
            >
              <svg viewBox="0 0 64 64" class="w-7 h-7">
                <path
                  d="M 12 24 L 6 18 M 52 24 L 58 18"
                  stroke="var(--accent)"
                  stroke-width="3"
                  stroke-linecap="round"
                />
                <rect
                  x="10"
                  y="16"
                  width="44"
                  height="36"
                  rx="16"
                  fill="rgba(255, 255, 255, 0.1)"
                  stroke="var(--accent)"
                  stroke-width="2.5"
                />
                <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                <circle cx="23" cy="30" r="2.5" fill="var(--accent)" />
                <circle cx="41" cy="30" r="2.5" fill="var(--accent)" />
                <path
                  d="M 27 37 Q 32 40 37 37"
                  fill="none"
                  stroke="var(--accent)"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              <span
                class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
              ></span>
            </div>
            <div>
              <p class="text-xs font-black tracking-tight" style="color: var(--text-primary)">
                AI 企业学习顾问
              </p>
              <!-- Custom Premium Model Switcher Dropdown -->
              <div v-if="availableAiModels.length > 0" class="relative inline-block mt-0.5 model-select-dropdown-container">
                <button
                  type="button"
                  class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-widest transition-all duration-200 cursor-pointer border shadow-sm select-none"
                  :style="`
                    background: ${getProviderMeta(currentModel?.provider || '').bg};
                    color: ${getProviderMeta(currentModel?.provider || '').color};
                    border-color: ${getProviderMeta(currentModel?.provider || '').border};
                  `"
                  title="切换 AI 模型"
                  @click.stop="showModelDropdown = !showModelDropdown"
                >
                  <component
                    :is="getProviderMeta(currentModel?.provider || '').lucideIcon"
                    class="w-3 h-3"
                    :style="`color: ${getProviderMeta(currentModel?.provider || '').color};`"
                  />
                  <span class="max-w-[110px] truncate">{{ currentModel?.name }}</span>
                  <ChevronDown class="w-2.5 h-2.5 opacity-70" />
                </button>

                <!-- Floating Dropdown list -->
                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <div
                    v-if="showModelDropdown"
                    class="absolute left-0 mt-1.5 w-52 rounded-xl shadow-xl border overflow-hidden z-50 py-1"
                    style="
                      background-color: var(--bg-card);
                      border-color: var(--border-base);
                      backdrop-filter: blur(16px);
                    "
                    @click.stop
                  >
                    <div class="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 select-none">
                      选择 AI 模型
                    </div>
                    <div class="max-h-48 overflow-y-auto scrollbar-hide">
                      <button
                        v-for="model in availableAiModels"
                        :key="model.id"
                        type="button"
                        class="w-full flex items-start gap-2 px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                        :class="model.id === selectedModelId ? 'bg-indigo-500/5 dark:bg-indigo-400/5' : ''"
                        @click.stop="selectedModelId = model.id; showModelDropdown = false"
                      >
                        <component
                          :is="getProviderMeta(model.provider).lucideIcon"
                          class="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                          :style="`color: ${getProviderMeta(model.provider).color};`"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-1">
                            <p
                              class="text-[11px] font-bold truncate"
                              :class="model.id === selectedModelId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'"
                            >
                              {{ model.name }}
                            </p>
                            <span
                              v-if="model.isDefault"
                              class="text-[8px] font-black px-1 rounded select-none"
                              style="background: rgba(251,191,36,0.15); color: #d97706;"
                            >⭐</span>
                          </div>
                          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate">{{ model.modelName }}</p>
                        </div>
                        <span v-if="model.id === selectedModelId" class="text-indigo-500 text-[10px] font-bold select-none">✓</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
              <p v-else class="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">
                {{ streamMeta?.model || '企业级答疑在线' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              :title="isMaximized ? '还原窗口' : '最大化窗口'"
              @click="toggleMaximize"
            >
              <component :is="isMaximized ? Minimize2 : Maximize2" class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
              title="清空会话历史"
              @click="clearHistory"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              @click="
                isOpen = false;
                isMaximized = false;
              "
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Chat messages container -->
        <div
          ref="chatContainer"
          class="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin relative"
          style="background: linear-gradient(180deg, rgba(248, 250, 252, 0.3) 0%, var(--bg-card) 100%);"
        >
          <!-- Decorative Glow Blurs in the background of chat messages -->
          <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03] dark:opacity-[0.06] select-none">
            <div class="absolute -left-10 top-1/4 w-40 h-40 rounded-full blur-3xl" style="background: var(--accent);"></div>
            <div class="absolute -right-10 bottom-1/4 w-40 h-40 rounded-full blur-3xl bg-indigo-500"></div>
          </div>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="flex items-start gap-2.5"
            :class="msg.role === 'user' ? 'flex-row-reverse text-right' : ''"
          >
            <!-- Avatar -->
            <div class="shrink-0">
              <UserAvatar
                v-if="msg.role === 'user'"
                :user="authStore.user ?? undefined"
                size="sm"
              />
              <div
                v-else
                class="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-center shadow-md border overflow-hidden"
                style="border-color: var(--accent)"
              >
                <svg viewBox="0 0 64 64" class="w-6 h-6">
                  <path
                    d="M 12 24 L 6 18 M 52 24 L 58 18"
                    stroke="var(--accent)"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                  <rect
                    x="10"
                    y="16"
                    width="44"
                    height="36"
                    rx="16"
                    fill="rgba(255, 255, 255, 0.1)"
                    stroke="var(--accent)"
                    stroke-width="2.5"
                  />
                  <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                  <circle cx="23" cy="30" r="2.5" fill="var(--accent)" />
                  <circle cx="41" cy="30" r="2.5" fill="var(--accent)" />
                  <path
                    d="M 27 37 Q 32 40 37 37"
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
            </div>

            <!-- Message bubble -->
            <div class="max-w-[75%] flex flex-col space-y-1 group">
              <span class="text-[9px] text-slate-400 font-bold px-1">
                {{ msg.role === 'user' ? authStore.user?.name || '我' : 'AI 顾问' }}
              </span>
              <div
                class="px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words text-left"
                :class="
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-none shadow-md shadow-accent/15'
                    : 'bg-indigo-500/[0.04] dark:bg-indigo-400/[0.03] backdrop-blur-sm rounded-tl-none border border-indigo-500/10 dark:border-indigo-400/10 shadow-sm'
                "
                :style="
                  msg.role === 'user'
                    ? { background: 'var(--accent)' }
                    : { color: 'var(--text-primary)' }
                "
              >
                <!-- Render thinking steps if assistant and reasoning is present -->
                <div
                  v-if="msg.role === 'assistant' && msg.reasoning"
                  class="mb-2 pb-2 border-b border-dashed border-slate-200/60 dark:border-white/10 text-[11px] text-slate-400 dark:text-slate-500 font-sans select-none"
                >
                  <div
                    class="flex items-center gap-1.5 cursor-pointer font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    @click="
                      msg.isThinkingExpanded = msg.isThinkingExpanded === false ? true : false
                    "
                  >
                    <Brain
                      class="w-3.5 h-3.5 text-slate-400"
                      :class="msg.isThinking ? 'animate-pulse text-indigo-500' : ''"
                    />
                    <span>{{ msg.isThinking ? '思考中...' : '已思考' }}</span>
                    <component
                      :is="msg.isThinkingExpanded === false ? ChevronDown : ChevronUp"
                      class="w-3 h-3 text-slate-400 ml-auto shrink-0"
                    />
                  </div>
                  <div
                    v-show="msg.isThinkingExpanded !== false"
                    class="mt-1.5 pl-3.5 pr-2 py-1 text-slate-500/80 dark:text-slate-400/80 italic whitespace-pre-wrap leading-relaxed border-l-2 border-slate-250 dark:border-white/5"
                  >
                    {{ msg.reasoning }}
                  </div>
                </div>

                <div class="markdown-preview-container text-left">
                  <MdPreview
                    :model-value="msg.content"
                    :theme="isDark ? 'dark' : 'light'"
                    class="md-preview-custom"
                    style="
                      background: transparent !important;
                      padding: 0 !important;
                      color: inherit;
                    "
                  />
                </div>
              </div>

              <!-- Message Action Bar (Copy Button & Regenerate) -->
              <div
                v-if="msg.role === 'assistant'"
                class="flex items-center gap-3 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none"
              >
                <button
                  type="button"
                  class="flex items-center gap-1 text-[10px] text-slate-400 hover:text-accent transition-colors cursor-pointer"
                  @click="copyMessage(msg.content, idx)"
                >
                  <component :is="copiedIndex === idx ? Check : Copy" class="w-2.5 h-2.5" />
                  <span>{{ copiedIndex === idx ? '已复制' : '复制内容' }}</span>
                </button>
                <button
                  v-if="idx === messages.length - 1 && !isGenerating && !isTyping"
                  type="button"
                  class="flex items-center gap-1 text-[10px] text-slate-400 hover:text-accent transition-colors cursor-pointer"
                  @click="regenerateResponse"
                >
                  <RefreshCw class="w-2.5 h-2.5" />
                  <span>重新生成</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Loading Indicator bubble -->
          <div v-if="isGenerating" class="flex items-start gap-2.5">
            <div
              class="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-center shadow-md border overflow-hidden animate-pulse"
              style="border-color: var(--accent)"
            >
              <svg viewBox="0 0 64 64" class="w-6 h-6">
                <path
                  d="M 12 24 L 6 18 M 52 24 L 58 18"
                  stroke="var(--accent)"
                  stroke-width="3"
                  stroke-linecap="round"
                />
                <rect
                  x="10"
                  y="16"
                  width="44"
                  height="36"
                  rx="16"
                  fill="rgba(255, 255, 255, 0.1)"
                  stroke="var(--accent)"
                  stroke-width="2.5"
                />
                <rect x="14" y="21" width="36" height="25" rx="10" fill="rgba(15, 23, 42, 0.9)" />
                <ellipse
                  cx="23"
                  cy="30"
                  rx="2.5"
                  ry="1.5"
                  fill="var(--accent)"
                  class="animate-ping"
                />
                <ellipse
                  cx="41"
                  cy="30"
                  rx="2.5"
                  ry="1.5"
                  fill="var(--accent)"
                  class="animate-ping"
                />
                <path
                  d="M 24 37 C 28 35, 30 39, 34 35 C 36 37, 38 35, 40 37"
                  fill="none"
                  stroke="var(--accent)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  class="talking-mouth-path"
                />
              </svg>
            </div>
            <div class="max-w-[75%] flex flex-col space-y-1">
              <span class="text-[9px] text-slate-400 font-bold px-1">AI 顾问</span>
              <div
                class="px-3.5 py-2 bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none border border-slate-200/50 dark:border-white/5 flex items-center gap-1.5"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></div>
                <div
                  class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"
                ></div>
                <div
                  class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input footer -->
        <div
          class="p-3 border-t bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2"
          style="border-color: var(--border-base)"
        >
          <!-- Hidden File Input -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            style="display: none"
            @change="handleFileChange"
          />

          <!-- Attached Images Preview -->
          <div
            v-if="uploadedImages.length > 0 || isUploading"
            class="flex flex-wrap gap-2 p-2 bg-white dark:bg-slate-900 border rounded-xl overflow-x-auto max-h-24 scrollbar-thin"
            style="border-color: var(--border-base)"
          >
            <div
              v-for="(img, idx) in uploadedImages"
              :key="idx"
              class="group relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm shrink-0"
            >
              <img :src="getAssetUrl(img.url)" class="w-full h-full object-cover" />
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
              >
                <button
                  type="button"
                  class="p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  @click="removeUploadedImage(idx)"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div
              v-if="isUploading"
              class="w-12 h-12 rounded-lg border border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center bg-slate-50 dark:bg-white/5 animate-pulse shrink-0"
            >
              <span
                class="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"
              ></span>
            </div>
          </div>

          <p v-if="uploadError" class="px-2 text-[10px] font-medium text-rose-500">
            {{ uploadError }}
          </p>

          <div
            class="flex items-center gap-2 bg-white dark:bg-slate-900 border rounded-2xl px-3 py-1.5 shadow-inner focus-within:ring-2 focus-within:ring-accent/20 transition-all"
            style="border-color: var(--border-base)"
          >
            <!-- Upload Icon Button -->
            <button
              type="button"
              class="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
              title="发送图片"
              @click="triggerFileInput"
            >
              <Image class="w-4.5 h-4.5" />
            </button>

            <textarea
              ref="textareaRef"
              v-model="inputMessage"
              class="flex-1 bg-transparent border-none outline-none text-xs resize-none py-1 leading-normal scrollbar-thin"
              style="
                color: var(--text-primary);
                min-height: 20px;
                max-height: 120px;
                overflow-y: auto;
              "
              placeholder="描述您的 3D、代码、项目或平台问题，支持粘贴图片..."
              :rows="1"
              :disabled="isGenerating || isTyping"
              @keydown="handleKeydown"
              @paste="handlePaste"
            />
            <button
              v-if="isGenerating || isTyping"
              type="button"
              class="w-7 h-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              @click="handleStop"
            >
              <Square class="w-3 h-3 fill-current" />
            </button>
            <button
              v-else
              type="button"
              :disabled="!inputMessage.trim() && uploadedImages.length === 0"
              class="w-7 h-7 rounded-xl bg-accent text-white flex items-center justify-center shadow-md shadow-accent/10 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              style="background: var(--accent)"
              @click="handleSend"
            >
              <Send class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Upgraded Theme-consistent Draggable Sprite Button -->
    <div
      v-if="!isMaximized"
      class="elf-mascot relative w-15 h-15 rounded-full flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 animate-float-sprite"
      style="background-color: var(--bg-card); border: 2px solid var(--accent)"
      :style="{
        boxShadow: `0 0 20px color-mix(in srgb, var(--accent) 35%, transparent)`,
      }"
      @mousedown="onDragStart($event, isOpen)"
      @touchstart="onDragStart($event, isOpen)"
      @click="handleSpriteClick"
    >
      <!-- holographic background gradient pulse -->
      <div
        class="absolute inset-0 animate-pulse pointer-events-none"
        :style="{
          background: `radial-gradient(circle at center, color-mix(in srgb, var(--accent) 35%, transparent) 0%, transparent 70%)`,
        }"
      ></div>

      <!-- scanning line animation -->
      <div
        class="scanner-line absolute left-0 right-0 h-[1.5px] z-10 pointer-events-none opacity-60"
        style="background-color: var(--accent)"
        :style="{
          boxShadow: `0 0 6px var(--accent)`,
        }"
      ></div>

      <!-- holographic grid decor -->
      <div
        class="absolute inset-0 border rounded-full animate-ping [animation-duration:3s] pointer-events-none"
        style="border-color: var(--accent); opacity: 0.15"
      ></div>

      <!-- Upgraded Custom Vector Mascot -->
      <svg
        viewBox="0 0 64 64"
        class="w-12 h-12 z-20 transition-transform duration-300 pointer-events-none"
        :style="{ transform: isOpen ? 'scale(0.88) rotate(-3deg)' : 'scale(1)' }"
      >
        <!-- Holiday Dressing Accessories (rendered dynamically based on calendar dates) -->
        <g v-if="currentHoliday === 'spring-festival'" class="holiday-accessory spring-festival">
          <!-- Red headband banner -->
          <rect
            x="18"
            y="13"
            width="28"
            height="4"
            rx="2.5"
            fill="#ef4444"
            stroke="#eab308"
            stroke-width="0.5"
          />
          <!-- Gold central coin decoration -->
          <circle cx="32" cy="15" r="4.5" fill="#eab308" />
          <rect x="31" y="14" width="2" height="2" fill="#ef4444" />
          <!-- Hanging left tassel -->
          <line
            x1="18"
            y1="16"
            x2="14"
            y2="24"
            stroke="#ef4444"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <!-- Hanging right tassel -->
          <line
            x1="46"
            y1="16"
            x2="50"
            y2="24"
            stroke="#ef4444"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        </g>
        <g v-else-if="currentHoliday === 'halloween'" class="holiday-accessory halloween">
          <!-- Wizard Witch Hat -->
          <path
            d="M 14 16 L 32 1 L 50 16 Z"
            fill="#1e1b4b"
            stroke="var(--accent)"
            stroke-width="1.5"
          />
          <rect x="22" y="13" width="20" height="3.5" fill="#f97316" />
          <rect x="30" y="12.5" width="4" height="4" fill="#eab308" />
        </g>
        <g v-else-if="currentHoliday === 'christmas'" class="holiday-accessory christmas">
          <!-- Red Santa Hat -->
          <path d="M 18 16 Q 32 2 46 16 Z" fill="#ef4444" />
          <circle cx="32" cy="3" r="3.5" fill="#ffffff" />
          <rect x="15" y="14" width="34" height="4.5" rx="2.5" fill="#ffffff" />
        </g>
        <g v-else-if="currentHoliday === 'new-year'" class="holiday-accessory new-year">
          <!-- Cute colorful party hat -->
          <path
            d="M 22 16 L 32 2 L 42 16 Z"
            fill="#6366f1"
            stroke="var(--accent)"
            stroke-width="1"
          />
          <path d="M 25 12 L 30 5 L 33 5 L 28 12 Z" fill="#eab308" />
          <path d="M 31 16 L 36 8 L 39 8 L 34 16 Z" fill="#eab308" />
          <circle cx="32" cy="2" r="2.5" fill="#facc15" />
          <circle cx="28" cy="13" r="1" fill="#ec4899" />
          <circle cx="36" cy="11" r="1" fill="#10b981" />
        </g>
        <g
          v-else-if="currentHoliday === 'lantern-festival'"
          class="holiday-accessory lantern-festival"
        >
          <!-- Red lantern hanging from the right antenna -->
          <line x1="58" y1="18" x2="58" y2="24" stroke="#ef4444" stroke-width="1.5" />
          <circle cx="58" cy="25" r="1.5" fill="none" stroke="#eab308" stroke-width="1" />
          <ellipse
            cx="58"
            cy="30"
            rx="5"
            ry="5"
            fill="#ef4444"
            stroke="#ca8a04"
            stroke-width="0.5"
          />
          <rect x="55.5" y="27" width="5" height="1" rx="0.5" fill="#eab308" />
          <rect x="55.5" y="32.5" width="5" height="1" rx="0.5" fill="#eab308" />
          <path d="M 56 28 Q 57 30 56 32" fill="none" stroke="#eab308" stroke-width="0.75" />
          <path d="M 60 28 Q 59 30 60 32" fill="none" stroke="#eab308" stroke-width="0.75" />
          <line x1="58" y1="28" x2="58" y2="32" stroke="#eab308" stroke-width="0.75" />
          <line
            x1="58"
            y1="33.5"
            x2="58"
            y2="40"
            stroke="#ef4444"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </g>
        <g v-else-if="currentHoliday === 'qingming'" class="holiday-accessory qingming">
          <!-- Willow branch tucked behind left ear/antenna joint -->
          <path
            d="M 16 18 Q 8 13 2 11"
            fill="none"
            stroke="#22c55e"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path d="M 12 15 Q 10 12 12 11 Q 14 12 12 15 Z" fill="#4ade80" />
          <path d="M 8 13 Q 5 10 7 9 Q 9 10 8 13 Z" fill="#4ade80" />
          <path d="M 4 11.5 Q 2 8.5 4 8 Q 6 8.5 4 11.5 Z" fill="#86efac" />
          <path d="M 14 17 Q 16 14.5 15 14 Q 13 14.5 14 17 Z" fill="#22c55e" />
        </g>
        <g v-else-if="currentHoliday === 'labor-day'" class="holiday-accessory labor-day">
          <!-- Yellow construction helmet -->
          <path
            d="M 18 16 C 18 8, 46 8, 46 16 Z"
            fill="#facc15"
            stroke="#eab308"
            stroke-width="0.5"
          />
          <path
            d="M 14 16.5 L 50 16.5 C 51 16.5, 51 15, 50 15 L 14 15 C 13 15, 13 16.5, 14 16.5 Z"
            fill="#eab308"
          />
          <path d="M 30 8.5 C 30 8.5, 32 7.5, 34 8.5 L 34 15 L 30 15 Z" fill="#facc15" />
          <path d="M 30.5 11 L 33.5 11 L 33.5 13 L 32 14.5 L 30.5 13 Z" fill="#ffffff" />
          <path d="M 31 12.5 L 33 12.5 M 32 11.5 L 32 13.5" stroke="#22c55e" stroke-width="0.75" />
        </g>
        <g v-else-if="currentHoliday === 'dragon-boat'" class="holiday-accessory dragon-boat">
          <!-- Cute little zongzi sitting on the helmet -->
          <path
            d="M 23 16 C 23 16, 32 4, 32 4 C 32 4, 41 16, 41 16 Z"
            fill="#16a34a"
            stroke="#15803d"
            stroke-width="0.5"
          />
          <path d="M 32 4 Q 28 10 23 16" fill="none" stroke="#15803d" stroke-width="0.75" />
          <path d="M 32 4 Q 36 10 41 16" fill="none" stroke="#15803d" stroke-width="0.75" />
          <line x1="32" y1="4" x2="32" y2="16" stroke="#15803d" stroke-width="0.75" />
          <path d="M 27 12 Q 32 13.5 37 12" fill="none" stroke="#ef4444" stroke-width="1" />
          <circle cx="37" cy="12" r="0.75" fill="#ef4444" />
          <circle cx="30" cy="10" r="0.6" fill="#ffffff" />
          <circle cx="30" cy="10" r="0.3" fill="#000000" />
          <circle cx="34" cy="10" r="0.6" fill="#ffffff" />
          <circle cx="34" cy="10" r="0.3" fill="#000000" />
          <path d="M 31.5 11 Q 32 11.8 32.5 11" fill="none" stroke="#000000" stroke-width="0.4" />
        </g>
        <g v-else-if="currentHoliday === 'qixi'" class="holiday-accessory qixi">
          <!-- Floating pink hearts -->
          <path
            d="M 12 10 C 10 7, 7 7, 7 10 C 7 13, 12 16, 12 16 C 12 16, 17 13, 17 10 C 17 7, 14 7, 12 10 Z"
            fill="#ec4899"
            opacity="0.9"
          />
          <path
            d="M 52 13 C 50.5 10.5, 48 10.5, 48 12.5 C 48 14.5, 52 17, 52 17 C 52 17, 56 14.5, 56 12.5 C 56 10.5, 53.5 10.5, 52 13 Z"
            fill="#f472b6"
            opacity="0.8"
            transform="rotate(15 52 13)"
          />
          <path
            d="M 36 6 C 35 4, 33 4, 33 5.5 C 33 7, 36 9, 36 9 C 36 9, 39 7, 39 5.5 C 39 4, 37 4, 36 6 Z"
            fill="#f472b6"
            opacity="0.7"
            transform="rotate(-10 36 6)"
          />
        </g>
        <g v-else-if="currentHoliday === 'mid-autumn'" class="holiday-accessory mid-autumn">
          <!-- Rabbit ears sticking up -->
          <path
            d="M 23 16 C 20 8, 19 2, 24 2 C 27 2, 26 8, 25 16 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            stroke-width="0.5"
          />
          <path
            d="M 23.5 13 C 21.5 8, 21 4, 24 4 C 25.5 4, 25 8, 24.5 13 Z"
            fill="#f472b6"
            opacity="0.85"
          />
          <path
            d="M 41 16 C 44 8, 45 2, 40 2 C 37 2, 38 8, 39 16 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            stroke-width="0.5"
          />
          <path
            d="M 40.5 13 C 42.5 8, 43 4, 40 4 C 38.5 4, 39 8, 39.5 13 Z"
            fill="#f472b6"
            opacity="0.85"
          />
        </g>
        <g v-else-if="currentHoliday === 'double-ninth'" class="holiday-accessory double-ninth">
          <!-- Golden Chrysanthemum blossom on left ear joint -->
          <circle cx="14" cy="18" r="2" fill="#ea580c" />
          <ellipse cx="14" cy="13.5" rx="1.2" ry="3" fill="#facc15" />
          <ellipse cx="14" cy="22.5" rx="1.2" ry="3" fill="#facc15" />
          <ellipse cx="9.5" cy="18" rx="3" ry="1.2" fill="#facc15" />
          <ellipse cx="18.5" cy="18" rx="3" ry="1.2" fill="#facc15" />
          <ellipse cx="11" cy="15" rx="1.2" ry="3" fill="#eab308" transform="rotate(45 11 15)" />
          <ellipse cx="17" cy="21" rx="1.2" ry="3" fill="#eab308" transform="rotate(45 17 21)" />
          <ellipse cx="17" cy="15" rx="1.2" ry="3" fill="#eab308" transform="rotate(-45 17 15)" />
          <ellipse cx="11" cy="21" rx="1.2" ry="3" fill="#eab308" transform="rotate(-45 11 21)" />
        </g>
        <g v-else-if="currentHoliday === 'national-day'" class="holiday-accessory national-day">
          <!-- Red flag on the left antenna -->
          <line
            x1="6"
            y1="18"
            x2="6"
            y2="5"
            stroke="#cbd5e1"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path d="M 6 5 L 18 5 C 18 5, 17 8, 18 11 L 6 11 Z" fill="#ef4444" />
          <polygon
            points="8.5,6.5 8.9,7.3 9.7,7.3 9,7.8 9.3,8.6 8.5,8.1 7.7,8.6 8,7.8 7.3,7.3 8.1,7.3"
            fill="#facc15"
          />
          <circle cx="11.5" cy="6.2" r="0.4" fill="#facc15" />
          <circle cx="12.7" cy="7.2" r="0.4" fill="#facc15" />
          <circle cx="12.7" cy="8.5" r="0.4" fill="#facc15" />
          <circle cx="11.5" cy="9.5" r="0.4" fill="#facc15" />
        </g>

        <!-- Cyber ears/antennae -->
        <path
          d="M 12 24 L 6 18 M 52 24 L 58 18"
          stroke="var(--accent)"
          stroke-width="3"
          stroke-linecap="round"
          class="animate-pulse"
        />
        <circle cx="6" cy="18" r="3" fill="var(--accent)" />
        <circle cx="58" cy="18" r="3" fill="var(--accent)" />

        <!-- Outer Head Frame / Helmet (Glassmorphic border) -->
        <rect
          x="10"
          y="16"
          width="44"
          height="36"
          rx="16"
          fill="rgba(255, 255, 255, 0.15)"
          stroke="var(--accent)"
          stroke-width="2.5"
        />

        <!-- Headphone bands -->
        <rect x="5" y="25" width="6" height="15" rx="3" fill="var(--accent)" />
        <rect x="53" y="25" width="6" height="15" rx="3" fill="var(--accent)" />

        <!-- Cyber Visor -->
        <rect
          x="14"
          y="21"
          width="36"
          height="25"
          rx="10"
          fill="rgba(15, 23, 42, 0.88)"
          stroke="rgba(255, 255, 255, 0.12)"
          stroke-width="1"
        />

        <!-- Blinking Cyber Eyes -->
        <g class="eyes">
          <ellipse
            cx="23"
            cy="30"
            rx="3"
            ry="4.5"
            fill="var(--accent)"
            class="eye animate-blink"
            :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }"
          />
          <ellipse
            cx="41"
            cy="30"
            rx="3"
            ry="4.5"
            fill="var(--accent)"
            class="eye animate-blink"
            :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }"
          />
        </g>

        <!-- Waveform Talking Mouth or Smile -->
        <path
          v-if="isGenerating || isTyping"
          d="M 24 37 C 28 35, 30 39, 34 35 C 36 37, 38 35, 40 37"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2"
          stroke-linecap="round"
          class="talking-mouth-path"
          :style="{ filter: 'drop-shadow(0 0 3px var(--accent))' }"
        />
        <path
          v-else
          d="M 27 37 Q 32 40 37 37"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2.5"
          stroke-linecap="round"
          :style="{ filter: 'drop-shadow(0 0 2px var(--accent))' }"
        />
      </svg>

      <!-- Inner glow ring -->
      <span
        class="absolute inset-0.5 rounded-full border border-white/5 pointer-events-none"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--border-base);
  border-radius: 99px;
}

/* cyber mouth audio-wave style simulation */
.talking-mouth-path {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: talking-wave 1s linear infinite;
}
@keyframes talking-wave {
  to {
    stroke-dashoffset: 0;
  }
}

/* Blinking animations for eyes */
.eye {
  transition: all 0.2s ease;
  transform-origin: center;
}
.animate-blink {
  animation: eye-blink 4s infinite;
}
@keyframes eye-blink {
  0%,
  90%,
  94%,
  98%,
  100% {
    transform: scaleY(1);
  }
  92%,
  96% {
    transform: scaleY(0.15);
  }
}

/* Floating scanning hologram line */
.scanner-line {
  animation: scan-line 3s linear infinite;
}
@keyframes scan-line {
  0% {
    top: 0%;
  }
  50% {
    top: 100%;
  }
  100% {
    top: 0%;
  }
}

/* Animations */
.animate-bounce-slow {
  animation: bounce-slow 2.5s infinite;
}
@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.animate-float-sprite {
  animation: float-sprite 3.5s ease-in-out infinite;
}
@keyframes float-sprite {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

/* Slide fade transition */
.slide-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* CSS Override to strictly prevent chatbox viewport overflow on mobile */
.elf-chat-box {
  max-width: calc(100vw - 32px) !important;
  max-height: calc(100vh - 120px) !important;
}
.elf-chat-box.is-maximized {
  max-width: 100% !important;
  max-height: 100% !important;
}

/* Deep overrides to seamlessly blend md-editor-v3 within message bubbles */
.elf-chat-box :deep(.md-editor-preview) {
  font-size: 12px !important;
  line-height: 1.625 !important;
  color: inherit !important;
  padding: 0 !important;
}
.elf-chat-box :deep(.md-editor-preview-wrapper) {
  padding: 0 !important;
}
.elf-chat-box :deep(.md-editor-preview img) {
  max-width: 240px !important;
  max-height: 180px !important;
  border-radius: 8px !important;
  object-fit: cover !important;
  margin: 6px 0 !important;
  display: block !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
  cursor: zoom-in !important;
  transition: transform 0.2s ease !important;
}
.elf-chat-box :deep(.md-editor-preview img:hover) {
  transform: scale(1.02) !important;
}
.elf-chat-box :deep(.md-editor-code pre) {
  font-size: 11px !important;
  padding: 10px 14px !important;
  border-radius: 10px !important;
  background-color: var(--bg-app, #0f172a) !important;
}
.md-preview-custom {
  background: transparent !important;
  color: inherit !important;
  border: none !important;
}

/* Override blockquote and inline code styling inside md-editor for theme compatibility */
.elf-chat-box :deep(.md-editor-preview blockquote) {
  background-color: var(--bg-app, rgba(0, 0, 0, 0.05)) !important;
  border-left: 4px solid var(--accent, #6366f1) !important;
  color: var(--text-primary) !important;
  padding: 10px 16px !important;
  border-radius: 6px !important;
  margin: 8px 0 !important;
}

.elf-chat-box :deep(.md-editor-preview code) {
  background-color: var(--bg-app, rgba(0, 0, 0, 0.05)) !important;
  color: var(--accent, #6366f1) !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  font-family: monospace !important;
  font-size: 0.9em !important;
}
</style>
