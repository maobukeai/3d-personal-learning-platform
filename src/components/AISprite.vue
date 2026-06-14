<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';
import SpriteSidebar from './aiSprite/SpriteSidebar.vue';
import SpriteChatArea from './aiSprite/SpriteChatArea.vue';
import SpriteUsageDialog from './aiSprite/SpriteUsageDialog.vue';
import { useSpriteDraggable } from '@/composables/useSpriteDraggable';
import { preferences } from '@/utils/preferences';

import('md-editor-v3/lib/style.css');

const authStore = useAuthStore();
const systemStore = useSystemStore();
const route = useRoute();
const router = useRouter();

const isVip = computed(() => {
  const sub = authStore.user?.subscription;
  return !!(sub && sub.plan?.name !== 'FREE' && sub.status === 'ACTIVE');
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
const selectedModelId = ref(preferences.getAiSpriteModelId());
const chatAreaRef = ref<InstanceType<typeof SpriteChatArea> | null>(null);
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
  } catch (error: unknown) {
    console.error('[AI Usage] Failed to fetch AI usage:', error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const apiError =
      err?.response?.data?.message || err?.message || '请求发送失败，请检查网络或刷新重试';
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
const width = ref(preferences.getAiSpriteWidth());
const height = ref(preferences.getAiSpriteHeight());
const showMobileSidebar = ref(false);
const windowWidth = ref(window.innerWidth);

const isMobile = computed(() => windowWidth.value < 768);

const {
  spriteX,
  spriteY,
  offsetX,
  offsetY,
  isDraggingSprite,
  hasDraggedSprite,
  startDrag,
  startDragSprite,
  startDragSpriteTouch,
  clampSpritePosition,
} = useSpriteDraggable(isMobile, isFullscreen);

let isUnloading = false;
onMounted(() => {
  window.addEventListener('beforeunload', () => {
    isUnloading = true;
  });
});

const updateWindowSize = () => {
  windowWidth.value = window.innerWidth;
  clampSpritePosition();
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
  preferences.setAiSpriteDimensions(width.value, height.value);
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

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
// Tracks setInterval IDs for pending-run pollers (keyed by sessionId)
const pendingRunPollers: Record<string, ReturnType<typeof setInterval> | null> = {};

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

const currentSessionId = ref(preferences.getAiSpriteSessionId() || generateSessionId());
if (!preferences.getAiSpriteSessionId()) {
  preferences.setAiSpriteSessionId(currentSessionId.value);
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
  preferences.setAiSpriteSessionId(sessionId);
  showMobileSidebar.value = false;
  scrollToBottom();
};

const startNewChat = () => {
  const newSessId = generateSessionId();
  currentSessionId.value = newSessId;
  preferences.setAiSpriteSessionId(newSessId);
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
    } catch (error: unknown) {
    console.error('Failed to delete AI chat session on server:', error);
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
    preferences.setAiSpriteModelId(value);
  } else {
    preferences.removeAiSpriteModelId();
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

const scrollToBottom = async () => {
  chatAreaRef.value?.scrollToBottom();
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
        preferences.setAiSpriteSessionId(latestMsg.sessionId);
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
      const dbMessages = history
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

      // Preserve local placeholder messages for sessions that currently have
      // an active poller (i.e., a pending run is being tracked). Otherwise
      // those placeholders would be wiped and the poller would have no target.
      const activePollerSessions = new Set(
        Object.keys(pendingRunPollers).filter((k) => pendingRunPollers[k] !== null),
      );
      if (activePollerSessions.size > 0) {
        const localActiveMessages = messages.value.filter(
          (m) => activePollerSessions.has(m.sessionId || 'default'),
        );
        // Merge: DB messages for non-active sessions + local messages for active sessions
        messages.value = [
          ...dbMessages.filter((m: any) => !activePollerSessions.has(m.sessionId || 'default')),
          ...localActiveMessages,
        ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else {
        messages.value = dbMessages;
      }

      // Do not overwrite the user's active session if they already have one in localStorage.
      // This prevents a newly created (but not yet saved) session from disappearing on refresh.
      const storedSessId = preferences.getAiSpriteSessionId();
      if (!storedSessId) {
        const latestMsg = messages.value[messages.value.length - 1];
        if (latestMsg && latestMsg.sessionId) {
          currentSessionId.value = latestMsg.sessionId;
          preferences.setAiSpriteSessionId(latestMsg.sessionId);
        }
      } else {
        currentSessionId.value = storedSessId;
      }
    } else {
      messages.value = [createGreetingMessage()];
    }
    syncActiveHistory();
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status !== 401) {
      console.error('Failed to fetch AI chat history from server:', error);
    }
    loadGuestHistory();
  }
};


// ---------------------------------------------------------------------------
// Pending-run persistence helpers
// ---------------------------------------------------------------------------
// localStorage key format: ai_pending_run_{sessionId}  =>  JSON string with
// { runId, userContent, sessionTitle, mode, assistantMsgId, createdAt }

const getPendingRunIndex = (): string[] => {
  return preferences.getAiPendingRunsIndex();
};

const addToPendingRunIndex = (sessionId: string) => {
  try {
    const index = getPendingRunIndex();
    if (!index.includes(sessionId)) {
      index.push(sessionId);
      preferences.setAiPendingRunsIndex(index);
    }
  } catch { /* ignore */ }
};

const removeFromPendingRunIndex = (sessionId: string) => {
  try {
    const index = getPendingRunIndex().filter((id) => id !== sessionId);
    preferences.setAiPendingRunsIndex(index);
  } catch { /* ignore */ }
};

const savePendingRun = (
  sessionId: string,
  runId: string,
  userContent: string,
  sessionTitle: string,
  mode: string,
  assistantMsgId: string,
) => {
  try {
    preferences.setAiPendingRun(
      sessionId,
      JSON.stringify({ runId, userContent, sessionTitle, mode, assistantMsgId, createdAt: Date.now() }),
    );
    addToPendingRunIndex(sessionId);
  } catch { /* ignore */ }
};

const clearPendingRun = (sessionId: string) => {
  try {
    preferences.removeAiPendingRun(sessionId);
    removeFromPendingRunIndex(sessionId);
  } catch { /* ignore */ }
};

const getAllPendingRuns = (): Array<{
  sessionId: string;
  runId: string;
  userContent: string;
  sessionTitle: string;
  mode: string;
  assistantMsgId: string;
  createdAt: number;
}> => {
  const result = [];
  const sessionIds = getPendingRunIndex();
  for (const sessionId of sessionIds) {
    const raw = preferences.getAiPendingRun(sessionId);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.createdAt < 30 * 60 * 1000) {
          result.push({ sessionId, ...parsed });
        } else {
          clearPendingRun(sessionId);
        }
      } catch { /* ignore corrupted entry */ }
    }
  }
  return result;
};

// Stop polling for a specific session (does NOT cancel the server-side run)
const stopPendingRunPoller = (sessionId: string) => {
  if (pendingRunPollers[sessionId]) {
    clearTimeout(pendingRunPollers[sessionId]!);
    pendingRunPollers[sessionId] = null;
  }
};

// Poll /api/projects/ai-chat/runs/:runId/status and update message content in real time
const pollPendingRun = (
  sessionId: string,
  runId: string,
  assistantMsgId: string,
) => {
  stopPendingRunPoller(sessionId);

  let lastContent = '';
  let lastReasoning = '';
  let consecutiveErrors = 0;

  const finishPoll = async (msgObj: typeof messages.value[0] | undefined) => {
    stopPendingRunPoller(sessionId);
    clearPendingRun(sessionId);
    isGeneratingMap.value[sessionId] = false;
    isTypingMap.value[sessionId] = false;
    if (msgObj) {
      msgObj.isThinking = false;
      msgObj.isThinkingExpanded = false;
    }
    saveHistory();
    if (sessionId === currentSessionId.value) {
      await scrollToBottom();
    }
  };

  const poll = async () => {
    // If a live SSE stream is now active for this session, stop polling to avoid conflict
    if (activeAbortControllers[sessionId]) {
      stopPendingRunPoller(sessionId);
      return;
    }
    try {
      const res = await api.get(`/api/projects/ai-chat/runs/${encodeURIComponent(runId)}/status`);
      const data = res.data?.data;
      if (!data) return;

      consecutiveErrors = 0;

      const msgObj = messages.value.find((m) => m.id === assistantMsgId);
      if (msgObj) {
        // Server returns full accumulated content each time — just overwrite
        if (data.content && data.content !== lastContent) {
          msgObj.content = data.content;
          lastContent = data.content;
          msgObj.isThinking = false;
        }
        if (data.reasoning && data.reasoning !== lastReasoning) {
          msgObj.reasoning = data.reasoning;
          lastReasoning = data.reasoning;
        }
        // Scroll while content is streaming in
        if (sessionId === currentSessionId.value && (data.content || data.reasoning)) {
          scrollToBottom();
        }
      }

      if (data.completed) {
        // done=true means: stream finished AND DB write is complete
        // We already have the full content from the last poll above, so just finalize
        await finishPoll(msgObj);

        // Edge case: run was already cleaned from memory before our first poll
        // (data.done=true, no content from server) — reload from DB
        if (!lastContent && !lastReasoning) {
          await loadHistory();
        }
      } else {
        // Schedule next poll if not completed
        pendingRunPollers[sessionId] = setTimeout(poll, 500) as any;
      }
    } catch (err: any) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        const msgObj = messages.value.find((m) => m.id === assistantMsgId);
        if (msgObj && !msgObj.content) {
          msgObj.content = 'AI 服务暂时不可用，请重新提问。';
          msgObj.isThinking = false;
        }
        await finishPoll(msgObj);
      } else {
        // Retry on error
        pendingRunPollers[sessionId] = setTimeout(poll, 1000) as any;
      }
    }
  };

  // Trigger immediately
  poll();
};

