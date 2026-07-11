<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUnmounted,
  defineAsyncComponent,
  nextTick,
} from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import {
  Sparkles,
  X,
  Send,
  Square,
  Copy,
  Check,
  Brain,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-vue-next';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));

// ────────────────────────────────────────────────────────────────
// Props / Emits
// ────────────────────────────────────────────────────────────────
const props = defineProps<{
  show: boolean;
  editorText: string;
  selectedText: string;
  isDark: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply', payload: { mode: 'replace' | 'append' | 'copy'; content: string }): void;
}>();

// ────────────────────────────────────────────────────────────────
// Constants & Types
// ────────────────────────────────────────────────────────────────
const AI_COMMANDS = [
  { value: 'polish', label: '润色', icon: '✨', desc: '改进遣词造句，使行文更流畅、专业' },
  { value: 'extend', label: '扩写', icon: '📝', desc: '丰富细节，增加字数与阐述深度' },
  { value: 'summarize', label: '总结', icon: '📋', desc: '提炼核心，精简输出' },
  { value: 'continue', label: '续写', icon: '✍️', desc: '顺着原意继续写作' },
  { value: 'translate', label: '翻译', icon: '🌐', desc: '翻译为目标语言' },
  { value: 'generate', label: '创作', icon: '🪄', desc: '根据描述自由生成' },
];

type AIAction = 'polish' | 'extend' | 'summarize' | 'continue' | 'translate' | 'generate';
type WritingTone = 'balanced' | 'professional' | 'friendly' | 'academic' | 'concise';
type WritingLength = 'short' | 'balanced' | 'detailed';
type WritingFormat = 'keep' | 'paragraphs' | 'outline' | 'steps';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  actionLabel?: string;
  actionIcon?: string;
  ctxSummary?: string;
  promptText?: string;
  actionValue?: AIAction;
  content: string;
  reasoning: string;
  showReasoning: boolean;
  isStreaming: boolean;
  requestId?: string;
  error?: string;
  applied?: boolean;
  timestamp: Date;
}

const TONE_OPTIONS: { value: WritingTone; label: string }[] = [
  { value: 'balanced', label: '均衡' },
  { value: 'professional', label: '专业' },
  { value: 'friendly', label: '易懂' },
  { value: 'academic', label: '严谨' },
  { value: 'concise', label: '精简' },
];

const LENGTH_OPTIONS: { value: WritingLength; label: string }[] = [
  { value: 'short', label: '短' },
  { value: 'balanced', label: '中' },
  { value: 'detailed', label: '详' },
];

const FORMAT_OPTIONS: { value: WritingFormat; label: string }[] = [
  { value: 'keep', label: '保留' },
  { value: 'paragraphs', label: '段落' },
  { value: 'outline', label: '大纲' },
  { value: 'steps', label: '步骤' },
];

// ────────────────────────────────────────────────────────────────
// AI & Layout Local States
// ────────────────────────────────────────────────────────────────
const aiAction = ref<AIAction>('polish');
const targetLanguage = ref('English');
const writingTone = ref<WritingTone>('balanced');
const writingLength = ref<WritingLength>('balanced');
const writingFormat = ref<WritingFormat>('keep');
const customInstruction = ref('');
const showSettings = ref(true);

const messages = reactive<ChatMessage[]>([]);
const activeId = ref<number | null>(null);
const copiedId = ref<number | null>(null);
const isGenerating = ref(false);
const abortCtrl = ref<AbortController | null>(null);

const chatText = ref('');
const chatRows = ref(1);
const messagesEnd = ref<HTMLElement | null>(null);
const chatInputRef = ref<HTMLTextAreaElement | null>(null);

// Context selection mode
const ctxMode = ref<'full' | 'selected'>('full');

const ctxText = computed(() => {
  return ctxMode.value === 'selected' ? props.selectedText : props.editorText;
});

const ctxLabel = computed(() => (ctxMode.value === 'selected' ? '聚焦选区' : '使用全文'));

const toggleCtxMode = () => {
  if (isGenerating.value) return;
  if (ctxMode.value === 'selected') {
    ctxMode.value = 'full';
  } else {
    if (!props.selectedText.trim()) {
      ElMessage.warning('当前无选中文字，自动锁定全文');
      ctxMode.value = 'full';
    } else {
      ctxMode.value = 'selected';
    }
  }
};

const hasSelection = computed(() => props.selectedText.trim().length > 0);
const primaryApplyLabel = computed(() => (hasSelection.value ? '替换选区' : '替换全文'));

