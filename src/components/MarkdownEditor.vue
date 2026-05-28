<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import {
  ref, reactive, computed, onMounted, onUnmounted,
  defineAsyncComponent, nextTick,
} from 'vue';
import { NormalToolbar } from 'md-editor-v3';
import type { ToolbarNames } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
const MdEditor = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdEditor));
const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
import { useI18n } from 'vue-i18n';
import api, { getAssetUrl } from '@/utils/api';
import { ElMessage } from 'element-plus';
import {
  Sparkles, X, Send, Square, Copy, Check,
  ChevronDown, ChevronUp, Brain, GripHorizontal,
  Maximize2, Minimize2, Play, RotateCcw, SlidersHorizontal,
  FileText, ShieldCheck,
} from 'lucide-vue-next';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';

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
const editorId     = ref(`md-editor-${Math.random().toString(36).substring(2, 11)}`);
const editorRef    = ref<any>(null);
const chatInputRef = ref<HTMLTextAreaElement | null>(null);
const messagesEnd  = ref<HTMLElement | null>(null);

// ────────────────────────────────────────────────────────────────
// Panel draggable / resizable state
// ────────────────────────────────────────────────────────────────
const showPanel   = ref(false);
const isMaximized = ref(false);
const isMobile    = ref(false);

const panelPos  = ref({ left: 0, top: 0 });
const panelSize = ref({ width: 460, height: 720 });
const prevSize  = ref({ width: 460, height: 720 }); // restore after maximize

const MIN_W = 300, MAX_W = 680, MIN_H = 380, MAX_H = 820;

/** Computed style binding for the floating panel */
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
    left:   panelPos.value.left  + 'px',
    top:    panelPos.value.top   + 'px',
    width:  panelSize.value.width  + 'px',
    height: panelSize.value.height + 'px',
  };
});

/** Initialize panel position to the right side of the viewport */
const initPanelPosition = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const defaultW = 460;
  const defaultH = 720;

  panelSize.value = {
    width: Math.max(MIN_W, Math.min(defaultW, vw - 32)),
    height: Math.max(MIN_H, Math.min(defaultH, vh - 64))
  };

  panelPos.value = {
    left: Math.max(8, vw - panelSize.value.width - 24),
    top: Math.max(24, (vh - panelSize.value.height) / 2)
  };
};

/** Keep the panel inside the boundaries of the viewport */
const clampPanelToBounds = () => {
  if (!showPanel.value) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  if (isMaximized.value) {
    panelSize.value = {
      width: vw,
      height: vh
    };
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
const isDragging  = ref(false);
const dragOrigin  = reactive({ mx: 0, my: 0, px: 0, py: 0 });

const startDrag = (e: MouseEvent) => {
  if (isMobile.value || isMaximized.value) return;
  if ((e.target as HTMLElement).closest('button, a, input, select, textarea, .aip__ctx, .aip__close, .aip__maximize')) return;
  isDragging.value = true;
  dragOrigin.mx = e.clientX;
  dragOrigin.my = e.clientY;
  dragOrigin.px = panelPos.value.left;
  dragOrigin.py = panelPos.value.top;
  document.addEventListener('mousemove', onDragMove, { passive: true });
  document.addEventListener('mouseup',   stopDrag,   { once: true });
};

const onDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = e.clientX - dragOrigin.mx;
  const dy = e.clientY - dragOrigin.my;
  panelPos.value = {
    left: Math.max(0, Math.min(vw - panelSize.value.width,  dragOrigin.px + dx)),
    top:  Math.max(0, Math.min(vh - panelSize.value.height, dragOrigin.py + dy)),
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
};

// ── Resize ───────────────────────────────────────────────────────
const isResizing   = ref(false);
const resizeOrigin = reactive({ mx: 0, my: 0, w: 0, h: 0 });

const startResize = (e: MouseEvent) => {
  if (isMobile.value || isMaximized.value) return;
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeOrigin.mx = e.clientX;
  resizeOrigin.my = e.clientY;
  resizeOrigin.w  = panelSize.value.width;
  resizeOrigin.h  = panelSize.value.height;
  document.addEventListener('mousemove', onResizeMove, { passive: true });
  document.addEventListener('mouseup',   stopResize,   { once: true });
};

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return;
  const dx = e.clientX - resizeOrigin.mx;
  const dy = e.clientY - resizeOrigin.my;
  
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.min(MAX_W, vw - panelPos.value.left);
  const maxH = Math.min(MAX_H, vh - panelPos.value.top);
  
  panelSize.value = {
    width:  Math.max(MIN_W, Math.min(maxW, resizeOrigin.w + dx)),
    height: Math.max(MIN_H, Math.min(maxH, resizeOrigin.h + dy)),
  };
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResizeMove);
};

// ── Maximize ─────────────────────────────────────────────────────
const toggleMaximize = () => {
  if (isMobile.value) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (isMaximized.value) {
    panelSize.value = { ...prevSize.value };
    isMaximized.value = false;
    nextTick(() => clampPanelToBounds());
  } else {
    prevSize.value  = { ...panelSize.value };
    panelSize.value = { width: vw, height: vh };
    panelPos.value  = { left: 0, top: 0 };
    isMaximized.value = true;
  }
};

// ────────────────────────────────────────────────────────────────
// AI state
// ────────────────────────────────────────────────────────────────
const isGenerating = ref(false);
const abortCtrl    = ref<AbortController | null>(null);

// Context tracking
interface SavedSel { start: number; end: number; text: string }
const savedSel = ref<SavedSel>({ start: 0, end: 0, text: '' });
const ctxMode  = ref<'full' | 'selected'>('full');

const ctxText  = computed(() =>
  ctxMode.value === 'selected' && savedSel.value.text ? savedSel.value.text : text.value,
);
const ctxLabel = computed(() =>
  ctxMode.value === 'selected' && savedSel.value.text
    ? `🔒 选区  ${savedSel.value.text.length} 字`
    : `📄 全文  ${text.value.length} 字`,
);
const hasSelection = computed(
  () => ctxMode.value === 'selected' && savedSel.value.start < savedSel.value.end,
);

