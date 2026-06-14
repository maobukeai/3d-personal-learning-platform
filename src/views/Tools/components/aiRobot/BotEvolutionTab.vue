<script setup lang="ts">
import { computed } from 'vue';
import {
  Brain,
  RefreshCw,
  Bot,
  Target,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ListChecks,
  FlaskConical,
  Plus,
  Trash2,
  Wand2,
  Sparkles,
  Save,
} from 'lucide-vue-next';
import type {
  AiBotIntegration,
  AiBotEvolutionInsights,
  AiBotEvaluationCaseInput,
  AiBotEvaluationReport,
  AiBotPromptOptimizationResult,
} from '../../aiRobotAccessModel';

interface PromptOptimizationForm {
  mission: string;
  audience: string;
  tone: string;
  outputFormat: string;
  constraints: string;
  examples: string;
  guardrails: string;
}

const props = defineProps<{
  selectedIntegration: AiBotIntegration | null;
  isEvolutionLoading: boolean;
  evolutionInsights: AiBotEvolutionInsights | null;
  evaluationCases: AiBotEvaluationCaseInput[];
  evaluationReport: AiBotEvaluationReport | null;
  isEvaluationRunning: boolean;
  isPromptOptimizing: boolean;
  promptOptimization: AiBotPromptOptimizationResult | null;
}>();

const optimizationForm = defineModel<PromptOptimizationForm>('optimizationForm', { required: true });

const emit = defineEmits<{
  (e: 'fetch-insights'): void;
  (e: 'add-case'): void;
  (e: 'remove-case', index: number): void;
  (
    e: 'update-keyword',
    payload: { index: number; key: 'expectedKeywords' | 'mustAvoid'; value: string },
  ): void;
  (e: 'run-evaluation'): void;
  (e: 'optimize-prompt'): void;
  (e: 'apply-optimized-prompt'): void;
  (e: 'change-tab', tab: string): void;
}>();

const evolutionSummary = computed(() => props.evolutionInsights?.summary || null);
const evolutionRiskCount = computed(() => props.evolutionInsights?.riskWarnings.length || 0);

const evaluationStatusLabel = computed(() => {
  if (!props.evaluationReport) return '未评测';
  return `${props.evaluationReport.summary.passCount}/${props.evaluationReport.summary.caseCount} 通过`;
});

const getDiagnosticClass = (status: string) => {
  if (status === 'pass') return 'diagnostic-pass';
  if (status === 'warn') return 'diagnostic-warn';
  return 'diagnostic-fail';
};
</script>

