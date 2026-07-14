<script setup lang="ts">
import { formatDateTime } from '@/utils/format';
import { computed, onMounted, ref } from 'vue';
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
  TrendingUp,
  Workflow,
} from 'lucide-vue-next';
import {
  fetchManagementInsights,
  formatCompactNumber,
  getHealthLabel,
  isLoadingManagementInsights,
  managementInsights,
} from './adminManagementInsights';

// UI components
import AdminHeader from './components/AdminHeader.vue';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';

const router = useRouter();

const activeCommandTab = ref<'queue' | 'sla'>('queue');
const activeSignalTab = ref<'signals' | 'playbooks'>('signals');

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

const getBadgeVariant = (status: string) => {
  if (status === 'healthy') return 'success';
  if (status === 'watch') return 'warning';
  return 'danger';
};

const getSeverityBadgeVariant = (severity: string) => {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
};

const severityLabel = (severity: string) => {
  if (severity === 'critical') return '高';
  if (severity === 'warning') return '中';
  return '低';
};

const queueTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    feedback: '反馈',
    audit: '审核',
    team: '团队',
    billing: '商业',
    resource: '资源',
  };
  return labels[type] || type;
};

const queueTypeVariant = (type: string) => {
  const variants: Record<
    string,
    'info' | 'warning' | 'success' | 'danger' | 'blender' | 'primary'
  > = {
    feedback: 'info',
    audit: 'warning',
    team: 'success',
    billing: 'danger',
    resource: 'blender',
  };
  return variants[type] || 'primary';
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
</script>

<template>
  <div class="admin-command-center mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5">
      <div class="space-y-2">
        <!-- Ultra-Compact Single Row Header -->
        <AdminHeader
          title="管理指挥中心"
          subtitle="统一调度 SLA、风险队列、系统信号和运营动作"
          :show-search="false"
        >
          <template #title-badge>
            <Badge
              v-if="overview"
              :variant="
                overview.healthScore >= 80
                  ? 'success'
                  : overview.healthScore >= 60
                    ? 'warning'
                    : 'danger'
              "
              dot
            >
              {{ overview.healthScore }} / {{ getHealthLabel(overview.healthScore) }}
            </Badge>
          </template>

          <Button
            variant="secondary"
            size="sm"
            :icon="BarChart3"
            @click="router.push('/admin/audit-logs')"
            class="!h-7.5 !text-xs !px-2.5"
          >
            审计日志
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="Settings2"
            @click="router.push('/admin/settings')"
            class="!h-7.5 !text-xs !px-2.5"
          >
            系统设置
          </Button>
          <Button
            variant="primary"
            size="sm"
            :icon="RefreshCw"
            :loading="isLoadingManagementInsights"
            @click="fetchManagementInsights(true)"
            class="!h-7.5 !text-xs !px-2.5"
          >
            刷新
          </Button>
        </AdminHeader>
        <!-- Overview Grid (5-Column Flat Layout) -->
        <section
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mobile-grid"
        >
          <!-- Card 1: System Health -->
          <Card
            hoverable
            clickable
            glow
            class="group cursor-pointer !p-2 px-2.5 flex items-center"
            @click="router.push('/admin/audits')"
          >
            <div class="flex items-center justify-between w-full gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="health-dial shrink-0 relative h-8 w-8">
                  <svg class="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="healthGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="var(--accent)" />
                        <stop
                          offset="100%"
                          stop-color="color-mix(in srgb, var(--accent) 70%, #10b981)"
                        />
                      </linearGradient>
                    </defs>
                    <circle
                      class="stroke-[var(--border-base)]/40 stroke-[12]"
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                    />
                    <circle
                      class="transition-all duration-350 stroke-[12] stroke-linecap-round"
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="url(#healthGrad)"
                      :stroke-dasharray="238.76"
                      :stroke-dashoffset="
                        238.76 -
                        (238.76 * Math.min(100, Math.max(0, overview?.healthScore || 0))) / 100
                      "
                    />
                  </svg>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-center leading-none"
                  >
                    <strong class="text-[9px] font-black text-[var(--text-primary)]">{{
                      overview?.healthScore || 0
                    }}</strong>
                  </div>
                </div>
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-bold text-[var(--text-secondary)] block truncate leading-tight"
                    >系统健康度</span
                  >
                  <span
                    class="text-[8px] text-[var(--text-secondary)] opacity-85 block truncate mt-0.5 leading-none"
                  >
                    {{ overview?.issueCount || 0 }} 个风险信号
                  </span>
                </div>
              </div>
              <Badge
                v-if="overview"
                :variant="
                  overview.healthScore >= 80
                    ? 'success'
                    : overview.healthScore >= 60
                      ? 'warning'
                      : 'danger'
                "
                size="sm"
                class="shrink-0"
              >
                {{ getHealthLabel(overview.healthScore) }}
              </Badge>
            </div>
          </Card>

          <!-- Card 2: Pending Queue -->
          <Card
            hoverable
            clickable
            glow
            class="group cursor-pointer !p-2 px-2.5 flex items-center"
            @click="router.push('/admin/audits')"
          >
            <div class="flex items-center justify-between w-full gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="metric-icon border border-base rounded-lg p-1 transition-transform group-hover:scale-105 shrink-0 flex items-center justify-center h-7 w-7"
                  :class="
                    urgentQueue
                      ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                      : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                  "
                >
                  <Workflow class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-bold text-[var(--text-secondary)] block truncate leading-tight"
                    >待办队列</span
                  >
                  <span
                    class="text-[8px] text-[var(--text-secondary)] opacity-85 block truncate mt-0.5 leading-none"
                  >
                    {{ urgentQueue }} 个高优先
                  </span>
                </div>
              </div>
              <strong class="text-sm font-black text-[var(--text-primary)] leading-none shrink-0">
                {{ formatCompactNumber(totalQueue) }}
              </strong>
            </div>
          </Card>

          <!-- Card 3: SLA Workload -->
          <Card
            hoverable
            clickable
            glow
            class="group cursor-pointer !p-2 px-2.5 flex items-center"
            @click="activeCommandTab = 'sla'"
          >
            <div class="flex items-center justify-between w-full gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="metric-icon border border-base rounded-lg p-1 transition-transform group-hover:scale-105 shrink-0 flex items-center justify-center h-7 w-7"
                  :class="
                    watchQueue
                      ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                      : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                  "
                >
                  <Clock class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-bold text-[var(--text-secondary)] block truncate leading-tight"
                    >SLA 负载</span
                  >
                  <span
                    class="text-[8px] text-[var(--text-secondary)] opacity-85 block truncate mt-0.5 leading-none"
                    >跨模块待处理</span
                  >
                </div>
              </div>
              <strong class="text-sm font-black text-[var(--text-primary)] leading-none shrink-0">
                {{ formatCompactNumber(command?.workloadTotal || 0) }}
              </strong>
            </div>
          </Card>

          <!-- Card 4: Active Entitlements -->
          <Card
            hoverable
            clickable
            glow
            class="group cursor-pointer !p-2 px-2.5 flex items-center"
            @click="router.push('/admin/subscriptions')"
          >
            <div class="flex items-center justify-between w-full gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="metric-icon border border-base rounded-lg p-1 transition-transform group-hover:scale-105 shrink-0 flex items-center justify-center h-7 w-7 text-violet-600 bg-violet-500/10 border-violet-500/20"
                >
                  <ShieldCheck class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-bold text-[var(--text-secondary)] block truncate leading-tight"
                    >有效权益</span
                  >
                  <span
                    class="text-[8px] text-[var(--text-secondary)] opacity-85 block truncate mt-0.5 leading-none"
                    >当前订阅用户</span
                  >
                </div>
              </div>
              <strong class="text-sm font-black text-[var(--text-primary)] leading-none shrink-0">
                {{ formatCompactNumber(overview?.activeEntitlements || 0) }}
              </strong>
            </div>
          </Card>

          <!-- Card 5: Priority Action / Stable Status -->
          <Card
            v-if="primaryAction"
            clickable
            hoverable
            class="action-risk !border-transparent text-white cursor-pointer !p-2 px-2.5 flex items-center"
            @click="openRoute(primaryAction.route)"
          >
            <div class="flex items-center justify-between w-full gap-2 h-full">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 leading-none">
                  <span
                    class="inline-flex items-center px-1 rounded text-[7px] font-black bg-white/25 text-white uppercase tracking-wider"
                    >优先动作</span
                  >
                  <span
                    class="text-[8px] text-white/80 truncate not-italic max-w-[80px]"
                    :title="primaryAction.title"
                    >{{ primaryAction.title }}</span
                  >
                </div>
                <strong
                  class="text-[10px] font-black block text-white mt-1 truncate leading-tight"
                  >{{ primaryAction.cta }}</strong
                >
              </div>
              <span
                class="action-arrow shrink-0 h-5 w-5 flex items-center justify-center rounded-lg bg-white/20 text-white"
              >
                <ArrowRight class="h-3 w-3" />
              </span>
            </div>
          </Card>
          <Card v-else class="action-stable text-[var(--success)] !p-2 px-2.5 flex items-center">
            <div class="flex items-center justify-between w-full gap-2 h-full">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="metric-icon border border-base rounded-lg p-1 shrink-0 flex items-center justify-center h-7 w-7 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  <CheckCircle2 class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-bold text-[var(--text-secondary)] block truncate leading-tight"
                    >优先动作</span
                  >
                  <span class="text-[8px] text-slate-400 block truncate mt-0.5 leading-none"
                    >当前无高优动作</span
                  >
                </div>
              </div>
              <strong class="text-xs font-black text-emerald-500 leading-none shrink-0"
                >状态稳定</strong
              >
            </div>
          </Card>
        </section>

        <!-- Command Grid (Balanced asymmetric layout) -->
        <section class="grid gap-3 xl:grid-cols-[1.25fr_0.75fr] grid-cols-1">
          <!-- Left Column: Unified Monitoring & Dispatch Card (Tabbed) -->
          <div class="space-y-3">
            <Card padding="sm">
              <template #header>
                <div class="flex items-center justify-between w-full">
                  <h2
                    class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                  >
                    <Workflow class="h-4 w-4 text-[var(--accent)]" />
                    监控与调度
                  </h2>
                  <Tabs
                    v-model="activeCommandTab"
                    :options="[
                      { label: '风险队列', value: 'queue' },
                      { label: 'SLA 控制', value: 'sla' },
                    ]"
                    size="sm"
                    variant="solid"
                  />
                </div>
              </template>

              <!-- Tab: Risk Queue -->
              <div v-show="activeCommandTab === 'queue'" class="space-y-2">
                <div
                  class="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
                >
                  <span>当前有 {{ totalQueue }} 个跨模块条目需要审计与干预。</span>
                  <span class="flex gap-1.5 shrink-0">
                    <Badge variant="danger" size="sm">高 {{ riskMix.critical }}</Badge>
                    <Badge variant="warning" size="sm">中 {{ riskMix.warning }}</Badge>
                    <Badge variant="info" size="sm">低 {{ riskMix.info }}</Badge>
                  </span>
                </div>

                <!-- Queue list sliced to 2 items for layout compactness -->
                <div class="queue-list flex flex-col gap-1.5 mt-1.5">
                  <button
                    v-for="item in commandCenter?.queue.slice(0, 2) || []"
                    :key="`${item.type}-${item.id}`"
                    type="button"
                    class="queue-row relative flex items-center gap-3 p-1.5 px-3 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-hover cursor-pointer"
                    :data-severity="item.severity"
                    @click="openRoute(item.route)"
                  >
                    <span
                      class="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                      :class="{
                        'bg-rose-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]':
                          item.severity === 'critical',
                        'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]':
                          item.severity === 'warning',
                        'bg-sky-500': item.severity === 'info',
                      }"
                    ></span>
                    <Badge :variant="queueTypeVariant(item.type)">
                      {{ queueTypeLabel(item.type) }}
                    </Badge>
                    <div class="min-w-0 flex-1 pl-1">
                      <b class="text-xs font-bold block truncate text-[var(--text-primary)]">{{
                        item.title
                      }}</b>
                      <small class="text-[10px] text-slate-400 block truncate mt-0.5"
                        >{{ item.detail }} / {{ item.owner }}</small
                      >
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <Badge :variant="getSeverityBadgeVariant(item.severity)">
                        {{ severityLabel(item.severity) }}
                      </Badge>
                      <small class="text-[10px] text-slate-400 w-16 text-right">{{
                        formatAge(item.ageHours)
                      }}</small>
                      <ArrowRight class="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                  <div
                    v-if="!commandCenter?.queue.length"
                    class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                  >
                    当前没有跨模块风险条目
                  </div>
                </div>
              </div>

              <!-- Tab: SLA Console -->
              <div v-show="activeCommandTab === 'sla'" class="space-y-2">
                <div
                  class="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
                >
                  <span>反馈、审核、准入、商业和资源恢复时效（SLA）。</span>
                  <span class="text-[10px] font-bold text-[var(--text-primary)] shrink-0"
                    >总负载: {{ command?.workloadTotal || 0 }}</span
                  >
                </div>

                <div
                  class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1.5 mobile-grid"
                >
                  <Card
                    v-for="item in commandCenter?.sla || []"
                    :key="item.key"
                    padding="sm"
                    clickable
                    hoverable
                    class="bg-subtle/40 border-base cursor-pointer"
                    @click="openRoute(item.route)"
                  >
                    <div class="flex items-start justify-between gap-2.5">
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {{ item.label }}
                        </p>
                        <small class="text-[9px] text-slate-400 block mt-0.5 truncate"
                          >{{ item.owner }} / {{ item.targetHours }}h</small
                        >
                      </div>
                      <Badge :variant="getBadgeVariant(item.status)">
                        {{
                          item.status === 'healthy'
                            ? '健康'
                            : item.status === 'watch'
                              ? '关注'
                              : '超时'
                        }}
                      </Badge>
                    </div>
                    <div
                      class="flex justify-between gap-1.5 mt-2 bg-card p-1 px-1.5 border border-base rounded-md"
                    >
                      <span class="flex items-center gap-1 min-w-0">
                        <small class="text-[9px] text-slate-400">当前</small>
                        <b class="text-[10px] font-bold text-[var(--text-primary)]">{{
                          item.current
                        }}</b>
                      </span>
                      <span class="flex items-center gap-1 min-w-0">
                        <small class="text-[9px] text-slate-400">临近</small>
                        <b class="text-[10px] font-bold text-[var(--text-primary)]">{{
                          item.dueSoon
                        }}</b>
                      </span>
                      <span class="flex items-center gap-1 min-w-0">
                        <small class="text-[9px] text-slate-400">超时</small>
                        <b class="text-[10px] font-bold text-[var(--text-primary)]">{{
                          item.overdue
                        }}</b>
                      </span>
                    </div>
                    <div
                      class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-2"
                    >
                      <div
                        class="h-full rounded-full bg-accent"
                        :style="{
                          width: progressWidth(
                            item.current - item.overdue,
                            Math.max(item.current, 1),
                          ),
                        }"
                      ></div>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
          </div>

          <!-- Right Column: Trends, Signals, Playbooks -->
          <div class="space-y-3">
            <!-- 14-Day Trend Chart -->
            <Card padding="sm">
              <template #header>
                <div class="flex items-center justify-between w-full">
                  <div>
                    <h2
                      class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                    >
                      <TrendingUp class="h-4 w-4 text-[var(--accent)]" />
                      14 天运营趋势
                    </h2>
                    <p class="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      用户、内容、反馈与审计动作
                    </p>
                  </div>
                  <TrendingUp class="h-4 w-4 text-emerald-500" />
                </div>
              </template>

              <div class="trend-chart pr-1">
                <div
                  v-for="point in commandCenter?.trend || []"
                  :key="point.date"
                  class="trend-column"
                  :title="point.date"
                >
                  <div class="trend-bars">
                    <span class="bar-users" :style="{ height: barHeight(point.users) }"></span>
                    <span class="bar-content" :style="{ height: barHeight(point.content) }"></span>
                    <span
                      class="bar-feedback"
                      :style="{ height: barHeight(point.feedback) }"
                    ></span>
                    <span class="bar-audit" :style="{ height: barHeight(point.audit) }"></span>
                  </div>
                  <small>{{ point.date.slice(5) }}</small>
                </div>
              </div>

              <div class="grid grid-cols-4 gap-1.5 mt-2.5 text-center mobile-grid">
                <span
                  class="inline-flex items-center justify-center gap-1.5 text-[9px] font-bold text-[var(--text-secondary)]"
                >
                  <i class="h-1.5 w-1.5 rounded-full bg-[#0ea5e9]"></i>用户
                </span>
                <span
                  class="inline-flex items-center justify-center gap-1.5 text-[9px] font-bold text-[var(--text-secondary)]"
                >
                  <i class="h-1.5 w-1.5 rounded-full bg-[#10b981]"></i>内容
                </span>
                <span
                  class="inline-flex items-center justify-center gap-1.5 text-[9px] font-bold text-[var(--text-secondary)]"
                >
                  <i class="h-1.5 w-1.5 rounded-full bg-[#f59e0b]"></i>反馈
                </span>
                <span
                  class="inline-flex items-center justify-center gap-1.5 text-[9px] font-bold text-[var(--text-secondary)]"
                >
                  <i class="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]"></i>审计
                </span>
              </div>
            </Card>

            <!-- Unified System Signals & Action Playbooks (Tabbed) -->
            <Card padding="sm">
              <template #header>
                <div class="flex items-center justify-between w-full">
                  <h2
                    class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                  >
                    <Activity class="h-4 w-4 text-[var(--accent)]" />
                    信号与预案
                  </h2>
                  <Tabs
                    v-model="activeSignalTab"
                    :options="[
                      { label: '系统信号', value: 'signals' },
                      { label: '应急预案', value: 'playbooks' },
                    ]"
                    size="sm"
                    variant="solid"
                  />
                </div>
              </template>

              <!-- Tab: System Signals -->
              <div v-show="activeSignalTab === 'signals'" class="space-y-2">
                <div
                  class="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
                >
                  <span>运行环境关键开关与状态。</span>
                </div>

                <div class="grid grid-cols-2 gap-2 mt-1.5 mobile-grid">
                  <button
                    v-for="signal in commandCenter?.systemSignals || []"
                    :key="signal.key"
                    type="button"
                    class="group flex items-center gap-2 p-1.5 px-2 border border-base rounded-lg bg-subtle text-left transition-all hover:border-[var(--accent)] hover:bg-hover cursor-pointer"
                    @click="openRoute(signal.route)"
                  >
                    <span
                      class="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg border border-base transition-transform group-hover:scale-105"
                      :class="[
                        signal.status === 'healthy'
                          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                          : signal.status === 'watch'
                            ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                            : 'text-red-500 bg-red-500/10 border-red-500/20',
                      ]"
                    >
                      <CheckCircle2 v-if="signal.status === 'healthy'" class="h-3.5 w-3.5" />
                      <AlertTriangle v-else class="h-3.5 w-3.5" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <span
                        class="group-hover:text-[var(--accent)] transition-colors text-[10px] font-bold block truncate text-[var(--text-primary)] leading-tight"
                      >
                        {{ signal.label }}
                      </span>
                      <span class="text-[9px] text-slate-400 block truncate mt-0.5 leading-none">{{
                        signal.value
                      }}</span>
                    </div>
                    <span
                      class="h-1.5 w-1.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                      :class="{
                        'bg-emerald-500 text-emerald-500': signal.status === 'healthy',
                        'bg-amber-500 text-amber-500': signal.status === 'watch',
                        'bg-red-500 text-red-500': signal.status === 'breached',
                      }"
                    ></span>
                  </button>
                </div>
              </div>

              <!-- Tab: Action Playbooks -->
              <div v-show="activeSignalTab === 'playbooks'" class="space-y-2">
                <div
                  class="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
                >
                  <span
                    >应急预案。下一次巡检: {{ formatDateTime(commandCenter?.nextReviewAt) }}</span
                  >
                </div>

                <div class="playbook-list flex flex-col gap-1.5 mt-1.5">
                  <button
                    v-for="playbook in commandCenter?.playbooks || []"
                    :key="playbook.id"
                    type="button"
                    class="group flex items-center gap-2.5 p-1.5 px-2 border border-base rounded-lg bg-subtle text-left transition-all hover:border-[var(--accent)] hover:bg-hover cursor-pointer w-full"
                    @click="openRoute(playbook.route)"
                  >
                    <span
                      class="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg border border-base transition-transform group-hover:scale-105"
                      :class="[
                        playbook.severity === 'info'
                          ? 'text-sky-500 bg-sky-500/10 border-sky-500/20'
                          : playbook.severity === 'warning'
                            ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                            : 'text-red-500 bg-red-500/10 border-red-500/20',
                      ]"
                    >
                      <CheckCircle2 v-if="playbook.severity === 'info'" class="h-3.5 w-3.5" />
                      <AlertTriangle v-else class="h-3.5 w-3.5" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <b
                        class="text-[10px] font-bold block truncate text-[var(--text-primary)] leading-tight"
                        >{{ playbook.title }}</b
                      >
                      <small class="text-[9px] text-slate-400 block truncate mt-0.5 leading-none"
                        >{{ playbook.impact }} / {{ playbook.detail }}</small
                      >
                    </div>
                    <span
                      class="playbook-cta text-[10px] font-black text-[var(--accent)] shrink-0 pl-1"
                      >{{ playbook.cta }}</span
                    >
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-command-center {
  background: transparent;
}

.health-dial {
  position: relative;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.25fr) minmax(340px, 1.5fr) minmax(260px, 0.75fr);
  gap: 0.75rem;
}

.metrics-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.action-risk {
  color: #fff;
  background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 90%, black), var(--accent));
}

.action-stable {
  border-color: color-mix(in srgb, var(--success) 20%, transparent);
  background: color-mix(in srgb, var(--success) 6%, transparent);
}

.empty-line {
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  padding: 1rem;
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
}

/* SLA Console specific track */
.sla-card .w-full {
  margin-top: 0.45rem;
}

/* Trend Chart */
.trend-chart {
  display: grid;
  grid-template-columns: repeat(14, minmax(18px, 1fr));
  gap: 0.4rem;
  height: 140px;
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
  padding: 0.6rem 0.55rem 0.35rem;
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

@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .trend-chart {
    grid-template-columns: repeat(7, minmax(14px, 1fr));
    gap: 0.25rem;
    height: 110px;
    padding: 0.4rem 0.35rem 0.25rem;
  }

  .trend-bars {
    gap: 1px;
  }
}
</style>
