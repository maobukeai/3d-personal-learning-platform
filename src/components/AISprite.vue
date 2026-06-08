<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Cpu,
  Database,
  Globe,
  Image,
  Maximize2,
  Menu,
  Minimize2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage } from 'element-plus';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3/lib/es/MdPreview.mjs'));
import('md-editor-v3/lib/style.css');

const authStore = useAuthStore();
const systemStore = useSystemStore();
const route = useRoute();
const router = useRouter();

const isVip = computed(() => {
  const sub = authStore.user?.subscription;
  return sub && sub.plan?.name !== 'FREE' && sub.status === 'ACTIVE';
});

const vipPlanName = computed(() => {
  return (
    authStore.user?.subscription?.plan?.displayName ||
    authStore.user?.subscription?.plan?.name ||
    ''
  );
});

const goToBilling = () => {
  isOpen.value = false;
  router.push('/billing');
};

const isOpen = ref(false);
const isGeneratingMap = ref<Record<string, boolean>>({});
const isTypingMap = ref<Record<string, boolean>>({});
const showBubble = ref(true);
const inputMessage = ref('');
const showModelDropdown = ref(false);
const streamMetaMap = ref<
  Record<string, { provider?: string; model?: string; requestId?: string } | null>
>({});
const copiedIndex = ref<string | null>(null);
const selectedModelId = ref(localStorage.getItem('ai_sprite_model_id') || '');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const chatContainer = ref<HTMLDivElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadError = ref('');
const isUploading = ref(false);
const isDark = ref(document.documentElement.classList.contains('dark'));
const historySearch = ref('');
const activeHistoryId = ref('');
const chatMode = ref<'default' | 'search' | 'research'>('default');

const showUsageDialog = ref(false);
const loadingUsage = ref(false);
const usageData = ref<{
  usedToday: number;
  dailyLimit: number;
  planName: string;
  planDisplayName: string;
} | null>(null);

const usagePercent = computed(() => {
  if (!usageData.value) return 0;
  return Math.min(100, (usageData.value.usedToday / usageData.value.dailyLimit) * 100);
});

const usageError = ref('');

const fetchUsageLimit = async () => {
  loadingUsage.value = true;
  usageError.value = '';
  usageData.value = null;
  showUsageDialog.value = true;
  try {
    const response = await api.get('/api/projects/ai-chat/usage');
    if (response.data && response.data.success) {
      usageData.value = response.data.data;
    } else {
      usageError.value = response.data?.message || '获取额度数据失败，请重试';
    }
  } catch (error: any) {
    console.error('[AI Usage] Failed to fetch AI usage:', error);
    const apiError =
      error?.response?.data?.message || error?.message || '请求发送失败，请检查网络或刷新重试';
    usageError.value = apiError;
  } finally {
    loadingUsage.value = false;
  }
};

const handleUpgradeClick = () => {
  showUsageDialog.value = false;
  goToBilling();
};

const isFullscreen = ref(false);
const width = ref(parseInt(localStorage.getItem('ai_sprite_width') || '1000'));
const height = ref(parseInt(localStorage.getItem('ai_sprite_height') || '720'));
const offsetX = ref(0);
const offsetY = ref(0);
const savedPosX = localStorage.getItem('ai_sprite_pos_x');
const savedPosY = localStorage.getItem('ai_sprite_pos_y');
const spriteX = ref<number | null>(savedPosX ? parseFloat(savedPosX) : null);
const spriteY = ref<number | null>(savedPosY ? parseFloat(savedPosY) : null);
const showMobileSidebar = ref(false);
const windowWidth = ref(window.innerWidth);

const clampSpritePosition = () => {
  if (spriteX.value !== null && spriteY.value !== null) {
    const buttonSize = 62;
    spriteX.value = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, spriteX.value));
    spriteY.value = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, spriteY.value));
  }
};

const updateWindowSize = () => {
  windowWidth.value = window.innerWidth;
  clampSpritePosition();
};

const isMobile = computed(() => windowWidth.value < 768);

// Drag logic
let isDragging = false;
let startDragX = 0;
let startDragY = 0;

const startDrag = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (
    target.closest('button') ||
    target.closest('input') ||
    target.closest('textarea') ||
    isFullscreen.value ||
    isMobile.value
  ) {
    return;
  }

  isDragging = true;
  startDragX = event.clientX - offsetX.value;
  startDragY = event.clientY - offsetY.value;

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (event: MouseEvent) => {
  if (!isDragging) return;
  offsetX.value = event.clientX - startDragX;
  offsetY.value = event.clientY - startDragY;
};

const stopDrag = () => {
  isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// Sprite Dragging Logic
const isDraggingSprite = ref(false);
let spriteDragStartX = 0;
let spriteDragStartY = 0;
let spriteDragInitialX = 0;
let spriteDragInitialY = 0;
let hasDraggedSprite = false;

const startDragSprite = (event: MouseEvent) => {
  if (event.button !== 0) return;
  isDraggingSprite.value = true;
  hasDraggedSprite = false;
  
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  spriteDragInitialX = rect.left;
  spriteDragInitialY = rect.top;
  
  spriteDragStartX = event.clientX;
  spriteDragStartY = event.clientY;
  
  document.addEventListener('mousemove', handleDragSprite);
  document.addEventListener('mouseup', stopDragSprite);
};

const handleDragSprite = (event: MouseEvent) => {
  if (!isDraggingSprite.value) return;
  const deltaX = event.clientX - spriteDragStartX;
  const deltaY = event.clientY - spriteDragStartY;
  
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    hasDraggedSprite = true;
  }
  
  let newX = spriteDragInitialX + deltaX;
  let newY = spriteDragInitialY + deltaY;
  const buttonSize = 62;
  newX = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, newX));
  newY = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, newY));
  
  spriteX.value = newX;
  spriteY.value = newY;
};

const stopDragSprite = () => {
  isDraggingSprite.value = false;
  document.removeEventListener('mousemove', handleDragSprite);
  document.removeEventListener('mouseup', stopDragSprite);
  
  if (spriteX.value !== null && spriteY.value !== null) {
    localStorage.setItem('ai_sprite_pos_x', spriteX.value.toString());
    localStorage.setItem('ai_sprite_pos_y', spriteY.value.toString());
  }
};

const startDragSpriteTouch = (event: TouchEvent) => {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  
  isDraggingSprite.value = true;
  hasDraggedSprite = false;
  
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  spriteDragInitialX = rect.left;
  spriteDragInitialY = rect.top;
  
  spriteDragStartX = touch.clientX;
  spriteDragStartY = touch.clientY;
  
  document.addEventListener('touchmove', handleDragSpriteTouch, { passive: false });
  document.addEventListener('touchend', stopDragSpriteTouch);
};

const handleDragSpriteTouch = (event: TouchEvent) => {
  if (!isDraggingSprite.value || event.touches.length !== 1) return;
  const touch = event.touches[0];
  
  const deltaX = touch.clientX - spriteDragStartX;
  const deltaY = touch.clientY - spriteDragStartY;
  
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    hasDraggedSprite = true;
    event.preventDefault(); // Prevent page scrolling while dragging
  }
  
  let newX = spriteDragInitialX + deltaX;
  let newY = spriteDragInitialY + deltaY;
  const buttonSize = 62;
  newX = Math.max(10, Math.min(window.innerWidth - buttonSize - 10, newX));
  newY = Math.max(10, Math.min(window.innerHeight - buttonSize - 10, newY));
  
  spriteX.value = newX;
  spriteY.value = newY;
};

