<script setup lang="ts">
import { computed } from 'vue';
import {
  BookOpen,
  RefreshCw,
  Plus,
  Database,
  PauseCircle,
  PlayCircle,
  Settings,
  ExternalLink,
  Trash2,
  Rocket,
  ClipboardCheck,
  FileText,
  Copy,
  ClipboardList,
  ShieldCheck,
  Bot,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import type {
  AiBotIntegration,
  AiBotKnowledgeSource,
  AiBotKnowledgeSummary,
  AiBotIntegrationRunbook,
} from '../../aiRobotAccessModel';

const props = defineProps<{
  selectedIntegration: AiBotIntegration | null;
  knowledgeSources: AiBotKnowledgeSource[];
  knowledgeSummary: AiBotKnowledgeSummary | null;
  isKnowledgeLoading: boolean;
  runbook: AiBotIntegrationRunbook | null;
  isRunbookLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'fetch-knowledge'): void;
  (e: 'create-knowledge'): void;
  (e: 'toggle-knowledge-status', source: AiBotKnowledgeSource): void;
  (e: 'edit-knowledge', source: AiBotKnowledgeSource): void;
  (e: 'delete-knowledge', source: AiBotKnowledgeSource): void;
  (e: 'change-tab', tab: string): void;
  (e: 'fetch-runbook'): void;
}>();

const knowledgeCoverageLabel = computed(() => {
  if (!props.knowledgeSummary?.sourceCount) return '未沉淀';
  return `${props.knowledgeSummary.activeCount}/${props.knowledgeSummary.sourceCount} 启用`;
});

const activeKnowledgeSources = computed(() =>
  props.knowledgeSources.filter((source) => source.status === 'ACTIVE'),
);

const runbookTodoCount = computed(
  () =>
    [
      ...(props.runbook?.rolloutPlan || []),
      ...(props.runbook?.testMatrix || []),
      ...(props.runbook?.checklist || []),
    ].filter((item) => item.status !== 'pass').length,
);

const formatDate = (value?: string | null) => {
  if (!value) return '尚未使用';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getKnowledgeStatusClass = (status: string) => {
  if (status === 'ACTIVE') return 'status-success';
  if (status === 'DRAFT') return 'status-processing';
  return 'status-muted';
};

const getKnowledgeStatusText = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '启用',
    DRAFT: '草稿',
    PAUSED: '暂停',
  };
  return map[status] || status;
};

const getKnowledgeTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    FAQ: 'FAQ',
    DOC: '文档',
    URL: '外链',
    POLICY: '规则',
    PROJECT: '项目',
    SUPPORT: '客服',
  };
  return map[type] || type;
};

const getRunbookStatusClass = (status: string) => {
  if (status === 'pass') return 'diagnostic-pass';
  if (status === 'warn') return 'diagnostic-warn';
  return 'diagnostic-fail';
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
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <BookOpen class="h-4 w-4 text-emerald-500" />
            <span>知识库</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="count-pill">{{ selectedIntegration?.name || '未选择接入' }}</span>
            <button
              type="button"
              class="secondary-btn"
              :disabled="!selectedIntegration || isKnowledgeLoading"
              @click="emit('fetch-knowledge')"
            >
              <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isKnowledgeLoading }" />
              <span>刷新</span>
            </button>
            <button
              type="button"
              class="primary-btn"
              :disabled="!selectedIntegration"
              @click="emit('create-knowledge')"
            >
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
                    <span class="status-pill" :class="getKnowledgeStatusClass(source.status)">{{
                      getKnowledgeStatusText(source.status)
                    }}</span>
                    <span class="status-pill status-muted">{{
                      getKnowledgeTypeLabel(source.sourceType)
                    }}</span>
                    <span class="count-pill">P{{ source.priority }}</span>
                  </div>
                  <h2 class="mt-2 line-clamp-2 text-sm font-black text-slate-950 dark:text-white">
                    {{ source.title }}
                  </h2>
                  <p
                    class="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
                  >
                    {{ source.content }}
                  </p>
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
                <button
                  type="button"
                  class="secondary-btn"
                  @click="emit('toggle-knowledge-status', source)"
                >
                  <PauseCircle v-if="source.status === 'ACTIVE'" class="h-4 w-4" />
                  <PlayCircle v-else class="h-4 w-4" />
                  <span>{{ source.status === 'ACTIVE' ? '暂停' : '启用' }}</span>
                </button>
                <button type="button" class="secondary-btn" @click="emit('edit-knowledge', source)">
                  <Settings class="h-4 w-4" />
                  <span>编辑</span>
                </button>
                <button
                  v-if="source.url"
                  type="button"
                  class="secondary-btn"
                  @click="copyText(source.url || '', '知识链接')"
                >
                  <ExternalLink class="h-4 w-4" />
                  <span>链接</span>
                </button>
                <el-tooltip content="删除知识源" placement="top">
                  <button
                    type="button"
                    class="danger-icon-btn"
                    @click="emit('delete-knowledge', source)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </el-tooltip>
              </div>
            </article>
          </div>

          <div v-else class="empty-state min-h-[18rem]">
            <Database class="h-12 w-12 text-slate-300 dark:text-slate-700" />
            <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">还没有知识源</h2>
            <button type="button" class="mt-5 primary-btn" @click="emit('create-knowledge')">
              <Plus class="h-4 w-4" />
              <span>添加第一条知识</span>
            </button>
          </div>
        </div>

        <div v-else class="empty-state min-h-[22rem]">
          <Bot class="h-12 w-12 text-slate-300 dark:text-slate-700" />
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
    </div>

    <aside class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <Rocket class="h-4 w-4 text-rose-500" />
            <span>发布手册</span>
          </div>
          <button
            type="button"
            class="secondary-btn"
            :disabled="!selectedIntegration || isRunbookLoading"
            @click="emit('fetch-runbook')"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isRunbookLoading }" />
            <span>生成</span>
          </button>
        </div>
        <div v-if="runbook" class="space-y-3 p-3">
          <div class="readiness-band">
            <div>
              <p class="text-xs font-bold text-slate-500 dark:text-slate-400">发布就绪度</p>
              <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">
                {{ runbook.readinessScore }}%
              </p>
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
          <article
            v-for="item in runbook.rolloutPlan"
            :key="item.id"
            class="runbook-row"
            :class="getRunbookStatusClass(item.status)"
          >
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
              <p class="text-xs font-black text-slate-800 dark:text-slate-100">
                {{ sample.label }}
              </p>
              <button
                type="button"
                class="icon-btn-small"
                @click="copyText(sample.command, sample.label)"
              >
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
          <article
            v-for="item in runbook.testMatrix"
            :key="item.id"
            class="runbook-row"
            :class="getRunbookStatusClass(item.status)"
          >
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
</template>
