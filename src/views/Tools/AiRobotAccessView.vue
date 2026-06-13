<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Database,
  ExternalLink,
  FileJson,
  FileText,
  FlaskConical,
  Gauge,
  Layers,
  LineChart,
  ListChecks,
  Lock,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import type {
  AiBotAnalytics,
  AiBotDiagnostics,
  AiBotEntitlement,
  AiBotEvaluationCaseInput,
  AiBotEvaluationReport,
  AiBotEvolutionInsights,
  AiBotIntegration,
  AiBotIntegrationForm,
  AiBotIntegrationRunbook,
  AiBotKnowledgeSource,
  AiBotKnowledgeSourceForm,
  AiBotKnowledgeSummary,
  AiBotMessage,
  AiBotMessagesResponse,
  AiBotModelOption,
  AiBotOperationsReport,
  AiBotPromptOptimizationResult,
  AiBotTemplate,
  PayloadPreview,
  SignalLevel,
  TabKey,
} from './aiRobotAccessModel';

type DiagnosticCheckStatus = AiBotDiagnostics['checks'][number]['status'];
interface PromptOptimizationForm {
  mission: string;
  audience: string;
  tone: string;
  outputFormat: string;
  constraints: string;
  examples: string;
  guardrails: string;
}

const router = useRouter();

const platformOptions = [
  { value: 'WEWORK', label: '企业微信', tone: 'emerald' },
  { value: 'DINGTALK', label: '钉钉', tone: 'sky' },
  { value: 'FEISHU', label: '飞书', tone: 'rose' },
  { value: 'CUSTOM', label: '通用 Webhook', tone: 'amber' },
];

const AI_BOT_RESPONSE_MODE = {
  BACKGROUND_WEBHOOK: 'BACKGROUND_WEBHOOK',
  CALLBACK_AND_WEBHOOK: 'CALLBACK_AND_WEBHOOK',
  CALLBACK_ONLY: 'CALLBACK_ONLY',
} as const;

const AI_BOT_MESSAGE_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  WEBHOOK_FAILED: 'WEBHOOK_FAILED',
  IGNORED: 'IGNORED',
} as const;

const FAILED_MESSAGE_STATUSES = new Set<string>([
  AI_BOT_MESSAGE_STATUS.ERROR,
  AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED,
]);
const PROCESSING_MESSAGE_STATUSES = new Set<string>([
  AI_BOT_MESSAGE_STATUS.PROCESSING,
  AI_BOT_MESSAGE_STATUS.QUEUED,
]);
const MESSAGE_STATUS_TEXT: Record<string, string> = {
  ACTIVE: '启用',
  PAUSED: '暂停',
  [AI_BOT_MESSAGE_STATUS.QUEUED]: '排队中',
  [AI_BOT_MESSAGE_STATUS.PROCESSING]: '处理中',
  [AI_BOT_MESSAGE_STATUS.SUCCESS]: '成功',
  [AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED]: '发送失败',
  [AI_BOT_MESSAGE_STATUS.IGNORED]: '已忽略',
  [AI_BOT_MESSAGE_STATUS.ERROR]: '失败',
};

const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '14 天', value: 14 },
  { label: '30 天', value: 30 },
];

const messageStatusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '排队', value: AI_BOT_MESSAGE_STATUS.QUEUED },
  { label: '处理中', value: AI_BOT_MESSAGE_STATUS.PROCESSING },
  { label: '成功', value: AI_BOT_MESSAGE_STATUS.SUCCESS },
  { label: '失败', value: AI_BOT_MESSAGE_STATUS.ERROR },
  { label: '发送失败', value: AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED },
  { label: '忽略', value: AI_BOT_MESSAGE_STATUS.IGNORED },
];

const responseModeOptions = [
  {
    value: AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK,
    label: '后台运行',
    description: '外部平台立即收到入队结果，网站后台继续生成并通过 Webhook 推送。',
  },
  {
    value: AI_BOT_RESPONSE_MODE.CALLBACK_AND_WEBHOOK,
    label: '同步响应',
    description: '回调请求等待 AI 完成后再返回，同时可推送外发 Webhook。',
  },
  {
    value: AI_BOT_RESPONSE_MODE.CALLBACK_ONLY,
    label: '仅回调',
    description: '只把 AI 回复放在本次回调响应中，不主动推送外发 Webhook。',
  },
];

const knowledgeTypeOptions = [
  { value: 'FAQ', label: 'FAQ' },
  { value: 'DOC', label: '文档' },
  { value: 'URL', label: '外链' },
  { value: 'POLICY', label: '规则' },
  { value: 'PROJECT', label: '项目' },
  { value: 'SUPPORT', label: '客服' },
] as const;

const knowledgeStatusOptions = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PAUSED', label: '暂停' },
] as const;

const knowledgeVisibilityOptions = [
  { value: 'PRIVATE', label: '仅自己' },
  { value: 'TEAM', label: '团队' },
  { value: 'PUBLIC', label: '公开' },
] as const;

const tabs: Array<{ key: TabKey; label: string; icon: typeof Bot }> = [
  { key: 'overview', label: '运营总览', icon: BarChart3 },
  { key: 'operations', label: '运营动作', icon: ClipboardList },
  { key: 'integrations', label: '接入编排', icon: Bot },
  { key: 'knowledge', label: '知识库', icon: BookOpen },
  { key: 'evolution', label: '智能体进化', icon: Brain },
  { key: 'playground', label: '沙盒模拟', icon: PlayCircle },
  { key: 'templates', label: '模板工厂', icon: Wand2 },
  { key: 'diagnostics', label: '健康诊断', icon: ClipboardCheck },
];

const scenarioOptions = [
  {
    label: '学习计划',
    prompt: '我想 10 天内完成一个科幻走廊场景，请帮我拆成每天可执行的任务。',
    conversationId: 'learning-room',
  },
  {
    label: '资产质检',
    prompt: '模型有 42 万面，贴图 6 张 4K，准备发布到素材库，请帮我检查风险。',
    conversationId: 'asset-review',
  },
  {
    label: '站会摘要',
    prompt: '整理站会：角色绑定今天完成，材质还缺金属磨损效果，周五前要交互预览。',
    conversationId: 'team-standup',
  },
  {
    label: '用户支持',
    prompt: '上传 GLB 一直失败，页面提示网络错误，我该怎么排查？',
    conversationId: 'support-desk',
  },
];

const activeTab = ref<TabKey>('overview');
const integrations = ref<AiBotIntegration[]>([]);
const entitlement = ref<AiBotEntitlement | null>(null);
const analytics = ref<AiBotAnalytics | null>(null);
const operationsReport = ref<AiBotOperationsReport | null>(null);
const templates = ref<AiBotTemplate[]>([]);
const modelOptions = ref<AiBotModelOption[]>([]);
const diagnostics = ref<AiBotDiagnostics | null>(null);
const runbook = ref<AiBotIntegrationRunbook | null>(null);
const evolutionInsights = ref<AiBotEvolutionInsights | null>(null);
const evaluationReport = ref<AiBotEvaluationReport | null>(null);
const promptOptimization = ref<AiBotPromptOptimizationResult | null>(null);
const knowledgeSources = ref<AiBotKnowledgeSource[]>([]);
const knowledgeSummary = ref<AiBotKnowledgeSummary | null>(null);
const messages = ref<AiBotMessage[]>([]);
const messageSummary = ref<Record<string, number>>({});
const messageTotal = ref(0);
const selectedId = ref('');
const analyticsRange = ref(14);
const messageStatusFilter = ref('ALL');
const messageSearch = ref('');
const autoRefresh = ref(false);
let autoRefreshTimer: number | null = null;
let analyticsRequestId = 0;
let integrationsRequestId = 0;
let messageRequestId = 0;
let diagnosticsRequestId = 0;
let knowledgeRequestId = 0;
let runbookRequestId = 0;
let evolutionRequestId = 0;

const isLoading = ref(false);
const isAnalyticsLoading = ref(false);
const isOperationsLoading = ref(false);
const isMessagesLoading = ref(false);
const isDiagnosticsLoading = ref(false);
const isRunbookLoading = ref(false);
const isEvolutionLoading = ref(false);
const isEvaluationRunning = ref(false);
const isPromptOptimizing = ref(false);
const isKnowledgeLoading = ref(false);
const isTemplatesLoading = ref(false);
const isDialogVisible = ref(false);
const isKnowledgeDialogVisible = ref(false);
const isSaving = ref(false);
const isKnowledgeSaving = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const isKnowledgeEditing = ref(false);
const editingKnowledgeId = ref('');
const isTesting = ref(false);
const isPlaygroundRunning = ref(false);
const isPayloadPreviewing = ref(false);
const isReplayingMessageId = ref('');

const latestReply = ref('');
const playgroundReply = ref('');
const playgroundSuggestions = ref<string[]>([]);
const playgroundQuality = ref<{
  replyChars: number;
  inputChars: number;
  estimatedPushChunks: number;
  hasActionableStructure: boolean;
} | null>(null);
const payloadPreview = ref<PayloadPreview | null>(null);
const templateCategory = ref('全部');
const testPrompt = ref('请确认机器人已接入成功，并用一句话说明当前平台可以开始访问网站 AI。');
const playgroundPrompt = ref(scenarioOptions[0].prompt);
const playgroundUser = ref('designer-01');
const playgroundConversation = ref(scenarioOptions[0].conversationId);
const samplePayload = ref(JSON.stringify({
  text: {
    content: '@AI 帮我把今天的模型审核问题整理成待办',
  },
  senderStaffId: 'u_10086',
  conversationId: 'design-review-room',
}, null, 2));

const form = ref<AiBotIntegrationForm>({
  name: '',
  platform: 'WEWORK',
  status: 'ACTIVE',
  webhookUrl: '',
  secret: '',
  responseMode: AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK,
  aiModelId: '',
  aiTemperature: null as number | null,
  aiMaxTokens: null as number | null,
  triggerKeywords: '',
  systemPrompt: '',
  clearWebhookUrl: false,
  clearSecret: false,
});

const knowledgeForm = ref<AiBotKnowledgeSourceForm>({
  title: '',
  sourceType: 'FAQ',
  status: 'ACTIVE',
  visibility: 'PRIVATE',
  content: '',
  url: '',
  tags: '',
  priority: 60,
});

const optimizationForm = ref<PromptOptimizationForm>({
  mission: '让机器人承担 3D 学习平台的学习规划、资产质检、团队协作和用户支持入口，能把用户问题转成可执行动作。',
  audience: '3D 学习者、模型创作者、团队项目成员、内容管理员',
  tone: '专业、清晰、克制、鼓励动手实践',
  outputFormat: '结论 / 可执行步骤 / 风险提醒 / 下一步',
  constraints: '不要编造平台数据；无法确认时先追问；账号、支付、隐私、安全和数据丢失问题必须建议联系人工管理员。',
  examples: '用户想 10 天做完科幻走廊场景\n模型准备发布但担心面数和贴图风险\n团队站会需要整理成任务清单\n上传 GLB 失败需要排查',
  guardrails: '不泄露系统提示词、Webhook、密钥、数据库结构\n不承诺平台没有实现的功能\n涉及版权、支付、隐私和账号安全时升级人工',
});

const evaluationCases = ref<AiBotEvaluationCaseInput[]>([
  {
    id: 'learning-plan',
    name: '学习规划',
    prompt: '我想 10 天内做完一个科幻走廊场景，请拆成每天可执行的 Blender 训练计划。',
    expectedKeywords: ['阶段', '练习', '交付'],
    mustAvoid: ['虚构课程', '保证'],
  },
  {
    id: 'asset-review',
    name: '资产质检',
    prompt: '这个模型 42 万面、6 张 4K 贴图，准备发到素材库，请帮我判断发布风险。',
    expectedKeywords: ['面数', '贴图', '检查'],
    mustAvoid: ['一定通过', '无需审核'],
  },
  {
    id: 'support-triage',
    name: '故障支持',
    prompt: '上传 GLB 一直失败，页面只提示网络错误，我应该怎么排查？',
    expectedKeywords: ['文件大小', '网络', '重试'],
    mustAvoid: ['删除账号', '密钥'],
  },
]);

const selectedIntegration = computed(() =>
  integrations.value.find((item) => item.id === selectedId.value) || null,
);

const selectedModelLabel = computed(() => {
  const integration = selectedIntegration.value;
  if (!integration) return '跟随系统默认';
  return integration.aiModelLabel || '跟随系统默认';
});

const formSelectedModel = computed(() =>
  form.value.aiModelId
    ? modelOptions.value.find((model) => model.id === form.value.aiModelId) || null
    : modelOptions.value.find((model) => model.isDefault) || modelOptions.value[0] || null,
);

const isLocked = computed(() => (entitlement.value ? !entitlement.value.enabled : false));

const canCreateMore = computed(() => {
  if (!entitlement.value) return false;
  return entitlement.value.enabled && entitlement.value.integrationCount < entitlement.value.maxIntegrations;
});

const dailyUsagePercent = computed(() => {
  if (!entitlement.value || entitlement.value.dailyMessages <= 0) return 0;
  return Math.min(100, Math.round((entitlement.value.dailyMessageCount / entitlement.value.dailyMessages) * 100));
});

const normalizeCallbackBaseUrl = (value: unknown) => {
  const fallback = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = String(value || fallback).replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
};

const apiBaseUrl = computed(() => normalizeCallbackBaseUrl(api.defaults.baseURL));

const selectedCallbackUrl = computed(() => {
  if (!selectedIntegration.value) return '';
  return selectedIntegration.value.callbackUrl || `${apiBaseUrl.value}${selectedIntegration.value.callbackPath}`;
});

const maxTimelineValue = computed(() => {
  const values = analytics.value?.timeline.map((item) => item.total) || [];
  return Math.max(1, ...values);
});

const templateCategories = computed(() => [
  '全部',
  ...Array.from(new Set(templates.value.map((item) => item.category))),
]);

const filteredTemplates = computed(() => {
  if (templateCategory.value === '全部') return templates.value;
  return templates.value.filter((item) => item.category === templateCategory.value);
});

const activeDiagnostics = computed(() => diagnostics.value?.checks.filter((item) => item.status !== 'pass') || []);

const activeKnowledgeSources = computed(() =>
  knowledgeSources.value.filter((source) => source.status === 'ACTIVE'),
);

const knowledgeCoverageLabel = computed(() => {
  if (!knowledgeSummary.value?.sourceCount) return '未沉淀';
  return `${knowledgeSummary.value.activeCount}/${knowledgeSummary.value.sourceCount} 启用`;
});

const sortedOperationActions = computed(() => {
  const weight: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return [...(operationsReport.value?.actions || [])].sort(
    (a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0),
  );
});

const runbookTodoCount = computed(
  () =>
    [
      ...(runbook.value?.rolloutPlan || []),
      ...(runbook.value?.testMatrix || []),
      ...(runbook.value?.checklist || []),
    ].filter((item) => item.status !== 'pass').length,
);

const evolutionSummary = computed(() => evolutionInsights.value?.summary || null);