const stopDragSpriteTouch = () => {
  isDraggingSprite.value = false;
  document.removeEventListener('touchmove', handleDragSpriteTouch);
  document.removeEventListener('touchend', stopDragSpriteTouch);
  
  if (spriteX.value !== null && spriteY.value !== null) {
    localStorage.setItem('ai_sprite_pos_x', spriteX.value.toString());
    localStorage.setItem('ai_sprite_pos_y', spriteY.value.toString());
  }
};

// Resize logic
let isResizing = false;
let startWidth = 0;
let startHeight = 0;
let startResizeX = 0;
let startResizeY = 0;

const startResize = (event: MouseEvent) => {
  if (isFullscreen.value || isMobile.value) return;

  isResizing = true;
  startWidth = width.value;
  startHeight = height.value;
  startResizeX = event.clientX;
  startResizeY = event.clientY;

  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
};

const handleResize = (event: MouseEvent) => {
  if (!isResizing) return;
  const deltaX = event.clientX - startResizeX;
  const deltaY = event.clientY - startResizeY;

  width.value = Math.max(500, Math.min(window.innerWidth - 40, startWidth + deltaX));
  height.value = Math.max(400, Math.min(window.innerHeight - 40, startHeight + deltaY));
};

const stopResize = () => {
  isResizing = false;
  localStorage.setItem('ai_sprite_width', width.value.toString());
  localStorage.setItem('ai_sprite_height', height.value.toString());
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

const chatModeOptions = [
  { value: 'default', label: '普通对话', icon: Sparkles },
  { value: 'search', label: '联网搜索', icon: Globe },
  { value: 'research', label: '深度研究', icon: Brain },
] as const;

const uploadedImages = ref<{ url: string; name: string }[]>([]);

const MAX_UPLOAD_IMAGES = 4;
const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_UPLOAD_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const activeReaders: Record<string, ReadableStreamDefaultReader<Uint8Array> | null> = {};
const activeAbortControllers: Record<string, AbortController | null> = {};
const typewriterQueueMap = ref<Record<string, { type: 'text' | 'reasoning'; char: string }[]>>({});
const typewriterTimerMap: Record<string, ReturnType<typeof setInterval> | null> = {};
const typewriterTargetIdMap = ref<Record<string, string>>({});
let uploadErrorTimer: ReturnType<typeof setTimeout> | null = null;
let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
let darkObserver: MutationObserver | null = null;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  reasoning?: string;
  isThinking?: boolean;
  isThinkingExpanded?: boolean;
  sessionId?: string;
  sessionTitle?: string;
  sources?: Array<{ title: string; link: string; domain: string; publishedAt?: string }>;
  isSourcesExpanded?: boolean;
}

const makeMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const generateSessionId = () => {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
};

const currentSessionId = ref(localStorage.getItem('ai_sprite_session_id') || generateSessionId());
if (!localStorage.getItem('ai_sprite_session_id')) {
  localStorage.setItem('ai_sprite_session_id', currentSessionId.value);
}

const createMessage = (
  role: Message['role'],
  content: string,
  partial: Partial<Message> = {},
): Message => ({
  id: partial.id || makeMessageId(),
  role,
  content,
  createdAt: partial.createdAt || new Date().toISOString(),
  reasoning: partial.reasoning || '',
  isThinking: partial.isThinking || false,
  isThinkingExpanded: partial.isThinkingExpanded ?? false,
  sessionId: partial.sessionId || currentSessionId.value,
  sessionTitle: partial.sessionTitle || '新对话',
  sources: partial.sources,
  isSourcesExpanded: partial.isSourcesExpanded ?? false,
});

const createGreetingMessage = () =>
  createMessage(
    'assistant',
    '你好，我是 AI 助手。你可以让我帮你梳理学习计划、分析 3D 项目、解答代码问题，或一起拆解当前工作的下一步。',
  );

const messages = ref<Message[]>([createGreetingMessage()]);

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  time: string;
  createdAt: string;
}

const chatSessions = computed<ChatSession[]>(() => {
  const groups: Record<string, Message[]> = {};
  messages.value.forEach((msg) => {
    const sId = msg.sessionId || 'default';
    if (!groups[sId]) {
      groups[sId] = [];
    }
    groups[sId].push(msg);
  });

  const list: ChatSession[] = [];
  Object.keys(groups).forEach((sId) => {
    const groupMessages = groups[sId];
    const userMsgs = groupMessages.filter((m) => m.role === 'user');
    if (userMsgs.length === 0) return;

    const firstUserMsg = userMsgs[0];
    const lastMsg = groupMessages[groupMessages.length - 1];

    // Use the stored sessionTitle if it is custom, otherwise fallback to message content summary
    const storedTitle = groupMessages.find(
      (m) => m.sessionTitle && m.sessionTitle !== '新对话',
    )?.sessionTitle;
    const title = storedTitle || summarizeMessage(firstUserMsg.content);

    list.push({
      id: sId,
      title,
      preview: sanitizePreviewText(lastMsg.content) || '点击查看该对话',
      time: formatHistoryTime(
        lastMsg.createdAt || firstUserMsg.createdAt || new Date().toISOString(),
      ),
      createdAt: firstUserMsg.createdAt || new Date().toISOString(),
    });
  });

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});

const activeSessionMessages = computed(() => {
  const filtered = messages.value.filter((msg) => {
    const sId = msg.sessionId || 'default';
    return sId === currentSessionId.value;
  });

  if (filtered.length === 0) {
    return [createGreetingMessage()];
  }
  return filtered;
});

const selectSession = (sessionId: string) => {
  currentSessionId.value = sessionId;
  localStorage.setItem('ai_sprite_session_id', sessionId);
  showMobileSidebar.value = false;
  scrollToBottom();
};

const startNewChat = () => {
  const newSessId = generateSessionId();
  currentSessionId.value = newSessId;
  localStorage.setItem('ai_sprite_session_id', newSessId);
  messages.value.push(
    createMessage('assistant', '你好！已开启新对话，请问有什么可以帮您的？', {
      sessionId: newSessId,
      sessionTitle: '新对话',
    }),
  );
  showMobileSidebar.value = false;
  saveHistory();
  scrollToBottom();
};

const deleteSession = async (sessionId: string) => {
  const isDeletingActive = currentSessionId.value === sessionId;
  const originalMessages = [...messages.value];

  // Remove messages of this session locally
  messages.value = messages.value.filter((msg) => (msg.sessionId || 'default') !== sessionId);

  if (authStore.isAuthenticated) {
    try {
      await api.delete('/api/projects/ai-chat/history', {
        params: { sessionId },
      });
    } catch (error) {
      console.error('Failed to delete AI chat session on server:', error);
      // Rollback to original state
      messages.value = originalMessages;
      ElMessage.error('删除会话失败，请稍后重试');
      return;
    }
  } else {
    saveHistory();
  }

  if (isDeletingActive) {
    const remainingSessions = chatSessions.value;
    if (remainingSessions.length > 0) {
      selectSession(remainingSessions[0].id);
    } else {
      startNewChat();
    }
  }
};

const providerMeta: Record<
  string,
  { color: string; bg: string; border: string; label: string; lucideIcon: any }