const selectedCommand = computed(() => AI_COMMANDS.find((c) => c.value === aiAction.value));
const activeActionLabel = computed(() => selectedCommand.value?.label ?? '写作');
const contextCharCount = computed(() => ctxText.value.length);

const contextPreview = computed(() => {
  const normalized = ctxText.value.replace(/\s+/g, ' ').trim();
  return normalized
    ? normalized.slice(0, 90) + (normalized.length > 90 ? '…' : '')
    : '暂无文档上下文';
});

const contextQuality = computed(() => {
  if (aiAction.value === 'generate' && chatText.value.trim()) return '可直接创作';
  if (contextCharCount.value === 0) return '需要内容';
  if (contextCharCount.value > 30000) return '将自动截断';
  return ctxMode.value === 'selected' ? '聚焦选区' : '使用全文';
});

const canRunAction = computed(() => {
  if (isGenerating.value) return false;
  if (aiAction.value === 'generate') return chatText.value.trim().length > 0;
  return ctxText.value.trim().length > 0;
});

// ────────────────────────────────────────────────────────────────
// Drag & Resize Position States
// ────────────────────────────────────────────────────────────────
const isMaximized = ref(false);
const isMobile = ref(false);

const panelPos = ref({ left: 0, top: 0 });
const panelSize = ref({ width: 460, height: 720 });
const prevSize = ref({ width: 460, height: 720 });

const MIN_W = 300,
  MAX_W = 680,
  MIN_H = 380,
  MAX_H = 820;

const panelStyle = computed(() => {
  if (isMobile.value) {
    return {
      left: '8px',
      top: '8px',
      width: 'calc(100% - 16px)',
      height: 'min(76vh, 640px)',
    };
  }
  return {
    left: panelPos.value.left + 'px',
    top: panelPos.value.top + 'px',
    width: panelSize.value.width + 'px',
    height: panelSize.value.height + 'px',
  };
});

const initPanelPosition = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const defaultW = 460;
  const defaultH = 720;

  panelSize.value = {
    width: Math.max(MIN_W, Math.min(defaultW, vw - 32)),
    height: Math.max(MIN_H, Math.min(defaultH, vh - 64)),
  };

  panelPos.value = {
    left: Math.max(8, vw - panelSize.value.width - 24),
    top: Math.max(24, (vh - panelSize.value.height) / 2),
  };
};

const clampPanelToBounds = () => {
  if (!props.show) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (isMaximized.value) {
    panelSize.value = { width: vw, height: vh };
    panelPos.value = { left: 0, top: 0 };
    return;
  }

  const targetW = Math.max(MIN_W, Math.min(panelSize.value.width, vw - 16));
  const targetH = Math.max(MIN_H, Math.min(panelSize.value.height, vh - 16));
  if (panelSize.value.width !== targetW || panelSize.value.height !== targetH) {
    panelSize.value = { width: targetW, height: targetH };
  }

  const maxLeft = Math.max(0, vw - panelSize.value.width - 8);
  const maxTop = Math.max(0, vh - panelSize.value.height - 8);

  panelPos.value = {
    left: Math.max(8, Math.min(maxLeft, panelPos.value.left)),
    top: Math.max(8, Math.min(maxTop, panelPos.value.top)),
  };
};

// ── Drag ─────────────────────────────────────────────────────────
const isDragging = ref(false);
const dragOrigin = reactive({ mx: 0, my: 0, px: 0, py: 0 });

const startDrag = (e: MouseEvent) => {
  if (isMobile.value || isMaximized.value) return;
  if (
    (e.target as HTMLElement).closest(
      'button, a, input, select, textarea, .aip__ctx, .aip__close, .aip__maximize',
    )
  )
    return;
  isDragging.value = true;
  dragOrigin.mx = e.clientX;
  dragOrigin.my = e.clientY;
  dragOrigin.px = panelPos.value.left;
  dragOrigin.py = panelPos.value.top;
  document.addEventListener('mousemove', onDragMove, { passive: true });
  document.addEventListener('mouseup', stopDrag, { once: true });
};

const onDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = e.clientX - dragOrigin.mx;
  const dy = e.clientY - dragOrigin.my;

  const targetLeft = dragOrigin.px + dx;
  const targetTop = dragOrigin.py + dy;

  const maxLeft = vw - panelSize.value.width - 8;
  const maxTop = vh - panelSize.value.height - 8;

  panelPos.value = {
    left: Math.max(8, Math.min(maxLeft, targetLeft)),
    top: Math.max(8, Math.min(maxTop, targetTop)),
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
};