// Quick actions
const AI_COMMANDS: { value: string; label: string; icon: string; desc: string }[] = [
  { value: 'polish',    label: '润色', icon: '✨', desc: '修饰排版，提升表达' },
  { value: 'extend',    label: '扩写', icon: '📖', desc: '深化内容，丰富细节' },
  { value: 'summarize', label: '总结', icon: '📋', desc: '提炼核心，精简输出' },
  { value: 'continue',  label: '续写', icon: '✍️', desc: '顺着原意继续写作' },
  { value: 'translate', label: '翻译', icon: '🌐', desc: '翻译为目标语言' },
  { value: 'generate',  label: '创作', icon: '🪄', desc: '根据描述自由生成' },
];

type AIAction = 'polish' | 'extend' | 'summarize' | 'continue' | 'translate' | 'generate';
type WritingTone = 'balanced' | 'professional' | 'friendly' | 'academic' | 'concise';
type WritingLength = 'short' | 'balanced' | 'detailed';
type WritingFormat = 'keep' | 'paragraphs' | 'outline' | 'steps';

const aiAction       = ref<AIAction>('polish');
const targetLanguage = ref('English');
const writingTone    = ref<WritingTone>('balanced');
const writingLength  = ref<WritingLength>('balanced');
const writingFormat  = ref<WritingFormat>('keep');
const customInstruction = ref('');
const showSettings = ref(true);

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

// ── Chat Messages (the core new feature) ─────────────────────────
interface ChatMessage {
  id:            number;
  role:          'user' | 'assistant';
  // user fields
  actionLabel?:  string;
  actionIcon?:   string;
  ctxSummary?:   string;
  promptText?:   string;
  actionValue?:  AIAction;
  // assistant fields
  content:       string;
  reasoning:     string;
  showReasoning: boolean;
  isStreaming:   boolean;
  requestId?:     string;
  error?:         string;
  applied?:       boolean;
  timestamp:     Date;
}

const messages       = reactive<ChatMessage[]>([]);
const activeId       = ref<number | null>(null); // ID of the currently streaming assistant message
const copiedId       = ref<number | null>(null);

const lastAssistant = computed(() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i];
  }
  return null;
});

const selectedCommand = computed(() => AI_COMMANDS.find(c => c.value === aiAction.value));
const activeActionLabel = computed(() => selectedCommand.value?.label ?? '写作');
const contextCharCount = computed(() => ctxText.value.length);
const contextPreview = computed(() => {
  const normalized = ctxText.value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 90) + (normalized.length > 90 ? '…' : '') : '暂无文档上下文';
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
const primaryApplyLabel = computed(() => (hasSelection.value ? '替换选区' : '替换全文'));
const lastUserMessage = computed(() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i];
  }
  return null;
});

// Chat footer
const chatText = ref('');
const chatRows = ref(1);

// ────────────────────────────────────────────────────────────────
// Editor helpers
// ────────────────────────────────────────────────────────────────
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
  const e = ta.selectionEnd   ?? 0;
  const t = ta.value.substring(s, e);
  savedSel.value = { start: s, end: e, text: t };
  ctxMode.value  = t.length > 0 ? 'selected' : 'full';
};

// ────────────────────────────────────────────────────────────────
// Panel controls
// ────────────────────────────────────────────────────────────────
const openPanel = () => {
  captureSelection();
  showPanel.value = true;
  aiAction.value  = 'polish';
  chatText.value  = '';
  chatRows.value  = 1;
  showSettings.value = true;
  nextTick(() => {
    initPanelPosition();
    scrollToEnd();
  });
};

const closePanel = () => {
  cancelGeneration();
  stopDrag();
  stopResize();
  showPanel.value   = false;
  isMaximized.value = false;
};

const togglePanel = () => (showPanel.value ? closePanel() : openPanel());

const onEditorInteract = () => {
  if (!showPanel.value || isGenerating.value) return;
  captureSelection();
};

const toggleCtxMode = () => {
  if (ctxMode.value === 'full') {
    const ta = getEditorTextarea();
    if (ta) {
      const s = ta.selectionStart ?? 0;
      const e = ta.selectionEnd   ?? 0;
      if (s < e) {
        savedSel.value = { start: s, end: e, text: ta.value.substring(s, e) };
        ctxMode.value  = 'selected';
        return;
      }
    }
    ElMessage.info('请先在编辑器中选中文字，再切换为"选区"模式');
  } else {
    ctxMode.value = 'full';
  }
};

const scrollToEnd = () => {
  nextTick(() => { messagesEnd.value?.scrollIntoView({ behavior: 'smooth' }); });
};

// ────────────────────────────────────────────────────────────────
// Quick action chips
// ────────────────────────────────────────────────────────────────
const selectAndRun = (action: string) => {
  if (isGenerating.value) return;
  aiAction.value = action as AIAction;
  if (action === 'generate') {
    nextTick(() => chatInputRef.value?.focus());
  }
};

const buildHistoryPayload = () =>
  messages
    .slice(0, -1)
    .filter((msg) => {
      if (msg.role === 'assistant') return Boolean(msg.content);
      return Boolean(msg.promptText || msg.ctxSummary);
    })
    .slice(-6)
    .map((msg) => ({
      role: msg.role,
      content:
        msg.role === 'assistant'
          ? msg.content
          : `${msg.actionLabel || '写作'}：${msg.promptText || msg.ctxSummary || ''}`,
    }));

