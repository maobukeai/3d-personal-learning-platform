<script setup lang="ts">
import { formatDateTime } from '@/utils/format';
import { computed, onMounted, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import {
  fetchManagementInsights,
  formatCompactNumber,
  getHealthClasses,
  getHealthLabel,
  isLoadingManagementInsights,
  managementInsights,
  managementInsightsError,
  type AdminCommandQueueItem,
  type AdminSlaItem,
  type AdminSystemSignal,
} from './adminManagementInsights';

type Tone = 'sky' | 'rose' | 'emerald' | 'amber' | 'violet';

const router = useRouter();

const commandCenter = computed(() => managementInsights.value?.commandCenter);
const overview = computed(() => managementInsights.value?.overview);
const command = computed(() => managementInsights.value?.command);
const actions = computed(() => managementInsights.value?.actions || []);
const primaryAction = computed(() => actions.value[0]);

const maxTrendValue = computed(() => {
  const points = commandCenter.value?.trend || [];
  return Math.max(
    1,
    ...points.flatMap((item) => [item.users, item.content, item.feedback, item.audit]),
  );
});

const totalQueue = computed(() => commandCenter.value?.queue.length || 0);
const urgentQueue = computed(
  () => commandCenter.value?.queue.filter((item) => item.severity === 'critical').length || 0,
);
const watchQueue = computed(
  () => commandCenter.value?.queue.filter((item) => item.severity === 'warning').length || 0,
);
const riskMix = computed(
  () => commandCenter.value?.riskMix || { critical: 0, warning: 0, info: 0 },
);

const statusSentence = computed(() => {
  if (!overview.value) return managementInsightsError.value || '正在加载后台运营数据';
  if (urgentQueue.value) return `${urgentQueue.value} 个高优先队列需要处理`;
  if (overview.value.issueCount) return `${overview.value.issueCount} 个运营信号需要复核`;
  return '后台运营状态稳定';
});

const healthDialStyle = computed(() => ({
  '--score': `${Math.min(100, Math.max(0, overview.value?.healthScore || 0))}%`,
}));

const kpiCards = computed<
  Array<{
    label: string;
    value: number;
    sub: string;
    icon: Component;
    tone: Tone;
    route?: string;
  }>
>(() => [
  {
    label: '待办队列',
    value: totalQueue.value,
    sub: `${urgentQueue.value} 个高优先`,
    icon: Workflow,
    tone: urgentQueue.value ? 'rose' : 'emerald',
    route: '/admin/audits',
  },
  {
    label: 'SLA 负载',
    value: command.value?.workloadTotal || 0,
    sub: '跨模块待处理',
    icon: Clock,
    tone: watchQueue.value ? 'amber' : 'emerald',
  },
  {
    label: '有效权益',
    value: overview.value?.activeEntitlements || 0,
    sub: '当前订阅用户',
    icon: ShieldCheck,
    tone: 'violet',
    route: '/admin/subscriptions',
  },
]);

const slaStatusMeta: Record<AdminSlaItem['status'], { label: string; class: string }> = {
  healthy: {
    label: '健康',
    class: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  watch: {
    label: '关注',
    class: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  breached: {
    label: '超时',
    class: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
};

const signalStatusMeta: Record<AdminSystemSignal['status'], { label: string; class: string }> = {
  healthy: slaStatusMeta.healthy,
  watch: slaStatusMeta.watch,
  breached: slaStatusMeta.breached,
};

const queueTypeMeta: Record<AdminCommandQueueItem['type'], { label: string; class: string }> = {
  feedback: { label: '反馈', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  audit: { label: '审核', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  team: { label: '团队', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  billing: { label: '商业', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  resource: { label: '资源', class: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
};

const severityMeta: Record<AdminCommandQueueItem['severity'], { label: string; class: string }> = {
  critical: {
    label: '高',
    class: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  warning: {
    label: '中',
    class: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  info: {
    label: '低',
    class: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
};

const progressWidth = (value: number, total: number) => {
  if (!total) return '0%';
  return `${Math.min(100, Math.max(0, Math.round((value / total) * 100)))}%`;
};

const barHeight = (value: number) => {
  if (!value) return '0%';
  return `${Math.max(8, Math.round((value / maxTrendValue.value) * 100))}%`;
};

const formatAge = (hours: number) => {
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
};

const openRoute = (route?: string) => {
  if (route) router.push(route);
};

onMounted(() => {
  fetchManagementInsights();
});

void Gauge;
void healthDialStyle.value;
</script>

<template>
  <div class="admin-command-center">
    <header class="command-header">
      <div class="command-title">
        <span class="panel-icon tone-sky">
          <SlidersHorizontal class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <div class="title-row">
            <h1>管理指挥中心</h1>
            <span
              v-if="overview"
              class="health-badge"
              :class="getHealthClasses(overview.healthScore)"
            >
              {{ overview.healthScore }} / {{ getHealthLabel(overview.healthScore) }}
            </span>
          </div>
          <p>统一调度 SLA、风险队列、系统信号和运营动作</p>
        </div>
      </div>

      <div class="command-actions">
        <button type="button" class="secondary-button" @click="router.push('/admin/audit-logs')">
          <BarChart3 class="h-4 w-4" />
          <span>审计日志</span>
        </button>
        <button type="button" class="secondary-button" @click="router.push('/admin/settings')">
          <Settings2 class="h-4 w-4" />
          <span>系统设置</span>
        </button>
        <button
          type="button"
          class="primary-button"
          :disabled="isLoadingManagementInsights"
          @click="fetchManagementInsights(true)"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoadingManagementInsights }" />
          <span>刷新</span>
        </button>
      </div>
    </header>

    <main class="command-main">
      <section class="overview-grid">
        <div class="overview-card status-card">
          <div class="health-dial">
            <svg class="health-ring" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="healthGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="var(--accent)" />
                  <stop offset="100%" stop-color="color-mix(in srgb, var(--accent) 70%, #10b981)" />
                </linearGradient>
              </defs>
              <circle class="ring-bg" cx="50" cy="50" r="42" fill="transparent" stroke-width="7" />
              <circle
                class="ring-progress"
                cx="50"
                cy="50"
                r="42"
                fill="transparent"
                stroke="url(#healthGrad)"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="263.89"
                :stroke-dashoffset="
                  263.89 - (263.89 * Math.min(100, Math.max(0, overview?.healthScore || 0))) / 100
                "
              />
            </svg>
            <div class="dial-content">
              <strong>{{ overview?.healthScore || 0 }}</strong>
              <span>{{ overview ? getHealthLabel(overview.healthScore) : '加载中' }}</span>
            </div>
          </div>
          <div class="overview-copy">
            <div class="eyebrow">
              <Activity class="h-3.5 w-3.5" />
              <span>后台运营态势</span>
            </div>
            <h2>{{ statusSentence }}</h2>
            <p>
              {{ overview?.issueCount || 0 }} 个风险信号，{{ command?.workloadTotal || 0 }}
              个待处理负载
            </p>
            <div class="risk-strip" aria-label="风险分布">
              <span class="risk-critical">高 {{ riskMix.critical }}</span>
              <span class="risk-warning">中 {{ riskMix.warning }}</span>
              <span class="risk-info">低 {{ riskMix.info }}</span>
            </div>
          </div>
        </div>

        <div class="overview-card metrics-card">
          <button
            v-for="card in kpiCards"
            :key="card.label"
            type="button"
            class="metric-item-btn"
            :class="`tone-${card.tone}`"
            @click="openRoute(card.route)"
          >
            <span class="metric-icon">
              <component :is="card.icon" class="h-4 w-4" />
            </span>
            <span class="metric-copy">
              <small>{{ card.label }}</small>
              <strong>{{ formatCompactNumber(card.value) }}</strong>
              <em>{{ card.sub }}</em>
            </span>
          </button>
        </div>

        <button
          v-if="primaryAction"
          type="button"
          class="overview-card action-card-btn action-risk"
          @click="openRoute(primaryAction.route)"
        >
          <div class="action-copy">
            <small>优先动作</small>
            <strong>{{ primaryAction.cta }}</strong>
            <em>{{ primaryAction.title }} / {{ primaryAction.metric }}</em>
          </div>
          <span class="action-arrow">
            <ArrowRight class="h-4 w-4" />
          </span>
        </button>
        <div v-else class="overview-card action-card-btn action-stable">
          <div class="action-copy">
            <small>优先动作</small>
            <strong>状态稳定</strong>
            <em>当前没有高优行动项</em>
          </div>
          <span class="action-arrow">
            <CheckCircle2 class="h-4 w-4" />
          </span>
        </div>
      </section>

      <section class="command-grid">
        <div class="primary-column">
          <section class="panel queue-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">统一风险队列</h2>
                <p class="panel-subtitle">{{ totalQueue }} 个跨模块条目</p>
              </div>
              <AlertTriangle class="h-4 w-4 text-amber-500" />
            </div>

            <div class="queue-list">
              <button
                v-for="item in commandCenter?.queue || []"
                :key="`${item.type}-${item.id}`"
                type="button"
                class="queue-row"
                :data-severity="item.severity"
                @click="openRoute(item.route)"
              >
                <span class="queue-rail"></span>
                <span class="type-pill" :class="queueTypeMeta[item.type].class">
                  {{ queueTypeMeta[item.type].label }}
                </span>
                <span class="queue-copy">
                  <b>{{ item.title }}</b>
                  <small>{{ item.detail }} / {{ item.owner }}</small>
                </span>
                <span class="queue-meta">
                  <i :class="severityMeta[item.severity].class">
                    {{ severityMeta[item.severity].label }}
                  </i>
                  <small>{{ formatAge(item.ageHours) }}</small>
                </span>
                <ArrowRight class="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              </button>
              <div v-if="!commandCenter?.queue.length" class="empty-line">
                当前没有跨模块风险条目
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">SLA 控制台</h2>
                <p class="panel-subtitle">反馈、审核、准入、商业和资源恢复</p>
              </div>
              <Clock class="h-4 w-4 text-sky-500" />
            </div>

            <div class="sla-grid">
              <button
                v-for="item in commandCenter?.sla || []"
                :key="item.key"
                type="button"
                class="sla-card"
                @click="openRoute(item.route)"
              >
                <div class="sla-topline">
                  <div class="min-w-0">
                    <p>{{ item.label }}</p>
                    <small>{{ item.owner }} / {{ item.targetHours }}h</small>
                  </div>
                  <span class="status-pill" :class="slaStatusMeta[item.status].class">
                    {{ slaStatusMeta[item.status].label }}
                  </span>
                </div>
                <div class="sla-numbers">
                  <span class="num-item">
                    <small>当前</small>
                    <b>{{ item.current }}</b>
                  </span>
                  <span class="num-item">
                    <small>临近</small>
                    <b>{{ item.dueSoon }}</b>
                  </span>
                  <span class="num-item">
                    <small>超时</small>
                    <b>{{ item.overdue }}</b>
                  </span>
                </div>
                <i class="track">
                  <em
                    :style="{
                      width: progressWidth(item.current - item.overdue, Math.max(item.current, 1)),
                    }"
                  ></em>
                </i>
              </button>
            </div>
          </section>
        </div>

        <div class="secondary-column">
          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">14 天运营趋势</h2>
                <p class="panel-subtitle">用户、内容、反馈与审计动作</p>
              </div>
              <TrendingUp class="h-4 w-4 text-emerald-500" />
            </div>

            <div class="trend-chart">
              <div
                v-for="point in commandCenter?.trend || []"
                :key="point.date"
                class="trend-column"
                :title="point.date"
              >
                <div class="trend-bars">
                  <span class="bar-users" :style="{ height: barHeight(point.users) }"></span>
                  <span class="bar-content" :style="{ height: barHeight(point.content) }"></span>
                  <span class="bar-feedback" :style="{ height: barHeight(point.feedback) }"></span>
                  <span class="bar-audit" :style="{ height: barHeight(point.audit) }"></span>
                </div>
                <small>{{ point.date.slice(5) }}</small>
              </div>
            </div>

            <div class="legend-grid">
              <span><i class="bg-sky-500"></i>用户</span>
              <span><i class="bg-emerald-500"></i>内容</span>
              <span><i class="bg-amber-500"></i>反馈</span>
              <span><i class="bg-violet-500"></i>审计</span>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">系统信号</h2>
                <p class="panel-subtitle">关键运营开关</p>
              </div>
              <Activity class="h-4 w-4 text-violet-500" />
            </div>
            <div class="signal-grid">
              <button
                v-for="signal in commandCenter?.systemSignals || []"
                :key="signal.key"
                type="button"
                @click="openRoute(signal.route)"
              >
                <span class="signal-icon" :class="signalStatusMeta[signal.status].class">
                  <CheckCircle2 v-if="signal.status === 'healthy'" class="h-4 w-4" />
                  <AlertTriangle v-else class="h-4 w-4" />
                </span>
                <span class="signal-copy">
                  <b>{{ signal.label }}</b>
                  <small>{{ signal.value }}</small>
                </span>
                <span class="status-dot" :class="signal.status"></span>
              </button>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">行动手册</h2>
                <p class="panel-subtitle">
                  下一次巡检 {{ formatDateTime(commandCenter?.nextReviewAt) }}
                </p>
              </div>
              <Zap class="h-4 w-4 text-rose-500" />
            </div>
            <div class="playbook-list">
              <button
                v-for="playbook in commandCenter?.playbooks || []"
                :key="playbook.id"
                type="button"
                @click="openRoute(playbook.route)"
              >
                <span class="playbook-icon" :class="severityMeta[playbook.severity].class">
                  <CheckCircle2 v-if="playbook.severity === 'info'" class="h-4 w-4" />
                  <AlertTriangle v-else class="h-4 w-4" />
                </span>
                <span class="playbook-copy">
                  <b>{{ playbook.title }}</b>
                  <small>{{ playbook.impact }} / {{ playbook.detail }}</small>
                </span>
                <span class="playbook-cta">{{ playbook.cta }}</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-command-center {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(var(--accent-rgb), 0.03), transparent 260px), var(--bg-app);
}

.command-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  padding: 0.75rem 1.25rem;
}

.command-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.title-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.title-row h1 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.command-title p {
  margin-top: 0.1rem;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.health-badge,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.12rem 0.45rem;
  font-size: 9px;
  font-weight: 800;
}

.command-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 0.4rem;
  border-radius: 6px;
  padding: 0 0.75rem;
  font-size: 11px;
  font-weight: 800;
  transition: all 0.18s ease;
}

.primary-button {
  color: #fff;
  background: var(--accent);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.secondary-button {
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  background: var(--bg-card);
}

.primary-button:hover,
.secondary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.secondary-button:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.05);
}

.command-main {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Redesigned Overview Grid */
.overview-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(340px, 1.5fr) minmax(260px, 0.9fr);
  gap: 1rem;
  flex-shrink: 0;
}

.overview-card {
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 0.85rem 1rem;
  box-shadow: var(--shadow-enterprise);
  transition: all 0.2s ease;
  min-width: 0;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* SVG Health Gauge Dial */
.health-dial {
  position: relative;
  height: 72px;
  width: 72px;
  flex-shrink: 0;
}

.health-ring {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.ring-bg {
  stroke: color-mix(in srgb, var(--border-base) 40%, transparent);
}

.ring-progress {
  transition: stroke-dashoffset 0.35s ease;
}

.dial-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.1;
  text-align: center;
}

.dial-content strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.dial-content span {
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 700;
  margin-top: 1px;
}

.overview-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.overview-copy h2 {
  margin-top: 0.2rem;
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 900;
}

.overview-copy p {
  margin-top: 0.15rem;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.risk-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.45rem;
}

.risk-strip span {
  border-radius: 99px;
  padding: 0.1rem 0.4rem;
  font-size: 9px;
  font-weight: 800;
}

.risk-critical {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.risk-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.risk-info {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.1);
}

/* 3-Column KPI Grid */
.metrics-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.metric-item-btn {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.18s ease;
  height: 100%;
}

.metric-item-btn:hover {
  background: color-mix(in srgb, var(--bg-hover) 80%, transparent);
  border-color: var(--border-base);
  transform: translateY(-1px);
}

.metric-icon {
  display: inline-flex;
  height: 30px;
  width: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 6px;
  transition: all 0.18s ease;
}

.metric-copy {
  min-width: 0;
}

.metric-copy small {
  display: block;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-copy strong {
  display: block;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
  line-height: 1.1;
}

.metric-copy em {
  display: block;
  color: var(--text-muted);
  font-size: 9px;
  font-style: normal;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tone-sky .metric-icon {
  border-color: rgba(14, 165, 233, 0.2);
  color: #0284c7;
  background: rgba(14, 165, 233, 0.08);
}

.tone-rose .metric-icon {
  border-color: color-mix(in srgb, var(--danger) 22%, transparent);
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}

.tone-emerald .metric-icon {
  border-color: color-mix(in srgb, var(--success) 22%, transparent);
  color: var(--success);
  background: color-mix(in srgb, var(--success) 8%, transparent);
}

.tone-amber .metric-icon {
  border-color: color-mix(in srgb, var(--warning) 22%, transparent);
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.tone-violet .metric-icon {
  border-color: rgba(139, 92, 246, 0.2);
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.08);
}

/* Action Card Button styling */
.action-card-btn {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  text-align: left;
  cursor: pointer;
}

.action-card-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.action-copy {
  min-width: 0;
  flex: 1;
}

.action-copy small {
  display: block;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.action-copy strong {
  display: block;
  font-size: 13px;
  font-weight: 900;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-copy em {
  display: block;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-arrow {
  display: inline-flex;
  height: 28px;
  width: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.15);
}

.action-risk {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 90%, black), var(--accent));
}

.action-risk .action-copy small,
.action-risk .action-copy strong,
.action-risk .action-copy em {
  color: #fff;
}

.action-risk .action-copy em {
  opacity: 0.85;
}

.action-stable {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 20%, transparent);
  background: color-mix(in srgb, var(--success) 6%, transparent);
}

.action-stable .action-copy small,
.action-stable .action-copy em {
  color: var(--text-secondary);
}

.action-stable .action-copy strong {
  color: var(--text-primary);
}

.action-stable .action-arrow {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success);
}

/* Grid Layout styling */
.command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
  gap: 1rem;
  flex: 1;
}

.primary-column,
.secondary-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 0.85rem 1rem;
  box-shadow: var(--shadow-enterprise);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.panel-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.panel-subtitle {
  margin-top: 0.15rem;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.queue-list,
.playbook-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

/* Compact Risk Queue Row */
.queue-row {
  position: relative;
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-app));
  padding: 0.45rem 0.65rem 0.45rem 0.8rem;
  text-align: left;
  transition: all 0.18s ease;
}

.queue-row:hover,
.sla-card:hover,
.signal-grid button:hover,
.playbook-list button:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-card));
  transform: translateY(-1.5px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
}

.queue-rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2.5px;
  background: #0ea5e9;
  border-radius: 0 2px 2px 0;
}

.queue-row[data-severity='critical'] .queue-rail {
  background: var(--danger);
  box-shadow: 0 0 4px var(--danger);
}

.queue-row[data-severity='warning'] .queue-rail {
  background: var(--warning);
  box-shadow: 0 0 4px var(--warning);
}

.type-pill {
  display: inline-flex;
  width: 38px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 0.2rem 0;
  font-size: 10px;
  font-weight: 800;
}

.queue-copy,
.signal-copy,
.playbook-copy {
  min-width: 0;
  flex: 1;
}

.queue-row b,
.signal-grid b,
.playbook-list b {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 800;
}

.queue-row small,
.signal-grid small,
.playbook-list small {
  display: block;
  overflow: hidden;
  margin-top: 0.1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-meta {
  display: flex;
  min-width: 58px;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.queue-meta i {
  border: 1px solid;
  border-radius: 99px;
  padding: 0.05rem 0.35rem;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

/* Compact SLA Console cards */
.sla-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.5rem;
}

.sla-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 94px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-app));
  padding: 0.55rem;
  text-align: left;
  transition: all 0.18s ease;
}

.sla-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
}