// ── Resize ───────────────────────────────────────────────────────
const isResizing = ref(false);
const resizeOrigin = reactive({ mx: 0, my: 0, pw: 0, ph: 0 });

const startResize = (e: MouseEvent) => {
  if (isMobile.value || isMaximized.value) return;
  isResizing.value = true;
  resizeOrigin.mx = e.clientX;
  resizeOrigin.my = e.clientY;
  resizeOrigin.pw = panelSize.value.width;
  resizeOrigin.ph = panelSize.value.height;
  document.addEventListener('mousemove', onResizeMove, { passive: true });
  document.addEventListener('mouseup', stopResize, { once: true });
};

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = e.clientX - resizeOrigin.mx;
  const dy = e.clientY - resizeOrigin.my;

  const newW = Math.max(MIN_W, Math.min(MAX_W, resizeOrigin.pw + dx, vw - panelPos.value.left - 8));
  const newH = Math.max(MIN_H, Math.min(MAX_H, resizeOrigin.ph + dy, vh - panelPos.value.top - 8));

  panelSize.value = { width: newW, height: newH };
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResizeMove);
};

const toggleMaximize = () => {
  if (isMobile.value) return;
  if (isMaximized.value) {
    isMaximized.value = false;
    panelSize.value = { ...prevSize.value };
    clampPanelToBounds();
  } else {
    prevSize.value = { ...panelSize.value };
    isMaximized.value = true;
    panelSize.value = { width: window.innerWidth, height: window.innerHeight };
    panelPos.value = { left: 0, top: 0 };
  }
};

const updateWindowSize = () => {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth < 768;

  if (isMobile.value) {
    isMaximized.value = false;
  }

  if (!isMobile.value && props.show && wasMobile) {
    initPanelPosition();
  } else {
    clampPanelToBounds();
  }
};

// ────────────────────────────────────────────────────────────────
// Generation logic
// ────────────────────────────────────────────────────────────────
const scrollToEnd = () => {
  nextTick(() => {
    if (messagesEnd.value) {
      messagesEnd.value.scrollIntoView({ behavior: 'smooth' });
    }
  });
};

const buildHistoryPayload = () =>
  messages
    .filter((msg) => {
      if (msg.id === activeId.value) return false;
      if (msg.error) return false;
      return msg.content || msg.promptText || msg.ctxSummary;
    })
    .slice(-6)
    .map((msg) => ({
      role: msg.role,
      content:
        msg.role === 'assistant'
          ? msg.content
          : `${msg.actionLabel || '写作'}：${msg.promptText || msg.ctxSummary || ''}`,
    }));

const cancelGeneration = () => {
  if (abortCtrl.value) {
    abortCtrl.value.abort();
    abortCtrl.value = null;
  }
  if (activeId.value !== null) {
    const msg = messages.find((m) => m.id === activeId.value);
    if (msg) msg.isStreaming = false;
    activeId.value = null;
  }
  isGenerating.value = false;
};