// Called after loadHistory to resume any interrupted runs
const resumePendingRuns = () => {
  if (!authStore.isAuthenticated) return;
  const pendingRuns = getAllPendingRuns();
  if (pendingRuns.length === 0) return;

  for (const run of pendingRuns) {
    const { sessionId, runId, userContent, sessionTitle, assistantMsgId } = run;

    // Check if assistant message already exists (history may have included it)
    const existingMsg = messages.value.find((m) => m.id === assistantMsgId);

    if (existingMsg && existingMsg.content) {
      // Already finished and loaded from DB — clean up
      clearPendingRun(sessionId);
      continue;
    }

    // Ensure the user message is present
    const userMsgExists = messages.value.some(
      (m) => m.role === 'user' && (m.sessionId || 'default') === sessionId && m.content === userContent,
    );
    if (!userMsgExists) {
      messages.value.push(
        createMessage('user', userContent, { sessionId, sessionTitle }),
      );
    }

    // Ensure the assistant placeholder exists
    if (!existingMsg) {
      messages.value.push(
        createMessage('assistant', '', {
          id: assistantMsgId,
          isThinking: true,
          isThinkingExpanded: true,
          sessionId,
          sessionTitle,
        }),
      );
    }

    // Mark session as generating so the UI shows a spinner
    isGeneratingMap.value[sessionId] = true;

    // Switch to that session if it is the most recent one
    const storedSessId = preferences.getAiSpriteSessionId();
    if (!storedSessId || storedSessId === sessionId) {
      currentSessionId.value = sessionId;
    }

    // Start polling
    pollPendingRun(sessionId, runId, assistantMsgId);
  }
};

