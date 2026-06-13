export type TabKey =
  | 'overview'
  | 'operations'
  | 'integrations'
  | 'knowledge'
  | 'evolution'
  | 'playground'
  | 'templates'
  | 'diagnostics';
export type CheckStatus = 'pass' | 'warn' | 'fail';
export type SignalLevel = 'healthy' | 'warning' | 'critical';

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

export interface AiBotIntegration {
  id: string;
  name: string;
  platform: string;
  platformLabel: string;
  status: 'ACTIVE' | 'PAUSED';
  hasWebhookUrl: boolean;
  webhookUrlMasked?: string | null;
  hasSecret: boolean;
  publicToken: string;
  callbackPath: string;
  callbackUrl?: string;
  triggerKeywords: string[];
  systemPrompt?: string | null;
  responseMode?: string;
  aiModelId?: string | null;
  aiModelLabel?: string | null;
  aiModelProvider?: string | null;
  aiModelName?: string | null;
  aiTemperature?: number | null;
  aiMaxTokens?: number | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiBotMessage {
  id: string;
  platform: string;
  externalUserId?: string | null;
  externalConversationId?: string | null;
  inboundText: string;
  outboundText?: string | null;
  status: string;
  error?: string | null;
  inputChars: number;
  outputChars: number;
  createdAt: string;
}

export interface AiBotMessagesResponse {
  data: AiBotMessage[];
  total: number;
  limit: number;
  summary: Record<string, number>;
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
  lastUsedAt?: string | null;
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
  lastMessageAt?: string | null;
  lastUsedAt?: string | null;
}

export interface AiBotQualitySignal {
  key: string;
  label: string;
  value: number;
  level: SignalLevel;
  description: string;
  action: string;
}

export interface AiBotRecentFailure {
  id: string;
  integrationId: string;
  integrationName: string;
  platform: string;
  status: string;
  error?: string | null;
  inboundText: string;
  createdAt: string;
}

export interface AiBotAnalytics {
  range: {
    days: number;
    since: string;
    until: string;
  };
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

export interface AiBotTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  platform: string;
  triggerKeywords: string[];
  systemPrompt: string;
  samplePrompt: string;
  qualityChecks: string[];
}

export interface AiBotDiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action: string;
}

export interface AiBotDiagnostics {
  integrationId: string;
  generatedAt: string;
  readinessScore: number;
  checks: AiBotDiagnosticCheck[];
  recentFailures: AiBotRecentFailure[];
  recommendedActions: string[];
}

export interface AiBotKnowledgeSummary {
  sourceCount: number;
  activeCount: number;
  draftCount: number;
  pausedCount: number;
  totalTokenEstimate: number;
  coverageScore: number;
  lastUpdatedAt?: string | null;
}

export interface AiBotKnowledgeSource {
  id: string;
  integrationId: string;
  title: string;
  sourceType: 'FAQ' | 'DOC' | 'URL' | 'POLICY' | 'PROJECT' | 'SUPPORT';
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED';
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  content: string;
  url?: string | null;
  tags: string[];
  priority: number;
  tokenEstimate: number;
  lastIndexedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiBotKnowledgeSourceForm {
  title: string;
  sourceType: AiBotKnowledgeSource['sourceType'];
  status: AiBotKnowledgeSource['status'];
  visibility: AiBotKnowledgeSource['visibility'];
  content: string;
  url: string;
  tags: string;
  priority: number;
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
  generatedAt: string;
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
    level: SignalLevel;
    description: string;
  }>;
}

export interface AiBotRunbookItem {
  id: string;
  label: string;
  status: CheckStatus;
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
  generatedAt: string;
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
  lastSeenAt?: string | null;
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
  generatedAt: string;
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
    outboundText?: string | null;
    status: string;
    createdAt: string;
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
  status: CheckStatus;
  detail: string;
}

export interface AiBotEvaluationCaseResult {
  id: string;
  name: string;
  prompt: string;
  reply: string;
  score: number;
  status: CheckStatus;
  latencyMs: number;
  inputChars: number;
  outputChars: number;
  checks: AiBotEvaluationCheck[];
  suggestions: string[];
}

export interface AiBotEvaluationReport {
  integrationId: string;
  generatedAt: string;
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

export interface AiBotPromptOptimizationResult {
  systemPrompt: string;
  triggerKeywords: string[];
  testCases: AiBotEvaluationCaseInput[];
  riskControls: string[];
  launchChecklist: string[];
  reasoningSummary: string;
}

export interface PayloadPreview {
  incoming: {
    text: string;
    externalUserId?: string | null;
    externalConversationId?: string | null;
  };
  shouldAnswer: boolean;
  matchedKeywords: string[];
  inputChars: number;
}

export interface AiBotModelOption {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  enabled: boolean;
  isDefault: boolean;
  description?: string;
  capabilities: string[];
}

export interface AiBotIntegrationForm {
  name: string;
  platform: string;
  status: AiBotIntegration['status'];
  webhookUrl: string;
  secret: string;
  responseMode: string;
  aiModelId: string;
  aiTemperature: number | null;
  aiMaxTokens: number | null;
  triggerKeywords: string;
  systemPrompt: string;
  clearWebhookUrl: boolean;
  clearSecret: boolean;
}