const runGeneration = async (promptOverride?: string) => {
  const context = ctxText.value;
  const action = aiAction.value;
  const prompt = promptOverride ?? '';

  if (action === 'generate' && !prompt.trim()) {
    ElMessage.warning('请在底部输入框描述您的创作要求');
    nextTick(() => chatInputRef.value?.focus());
    return;
  }
  if (action !== 'generate' && !context.trim()) {
    ElMessage.warning('内容为空，请先输入文字，或在编辑器中选中一段文字');
    return;
  }

  cancelGeneration();

  const cmd = AI_COMMANDS.find((c) => c.value === action);
  const ctxSnip = context.substring(0, 60) + (context.length > 60 ? '…' : '');
  const userMsg: ChatMessage = {
    id: Date.now(),
    role: 'user',
    actionLabel: cmd?.label ?? action,
    actionIcon: cmd?.icon ?? '🤖',
    ctxSummary: ctxSnip,
    promptText: prompt || undefined,
    actionValue: action,
    content: '',
    reasoning: '',
    showReasoning: false,
    isStreaming: false,
    timestamp: new Date(),
  };
  messages.push(userMsg);
  scrollToEnd();

  const assistId = Date.now() + 1;
  const assistMsg: ChatMessage = {
    id: assistId,
    role: 'assistant',
    content: '',
    reasoning: '',
    showReasoning: false,
    isStreaming: true,
    timestamp: new Date(),
  };
  messages.push(assistMsg);
  activeId.value = assistId;
  isGenerating.value = true;
  abortCtrl.value = new AbortController();
  scrollToEnd();

  try {
    const response = await fetch('/api/ai/write-assist', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        action,
        text: context,
        prompt: action === 'generate' ? prompt : undefined,
        instruction: customInstruction.value || undefined,
        scope: ctxMode.value,
        tone: writingTone.value,
        length: writingLength.value,
        format: writingFormat.value,
        history: buildHistoryPayload(),
        targetLanguage: action === 'translate' ? targetLanguage.value : undefined,
      }),
      signal: abortCtrl.value.signal,
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取');

    await parseSSEStream(
      reader,
      (payload) => {
        const msg = messages.find((m) => m.id === assistId);
        if (!msg) return;
        if (payload.event === 'meta') {
          msg.requestId = payload.requestId;
          return;
        }
        if (payload.event === 'heartbeat') return;
        if (payload.error) {
          msg.error = payload.error;
          throw new Error(payload.error);
        }
        if (payload.reasoning) {
          msg.reasoning += payload.reasoning;
          if (!msg.showReasoning) msg.showReasoning = true;
        }
        if (payload.text) {
          msg.content += payload.text;
        }
        scrollToEnd();
      },
      () => {
        const msg = messages.find((m) => m.id === assistId);
        if (msg) {
          msg.isStreaming = false;
          msg.showReasoning = false;
        }
        activeId.value = null;
        isGenerating.value = false;
        abortCtrl.value = null;
        scrollToEnd();
      },
      (err) => {
        if (err.name === 'AbortError') return;
        const msg = messages.find((m) => m.id === assistId);
        if (msg) {
          msg.isStreaming = false;
          msg.error = err.message;
          msg.content = msg.content || '生成出错，请重试';
        }
        ElMessage.error(`生成出错：${err.message}`);
        isGenerating.value = false;
        abortCtrl.value = null;
        activeId.value = null;
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    const message = error instanceof Error ? error.message : 'AI 生成失败，请重试';
    const msg = messages.find((m) => m.id === assistId);
    if (msg) {
      msg.isStreaming = false;
      msg.error = message;
      msg.content = msg.content || '生成失败，请重试';
    }
    ElMessage.error(message);
    isGenerating.value = false;
    abortCtrl.value = null;
    activeId.value = null;
  }
};

const submitChat = () => {
  const msg = chatText.value.trim();
  if (!msg || isGenerating.value) return;
  aiAction.value = 'generate';
  chatText.value = '';
  chatRows.value = 1;
  nextTick(() => runGeneration(msg));
};

const onChatKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitChat();
  }
};

const onChatInput = () => {
  chatRows.value = Math.min(chatText.value.split('\n').length, 4);
};

const runSelectedAction = () => {
  if (!canRunAction.value) {
    if (aiAction.value === 'generate') {
      ElMessage.warning('请在底部输入框描述您的创作要求');
      nextTick(() => chatInputRef.value?.focus());
    } else {
      ElMessage.warning('编辑器内容为空，请先输入文字，或在编辑器中选中一段文字');
    }
    return;
  }
  if (aiAction.value === 'generate') {
    submitChat();
  } else {
    runGeneration();
  }
};

const handleApply = (mode: 'replace' | 'append' | 'copy', content: string, msg: ChatMessage) => {
  emit('apply', { mode, content });
  if (mode !== 'copy') {
    msg.applied = true;
  }
};

const clearMessages = () => {
  if (isGenerating.value) return;
  messages.splice(0, messages.length);
};

watch(
  () => props.show,
  (val) => {
    if (val) {
      ctxMode.value = props.selectedText.trim() ? 'selected' : 'full';
      aiAction.value = 'polish';
      chatText.value = '';
      chatRows.value = 1;
      showSettings.value = true;
      nextTick(() => {
        initPanelPosition();
        scrollToEnd();
      });
    } else {
      cancelGeneration();
      stopDrag();
      stopResize();
      isMaximized.value = false;
    }
  },
);

onMounted(() => {
  isMobile.value = window.innerWidth < 768;
  window.addEventListener('resize', updateWindowSize);
});