const rerunLast = () => {
  const last = lastUserMessage.value;
  if (!last || isGenerating.value) return;
  aiAction.value = last.actionValue || aiAction.value;
  runGeneration(last.promptText);
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

// ────────────────────────────────────────────────────────────────
// Generation
// ────────────────────────────────────────────────────────────────
const cancelGeneration = () => {
  if (abortCtrl.value) { abortCtrl.value.abort(); abortCtrl.value = null; }
  // Mark current streaming message as done
  if (activeId.value !== null) {
    const msg = messages.find(m => m.id === activeId.value);
    if (msg) msg.isStreaming = false;
    activeId.value = null;
  }
  isGenerating.value = false;
};

const runGeneration = async (promptOverride?: string) => {
  const context = ctxText.value;
  const action  = aiAction.value;
  const prompt  = promptOverride ?? '';

  if (action === 'generate' && !prompt.trim()) {
    ElMessage.warning('请在底部输入框描述您的创作要求');
    nextTick(() => chatInputRef.value?.focus());
    return;
  }
  if (action !== 'generate' && !context.trim()) {
    ElMessage.warning('编辑器内容为空，请先输入文字，或在编辑器中选中一段文字');
    return;
  }

  cancelGeneration();

  // ── Add user message ──────────────────────────────────────────
  const cmd       = AI_COMMANDS.find(c => c.value === action);
  const ctxSnip   = context.substring(0, 60) + (context.length > 60 ? '…' : '');
  const userMsg: ChatMessage = {
    id:          Date.now(),
    role:        'user',
    actionLabel: cmd?.label ?? action,
    actionIcon:  cmd?.icon  ?? '🤖',
    ctxSummary:  ctxSnip,
    promptText:  prompt || undefined,
    actionValue: action,
    content:     '',
    reasoning:   '',
    showReasoning: false,
    isStreaming:  false,
    timestamp:    new Date(),
  };
  messages.push(userMsg);
  scrollToEnd();

  // ── Add assistant placeholder ─────────────────────────────────
  const assistId = Date.now() + 1;
  const assistMsg: ChatMessage = {
    id:           assistId,
    role:         'assistant',
    content:      '',
    reasoning:    '',
    showReasoning: false,
    isStreaming:   true,
    timestamp:    new Date(),
  };
  messages.push(assistMsg);
  activeId.value     = assistId;
  isGenerating.value = true;
  abortCtrl.value    = new AbortController();
  scrollToEnd();

  try {
    const response  = await fetch('/api/ai/write-assist', {
      method:  'POST',
      headers: createJsonHeaders(),
      body:    JSON.stringify({
        action,
        text:           context,
        prompt:         action === 'generate' ? prompt : undefined,
        instruction:    customInstruction.value || undefined,
        scope:          ctxMode.value,
        tone:           writingTone.value,
        length:         writingLength.value,
        format:         writingFormat.value,
        history:        buildHistoryPayload(),
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
        const msg = messages.find(m => m.id === assistId);
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
          if (!msg.showReasoning) msg.showReasoning = true; // auto-open while thinking
        }
        if (payload.text) {
          msg.content += payload.text;
        }
        scrollToEnd();
      },
      () => {
        const msg = messages.find(m => m.id === assistId);
        if (msg) {
          msg.isStreaming   = false;
          msg.showReasoning = false; // collapse reasoning when done
        }
        activeId.value     = null;
        isGenerating.value = false;
        abortCtrl.value    = null;
        scrollToEnd();
      },
      (err) => {
        if (err.name === 'AbortError') return;
        const msg = messages.find(m => m.id === assistId);
        if (msg) { msg.isStreaming = false; msg.error = err.message; msg.content = msg.content || '生成出错，请重试'; }
        ElMessage.error(`生成出错：${err.message}`);
        isGenerating.value = false;
        abortCtrl.value    = null;
        activeId.value     = null;
      },
    );
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    const msg = messages.find(m => m.id === assistId);
    if (msg) { msg.isStreaming = false; msg.error = error.message || '生成失败'; msg.content = msg.content || '生成失败，请重试'; }
    ElMessage.error(error.message || 'AI 生成失败，请重试');
    isGenerating.value = false;
    abortCtrl.value    = null;
    activeId.value     = null;
  }
};

// ────────────────────────────────────────────────────────────────
// Chat footer
// ────────────────────────────────────────────────────────────────
const submitChat = () => {
  const msg = chatText.value.trim();
  if (!msg || isGenerating.value) return;
  aiAction.value = 'generate';
  chatText.value = '';
  chatRows.value = 1;
  nextTick(() => runGeneration(msg));
};

const onChatKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
};
const onChatInput = () => { chatRows.value = Math.min(chatText.value.split('\n').length, 4); };

// ────────────────────────────────────────────────────────────────
// Apply result
// ────────────────────────────────────────────────────────────────
const applyResult = async (mode: 'replace' | 'append' | 'copy', content?: string) => {
  const result = content ?? lastAssistant.value?.content ?? '';
  if (!result) return;

  if (mode === 'copy') {
    await navigator.clipboard.writeText(result);
    ElMessage.success('已复制到剪贴板');
    return;
  }
  if (mode === 'append') {
    text.value = text.value.trimEnd() + '\n\n' + result;
    const msg = lastAssistant.value;
    if (msg && msg.content === result) msg.applied = true;
    ElMessage.success('已追加到文档末尾');
    nextTick(() => {
      const ta = getEditorTextarea();
      if (ta) { ta.scrollTop = ta.scrollHeight; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    });
    return;
  }
  if (mode === 'replace') {
    if (!hasSelection.value) {
      text.value = result;
      savedSel.value = { start: 0, end: result.length, text: result };
      ctxMode.value = 'full';
      const msg = lastAssistant.value;
      if (msg && msg.content === result) msg.applied = true;
      ElMessage.success('已替换全文');
      nextTick(() => getEditorTextarea()?.focus());
      return;
    }

    const ta = getEditorTextarea();
    if (!ta) { ElMessage.error('无法定位编辑器，请重试'); return; }
    text.value =
      text.value.slice(0, savedSel.value.start) +
      result +
      text.value.slice(savedSel.value.end);
    ElMessage.success('已替换选中内容');
    const appliedMsg = lastAssistant.value;
    if (appliedMsg && appliedMsg.content === result) appliedMsg.applied = true;
    const newEnd = savedSel.value.start + result.length;
    savedSel.value = { start: savedSel.value.start, end: newEnd, text: result };
    nextTick(() => {
      ta.focus();
      ta.setSelectionRange(newEnd, newEnd);
    });
  }
};

const copyMessage = async (msg: ChatMessage) => {
  await navigator.clipboard.writeText(msg.content);
  copiedId.value = msg.id;
  setTimeout(() => { copiedId.value = null; }, 2000);
};

// ────────────────────────────────────────────────────────────────
// Clear messages
// ────────────────────────────────────────────────────────────────
const clearMessages = () => {
  if (isGenerating.value) return;
  messages.splice(0, messages.length);
};

// ────────────────────────────────────────────────────────────────
// Editor config
// ────────────────────────────────────────────────────────────────
const editorLanguage = computed(() => locale.value === 'zh-CN' ? 'zh-CN' : 'en-US');

const toolbars = computed<ToolbarNames[]>(() => {
  if (isMobile.value) {
    return ['bold','italic','title','quote','unorderedList','orderedList','code','link','image','table','revoke','next'];
  }
  return ['bold','underline','italic','-','strikeThrough','title','sub','sup','quote','unorderedList','orderedList','task','-','codeRow','code','link','image','table','mermaid','katex','-','revoke','next','save','-', 0];
});

const checkMobile = () => {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value && showPanel.value && wasMobile) {
    initPanelPosition();
  }
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
      const { data } = await api.post(props.uploadUrl, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data?.url) urls.push(data.url);
      else throw new Error('服务器响应中未包含文件链接');
    }
    callback(urls);
    ElMessage.success('图片上传成功');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '图片上传失败，请重试'));
  }
};

