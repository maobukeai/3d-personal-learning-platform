import { ref, reactive, computed, watch, onUnmounted, nextTick, type Ref } from 'vue';
import { toast } from '@/utils/feedbackAdapter';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers'; // ── Types ────────────────────────────────────────────────────────
export type AIAction = 'polish' | 'extend' | 'summarize' | 'continue' | 'translate' | 'generate';
export type WritingTone = 'balanced' | 'professional' | 'friendly' | 'academic' | 'concise';
export type WritingLength = 'short' | 'balanced' | 'detailed';
export type WritingFormat = 'keep' | 'paragraphs' | 'outline' | 'steps';
export interface ChatMessage {
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
} // ── Constants ────────────────────────────────────────────────────
export const AI_COMMANDS = [
  { value: 'polish', label: '润色', icon: '✨', desc: '改进遣词造句，使行文更流畅、专业' },
  { value: 'extend', label: '扩写', icon: '📝', desc: '丰富细节，增加字数与阐述深度' },
  { value: 'summarize', label: '总结', icon: '📋', desc: '提炼核心，精简输出' },
  { value: 'continue', label: '续写', icon: '✍️', desc: '顺着原意继续写作' },
  { value: 'translate', label: '翻译', icon: '🌐', desc: '翻译为目标语言' },
  { value: 'generate', label: '创作', icon: '🪄', desc: '根据描述自由生成' },
];
export const TONE_OPTIONS: { value: WritingTone; label: string }[] = [
  { value: 'balanced', label: '均衡' },
  { value: 'professional', label: '专业' },
  { value: 'friendly', label: '易懂' },
  { value: 'academic', label: '严谨' },
  { value: 'concise', label: '精简' },
];
export const LENGTH_OPTIONS: { value: WritingLength; label: string }[] = [
  { value: 'short', label: '短' },
  { value: 'balanced', label: '中' },
  { value: 'detailed', label: '详' },
];
export const FORMAT_OPTIONS: { value: WritingFormat; label: string }[] = [
  { value: 'keep', label: '保留' },
  { value: 'paragraphs', label: '段落' },
  { value: 'outline', label: '大纲' },
  { value: 'steps', label: '步骤' },
]; // ── Options ──────────────────────────────────────────────────────
export interface UseMarkdownAiOptions {
  editorText: Ref<string>;
  selectedText: Ref<string>;
  show: Ref<boolean>;
  requestFocus: () => void;
  scrollToEnd: () => void;
  emitApply: (mode: 'replace' | 'append' | 'copy', content: string) => void;
} // ── Composable ───────────────────────────────────────────────────
export function useMarkdownAi(opts: UseMarkdownAiOptions) {
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
  const chatText = ref(''); // ── Context selection ────────────────────────────────────────── const ctxMode = ref<'full' | 'selected'>('full'); const ctxText = computed(() => ctxMode.value === 'selected' ? opts.selectedText.value : opts.editorText.value, ); const ctxLabel = computed(() => (ctxMode.value === 'selected' ? '聚焦选区' : '使用全文')); const toggleCtxMode = () => { if (isGenerating.value) return; if (ctxMode.value === 'selected') { ctxMode.value = 'full'; } else { if (!opts.selectedText.value.trim()) { toast.warning('当前无选中文字，自动锁定全文'); ctxMode.value = 'full'; } else { ctxMode.value = 'selected'; } } }; const hasSelection = computed(() => opts.selectedText.value.trim().length> 0); const primaryApplyLabel = computed(() => (hasSelection.value ? '替换选区' : '替换全文')); const selectedCommand = computed(() => AI_COMMANDS.find((c) => c.value === aiAction.value)); const activeActionLabel = computed(() => selectedCommand.value?.label ?? '写作'); const contextCharCount = computed(() => ctxText.value.length); const contextPreview = computed(() => { const normalized = ctxText.value.replace(/\s+/g, ' ').trim(); return normalized ? normalized.slice(0, 90) + (normalized.length> 90 ? '…' : '') : '暂无文档上下文'; }); const contextQuality = computed(() => { if (aiAction.value === 'generate' && chatText.value.trim()) return '可直接创作'; if (contextCharCount.value === 0) return '需要内容'; if (contextCharCount.value> 30000) return '将自动截断'; return ctxMode.value === 'selected' ? '聚焦选区' : '使用全文'; }); const canRunAction = computed(() => { if (isGenerating.value) return false; if (aiAction.value === 'generate') return chatText.value.trim().length> 0; return ctxText.value.trim().length> 0; }); // ── Generation logic ─────────────────────────────────────────── const buildHistoryPayload = () => messages .filter((msg) => { if (msg.id === activeId.value) return false; if (msg.error) return false; return msg.content || msg.promptText || msg.ctxSummary; }) .slice(-6) .map((msg) => ({ role: msg.role, content: msg.role === 'assistant' ? msg.content : `${msg.actionLabel || '写作'}：${msg.promptText || msg.ctxSummary || ''}`, })); const cancelGeneration = () => { if (abortCtrl.value) { abortCtrl.value.abort(); abortCtrl.value = null; } if (activeId.value !== null) { const msg = messages.find((m) => m.id === activeId.value); if (msg) msg.isStreaming = false; activeId.value = null; } isGenerating.value = false; }; const runGeneration = async (promptOverride?: string) => { const context = ctxText.value; const action = aiAction.value; const prompt = promptOverride ?? ''; if (action === 'generate' && !prompt.trim()) { toast.warning('请在底部输入框描述您的创作要求'); opts.requestFocus(); return; } if (action !== 'generate' && !context.trim()) { toast.warning('内容为空，请先输入文字，或在编辑器中选中一段文字'); return; } cancelGeneration(); const cmd = AI_COMMANDS.find((c) => c.value === action); const ctxSnip = context.substring(0, 60) + (context.length> 60 ? '…' : ''); const userMsg: ChatMessage = { id: Date.now(), role: 'user', actionLabel: cmd?.label ?? action, actionIcon: cmd?.icon ?? '🤖', ctxSummary: ctxSnip, promptText: prompt || undefined, actionValue: action, content: '', reasoning: '', showReasoning: false, isStreaming: false, timestamp: new Date(), }; messages.push(userMsg); opts.scrollToEnd(); const assistId = Date.now() + 1; const assistMsg: ChatMessage = { id: assistId, role: 'assistant', content: '', reasoning: '', showReasoning: false, isStreaming: true, timestamp: new Date(), }; messages.push(assistMsg); activeId.value = assistId; isGenerating.value = true; abortCtrl.value = new AbortController(); opts.scrollToEnd(); try { const response = await fetch('/api/ai/write-assist', { method: 'POST', headers: createJsonHeaders(), body: JSON.stringify({ action, text: context, prompt: action === 'generate' ? prompt : undefined, instruction: customInstruction.value || undefined, scope: ctxMode.value, tone: writingTone.value, length: writingLength.value, format: writingFormat.value, history: buildHistoryPayload(), targetLanguage: action === 'translate' ? targetLanguage.value : undefined, }), signal: abortCtrl.value.signal, }); if (!response.ok) { throw new Error(await readFetchErrorMessage(response)); } const reader = response.body?.getReader(); if (!reader) throw new Error('浏览器不支持流式读取'); await parseSSEStream( reader, (payload) => { const msg = messages.find((m) => m.id === assistId); if (!msg) return; if (payload.event === 'meta') { msg.requestId = payload.requestId; return; } if (payload.event === 'heartbeat') return; if (payload.error) { msg.error = payload.error; throw new Error(payload.error); } if (payload.reasoning) { msg.reasoning += payload.reasoning; if (!msg.showReasoning) msg.showReasoning = true; } if (payload.text) { msg.content += payload.text; } opts.scrollToEnd(); }, () => { const msg = messages.find((m) => m.id === assistId); if (msg) { msg.isStreaming = false; msg.showReasoning = false; } activeId.value = null; isGenerating.value = false; abortCtrl.value = null; opts.scrollToEnd(); }, (err) => { if (err.name === 'AbortError') return; const msg = messages.find((m) => m.id === assistId); if (msg) { msg.isStreaming = false; msg.error = err.message; msg.content = msg.content || '生成出错，请重试'; } toast.error(`生成出错：${err.message}`); isGenerating.value = false; abortCtrl.value = null; activeId.value = null; }, ); } catch (error) { if (error instanceof Error && error.name === 'AbortError') return; const message = error instanceof Error ? error.message : 'AI 生成失败，请重试'; const msg = messages.find((m) => m.id === assistId); if (msg) { msg.isStreaming = false; msg.error = message; msg.content = msg.content || '生成失败，请重试'; } toast.error(message); isGenerating.value = false; abortCtrl.value = null; activeId.value = null; } }; const submitChat = () => { const msg = chatText.value.trim(); if (!msg || isGenerating.value) return; aiAction.value = 'generate'; chatText.value = ''; nextTick(() => runGeneration(msg)); }; const runSelectedAction = () => { if (!canRunAction.value) { if (aiAction.value === 'generate') { toast.warning('请在底部输入框描述您的创作要求'); opts.requestFocus(); } else { toast.warning('编辑器内容为空，请先输入文字，或在编辑器中选中一段文字'); } return; } if (aiAction.value === 'generate') { submitChat(); } else { runGeneration(); } }; const handleApply = ( mode: 'replace' | 'append' | 'copy', content: string, msg: ChatMessage, ) => { opts.emitApply(mode, content); if (mode !== 'copy') { msg.applied = true; } }; const toggleReasoning = (msg: ChatMessage) => { msg.showReasoning = !msg.showReasoning; }; const clearMessages = () => { if (isGenerating.value) return; messages.splice(0, messages.length); }; // ── Lifecycle ────────────────────────────────────────────────── watch( () => opts.show.value, (val) => { if (val) { ctxMode.value = opts.selectedText.value.trim() ? 'selected' : 'full'; aiAction.value = 'polish'; chatText.value = ''; showSettings.value = true; nextTick(() => opts.scrollToEnd()); } else { cancelGeneration(); } }, ); onUnmounted(() => { cancelGeneration(); }); return { aiAction, targetLanguage, writingTone, writingLength, writingFormat, customInstruction, showSettings, messages, activeId, copiedId, isGenerating, chatText, ctxMode, ctxText, ctxLabel, toggleCtxMode, hasSelection, primaryApplyLabel, activeActionLabel, contextCharCount, contextPreview, contextQuality, canRunAction, runSelectedAction, submitChat, cancelGeneration, handleApply, toggleReasoning, clearMessages, };
}