onUnmounted(() => {
  cancelGeneration();
  window.removeEventListener('resize', updateWindowSize);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="aip">
      <aside
        v-if="show"
        class="aip"
        :class="{
          'aip--dragging': isDragging,
          'aip--resizing': isResizing,
          'aip--maximized': isMaximized,
        }"
        :style="panelStyle"
      >
        <!-- ── Header (drag handle) ──────────────── -->
        <header class="aip__hd" @mousedown.left="startDrag">
          <div class="aip__hd-left">
            <Sparkles class="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span class="aip__hd-title">AI 协同写作</span>
            <!-- Context badge -->
            <button
              type="button"
              class="aip__ctx"
              :class="ctxMode === 'selected' ? 'aip__ctx--sel' : 'aip__ctx--full'"
              title="点击切换上下文范围"
              @click.stop="toggleCtxMode"
            >
              {{ ctxLabel }}
            </button>
          </div>

          <div class="aip__hd-right">
            <button
              type="button"
              class="aip__ico-btn aip__maximize"
              :title="isMaximized ? '还原' : '最大化'"
              @click="toggleMaximize"
            >
              <Minimize2 v-if="isMaximized" class="w-3.5 h-3.5" />
              <Maximize2 v-else class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="aip__ico-btn aip__close"
              title="关闭"
              @click="emit('close')"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <!-- ── Toolbar (chips and triggers) ────── -->
        <div class="aip__toolbar">
          <div class="aip__chips">
            <button
              v-for="cmd in AI_COMMANDS"
              :key="cmd.value"
              type="button"
              class="aip__chip"
              :class="{
                'aip__chip--active': aiAction === cmd.value,
                'aip__chip--disabled': isGenerating,
              }"
              :disabled="isGenerating"
              @click="aiAction = cmd.value as AIAction"
            >
              <span>{{ cmd.icon }}</span>
              <span>{{ cmd.label }}</span>
            </button>
          </div>

          <div class="aip__toolbar-actions">
            <!-- Language Select for Translate -->
            <Transition name="fade">
              <Select
                v-if="aiAction === 'translate'"
                v-model="targetLanguage"
                class="aip__translate-select !w-32 custom-select"
                :disabled="isGenerating"
              >
                <SelectOption value="English" label="English" />
                <SelectOption value="中文 (简体)" label="中文" />
                <SelectOption value="日本語" label="日本語" />
                <SelectOption value="Deutsch" label="Deutsch" />
                <SelectOption value="Français" label="Français" />
                <SelectOption value="Español" label="Español" />
              </Select>
            </Transition>

            <button
              type="button"
              class="aip__run-btn"
              :disabled="!canRunAction"
              @click="runSelectedAction"
            >
              <Play class="w-3 h-3 fill-current" />
              <span>生成</span>
            </button>
            <button
              v-if="messages.length > 0"
              type="button"
              class="aip__clear-btn"
              title="清空对话历史"
              :disabled="isGenerating"
              @click="clearMessages"
            >
              <RotateCcw class="w-3 h-3" />
            </button>
            <button
              type="button"
              class="aip__ico-btn aip__settings-btn"
              :class="{ 'aip__settings-btn--on': showSettings }"
              title="AI 参数控制"
              @click="showSettings = !showSettings"
            >
              <SlidersHorizontal class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- ── Context preview banner ───────────── -->
        <section class="aip__brief">
          <div class="aip__brief-main">
            <span class="aip__quality-badge">{{ contextQuality }}</span>
            <span class="aip__char-count">{{ contextCharCount }} 字数</span>
            <strong v-if="aiAction === 'translate'">翻译至 {{ targetLanguage }}</strong>
            <strong v-else>使用 {{ activeActionLabel }} 策略</strong>
          </div>
          <p>{{ contextPreview }}</p>
        </section>

        <!-- ── Settings Drawer (Sliders) ────────── -->
        <section v-if="showSettings" class="aip__settings">
          <div class="aip__seg-row">
            <span>语气风格</span>
            <div class="aip__seg">
              <button
                v-for="o in TONE_OPTIONS"
                :key="o.value"
                type="button"
                :class="{ 'is-on': writingTone === o.value }"
                @click="writingTone = o.value"
              >
                {{ o.label }}
              </button>
            </div>
          </div>

          <div class="aip__seg-row">
            <span>篇幅字数</span>
            <div class="aip__seg aip__seg--compact">
              <button
                v-for="o in LENGTH_OPTIONS"
                :key="o.value"
                type="button"
                :class="{ 'is-on': writingLength === o.value }"
                @click="writingLength = o.value"
              >
                {{ o.label }}
              </button>
            </div>
            <span>排版格式</span>
            <div class="aip__seg">
              <button
                v-for="o in FORMAT_OPTIONS"
                :key="o.value"
                type="button"
                :class="{ 'is-on': writingFormat === o.value }"
                @click="writingFormat = o.value"
              >
                {{ o.label }}
              </button>
            </div>
          </div>

          <!-- Instruction prompt -->
          <input
            v-model="customInstruction"
            type="text"
            placeholder="高级微调：在此处输入具体微调指示（例：用鲁迅口吻、使用幽默调子）"
            class="aip__instruction"
            :disabled="isGenerating"
          />

          <!-- Guard -->
          <div class="aip__guard">
            <ShieldCheck class="w-3.5 h-3.5 text-slate-400" />
            <span>AI 大模型在智能排版与分析时不影响您的原始文档</span>
          </div>
        </section>

        <!-- ── Message Chat Stream viewport ────── -->
        <div class="aip__msgs">
          <div v-if="messages.length === 0" class="aip__empty">
            <Brain class="w-12 h-12 text-slate-200 dark:text-slate-700 stroke-[1.2] mb-3" />
            <p>准备就绪，选择策略点击“生成”启动 AI</p>
            <span>可以点击上方气泡快速润色、总结或翻译文档，支持微调输入</span>
          </div>

          <div v-for="msg in messages" :key="msg.id" class="aip__msg-wrapper">
            <!-- User block -->
            <div v-if="msg.role === 'user'" class="aip__msg aip__msg--user">
              <div class="aip__msg-meta">
                <span>{{ msg.actionIcon }}</span>
                <strong>{{ msg.actionLabel }}</strong>
                <span>• {{ msg.ctxSummary }}</span>
              </div>
              <p v-if="msg.promptText" class="aip__user-prompt">{{ msg.promptText }}</p>
            </div>

            <!-- Assistant block -->
            <div v-else class="aip__msg aip__msg--assist">
              <!-- Reasoning details (Thinking) -->
              <div v-if="msg.reasoning" class="aip__reasoning">
                <button
                  type="button"
                  class="aip__reasoning-toggle"
                  @click="msg.showReasoning = !msg.showReasoning"
                >
                  <Brain class="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>{{ msg.showReasoning ? '隐藏 AI 思考路径' : '展开 AI 思考路径' }}</span>
                </button>
                <div v-if="msg.showReasoning" class="aip__reasoning-content">
                  {{ msg.reasoning }}
                </div>
              </div>

              <!-- Stream Text Body -->
              <div class="aip__msg-body">
                <pre
                  v-if="msg.isStreaming && !msg.content"
                  class="chat-ai__stream-text"
                >正在组织语言...<span class="aip__cursor">▋</span></pre>
                <pre
                  v-else-if="msg.isStreaming"
                  class="chat-ai__stream-text">{{ msg.content || ' ' }}<span class="aip__cursor">▋</span></pre>
                <MdPreview
                  v-else
                  :model-value="msg.content"
                  :theme="isDark ? 'dark' : 'light'"
                  class="aip__md-preview"
                  preview-only
                />

                <!-- Errors -->
                <div v-if="msg.error" class="aip__msg-error">
                  {{ msg.error }}
                </div>

                <!-- Footer action buttons -->
                <div v-if="!msg.isStreaming && msg.content" class="chat-ai__actions">
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--primary"
                    :disabled="msg.applied"
                    @click="handleApply('replace', msg.content, msg)"
                  >
                    <span>{{ msg.applied ? '已应用' : primaryApplyLabel }}</span>
                  </button>
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--secondary"
                    @click="handleApply('append', msg.content, msg)"
                  >
                    <span>追加尾部</span>
                  </button>
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--ghost"
                    @click="handleApply('copy', msg.content, msg)"
                  >
                    <Check v-if="copiedId === msg.id" class="w-3 h-3 text-green-500" />
                    <Copy v-else class="w-3 h-3" />
                    <span>{{ copiedId === msg.id ? '已复制' : '复制' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Streaming status bar at bottom of messages -->
          <div v-if="isGenerating" class="aip__status-bar">
            <div
              v-if="activeId && messages.find((m) => m.id === activeId)?.isStreaming"
              class="aip__thinking-bar"
            >
              <span class="aip__dots"><span></span><span></span><span></span></span>
              <span>AI 正在撰写建议中</span>
              <button type="button" class="aip__stop" @click="cancelGeneration">
                <Square class="w-2.5 h-2.5 fill-current" />
                <span>停止生成</span>
              </button>
            </div>
            <div v-else class="aip__stop-bar">
              <button type="button" class="aip__stop" @click="cancelGeneration">
                <Square class="w-2.5 h-2.5 fill-current" />
                <span>停止</span>
              </button>
            </div>
          </div>

          <div ref="messagesEnd" class="h-2"></div>
        </div>

        <!-- ── Footer (prompt instruction) ──────── -->
        <footer class="aip__ft">
          <div class="aip__chat">
            <textarea
              ref="chatInputRef"
              v-model="chatText"
              :rows="chatRows"
              placeholder="输入创作指令（例：写一篇 Blender 快捷键介绍...）"
              class="aip__chat-input"
              :disabled="isGenerating"
              @input="onChatInput"
              @keydown="onChatKeydown"
            ></textarea>
            <button
              type="button"
              class="aip__chat-send"
              :class="{ 'aip__chat-send--on': chatText.trim() && !isGenerating }"
              :disabled="!chatText.trim() || isGenerating"
              @click="submitChat"
            >
              <Send class="w-3.5 h-3.5" />
            </button>
          </div>
        </footer>

        <!-- Resize Handle -->
        <div class="aip__resize-handle" @mousedown.stop="startResize"></div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.aip {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.16);
  border-radius: 14px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  user-select: none;
  font-family: inherit;
}
.aip--dragging {
  opacity: 0.88;
  cursor: grabbing;
}
.aip--resizing {
  opacity: 0.94;
}
.aip--maximized {
  border-radius: 0;
  border: none;
  box-shadow: none;
}
.aip-enter-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.aip-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.aip-enter-from {
  opacity: 0;
  transform: translate(20px, 0) scale(0.96);
}
.aip-leave-to {
  opacity: 0;
  transform: translate(20px, 0) scale(0.96);
}

.aip__hd {
  height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-subtle);
  cursor: grab;
  flex-shrink: 0;
}
.aip__hd:active {
  cursor: grabbing;
}
.aip__hd-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.aip__hd-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.aip__hd-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.aip__ctx {
  padding: 2px 7px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.aip__ctx--full {
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-secondary);
}
.aip__ctx--sel {
  background: rgba(168, 85, 247, 0.12);
  color: #a855f7;
}
.aip__ctx:hover {
  opacity: 0.85;
}
.aip__ico-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.aip__ico-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}
.aip__toolbar {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  background: var(--bg-card);
}
.aip__chips {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow-x: auto;
}
.aip__chips::-webkit-scrollbar {
  display: none;
}
.aip__chip {
  padding: 4.5px 8px;
  border-radius: 7px;
  font-size: 11.5px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3.5px;
  white-space: nowrap;
  transition: all 0.15s;
}
.aip__chip:hover:not(.aip__chip--disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.aip__chip--active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}
.aip__chip--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.aip__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 5.5px;
  flex-shrink: 0;
}
.aip__run-btn {
  padding: 4.5px 9px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  border: none;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}