const handleResize = () => {
  checkMobile();
  clampPanelToBounds();
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
  stopDrag();
  stopResize();
  cancelGeneration();
});
</script>

<template>
  <div
    class="mdw"
    :class="{ 'is-dark': isDark, 'h-full': height === '100%' }"
    @mouseup="onEditorInteract"
    @keyup="onEditorInteract"
  >
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
      ref="editorRef"
      :id="editorId"
      :key="String(props.preview)"
      v-model="text"
      :placeholder="placeholder"
      :style="{ height }"
      :theme="isDark ? 'dark' : 'light'"
      :language="editorLanguage"
      :preview="props.preview"
      :html-preview="props.htmlPreview"
      :auto-focus="autoFocus"
      :auto-height="autoHeight"
      :toolbars="toolbars"
      :transform-img-url="getAssetUrl"
      @on-upload-img="handleUploadImg"
      class="mdw__editor"
    >
      <template #defToolbars>
        <NormalToolbar title="AI 协同写作" @onClick="togglePanel">
          <template #trigger>
            <Sparkles
              class="w-4 h-4 cursor-pointer transition-colors duration-200"
              :class="showPanel ? 'text-purple-500' : 'text-purple-400 hover:text-purple-500'"
            />
          </template>
        </NormalToolbar>
      </template>
    </MdEditor>

    <!-- ═══════════════════════════════════════════
         AI Floating Panel
         ═══════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="aip">
        <aside
          v-if="showPanel"
          class="aip"
          :class="{
            'aip--dragging': isDragging,
            'aip--resizing': isResizing,
            'aip--maximized': isMaximized
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
            <GripHorizontal class="w-3.5 h-3.5 text-muted opacity-40 flex-shrink-0" />
            <button
              type="button"
              class="aip__ico-btn aip__maximize"
              :title="isMaximized ? '还原' : '最大化'"
              @click.stop="toggleMaximize"
            >
              <Maximize2 v-if="!isMaximized" class="w-3.5 h-3.5" />
              <Minimize2 v-else               class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="aip__ico-btn aip__close"
              title="关闭"
              @click.stop="closePanel"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- ── Quick chips ───────────────────────── -->
        <div class="aip__toolbar">
          <div class="aip__chips">
            <button
              v-for="cmd in AI_COMMANDS"
              :key="cmd.value"
              type="button"
              class="aip__chip"
              :class="{
                'aip__chip--active':   aiAction === cmd.value,
                'aip__chip--disabled': isGenerating,
              }"
              :title="cmd.desc"
              @click="selectAndRun(cmd.value)"
            >
              {{ cmd.icon }} {{ cmd.label }}
            </button>
          </div>
          <button
            type="button"
            class="aip__run-btn"
            :disabled="!canRunAction"
            :title="selectedCommand ? `执行${selectedCommand.label}` : '执行'"
            @click="runSelectedAction"
          >
            <Play class="w-3 h-3" />
            <span>{{ aiAction === 'generate' ? '生成' : '执行' }}</span>
          </button>
          <!-- Translate language -->
          <Transition name="fade">
            <el-select
              v-if="aiAction === 'translate'"
              v-model="targetLanguage"
              size="small"
              style="width:130px;flex-shrink:0"
            >
              <el-option label="🇺🇸 English"  value="English"  />
              <el-option label="🇨🇳 简体中文"  value="Chinese"  />
              <el-option label="🇯🇵 日本語"    value="Japanese" />
              <el-option label="🇰🇷 한국어"    value="Korean"   />
              <el-option label="🇫🇷 Français"  value="French"   />
              <el-option label="🇩🇪 Deutsch"   value="German"   />
            </el-select>
          </Transition>
          <button
            v-if="messages.length > 0 && !isGenerating"
            type="button"
            class="aip__clear-btn"
            title="清空对话"
            @click="clearMessages"
          >
            清空
          </button>
          <button
            type="button"
            class="aip__ico-btn aip__settings-btn"
            :class="{ 'aip__settings-btn--on': showSettings }"
            title="写作参数"
            @click="showSettings = !showSettings"
          >
            <SlidersHorizontal class="w-3.5 h-3.5" />
          </button>
        </div>

        <section class="aip__brief">
          <div class="aip__brief-main">
            <FileText class="w-3.5 h-3.5" />
            <span>{{ activeActionLabel }}</span>
            <strong>{{ contextQuality }}</strong>
          </div>
          <p>{{ contextPreview }}</p>
        </section>

        <Transition name="fade">
          <section v-if="showSettings" class="aip__settings">
            <div class="aip__seg-row">
              <span>语气</span>
              <div class="aip__seg">
                <button
                  v-for="item in TONE_OPTIONS"
                  :key="item.value"
                  type="button"
                  :class="{ 'is-on': writingTone === item.value }"
                  @click="writingTone = item.value"
                >{{ item.label }}</button>
              </div>
            </div>
            <div class="aip__seg-row">
              <span>篇幅</span>
              <div class="aip__seg aip__seg--compact">
                <button
                  v-for="item in LENGTH_OPTIONS"
                  :key="item.value"
                  type="button"
                  :class="{ 'is-on': writingLength === item.value }"
                  @click="writingLength = item.value"
                >{{ item.label }}</button>
              </div>
              <span>结构</span>
              <div class="aip__seg">
                <button
                  v-for="item in FORMAT_OPTIONS"
                  :key="item.value"
                  type="button"
                  :class="{ 'is-on': writingFormat === item.value }"
                  @click="writingFormat = item.value"
                >{{ item.label }}</button>
              </div>
            </div>
            <textarea
              v-model="customInstruction"
              class="aip__instruction"
              rows="2"
              maxlength="1200"
              placeholder="补充要求，例如：面向初学者、保留代码块、加入实战检查点"
              :disabled="isGenerating"
            />
            <div class="aip__guard">
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>上下文作为文档素材处理，接口会限制长度并隔离历史。</span>
            </div>
          </section>
        </Transition>

        <!-- ── Messages (chat dialog) ────────────── -->
        <div class="aip__msgs">

          <!-- Empty state -->
          <div v-if="messages.length === 0" class="aip__empty">
            <Sparkles class="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
            <p>选择指令后点击执行，或在下方输入任意创作要求</p>
          </div>

          <!-- Message list -->
          <template v-for="msg in messages" :key="msg.id">

            <!-- User message -->
            <div v-if="msg.role === 'user'" class="chat-user">
              <span class="chat-user__badge">{{ msg.actionIcon }} {{ msg.actionLabel }}</span>
              <span v-if="msg.promptText" class="chat-user__prompt">"{{ msg.promptText }}"</span>
              <span v-else class="chat-user__ctx">{{ msg.ctxSummary }}</span>
            </div>

            <!-- Assistant message -->
            <div v-else class="chat-ai">

              <!-- Reasoning section -->
              <div v-if="msg.reasoning" class="chat-ai__thinking">
                <button
                  type="button"
                  class="chat-ai__thinking-toggle"
                  @click="msg.showReasoning = !msg.showReasoning"
                >
                  <Brain class="w-3 h-3 flex-shrink-0" :class="msg.isStreaming ? 'animate-pulse' : ''" />
                  <span>{{ msg.isStreaming ? '正在思考...' : '模型思考过程' }}</span>
                  <span class="chat-ai__thinking-chars">{{ msg.reasoning.length }} 字</span>
                  <ChevronDown v-if="!msg.showReasoning" class="w-3 h-3 ml-auto" />
                  <ChevronUp   v-else                    class="w-3 h-3 ml-auto" />
                </button>
                <Transition name="reasoning">
                  <pre v-if="msg.showReasoning" class="chat-ai__thinking-body">{{ msg.reasoning }}</pre>
                </Transition>
              </div>

              <!-- Response content -->
              <div class="chat-ai__bubble">
                <!-- Streaming: monospace pre with blinking cursor -->
                <div v-if="msg.isStreaming" class="chat-ai__stream">
                  <pre class="chat-ai__stream-text">{{ msg.content || ' ' }}<span class="aip__cursor">▋</span></pre>
                </div>
                <!-- Done: formatted markdown preview -->
                <div v-else-if="msg.content" class="chat-ai__preview">
                  <MdPreview
                    :model-value="msg.content"
                    :theme="isDark ? 'dark' : 'light'"
                    class="aip__md-preview"
                  />
                </div>
                <!-- Error / empty -->
                <div v-else class="chat-ai__empty">
                  <span>（生成被中止）</span>
                </div>
                <div v-if="msg.error" class="chat-ai__error">
                  {{ msg.error }}
                </div>
                <div v-if="msg.requestId || msg.applied" class="chat-ai__meta">
                  <span v-if="msg.requestId">请求 {{ msg.requestId.slice(0, 8) }}</span>
                  <span v-if="msg.applied">已应用到文档</span>
                </div>

                <!-- Action bar (only on last assistant message and not streaming) -->
                <div
                  v-if="!msg.isStreaming && msg.content && msg === lastAssistant"
                  class="chat-ai__actions"
                >
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--primary"
                    :title="hasSelection ? '替换选中的文字' : '用结果替换整篇文档'"
                    @click="applyResult('replace', msg.content)"
                  >{{ primaryApplyLabel }}</button>
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--secondary"
                    @click="applyResult('append', msg.content)"
                  >追加末尾</button>
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--ghost"
                    @click="copyMessage(msg)"
                  >
                    <Check v-if="copiedId === msg.id" class="w-3 h-3 text-green-500" />
                    <Copy  v-else                      class="w-3 h-3" />
                    复制
                  </button>
                  <button
                    type="button"
                    class="ai-act-btn ai-act-btn--ghost"
                    :disabled="isGenerating"
                    @click="rerunLast"
                  >
                    <RotateCcw class="w-3 h-3" />
                    重试
                  </button>
                </div>
              </div>
            </div>

          </template><!-- /message list -->

          <!-- Generating indicator (before first chunk) -->
          <div v-if="isGenerating && lastAssistant?.content === '' && !lastAssistant?.reasoning" class="aip__thinking-bar">
            <span class="aip__dots"><span/><span/><span/></span>
            <span>AI 正在处理…</span>
            <button type="button" class="aip__stop" @click="cancelGeneration">
              <Square class="w-2.5 h-2.5 fill-current" /> 停止
            </button>
          </div>

          <!-- Stop button (when streaming) -->
          <div v-if="isGenerating && (lastAssistant?.content || lastAssistant?.reasoning)" class="aip__stop-bar">
            <button type="button" class="aip__stop" @click="cancelGeneration">
              <Square class="w-2.5 h-2.5 fill-current" /> 停止生成
            </button>
          </div>

          <div ref="messagesEnd" />
        </div>

        <!-- ── Footer: chat input ─────────────────── -->
        <footer class="aip__ft">
          <div class="aip__chat">
            <textarea
              ref="chatInputRef"
              v-model="chatText"
              :rows="chatRows"
              placeholder="向 AI 下达任意指令… Enter 发送，Shift+Enter 换行"
              class="aip__chat-input"
              :disabled="isGenerating"
              @keydown="onChatKeydown"
              @input="onChatInput"
            />
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

        <!-- ── Resize handle (bottom-right) ──────── -->
        <div v-if="!isMaximized" class="aip__resize-handle" title="拖拽调整大小" @mousedown.left.prevent="startResize" />

      </aside>
    </Transition>
  </Teleport>
  </div>