<template>
  <section class="space-y-3">
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
              <button
                type="button"
                class="secondary-btn"
                :disabled="!selectedIntegration || isEvolutionLoading"
                @click="emit('fetch-insights')"
              >
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
                <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">
                  {{ evolutionSummary?.promptHealthScore || 0 }}%
                </p>
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
                <div
                  v-if="evolutionInsights?.intentClusters.length"
                  class="divide-y divide-slate-100 dark:divide-slate-900"
                >
                  <article
                    v-for="cluster in evolutionInsights.intentClusters"
                    :key="cluster.key"
                    class="top-row"
                  >
                    <div class="min-w-0">
                      <p class="text-xs font-black text-slate-800 dark:text-slate-100">
                        {{ cluster.label }}
                      </p>
                      <p class="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {{ cluster.sampleText }}
                      </p>
                    </div>
                    <div class="min-w-[7rem]">
                      <div class="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{{ cluster.count }} 次</span>
                        <span>{{ cluster.sharePercent }}%</span>
                      </div>
                      <div class="progress-track mt-1.5">
                        <div
                          class="progress-fill progress-sky"
                          :style="{ width: cluster.sharePercent + '%' }"
                        ></div>
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
                  <div
                    v-for="risk in evolutionInsights?.riskWarnings || []"
                    :key="risk.id"
                    class="action-row"
                  >
                    <AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
                    <p>{{ risk.action }}</p>
                  </div>
                  <div
                    v-for="gap in evolutionInsights?.knowledgeGaps || []"
                    :key="gap.key"
                    class="action-row"
                  >
                    <BookOpen class="h-4 w-4 shrink-0 text-sky-500" />
                    <p>{{ gap.action }}</p>
                  </div>
                  <div
                    v-if="
                      !(
                        evolutionInsights?.riskWarnings.length ||
                        evolutionInsights?.knowledgeGaps.length
                      )
                    "
                    class="empty-state-sm"
                  >
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
                <div
                  v-for="recommendation in evolutionInsights?.promptRecommendations || []"
                  :key="recommendation"
                  class="action-row"
                >
                  <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                  <p>{{ recommendation }}</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state min-h-[20rem]">
            <Brain class="h-12 w-12 text-slate-300 dark:text-slate-700" />
            <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">
              先选择一个机器人接入
            </h2>
            <button
              type="button"
              class="mt-5 secondary-btn"
              @click="emit('change-tab', 'integrations')"
            >
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
              <button type="button" class="secondary-btn" @click="emit('add-case')">
                <Plus class="h-4 w-4" />
                <span>用例</span>
              </button>
              <button
                type="button"
                class="primary-btn"
                :disabled="!selectedIntegration || isEvaluationRunning"
                @click="emit('run-evaluation')"
              >
                <RefreshCw v-if="isEvaluationRunning" class="h-4 w-4 animate-spin" />
                <FlaskConical v-else class="h-4 w-4" />
                <span>{{ isEvaluationRunning ? '评测中' : '运行评测' }}</span>
              </button>
            </div>
          </div>

          <div class="space-y-3 p-3">
            <div class="grid gap-3 lg:grid-cols-3">
              <article
                v-for="(testCase, index) in evaluationCases"
                :key="testCase.id || index"
                class="eval-case"
              >
                <div class="flex items-start justify-between gap-2">
                  <input
                    v-model="testCase.name"
                    class="form-input mt-0 font-black"
                    placeholder="用例名称"
                  />
                  <button
                    type="button"
                    class="danger-icon-btn shrink-0"
                    @click="emit('remove-case', index)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  v-model="testCase.prompt"
                  class="form-textarea min-h-[6rem]"
                  placeholder="输入要测试的用户消息"
                ></textarea>
                <input
                  :value="(testCase.expectedKeywords || []).join('、')"
                  class="form-input"
                  placeholder="期望关键词，用逗号或换行分隔"
                  @input="
                    emit('update-keyword', {
                      index,
                      key: 'expectedKeywords',
                      value: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
                <input
                  :value="(testCase.mustAvoid || []).join('、')"
                  class="form-input"
                  placeholder="禁用词，用逗号或换行分隔"
                  @input="
                    emit('update-keyword', {
                      index,
                      key: 'mustAvoid',
                      value: ($event.target as HTMLInputElement).value,
                    })
                  "
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
                  <strong
                    >{{ Math.round(evaluationReport.summary.averageLatencyMs / 1000) }}s</strong
                  >
                </div>
              </div>

              <div class="grid gap-3 lg:grid-cols-2">
                <article
                  v-for="result in evaluationReport.cases"
                  :key="result.id"
                  class="diagnostic-card"
                  :class="getDiagnosticClass(result.status)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-black">{{ result.name }} · {{ result.score }}%</p>
                      <p class="mt-1 text-xs leading-relaxed opacity-80">{{ result.prompt }}</p>
                    </div>
                    <span class="count-pill">{{ result.outputChars }} 字</span>
                  </div>
                  <p
                    v-if="result.reply"
                    class="mt-3 whitespace-pre-wrap text-xs leading-relaxed opacity-90"
                  >
                    {{ result.reply }}
                  </p>
                  <div class="mt-3 space-y-1">
                    <p
                      v-for="check in result.checks"
                      :key="check.key"
                      class="text-[11px] font-bold opacity-80"
                    >
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
              <textarea
                v-model="optimizationForm.mission"
                class="form-textarea min-h-[5rem]"
              ></textarea>
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
              <textarea
                v-model="optimizationForm.constraints"
                class="form-textarea min-h-[5rem]"
              ></textarea>
            </div>
            <div>
              <label class="field-label">示例场景</label>
              <textarea
                v-model="optimizationForm.examples"
                class="form-textarea min-h-[5rem]"
              ></textarea>
            </div>
            <div>
              <label class="field-label">安全护栏</label>
              <textarea
                v-model="optimizationForm.guardrails"
                class="form-textarea min-h-[5rem]"
              ></textarea>
            </div>
            <button
              type="button"
              class="w-full primary-btn justify-center"
              :disabled="!selectedIntegration || isPromptOptimizing"
              @click="emit('optimize-prompt')"
            >
              <RefreshCw v-if="isPromptOptimizing" class="h-4 w-4 animate-spin" />
              <Wand2 class="h-4 w-4" />
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
            <button type="button" class="secondary-btn" @click="emit('apply-optimized-prompt')">
              <Save class="h-4 w-4" />
              <span>套用</span>
            </button>
          </div>
          <div class="space-y-3 p-3">
            <div class="prompt-preview">
              <p
                class="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {{ promptOptimization.systemPrompt }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="keyword in promptOptimization.triggerKeywords"
                :key="keyword"
                class="keyword-pill"
                >{{ keyword }}</span
              >
            </div>
            <div class="action-list !p-0">
              <div
                v-for="item in promptOptimization.launchChecklist"
                :key="item"
                class="action-row"
              >
                <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
                <p>{{ item }}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