.aip__run-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.aip__run-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.aip__clear-btn {
  width: 25px;
  height: 25px;
  border-radius: 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.aip__clear-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}
.aip__settings-btn {
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}
.aip__settings-btn--on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}
.aip__translate-select {
  padding: 4px 6px;
  border-radius: 7px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  font-size: 11.5px;
  outline: none;
  color: var(--text-primary);
}
.aip__brief {
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-base);
  padding: 7px 10px;
  font-size: 11.5px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.aip__brief-main {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.aip__quality-badge {
  font-size: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 4px;
}
.aip__char-count {
  color: var(--text-muted);
}
.aip__brief-main strong {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-primary);
}
.aip__brief p {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aip__settings {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-base);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.aip__seg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--text-secondary);
}
.aip__seg-row > span {
  font-size: 11px;
  color: var(--text-muted);
  width: 52px;
  flex-shrink: 0;
}
.aip__seg {
  flex: 1;
  display: flex;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.aip__seg button {
  flex: 1;
  padding: 3px 0;
  border-radius: 4px;
  font-size: 11px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.aip__seg button.is-on {
  background: var(--bg-card);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.aip__seg--compact button {
  font-size: 10.5px;
}
.aip__instruction {
  width: 100%;
  padding: 6px 9px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 7px;
  font-size: 11.5px;
  outline: none;
  color: var(--text-primary);
  transition: border-color 0.15s;
}
.aip__instruction:focus {
  border-color: var(--accent);
}
.aip__guard {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-muted);
}
.aip__msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: text;
}
.aip__empty {
  margin: auto;
  text-align: center;
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.aip__empty p {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.aip__empty span {
  font-size: 11.5px;
  color: var(--text-muted);
  max-width: 240px;
}
.aip__msg-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.aip__msg {
  max-width: 90%;
  display: flex;
  flex-direction: column;
}
.aip__msg--user {
  align-self: flex-end;
  background: var(--accent-light);
  border: 1px solid var(--accent-light-border, var(--border-base));
  border-radius: 10px 10px 2px 10px;
  padding: 7px 10px;
  font-size: 12.5px;
}
.aip__msg-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary);
}
.aip__user-prompt {
  margin-top: 3px;
  color: var(--text-primary);
  font-size: 12.5px;
  line-height: 1.4;
  word-break: break-all;
}
.aip__msg--assist {
  align-self: flex-start;
  width: 100%;
}
.aip__reasoning {
  margin-bottom: 6px;
}
.aip__reasoning-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.aip__reasoning-toggle:hover {
  color: var(--text-primary);
}
.aip__reasoning-content {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border-left: 3px solid #8b5cf6;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.45;
  white-space: pre-wrap;
}
.aip__msg-body {
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
  border-radius: 10px 10px 10px 2px;
  padding: 8px 10px;
}
.chat-ai__stream-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
}
.aip__cursor {
  display: inline-block;
  color: var(--accent);
  font-weight: bold;
  animation: aip-blink 0.8s infinite;
}
@keyframes aip-blink {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}
.aip__msg-error {
  margin-top: 5px;
  font-size: 11.5px;
  color: #ef4444;
}
.chat-ai__actions {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
}
.ai-act-btn {
  flex: 1;
  padding: 5px 6px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1.5px solid transparent;
}
.ai-act-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.ai-act-btn--primary {
  background: var(--accent);
  color: #fff;
}
.ai-act-btn--primary:not(:disabled):hover {
  background: var(--accent-hover);
}
.ai-act-btn--secondary {
  background: var(--bg-app);
  border-color: var(--border-base);
  color: var(--text-primary);
}
.ai-act-btn--secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.ai-act-btn--ghost {
  background: transparent;
  border-color: var(--border-base);
  color: var(--text-muted);
}
.ai-act-btn--ghost:hover {
  color: var(--text-primary);
  background: var(--bg-subtle);
}
.aip__thinking-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
  font-size: 11.5px;
  color: var(--text-muted);
}
.aip__stop-bar {
  display: flex;
  justify-content: flex-end;
}
.aip__dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.aip__dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
.aip__dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.aip__dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes dot-pulse {
  0%,
  60%,
  100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}