</template>

<style>
/* ═══════════════════════════════════════════════════
   Outer wrapper
   ═══════════════════════════════════════════════════ */
.mdw {
  --md-bk-color: var(--bg-card);
  --md-color:    var(--text-primary);
  position:      relative;
  width:         100%;
}
.mdw.h-full { height: 100%; }

/* ── Editor ─────────────────────────────────────── */
.mdw__editor { width: 100%; }
.mdw__ai-launcher {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid rgba(var(--accent-rgb), .28);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  color: var(--accent);
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  transition: transform .15s, background .15s, border-color .15s;
}
.mdw__ai-launcher:hover {
  transform: translateY(-1px);
  background: var(--accent-subtle);
  border-color: rgba(var(--accent-rgb), .45);
}
.mdw__ai-launcher--on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.mdw .md-editor {
  border-radius:    0.75rem;
  overflow:         hidden;
  border:           1px solid var(--border-base) !important;
  background-color: var(--bg-card)               !important;
  transition:       border-color 0.2s ease;
}
.mdw .md-editor:focus-within { border-color: var(--accent) !important; }

.mdw .md-editor-toolbar-wrapper {
  background-color: var(--bg-card)              !important;
  border-bottom:    1px solid var(--border-base) !important;
}
.mdw .md-editor-content   { background-color: var(--bg-card)    !important; }
.mdw .md-editor-input     { background-color: var(--bg-app)     !important; color: var(--text-primary) !important; font-size: 15px !important; line-height: 1.6 !important; }
.mdw .md-editor-preview   { background-color: var(--bg-card)    !important; color: var(--text-primary) !important; }