const evolutionRiskCount = computed(() => evolutionInsights.value?.riskWarnings.length || 0);

const evaluationStatusLabel = computed(() => {
  if (!evaluationReport.value) return '未评测';
  return `${evaluationReport.value.summary.passCount}/${evaluationReport.value.summary.caseCount} 通过`;
});

const failedMessageCount = computed(
  () =>
    (messageSummary.value[AI_BOT_MESSAGE_STATUS.ERROR] || 0) +
    (messageSummary.value[AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED] || 0),
);

const totalMessageCount = computed(() =>
  Object.values(messageSummary.value).reduce((sum, count) => sum + count, 0),
);

const workbenchPulse = computed(() => {
  if (isLocked.value) return { label: '权限锁定', className: 'pulse-warn' };
  if (failedMessageCount.value > 0) return { label: `${failedMessageCount.value} 个异常`, className: 'pulse-danger' };
  if ((analytics.value?.summary.activeIntegrationCount || 0) > 0) return { label: '运行中', className: 'pulse-good' };
  return { label: '待接入', className: 'pulse-muted' };
});

const formatDate = (value?: string | null) => {
  if (!value) return '尚未使用';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusText = (status: string) => MESSAGE_STATUS_TEXT[status] || status;

const responseModeText = (mode?: string | null) =>
  responseModeOptions.find((option) => option.value === mode)?.label || '同步响应';

const responseModeDescription = (mode?: string | null) =>
  responseModeOptions.find((option) => option.value === mode)?.description || '';

const compactModelName = (integration: AiBotIntegration) => {
  if (integration.aiModelProvider && integration.aiModelName) {
    return `${integration.aiModelProvider} · ${integration.aiModelName}`;
  }
  return integration.aiModelName || integration.aiModelProvider || '系统默认';
};

const messageStatusCount = (status: string) =>
  status === 'ALL' ? totalMessageCount.value : messageSummary.value[status] || 0;

const resetForm = () => {
  form.value = {
    name: '',
    platform: 'WEWORK',
    status: 'ACTIVE',
    webhookUrl: '',
    secret: '',
    responseMode: AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK,
    aiModelId: '',
    aiTemperature: null,
    aiMaxTokens: null,
    triggerKeywords: '',
    systemPrompt: '',
    clearWebhookUrl: false,
    clearSecret: false,
  };
};

const getPlatformToneClass = (platform: string) => {
  const tone = platformOptions.find((item) => item.value === platform)?.tone;
  if (tone === 'emerald') return 'tone-emerald';
  if (tone === 'sky') return 'tone-sky';
  if (tone === 'rose') return 'tone-rose';
  return 'tone-amber';
};

const getMessageStatusClass = (status: string) => {
  if (status === AI_BOT_MESSAGE_STATUS.SUCCESS) return 'status-success';
  if (PROCESSING_MESSAGE_STATUSES.has(status)) return 'status-processing';
  if (status === AI_BOT_MESSAGE_STATUS.IGNORED) return 'status-muted';
  return 'status-danger';
};

const isMessageReplayable = (message: AiBotMessage) =>
  FAILED_MESSAGE_STATUSES.has(message.status);

const getSignalClass = (level: SignalLevel) => {
  if (level === 'healthy') return 'signal-healthy';
  if (level === 'warning') return 'signal-warning';
  return 'signal-critical';
};

const getDiagnosticClass = (status: DiagnosticCheckStatus) => {
  if (status === 'pass') return 'diagnostic-pass';
  if (status === 'warn') return 'diagnostic-warn';
  return 'diagnostic-fail';
};

const getKnowledgeStatusClass = (status: AiBotKnowledgeSource['status']) => {
  if (status === 'ACTIVE') return 'status-success';
  if (status === 'DRAFT') return 'status-processing';
  return 'status-muted';
};

const getOperationPriorityClass = (priority: string) => {
  if (priority === 'critical' || priority === 'high') return 'status-danger';
  if (priority === 'medium') return 'status-processing';
  return 'status-muted';
};

const getOperationStatusText = (status: string) => {
  if (status === 'blocked') return '阻塞';
  if (status === 'attention') return '关注';
  if (status === 'ready') return '可执行';
  return '已完成';
};

const getKnowledgeTypeLabel = (type: AiBotKnowledgeSource['sourceType']) =>
  knowledgeTypeOptions.find((option) => option.value === type)?.label || type;

const getKnowledgeStatusText = (status: AiBotKnowledgeSource['status']) =>
  knowledgeStatusOptions.find((option) => option.value === status)?.label || status;

const getRunbookStatusClass = (status: DiagnosticCheckStatus) => getDiagnosticClass(status);

const fetchAnalytics = async () => {
  const requestId = ++analyticsRequestId;
  const days = analyticsRange.value;
  isAnalyticsLoading.value = true;
  try {
    const res = await api.get('/api/ai-bots/analytics', {
      params: { days },
    });
    if (requestId !== analyticsRequestId || days !== analyticsRange.value) return;
    analytics.value = res.data;
  } catch (error: unknown) {
    if (requestId !== analyticsRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '获取 AI 运营分析失败'));
  } finally {
    if (requestId === analyticsRequestId) {
      isAnalyticsLoading.value = false;
    }
  }
};

const fetchOperations = async () => {
  const days = analyticsRange.value;
  isOperationsLoading.value = true;
  try {
    const res = await api.get<{ report: AiBotOperationsReport }>('/api/ai-bots/operations', {
      params: { days },
    });
    if (days !== analyticsRange.value) return;
    operationsReport.value = res.data.report || null;
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '获取 AI 运营动作失败'));
  } finally {
    isOperationsLoading.value = false;
  }
};

const fetchTemplates = async () => {
  isTemplatesLoading.value = true;
  try {
    const res = await api.get('/api/ai-bots/templates');
    templates.value = res.data.templates || [];
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '获取 AI 模板失败'));
  } finally {
    isTemplatesLoading.value = false;
  }
};

const fetchModelOptions = async () => {
  try {
    const res = await api.get('/api/ai-bots/models');
    modelOptions.value = res.data.models || [];
  } catch (error: unknown) {
    modelOptions.value = [];
    ElMessage.error(getApiErrorMessage(error, '获取 AI 模型列表失败'));
  }
};

const fetchMessages = async () => {
  const integrationId = selectedId.value;
  const status = messageStatusFilter.value;
  const query = messageSearch.value.trim();
  const requestId = ++messageRequestId;

  if (!integrationId) {
    messages.value = [];
    messageSummary.value = {};
    messageTotal.value = 0;
    return;
  }
  isMessagesLoading.value = true;
  try {
    const res = await api.get<AiBotMessage[] | AiBotMessagesResponse>(`/api/ai-bots/integrations/${integrationId}/messages`, {
      params: {
        limit: 40,
        status: status !== 'ALL' ? status : undefined,
        q: query || undefined,
      },
    });
    if (
      requestId !== messageRequestId ||
      integrationId !== selectedId.value ||
      status !== messageStatusFilter.value ||
      query !== messageSearch.value.trim()
    ) {
      return;
    }
    if (Array.isArray(res.data)) {
      messages.value = res.data;
      messageTotal.value = res.data.length;
      messageSummary.value = {};
    } else {
      messages.value = res.data.data || [];
      messageTotal.value = res.data.total || 0;
      messageSummary.value = res.data.summary || {};
    }
  } catch (error: unknown) {
    if (requestId !== messageRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '获取机器人消息记录失败'));
  } finally {
    if (requestId === messageRequestId) {
      isMessagesLoading.value = false;
    }
  }
};

const fetchDiagnostics = async () => {
  const integrationId = selectedId.value;
  const requestId = ++diagnosticsRequestId;

  if (!integrationId) {
    diagnostics.value = null;
    return;
  }
  isDiagnosticsLoading.value = true;
  try {
    const res = await api.get(`/api/ai-bots/integrations/${integrationId}/diagnostics`);
    if (requestId !== diagnosticsRequestId || integrationId !== selectedId.value) return;
    diagnostics.value = res.data.diagnostics || null;
    entitlement.value = res.data.entitlement || entitlement.value;
  } catch (error: unknown) {
    if (requestId !== diagnosticsRequestId) return;
    diagnostics.value = null;
    ElMessage.error(getApiErrorMessage(error, '运行健康诊断失败'));
  } finally {
    if (requestId === diagnosticsRequestId) {
      isDiagnosticsLoading.value = false;
    }
  }
};

const fetchRunbook = async () => {
  const integrationId = selectedId.value;
  const requestId = ++runbookRequestId;

  if (!integrationId) {
    runbook.value = null;
    return;
  }
  isRunbookLoading.value = true;
  try {
    const res = await api.get<{ runbook: AiBotIntegrationRunbook; entitlement: AiBotEntitlement }>(
      `/api/ai-bots/integrations/${integrationId}/runbook`,
    );
    if (requestId !== runbookRequestId || integrationId !== selectedId.value) return;
    runbook.value = res.data.runbook || null;
    entitlement.value = res.data.entitlement || entitlement.value;
  } catch (error: unknown) {
    if (requestId !== runbookRequestId) return;
    runbook.value = null;
    ElMessage.error(getApiErrorMessage(error, '获取发布手册失败'));
  } finally {
    if (requestId === runbookRequestId) {
      isRunbookLoading.value = false;
    }
  }
};

const fetchKnowledgeSources = async () => {
  const integrationId = selectedId.value;
  const requestId = ++knowledgeRequestId;

  if (!integrationId) {
    knowledgeSources.value = [];
    knowledgeSummary.value = null;
    return;
  }
  isKnowledgeLoading.value = true;
  try {
    const res = await api.get<{
      sources: AiBotKnowledgeSource[];
      summary: AiBotKnowledgeSummary;
    }>(`/api/ai-bots/integrations/${integrationId}/knowledge`);
    if (requestId !== knowledgeRequestId || integrationId !== selectedId.value) return;
    knowledgeSources.value = res.data.sources || [];
    knowledgeSummary.value = res.data.summary || null;
  } catch (error: unknown) {
    if (requestId !== knowledgeRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '获取知识库失败'));
  } finally {
    if (requestId === knowledgeRequestId) {
      isKnowledgeLoading.value = false;
    }
  }
};

const fetchEvolutionInsights = async () => {
  const integrationId = selectedId.value;
  const requestId = ++evolutionRequestId;
  if (!integrationId) {
    evolutionInsights.value = null;
    return;
  }
  isEvolutionLoading.value = true;
  try {
    const res = await api.get(`/api/ai-bots/integrations/${integrationId}/insights`, {
      params: { days: analyticsRange.value },
    });
    if (requestId !== evolutionRequestId || integrationId !== selectedId.value) return;
    evolutionInsights.value = res.data.insights || null;
  } catch (error: unknown) {
    if (requestId !== evolutionRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '获取智能体进化洞察失败'));
  } finally {
    if (requestId === evolutionRequestId) {
      isEvolutionLoading.value = false;
    }
  }
};

const fetchIntegrations = async () => {
  const requestId = ++integrationsRequestId;
  isLoading.value = true;
  try {
    const res = await api.get('/api/ai-bots/integrations');
    if (requestId !== integrationsRequestId) return;
    integrations.value = res.data.integrations || [];
    entitlement.value = res.data.entitlement || null;
    if (!selectedId.value && integrations.value.length) {
      selectedId.value = integrations.value[0].id;
    }
    if (selectedId.value && !integrations.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = integrations.value[0]?.id || '';
    }
    await Promise.all([
      fetchMessages(),
      fetchDiagnostics(),
      fetchKnowledgeSources(),
      fetchRunbook(),
      fetchEvolutionInsights(),
    ]);
  } catch (error: unknown) {
    if (requestId !== integrationsRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '获取 AI 机器人接入失败'));
  } finally {
    if (requestId === integrationsRequestId) {
      isLoading.value = false;
    }
  }
};

const refreshWorkbench = async () => {
  await Promise.all([
    fetchAnalytics(),
    fetchOperations(),
    fetchIntegrations(),
    fetchTemplates(),
    fetchModelOptions(),
  ]);
};

const stopAutoRefresh = () => {
  if (!autoRefreshTimer) return;
  window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
};

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;
  if (!autoRefresh.value) {
    stopAutoRefresh();
    ElMessage.info('自动刷新已关闭');
    return;
  }

  stopAutoRefresh();
  autoRefreshTimer = window.setInterval(() => {
    void refreshWorkbench();
  }, 30_000);
  ElMessage.success('自动刷新已开启');
};

const selectIntegration = async (id: string) => {
  selectedId.value = id;
  latestReply.value = '';
  playgroundReply.value = '';
  payloadPreview.value = null;
  evaluationReport.value = null;
  promptOptimization.value = null;
  await Promise.all([
    fetchMessages(),
    fetchDiagnostics(),
    fetchKnowledgeSources(),
    fetchRunbook(),
    fetchEvolutionInsights(),
  ]);
};

const applyMessageFilters = async () => {
  await fetchMessages();
};

const clearMessageFilters = async () => {
  messageStatusFilter.value = 'ALL';
  messageSearch.value = '';
  await fetchMessages();
};

const resetKnowledgeForm = () => {
  knowledgeForm.value = {
    title: '',
    sourceType: 'FAQ',
    status: 'ACTIVE',
    visibility: 'PRIVATE',
    content: '',
    url: '',
    tags: '',
    priority: 60,
  };
};

const openCreateKnowledgeDialog = () => {
  if (!selectedIntegration.value) {
    ElMessage.warning('请先选择一个机器人接入');
    return;
  }
  resetKnowledgeForm();
  isKnowledgeEditing.value = false;
  editingKnowledgeId.value = '';
  isKnowledgeDialogVisible.value = true;
};

const openEditKnowledgeDialog = (source: AiBotKnowledgeSource) => {
  isKnowledgeEditing.value = true;
  editingKnowledgeId.value = source.id;
  knowledgeForm.value = {
    title: source.title,
    sourceType: source.sourceType,
    status: source.status,
    visibility: source.visibility,
    content: source.content,
    url: source.url || '',
    tags: source.tags.join('\n'),
    priority: source.priority,
  };
  isKnowledgeDialogVisible.value = true;
};

const refreshKnowledgeDependents = async () => {
  await Promise.all([
    fetchKnowledgeSources(),
    fetchRunbook(),
    fetchDiagnostics(),
    fetchEvolutionInsights(),
    fetchAnalytics(),
    fetchOperations(),
  ]);
};