watch(
  () => authStore.isAuthenticated,
  async () => {
    await loadHistory();
    resumePendingRuns();
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
      chatAreaRef.value?.focusTextarea();
      scrollToBottom();
    });
  } else {
    showModelDropdown.value = false;
    showMobileSidebar.value = false;
  }
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

const handleUploadFiles = async (files: FileList) => {
  isUploading.value = true;
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (file.type.startsWith('image/')) {
        await uploadAndAppendImage(file);
      }
    }
  } finally {
    isUploading.value = false;
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

    if (hasReasoning && chatAreaRef.value) {
      const msgEl = chatAreaRef.value.messageRefs.get(currentMessage.id);
      if (msgEl) {
        const thinkingContentEl = msgEl.querySelector('.thinking-content');
        if (thinkingContentEl) {
          thinkingContentEl.scrollTop = thinkingContentEl.scrollHeight;
        }
      }
    }

    if (sId === currentSessionId.value && chatAreaRef.value) {
      const container = chatAreaRef.value.chatContainer;
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

  // Stop any background poll for this session and clear localStorage state
  stopPendingRunPoller(sId);
  clearPendingRun(sId);

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
  chatAreaRef.value?.resetTextareaHeight();
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

  // Generate a clientRunId so the backend keeps running even if the page is refreshed
  const clientRunId = `run_${sId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Persist the pending run to localStorage so resumePendingRuns can pick it up on reload
  if (authStore.isAuthenticated) {
    savePendingRun(sId, clientRunId, userContent, sessionTitle, chatMode.value, assistantMessage.id);
  }

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
        clientRunId,
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
  } catch (error: unknown) {
    const err = error as Error & { response?: { status?: number } };
    if (err.name !== 'AbortError') {
      console.error('AI streaming chat error in session:', sId, error);
    }
    isGeneratingMap.value[sId] = false;
    flushTypewriterQueue(assistantMessage.id, sId);
    const message = err?.message || '连接失败';
    const msgObj = messages.value.find((m) => m.id === assistantMessage.id);
    if (msgObj) {
      msgObj.content = err.name === 'AbortError' ? '生成已终止' : `AI 服务暂时不可用：${message}`;
      msgObj.isThinking = false;
      msgObj.isThinkingExpanded = false;
    }
  } finally {
    stopTypewriter(sId);
    isTypingMap.value[sId] = false;
    activeReaders[sId] = null;
    activeAbortControllers[sId] = null;
    
    // Only clear the pending run if the page is NOT unloading.
    // If it is unloading (refreshing/closing), we must keep the run in localStorage
    // so that resumePendingRuns can pick it up when the page reloads.
    if (!isUnloading) {
      clearPendingRun(sId);
      stopPendingRunPoller(sId);
    }
    
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
  preferences.setAiSpriteSessionId(newSessId);

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
  chatAreaRef.value?.focusTextarea();
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
  // Clear all active typewriter timers
  Object.values(typewriterTimerMap).forEach((timer) => {
    if (timer) clearInterval(timer);
  });
  // Clear all pending run pollers
  Object.values(pendingRunPollers).forEach((timer) => {
    if (timer) clearTimeout(timer);
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
          <SpriteSidebar
            v-model:showMobileSidebar="showMobileSidebar"
            v-model:historySearch="historySearch"
            :is-mobile="isMobile"
            :current-session-id="currentSessionId"
            :recent-prompts="recentPrompts"
            :chat-sessions="chatSessions"
            :is-vip="isVip"
            :vip-plan-name="vipPlanName"
            @new-session="startNewChat"
            @select-session="selectSession"
            @delete-session="deleteSession"
            @fetch-usage="fetchUsageLimit"
            @go-to-billing="goToBilling"
          />

          <SpriteChatArea
            ref="chatAreaRef"
            v-model:showMobileSidebar="showMobileSidebar"
            v-model:isFullscreen="isFullscreen"
            v-model:isOpen="isOpen"
            v-model:inputMessage="inputMessage"
            v-model:chatMode="chatMode"
            v-model:showModelDropdown="showModelDropdown"
            :is-mobile="isMobile"
            :current-conversation-title="currentConversationTitle"
            :current-conversation-meta="currentConversationMeta"
            :should-show-landing-state="shouldShowLandingState"
            :active-session-messages="activeSessionMessages"
            :current-session-id="currentSessionId"
            :is-generating="isGeneratingMap[currentSessionId]"
            :is-typing="isTypingMap[currentSessionId]"
            :uploaded-images="uploadedImages"
            :is-uploading="isUploading"
            :upload-error="uploadError"
            :available-ai-models="availableAiModels"
            :current-model="currentModel"
            :is-dark="isDark"
            :copied-index="copiedIndex"
            @select-model="selectedModelId = $event"
            @start-new-chat="startNewChat"
            @clear-history="clearHistory"
            @copy-message="copyMessage"
            @regenerate-response="regenerateResponse"
            @drag-start="startDrag"
            @upload-files="handleUploadFiles"
            @remove-image="removeUploadedImage"
            @handle-send="handleSend"
            @handle-stop="handleStop()"
            @paste="handlePaste"
          />

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
    <SpriteUsageDialog
      v-model="showUsageDialog"
      :loading="loadingUsage"
      :error="usageError"
      :data="usageData"
      @upgrade="handleUpgradeClick"
      @retry="fetchUsageLimit"
    />
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
