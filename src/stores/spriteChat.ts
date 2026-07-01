import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { preferences } from '@/utils/preferences';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { ElMessage } from 'element-plus';

export interface Message {
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

export interface StoredMessage {
  id?: string;
  role?: 'user' | 'assistant';
  content?: string;
  createdAt?: string;
  reasoning?: string;
  sessionId?: string;
  sessionTitle?: string;
  sources?: Message['sources'];
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  time: string;
  createdAt: string;
}

export const AUTO_MODEL_ID = '__AUTO__';

const autoModelOption = {
  id: AUTO_MODEL_ID,
  name: '✨ 自动（推荐）',
  provider: 'AUTO',
  enabled: true,
  isAuto: true,
};

const makeMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const generateSessionId = () => {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
};

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

const redactLocalMessage = (content: string) =>
  content
    .replace(
      /\b(?:api[_-]?key|token|secret|password|passwd|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;]+)/gi,
      (match) => match.replace(/([:=]\s*)([^\s,;]+)/, '$1[已脱敏]'),
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [已脱敏]');

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
    logError(error, { operation: 'ai.formatHistoryTime', component: 'SpriteChatStore' });
    return '';
  }
};

const SOURCES_MARKER = '\n[sources]: ';

const parseSourcesFromReasoning = (reasoningText: string) => {
  if (!reasoningText) return { text: '', sources: null };
  const idx = reasoningText.lastIndexOf(SOURCES_MARKER);
  if (idx >= 0) {
    try {
      const sourcesStr = reasoningText.slice(idx + SOURCES_MARKER.length);
      const parsed = JSON.parse(sourcesStr);
      if (!Array.isArray(parsed)) return { text: reasoningText, sources: null };
      return {
        text: reasoningText.slice(0, idx),
        sources: parsed as Message['sources'],
      };
    } catch {
      return { text: reasoningText, sources: null };
    }
  }
  return { text: reasoningText, sources: null };
};