.sla-topline p {
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 800;
}

.sla-numbers {
  display: flex;
  justify-content: space-between;
  gap: 0.3rem;
  margin-top: 0.4rem;
  background: color-mix(in srgb, var(--bg-app) 40%, var(--bg-card));
  padding: 0.25rem 0.4rem;
  border-radius: 5px;
  border: 1px solid var(--border-base);
}

.num-item {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
}

.num-item small {
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 600;
}

.num-item b {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 800;
}

.track {
  display: block;
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: color-mix(in srgb, var(--border-base) 30%, transparent);
  margin-top: 0.45rem;
}

.track em {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

/* Sleeker Trend Chart */
.trend-chart {
  display: grid;
  grid-template-columns: repeat(14, minmax(18px, 1fr));
  gap: 0.4rem;
  height: 154px;
  align-items: end;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background:
    linear-gradient(
      180deg,
      transparent 0 23%,
      rgba(148, 163, 184, 0.08) 23% 24%,
      transparent 24% 49%,
      rgba(148, 163, 184, 0.08) 49% 50%,
      transparent 50% 74%,
      rgba(148, 163, 184, 0.08) 74% 75%,
      transparent 75%
    ),
    color-mix(in srgb, var(--bg-card) 92%, var(--bg-app));
  padding: 0.75rem 0.55rem 0.45rem;
}

.trend-column {
  display: grid;
  min-width: 0;
  height: 100%;
  grid-template-rows: 1fr auto;
  gap: 0.3rem;
  transition: transform 0.18s ease;
}

.trend-column:hover {
  transform: translateY(-2px) scaleX(1.02);
}

.trend-bars {
  display: grid;
  grid-template-columns: repeat(4, minmax(1.5px, 1fr));
  align-items: end;
  gap: 1.5px;
}

.trend-bars span {
  display: block;
  min-height: 0;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
}

.bar-users {
  background: #0ea5e9;
}
.bar-content {
  background: #10b981;
}
.bar-feedback {
  background: #f59e0b;
}
.bar-audit {
  background: #8b5cf6;
}

.trend-column small {
  overflow: hidden;
  color: var(--text-muted);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 8px;
  font-weight: 700;
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.legend-grid span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
}

.legend-grid i {
  height: 6px;
  width: 6px;
  border-radius: 99px;
}

/* System Signals with switches & indicator dots */
.signal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.signal-grid button,
.playbook-list button {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-app));
  padding: 0.45rem 0.55rem;
  text-align: left;
  transition: all 0.18s ease;
}