> = {
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

const availableAiModels = computed(() =>
  (systemStore.settings.AI_MODEL_OPTIONS || []).filter((model) => model.enabled),
);

const currentModel = computed(
  () =>
    availableAiModels.value.find((model) => model.id === selectedModelId.value) ||
    availableAiModels.value[0],
);

watch(
  availableAiModels,
  (models) => {
    if (models.length === 0) {
      selectedModelId.value = '';
      return;
    }

    const existing = models.find((model) => model.id === selectedModelId.value);
    if (!existing) {
      selectedModelId.value = models.find((model) => model.isDefault)?.id || models[0].id;
    }
  },
  { immediate: true },
);

watch(selectedModelId, (value) => {
  if (value) {
    localStorage.setItem('ai_sprite_model_id', value);
  } else {
    localStorage.removeItem('ai_sprite_model_id');
  }
});

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

const sanitizePreviewText = (content: string) =>
  content
    .replace(/!\[[^\]]*]\([^)]*\)/g, '[图片]')
    .replace(/[`>#*_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const summarizeMessage = (content: string, max = 24) => {
  const clean = sanitizePreviewText(content);
  if (!clean) return '未命名对话';
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
};

const formatHistoryTime = (value: string) => {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  } catch (error) {
    console.error('Failed to format history time:', error);
    return '';
  }
};

const recentPrompts = computed(() => {
  const filtered = historySearch.value.trim().toLowerCase();
  return chatSessions.value.filter((item) => {
    if (!filtered) return true;

    // Check if session title or preview matches
    if (
      item.title.toLowerCase().includes(filtered) ||
      item.preview.toLowerCase().includes(filtered)
    ) {
      return true;
    }

    // Check if any message inside this session matches
    const sessionMessages = messages.value.filter(
      (msg) => (msg.sessionId || 'default') === item.id,
    );
    return sessionMessages.some((msg) => msg.content.toLowerCase().includes(filtered));
  });
});

const currentConversationTitle = computed(() => {
  const activeSess = chatSessions.value.find((s) => s.id === currentSessionId.value);
  return activeSess?.title || '新对话';
});

const currentConversationMeta = computed(() => {
  const activeSessMsgs = activeSessionMessages.value.filter((m) => m.role === 'user');
  return activeSessMsgs.length > 0 ? `当前会话共 ${activeSessMsgs.length} 条提问` : '新对话';
});

const shouldShowLandingState = computed(
  () =>
    !isGeneratingMap.value[currentSessionId.value] &&
    !isTypingMap.value[currentSessionId.value] &&
    activeSessionMessages.value.length <= 1 &&
    activeSessionMessages.value.every((message) => message.role === 'assistant'),
);

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

const syncActiveHistory = () => {
  const lastUserMessage = [...messages.value].reverse().find((message) => message.role === 'user');
  activeHistoryId.value = lastUserMessage?.id || '';
};

const saveHistory = () => {
  if (!authStore.isAuthenticated) {
    const safeMessages = messages.value.slice(-40).map((message) => ({
      ...message,
      content: redactLocalMessage(message.content),
      isThinking: false,
      isThinkingExpanded: false,
    }));
    sessionStorage.setItem('ai_sprite_chat_history', JSON.stringify(safeMessages));
  }
};

/** Marker string used to embed serialised sources inside the reasoning field. */
const SOURCES_MARKER = '\n[sources]: ';

const parseSourcesFromReasoning = (reasoningText: string) => {
  if (!reasoningText) return { text: '', sources: null };
  const idx = reasoningText.lastIndexOf(SOURCES_MARKER);
  if (idx >= 0) {
    try {
      const sourcesStr = reasoningText.slice(idx + SOURCES_MARKER.length);
      const parsed = JSON.parse(sourcesStr);
      // Guard: sources must be an array of objects, otherwise ignore
      if (!Array.isArray(parsed)) return { text: reasoningText, sources: null };
      return {
        text: reasoningText.slice(0, idx),
        sources: parsed as Array<{
          title: string;
          link: string;
          domain: string;
          publishedAt?: string;
        }>,
      };
    } catch {
      return { text: reasoningText, sources: null };
    }
  }
  return { text: reasoningText, sources: null };
};

const loadGuestHistory = () => {
  const saved = sessionStorage.getItem('ai_sprite_chat_history');
  if (!saved) {
    messages.value = [createGreetingMessage()];
    syncActiveHistory();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      messages.value = parsed
        .filter((msg: any) => msg?.role === 'user' || msg?.role === 'assistant')
        .slice(-40)
        .map((msg: any) => {
          const sourcesResult = parseSourcesFromReasoning(msg.reasoning || '');
          return createMessage(msg.role, msg.content, {
            id: msg.id,
            createdAt: msg.createdAt,
            reasoning: sourcesResult.text,
            sources: msg.sources || sourcesResult.sources || undefined,
            isSourcesExpanded: false,
            sessionId: msg.sessionId || 'default',
            sessionTitle: msg.sessionTitle || '新对话',
          });
        });
      const latestMsg = messages.value[messages.value.length - 1];
      if (latestMsg && latestMsg.sessionId) {
        currentSessionId.value = latestMsg.sessionId;
        localStorage.setItem('ai_sprite_session_id', latestMsg.sessionId);
      }
      syncActiveHistory();
      return;
    }
  } catch (error) {
    console.warn('Failed to parse local AI chat history:', error);
  }

  messages.value = [createGreetingMessage()];
  syncActiveHistory();
};

const loadHistory = async () => {
  if (!authStore.isAuthenticated) {
    loadGuestHistory();
    return;
  }

  try {
    const response = await api.get('/api/projects/ai-chat/history');
    const history = response.data?.data || [];
    if (response.data?.success && history.length > 0) {
      messages.value = history
        .filter((msg: any) => msg?.role === 'user' || msg?.role === 'assistant')
        .slice(-80)
        .map((msg: any) => {
          const sourcesResult = parseSourcesFromReasoning(msg.reasoning || '');
          return createMessage(msg.role, msg.content, {
            id: msg.id,
            createdAt: msg.createdAt,
            reasoning: sourcesResult.text,
            sources: sourcesResult.sources || undefined,
            isSourcesExpanded: false,
            sessionId: msg.sessionId || 'default',
            sessionTitle: msg.sessionTitle || '新对话',
          });
        });
      const latestMsg = messages.value[messages.value.length - 1];
      if (latestMsg && latestMsg.sessionId) {
        currentSessionId.value = latestMsg.sessionId;
        localStorage.setItem('ai_sprite_session_id', latestMsg.sessionId);
      }
    } else {
      messages.value = [createGreetingMessage()];
    }
    syncActiveHistory();
  } catch (error: any) {
    if (error?.response?.status !== 401) {
      console.error('Failed to fetch AI chat history from server:', error);
    }
    loadGuestHistory();
  }
};

watch(
  () => authStore.isAuthenticated,
  () => {
    loadHistory();
  },
  { immediate: true },
);

watch(isOpen, (open) => {
  if (open) {
    showBubble.value = false;
    offsetX.value = 0;
    offsetY.value = 0;
    showMobileSidebar.value = false;
    nextTick(() => {
      textareaRef.value?.focus();
      scrollToBottom();
    });
  } else {
    showModelDropdown.value = false;
    showMobileSidebar.value = false;
  }
});

watch(inputMessage, async () => {
  await nextTick();
  const textarea = textareaRef.value;
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(160, textarea.scrollHeight)}px`;
});