.mdw img {
  max-width: 90% !important; max-height: 55vh !important;
  width: auto !important; height: auto !important;
  object-fit: contain !important; border-radius: 12px !important;
  margin: 24px auto !important; display: block !important;
  box-shadow: 0 10px 30px rgba(0,0,0,.06) !important;
  border: 1px solid rgba(0,0,0,.05) !important;
  transition: transform .3s, box-shadow .3s !important;
}
.mdw img:hover { transform: translateY(-2px) !important; box-shadow: 0 16px 40px rgba(0,0,0,.1) !important; }

.mdw .md-editor-content-wrapper::-webkit-scrollbar       { width: 6px; }
.mdw .md-editor-content-wrapper::-webkit-scrollbar-track { background: transparent; }
.mdw .md-editor-content-wrapper::-webkit-scrollbar-thumb { background: var(--border-base); border-radius: 10px; }

.mdw.is-dark .md-editor                      { --md-bk-color: var(--bg-card); }
.mdw.is-dark .md-editor-toolbar-item svg     { fill: var(--text-secondary); }
.mdw.is-dark .md-editor-toolbar-item:hover svg { fill: var(--accent); }

@media (max-width:767px) {
  .mdw .md-editor-toolbar-wrapper { padding: 4px 6px !important; overflow-x: hidden !important; }
  .mdw .md-editor-toolbar         { display: flex !important; justify-content: space-between !important; flex-wrap: nowrap !important; overflow-x: hidden !important; width: 100% !important; }
  .mdw .md-editor-toolbar-item    { min-width: 26px !important; height: 26px !important; padding: 0 !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }
  .mdw .md-editor-toolbar-item svg { width: 14px !important; height: 14px !important; }
}

.mdw__preview-only { background: transparent !important; font-size: 15px; line-height: 1.8; color: var(--text-primary) !important; border: none !important; }
.mdw__preview-only .md-editor-preview-wrapper { padding: 0 !important; border: none !important; }

/* ═══════════════════════════════════════════════════
   AI Floating Panel
   ═══════════════════════════════════════════════════ */
.aip {
  position:         fixed;
  display:          flex;
  flex-direction:   column;
  z-index:          9000;
  overflow:         hidden;
  /* Glassmorphism card */
  background-color: color-mix(in srgb, var(--bg-card) 97%, transparent);
  backdrop-filter:  blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border:           1px solid var(--border-base);
  border-radius:    16px;
  box-shadow:       0 12px 40px rgba(0,0,0,.15), 0 2px 8px rgba(0,0,0,.06), 0 0 0 0.5px rgba(255,255,255,.05) inset;
  /* Prevent text selection during drag/resize */
  user-select:      none;
}
.aip--dragging  { cursor: grabbing !important; box-shadow: 0 20px 60px rgba(0,0,0,.22), 0 4px 12px rgba(0,0,0,.1); }
.aip--resizing  { cursor: se-resize !important; }
.aip--maximized { border-radius: 0 !important; border: none !important; }

/* Panel appear animation */
.aip-enter-active { transition: opacity .22s ease, transform .26s cubic-bezier(.34,1.56,.64,1); }
.aip-leave-active { transition: opacity .16s ease, transform .18s ease; }
.aip-enter-from   { opacity: 0; transform: scale(.90) translateY(12px); transform-origin: bottom right; }
.aip-leave-to     { opacity: 0; transform: scale(.94) translateY(6px);  transform-origin: bottom right; }

/* ── Header ─────────────────────────────────────── */
.aip__hd {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         0 10px 0 12px;
  height:          42px;
  flex-shrink:     0;
  cursor:          grab;
  border-bottom:   1px solid var(--border-base);
  background:      linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 90%, var(--accent)) 0%, var(--bg-card) 100%);
}
.aip__hd:active { cursor: grabbing; }