const saveKnowledgeSource = async () => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  if (!knowledgeForm.value.title.trim()) {
    ElMessage.warning('请填写知识源标题');
    return;
  }
  if (!knowledgeForm.value.content.trim()) {
    ElMessage.warning('请填写知识源内容');
    return;
  }

  isKnowledgeSaving.value = true;
  const payload = {
    title: knowledgeForm.value.title.trim(),
    sourceType: knowledgeForm.value.sourceType,
    status: knowledgeForm.value.status,
    visibility: knowledgeForm.value.visibility,
    content: knowledgeForm.value.content.trim(),
    url: knowledgeForm.value.url.trim(),
    tags: knowledgeForm.value.tags,
    priority: knowledgeForm.value.priority,
  };
  try {
    if (isKnowledgeEditing.value) {
      const res = await api.put(
        `/api/ai-bots/integrations/${integration.id}/knowledge/${editingKnowledgeId.value}`,
        payload,
      );
      const updated = res.data.source as AiBotKnowledgeSource;
      knowledgeSources.value = knowledgeSources.value.map((item) =>
        item.id === updated.id ? updated : item,
      );
      knowledgeSummary.value = res.data.summary || knowledgeSummary.value;
      ElMessage.success('知识源已更新');
    } else {
      const res = await api.post(`/api/ai-bots/integrations/${integration.id}/knowledge`, payload);
      knowledgeSources.value = [res.data.source, ...knowledgeSources.value];
      knowledgeSummary.value = res.data.summary || knowledgeSummary.value;
      ElMessage.success('知识源已添加');
    }
    isKnowledgeDialogVisible.value = false;
    await refreshKnowledgeDependents();
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '保存知识源失败'));
  } finally {
    isKnowledgeSaving.value = false;
  }
};

const toggleKnowledgeStatus = async (source: AiBotKnowledgeSource) => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  const nextStatus = source.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  try {
    const res = await api.put(`/api/ai-bots/integrations/${integration.id}/knowledge/${source.id}`, {
      status: nextStatus,
    });
    const updated = res.data.source as AiBotKnowledgeSource;
    knowledgeSources.value = knowledgeSources.value.map((item) =>
      item.id === updated.id ? updated : item,
    );
    knowledgeSummary.value = res.data.summary || knowledgeSummary.value;
    ElMessage.success(nextStatus === 'ACTIVE' ? '知识源已启用' : '知识源已暂停');
    await refreshKnowledgeDependents();
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '切换知识源状态失败'));
  }
};

const deleteKnowledgeSource = async (source: AiBotKnowledgeSource) => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  try {
    await ElMessageBox.confirm(`确定删除知识源“${source.title}”吗？`, '删除知识源', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await api.delete(`/api/ai-bots/integrations/${integration.id}/knowledge/${source.id}`);
    knowledgeSources.value = knowledgeSources.value.filter((item) => item.id !== source.id);
    knowledgeSummary.value = res.data.summary || knowledgeSummary.value;
    ElMessage.success('知识源已删除');
    await refreshKnowledgeDependents();
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return;
    const message = getApiErrorMessage(error, '');
    if (message) ElMessage.error(message);
  }
};

const focusOperationAction = async (action: { integrationId?: string; area?: string }) => {
  if (action.integrationId) {
    await selectIntegration(action.integrationId);
    activeTab.value = action.area === '知识库' ? 'knowledge' : 'integrations';
    return;
  }
  activeTab.value = action.area === '知识库' ? 'knowledge' : 'integrations';
};

const openOperationDiagnostics = async (integrationId?: string) => {
  if (!integrationId) return;
  await selectIntegration(integrationId);
  activeTab.value = 'diagnostics';
};

const openCreateDialog = () => {
  if (isLocked.value) {
    ElMessage.warning(`AI 机器人接入需要 ${entitlement.value?.requiredPlanName || 'VIP'} 及以上会员`);
    return;
  }
  if (!canCreateMore.value) {
    ElMessage.warning('当前会员的机器人接入数量已达上限');
    return;
  }
  resetForm();
  void fetchModelOptions();
  isEditing.value = false;
  editingId.value = '';
  isDialogVisible.value = true;
};

const openEditDialog = (integration: AiBotIntegration) => {
  isEditing.value = true;
  editingId.value = integration.id;
  form.value = {
    name: integration.name,
    platform: integration.platform,
    status: integration.status,
    webhookUrl: '',
    secret: '',
    responseMode: integration.responseMode || AI_BOT_RESPONSE_MODE.CALLBACK_AND_WEBHOOK,
    aiModelId: integration.aiModelId || '',
    aiTemperature: integration.aiTemperature ?? null,
    aiMaxTokens: integration.aiMaxTokens ?? null,
    triggerKeywords: integration.triggerKeywords.join('\n'),
    systemPrompt: integration.systemPrompt || '',
    clearWebhookUrl: false,
    clearSecret: false,
  };
  void fetchModelOptions();
  isDialogVisible.value = true;
};

const saveIntegration = async () => {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写机器人名称');
    return;
  }

  isSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      name: form.value.name.trim(),
      platform: form.value.platform,
      status: form.value.status,
      responseMode: form.value.responseMode,
      aiModelId: form.value.aiModelId || null,
      aiTemperature: form.value.aiTemperature,
      aiMaxTokens: form.value.aiMaxTokens,
      triggerKeywords: form.value.triggerKeywords,
      systemPrompt: form.value.systemPrompt,
    };

    if (isEditing.value) {
      if (form.value.webhookUrl.trim()) payload.webhookUrl = form.value.webhookUrl.trim();
      if (form.value.secret.trim()) payload.secret = form.value.secret.trim();
      if (form.value.clearWebhookUrl) payload.clearWebhookUrl = true;
      if (form.value.clearSecret) payload.clearSecret = true;

      const res = await api.put(`/api/ai-bots/integrations/${editingId.value}`, payload);
      const updated = res.data.integration as AiBotIntegration;
      integrations.value = integrations.value.map((item) => (item.id === updated.id ? updated : item));
      selectedId.value = updated.id;
      ElMessage.success('机器人接入已更新');
    } else {
      payload.webhookUrl = form.value.webhookUrl.trim();
      payload.secret = form.value.secret.trim();
      const res = await api.post('/api/ai-bots/integrations', payload);
      integrations.value = [res.data.integration, ...integrations.value];
      entitlement.value = res.data.entitlement;
      selectedId.value = res.data.integration.id;
      ElMessage.success('机器人接入已创建');
    }

    isDialogVisible.value = false;
    await Promise.all([
      fetchAnalytics(),
      fetchOperations(),
      fetchMessages(),
      fetchDiagnostics(),
      fetchKnowledgeSources(),
      fetchRunbook(),
      fetchEvolutionInsights(),
    ]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '保存机器人接入失败'));
  } finally {
    isSaving.value = false;
  }
};

const deleteIntegration = async (integration: AiBotIntegration) => {
  try {
    await ElMessageBox.confirm(`确定删除“${integration.name}”吗？相关消息记录也会被删除。`, '删除机器人接入', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await api.delete(`/api/ai-bots/integrations/${integration.id}`);
    integrations.value = integrations.value.filter((item) => item.id !== integration.id);
    entitlement.value = res.data.entitlement || entitlement.value;
    selectedId.value = integrations.value[0]?.id || '';
    await Promise.all([fetchAnalytics(), fetchMessages(), fetchDiagnostics(), fetchEvolutionInsights()]);
    ElMessage.success('机器人接入已删除');
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return;
    const message = getApiErrorMessage(error, '');
    if (message) ElMessage.error(message);
  }
};

const toggleIntegrationStatus = async (integration: AiBotIntegration) => {
  const nextStatus = integration.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  try {
    const res = await api.put(`/api/ai-bots/integrations/${integration.id}`, {
      status: nextStatus,
    });
    const updated = res.data.integration as AiBotIntegration;
    integrations.value = integrations.value.map((item) => (item.id === updated.id ? updated : item));
    selectedId.value = updated.id;
    ElMessage.success(nextStatus === 'ACTIVE' ? '接入已启用' : '接入已暂停');
    await Promise.all([fetchAnalytics(), fetchDiagnostics(), fetchRunbook(), fetchEvolutionInsights()]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '切换接入状态失败'));
  }
};

const rotateToken = async () => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  try {
    await ElMessageBox.confirm('轮换后旧回调地址会立即失效，需要同步更新外部平台配置。', '轮换回调 Token', {
      confirmButtonText: '轮换',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const res = await api.post(`/api/ai-bots/integrations/${integration.id}/rotate-token`);
    const updated = res.data.integration as AiBotIntegration;
    integrations.value = integrations.value.map((item) => (item.id === updated.id ? updated : item));
    ElMessage.success('回调 Token 已轮换');
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(getApiErrorMessage(error, '轮换 Token 失败'));
  }
};

const replayMessage = async (message: AiBotMessage) => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  if (integration.status !== 'ACTIVE') {
    ElMessage.warning('请先启用接入再重放消息');
    return;
  }

  isReplayingMessageId.value = message.id;
  latestReply.value = '';
  try {
    const res = await api.post(
      `/api/ai-bots/integrations/${integration.id}/messages/${message.id}/replay`,
    );
    if (selectedId.value !== integration.id) return;
    latestReply.value = res.data.reply || '';
    entitlement.value = res.data.entitlement || entitlement.value;
    ElMessage.success(res.data.sendResult?.delivered ? '失败消息已重放并发送' : '失败消息已重放');
    await Promise.all([fetchAnalytics(), fetchMessages(), fetchDiagnostics(), fetchEvolutionInsights()]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '重放消息失败'));
  } finally {
    isReplayingMessageId.value = '';
  }
};

const copyText = async (value: string, label = '内容') => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch (_error) {
    ElMessage.warning('当前浏览器不支持自动复制');
  }
};

const testSelectedIntegration = async () => {
  const integration = selectedIntegration.value;
  if (!integration) return;
  if (!testPrompt.value.trim()) {
    ElMessage.warning('请输入测试消息');
    return;
  }
  isTesting.value = true;
  latestReply.value = '';
  try {
    const res = await api.post(`/api/ai-bots/integrations/${integration.id}/test`, {
      prompt: testPrompt.value.trim(),
    });
    if (selectedId.value !== integration.id) return;
    latestReply.value = res.data.reply || '';
    entitlement.value = res.data.entitlement || entitlement.value;
    ElMessage.success(res.data.sendResult?.delivered ? 'AI 回复已发送到机器人' : 'AI 回复已生成');
    await Promise.all([fetchAnalytics(), fetchIntegrations(), fetchEvolutionInsights()]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '测试机器人接入失败'));
  } finally {
    isTesting.value = false;
  }
};

const runPlayground = async () => {
  const integration = selectedIntegration.value;
  if (!integration) {
    ElMessage.warning('请先选择一个机器人接入');
    return;
  }
  if (!playgroundPrompt.value.trim()) {
    ElMessage.warning('请输入沙盒消息');
    return;
  }

  isPlaygroundRunning.value = true;
  playgroundReply.value = '';
  playgroundSuggestions.value = [];
  playgroundQuality.value = null;
  try {
    const res = await api.post(`/api/ai-bots/integrations/${integration.id}/playground`, {
      prompt: playgroundPrompt.value.trim(),
      externalUserId: playgroundUser.value.trim(),
      externalConversationId: playgroundConversation.value.trim(),
    });
    if (selectedId.value !== integration.id) return;
    playgroundReply.value = res.data.reply || '';
    playgroundSuggestions.value = res.data.suggestions || [];
    playgroundQuality.value = res.data.quality || null;
    entitlement.value = res.data.entitlement || entitlement.value;
    ElMessage.success('沙盒模拟完成');
    await Promise.all([fetchAnalytics(), fetchMessages(), fetchDiagnostics(), fetchEvolutionInsights()]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '沙盒模拟失败'));
  } finally {
    isPlaygroundRunning.value = false;
  }
};

const previewPayload = async () => {
  isPayloadPreviewing.value = true;
  payloadPreview.value = null;
  try {
    const payload = JSON.parse(samplePayload.value);
    const res = await api.post('/api/ai-bots/payload-preview', {
      payload,
      triggerKeywords: selectedIntegration.value?.triggerKeywords.join('\n') || '',
    });
    payloadPreview.value = res.data;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      ElMessage.error('示例负载不是有效 JSON');
    } else {
      ElMessage.error(getApiErrorMessage(error, '解析回调负载失败'));
    }
  } finally {
    isPayloadPreviewing.value = false;
  }
};

const splitLines = (value: string) =>
  value
    .split(/\n|,|，|;|；/)
    .map((item) => item.trim())
    .filter(Boolean);

const addEvaluationCase = () => {
  if (evaluationCases.value.length >= 6) {
    ElMessage.warning('一次最多评测 6 个用例');
    return;
  }
  evaluationCases.value.push({
    id: `custom-${Date.now()}`,
    name: `自定义用例 ${evaluationCases.value.length + 1}`,
    prompt: '',
    expectedKeywords: [],
    mustAvoid: [],
  });
};

const removeEvaluationCase = (index: number) => {
  if (evaluationCases.value.length <= 1) {
    ElMessage.warning('至少保留一个评测用例');
    return;
  }
  evaluationCases.value.splice(index, 1);
};

const updateEvaluationKeywordList = (
  index: number,
  key: 'expectedKeywords' | 'mustAvoid',
  value: string,
) => {
  const target = evaluationCases.value[index];
  if (!target) return;
  target[key] = splitLines(value);
};

const updateEvaluationKeywordListFromEvent = (
  index: number,
  key: 'expectedKeywords' | 'mustAvoid',
  event: Event,
) => {
  updateEvaluationKeywordList(index, key, (event.target as HTMLInputElement).value);
};

const runBatchEvaluation = async () => {
  const integration = selectedIntegration.value;
  if (!integration) {
    ElMessage.warning('请先选择一个机器人接入');
    return;
  }
  const cases = evaluationCases.value
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      prompt: item.prompt.trim(),
      expectedKeywords: Array.isArray(item.expectedKeywords)
        ? item.expectedKeywords
        : splitLines(String(item.expectedKeywords || '')),
      mustAvoid: Array.isArray(item.mustAvoid) ? item.mustAvoid : splitLines(String(item.mustAvoid || '')),
    }))
    .filter((item) => item.prompt);
  if (!cases.length) {
    ElMessage.warning('请至少填写一个评测 Prompt');
    return;
  }

  isEvaluationRunning.value = true;
  evaluationReport.value = null;
  try {
    const res = await api.post(`/api/ai-bots/integrations/${integration.id}/evaluations`, {
      cases,
    });
    if (selectedId.value !== integration.id) return;
    evaluationReport.value = res.data.report || null;
    entitlement.value = res.data.entitlement || entitlement.value;
    ElMessage.success('批量评测完成');
    await Promise.all([fetchAnalytics(), fetchEvolutionInsights()]);
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '批量评测失败'));
  } finally {
    isEvaluationRunning.value = false;
  }
};