const canAttachImage = (file: File) => {
  if (uploadedImages.value.length >= MAX_UPLOAD_IMAGES) {
    showUploadError(`最多只能上传 ${MAX_UPLOAD_IMAGES} 张图片`);
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

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

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
      const errorText = await response.text();
      let message = errorText || `Upload HTTP error: ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed.error || parsed.message || message;
      } catch {}
      throw new Error(message);
    }

    const result = await response.json();
    if (!result.success || !result.url) {
      throw new Error(result.error || '图片上传失败');
    }

    uploadedImages.value.push({
      url: result.url,
      name: result.name || file.name,
    });
    await scrollToBottom();
  } catch (error) {
    console.error('Failed to upload image:', error);
    showUploadError(error instanceof Error ? error.message : '图片上传失败');
  }
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;

  isUploading.value = true;
  try {
    for (let index = 0; index < target.files.length; index += 1) {
      const file = target.files[index];
      if (file.type.startsWith('image/')) {
        await uploadAndAppendImage(file);
      }
    }
  } finally {
    isUploading.value = false;
    target.value = '';
  }
};

const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.type.startsWith('image/')) continue;
    event.preventDefault();
    const file = item.getAsFile();
    if (!file) continue;
    isUploading.value = true;
    try {
      await uploadAndAppendImage(file);
    } finally {
      isUploading.value = false;
    }
  }
};

const removeUploadedImage = (index: number) => {
  uploadedImages.value.splice(index, 1);
};

const handleSpriteClick = () => {
  if (hasDraggedSprite) return;
  isOpen.value = !isOpen.value;
};

const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.model-select-dropdown-container')) {
    showModelDropdown.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};

const startTypewriter = (messageId: string, sId: string) => {
  if (typewriterTimerMap[sId]) return;
  typewriterTargetIdMap.value[sId] = messageId;

  if (!typewriterQueueMap.value[sId]) {
    typewriterQueueMap.value[sId] = [];
  }

  typewriterTimerMap[sId] = setInterval(() => {
    const currentMessage = messages.value.find((m) => m.id === messageId);
    if (!currentMessage) return;

    const queue = typewriterQueueMap.value[sId];
    const batch = Math.min(12, queue.length);
    if (batch === 0) return;

    let hasReasoning = false;
    for (let index = 0; index < batch; index += 1) {
      const item = queue.shift();
      if (!item) continue;

      if (item.type === 'reasoning') {
        currentMessage.isThinking = true;
        currentMessage.reasoning = `${currentMessage.reasoning || ''}${item.char}`;
        hasReasoning = true;
      } else {
        currentMessage.isThinking = false;
        currentMessage.content += item.char;
      }
    }

    if (hasReasoning) {
      const msgEl = messageRefs.get(currentMessage.id);
      if (msgEl) {
        const thinkingContentEl = msgEl.querySelector('.thinking-content');
        if (thinkingContentEl) {
          thinkingContentEl.scrollTop = thinkingContentEl.scrollHeight;
        }
      }
    }

    if (sId === currentSessionId.value) {
      const container = chatContainer.value;
      if (!container) return;

      const threshold = 80;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, 16);
};

const stopTypewriter = (sId: string) => {
  if (typewriterTimerMap[sId]) {
    clearInterval(typewriterTimerMap[sId]!);
    typewriterTimerMap[sId] = null;
  }
};

const flushTypewriterQueue = (messageId: string, sId: string) => {
  stopTypewriter(sId);
  const currentMessage = messages.value.find((m) => m.id === messageId);
  const queue = typewriterQueueMap.value[sId] || [];
  if (!currentMessage) {
    typewriterQueueMap.value[sId] = [];
    return;
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    if (item.type === 'reasoning') {
      currentMessage.reasoning = `${currentMessage.reasoning || ''}${item.char}`;
    } else {
      currentMessage.content += item.char;
    }
  }
};

const handleStop = (sId: string = currentSessionId.value) => {
  if (activeAbortControllers[sId]) {
    try {
      activeAbortControllers[sId]!.abort();
    } catch (error) {
      console.error('Failed to abort fetch for session:', sId, error);
    }
    activeAbortControllers[sId] = null;
  }
  if (activeReaders[sId]) {
    try {
      activeReaders[sId]!.cancel();
    } catch (error) {
      console.error('Failed to cancel active reader for session:', sId, error);
    }
    activeReaders[sId] = null;
  }

  const targetId = typewriterTargetIdMap.value[sId];
  if (targetId) {
    flushTypewriterQueue(targetId, sId);
  }
  if (typewriterQueueMap.value[sId]) {
    typewriterQueueMap.value[sId] = [];
  }
  isGeneratingMap.value[sId] = false;
  isTypingMap.value[sId] = false;
};

const handleSend = async () => {
  const sId = currentSessionId.value;
  if (isGeneratingMap.value[sId] || isTypingMap.value[sId]) return;

  const textMessage = inputMessage.value.trim();
  if (!textMessage && uploadedImages.value.length === 0) return;

  // Concurrency check (max 3 concurrent requests across all sessions).
  // Must take the union of both maps' keys to correctly count sessions that are
  // still in the "typing" phase even though "generating" has already completed.
  const activeSessionKeys = new Set([
    ...Object.keys(isGeneratingMap.value),
    ...Object.keys(isTypingMap.value),
  ]);
  const activeGeneratingCount = [...activeSessionKeys].filter(
    (key) => isGeneratingMap.value[key] || isTypingMap.value[key],
  ).length;
  if (activeGeneratingCount >= 3) {
    const warnMessage = createMessage(
      'assistant',
      '同时提问的对话已达上限（最多 3 个），请等待其他对话生成完毕。',
      { sessionId: sId },
    );
    messages.value.push(warnMessage);
    saveHistory();
    scrollToBottom();
    return;
  }

  let userContent = textMessage;
  if (uploadedImages.value.length > 0) {
    const imageMarkdown = uploadedImages.value
      .map((image) => `![${image.name}](${image.url})`)
      .join('\n');
    userContent = textMessage ? `${imageMarkdown}\n\n${textMessage}` : imageMarkdown;
  }

  const userMessage = createMessage('user', userContent, { sessionId: sId });
  messages.value.push(userMessage);
  activeHistoryId.value = userMessage.id;
  inputMessage.value = '';
  uploadedImages.value = [];
  saveHistory();

  await nextTick();
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
  await scrollToBottom();

  const chatHistory = activeSessionMessages.value.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const sessionTitle =
    activeSessionMessages.value.find((message) => message.role === 'user')?.content.slice(0, 30) ||
    '新对话';

  const assistantMessage = createMessage('assistant', '', {
    reasoning: '',
    isThinking: true,
    isThinkingExpanded: true,
    sessionId: sId,
  });
  messages.value.push(assistantMessage);

  isGeneratingMap.value[sId] = true;
  typewriterQueueMap.value[sId] = [];
  streamMetaMap.value[sId] = null;
  const controller = new AbortController();
  activeAbortControllers[sId] = controller;
  const signal = controller.signal;

  await nextTick();
  await scrollToBottom();

  try {
    const response = await fetch('/api/projects/ai-chat', {
      method: 'POST',
      headers: createJsonHeaders(),
      signal,
      body: JSON.stringify({
        messages: chatHistory,
        modelId: selectedModelId.value || undefined,
        context: {
          path: route.path || '',
          title: document.title || '',
        },
        sessionId: sId,
        sessionTitle,
        mode: chatMode.value,
      }),
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response, `HTTP error: ${response.status}`));
    }

    if (!response.body) {
      throw new Error('Readable stream not supported in this browser environment.');
    }

    isGeneratingMap.value[sId] = false;
    isTypingMap.value[sId] = true;

    startTypewriter(assistantMessage.id, sId);
    const reader = response.body.getReader();
    activeReaders[sId] = reader;

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.event === 'meta') {
          streamMetaMap.value[sId] = {
            provider: payload.provider,
            model: payload.model,
            requestId: payload.requestId,
          };
          return;
        }

        if (payload.event === 'heartbeat' || payload.event === 'done') {
          return;
        }

        if (payload.event === 'sources') {
          const msgObj = messages.value.find((m) => m.id === assistantMessage.id);
          if (msgObj) {
            msgObj.sources = payload.sources;
            msgObj.isSourcesExpanded = false;
          }
          return;
        }

        if (payload.error) {
          if (!typewriterQueueMap.value[sId]) typewriterQueueMap.value[sId] = [];
          for (const char of `\n[错误: ${payload.error}]`) {
            typewriterQueueMap.value[sId].push({ type: 'text', char });
          }
          return;
        }

        if (payload.reasoning) {
          if (!typewriterQueueMap.value[sId]) typewriterQueueMap.value[sId] = [];
          for (const char of payload.reasoning) {
            typewriterQueueMap.value[sId].push({ type: 'reasoning', char });
          }
          return;
        }

        if (payload.text) {
          if (!typewriterQueueMap.value[sId]) typewriterQueueMap.value[sId] = [];
          for (const char of payload.text) {
            typewriterQueueMap.value[sId].push({ type: 'text', char });
          }
        }
      },
      () => {},
      (error) => {
        throw error;
      },
    );

    await new Promise<void>((resolve) => {
      let ticks = 0;
      const timer = setInterval(() => {
        const queue = typewriterQueueMap.value[sId];
        ticks++;
        if (!queue || queue.length === 0 || ticks >= 1500) {
          clearInterval(timer);
          resolve();
        }
      }, 20);
    });

    const msgObj = messages.value.find((m) => m.id === assistantMessage.id);
    if (msgObj) {
      msgObj.isThinkingExpanded = false;
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('AI streaming chat error in session:', sId, error);
    }
    isGeneratingMap.value[sId] = false;
    flushTypewriterQueue(assistantMessage.id, sId);
    const message = error?.message || '连接失败';
    const msgObj = messages.value.find((m) => m.id === assistantMessage.id);
    if (msgObj) {
      msgObj.content = error.name === 'AbortError' ? '生成已终止' : `AI 服务暂时不可用：${message}`;
      msgObj.isThinking = false;
      msgObj.isThinkingExpanded = false;
    }
  } finally {
    stopTypewriter(sId);
    isTypingMap.value[sId] = false;
    activeReaders[sId] = null;
    activeAbortControllers[sId] = null;
    saveHistory();
    if (sId === currentSessionId.value) {
      await scrollToBottom();
    }
  }
};

const clearHistory = async () => {
  messages.value = [];
  const sId = currentSessionId.value;
  streamMetaMap.value[sId] = null;
  activeHistoryId.value = '';

  const newSessId = generateSessionId();
  currentSessionId.value = newSessId;
  localStorage.setItem('ai_sprite_session_id', newSessId);

  if (authStore.isAuthenticated) {
    try {
      await api.delete('/api/projects/ai-chat/history');
    } catch (error) {
      console.error('Failed to clear AI chat history on server:', error);
    }
  } else {
    saveHistory();
  }

  messages.value = [
    createMessage('assistant', '历史记录已清空，请告诉我新的目标、问题或需要 analysis 的上下文。', {
      sessionId: newSessId,
    }),
  ];

  await scrollToBottom();
};

const regenerateResponse = async () => {
  const sId = currentSessionId.value;
  if (isGeneratingMap.value[sId] || isTypingMap.value[sId]) return;

  const sessionMessages = messages.value.filter(
    (message) => (message.sessionId || 'default') === sId,
  );
  const lastUserMessage = [...sessionMessages].reverse().find((message) => message.role === 'user');
  if (!lastUserMessage) return;

  messages.value = messages.value.filter(
    (message) =>
      (message.sessionId || 'default') !== sId ||
      new Date(message.createdAt).getTime() < new Date(lastUserMessage.createdAt).getTime(),
  );
  inputMessage.value = sanitizePreviewText(lastUserMessage.content);
  await nextTick();
  textareaRef.value?.focus();
  await handleSend();
};

const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
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
  } catch (error) {
    document.body.removeChild(textarea);
    return Promise.reject(error);
  }
};

const copyMessage = (text: string, id: string) => {
  copyToClipboard(text)
    .then(() => {
      copiedIndex.value = id;
      setTimeout(() => {
        if (copiedIndex.value === id) {
          copiedIndex.value = null;
        }
      }, 1800);
    })
    .catch((error) => {
      console.error('Failed to copy message:', error);
    });
};

onMounted(() => {
  bubbleTimer = setTimeout(() => {
    showBubble.value = false;
  }, 7000);

  window.addEventListener('click', handleDocumentClick);
  window.addEventListener('resize', updateWindowSize);

  darkObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
});

onUnmounted(() => {
  // Abort all active stream readers across every session
  Object.keys(activeAbortControllers).forEach((sId) => {
    handleStop(sId);
  });
  // Remove global drag/resize document listeners to prevent leaks when the
  // component unmounts while the user is mid-drag or mid-resize
  stopDrag();
  stopResize();
  stopDragSprite();
  stopDragSpriteTouch();
  window.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('resize', updateWindowSize);
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
  }
  if (uploadErrorTimer) {
    clearTimeout(uploadErrorTimer);
  }
  darkObserver?.disconnect();
});
</script>

<template>
  <div
    v-if="systemStore.settings.AI_IMPORT_ENABLED"
    class="fixed z-[99]"
    :class="[spriteX === null ? 'bottom-5 right-5' : '']"
    :style="spriteX !== null ? { left: spriteX + 'px', top: spriteY + 'px' } : {}"
  >
    <Transition name="fade">
      <div
        v-if="showBubble && !isOpen"
        class="pointer-events-none absolute bottom-[84px] right-0 w-64 rounded-3xl border px-4 py-3 text-xs font-medium leading-5 shadow-xl"
        style="
          background: rgba(255, 255, 255, 0.94);
          border-color: rgba(244, 114, 182, 0.18);
          color: var(--text-secondary);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
        "
      >
        需要整理学习计划、分析项目、看代码或继续推进当前工作时，随时打开 AI 助手。
      </div>
    </Transition>

    <Transition name="panel-fade">
      <div
        v-if="isOpen"
        :class="[
          'fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200',
          isFullscreen || isMobile ? 'p-0' : 'p-3 md:p-5 pointer-events-none',
        ]"
      >
        <div class="ai-overlay absolute inset-0 pointer-events-auto" @click="isOpen = false"></div>

        <div
          :class="[
            'ai-shell relative flex overflow-hidden border pointer-events-auto shadow-2xl transition-all duration-200',
            isFullscreen || isMobile
              ? 'w-full h-full rounded-none border-none max-w-none max-h-none'
              : 'rounded-[24px]',
          ]"
          :style="
            isFullscreen || isMobile
              ? {}
              : {
                  width: width + 'px',
                  height: height + 'px',
                  transform: `translate(${offsetX}px, ${offsetY}px)`,
                }
          "
        >
          <!-- Mobile Sidebar Backdrop -->
          <div
            v-if="isMobile && showMobileSidebar"
            class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs pointer-events-auto"
            @click="showMobileSidebar = false"
          ></div>

          <aside
            :class="[
              'ai-sidebar shrink-0 border-r border-slate-200 dark:border-slate-800 md:flex md:flex-col',
              isMobile
                ? showMobileSidebar
                  ? 'fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] transition-transform duration-300 shadow-2xl pointer-events-auto'
                  : 'hidden'
                : 'hidden w-[300px]',
            ]"
          >
            <div class="border-b border-slate-200 dark:border-slate-800 px-5 pb-4 pt-5">
              <div class="flex items-center gap-3">
                <div class="ai-logo">
                  <Sparkles class="h-4 w-4" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    AI 助手
                  </p>
                  <p class="truncate text-xs text-slate-500">智能学习与项目协作</p>
                </div>
              </div>

              <button
                type="button"
                class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-400/10 dark:border-pink-400/5 bg-white/75 dark:bg-white/5 text-slate-800 dark:text-slate-200 px-3 py-3 text-sm font-medium transition hover:-translate-y-0.5 hover:bg-white/95 dark:hover:bg-white/10"
                @click="startNewChat"
              >
                <Plus class="h-4 w-4 text-accent" />
                <span>新建对话</span>
              </button>
            </div>

            <div class="px-5 pt-4">
              <div
                class="flex items-center gap-2 rounded-2xl border border-slate-400/10 dark:border-slate-400/5 bg-white/70 dark:bg-white/5 px-3 py-2.5"
              >
                <Search class="h-4 w-4 text-slate-400" />
                <input
                  v-model="historySearch"
                  type="text"
                  class="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
                  placeholder="搜索历史会话"
                />
              </div>
            </div>

            <div class="min-h-0 flex-1 px-3 pb-3 pt-4">
              <div class="mb-2 px-2 text-xs font-medium text-slate-400">历史会话</div>
              <div class="h-full space-y-1 overflow-y-auto pr-1 ai-scrollbar">
                <button
                  v-for="item in recentPrompts"
                  :key="item.id"
                  type="button"
                  class="group relative w-full rounded-2xl px-3 py-3 text-left transition border focus:outline-none"
                  :class="
                    currentSessionId === item.id
                      ? 'bg-white dark:bg-white/10 border-slate-200/50 dark:border-white/10 shadow-[0_16px_38px_rgba(244,114,182,0.06)]'
                      : 'border-transparent hover:bg-white/60 dark:hover:bg-white/5'
                  "
                  @click="selectSession(item.id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {{ item.title }}
                    </p>
                    <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{{
                      item.time
                    }}</span>
                  </div>
                  <p
                    class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400 pr-6"
                  >
                    {{ item.preview }}
                  </p>
                  <button
                    type="button"
                    class="absolute bottom-3 right-3 hidden group-hover:block p-1 text-slate-400 hover:text-rose-500 rounded transition focus:outline-none"
                    title="删除会话"
                    @click.stop="deleteSession(item.id)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </button>

                <div
                  v-if="chatSessions.length === 0"
                  class="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-slate-400"
                  style="border-color: rgba(148, 163, 184, 0.18)"
                >
                  还没有历史对话，开始发起聊天吧。
                </div>

                <div
                  v-else-if="recentPrompts.length === 0"
                  class="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-slate-400"
                  style="border-color: rgba(148, 163, 184, 0.18)"
                >
                  没有找到匹配的会话。
                </div>
              </div>
            </div>

            <div class="border-t px-4 pb-4 pt-3" style="border-color: rgba(148, 163, 184, 0.14)">
              <div class="subscription-card rounded-[24px] border p-4">
                <p class="text-sm font-semibold text-slate-900 dark:text-white">
                  {{ isVip ? `当前订阅：${vipPlanName}` : '升级专业版' }}
                </p>
                <p class="subscription-desc mt-1 text-xs leading-5">
                  {{
                    isVip
                      ? '您已解锁更长上下文、更强模型和更多协作能力。'
                      : '解锁更长上下文、更强模型和更多协作能力。'
                  }}
                </p>
                <button
                  type="button"
                  class="subscription-btn mt-3 w-full rounded-2xl px-3 py-2.5 text-sm font-medium transition hover:opacity-90"
                  @click="goToBilling"
                >
                  {{ isVip ? '管理订阅' : '立即升级' }}
                </button>
              </div>

              <div
                class="mt-3 flex items-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 px-3 py-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all select-none"
                title="查看 AI 使用额度"
                @click="fetchUsageLimit"
              >
                <UserAvatar :user="authStore.user ?? undefined" size="sm" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {{ authStore.user?.name || '访客用户' }}
                  </p>
                  <p class="truncate text-xs text-slate-400 dark:text-slate-500">
                    {{ authStore.user?.email || '当前会话' }}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section class="ai-main flex min-w-0 flex-1 flex-col">
            <header
              class="flex items-center justify-between gap-3 border-b px-4 py-4 md:px-6 select-none cursor-move"
              style="border-color: rgba(148, 163, 184, 0.14)"
              @mousedown="startDrag"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-3">
                  <!-- Mobile Sidebar Toggle -->
                  <button
                    v-if="isMobile"
                    type="button"
                    class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                    title="历史会话"
                    @click="showMobileSidebar = !showMobileSidebar"
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
                  @click="startNewChat"
                >
                  <Plus class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-rose-500"
                  title="清空历史"
                  @click="clearHistory"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
                <!-- Fullscreen Toggle (Desktop Only) -->
                <button
                  v-if="!isMobile"
                  type="button"
                  class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  :title="isFullscreen ? '退出全屏' : '全屏'"
                  @click="isFullscreen = !isFullscreen"
                >
                  <component :is="isFullscreen ? Minimize2 : Maximize2" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  title="关闭"
                  @click="isOpen = false"
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

                  <div class="group max-w-[92%] md:max-w-[78%]">
                    <div
                      class="rounded-[24px] px-4 py-3.5 shadow-sm"
                      :class="
                        msg.role === 'user' ? 'ai-user-bubble ml-auto' : 'ai-assistant-bubble'
                      "
                    >
                      <div
                        v-if="msg.role === 'assistant' && (msg.reasoning || msg.isThinking)"
                        class="mb-3 border-b border-dashed border-slate-200/80 pb-3 text-xs text-slate-500"
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
                        class="mb-3 border-b border-dashed border-slate-200/80 pb-3 text-xs text-slate-500"
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
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <a
                              v-for="(source, sIdx) in msg.sources"
                              :key="sIdx"
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

                      <MdPreview
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
                        type="button"
                        class="flex items-center gap-1 transition hover:text-slate-700"
                        @click="copyMessage(msg.content, msg.id)"
                      >
                        <component
                          :is="copiedIndex === msg.id ? Check : Copy"
                          class="h-3.5 w-3.5"
                        />
                        <span>{{ copiedIndex === msg.id ? '已复制' : '复制内容' }}</span>
                      </button>
                      <button
                        v-if="
                          msg.role === 'assistant' &&
                          index === activeSessionMessages.length - 1 &&
                          !isGeneratingMap[currentSessionId] &&
                          !isTypingMap[currentSessionId]
                        "
                        type="button"
                        class="flex items-center gap-1 transition hover:text-slate-700"
                        @click="regenerateResponse"
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
                    v-for="(image, index) in uploadedImages"
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
                      @click="removeUploadedImage(index)"
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
                  class="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
                >
                  <textarea
                    ref="textareaRef"
                    v-model="inputMessage"
                    class="min-h-[72px] w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-7 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="输入你的问题或需求，按 Enter 发送，Shift + Enter 换行"
                    :disabled="isGeneratingMap[currentSessionId] || isTypingMap[currentSessionId]"
                    rows="1"
                    @keydown="handleKeydown"
                    @paste="handlePaste"
                  />

                  <div class="mt-2.5 flex items-center justify-between gap-2">
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
                          @click="chatMode = option.value"
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
                          class="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] sm:text-xs font-medium transition hover:bg-slate-50"
                          :style="{
                            background: getProviderMeta(currentModel?.provider || '').bg,
                            color: getProviderMeta(currentModel?.provider || '').color,
                            borderColor: getProviderMeta(currentModel?.provider || '').border,
                          }"
                          @click.stop="showModelDropdown = !showModelDropdown"
                        >
                          <component
                            :is="getProviderMeta(currentModel?.provider || '').lucideIcon"
                            class="h-3.5 w-3.5"
                          />
                          <span class="hidden sm:inline">{{
                            currentModel?.name || '默认模型'
                          }}</span>
                          <ChevronDown class="h-3.5 w-3.5" />
                        </button>

                        <Transition name="fade">
                          <div
                            v-if="showModelDropdown"
                            class="absolute bottom-[calc(100%+10px)] left-0 z-20 min-w-[280px] overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl"
                            style="box-shadow: 0 20px 48px rgba(15,23,42,0.14), 0 0 0 1px rgba(148,163,184,0.08);"
                          >
                            <!-- Header -->
                            <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5">
                              <span class="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">选择 AI 模型</span>
                              <span class="ml-auto rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                {{ availableAiModels.length }} 个可用
                              </span>
                            </div>

                            <!-- Model List -->
                            <div class="max-h-72 overflow-y-auto py-1.5 ai-scrollbar">
                              <button
                                v-for="model in availableAiModels"
                                :key="model.id"
                                type="button"
                                class="group relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-150"
                                :class="
                                  model.id === selectedModelId
                                    ? 'bg-gradient-to-r from-rose-50 to-pink-50/60 dark:from-rose-950/30 dark:to-pink-950/20'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                "
                                @click.stop="
                                  selectedModelId = model.id;
                                  showModelDropdown = false;
                                "
                              >
                                <!-- Provider Icon with colored background -->
                                <div
                                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105"
                                  :style="{
                                    background: getProviderMeta(model.provider).bg,
                                    border: `1px solid ${getProviderMeta(model.provider).border}`,
                                  }"
                                >
                                  <component
                                    :is="getProviderMeta(model.provider).lucideIcon"
                                    class="h-4 w-4"
                                    :style="{ color: getProviderMeta(model.provider).color }"
                                  />
                                </div>

                                <!-- Model Info -->
                                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <div class="flex items-center gap-1.5">
                                    <span
                                      class="text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100"
                                      :title="model.name"
                                    >
                                      {{ model.name }}
                                    </span>
                                    <span
                                      v-if="model.isDefault"
                                      class="shrink-0 rounded-full bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                                    >
                                      默认
                                    </span>
                                  </div>
                                  <span class="block text-[11px] leading-tight text-slate-400 dark:text-slate-500" :title="model.modelName">
                                    {{ model.modelName }}
                                  </span>
                                </div>

                                <!-- Selected checkmark -->
                                <div
                                  v-if="model.id === selectedModelId"
                                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 shadow-sm shadow-rose-200 dark:shadow-rose-900"
                                >
                                  <Check class="h-3 w-3 text-white" />
                                </div>
                              </button>
                            </div>
                          </div>
                        </Transition>
                      </div>

                      <span
                        v-else
                        class="rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-500"
                      >
                        {{ streamMetaMap[currentSessionId]?.model || '默认模型' }}
                      </span>
                    </div>

                    <button
                      v-if="isGeneratingMap[currentSessionId] || isTypingMap[currentSessionId]"
                      type="button"
                      class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition hover:bg-rose-600"
                      @click="handleStop()"
                    >
                      <Square class="h-3.5 w-3.5 fill-current" />
                      <span class="hidden sm:inline">停止生成</span>
                    </button>
                    <button
                      v-else
                      type="button"
                      :disabled="!inputMessage.trim() && uploadedImages.length === 0"
                      class="ai-send-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                      @click="handleSend"
                    >
                      <Send class="h-3.5 w-3.5" />
                      <span class="hidden sm:inline">发送</span>
                    </button>
                  </div>

                  <p class="mt-2 px-1 text-xs text-slate-400 dark:text-slate-500">
                    {{
                      chatMode === 'research'
                        ? '深度研究会自动规划多轮检索并整理来源，适合做方案调研、竞品分析和技术选型。'
                        : chatMode === 'search'
                          ? '联网搜索会补充实时网页结果，适合查询最新信息。'
                          : '普通对话更适合继续当前上下文、代码协作和日常提问。'
                    }}
                  </p>
                </div>
              </div>
            </footer>
          </section>

          <!-- Resize Handle (Desktop floating window only) -->
          <div
            v-if="!isFullscreen && !isMobile"
            class="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize z-50 flex items-end justify-end p-0.5"
            @mousedown.stop="startResize"
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              class="text-slate-400 dark:text-slate-600"
            >
              <line
                x1="6"
                y1="1"
                x2="1"
                y2="6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <line
                x1="7"
                y1="4"
                x2="4"
                y2="7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </Transition>

    <button
      v-if="!isOpen"
      type="button"
      class="ai-trigger group relative flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full border text-white shadow-[0_22px_44px_rgba(244,114,182,0.32)] transition hover:-translate-y-1"
      :class="{ 'cursor-grabbing': isDraggingSprite, 'cursor-grab': !isDraggingSprite }"
      @click="handleSpriteClick"
      @mousedown="startDragSprite"
      @touchstart="startDragSpriteTouch"
    >
      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_48%)]"
      ></div>
      <Sparkles class="relative z-10 h-6 w-6 transition group-hover:scale-110" />
    </button>

    <!-- AI Usage Dialog -->
    <Transition name="fade">
      <div
        v-if="showUsageDialog"
        class="fixed inset-0 z-[150] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="showUsageDialog = false"
        ></div>

        <div
          class="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl"
        >
          <div
            class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4"
          >
            <div class="flex items-center gap-2.5">
              <div class="ai-logo ai-logo--small">
                <Sparkles class="h-4 w-4" />
              </div>
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">AI 助手使用额度</h3>
            </div>
            <button
              type="button"
              class="rounded-xl p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
              @click="showUsageDialog = false"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div v-if="loadingUsage" class="py-5">
            <div class="flex flex-col items-center justify-center gap-2 py-4">
              <span
                class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
              ></span>
              <span class="text-xs text-slate-400">正在获取额度信息...</span>
            </div>
          </div>

          <div v-else-if="usageError" class="py-5">
            <div class="flex flex-col items-center justify-center gap-2.5 py-4 text-center">
              <AlertTriangle class="h-8 w-8 text-rose-500" />
              <span class="text-xs text-slate-600 dark:text-slate-400 px-4 leading-relaxed">
                {{ usageError }}
              </span>
              <button
                type="button"
                class="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all active:scale-95"
                @click="fetchUsageLimit"
              >
                重新尝试
              </button>
            </div>
          </div>

          <div v-else-if="usageData" class="py-5 space-y-5">
            <!-- Plan Badge -->
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400">当前版本</span>
              <span
                class="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider text-white shadow-xs"
                :class="
                  usageData.planName === 'SVIP'
                    ? 'bg-amber-500 shadow-amber-500/20'
                    : usageData.planName === 'VIP'
                      ? 'bg-violet-500 shadow-violet-500/20'
                      : 'bg-slate-500 shadow-slate-500/20'
                "
              >
                {{ usageData.planDisplayName }}
              </span>
            </div>

            <!-- Progress Meter -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-slate-700 dark:text-slate-300">今日对话额度</span>
                <span class="font-bold text-slate-900 dark:text-white">
                  {{ usageData.usedToday }} / {{ usageData.dailyLimit }}
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="[
                    usagePercent >= 90
                      ? 'bg-rose-500'
                      : usagePercent >= 75
                        ? 'bg-amber-500'
                        : 'bg-accent',
                  ]"
                  :style="{ width: usagePercent + '%' }"
                ></div>
              </div>

              <div class="flex justify-between text-[10px] text-slate-400">
                <span>重置时间: 每日 00:00 (北京时间)</span>
                <span>剩余: {{ Math.max(0, usageData.dailyLimit - usageData.usedToday) }} 次</span>
              </div>
            </div>

            <!-- Notice box -->
            <div
              class="rounded-2xl border p-3.5 text-xs leading-5 border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400"
              :class="{
                'border-rose-500/10 bg-rose-500/5 text-rose-500': usagePercent >= 100,
              }"
            >
              <p v-if="usagePercent >= 100">
                ⚠️ 您今天的 AI 对话次数已达上限。请明天再来，或者升级到更高版本以解锁更多额度。
              </p>
              <p v-else-if="usageData.planName === 'FREE'">
                💡 免费版额度为 100
                次/天。如需更高频地整理学习路线、分析大项目或体验深度研究，推荐升级专业版（1000次/天）或旗舰版（10000次/天）。
              </p>
              <p v-else-if="usageData.planName === 'VIP'">
                🌟 专业版额度为 1000 次/天，充足的对话额度能够满足绝大多数协作和代码分析需求。
              </p>
              <p v-else>
                👑 您正在使用旗舰版，享有 10000 次/天的高并发极速对话，以及全方位的专属支持。
              </p>
            </div>
          </div>

          <div
            v-if="!loadingUsage"
            class="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            <button
              v-if="usageData && usageData.planName !== 'SVIP'"
              type="button"
              class="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-accent/90 transition"
              @click="handleUpgradeClick"
            >
              升级版本
            </button>
            <button
              type="button"
              class="ml-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              @click="showUsageDialog = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ai-overlay {
  background:
    radial-gradient(circle at top left, rgba(244, 114, 182, 0.08), transparent 32%),
    rgba(248, 250, 252, 0.5);
  backdrop-filter: blur(8px);
}

.ai-shell {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.96) 0%,
    rgba(255, 251, 248, 0.98) 58%,
    rgba(255, 255, 255, 0.94) 100%
  );
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 35px 80px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(24px);
}

.dark .ai-shell {
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.94) 0%,
    rgba(30, 41, 59, 0.96) 58%,
    rgba(17, 24, 39, 0.94) 100%
  );
  border-color: rgba(148, 163, 184, 0.16);
}

.ai-sidebar {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 250, 247, 0.88) 100%);
  backdrop-filter: blur(18px);
}

.dark .ai-sidebar {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.88) 100%);
}

.ai-main {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 253, 251, 0.88) 100%);
}

.dark .ai-main {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.34) 0%, rgba(15, 23, 42, 0.7) 100%);
}

.ai-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  border-radius: 12px;
  color: #ffffff !important;
  background: linear-gradient(135deg, #60a5fa 0%, var(--accent) 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 16px rgba(var(--accent-rgb), 0.2) !important;
  transition: all 0.3s ease;
}

.ai-logo:hover {
  transform: scale(1.05);
  box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3) !important;
}

.dark .ai-logo {
  color: var(--accent) !important;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 0.95) 100%
  ) !important;
  border: 1px solid rgba(var(--accent-rgb), 0.35) !important;
  box-shadow:
    0 8px 20px rgba(var(--accent-rgb), 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.dark .ai-logo:hover {
  border-color: rgba(var(--accent-rgb), 0.5) !important;
  box-shadow:
    0 10px 24px rgba(var(--accent-rgb), 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

.ai-logo--small {
  height: 30px;
  width: 30px;
  border-radius: 10px;
}

.ai-empty-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88px;
  width: 88px;
  border-radius: 999px;
  color: var(--accent);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(var(--accent-rgb), 0.05));
  border: 1px solid rgba(var(--accent-rgb), 0.15);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 22px 44px rgba(var(--accent-rgb), 0.08);
}

.dark .ai-empty-badge {
  color: var(--accent);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 22px 44px rgba(0, 0, 0, 0.35);
}

.ai-assistant-bubble {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.dark .ai-assistant-bubble {
  background: rgba(15, 23, 42, 0.76);
  border-color: rgba(148, 163, 184, 0.12);
}

.ai-user-bubble {
  background: var(--accent) !important;
  box-shadow: 0 8px 20px rgba(var(--accent-rgb), 0.15) !important;
}

.ai-user-bubble,
.ai-user-bubble * {
  color: #ffffff !important;
}

.ai-trigger {
  border-color: rgba(255, 255, 255, 0.7) !important;
  background: linear-gradient(135deg, #60a5fa 0%, var(--accent) 100%) !important;
  box-shadow: 0 14px 28px rgba(var(--accent-rgb), 0.25) !important;
  transition: all 0.3s ease;
}

.ai-trigger:hover {
  transform: translateY(-4px) scale(1.05) !important;
  box-shadow: 0 18px 36px rgba(var(--accent-rgb), 0.35) !important;
}

.dark .ai-trigger {
  border-color: rgba(var(--accent-rgb), 0.4) !important;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.9) 0%,
    rgba(15, 23, 42, 0.95) 100%
  ) !important;
  color: var(--accent) !important;
  box-shadow:
    0 14px 28px rgba(var(--accent-rgb), 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.dark .ai-trigger:hover {
  border-color: rgba(var(--accent-rgb), 0.5) !important;
  box-shadow:
    0 18px 36px rgba(var(--accent-rgb), 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

.ai-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.ai-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ai-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.ai-preview {
  background: transparent !important;
}

.ai-preview :deep(.md-editor-preview) {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
  font-size: 14px !important;
  line-height: 1.8 !important;
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

.ai-preview :deep(.md-editor-preview img) {
  max-width: 100% !important;
  max-height: 280px !important;
  border-radius: 16px !important;
  object-fit: cover !important;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1) !important;
}

.ai-preview :deep(.md-editor-code pre) {
  border-radius: 16px !important;
  padding: 14px 16px !important;
  font-size: 12px !important;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Dark mode adaptation overrides */
.subscription-card {
  border-color: rgba(251, 191, 36, 0.18) !important;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 247, 237, 0.9) 100%
  ) !important;
}

.dark .subscription-card {
  border-color: rgba(251, 191, 36, 0.1) !important;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.8) 0%,
    rgba(15, 23, 42, 0.85) 100%
  ) !important;
}

.subscription-btn {
  background: #0f172a !important;
  color: #ffffff !important;
}

.dark .subscription-btn {
  background: #f5792a !important;
  color: #ffffff !important;
}

.dark .subscription-btn:hover {
  background: #e0661b !important;
}

/* Override global glass input borders on chat textarea */
html.theme-glass .ai-main textarea,
.ai-main textarea {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.theme-glass .ai-main textarea:focus,
.ai-main textarea:focus {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Ensure clear assistant response text color */
.ai-assistant-bubble {
  color: var(--text-primary) !important;
}

.dark .ai-assistant-bubble {
  color: var(--text-primary) !important;
}

/* Override global glass input borders on transparent search input */
html.theme-glass .ai-sidebar input[type='text'],
.ai-sidebar input[type='text'] {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.theme-glass .ai-sidebar input[type='text']:focus,
.ai-sidebar input[type='text']:focus {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Custom legible text descriptions */
.subscription-desc {
  color: #64748b !important;
}

.dark .subscription-desc {
  color: #cbd5e1 !important;
}

.thinking-content {
  color: #64748b !important;
}

.dark .thinking-content {
  color: #cbd5e1 !important;
}

/* Input placeholder colors in dark mode */
.ai-main textarea::placeholder {
  color: #94a3b8 !important;
}

.dark .ai-main textarea::placeholder {
  color: #64748b !important;
}

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

/* Mobile compaction and drag/resize responsive overrides */
@media (max-width: 767px) {
  .ai-shell {
    border-radius: 0px !important;
  }
  .ai-main header {
    padding-left: 10px !important;
    padding-right: 10px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .ai-main footer {
    padding-left: 10px !important;
    padding-right: 10px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  .ai-main textarea {
    font-size: 13px !important;
    line-height: 1.5 !important;
    min-height: 50px !important;
  }
  .ai-chat-content {
    padding-left: 12px !important;
    padding-right: 12px !important;
    padding-top: 14px !important;
    padding-bottom: 14px !important;
  }
  .ai-preview :deep(.md-editor-preview) {
    font-size: 13px !important;
    line-height: 1.6 !important;
  }
  .ai-preview :deep(.md-editor-code pre) {
    padding: 10px 12px !important;
    border-radius: 10px !important;
  }
  .ai-assistant-bubble,
  .ai-user-bubble {
    border-radius: 16px !important;
    padding: 10px 12px !important;
  }
  .thinking-content {
    font-size: 11px !important;
    padding: 8px 10px !important;
    border-radius: 12px !important;
  }
}
</style>