.aip__hd-left {
  display:     flex;
  align-items: center;
  gap:         7px;
  min-width:   0;
  flex:        1;
  overflow:    hidden;
}
.aip__hd-title {
  font-size:   12.5px;
  font-weight: 700;
  color:       var(--text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}
.aip__hd-right {
  display:     flex;
  align-items: center;
  gap:         2px;
  flex-shrink: 0;
}

/* Context badge in header */
.aip__ctx {
  display:      inline-flex;
  align-items:  center;
  padding:      2px 8px;
  border-radius: 10px;
  font-size:    10.5px;
  font-weight:  600;
  border:       1px solid;
  cursor:       pointer;
  white-space:  nowrap;
  overflow:     hidden;
  text-overflow: ellipsis;
  max-width:    130px;
  transition:   all .18s;
}
.aip__ctx--full { background: var(--accent-subtle); border-color: rgba(var(--accent-rgb),.3); color: var(--accent); }
.aip__ctx--sel  { background: color-mix(in srgb,#8b5cf6 10%,transparent); border-color: rgba(139,92,246,.35); color: #8b5cf6; }
.aip__ctx:hover { filter: brightness(.93); }

/* Icon buttons in header */
.aip__ico-btn {
  background:    none;
  border:        none;
  color:         var(--text-muted);
  cursor:        pointer;
  padding:       5px;
  border-radius: 5px;
  display:       flex;
  align-items:   center;
  justify-content: center;
  transition:    background-color .15s, color .15s;
  flex-shrink:   0;
}
.aip__ico-btn:hover { background-color: var(--bg-subtle); color: var(--text-primary); }

/* ── Toolbar ────────────────────────────────────── */
.aip__toolbar {
  display:         flex;
  align-items:     center;
  gap:             6px;
  padding:         7px 10px;
  border-bottom:   1px solid var(--border-base);
  flex-shrink:     0;
  overflow-x:      auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.aip__toolbar::-webkit-scrollbar { display: none; }

.aip__chips {
  display:  flex;
  gap:      5px;
  flex-shrink: 0;
}
.aip__chip {
  display:      inline-flex;
  align-items:  center;
  gap:          3px;
  padding:      4px 10px;
  border-radius: 20px;
  font-size:    11px;
  font-weight:  500;
  border:       1.5px solid var(--border-base);
  background:   var(--bg-app);
  color:        var(--text-secondary);
  cursor:       pointer;
  white-space:  nowrap;
  flex-shrink:  0;
  transition:   all .16s ease;
}
.aip__chip:hover:not(.aip__chip--disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); }
.aip__chip--active   { border-color: var(--accent) !important; background: var(--accent-subtle) !important; color: var(--accent) !important; font-weight: 600; }
.aip__chip--disabled { opacity: .4; cursor: not-allowed; }

.aip__run-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s, opacity .15s;
}
.aip__run-btn:hover:not(:disabled) { background: var(--accent-hover); }
.aip__run-btn:disabled {
  background: var(--border-base);
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: .7;
}

.aip__clear-btn {
  margin-left:   auto;
  flex-shrink:   0;
  font-size:     10.5px;
  color:         var(--text-muted);
  background:    none;
  border:        none;
  cursor:        pointer;
  padding:       3px 7px;
  border-radius: 4px;
  transition:    color .15s, background .15s;
}
.aip__clear-btn:hover { color: #ef4444; background: rgba(239,68,68,.07); }
.aip__settings-btn {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
}
.aip__settings-btn--on {
  color: var(--accent);
  background: var(--accent-subtle);
}

.aip__brief {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-app) 58%, var(--bg-card));
  flex-shrink: 0;
}
.aip__brief-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-secondary);
}
.aip__brief-main strong {
  margin-left: auto;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.aip__brief p {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aip__settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-card);
  flex-shrink: 0;
}
.aip__seg-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.aip__seg-row > span {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.aip__seg {
  display: inline-flex;
  min-width: 0;
  padding: 2px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}
.aip__seg button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 7px;
  font-size: 10.5px;
  white-space: nowrap;
}
.aip__seg button.is-on {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
}
.aip__seg--compact button { padding-inline: 8px; }
.aip__instruction {
  width: 100%;
  resize: vertical;
  min-height: 44px;
  max-height: 92px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 11.5px;
  line-height: 1.45;
  padding: 7px 8px;
  outline: none;
  user-select: text;
}
.aip__instruction:focus { border-color: var(--accent); }
.aip__guard {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1.35;
}

/* ── Messages area ──────────────────────────────── */
.aip__msgs {
  flex:           1;
  overflow-y:     auto;
  padding:        10px 10px 4px;
  display:        flex;
  flex-direction: column;
  gap:            10px;
  overscroll-behavior: contain;
}
.aip__msgs::-webkit-scrollbar       { width: 4px; }
.aip__msgs::-webkit-scrollbar-track { background: transparent; }
.aip__msgs::-webkit-scrollbar-thumb { background: var(--border-base); border-radius: 10px; }

/* Empty state */
.aip__empty {
  flex:        1;
  display:     flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding:     24px 16px;
  text-align:  center;
  font-size:   12px;
  color:       var(--text-muted);
  gap:         6px;
}

/* ── User message ───────────────────────────────── */
.chat-user {
  display:         flex;
  align-items:     center;
  gap:             6px;
  justify-content: flex-end;
  flex-wrap:       wrap;
}
.chat-user__badge {
  font-size:    11px;
  font-weight:  600;
  color:        var(--accent);
  background:   var(--accent-subtle);
  padding:      2px 8px;
  border-radius: 10px;
  flex-shrink:  0;
}
.chat-user__prompt,
.chat-user__ctx {
  font-size:    11px;
  color:        var(--text-muted);
  font-style:   italic;
  overflow:     hidden;
  text-overflow: ellipsis;
  white-space:  nowrap;
  max-width:    180px;
}

/* ── Assistant message ──────────────────────────── */
.chat-ai { display: flex; flex-direction: column; gap: 5px; }

