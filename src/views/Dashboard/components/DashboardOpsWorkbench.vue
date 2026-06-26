<script setup lang="ts">
import { computed } from 'vue';
import {
  Gauge,
  CheckCircle2,
  ShieldCheck,
  Inbox,
  BarChart3,
  Box,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import type { WorkbenchData } from '../types';

const props = defineProps<{
  workbench: WorkbenchData | null;
  isLoading: boolean;
  workbenchError: string;
  commandHeadline: string;
  momentumScore: number;
  taskSummary: {
    total: number;
    done: number;
    overdue: number;
    completionRate: number;
  };
  contentSummary: {
    total: number;
    assets: number;
    approvedAssets: number;
    pendingAssets: number;
    materials: number;
    showcases: number;
    plugins: number;
    notes: number;
  };
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();

const opsMetrics = computed(() => [
  {
    label: '动量分',
    value: props.momentumScore,
    detail: props.workbench?.command.productivityTrend || '0',
    icon: Gauge,
    tone: 'ops-blue',
  },
  {
    label: '任务闭环',
    value: `${props.taskSummary.completionRate}%`,
    detail: `${props.taskSummary.done}/${props.taskSummary.total}`,
    icon: CheckCircle2,
    tone: props.taskSummary.overdue > 0 ? 'ops-red' : 'ops-green',
  },
  {
    label: '内容通过',
    value: `${props.workbench?.command.contentApprovalRate ?? 100}%`,
    detail: `${props.contentSummary.pendingAssets} 审核中`,
    icon: ShieldCheck,
    tone: 'ops-amber',
  },
  {
    label: '协作负载',
    value: props.workbench?.command.collaborationLoad ?? 0,
    detail: `${props.workbench?.collaboration.unreadMessages ?? 0} 私信`,
    icon: Inbox,
    tone: 'ops-purple',
  },
]);

const trendMax = computed(() =>
  Math.max(1, ...(props.workbench?.trend.map((item) => item.total) || [])),
);

const trendBars = computed(() =>
  (props.workbench?.trend || []).map((item) => ({
    ...item,
    height: Math.max(10, Math.round((item.total / trendMax.value) * 100)),
    label: new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
  })),
);

const contentPipeline = computed(() => [
  { label: '资产', value: props.contentSummary.assets, route: '/assets', tone: 'pipe-blue' },
  { label: '材质', value: props.contentSummary.materials, route: '/materials', tone: 'pipe-green' },
  { label: '作品', value: props.contentSummary.showcases, route: '/showcase', tone: 'pipe-amber' },
  { label: '插件', value: props.contentSummary.plugins, route: '/plugins', tone: 'pipe-purple' },
  { label: '笔记', value: props.contentSummary.notes, route: '/notes', tone: 'pipe-slate' },
]);

const focusQueue = computed(() => props.workbench?.focusQueue.slice(0, 4) || []);
const smartActions = computed(() => props.workbench?.smartActions.slice(0, 4) || []);

function getSeverityClass(severity: string) {
  if (severity === 'danger') return 'risk-danger';
  if (severity === 'warning') return 'risk-warning';
  if (severity === 'notice') return 'risk-notice';
  return 'risk-info';
}
</script>

<template>
  <Card hoverable glow glass class="ops-workbench shadow-md" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>全局运营工作台</h3>
        <p>{{ commandHeadline }}</p>
      </div>
      <Gauge class="h-4.5 w-4.5 text-accent opacity-70" />
    </div>

    <div class="ops-workbench-grid">
      <!-- Column 1: Summary -->
      <div class="ops-summary">
        <div class="ops-metrics">
          <div
            v-for="metric in opsMetrics"
            :key="metric.label"
            class="ops-metric border border-base"
            :class="metric.tone"
          >
            <component :is="metric.icon" class="h-4 w-4" />
            <span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.label }} · {{ metric.detail }}</small>
            </span>
          </div>
        </div>
      </div>

      <!-- Column 2: 14 Day Chart -->
      <div class="ops-chart">
        <div class="panel-line">
          <span><BarChart3 class="h-3.5 w-3.5" />14 天活跃曲线</span>
          <small>学习 / 任务 / 内容 / 社区</small>
        </div>
        <div v-if="trendBars.length" class="ops-bars">
          <span
            v-for="bar in trendBars"
            :key="bar.date"
            class="ops-bar"
            :title="`${bar.label}: ${bar.total}`"
          >
            <i :style="{ height: `${bar.height}%` }">
              <b class="bar-learning" :style="{ flex: bar.learning || 0.15 }"></b>
              <b class="bar-tasks" :style="{ flex: bar.tasks || 0.15 }"></b>
              <b class="bar-content" :style="{ flex: bar.content || 0.15 }"></b>
              <b class="bar-community" :style="{ flex: bar.community || 0.15 }"></b>
            </i>
            <em>{{ bar.label }}</em>
          </span>
        </div>
        <div v-else class="empty-line text-xs font-semibold text-slate-400">
          {{ isLoading ? '正在生成趋势...' : workbenchError || '暂无趋势数据' }}
        </div>
      </div>

      <!-- Column 3: Pipeline -->
      <div class="ops-pipeline">
        <div class="panel-line">
          <span><Box class="h-3.5 w-3.5" />内容生产线</span>
          <small>{{ workbench?.signals.tagCoverage ?? 0 }} 标签覆盖</small>
        </div>
        <div class="pipe-grid">
          <button
            v-for="pipe in contentPipeline"
            :key="pipe.label"
            type="button"
            class="pipe-chip border border-base bg-card hover:border-accent/30 rounded-lg transition-all duration-200"
            :class="pipe.tone"
            @click="emit('navigate', pipe.route)"
          >
            <strong>{{ pipe.value }}</strong>
            <small>{{ pipe.label }}</small>
          </button>
        </div>
      </div>

      <!-- Column 4: Risks -->
      <div class="ops-risks">
        <div class="panel-line">
          <span><AlertTriangle class="h-3.5 w-3.5" />风险与建议</span>
          <small>{{ focusQueue.length }} 风险</small>
        </div>
        <button
          v-for="item in focusQueue"
          :key="item.id"
          type="button"
          class="risk-row hover:border-red-500/30 hover:bg-red-500/5 transition-all duration-200"
          :class="getSeverityClass(item.severity)"
          @click="emit('navigate', item.route)"
        >
          <strong>{{ item.metric }}</strong>
          <span>
            <b>{{ item.title }}</b>
            <small>{{ item.detail }}</small>
          </span>
        </button>
        <button
          v-for="action in smartActions"
          :key="action.id"
          type="button"
          class="smart-row hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-200"
          @click="emit('navigate', action.route)"
        >
          <Sparkles class="h-3.5 w-3.5" />
          <span>
            <b>{{ action.title }}</b>
            <small>{{ action.impact }}</small>
          </span>
          <ArrowRight class="h-3.5 w-3.5 ml-auto text-amber-500/60" />
        </button>
        <div
          v-if="!focusQueue.length && !smartActions.length"
          class="safe-line border border-dashed border-base"
        >
          <ShieldCheck class="h-4 w-4 text-emerald-500 mr-1" />
          <span class="text-xs font-semibold text-slate-400">系统运行良好，暂无风险</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.ops-workbench {
  display: flex;
  flex-direction: column;
}