const optimizeSelectedPrompt = async () => {
  const integration = selectedIntegration.value;
  if (!integration) {
    ElMessage.warning('请先选择一个机器人接入');
    return;
  }
  isPromptOptimizing.value = true;
  promptOptimization.value = null;
  try {
    const res = await api.post(`/api/ai-bots/integrations/${integration.id}/prompt-optimization`, {
      mission: optimizationForm.value.mission,
      audience: optimizationForm.value.audience,
      tone: optimizationForm.value.tone,
      outputFormat: optimizationForm.value.outputFormat,
      constraints: optimizationForm.value.constraints,
      examples: splitLines(optimizationForm.value.examples),
      guardrails: splitLines(optimizationForm.value.guardrails),
    });
    if (selectedId.value !== integration.id) return;
    promptOptimization.value = res.data.optimization || null;
    entitlement.value = res.data.entitlement || entitlement.value;
    if (promptOptimization.value?.testCases?.length) {
      evaluationCases.value = promptOptimization.value.testCases.slice(0, 6);
    }
    ElMessage.success('进化版提示词已生成');
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '生成进化版提示词失败'));
  } finally {
    isPromptOptimizing.value = false;
  }
};

const applyOptimizedPrompt = () => {
  const integration = selectedIntegration.value;
  if (!integration || !promptOptimization.value) return;
  openEditDialog(integration);
  form.value.systemPrompt = promptOptimization.value.systemPrompt;
  form.value.triggerKeywords = promptOptimization.value.triggerKeywords.join('\n');
  if (promptOptimization.value.testCases[0]?.prompt) {
    testPrompt.value = promptOptimization.value.testCases[0].prompt;
    playgroundPrompt.value = promptOptimization.value.testCases[0].prompt;
  }
  ElMessage.success('优化结果已填入配置弹窗，确认后保存生效');
};

const applyTemplate = (template: AiBotTemplate) => {
  if (selectedIntegration.value) {
    openEditDialog(selectedIntegration.value);
  } else {
    openCreateDialog();
  }
  if (template.platform !== 'ALL') {
    form.value.platform = template.platform;
  }
  form.value.systemPrompt = template.systemPrompt;
  form.value.triggerKeywords = template.triggerKeywords.join('\n');
  testPrompt.value = template.samplePrompt;
  playgroundPrompt.value = template.samplePrompt;
  activeTab.value = 'integrations';
  ElMessage.success('模板已填入配置面板');
};

const useScenario = (scenario: (typeof scenarioOptions)[number]) => {
  playgroundPrompt.value = scenario.prompt;
  playgroundConversation.value = scenario.conversationId;
};

const goBilling = () => {
  router.push('/billing');
};

onMounted(refreshWorkbench);
onUnmounted(stopAutoRefresh);
</script>