/* Thinking / reasoning block */
.chat-ai__thinking {
  border:        1px solid rgba(139,92,246,.25);
  border-radius: 10px;
  background:    color-mix(in srgb, #8b5cf6 5%, var(--bg-app));
  overflow:      hidden;
}
.chat-ai__thinking-toggle {
  display:       flex;
  align-items:   center;
  gap:           6px;
  width:         100%;
  background:    none;
  border:        none;
  padding:       7px 10px;
  cursor:        pointer;
  font-size:     11px;
  font-weight:   600;
  color:         #8b5cf6;
  text-align:    left;
  transition:    background .15s;
}
.chat-ai__thinking-toggle:hover { background: rgba(139,92,246,.07); }
.chat-ai__thinking-chars {
  font-size:   10px;
  font-weight: 400;
  color:       rgba(139,92,246,.7);
  margin-left: 2px;
}
.chat-ai__thinking-body {
  font-family:  'Cascadia Code', 'Fira Code', monospace;
  font-size:    11px;
  line-height:  1.6;
  white-space:  pre-wrap;
  word-break:   break-word;
  margin:       0;
  padding:      6px 10px 10px;
  color:        color-mix(in srgb, #8b5cf6 70%, var(--text-primary));
  max-height:   180px;
  overflow-y:   auto;
  border-top:   1px solid rgba(139,92,246,.15);
  background:   color-mix(in srgb, #8b5cf6 4%, var(--bg-app));
}
.reasoning-enter-active { transition: all .25s ease; }
.reasoning-leave-active { transition: all .18s ease; }
.reasoning-enter-from,
.reasoning-leave-to     { opacity: 0; max-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }

/* AI response bubble */
.chat-ai__bubble {
  background:   var(--bg-app);
  border:       1px solid var(--border-base);
  border-radius: 4px 12px 12px 12px;
  overflow:     hidden;
}

/* Streaming text */
.chat-ai__stream {
  padding:    10px 12px;
  max-height: 280px;
  overflow-y: auto;
}
.chat-ai__stream-text {
  font-family:  'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size:    12px;
  line-height:  1.65;
  color:        var(--text-primary);
  white-space:  pre-wrap;
  word-break:   break-word;
  margin:       0;
  user-select:  text;
}
.aip__cursor { color: var(--accent); font-weight: bold; animation: blink 1s step-end infinite; }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

/* Formatted MD preview */
.chat-ai__preview { padding: 2px 4px; max-height: 320px; overflow-y: auto; user-select: text; }
.aip__md-preview  { font-size: 12.5px !important; background: transparent !important; border: none !important; padding: 0 !important; }
.aip__md-preview .md-editor-preview-wrapper { padding: 4px 8px !important; }

.chat-ai__empty { padding: 10px 12px; font-size: 12px; color: var(--text-muted); font-style: italic; }
.chat-ai__error {
  margin: 0 10px 8px;
  padding: 7px 8px;
  border: 1px solid rgba(239,68,68,.24);
  border-radius: 7px;
  background: rgba(239,68,68,.07);
  color: #ef4444;
  font-size: 11px;
  line-height: 1.45;
  user-select: text;
}
.chat-ai__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 8px;
  color: var(--text-muted);
  font-size: 10px;
}

/* Action bar under last assistant message */
.chat-ai__actions {
  display:    flex;
  gap:        5px;
  padding:    8px 10px;
  border-top: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-card) 60%, var(--bg-app));
}
.ai-act-btn {
  flex:          1;
  padding:       5px 6px;
  border-radius: 7px;
  font-size:     11px;
  font-weight:   500;
  cursor:        pointer;
  transition:    all .14s;
  display:       inline-flex;
  align-items:   center;
  justify-content: center;
  gap:           3px;
  border:        1.5px solid transparent;
}
.ai-act-btn:disabled { opacity: .35; cursor: not-allowed; }
.ai-act-btn--primary  { background: var(--accent); color: #fff; }
.ai-act-btn--primary:not(:disabled):hover { background: var(--accent-hover); }
.ai-act-btn--secondary { background: var(--bg-app); border-color: var(--border-base); color: var(--text-primary); }
.ai-act-btn--secondary:hover { border-color: var(--accent); color: var(--accent); }
.ai-act-btn--ghost { background: transparent; border-color: var(--border-base); color: var(--text-muted); }
.ai-act-btn--ghost:hover { color: var(--text-primary); background: var(--bg-subtle); }

/* Thinking / stop bars at bottom of messages */
.aip__thinking-bar {
  display:      flex;
  align-items:  center;
  gap:          8px;
  padding:      6px 10px;
  border-radius: 8px;
  background:   var(--bg-subtle);
  border:       1px solid var(--border-base);
  font-size:    11.5px;
  color:        var(--text-muted);
}
.aip__stop-bar {
  display:         flex;
  justify-content: flex-end;
}

/* Typing dots */
.aip__dots        { display: inline-flex; align-items: center; gap: 3px; }
.aip__dots span   { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); animation: dot-pulse 1.4s ease-in-out infinite; }
.aip__dots span:nth-child(2) { animation-delay: .2s; }
.aip__dots span:nth-child(3) { animation-delay: .4s; }
@keyframes dot-pulse {
  0%,60%,100% { opacity: .2; transform: scale(.8); }
  30%          { opacity: 1;  transform: scale(1);  }
}

/* Stop button */
.aip__stop {
  display:      inline-flex;
  align-items:  center;
  gap:          4px;
  font-size:    11px;
  color:        #ef4444;
  border:       1px solid rgba(239,68,68,.3);
  background:   rgba(239,68,68,.07);
  border-radius: 5px;
  padding:      3px 8px;
  cursor:       pointer;
  transition:   all .15s;
}
.aip__stop:hover { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.6); }

/* ── Footer: chat input ─────────────────────────── */
.aip__ft {
  border-top:       1px solid var(--border-base);
  padding:          9px 10px;
  flex-shrink:      0;
  background-color: var(--bg-card);
}
.aip__chat {
  display:       flex;
  align-items:   flex-end;
  gap:           8px;
  background:    var(--bg-app);
  border:        1.5px solid var(--border-base);
  border-radius: 10px;
  padding:       7px 8px;
  transition:    border-color .15s;
}
.aip__chat:focus-within { border-color: var(--accent); }

.aip__chat-input {
  flex:       1;
  background: none;
  border:     none;
  outline:    none;
  resize:     none;
  font-size:  12.5px;
  color:      var(--text-primary);
  line-height: 1.45;
  min-height:  20px;
  max-height:  80px;
  overflow-y:  auto;
  font-family: inherit;
  user-select: text;
}
.aip__chat-input::placeholder { color: var(--text-muted); }
.aip__chat-input:disabled      { opacity: .5; }

.aip__chat-send {
  width: 28px; height: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 7px; border: none;
  background: var(--border-base); color: var(--text-muted);
  cursor: not-allowed; transition: all .15s ease;
}
.aip__chat-send--on { background: var(--accent); color: #fff; cursor: pointer; }
.aip__chat-send--on:hover { background: var(--accent-hover); }

/* ── Resize handle ──────────────────────────────── */
.aip__resize-handle {
  position:      absolute;
  bottom:        0;
  right:         0;
  width:         18px;
  height:        18px;
  cursor:        se-resize;
  background:    linear-gradient(135deg, transparent 40%, var(--border-strong) 40%, var(--border-strong) 50%, transparent 50%, transparent 66%, var(--border-strong) 66%, var(--border-strong) 76%, transparent 76%);
  border-radius: 0 0 14px 0;
  opacity:       0.45;
  transition:    opacity .2s;
}
.aip__resize-handle:hover { opacity: 0.9; }

@media (max-width:767px) {
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

/* ── Shared animations ──────────────────────────── */
.fade-enter-active { transition: opacity .2s ease, transform .2s ease; }
.fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from   { opacity: 0; transform: translateY(-4px); }
.fade-leave-to     { opacity: 0; }
</style>