.signal-icon,
.playbook-icon {
  display: inline-flex;
  height: 28px;
  width: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 6px;
  transition: all 0.18s ease;
}

.signal-icon svg,
.playbook-icon svg {
  height: 12px;
  width: 12px;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 99px;
  margin-left: auto;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.status-dot.healthy {
  background-color: var(--success);
  color: var(--success);
}

.status-dot.watch {
  background-color: var(--warning);
  color: var(--warning);
}

.status-dot.breached {
  background-color: var(--danger);
  color: var(--danger);
}

/* Playbooks List spacing */
.playbook-cta {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
}

.empty-line {
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  padding: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 1400px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .metrics-card {
    border-top: 1px solid var(--border-base);
  }
}

@media (max-width: 1100px) {
  .command-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .command-header {
    align-items: stretch;
    flex-direction: column;
    padding: 0.75rem;
  }

  .command-actions {
    justify-content: flex-start;
  }

  .command-actions button {
    flex: 1;
    justify-content: center;
    min-width: 0;
  }

  .command-main {
    padding: 0.5rem;
  }

  .status-card {
    padding: 0.75rem;
  }

  .health-dial {
    height: 56px;
    width: 56px;
  }

  .dial-content strong {
    font-size: 15px;
  }

  .overview-copy h2 {
    white-space: normal;
    font-size: 13px;
  }

  .overview-copy p {
    white-space: normal;
  }

  .metrics-card,
  .signal-grid,
  .legend-grid,
  .sla-grid {
    grid-template-columns: 1fr;
  }

  .metric-item-btn {
    padding: 0.5rem 0;
  }

  .queue-row {
    align-items: flex-start;
  }

  .queue-meta {
    align-items: flex-start;
  }

  .trend-chart {
    overflow-x: auto;
    grid-template-columns: repeat(14, minmax(24px, 1fr));
  }
}
</style>