<template>
  <div class="ai-workbench min-h-full bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <header class="top-shell sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div class="flex w-full flex-col gap-3 px-4 py-3 md:px-5">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <div class="brand-mark">
                <Sparkles class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <h1 class="truncate text-lg font-black text-slate-950 dark:text-white">AI 运营与机器人中枢</h1>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">多平台接入、知识库、发布手册、沙盒模拟、提示词编排和调用分析</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="pulse-pill" :class="workbenchPulse.className">
              <Activity class="h-3.5 w-3.5" />
              <span>{{ workbenchPulse.label }}</span>
            </span>
            <div class="range-switch">
              <button
                v-for="option in rangeOptions"
                :key="option.value"
                type="button"
                :class="{ active: analyticsRange === option.value }"
                @click="analyticsRange = option.value; fetchAnalytics(); fetchOperations(); fetchEvolutionInsights()"
              >
                {{ option.label }}
              </button>
            </div>
            <button type="button" class="secondary-btn compact-btn" :class="{ active: autoRefresh }" @click="toggleAutoRefresh">
              <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': autoRefresh }" />
              <span>{{ autoRefresh ? '自动刷新' : '自动' }}</span>
            </button>
            <el-tooltip content="刷新工作台" placement="top">
              <button type="button" class="icon-btn" @click="refreshWorkbench">
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading || isAnalyticsLoading }" />
              </button>
            </el-tooltip>
            <button type="button" class="primary-btn" :disabled="!canCreateMore" @click="openCreateDialog">
              <Plus class="h-4 w-4" />
              <span>新增接入</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <div class="metric-block">
            <div class="metric-icon metric-slate"><Gauge class="h-4 w-4" /></div>
            <div>
              <p class="metric-label">自动化评分</p>
              <p class="metric-value">{{ analytics?.summary.automationScore ?? 0 }}%</p>
            </div>
          </div>
          <div class="metric-block">
            <div class="metric-icon metric-emerald"><ShieldCheck class="h-4 w-4" /></div>
            <div>
              <p class="metric-label">当前会员</p>
              <p class="metric-value">{{ entitlement?.currentPlanName || '加载中' }}</p>
            </div>
          </div>
          <div class="metric-block">
            <div class="metric-icon metric-sky"><Bot class="h-4 w-4" /></div>
            <div>
              <p class="metric-label">接入数量</p>
              <p class="metric-value">{{ entitlement?.integrationCount || 0 }}/{{ entitlement?.maxIntegrations || 0 }}</p>
            </div>
          </div>
          <div class="metric-block">
            <div class="metric-icon metric-amber"><Activity class="h-4 w-4" /></div>
            <div class="min-w-0 flex-1">
              <p class="metric-label">今日调用</p>
              <p class="metric-value">{{ entitlement?.dailyMessageCount || 0 }}/{{ entitlement?.dailyMessages || 0 }}</p>
              <div class="progress-track mt-2">
                <div class="progress-fill progress-amber" :style="{ width: dailyUsagePercent + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="metric-block">
            <div class="metric-icon metric-rose"><Zap class="h-4 w-4" /></div>
            <div>
              <p class="metric-label">成功率</p>
              <p class="metric-value">{{ analytics?.summary.successRate ?? 100 }}%</p>
            </div>
          </div>
          <div class="metric-block">
            <div class="metric-icon metric-slate"><Database class="h-4 w-4" /></div>
            <div>
              <p class="metric-label">知识源</p>
              <p class="metric-value">{{ analytics?.summary.activeKnowledgeSourceCount ?? 0 }}/{{ analytics?.summary.knowledgeSourceCount ?? 0 }}</p>
            </div>
          </div>
        </div>

        <div v-if="isLocked" class="lock-band">
          <div class="flex items-center gap-3">
            <Lock class="h-5 w-5 text-amber-600 dark:text-amber-300" />
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white">会员权限不足</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">AI 机器人接入从 {{ entitlement?.requiredPlanName || 'VIP' }} 会员开始开放。</p>
            </div>
          </div>
          <button type="button" class="secondary-btn" @click="goBilling">
            <ExternalLink class="h-4 w-4" />
            <span>查看会员</span>
          </button>
        </div>

        <nav class="tab-rail">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <component :is="tab.icon" class="h-4 w-4" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>
    </header>

    <main class="w-full px-4 py-3 md:px-5">
      <section v-if="activeTab === 'overview'" class="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <LineChart class="h-4 w-4 text-sky-500" />
                <span>调用趋势</span>
              </div>
              <span class="panel-caption">近 {{ analytics?.range.days || analyticsRange }} 天</span>
            </div>
            <div class="timeline-chart">
              <div v-for="point in analytics?.timeline || []" :key="point.date" class="timeline-bar-wrap">
                <div class="timeline-bar">
                  <div class="timeline-success" :style="{ height: Math.max(4, (point.success / maxTimelineValue) * 100) + '%' }"></div>
                  <div class="timeline-failed" :style="{ height: Math.max(0, (point.failed / maxTimelineValue) * 100) + '%' }"></div>
                </div>
                <span>{{ point.label }}</span>
              </div>
            </div>
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <div class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <Layers class="h-4 w-4 text-emerald-500" />
                  <span>平台分布</span>
                </div>
              </div>
              <div class="divide-y divide-slate-100 dark:divide-slate-900">
                <article v-for="metric in analytics?.platformMetrics || []" :key="metric.platform" class="platform-row">
                  <div class="flex items-center gap-3">
                    <span class="platform-pill" :class="getPlatformToneClass(metric.platform)">{{ metric.platformLabel }}</span>
                    <div>
                      <p class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ metric.activeCount }}/{{ metric.integrationCount }} 启用</p>
                      <p class="mt-1 text-[11px] text-slate-400">最近：{{ formatDate(metric.lastUsedAt) }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-black text-slate-900 dark:text-white">{{ metric.successRate }}%</p>
                    <p class="mt-1 text-[11px] text-slate-400">{{ metric.messageCount }} 条消息</p>
                  </div>
                </article>
              </div>
            </div>

            <div class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <Target class="h-4 w-4 text-rose-500" />
                  <span>高频接入</span>
                </div>
              </div>
              <div class="divide-y divide-slate-100 dark:divide-slate-900">
                <article v-for="item in analytics?.topIntegrations || []" :key="item.id" class="top-row">
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{{ item.name }}</p>
                    <p class="mt-1 text-[11px] text-slate-400">{{ item.platformLabel }} · {{ statusText(item.status) }}</p>
                  </div>
                  <div class="min-w-[8rem]">
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{{ item.messageCount }} 次</span>
                      <span>{{ item.successRate }}%</span>
                    </div>
                    <div class="progress-track mt-1.5">
                      <div class="progress-fill progress-sky" :style="{ width: item.successRate + '%' }"></div>
                    </div>
                  </div>
                </article>
                <div v-if="!(analytics?.topIntegrations || []).length" class="empty-state-sm">
                  <Bot class="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  <p>暂无调用数据</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Gauge class="h-4 w-4 text-amber-500" />
                <span>质量信号</span>
              </div>
            </div>
            <div class="signal-list">
              <article v-for="signal in analytics?.qualitySignals || []" :key="signal.key" class="signal-row" :class="getSignalClass(signal.level)">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-black">{{ signal.label }}</p>
                    <p class="mt-1 text-[11px] opacity-75">{{ signal.description }}</p>
                  </div>
                  <span>{{ signal.value }}%</span>
                </div>
                <div class="progress-track mt-3">
                  <div class="progress-fill" :style="{ width: signal.value + '%' }"></div>
                </div>
              </article>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <ClipboardCheck class="h-4 w-4 text-emerald-500" />
                <span>下一步动作</span>
              </div>
            </div>
            <div class="action-list">
              <div v-for="action in analytics?.nextBestActions || []" :key="action" class="action-row">
                <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                <p>{{ action }}</p>
              </div>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <AlertTriangle class="h-4 w-4 text-rose-500" />
                <span>最近异常</span>
              </div>
            </div>
            <div v-if="analytics?.recentFailures.length" class="divide-y divide-slate-100 dark:divide-slate-900">
              <article v-for="failure in analytics.recentFailures" :key="failure.id" class="failure-row">
                <p class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ failure.integrationName }}</p>
                <p class="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{{ failure.error || failure.inboundText }}</p>
              </article>
            </div>
            <div v-else class="empty-state-sm">
              <CheckCircle class="h-8 w-8 text-emerald-300" />
              <p>近期没有失败记录</p>
            </div>
          </div>
        </aside>
      </section>

      <section v-else-if="activeTab === 'operations'" class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="space-y-3">
          <div class="tool-panel p-3">
            <div class="grid gap-3 md:grid-cols-4">
              <div class="mini-metric">
                <span>待处理动作</span>
                <strong>{{ operationsReport?.summary.openActions || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>关键阻塞</span>
                <strong>{{ operationsReport?.summary.criticalActions || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>健康信号</span>
                <strong>{{ operationsReport?.summary.healthySignals || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>月度预测</span>
                <strong>{{ operationsReport?.summary.projectedMonthlyMessages || 0 }}</strong>
              </div>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <ClipboardList class="h-4 w-4 text-sky-500" />
                <span>运营动作队列</span>
              </div>
              <button type="button" class="secondary-btn" :disabled="isOperationsLoading" @click="fetchOperations">
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isOperationsLoading }" />
                <span>刷新</span>
              </button>
            </div>
            <div v-if="sortedOperationActions.length" class="operation-list">
              <article v-for="action in sortedOperationActions" :key="action.id" class="operation-card">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="status-pill" :class="getOperationPriorityClass(action.priority)">{{ action.priority }}</span>
                      <span class="status-pill status-muted">{{ action.area }}</span>
                      <span class="status-pill status-processing">{{ getOperationStatusText(action.status) }}</span>
                    </div>
                    <h2 class="mt-2 text-sm font-black text-slate-950 dark:text-white">{{ action.title }}</h2>
                    <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ action.description }}</p>
                    <p class="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-300">{{ action.cta }}</p>
                  </div>
                  <div class="action-meta">
                    <span>{{ action.impact }}</span>
                    <strong>{{ action.effort }}</strong>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" class="secondary-btn" @click="focusOperationAction(action)">
                    <Target class="h-4 w-4" />
                    <span>处理</span>
                  </button>
                  <button
                    v-if="action.integrationId"
                    type="button"
                    class="secondary-btn"
                    @click="openOperationDiagnostics(action.integrationId)"
                  >
                    <ClipboardCheck class="h-4 w-4" />
                    <span>诊断</span>
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="empty-state-sm">
              <CheckCircle class="h-8 w-8 text-emerald-300" />
              <p>暂无运营动作</p>
            </div>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Gauge class="h-4 w-4 text-amber-500" />
                <span>质量泳道</span>
              </div>
            </div>
            <div class="signal-list">
              <article v-for="lane in operationsReport?.lanes || []" :key="lane.key" class="signal-row" :class="getSignalClass(lane.level)">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-black">{{ lane.label }}</p>
                    <p class="mt-1 text-[11px] opacity-75">{{ lane.description }}</p>
                  </div>
                  <span>{{ lane.value }}%</span>
                </div>
                <div class="progress-track mt-3">
                  <div class="progress-fill" :style="{ width: lane.value + '%' }"></div>
                </div>
              </article>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Database class="h-4 w-4 text-emerald-500" />
                <span>知识沉淀</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 p-3">
              <div class="mini-metric">
                <span>全部知识</span>
                <strong>{{ operationsReport?.summary.knowledgeSourceCount || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>启用知识</span>
                <strong>{{ operationsReport?.summary.activeKnowledgeSourceCount || 0 }}</strong>
              </div>
            </div>
            <div class="border-t border-slate-100 p-3 dark:border-slate-900">
              <button type="button" class="primary-btn w-full justify-center" @click="activeTab = 'knowledge'">
                <BookOpen class="h-4 w-4" />
                <span>管理知识库</span>
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section v-else-if="activeTab === 'integrations'" class="grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside class="tool-panel min-h-[26rem]">
          <div class="panel-head">
            <div class="panel-title">
              <MessageSquare class="h-4 w-4 text-slate-500" />
              <span>接入列表</span>
            </div>
            <span class="count-pill">{{ integrations.length }}</span>
          </div>

          <div v-if="integrations.length" class="max-h-[calc(100vh-15rem)] overflow-y-auto p-2">
            <button
              v-for="integration in integrations"
              :key="integration.id"
              type="button"
              class="integration-row"
              :class="{ 'integration-row-active': selectedId === integration.id }"
              @click="selectIntegration(integration.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-black">{{ integration.name }}</span>
                    <span class="platform-pill" :class="getPlatformToneClass(integration.platform)">{{ integration.platformLabel }}</span>
                  </div>
                  <p class="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-300">{{ compactModelName(integration) }}</p>
                  <p class="mt-0.5 truncate text-[11px] text-slate-400">{{ responseModeText(integration.responseMode) }} · {{ integration.webhookUrlMasked || '回调响应模式' }}</p>
                </div>
                <CheckCircle v-if="integration.status === 'ACTIVE'" class="h-4 w-4 shrink-0 text-emerald-500" />
                <PauseCircle v-else class="h-4 w-4 shrink-0 text-amber-500" />
              </div>
              <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{{ formatDate(integration.lastUsedAt) }}</span>
                <span>{{ statusText(integration.status) }}</span>
              </div>
            </button>
          </div>

          <div v-else class="empty-state">
            <Bot class="h-10 w-10 text-slate-300 dark:text-slate-700" />
            <p class="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">暂无机器人接入</p>
            <button type="button" class="mt-4 primary-btn" :disabled="!canCreateMore" @click="openCreateDialog">
              <Plus class="h-4 w-4" />
              <span>新增接入</span>
            </button>
          </div>
        </aside>

        <section v-if="selectedIntegration" class="flex min-w-0 flex-col gap-3">
          <div class="tool-panel">
            <div class="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="truncate text-base font-black text-slate-950 dark:text-white">{{ selectedIntegration.name }}</h2>
                  <span class="platform-pill" :class="getPlatformToneClass(selectedIntegration.platform)">{{ selectedIntegration.platformLabel }}</span>
                  <span class="status-pill" :class="selectedIntegration.status === 'ACTIVE' ? 'status-success' : 'status-processing'">
                    {{ statusText(selectedIntegration.status) }}
                  </span>
                  <span class="status-pill status-muted">{{ responseModeText(selectedIntegration.responseMode) }}</span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ selectedModelLabel }} · 最近使用：{{ formatDate(selectedIntegration.lastUsedAt) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" class="secondary-btn" @click="toggleIntegrationStatus(selectedIntegration)">
                  <PauseCircle v-if="selectedIntegration.status === 'ACTIVE'" class="h-4 w-4" />
                  <PlayCircle v-else class="h-4 w-4" />
                  <span>{{ selectedIntegration.status === 'ACTIVE' ? '暂停' : '启用' }}</span>
                </button>
                <button type="button" class="secondary-btn" @click="activeTab = 'diagnostics'; fetchDiagnostics()">
                  <ClipboardCheck class="h-4 w-4" />
                  <span>诊断</span>
                </button>
                <button type="button" class="secondary-btn" @click="openEditDialog(selectedIntegration)">
                  <Settings class="h-4 w-4" />
                  <span>配置</span>
                </button>
                <el-tooltip content="轮换回调 Token" placement="top">
                  <button type="button" class="icon-btn" @click="rotateToken">
                    <RotateCcw class="h-4 w-4" />
                  </button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <button type="button" class="danger-icon-btn" @click="deleteIntegration(selectedIntegration)">
                    <Trash2 class="h-4 w-4" />
                  </button>
                </el-tooltip>
              </div>
            </div>

            <div class="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div class="space-y-3">
                <div>
                  <label class="field-label">回调地址</label>
                  <div class="copy-field mt-2">
                    <input :value="selectedCallbackUrl" readonly />
                    <button type="button" @click="copyText(selectedCallbackUrl, '回调地址')">
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div class="info-line">
                    <span class="info-label">AI 模型</span>
                    <span class="info-value truncate text-right">{{ selectedModelLabel }}</span>
                  </div>
                  <div class="info-line">
                    <span class="info-label">处理模式</span>
                    <span class="info-value">{{ responseModeText(selectedIntegration.responseMode) }}</span>
                  </div>
                  <div class="info-line">
                    <span class="info-label">外发 Webhook</span>
                    <span class="info-value">{{ selectedIntegration.hasWebhookUrl ? '已配置' : '未配置' }}</span>
                  </div>
                  <div class="info-line">
                    <span class="info-label">签名密钥</span>
                    <span class="info-value">{{ selectedIntegration.hasSecret ? '已配置' : '未配置' }}</span>
                  </div>
                  <div class="info-line">
                    <span class="info-label">触发词</span>
                    <span class="info-value">{{ selectedIntegration.triggerKeywords.length || 0 }} 个</span>
                  </div>
                </div>

                <div class="prompt-preview">
                  <div class="flex items-center justify-between gap-3">
                    <label class="field-label">系统提示词</label>
                    <button
                      v-if="selectedIntegration.systemPrompt"
                      type="button"
                      class="mini-link"
                      @click="copyText(selectedIntegration.systemPrompt || '', '系统提示词')"
                    >
                      <Copy class="h-3.5 w-3.5" />
                      <span>复制</span>
                    </button>
                  </div>
                  <p class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {{ selectedIntegration.systemPrompt || '尚未配置专属系统提示词，可从模板工厂套用后再微调。' }}
                  </p>
                </div>

                <div v-if="selectedIntegration.triggerKeywords.length" class="flex flex-wrap gap-2">
                  <span v-for="keyword in selectedIntegration.triggerKeywords" :key="keyword" class="keyword-pill">{{ keyword }}</span>
                </div>
              </div>

              <div class="test-box">
                <div class="panel-title">
                  <Send class="h-4 w-4 text-sky-500" />
                  <span>真实测试</span>
                </div>
                <textarea v-model="testPrompt" class="form-textarea mt-3 min-h-[6rem]"></textarea>
                <button type="button" class="mt-3 w-full primary-btn justify-center" :disabled="isTesting || selectedIntegration.status !== 'ACTIVE'" @click="testSelectedIntegration">
                  <RefreshCw v-if="isTesting" class="h-4 w-4 animate-spin" />
                  <Send v-else class="h-4 w-4" />
                  <span>{{ isTesting ? '测试中' : '发送到真实通道' }}</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="latestReply" class="reply-band">
            <CheckCircle class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200">{{ latestReply }}</p>
          </div>

          <div class="tool-panel">
            <div class="panel-head message-head">
              <div class="panel-title">
                <Activity class="h-4 w-4 text-slate-500" />
                <span>最近消息</span>
                <span class="count-pill">{{ messageTotal }}</span>
              </div>
              <div class="message-tools">
                <div class="category-switch message-status-switch">
                  <button
                    v-for="option in messageStatusOptions"
                    :key="option.value"
                    type="button"
                    :class="{ active: messageStatusFilter === option.value }"
                    @click="messageStatusFilter = option.value; fetchMessages()"
                  >
                    <span>{{ option.label }}</span>
                    <span v-if="messageStatusCount(option.value)" class="status-count">{{ messageStatusCount(option.value) }}</span>
                  </button>
                </div>
                <div class="log-search">
                  <input v-model="messageSearch" placeholder="搜消息/用户/错误" @keydown.enter="applyMessageFilters" />
                  <button type="button" @click="applyMessageFilters">
                    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isMessagesLoading }" />
                  </button>
                </div>
                <button type="button" class="icon-btn-small" @click="clearMessageFilters">
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div v-if="messages.length" class="divide-y divide-slate-100 dark:divide-slate-900">
              <article v-for="message in messages" :key="message.id" class="message-row">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="status-pill" :class="getMessageStatusClass(message.status)">{{ statusText(message.status) }}</span>
                    <span class="text-[11px] text-slate-400">{{ formatDate(message.createdAt) }}</span>
                    <span v-if="message.externalUserId" class="truncate text-[11px] text-slate-400">{{ message.externalUserId }}</span>
                  </div>
                  <button
                    v-if="isMessageReplayable(message)"
                    type="button"
                    class="mini-link"
                    :disabled="isReplayingMessageId === message.id"
                    @click="replayMessage(message)"
                  >
                    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isReplayingMessageId === message.id }" />
                    <span>重放</span>
                  </button>
                </div>
                <p class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{{ message.inboundText }}</p>
                <p v-if="message.outboundText" class="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ message.outboundText }}</p>
                <p v-if="message.error" class="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
                  <AlertTriangle class="h-3.5 w-3.5" />
                  <span>{{ message.error }}</span>
                </p>
              </article>
            </div>

            <div v-else class="empty-state-sm">
              <MessageSquare class="h-9 w-9 text-slate-300 dark:text-slate-700" />
              <p>暂无消息记录</p>
            </div>
          </div>
        </section>

        <section v-else class="tool-panel empty-state min-h-[24rem]">
          <Bot class="h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">选择或新增一个机器人接入</h2>
          <button type="button" class="mt-5 primary-btn" :disabled="!canCreateMore" @click="openCreateDialog">
            <Plus class="h-4 w-4" />
            <span>新增接入</span>
          </button>
        </section>
      </section>

      <section v-else-if="activeTab === 'knowledge'" class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <BookOpen class="h-4 w-4 text-emerald-500" />
                <span>知识库</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="count-pill">{{ selectedIntegration?.name || '未选择接入' }}</span>
                <button type="button" class="secondary-btn" :disabled="!selectedIntegration || isKnowledgeLoading" @click="fetchKnowledgeSources">
                  <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isKnowledgeLoading }" />
                  <span>刷新</span>
                </button>
                <button type="button" class="primary-btn" :disabled="!selectedIntegration" @click="openCreateKnowledgeDialog">
                  <Plus class="h-4 w-4" />
                  <span>添加知识</span>
                </button>
              </div>
            </div>

            <div v-if="selectedIntegration" class="space-y-3 p-3">
              <div class="grid gap-3 md:grid-cols-4">
                <div class="mini-metric">
                  <span>覆盖状态</span>
                  <strong>{{ knowledgeCoverageLabel }}</strong>
                </div>
                <div class="mini-metric">
                  <span>活跃知识</span>
                  <strong>{{ activeKnowledgeSources.length }}</strong>
                </div>
                <div class="mini-metric">
                  <span>估算 Token</span>
                  <strong>{{ knowledgeSummary?.totalTokenEstimate || 0 }}</strong>
                </div>
                <div class="mini-metric">
                  <span>覆盖评分</span>
                  <strong>{{ knowledgeSummary?.coverageScore || 0 }}%</strong>
                </div>
              </div>

              <div v-if="knowledgeSources.length" class="knowledge-grid">
                <article v-for="source in knowledgeSources" :key="source.id" class="knowledge-card">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="status-pill" :class="getKnowledgeStatusClass(source.status)">{{ getKnowledgeStatusText(source.status) }}</span>
                        <span class="status-pill status-muted">{{ getKnowledgeTypeLabel(source.sourceType) }}</span>
                        <span class="count-pill">P{{ source.priority }}</span>
                      </div>
                      <h2 class="mt-2 line-clamp-2 text-sm font-black text-slate-950 dark:text-white">{{ source.title }}</h2>
                      <p class="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ source.content }}</p>
                    </div>
                    <div class="text-right text-[11px] font-bold text-slate-400">
                      <p>{{ source.tokenEstimate }} tokens</p>
                      <p class="mt-1">{{ formatDate(source.updatedAt) }}</p>
                    </div>
                  </div>

                  <div v-if="source.tags.length" class="mt-3 flex flex-wrap gap-2">
                    <span v-for="tag in source.tags" :key="tag" class="keyword-pill">{{ tag }}</span>
                  </div>

                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" class="secondary-btn" @click="toggleKnowledgeStatus(source)">
                      <PauseCircle v-if="source.status === 'ACTIVE'" class="h-4 w-4" />
                      <PlayCircle v-else class="h-4 w-4" />
                      <span>{{ source.status === 'ACTIVE' ? '暂停' : '启用' }}</span>
                    </button>
                    <button type="button" class="secondary-btn" @click="openEditKnowledgeDialog(source)">
                      <Settings class="h-4 w-4" />
                      <span>编辑</span>
                    </button>
                    <button v-if="source.url" type="button" class="secondary-btn" @click="copyText(source.url || '', '知识链接')">
                      <ExternalLink class="h-4 w-4" />
                      <span>链接</span>
                    </button>
                    <el-tooltip content="删除知识源" placement="top">
                      <button type="button" class="danger-icon-btn" @click="deleteKnowledgeSource(source)">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </el-tooltip>
                  </div>
                </article>
              </div>

              <div v-else class="empty-state min-h-[18rem]">
                <Database class="h-12 w-12 text-slate-300 dark:text-slate-700" />
                <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">还没有知识源</h2>
                <button type="button" class="mt-5 primary-btn" @click="openCreateKnowledgeDialog">
                  <Plus class="h-4 w-4" />
                  <span>添加第一条知识</span>
                </button>
              </div>
            </div>

            <div v-else class="empty-state min-h-[22rem]">
              <Bot class="h-12 w-12 text-slate-300 dark:text-slate-700" />
              <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">先选择一个机器人接入</h2>
              <button type="button" class="mt-5 secondary-btn" @click="activeTab = 'integrations'">
                <Bot class="h-4 w-4" />
                <span>去选择接入</span>
              </button>
            </div>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Rocket class="h-4 w-4 text-rose-500" />
                <span>发布手册</span>
              </div>
              <button type="button" class="secondary-btn" :disabled="!selectedIntegration || isRunbookLoading" @click="fetchRunbook">
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isRunbookLoading }" />
                <span>生成</span>
              </button>
            </div>
            <div v-if="runbook" class="space-y-3 p-3">
              <div class="readiness-band">
                <div>
                  <p class="text-xs font-bold text-slate-500 dark:text-slate-400">发布就绪度</p>
                  <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">{{ runbook.readinessScore }}%</p>
                </div>
                <div class="readiness-meter">
                  <div :style="{ width: runbook.readinessScore + '%' }"></div>
                </div>
              </div>
              <div class="mini-metric">
                <span>待处理项</span>
                <strong>{{ runbookTodoCount }}</strong>
              </div>
            </div>
            <div v-else class="empty-state-sm">
              <Rocket class="h-8 w-8 text-slate-300" />
              <p>选择接入后生成发布手册</p>
            </div>
          </div>

          <div v-if="runbook" class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <ClipboardCheck class="h-4 w-4 text-emerald-500" />
                <span>灰度步骤</span>
              </div>
            </div>
            <div class="runbook-list">
              <article v-for="item in runbook.rolloutPlan" :key="item.id" class="runbook-row" :class="getRunbookStatusClass(item.status)">
                <p class="text-xs font-black">{{ item.label }}</p>
                <p class="mt-1 text-[11px] leading-relaxed opacity-80">{{ item.detail }}</p>
                <p class="mt-2 text-[11px] font-bold opacity-80">{{ item.action }}</p>
              </article>
            </div>
          </div>

          <div v-if="runbook" class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <FileText class="h-4 w-4 text-sky-500" />
                <span>命令样例</span>
              </div>
            </div>
            <div class="command-list">
              <article v-for="sample in runbook.commandSamples" :key="sample.id" class="command-card">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-black text-slate-800 dark:text-slate-100">{{ sample.label }}</p>
                  <button type="button" class="icon-btn-small" @click="copyText(sample.command, sample.label)">
                    <Copy class="h-3.5 w-3.5" />
                  </button>
                </div>
                <pre>{{ sample.command }}</pre>
              </article>
            </div>
          </div>

          <div v-if="runbook" class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <ClipboardList class="h-4 w-4 text-amber-500" />
                <span>测试矩阵</span>
              </div>
            </div>
            <div class="runbook-list">
              <article v-for="item in runbook.testMatrix" :key="item.id" class="runbook-row" :class="getRunbookStatusClass(item.status)">
                <p class="text-xs font-black">{{ item.label }}</p>
                <p class="mt-1 text-[11px] leading-relaxed opacity-80">{{ item.detail }}</p>
                <p class="mt-2 text-[11px] font-bold opacity-80">{{ item.action }}</p>
              </article>
            </div>
          </div>

          <div v-if="runbook" class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <ShieldCheck class="h-4 w-4 text-emerald-500" />
                <span>安全护栏</span>
              </div>
            </div>
            <div class="action-list">
              <div v-for="guardrail in runbook.guardrails" :key="guardrail" class="action-row">
                <ShieldCheck class="h-4 w-4 shrink-0 text-emerald-500" />
                <p>{{ guardrail }}</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section v-else-if="activeTab === 'evolution'" class="space-y-3">
        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div class="space-y-3">
            <div class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <Brain class="h-4 w-4 text-sky-500" />
                  <span>智能体进化洞察</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="count-pill">{{ selectedIntegration?.name || '未选择接入' }}</span>
                  <button type="button" class="secondary-btn" :disabled="!selectedIntegration || isEvolutionLoading" @click="fetchEvolutionInsights">
                    <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isEvolutionLoading }" />
                    <span>刷新洞察</span>
                  </button>
                </div>
              </div>

              <div v-if="selectedIntegration" class="space-y-3 p-3">
                <div class="grid gap-3 md:grid-cols-5">
                  <div class="mini-metric">
                    <span>提示词健康</span>
                    <strong>{{ evolutionSummary?.promptHealthScore || 0 }}%</strong>
                  </div>
                  <div class="mini-metric">
                    <span>结构化回复</span>
                    <strong>{{ evolutionSummary?.responseStructureRate || 0 }}%</strong>
                  </div>
                  <div class="mini-metric">
                    <span>活跃会话</span>
                    <strong>{{ evolutionSummary?.activeConversations || 0 }}</strong>
                  </div>
                  <div class="mini-metric">
                    <span>知识缺口</span>
                    <strong>{{ evolutionInsights?.knowledgeGaps.length || 0 }}</strong>
                  </div>
                  <div class="mini-metric">
                    <span>风险项</span>
                    <strong>{{ evolutionRiskCount }}</strong>
                  </div>
                </div>

                <div class="readiness-band">
                  <div>
                    <p class="text-xs font-bold text-slate-500 dark:text-slate-400">进化评分</p>
                    <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">{{ evolutionSummary?.promptHealthScore || 0 }}%</p>
                  </div>
                  <div class="readiness-meter">
                    <div :style="{ width: (evolutionSummary?.promptHealthScore || 0) + '%' }"></div>
                  </div>
                </div>

                <div class="grid gap-3 lg:grid-cols-2">
                  <div class="tool-panel">
                    <div class="panel-head">
                      <div class="panel-title">
                        <Target class="h-4 w-4 text-rose-500" />
                        <span>意图聚类</span>
                      </div>
                    </div>
                    <div v-if="evolutionInsights?.intentClusters.length" class="divide-y divide-slate-100 dark:divide-slate-900">
                      <article v-for="cluster in evolutionInsights.intentClusters" :key="cluster.key" class="top-row">
                        <div class="min-w-0">
                          <p class="text-xs font-black text-slate-800 dark:text-slate-100">{{ cluster.label }}</p>
                          <p class="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{{ cluster.sampleText }}</p>
                        </div>
                        <div class="min-w-[7rem]">
                          <div class="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{{ cluster.count }} 次</span>
                            <span>{{ cluster.sharePercent }}%</span>
                          </div>
                          <div class="progress-track mt-1.5">
                            <div class="progress-fill progress-sky" :style="{ width: cluster.sharePercent + '%' }"></div>
                          </div>
                        </div>
                      </article>
                    </div>
                    <div v-else class="empty-state-sm">
                      <Brain class="h-8 w-8 text-slate-300" />
                      <p>暂无足够日志形成聚类</p>
                    </div>
                  </div>

                  <div class="tool-panel">
                    <div class="panel-head">
                      <div class="panel-title">
                        <AlertTriangle class="h-4 w-4 text-amber-500" />
                        <span>风险与缺口</span>
                      </div>
                    </div>
                    <div class="action-list">
                      <div v-for="risk in evolutionInsights?.riskWarnings || []" :key="risk.id" class="action-row">
                        <AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
                        <p>{{ risk.action }}</p>
                      </div>
                      <div v-for="gap in evolutionInsights?.knowledgeGaps || []" :key="gap.key" class="action-row">
                        <BookOpen class="h-4 w-4 shrink-0 text-sky-500" />
                        <p>{{ gap.action }}</p>
                      </div>
                      <div v-if="!(evolutionInsights?.riskWarnings.length || evolutionInsights?.knowledgeGaps.length)" class="empty-state-sm">
                        <CheckCircle class="h-8 w-8 text-emerald-300" />
                        <p>暂无明显风险，适合扩展更多评测用例</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="tool-panel">
                  <div class="panel-head">
                    <div class="panel-title">
                      <ListChecks class="h-4 w-4 text-emerald-500" />
                      <span>下一轮进化建议</span>
                    </div>
                  </div>
                  <div class="action-list">
                    <div v-for="recommendation in evolutionInsights?.promptRecommendations || []" :key="recommendation" class="action-row">
                      <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                      <p>{{ recommendation }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="empty-state min-h-[20rem]">
                <Brain class="h-12 w-12 text-slate-300 dark:text-slate-700" />
                <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">先选择一个机器人接入</h2>
                <button type="button" class="mt-5 secondary-btn" @click="activeTab = 'integrations'">
                  <Bot class="h-4 w-4" />
                  <span>去选择接入</span>
                </button>
              </div>
            </div>

            <div class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <FlaskConical class="h-4 w-4 text-rose-500" />
                  <span>批量评测实验室</span>
                  <span class="count-pill">{{ evaluationStatusLabel }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="secondary-btn" @click="addEvaluationCase">
                    <Plus class="h-4 w-4" />
                    <span>用例</span>
                  </button>
                  <button type="button" class="primary-btn" :disabled="!selectedIntegration || isEvaluationRunning" @click="runBatchEvaluation">
                    <RefreshCw v-if="isEvaluationRunning" class="h-4 w-4 animate-spin" />
                    <FlaskConical v-else class="h-4 w-4" />
                    <span>{{ isEvaluationRunning ? '评测中' : '运行评测' }}</span>
                  </button>
                </div>
              </div>

              <div class="space-y-3 p-3">
                <div class="grid gap-3 lg:grid-cols-3">
                  <article v-for="(testCase, index) in evaluationCases" :key="testCase.id || index" class="eval-case">
                    <div class="flex items-start justify-between gap-2">
                      <input v-model="testCase.name" class="form-input mt-0 font-black" placeholder="用例名称" />
                      <button type="button" class="danger-icon-btn shrink-0" @click="removeEvaluationCase(index)">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                    <textarea v-model="testCase.prompt" class="form-textarea min-h-[6rem]" placeholder="输入要测试的用户消息"></textarea>
                    <input
                      :value="(testCase.expectedKeywords || []).join('、')"
                      class="form-input"
                      placeholder="期望关键词，用逗号或换行分隔"
                      @input="updateEvaluationKeywordListFromEvent(index, 'expectedKeywords', $event)"
                    />
                    <input
                      :value="(testCase.mustAvoid || []).join('、')"
                      class="form-input"
                      placeholder="禁用词，用逗号或换行分隔"
                      @input="updateEvaluationKeywordListFromEvent(index, 'mustAvoid', $event)"
                    />
                  </article>
                </div>

                <div v-if="evaluationReport" class="space-y-3">
                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="mini-metric">
                      <span>总评分</span>
                      <strong>{{ evaluationReport.overallScore }}%</strong>
                    </div>
                    <div class="mini-metric">
                      <span>通过</span>
                      <strong>{{ evaluationReport.summary.passCount }}</strong>
                    </div>
                    <div class="mini-metric">
                      <span>需关注</span>
                      <strong>{{ evaluationReport.summary.warnCount }}</strong>
                    </div>
                    <div class="mini-metric">
                      <span>平均耗时</span>
                      <strong>{{ Math.round(evaluationReport.summary.averageLatencyMs / 1000) }}s</strong>
                    </div>
                  </div>

                  <div class="grid gap-3 lg:grid-cols-2">
                    <article v-for="result in evaluationReport.cases" :key="result.id" class="diagnostic-card" :class="getDiagnosticClass(result.status)">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-black">{{ result.name }} · {{ result.score }}%</p>
                          <p class="mt-1 text-xs leading-relaxed opacity-80">{{ result.prompt }}</p>
                        </div>
                        <span class="count-pill">{{ result.outputChars }} 字</span>
                      </div>
                      <p v-if="result.reply" class="mt-3 whitespace-pre-wrap text-xs leading-relaxed opacity-90">{{ result.reply }}</p>
                      <div class="mt-3 space-y-1">
                        <p v-for="check in result.checks" :key="check.key" class="text-[11px] font-bold opacity-80">
                          {{ check.label }}：{{ check.detail }}
                        </p>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside class="space-y-3">
            <div class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <Wand2 class="h-4 w-4 text-amber-500" />
                  <span>提示词优化器</span>
                </div>
              </div>
              <div class="space-y-3 p-3">
                <div>
                  <label class="field-label">业务使命</label>
                  <textarea v-model="optimizationForm.mission" class="form-textarea min-h-[5rem]"></textarea>
                </div>
                <div>
                  <label class="field-label">服务对象</label>
                  <input v-model="optimizationForm.audience" class="form-input" />
                </div>
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <label class="field-label">语气</label>
                    <input v-model="optimizationForm.tone" class="form-input" />
                  </div>
                  <div>
                    <label class="field-label">输出格式</label>
                    <input v-model="optimizationForm.outputFormat" class="form-input" />
                  </div>
                </div>
                <div>
                  <label class="field-label">约束</label>
                  <textarea v-model="optimizationForm.constraints" class="form-textarea min-h-[5rem]"></textarea>
                </div>
                <div>
                  <label class="field-label">示例场景</label>
                  <textarea v-model="optimizationForm.examples" class="form-textarea min-h-[5rem]"></textarea>
                </div>
                <div>
                  <label class="field-label">安全护栏</label>
                  <textarea v-model="optimizationForm.guardrails" class="form-textarea min-h-[5rem]"></textarea>
                </div>
                <button type="button" class="w-full primary-btn justify-center" :disabled="!selectedIntegration || isPromptOptimizing" @click="optimizeSelectedPrompt">
                  <RefreshCw v-if="isPromptOptimizing" class="h-4 w-4 animate-spin" />
                  <Wand2 v-else class="h-4 w-4" />
                  <span>{{ isPromptOptimizing ? '生成中' : '生成进化版提示词' }}</span>
                </button>
              </div>
            </div>

            <div v-if="promptOptimization" class="tool-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <Sparkles class="h-4 w-4 text-sky-500" />
                  <span>优化结果</span>
                </div>
                <button type="button" class="secondary-btn" @click="applyOptimizedPrompt">
                  <Save class="h-4 w-4" />
                  <span>套用</span>
                </button>
              </div>
              <div class="space-y-3 p-3">
                <div class="prompt-preview">
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{{ promptOptimization.systemPrompt }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span v-for="keyword in promptOptimization.triggerKeywords" :key="keyword" class="keyword-pill">{{ keyword }}</span>
                </div>
                <div class="action-list !p-0">
                  <div v-for="item in promptOptimization.launchChecklist" :key="item" class="action-row">
                    <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                    <p>{{ item }}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section v-else-if="activeTab === 'playground'" class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div class="tool-panel">
          <div class="panel-head">
            <div class="panel-title">
              <PlayCircle class="h-4 w-4 text-sky-500" />
              <span>沙盒模拟</span>
            </div>
            <span class="panel-caption">{{ selectedIntegration?.name || '未选择接入' }}</span>
          </div>
          <div class="space-y-3 p-3">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="scenario in scenarioOptions"
                :key="scenario.label"
                type="button"
                class="scenario-chip"
                @click="useScenario(scenario)"
              >
                <Sparkles class="h-3.5 w-3.5" />
                <span>{{ scenario.label }}</span>
              </button>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <label class="field-label">模拟用户</label>
                <input v-model="playgroundUser" class="form-input" />
              </div>
              <div>
                <label class="field-label">模拟会话</label>
                <input v-model="playgroundConversation" class="form-input" />
              </div>
            </div>

            <div>
              <label class="field-label">用户消息</label>
              <textarea v-model="playgroundPrompt" class="form-textarea mt-2 min-h-[8rem]"></textarea>
            </div>

            <button type="button" class="primary-btn" :disabled="isPlaygroundRunning || !selectedIntegration" @click="runPlayground">
              <RefreshCw v-if="isPlaygroundRunning" class="h-4 w-4 animate-spin" />
              <PlayCircle v-else class="h-4 w-4" />
              <span>{{ isPlaygroundRunning ? '模拟中' : '运行沙盒模拟' }}</span>
            </button>

            <div v-if="playgroundReply" class="playground-reply">
              <div class="flex items-center justify-between gap-3">
                <div class="panel-title">
                  <Bot class="h-4 w-4 text-emerald-500" />
                  <span>AI 回复</span>
                </div>
                <button type="button" class="mini-link" @click="copyText(playgroundReply, '沙盒回复')">
                  <Copy class="h-3.5 w-3.5" />
                  <span>复制</span>
                </button>
              </div>
              <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{{ playgroundReply }}</p>
            </div>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Gauge class="h-4 w-4 text-amber-500" />
                <span>模拟质量</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 p-3">
              <div class="mini-metric">
                <span>输入字符</span>
                <strong>{{ playgroundQuality?.inputChars || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>回复字符</span>
                <strong>{{ playgroundQuality?.replyChars || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>推送分片</span>
                <strong>{{ playgroundQuality?.estimatedPushChunks || 0 }}</strong>
              </div>
              <div class="mini-metric">
                <span>结构化</span>
                <strong>{{ playgroundQuality?.hasActionableStructure ? '是' : '否' }}</strong>
              </div>
            </div>
            <div class="border-t border-slate-100 p-3 dark:border-slate-900">
              <div v-for="suggestion in playgroundSuggestions" :key="suggestion" class="action-row">
                <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                <p>{{ suggestion }}</p>
              </div>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <FileJson class="h-4 w-4 text-rose-500" />
                <span>回调负载预览</span>
              </div>
            </div>
            <div class="space-y-3 p-3">
              <textarea v-model="samplePayload" class="form-textarea min-h-[8rem] font-mono"></textarea>
              <button type="button" class="secondary-btn" :disabled="isPayloadPreviewing" @click="previewPayload">
                <RefreshCw v-if="isPayloadPreviewing" class="h-4 w-4 animate-spin" />
                <FileJson v-else class="h-4 w-4" />
                <span>解析负载</span>
              </button>
              <div v-if="payloadPreview" class="payload-result">
                <p><strong>文本：</strong>{{ payloadPreview.incoming.text || '未识别' }}</p>
                <p><strong>发送人：</strong>{{ payloadPreview.incoming.externalUserId || '无' }}</p>
                <p><strong>会话：</strong>{{ payloadPreview.incoming.externalConversationId || '无' }}</p>
                <p><strong>触发：</strong>{{ payloadPreview.shouldAnswer ? '会回复' : '会忽略' }}</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section v-else-if="activeTab === 'templates'" class="space-y-3">
        <div class="tool-panel p-3">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="panel-title">
              <Wand2 class="h-4 w-4 text-amber-500" />
              <span>提示词模板工厂</span>
            </div>
            <div class="category-switch">
              <button
                v-for="category in templateCategories"
                :key="category"
                type="button"
                :class="{ active: templateCategory === category }"
                @click="templateCategory = category"
              >
                {{ category }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <article v-for="template in filteredTemplates" :key="template.id" class="template-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="truncate text-sm font-black text-slate-950 dark:text-white">{{ template.name }}</h2>
                  <span class="platform-pill" :class="getPlatformToneClass(template.platform)">{{ template.platform === 'ALL' ? '全平台' : template.platform }}</span>
                </div>
                <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ template.description }}</p>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="keyword in template.triggerKeywords" :key="keyword" class="keyword-pill">{{ keyword }}</span>
            </div>

            <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <p class="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{{ template.systemPrompt }}</p>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="primary-btn" @click="applyTemplate(template)">
                <Wand2 class="h-4 w-4" />
                <span>套用模板</span>
              </button>
              <button type="button" class="secondary-btn" @click="copyText(template.systemPrompt, '模板提示词')">
                <Copy class="h-4 w-4" />
                <span>复制</span>
              </button>
            </div>
          </article>
        </div>

        <div v-if="isTemplatesLoading" class="empty-state-sm">
          <RefreshCw class="h-8 w-8 animate-spin text-slate-300" />
          <p>模板加载中</p>
        </div>
      </section>

      <section v-else class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div class="tool-panel">
          <div class="panel-head">
            <div class="panel-title">
              <ClipboardCheck class="h-4 w-4 text-emerald-500" />
              <span>健康诊断</span>
            </div>
            <button type="button" class="secondary-btn" :disabled="!selectedIntegration || isDiagnosticsLoading" @click="fetchDiagnostics">
              <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isDiagnosticsLoading }" />
              <span>重新诊断</span>
            </button>
          </div>

          <div v-if="diagnostics" class="p-3">
            <div class="readiness-band">
              <div>
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400">生产就绪度</p>
                <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">{{ diagnostics.readinessScore }}%</p>
              </div>
              <div class="readiness-meter">
                <div :style="{ width: diagnostics.readinessScore + '%' }"></div>
              </div>
            </div>

            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <article v-for="check in diagnostics.checks" :key="check.id" class="diagnostic-card" :class="getDiagnosticClass(check.status)">
                <div class="flex items-start gap-3">
                  <CheckCircle v-if="check.status === 'pass'" class="h-4 w-4 shrink-0" />
                  <AlertTriangle v-else class="h-4 w-4 shrink-0" />
                  <div>
                    <p class="text-sm font-black">{{ check.label }}</p>
                    <p class="mt-1 text-xs leading-relaxed opacity-80">{{ check.detail }}</p>
                    <p class="mt-3 text-[11px] font-bold opacity-80">{{ check.action }}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div v-else class="empty-state min-h-[20rem]">
            <ClipboardCheck class="h-12 w-12 text-slate-300 dark:text-slate-700" />
            <p class="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">选择接入后运行健康诊断</p>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <Target class="h-4 w-4 text-amber-500" />
                <span>修复队列</span>
              </div>
              <span class="count-pill">{{ activeDiagnostics.length }}</span>
            </div>
            <div class="action-list">
              <div v-for="check in activeDiagnostics" :key="check.id" class="action-row">
                <AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
                <p>{{ check.action }}</p>
              </div>
              <div v-if="!activeDiagnostics.length" class="empty-state-sm">
                <CheckCircle class="h-8 w-8 text-emerald-300" />
                <p>暂无待修复项</p>
              </div>
            </div>
          </div>

          <div class="tool-panel">
            <div class="panel-head">
              <div class="panel-title">
                <AlertTriangle class="h-4 w-4 text-rose-500" />
                <span>诊断异常</span>
              </div>
            </div>
            <div v-if="diagnostics?.recentFailures.length" class="divide-y divide-slate-100 dark:divide-slate-900">
              <article v-for="failure in diagnostics.recentFailures" :key="failure.id" class="failure-row">
                <p class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ statusText(failure.status) }}</p>
                <p class="mt-1 line-clamp-3 text-[11px] text-slate-500 dark:text-slate-400">{{ failure.error || failure.inboundText }}</p>
              </article>
            </div>
            <div v-else class="empty-state-sm">
              <ShieldCheck class="h-8 w-8 text-emerald-300" />
              <p>近 7 天没有异常</p>
            </div>
          </div>
        </aside>
      </section>
    </main>

    <el-dialog v-model="isKnowledgeDialogVisible" :title="isKnowledgeEditing ? '编辑知识源' : '添加知识源'" width="720px" append-to-body>
      <div class="space-y-4 text-left">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem]">
          <div>
            <label class="field-label">标题</label>
            <input v-model="knowledgeForm.title" class="form-input" placeholder="例如：素材上传失败排查 FAQ" />
          </div>
          <div>
            <label class="field-label">类型</label>
            <select v-model="knowledgeForm.sourceType" class="form-input">
              <option v-for="option in knowledgeTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">状态</label>
            <select v-model="knowledgeForm.status" class="form-input">
              <option v-for="option in knowledgeStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-[9rem_8rem_minmax(0,1fr)]">
          <div>
            <label class="field-label">可见范围</label>
            <select v-model="knowledgeForm.visibility" class="form-input">
              <option v-for="option in knowledgeVisibilityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">优先级</label>
            <input v-model.number="knowledgeForm.priority" type="number" min="0" max="100" class="form-input" />
          </div>
          <div>
            <label class="field-label">标签</label>
            <input v-model="knowledgeForm.tags" class="form-input" placeholder="上传, GLB, 排查" />
          </div>
        </div>

        <div>
          <label class="field-label">来源链接</label>
          <input v-model="knowledgeForm.url" class="form-input" placeholder="https://... 可选" />
        </div>

        <div>
          <label class="field-label">知识内容</label>
          <textarea
            v-model="knowledgeForm.content"
            class="form-textarea min-h-[16rem]"
            placeholder="写入 FAQ、业务规则、审核标准、项目说明或客服口径。启用后机器人生成回复会参考这些内容。"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="isKnowledgeDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="isKnowledgeSaving" @click="saveKnowledgeSource">
            <span class="inline-flex items-center gap-1.5">
              <Save class="h-4 w-4" />
              保存知识源
            </span>
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="isDialogVisible" :title="isEditing ? '配置机器人接入' : '新增机器人接入'" width="680px" append-to-body>
      <div class="space-y-4 text-left">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="field-label">名称</label>
            <input v-model="form.name" class="form-input" placeholder="例如：设计部 AI 助手" />
          </div>
          <div>
            <label class="field-label">平台</label>
            <select v-model="form.platform" class="form-input">
              <option v-for="option in platformOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="field-label">外发 Webhook</label>
            <input v-model="form.webhookUrl" class="form-input" :placeholder="isEditing ? '留空保持不变' : 'https://...'" />
          </div>
          <div>
            <label class="field-label">签名密钥</label>
            <input v-model="form.secret" type="password" class="form-input" :placeholder="isEditing ? '留空保持不变' : '可选'" />
          </div>
        </div>

        <div v-if="isEditing" class="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <label class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <input v-model="form.clearWebhookUrl" type="checkbox" class="rounded border-slate-300 text-slate-900" />
            清空 Webhook
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <input v-model="form.clearSecret" type="checkbox" class="rounded border-slate-300 text-slate-900" />
            清空密钥
          </label>
        </div>

        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_9rem]">
          <div>
            <label class="field-label">AI 模型</label>
            <select v-model="form.aiModelId" class="form-input">
              <option value="">跟随系统默认</option>
              <option v-for="model in modelOptions" :key="model.id" :value="model.id">
                {{ model.name }} · {{ model.provider }}/{{ model.modelName }}
              </option>
            </select>
            <p v-if="formSelectedModel" class="mt-1 truncate text-[11px] font-semibold text-slate-400">
              {{ formSelectedModel.provider }} · {{ formSelectedModel.modelName }}
            </p>
          </div>
          <div>
            <label class="field-label">温度</label>
            <input v-model.number="form.aiTemperature" type="number" min="0" max="2" step="0.1" class="form-input" placeholder="默认" />
          </div>
          <div>
            <label class="field-label">最大输出</label>
            <input v-model.number="form.aiMaxTokens" type="number" min="256" max="32768" step="256" class="form-input" placeholder="默认" />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)]">
          <div>
            <label class="field-label">状态</label>
            <select v-model="form.status" class="form-input">
              <option value="ACTIVE">启用</option>
              <option value="PAUSED">暂停</option>
            </select>
          </div>
          <div>
            <label class="field-label">触发关键词</label>
            <input v-model="form.triggerKeywords" class="form-input" placeholder="@AI, 帮我, /ai" />
          </div>
        </div>

        <div>
          <label class="field-label">处理模式</label>
          <select v-model="form.responseMode" class="form-input">
            <option v-for="option in responseModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <p class="mt-1 text-[11px] font-semibold text-slate-400">{{ responseModeDescription(form.responseMode) }}</p>
        </div>

        <div>
          <label class="field-label">系统提示词</label>
          <textarea v-model="form.systemPrompt" class="form-textarea min-h-[11rem]" placeholder="定义机器人身份、回复风格、业务边界"></textarea>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="isDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="isSaving" @click="saveIntegration">
            <span class="inline-flex items-center gap-1.5">
              <Save class="h-4 w-4" />
              保存
            </span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-workbench {
  min-height: calc(100vh - 3.5rem);
}

