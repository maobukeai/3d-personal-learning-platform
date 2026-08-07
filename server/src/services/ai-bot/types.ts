import { AppError } from '../../utils/error';
import {
  SUPPORTED_PLATFORMS,
  SUPPORTED_KNOWLEDGE_TYPES,
  SUPPORTED_KNOWLEDGE_STATUSES,
  SUPPORTED_KNOWLEDGE_VISIBILITY,
  AI_BOT_RESPONSE_MODE,
  AI_BOT_MESSAGE_STATUS,
  platformLabels,
} from './bot-constants';

export * from './bot-constants';

export type AiBotPlatform = (typeof SUPPORTED_PLATFORMS)[number];
export type AiBotResponseMode = (typeof AI_BOT_RESPONSE_MODE)[keyof typeof AI_BOT_RESPONSE_MODE];
export type AiBotMessageStatus = (typeof AI_BOT_MESSAGE_STATUS)[keyof typeof AI_BOT_MESSAGE_STATUS];
export type AiBotKnowledgeSourceType = (typeof SUPPORTED_KNOWLEDGE_TYPES)[number];
export type AiBotKnowledgeStatus = (typeof SUPPORTED_KNOWLEDGE_STATUSES)[number];
export type AiBotKnowledgeVisibility = (typeof SUPPORTED_KNOWLEDGE_VISIBILITY)[number];

export interface AiBotEntitlement {
  enabled: boolean;
  requiredPlanPriority: number;
  requiredPlanName: string;
  currentPlanPriority: number;
  currentPlanName: string;
  maxIntegrations: number;
  dailyMessages: number;
  integrationCount: number;
  dailyMessageCount: number;
}

export interface PublicAiBotKnowledgeSource {
  id: string;
  integrationId: string;
  title: string;
  sourceType: AiBotKnowledgeSourceType;
  status: AiBotKnowledgeStatus;
  visibility: AiBotKnowledgeVisibility;
  content: string;
  url: string | null;
  tags: string[];
  priority: number;
  tokenEstimate: number;
  lastIndexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiBotKnowledgeSummary {
  sourceCount: number;
  activeCount: number;
  draftCount: number;
  pausedCount: number;
  totalTokenEstimate: number;
  coverageScore: number;
  lastUpdatedAt: Date | null;
}

export interface IncomingAiBotMessage {
  text: string;
  externalUserId?: string | null;
  externalConversationId?: string | null;
}

export interface AiBotSendResult {
  delivered: boolean;
  skipped: boolean;
  chunks: number;
  message?: string;
}

export interface AiBotProcessResult {
  reply: string;
  sendResult: AiBotSendResult;
  logId: string;
}

export interface AiBotPromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  platform: AiBotPlatform | 'ALL';
  triggerKeywords: string[];
  systemPrompt: string;
  samplePrompt: string;
  qualityChecks: string[];
}

export interface AiBotAnalyticsRange {
  days: number;
  since: Date;
  until: Date;
}

export interface AiBotTimelinePoint {
  date: string;
  label: string;
  total: number;
  success: number;
  failed: number;
  ignored: number;
  inputChars: number;
  outputChars: number;
}

export interface AiBotPlatformMetric {
  platform: string;
  platformLabel: string;
  integrationCount: number;
  activeCount: number;
  messageCount: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  lastUsedAt: Date | null;
}

export interface AiBotIntegrationMetric {
  id: string;
  name: string;
  platform: string;
  platformLabel: string;
  status: string;
  messageCount: number;
  successCount: number;
  failedCount: number;
  ignoredCount: number;
  successRate: number;
  inputChars: number;
  outputChars: number;
  lastMessageAt: Date | null;
  lastUsedAt: Date | null;
}

export interface AiBotQualitySignal {
  key: string;
  label: string;
  value: number;
  level: 'healthy' | 'warning' | 'critical';
  description: string;
  action: string;
}

export interface AiBotRecentFailure {
  id: string;
  integrationId: string;
  integrationName: string;
  platform: string;
  status: string;
  error: string | null;
  inboundText: string;
  createdAt: Date;
}

export interface AiBotAnalytics {
  range: AiBotAnalyticsRange;
  summary: {
    integrationCount: number;
    activeIntegrationCount: number;
    pausedIntegrationCount: number;
    messageCount: number;
    successCount: number;
    failedCount: number;
    ignoredCount: number;
    successRate: number;
    avgInputChars: number;
    avgOutputChars: number;
    dailyQuotaUsedPercent: number;
    automationScore: number;
    knowledgeSourceCount: number;
    activeKnowledgeSourceCount: number;
    knowledgeCoverage: number;
  };
  timeline: AiBotTimelinePoint[];
  platformMetrics: AiBotPlatformMetric[];
  topIntegrations: AiBotIntegrationMetric[];
  qualitySignals: AiBotQualitySignal[];
  recentFailures: AiBotRecentFailure[];
  nextBestActions: string[];
}

export interface AiBotDiagnosticCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  action: string;
}