.aip__stop {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.07);
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.aip__stop:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.6);
}
.aip__ft {
  border-top: 1px solid var(--border-base);
  padding: 9px 10px;
  flex-shrink: 0;
  background-color: var(--bg-card);
}
.aip__chat {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-app);
  border: 1.5px solid var(--border-base);
  border-radius: 10px;
  padding: 7px 8px;
  transition: border-color 0.15s;
}
.aip__chat:focus-within {
  border-color: var(--accent);
}
.aip__chat-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  resize: none;
  font-size: 12.5px;
  color: var(--text-primary);
  line-height: 1.45;
  min-height: 20px;
  max-height: 80px;
  overflow-y: auto;
  font-family: inherit;
  user-select: text;
}
.aip__chat-input::placeholder {
  color: var(--text-muted);
}
.aip__chat-input:disabled {
  opacity: 0.5;
}
.aip__chat-send {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: none;
  background: var(--border-base);
  color: var(--text-muted);
  cursor: not-allowed;
  transition: all 0.15s ease;
}
.aip__chat-send--on {
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.aip__chat-send--on:hover {
  background: var(--accent-hover);
}
.aip__resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 18px;
  height: 18px;
  cursor: se-resize;
  background: linear-gradient(
    135deg,
    transparent 40%,
    var(--border-strong) 40%,
    var(--border-strong) 50%,
    transparent 50%,
    transparent 66%,
    var(--border-strong) 66%,
    var(--border-strong) 76%,
    transparent 76%
  );
  border-radius: 0 0 14px 0;
  opacity: 0.45;
  transition: opacity 0.2s;
}
.aip__resize-handle:hover {
  opacity: 0.9;
}

@media (max-width: 767px) {
  .aip {
    border-radius: 12px;
  }
  .aip__hd {
    height: 40px;
  }
  .aip__toolbar {
    align-items: flex-start;
  }
  .aip__chips {
    flex-wrap: wrap;
  }
  .aip__seg-row {
    flex-wrap: wrap;
  }
  .aip__seg {
    flex-wrap: wrap;
  }
  .chat-ai__actions {
    flex-wrap: wrap;
  }
  .ai-act-btn {
    min-width: calc(50% - 4px);
  }
  .aip__resize-handle {
    display: none;
  }
}

.fade-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.fade-leave-to {
  opacity: 0;
}
</style>