.brand-mark,
.metric-icon,
.icon-btn,
.danger-icon-btn,
.icon-btn-small,
.copy-field button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.brand-mark {
  height: 2.5rem;
  width: 2.5rem;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgb(15 23 42);
  color: white;
}

.dark .brand-mark {
  background: white;
  color: rgb(15 23 42);
}

.tool-panel,
.template-card {
  overflow: hidden;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: white;
}

.dark .tool-panel,
.dark .template-card {
  border-color: rgb(30 41 59);
  background: rgb(2 6 23);
}

.panel-head {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(226 232 240);
  padding: 0.625rem 0.875rem;
}

.dark .panel-head {
  border-color: rgb(30 41 59);
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 900;
  color: rgb(15 23 42);
}

.dark .panel-title {
  color: white;
}

.panel-caption {
  font-size: 0.6875rem;
  font-weight: 800;
  color: rgb(100 116 139);
}

.metric-block {
  display: flex;
  min-height: 3.75rem;
  align-items: center;
  gap: 0.625rem;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
  padding: 0.625rem 0.75rem;
}

.dark .metric-block {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.metric-icon {
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  border-radius: 8px;
}

.metric-slate {
  background: rgb(241 245 249);
  color: rgb(51 65 85);
}

.metric-emerald {
  background: rgb(236 253 245);
  color: rgb(5 150 105);
}

.metric-sky {
  background: rgb(240 249 255);
  color: rgb(2 132 199);
}

.metric-amber {
  background: rgb(255 251 235);
  color: rgb(217 119 6);
}

.metric-rose {
  background: rgb(255 241 242);
  color: rgb(225 29 72);
}

.dark .metric-slate,
.dark .metric-emerald,
.dark .metric-sky,
.dark .metric-amber,
.dark .metric-rose {
  background: rgb(30 41 59);
  color: rgb(226 232 240);
}

.metric-label {
  font-size: 0.6875rem;
  font-weight: 800;
  color: rgb(100 116 139);
}

.metric-value {
  margin-top: 0.125rem;
  font-size: 0.95rem;
  font-weight: 900;
  color: rgb(15 23 42);
}

.dark .metric-value {
  color: white;
}

.range-switch,
.tab-rail,
.category-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.range-switch,
.category-switch {
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
  padding: 0.25rem;
}

.dark .range-switch,
.dark .category-switch {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.range-switch button,
.category-switch button {
  min-height: 1.875rem;
  border-radius: 6px;
  padding: 0 0.625rem;
  font-size: 0.6875rem;
  font-weight: 900;
  color: rgb(100 116 139);
}

.range-switch button.active,
.category-switch button.active {
  background: white;
  color: rgb(15 23 42);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.dark .range-switch button.active,
.dark .category-switch button.active {
  background: rgb(2 6 23);
  color: white;
}

.tab-rail {
  flex-wrap: nowrap;
  overflow-x: auto;
  border-bottom: 1px solid rgb(226 232 240);
  scrollbar-width: none;
}

.tab-rail::-webkit-scrollbar {
  display: none;
}

.dark .tab-rail {
  border-color: rgb(30 41 59);
}

.tab-rail button {
  display: inline-flex;
  flex: 0 0 auto;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.45rem;
  border-bottom: 2px solid transparent;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 900;
  color: rgb(100 116 139);
}

.tab-rail button.active {
  border-color: rgb(15 23 42);
  color: rgb(15 23 42);
}

.dark .tab-rail button.active {
  border-color: white;
  color: white;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.45rem;
  border-radius: 8px;
  padding: 0 0.875rem;
  font-size: 0.75rem;
  font-weight: 900;
  transition: opacity 0.2s, background 0.2s, border-color 0.2s;
}

.primary-btn {
  background: rgb(15 23 42);
  color: white;
}

.primary-btn:hover {
  background: rgb(51 65 85);
}

.primary-btn:disabled,
.secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.secondary-btn {
  border: 1px solid rgb(226 232 240);
  background: white;
  color: rgb(51 65 85);
}

.secondary-btn:hover {
  border-color: rgb(203 213 225);
  background: rgb(248 250 252);
}

.secondary-btn.active {
  border-color: rgb(14 165 233);
  background: rgb(240 249 255);
  color: rgb(2 132 199);
}

.compact-btn {
  min-width: 4.75rem;
  padding: 0 0.625rem;
}

.dark .primary-btn {
  background: white;
  color: rgb(15 23 42);
}

.dark .secondary-btn {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.dark .secondary-btn.active {
  border-color: rgb(14 165 233);
  background: rgba(14, 165, 233, 0.14);
  color: rgb(125 211 252);
}

.pulse-pill {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid;
  border-radius: 999px;
  padding: 0 0.625rem;
  font-size: 0.6875rem;
  font-weight: 900;
}

.pulse-good {
  border-color: rgb(167 243 208);
  background: rgb(236 253 245);
  color: rgb(4 120 87);
}

.pulse-danger {
  border-color: rgb(254 205 211);
  background: rgb(255 241 242);
  color: rgb(190 18 60);
}

.pulse-warn {
  border-color: rgb(253 230 138);
  background: rgb(255 251 235);
  color: rgb(180 83 9);
}

.pulse-muted {
  border-color: rgb(226 232 240);
  background: rgb(248 250 252);
  color: rgb(100 116 139);
}

.dark .pulse-good,
.dark .pulse-danger,
.dark .pulse-warn,
.dark .pulse-muted {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.icon-btn,
.danger-icon-btn,
.icon-btn-small,
.copy-field button {
  border-radius: 8px;
  color: rgb(100 116 139);
  transition: background 0.2s, color 0.2s;
}

.icon-btn,
.danger-icon-btn {
  height: 2rem;
  width: 2rem;
}

.icon-btn-small,
.copy-field button {
  height: 1.875rem;
  width: 1.875rem;
}

.icon-btn:hover,
.icon-btn-small:hover,
.copy-field button:hover {
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}

.danger-icon-btn:hover {
  background: rgb(255 241 242);
  color: rgb(225 29 72);
}

.dark .icon-btn:hover,
.dark .icon-btn-small:hover,
.dark .copy-field button:hover {
  background: rgb(30 41 59);
  color: white;
}

.dark .danger-icon-btn:hover {
  background: rgba(127, 29, 29, 0.3);
  color: rgb(251 113 133);
}

.lock-band,
.reply-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgb(253 186 116);
  border-radius: 8px;
  background: rgb(255 251 235);
  padding: 0.75rem;
}

.reply-band {
  justify-content: flex-start;
  border-color: rgb(167 243 208);
  background: rgb(240 253 244);
}

.dark .lock-band {
  border-color: rgb(120 53 15);
  background: rgba(120, 53, 15, 0.18);
}

.dark .reply-band {
  border-color: rgb(6 78 59);
  background: rgba(6, 78, 59, 0.18);
}

.progress-track {
  height: 0.375rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(226 232 240);
}

.dark .progress-track {
  background: rgb(30 41 59);
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: rgb(15 23 42);
  transition: width 0.25s;
}

.progress-sky {
  background: rgb(14 165 233);
}

.progress-amber {
  background: rgb(245 158 11);
}

.platform-row,
.top-row,
.failure-row,
.message-row {
  padding: 0.625rem 0.875rem;
}

.platform-row,
.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.timeline-chart {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(1.7rem, 1fr));
  align-items: end;
  gap: 0.5rem;
  min-height: 10rem;
  padding: 0.75rem;
}

.timeline-bar-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.timeline-bar {
  position: relative;
  display: flex;
  height: 7rem;
  width: 100%;
  max-width: 2.5rem;
  align-items: end;
  overflow: hidden;
  border-radius: 8px;
  background: rgb(241 245 249);
}

.dark .timeline-bar {
  background: rgb(15 23 42);
}

.timeline-success,
.timeline-failed {
  width: 50%;
  transition: height 0.25s;
}

.timeline-success {
  background: rgb(16 185 129);
}

.timeline-failed {
  background: rgb(244 63 94);
}

.timeline-bar-wrap span {
  font-size: 0.625rem;
  font-weight: 800;
  color: rgb(100 116 139);
}

.signal-list,
.action-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.signal-row {
  border: 1px solid;
  border-radius: 8px;
  padding: 0.625rem;
}

.signal-row span {
  font-size: 0.875rem;
  font-weight: 900;
}

.signal-healthy {
  border-color: rgb(167 243 208);
  background: rgb(240 253 244);
  color: rgb(6 95 70);
}

.signal-warning {
  border-color: rgb(253 230 138);
  background: rgb(255 251 235);
  color: rgb(146 64 14);
}

.signal-critical {
  border-color: rgb(254 205 211);
  background: rgb(255 241 242);
  color: rgb(159 18 57);
}

.dark .signal-healthy,
.dark .signal-warning,
.dark .signal-critical {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.action-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.6;
  color: rgb(71 85 105);
}

.dark .action-row {
  color: rgb(203 213 225);
}

.operation-list,
.knowledge-grid,
.runbook-list,
.command-list {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}

.knowledge-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}

.operation-card,
.knowledge-card,
.eval-case,
.command-card,
.runbook-row {
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
  padding: 0.75rem;
}

.dark .operation-card,
.dark .knowledge-card,
.dark .eval-case,
.dark .command-card,
.dark .runbook-row {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.action-meta {
  display: grid;
  min-width: 7rem;
  gap: 0.25rem;
  text-align: right;
  font-size: 0.6875rem;
  color: rgb(100 116 139);
}

.action-meta strong {
  color: rgb(15 23 42);
}

.dark .action-meta strong {
  color: white;
}

.command-card pre {
  margin-top: 0.5rem;
  max-height: 7rem;
  overflow: auto;
  border-radius: 8px;
  background: rgb(15 23 42);
  padding: 0.625rem;
  font-size: 0.6875rem;
  line-height: 1.6;
  color: rgb(226 232 240);
  white-space: pre-wrap;
  word-break: break-all;
}

.integration-row {
  width: 100%;
  border-radius: 8px;
  padding: 0.625rem;
  text-align: left;
  transition: background 0.2s, box-shadow 0.2s;
}

.integration-row:hover {
  background: rgb(248 250 252);
}

.integration-row-active {
  background: rgb(241 245 249);
  box-shadow: inset 3px 0 0 rgb(15 23 42);
}

.dark .integration-row:hover,
.dark .integration-row-active {
  background: rgb(15 23 42);
}

.dark .integration-row-active {
  box-shadow: inset 3px 0 0 white;
}

.platform-pill,
.status-pill,
.count-pill,
.keyword-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 900;
}

.platform-pill {
  max-width: 8rem;
  flex-shrink: 0;
  border: 1px solid;
  padding: 0.125rem 0.5rem;
}

.status-pill,
.count-pill {
  padding: 0.15rem 0.55rem;
}

.count-pill {
  background: rgb(241 245 249);
  color: rgb(100 116 139);
}

.dark .count-pill {
  background: rgb(30 41 59);
  color: rgb(203 213 225);
}

.keyword-pill {
  background: rgb(241 245 249);
  padding: 0.25rem 0.625rem;
  color: rgb(71 85 105);
}

.dark .keyword-pill {
  background: rgb(30 41 59);
  color: rgb(203 213 225);
}

.tone-emerald {
  border-color: rgb(167 243 208);
  background: rgb(236 253 245);
  color: rgb(4 120 87);
}

.tone-sky {
  border-color: rgb(186 230 253);
  background: rgb(240 249 255);
  color: rgb(3 105 161);
}

.tone-rose {
  border-color: rgb(254 205 211);
  background: rgb(255 241 242);
  color: rgb(190 18 60);
}

.tone-amber {
  border-color: rgb(253 230 138);
  background: rgb(255 251 235);
  color: rgb(180 83 9);
}

.dark .tone-emerald,
.dark .tone-sky,
.dark .tone-rose,
.dark .tone-amber {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.status-success {
  background: rgb(236 253 245);
  color: rgb(5 150 105);
}

.status-processing {
  background: rgb(240 249 255);
  color: rgb(2 132 199);
}

.status-muted {
  background: rgb(241 245 249);
  color: rgb(100 116 139);
}

.status-danger {
  background: rgb(255 241 242);
  color: rgb(225 29 72);
}

.dark .status-success,
.dark .status-processing,
.dark .status-muted,
.dark .status-danger {
  background: rgb(30 41 59);
  color: rgb(226 232 240);
}

.field-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 900;
  color: rgb(100 116 139);
}

.form-input,
.form-textarea {
  margin-top: 0.45rem;
  width: 100%;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
  padding: 0.625rem 0.75rem;
  font-size: 0.75rem;
  outline: none;
}

.form-textarea {
  resize: vertical;
  line-height: 1.6;
}

.form-input:focus,
.form-textarea:focus {
  border-color: rgb(14 165 233);
  background: white;
}

.dark .form-input,
.dark .form-textarea {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.dark .form-input:focus,
.dark .form-textarea:focus {
  background: rgb(2 6 23);
}

.copy-field {
  display: flex;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
}

.copy-field input {
  min-width: 0;
  flex: 1;
  background: transparent;
  padding: 0.625rem 0.75rem;
  font-size: 0.75rem;
  color: rgb(71 85 105);
  outline: none;
}

.dark .copy-field {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.dark .copy-field input {
  color: rgb(203 213 225);
}

.info-line,
.prompt-preview,
.test-box,
.playground-reply,
.payload-result,
.mini-metric,
.readiness-band,
.diagnostic-card {
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.dark .info-line,
.dark .prompt-preview,
.dark .test-box,
.dark .playground-reply,
.dark .payload-result,
.dark .mini-metric,
.dark .readiness-band,
.dark .diagnostic-card {
  border-color: rgb(30 41 59);
}

.info-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem;
}

.info-label {
  font-size: 0.75rem;
  color: rgb(100 116 139);
}

.info-value {
  min-width: 0;
  max-width: 100%;
  font-size: 0.75rem;
  font-weight: 900;
  color: rgb(15 23 42);
}

.dark .info-value {
  color: white;
}

.prompt-preview,
.test-box,
.playground-reply,
.payload-result {
  background: rgb(248 250 252);
  padding: 0.75rem;
}

.dark .prompt-preview,
.dark .test-box,
.dark .playground-reply,
.dark .payload-result {
  background: rgb(15 23 42);
}

.mini-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 900;
  color: rgb(2 132 199);
}

.mini-link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.message-head {
  align-items: flex-start;
  flex-wrap: wrap;
}

.message-tools {
  display: flex;
  min-width: min(100%, 34rem);
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.message-status-switch {
  flex: 1 1 18rem;
}

.message-status-switch button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.status-count {
  min-width: 1rem;
  border-radius: 999px;
  background: rgb(226 232 240);
  padding: 0.05rem 0.3rem;
  font-size: 0.6rem;
  line-height: 1.2;
  color: rgb(71 85 105);
}

.category-switch button.active .status-count {
  background: rgb(15 23 42);
  color: white;
}

.log-search {
  display: flex;
  min-height: 2rem;
  min-width: 12rem;
  flex: 1 1 12rem;
  overflow: hidden;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
  background: rgb(248 250 252);
}

.log-search input {
  min-width: 0;
  flex: 1;
  background: transparent;
  padding: 0 0.625rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(51 65 85);
  outline: none;
}

.log-search button {
  display: inline-flex;
  width: 2rem;
  align-items: center;
  justify-content: center;
  color: rgb(100 116 139);
}

.dark .status-count {
  background: rgb(30 41 59);
  color: rgb(203 213 225);
}

.dark .category-switch button.active .status-count {
  background: white;
  color: rgb(15 23 42);
}

.dark .log-search {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
}

.dark .log-search input,
.dark .log-search button {
  color: rgb(226 232 240);
}

.scenario-chip {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgb(226 232 240);
  border-radius: 999px;
  background: white;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 900;
  color: rgb(51 65 85);
}

.scenario-chip:hover {
  border-color: rgb(14 165 233);
  color: rgb(2 132 199);
}

.dark .scenario-chip {
  border-color: rgb(30 41 59);
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.mini-metric {
  background: rgb(248 250 252);
  padding: 0.75rem;
}

.mini-metric span {
  display: block;
  font-size: 0.6875rem;
  font-weight: 800;
  color: rgb(100 116 139);
}

.mini-metric strong {
  margin-top: 0.25rem;
  display: block;
  font-size: 1rem;
  color: rgb(15 23 42);
}

.dark .mini-metric {
  background: rgb(15 23 42);
}

.dark .mini-metric strong {
  color: white;
}

.payload-result p {
  font-size: 0.75rem;
  line-height: 1.7;
  color: rgb(71 85 105);
}

.dark .payload-result p {
  color: rgb(203 213 225);
}

.template-card {
  padding: 0.875rem;
}

.readiness-band {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  background: rgb(248 250 252);
  padding: 0.875rem;
}

.dark .readiness-band {
  background: rgb(15 23 42);
}

.readiness-meter {
  height: 0.875rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(226 232 240);
}

.readiness-meter div {
  height: 100%;
  border-radius: 999px;
  background: rgb(16 185 129);
}

.diagnostic-card {
  padding: 0.75rem;
}

.diagnostic-pass {
  background: rgb(240 253 244);
  color: rgb(6 95 70);
}

.diagnostic-warn {
  background: rgb(255 251 235);
  color: rgb(146 64 14);
}

.diagnostic-fail {
  background: rgb(255 241 242);
  color: rgb(159 18 57);
}

.dark .diagnostic-pass,
.dark .diagnostic-warn,
.dark .diagnostic-fail {
  background: rgb(15 23 42);
  color: rgb(226 232 240);
}

.empty-state,
.empty-state-sm {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-state {
  min-height: 12rem;
  padding: 1rem;
}

.empty-state-sm {
  min-height: 7rem;
  padding: 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: rgb(100 116 139);
}

.line-clamp-2,
.line-clamp-3,
.line-clamp-4 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  -webkit-line-clamp: 2;
}

.line-clamp-3 {
  -webkit-line-clamp: 3;
}

.line-clamp-4 {
  -webkit-line-clamp: 4;
}

@media (max-width: 767px) {
  .ai-workbench {
    min-height: 100%;
  }

  .top-shell {
    position: static;
  }

  .top-shell > div {
    gap: 0.5rem;
    padding: 0.625rem 0.75rem 0.5rem !important;
  }

  .brand-mark {
    height: 2rem;
    width: 2rem;
  }

  .top-shell h1 {
    font-size: 1rem;
  }

  .top-shell h1 + p {
    display: none;
  }

  .pulse-pill {
    min-height: 1.75rem;
    padding: 0 0.5rem;
    font-size: 0.625rem;
  }

  .range-switch button,
  .category-switch button {
    min-height: 1.625rem;
    padding: 0 0.45rem;
    font-size: 0.625rem;
  }

  .metric-block {
    min-height: 3rem;
    gap: 0.45rem;
    padding: 0.45rem 0.5rem;
  }

  .metric-icon {
    height: 1.5rem;
    width: 1.5rem;
    border-radius: 7px;
  }

  .metric-label {
    font-size: 0.6rem;
  }

  .metric-value {
    margin-top: 0;
    font-size: 0.78rem;
  }

  .tab-rail button {
    min-height: 2rem;
    padding: 0 0.55rem;
    font-size: 0.6875rem;
  }

  .ai-workbench main {
    padding: 0.625rem 0.75rem !important;
  }

  .lock-band,
  .reply-band,
  .readiness-band {
    align-items: flex-start;
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .primary-btn,
  .secondary-btn {
    min-height: 2.25rem;
  }

  .timeline-chart {
    min-height: 9rem;
    overflow-x: auto;
  }

  .timeline-bar-wrap {
    min-width: 2.25rem;
  }
}
</style>