export interface AiBotDiagnostics {
  integrationId: string;
  generatedAt: Date;
  readinessScore: number;
  checks: AiBotDiagnosticCheck[];
  recentFailures: AiBotRecentFailure[];
  recommendedActions: string[];
}

export interface AiBotPlaygroundResult {
  reply: string;
  logId: string;
  quality: {
    replyChars: number;
    inputChars: number;
    estimatedPushChunks: number;
    hasActionableStructure: boolean;
  };
  suggestions: string[];
}

export interface AiBotOperationAction {
  id: string;
  title: string;
  area: '接入' | '知识库' | '安全' | '质量' | '成本' | '增长';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'blocked' | 'attention' | 'ready' | 'done';
  impact: string;
  effort: string;
  description: string;
  cta: string;
  integrationId?: string;
  integrationName?: string;
}

export interface AiBotOperationsReport {
  generatedAt: Date;
  summary: {
    openActions: number;
    criticalActions: number;
    healthySignals: number;
    knowledgeSourceCount: number;
    activeKnowledgeSourceCount: number;
    projectedMonthlyMessages: number;
  };
  actions: AiBotOperationAction[];
  lanes: Array<{
    key: string;
    label: string;
    value: number;
    level: 'healthy' | 'warning' | 'critical';
    description: string;
  }>;
}

export interface AiBotRunbookItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  action: string;
}

export interface AiBotCommandSample {
  id: string;
  label: string;
  language: 'bash' | 'json' | 'text';
  command: string;
}

export interface AiBotIntegrationRunbook {
  integrationId: string;
  generatedAt: Date;
  readinessScore: number;
  checklist: AiBotRunbookItem[];
  knowledgeSummary: AiBotKnowledgeSummary;
  rolloutPlan: AiBotRunbookItem[];
  testMatrix: AiBotRunbookItem[];
  commandSamples: AiBotCommandSample[];
  guardrails: string[];
}

export interface AiBotIntentCluster {
  key: string;
  label: string;
  count: number;
  sharePercent: number;
  sampleText: string;
  lastSeenAt: Date | null;
}

export interface AiBotKnowledgeGap {
  key: string;
  label: string;
  count: number;
  evidence: string;
  action: string;
}

export interface AiBotEvolutionInsights {
  integrationId: string;
  generatedAt: Date;
  rangeDays: number;
  summary: {
    messageCount: number;
    successRate: number;
    failureRate: number;
    ignoredRate: number;
    uniqueUsers: number;
    activeConversations: number;
    avgInputChars: number;
    avgOutputChars: number;
    responseStructureRate: number;
    promptHealthScore: number;
  };
  intentClusters: AiBotIntentCluster[];
  riskWarnings: AiBotDiagnosticCheck[];
  knowledgeGaps: AiBotKnowledgeGap[];
  promptRecommendations: string[];
  sampleMessages: Array<{
    id: string;
    inboundText: string;
    outboundText: string | null;
    status: string;
    createdAt: Date;
  }>;
}

export interface AiBotEvaluationCaseInput {
  id?: string;
  name: string;
  prompt: string;
  expectedKeywords?: string[];
  mustAvoid?: string[];
  externalUserId?: string;
  externalConversationId?: string;
}

export interface AiBotEvaluationCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface AiBotEvaluationCaseResult {
  id: string;
  name: string;
  prompt: string;
  reply: string;
  score: number;
  status: 'pass' | 'warn' | 'fail';
  latencyMs: number;
  inputChars: number;
  outputChars: number;
  checks: AiBotEvaluationCheck[];
  suggestions: string[];
}

export interface AiBotEvaluationReport {
  integrationId: string;
  generatedAt: Date;
  overallScore: number;
  summary: {
    caseCount: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    averageLatencyMs: number;
  };
  cases: AiBotEvaluationCaseResult[];
  recommendedActions: string[];
}

export interface AiBotPromptOptimizationInput {
  mission: string;
  audience: string;
  tone: string;
  outputFormat: string;
  constraints: string;
  examples: string[];
  guardrails: string[];
}

export interface AiBotPromptOptimizationResult {
  systemPrompt: string;
  triggerKeywords: string[];
  testCases: AiBotEvaluationCaseInput[];
  riskControls: string[];
  launchChecklist: string[];
  reasoningSummary: string;
}

export type AnyRecord = Record<string, unknown>;

export const isAiBotPlatform = (value: string): value is AiBotPlatform =>
  SUPPORTED_PLATFORMS.includes(value as AiBotPlatform);

export const normalizeAiBotPlatform = (value: unknown): AiBotPlatform => {
  const platform = String(value || '')
    .trim()
    .toUpperCase();
  if (!isAiBotPlatform(platform)) {
    throw new AppError('不支持的机器人平台', 400, 'AI_BOT_PLATFORM_UNSUPPORTED');
  }
  return platform;
};

export const getAiBotPlatformLabel = (platform: string): string =>
  isAiBotPlatform(platform) ? platformLabels[platform] : platform;

export const getTodayStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};