export const useSpriteChatStore = defineStore('spriteChat', () => {
  const authStore = useAuthStore();
  const systemStore = useSystemStore();

  // Scroll callback hook
  const onScrollToBottom = ref<(() => void) | null>(null);

  // States
  const messages = ref<Message[]>([]);
  const currentSessionId = ref(preferences.getAiSpriteSessionId() || generateSessionId());
  if (!preferences.getAiSpriteSessionId()) {
    preferences.setAiSpriteSessionId(currentSessionId.value);
  }

  const inputMessage = ref('');
  const uploadedImages = ref<{ url: string; name: string }[]>([]);
  const chatMode = ref<'default' | 'search' | 'research'>('default');
  const selectedModelId = ref(preferences.getAiSpriteModelId() || AUTO_MODEL_ID);
  const historySearch = ref('');
  const activeHistoryId = ref('');
  const copiedIndex = ref<string | null>(null);
  const isUploading = ref(false);
  const uploadError = ref('');

  const isGeneratingMap = ref<Record<string, boolean>>({});
  const isTypingMap = ref<Record<string, boolean>>({});
  const streamMetaMap = ref<
    Record<string, { provider?: string; model?: string; requestId?: string } | null>
  >({});

  const typewriterQueueMap = ref<Record<string, { type: 'text' | 'reasoning'; char: string }[]>>(
    {},
  );
  const typewriterTimerMap: Record<string, ReturnType<typeof setInterval> | null> = {};
  const typewriterTargetIdMap = ref<Record<string, string>>({});
  const pendingRunPollers: Record<string, ReturnType<typeof setInterval> | null> = {};

  let uploadErrorTimer: ReturnType<typeof setTimeout> | null = null;
  let isUnloading = false;

  // Active readers & controllers maps
  const activeReaders: Record<string, ReadableStreamDefaultReader<Uint8Array> | null> = {};
  const activeAbortControllers: Record<string, AbortController | null> = {};

  // Computed
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

  const availableAiModels = computed(() => {
    const models = [...(systemStore.settings.AI_MODEL_OPTIONS || [])]
      .filter((model) => model.enabled)
      .sort((a, b) => {
        const pa = a.priority ?? 999;
        const pb = b.priority ?? 999;
        return pa - pb;
      });

    return [autoModelOption, ...models];
  });

  const currentModel = computed(
    () =>
      availableAiModels.value.find((model) => model.id === selectedModelId.value) ||
      availableAiModels.value[0],
  );

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

  const recentPrompts = computed(() => {
    const filtered = historySearch.value.trim().toLowerCase();
    return chatSessions.value.filter((item) => {
      if (!filtered) return true;

      if (
        item.title.toLowerCase().includes(filtered) ||
        item.preview.toLowerCase().includes(filtered)
      ) {
        return true;
      }

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

  // Helper Methods
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

  const selectSession = (sessionId: string) => {
    currentSessionId.value = sessionId;
    preferences.setAiSpriteSessionId(sessionId);
    nextTick(() => {
      onScrollToBottom.value?.();
    });
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
    saveHistory();
    nextTick(() => {
      onScrollToBottom.value?.();
    });
  };

  const deleteSession = async (sessionId: string) => {
    const isDeletingActive = currentSessionId.value === sessionId;
    const originalMessages = [...messages.value];

    messages.value = messages.value.filter((msg) => (msg.sessionId || 'default') !== sessionId);

    if (authStore.isAuthenticated) {
      try {
        await api.delete('/api/projects/ai-chat/history', {
          params: { sessionId },
        });
      } catch (error: unknown) {
        logError(error, { operation: 'ai.deleteSession', component: 'SpriteChatStore' });
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

  const saveHistory = () => {
    if (!authStore.isAuthenticated) {
      const safeMessages = messages.value.slice(-200).map((message) => ({
        ...message,
        content: redactLocalMessage(message.content),
        isThinking: false,
        isThinkingExpanded: false,
      }));
      sessionStorage.setItem('ai_sprite_chat_history', JSON.stringify(safeMessages));
    }
  };

  const syncActiveHistory = () => {
    const lastUserMessage = [...messages.value]
      .reverse()
      .find((message) => message.role === 'user');
    activeHistoryId.value = lastUserMessage?.id || '';
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
          .filter((msg: StoredMessage) => msg?.role === 'user' || msg?.role === 'assistant')
          .slice(-200)
          .map((msg: StoredMessage) => {
            const sourcesResult = parseSourcesFromReasoning(msg.reasoning || '');
            return createMessage(msg.role!, msg.content!, {
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
      logError(error, { operation: 'loadChatHistory', component: 'SpriteChatStore' });
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
          .filter((msg: StoredMessage) => msg?.role === 'user' || msg?.role === 'assistant')
          .slice(-400)
          .map((msg: StoredMessage) => {
            const sourcesResult = parseSourcesFromReasoning(msg.reasoning || '');
            return createMessage(msg.role!, msg.content!, {
              id: msg.id,
              createdAt: msg.createdAt,
              reasoning: sourcesResult.text,
              sources: sourcesResult.sources || undefined,
              isSourcesExpanded: false,
              sessionId: msg.sessionId || 'default',
              sessionTitle: msg.sessionTitle || '新对话',
            });
          });

        const activePollerSessions = new Set(
          Object.keys(pendingRunPollers).filter((k) => pendingRunPollers[k] !== null),
        );
        if (activePollerSessions.size > 0) {
          const localActiveMessages = messages.value.filter((m) =>
            activePollerSessions.has(m.sessionId || 'default'),
          );
          messages.value = [
            ...dbMessages.filter(
              (m: Message) => !activePollerSessions.has(m.sessionId || 'default'),
            ),
            ...localActiveMessages,
          ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else {
          messages.value = dbMessages;
        }

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
        logError(error, { operation: 'ai.fetchHistory', component: 'SpriteChatStore' });
      }
      loadGuestHistory();
    }
  };

  // Pending Runs Pollers
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
        JSON.stringify({
          runId,
          userContent,
          sessionTitle,
          mode,
          assistantMsgId,
          createdAt: Date.now(),
        }),
      );
      const index = preferences.getAiPendingRunsIndex();
      if (!index.includes(sessionId)) {
        index.push(sessionId);
        preferences.setAiPendingRunsIndex(index);
      }
    } catch {
      /* ignore */
    }
  };

  const clearPendingRun = (sessionId: string) => {
    try {
      preferences.removeAiPendingRun(sessionId);
      const index = preferences.getAiPendingRunsIndex().filter((id) => id !== sessionId);
      preferences.setAiPendingRunsIndex(index);
    } catch {
      /* ignore */
    }
  };

  const stopPendingRunPoller = (sessionId: string) => {
    if (pendingRunPollers[sessionId]) {
      clearTimeout(pendingRunPollers[sessionId]!);
      pendingRunPollers[sessionId] = null;
    }
  };

  const pollPendingRun = (sessionId: string, runId: string, assistantMsgId: string) => {
    stopPendingRunPoller(sessionId);

    let lastContent = '';
    let lastReasoning = '';
    let consecutiveErrors = 0;

    const finishPoll = async (msgObj: Message | undefined) => {
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
        nextTick(() => {
          onScrollToBottom.value?.();
        });
      }
    };

    const poll = async () => {
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
          if (data.content && data.content !== lastContent) {
            msgObj.content = data.content;
            lastContent = data.content;
            msgObj.isThinking = false;
          }
          if (data.reasoning && data.reasoning !== lastReasoning) {
            msgObj.reasoning = data.reasoning;
            lastReasoning = data.reasoning;
          }
          if (sessionId === currentSessionId.value && (data.content || data.reasoning)) {
            onScrollToBottom.value?.();
          }
        }

        if (data.completed) {
          await finishPoll(msgObj);
          if (!lastContent && !lastReasoning) {
            await loadHistory();
          }
        } else {
          pendingRunPollers[sessionId] = setTimeout(poll, 500) as ReturnType<typeof setInterval>;
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          const msgObj = messages.value.find((m) => m.id === assistantMsgId);
          if (msgObj && !msgObj.content) {
            msgObj.content = 'AI 服务暂时不可用，请重新提问。';
            msgObj.isThinking = false;
          }
          await finishPoll(msgObj);
        } else {
          pendingRunPollers[sessionId] = setTimeout(poll, 1000) as ReturnType<typeof setInterval>;
        }
      }
    };

    poll();
  };

  const resumePendingRuns = () => {
    if (!authStore.isAuthenticated) return;
    const sessionIds = preferences.getAiPendingRunsIndex();
    const pendingRuns = [];
    for (const sessionId of sessionIds) {
      const raw = preferences.getAiPendingRun(sessionId);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.createdAt < 30 * 60 * 1000) {
            pendingRuns.push({ sessionId, ...parsed });
          } else {
            clearPendingRun(sessionId);
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (pendingRuns.length === 0) return;

    for (const run of pendingRuns) {
      const { sessionId, runId, userContent, sessionTitle, assistantMsgId } = run;

      const existingMsg = messages.value.find((m) => m.id === assistantMsgId);
      if (existingMsg && existingMsg.content) {
        clearPendingRun(sessionId);
        continue;
      }

      const userMsgExists = messages.value.some(
        (m) =>
          m.role === 'user' &&
          (m.sessionId || 'default') === sessionId &&
          m.content === userContent,
      );
      if (!userMsgExists) {
        messages.value.push(createMessage('user', userContent, { sessionId, sessionTitle }));
      }

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

      isGeneratingMap.value[sessionId] = true;

      const storedSessId = preferences.getAiSpriteSessionId();
      if (!storedSessId || storedSessId === sessionId) {
        currentSessionId.value = sessionId;
      }

      pollPendingRun(sessionId, runId, assistantMsgId);
    }
  };

  // Image attach validations
  const canAttachImage = (file: File) => {
    const MAX_UPLOAD_IMAGES = 4;
    const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
    const SUPPORTED_UPLOAD_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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
      nextTick(() => {
        onScrollToBottom.value?.();
      });
    } catch (error) {
      logError(error, { operation: 'ai.uploadImage', component: 'SpriteChatStore' });
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

  // Typewriter logic
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

      for (let index = 0; index < batch; index += 1) {
        const item = queue.shift();
        if (!item) continue;

        if (item.type === 'reasoning') {
          currentMessage.isThinking = true;
          currentMessage.reasoning = `${currentMessage.reasoning || ''}${item.char}`;
        } else {
          currentMessage.isThinking = false;
          currentMessage.content += item.char;
        }
      }

      // Trigger scrolling during typewriter streaming
      if (sId === currentSessionId.value) {
        onScrollToBottom.value?.();
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
        logError(error, {
          operation: 'ai.abortFetch',
          sessionId: sId,
          component: 'SpriteChatStore',
        });
      }
      activeAbortControllers[sId] = null;
    }
    if (activeReaders[sId]) {
      try {
        activeReaders[sId]!.cancel();
      } catch (error) {
        logError(error, {
          operation: 'ai.cancelReader',
          sessionId: sId,
          component: 'SpriteChatStore',
        });
      }
      activeReaders[sId] = null;
    }

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

  const handleSend = async (routePath = '') => {
    const sId = currentSessionId.value;
    if (isGeneratingMap.value[sId] || isTypingMap.value[sId]) return;

    const textMessage = inputMessage.value.trim();
    if (!textMessage && uploadedImages.value.length === 0) return;

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
      nextTick(() => {
        onScrollToBottom.value?.();
      });
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

    nextTick(() => {
      onScrollToBottom.value?.();
    });

    const chatHistory = activeSessionMessages.value.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const sessionTitle =
      activeSessionMessages.value
        .find((message) => message.role === 'user')
        ?.content.slice(0, 30) || '新对话';

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

    const clientRunId = `run_${sId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    if (authStore.isAuthenticated) {
      savePendingRun(
        sId,
        clientRunId,
        userContent,
        sessionTitle,
        chatMode.value,
        assistantMessage.id,
      );
    }

    nextTick(() => {
      onScrollToBottom.value?.();
    });

    try {
      const response = await fetch('/api/projects/ai-chat', {
        method: 'POST',
        headers: createJsonHeaders(),
        signal,
        body: JSON.stringify({
          messages: chatHistory,
          modelId: selectedModelId.value || undefined,
          context: {
            path: routePath,
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
        logError(error, {
          operation: 'ai.streamingChat',
          sessionId: sId,
          component: 'SpriteChatStore',
        });
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

      if (!isUnloading) {
        clearPendingRun(sId);
        stopPendingRunPoller(sId);
      }

      saveHistory();
      if (sId === currentSessionId.value) {
        nextTick(() => {
          onScrollToBottom.value?.();
        });
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
        logError(error, { operation: 'ai.clearHistory', component: 'SpriteChatStore' });
      }
    } else {
      saveHistory();
    }

    messages.value = [
      createMessage('assistant', '历史记录已清空，请告诉我新的目标、问题或需要分析的上下文。', {
        sessionId: newSessId,
      }),
    ];

    nextTick(() => {
      onScrollToBottom.value?.();
    });
  };

  const regenerateResponse = async () => {
    const sId = currentSessionId.value;
    if (isGeneratingMap.value[sId] || isTypingMap.value[sId]) return;

    const sessionMessages = messages.value.filter(
      (message) => (message.sessionId || 'default') === sId,
    );
    const lastUserMessage = [...sessionMessages]
      .reverse()
      .find((message) => message.role === 'user');
    if (!lastUserMessage) return;

    if (authStore.isAuthenticated) {
      try {
        await api.post('/api/projects/ai-chat/messages/clean', {
          sessionId: sId,
          messageId: lastUserMessage.id,
          inclusive: true,
        });
      } catch (error) {
        logError(error, { operation: 'ai.cleanMessagesRegenerate', component: 'SpriteChatStore' });
        return;
      }
    }

    messages.value = messages.value.filter(
      (message) =>
        (message.sessionId || 'default') !== sId ||
        new Date(message.createdAt).getTime() < new Date(lastUserMessage.createdAt).getTime(),
    );
    inputMessage.value = sanitizePreviewText(lastUserMessage.content);
    await handleSend();
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const sId = currentSessionId.value;
    if (isGeneratingMap.value[sId] || isTypingMap.value[sId]) return;

    const targetMsg = messages.value.find((m) => m.id === messageId);
    if (!targetMsg) return;

    if (authStore.isAuthenticated) {
      try {
        await api.post('/api/projects/ai-chat/messages/clean', {
          sessionId: sId,
          messageId: messageId,
          inclusive: true,
        });
      } catch (error) {
        logError(error, { operation: 'ai.cleanMessagesEdit', component: 'SpriteChatStore' });
        return;
      }
    }

    messages.value = messages.value.filter(
      (message) =>
        (message.sessionId || 'default') !== sId ||
        new Date(message.createdAt).getTime() < new Date(targetMsg.createdAt).getTime(),
    );

    inputMessage.value = newContent;
    await handleSend();
  };

  const setUnloading = (val: boolean) => {
    isUnloading = val;
  };

  return {
    // Hooks
    onScrollToBottom,

    // State refs
    messages,
    currentSessionId,
    inputMessage,
    uploadedImages,
    chatMode,
    selectedModelId,
    historySearch,
    activeHistoryId,
    copiedIndex,
    isUploading,
    uploadError,
    isGeneratingMap,
    isTypingMap,
    streamMetaMap,

    // Computed
    isVip,
    vipPlanName,
    availableAiModels,
    currentModel,
    chatSessions,
    activeSessionMessages,
    recentPrompts,
    currentConversationTitle,
    currentConversationMeta,
    shouldShowLandingState,

    // Actions
    selectSession,
    startNewChat,
    deleteSession,
    loadHistory,
    saveHistory,
    handleUploadFiles,
    handlePaste,
    removeUploadedImage,
    handleStop,
    handleSend,
    clearHistory,
    regenerateResponse,
    editMessage,
    setUnloading,
    resumePendingRuns,
  };
});