.dashboard-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.dashboard-panel-header h3 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.dashboard-panel-header p {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 2px 0 0;
}

.ops-workbench-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 16px;
}

.ops-summary,
.ops-chart,
.ops-pipeline,
.ops-risks {
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-subtle) 40%, var(--bg-card) 60%);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ops-metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.ops-metric {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  border-radius: 10px;
  padding: 10px;
}

.ops-metric span {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.ops-metric strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
}

.ops-metric small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.ops-blue {
  background: rgba(37, 99, 235, 0.05);
  color: #2563eb;
}
.ops-green {
  background: rgba(5, 150, 105, 0.05);
  color: #059669;
}
.ops-red {
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}
.ops-amber {
  background: rgba(217, 119, 6, 0.06);
  color: #d97706;
}
.ops-purple {
  background: rgba(124, 58, 237, 0.05);
  color: #7c3aed;
}

.panel-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-line span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
}

.panel-line small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.ops-bars {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 4px;
  height: 120px;
  padding-top: 8px;
}

.ops-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ops-bar i {
  width: 8px;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
  border-radius: 4px;
  background: var(--bg-hover);
  overflow: hidden;
}

.ops-bar b {
  display: block;
  min-height: 2px;
}

.bar-learning {
  background: #2563eb;
}
.bar-tasks {
  background: #d97706;
}
.bar-content {
  background: #059669;
}
.bar-community {
  background: #db2777;
}

.ops-bar em {
  font-size: 8px;
  font-style: normal;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
}

.pipe-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pipe-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 8px 4px;
  text-align: center;
}

.pipe-chip strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.pipe-chip small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.pipe-blue {
  background: rgba(37, 99, 235, 0.05);
}
.pipe-green {
  background: rgba(5, 150, 105, 0.05);
}
.pipe-amber {
  background: rgba(217, 119, 6, 0.06);
}
.pipe-purple {
  background: rgba(124, 58, 237, 0.05);
}
.pipe-slate {
  background: rgba(100, 116, 139, 0.05);
}

.ops-risks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-row,
.smart-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.risk-row:hover,
.smart-row:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.risk-row strong {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.risk-row span,
.smart-row span {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.risk-row b,
.smart-row b {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-row small,
.smart-row small {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-danger strong {
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}
.risk-warning strong {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.risk-notice strong {
  background: rgba(8, 145, 178, 0.08);
  color: #0891b2;
}
.risk-info strong {
  background: rgba(100, 116, 139, 0.08);
  color: var(--text-secondary);
}

.smart-row {
  color: #d97706;
}

.safe-line,
.empty-line {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--bg-subtle);
}

@media (max-width: 1200px) {
  .ops-workbench-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ops-workbench-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .ops-workbench-grid.ops-workbench-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>
