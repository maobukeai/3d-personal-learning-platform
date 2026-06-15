<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Copy,
  Download,
  Eye,
  FileSearch,
  Filter,
  Globe2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserRound,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { User } from '@/types';

interface AuditLog {
  id: string;
  module: string;
  action: string;
  description?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: User | null;
}

interface AuditSummaryItem {
  module?: string;
  action?: string;
  count: number;
}

interface AuditInsights {
  severity: { high: number; medium: number; low: number };
  sources: Array<{ ipAddress?: string | null; count: number }>;
  actors: Array<{ userId?: string | null; count: number; user?: User | null }>;
  trend: Array<{ date: string; total: number; high: number; medium: number; low: number }>;
  windowDays?: number | null;
}

type AuditSeverity = 'high' | 'medium' | 'low';

const defaultInsights = (): AuditInsights => ({
  severity: { high: 0, medium: 0, low: 0 },
  sources: [],
  actors: [],
  trend: [],
  windowDays: 14,
});

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const currentPage = ref(1);
const totalPages = ref(1);
const pageSize = ref(50);
const isLoading = ref(true);
const isExporting = ref(false);
const selectedLog = ref<AuditLog | null>(null);
const autoRefresh = ref(false);
const showAdvancedFilters = ref(false);
const activeInsightTab = ref<'actors' | 'modules' | 'sources'>('actors');

const moduleFilter = ref('');
const actionFilter = ref('');
const searchFilter = ref('');
const userIdFilter = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const summary = ref<{ modules: AuditSummaryItem[]; actions: AuditSummaryItem[] }>({
  modules: [],
  actions: [],
});
const insights = ref<AuditInsights>(defaultInsights());

const modules = [
  { label: '全部模块', value: '' },
  { label: '系统设置', value: 'SETTINGS', tone: 'tone-settings' },
  { label: '用户', value: 'USER', tone: 'tone-user' },
  { label: '团队', value: 'TEAM', tone: 'tone-team' },
  { label: '课程', value: 'COURSE', tone: 'tone-course' },
  { label: '资产', value: 'ASSET', tone: 'tone-asset' },
  { label: '材质', value: 'MATERIAL', tone: 'tone-material' },
  { label: '作品', value: 'SHOWCASE', tone: 'tone-showcase' },
  { label: '插件', value: 'PLUGIN', tone: 'tone-plugin' },
  { label: '反馈', value: 'FEEDBACK', tone: 'tone-feedback' },
  { label: '登录认证', value: 'AUTH', tone: 'tone-auth' },
  { label: '项目', value: 'PROJECT', tone: 'tone-project' },
  { label: '任务', value: 'TASK', tone: 'tone-task' },
];

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let liveTimer: ReturnType<typeof setInterval> | null = null;

const requestParams = computed(() => ({
  page: currentPage.value,
  limit: pageSize.value,
  module: moduleFilter.value || undefined,
  action: actionFilter.value || undefined,
  search: searchFilter.value || undefined,
  userId: userIdFilter.value || undefined,
  dateFrom: dateFrom.value || undefined,
  dateTo: dateTo.value || undefined,
}));

const activeFilters = computed(() => {
  const filters = [
    moduleFilter.value,
    actionFilter.value,
    searchFilter.value,
    userIdFilter.value,
    dateFrom.value,
    dateTo.value,
  ];
  return filters.filter(Boolean).length;
});

const visibleRange = computed(() => {
  if (total.value === 0) return '0';
  const start = (currentPage.value - 1) * pageSize.value + 1;
  const end = Math.min(currentPage.value * pageSize.value, total.value);
  return `${start}-${end}`;
});

const highRiskCount = computed(() => insights.value.severity.high || 0);
const severityTotal = computed(
  () => insights.value.severity.high + insights.value.severity.medium + insights.value.severity.low,
);
const maxTrendValue = computed(() =>
  Math.max(1, ...insights.value.trend.map((item) => item.total || 0)),
);
const moduleTotal = computed(() =>
  Math.max(
    1,
    summary.value.modules.reduce((sum, item) => sum + item.count, 0),
  ),
);

const latestLogTime = computed(() =>
  logs.value[0] ? formatRelative(logs.value[0].createdAt) : '暂无',
);

const severityBars = computed(() => [
  { key: 'high', label: '高风险', value: insights.value.severity.high, tone: 'risk-high' },
  { key: 'medium', label: '需关注', value: insights.value.severity.medium, tone: 'risk-medium' },
  { key: 'low', label: '常规', value: insights.value.severity.low, tone: 'risk-low' },
]);

const fetchLogs = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/audit-logs', {
      params: requestParams.value,
    });
    logs.value = data.logs || [];
    total.value = data.total || 0;
    totalPages.value = Math.max(data.pages || 1, 1);
    pageSize.value = data.pageSize || pageSize.value;
    summary.value = data.summary || { modules: [], actions: [] };
    insights.value = data.insights || defaultInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '审计日志加载失败'));
  } finally {
    isLoading.value = false;
  }
};

const exportCsv = async () => {
  try {
    isExporting.value = true;
    const { data } = await api.get('/api/admin/audit-logs', {
      params: {
        ...requestParams.value,
        page: 1,
        limit: 200,
        export: 'csv',
      },
      responseType: 'blob',
    });
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '导出失败'));
  } finally {
    isExporting.value = false;
  }
};

const resetFilters = () => {
  moduleFilter.value = '';
  actionFilter.value = '';
  searchFilter.value = '';
  userIdFilter.value = '';
  dateFrom.value = '';
  dateTo.value = '';
  currentPage.value = 1;
  fetchLogs();
};

const setPage = (page: number) => {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value);
  if (nextPage === currentPage.value) return;
  currentPage.value = nextPage;
  fetchLogs();
};

const copyValue = async (value: string, label = '内容') => {
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch {
    ElMessage.warning('当前浏览器不允许复制');
  }
};

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;
};

const syncLiveTimer = () => {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  if (autoRefresh.value) {
    liveTimer = setInterval(fetchLogs, 15000);
  }
};

const selectModule = (module?: string) => {
  moduleFilter.value = moduleFilter.value === module ? '' : module || '';
};

const selectAction = (action?: string) => {
  actionFilter.value = actionFilter.value === action ? '' : action || '';
};

const selectSource = (ip?: string | null) => {
  if (!ip) return;
  searchFilter.value = searchFilter.value === ip ? '' : ip;
};

const selectActor = (actor: { userId?: string | null }) => {
  if (!actor.userId) return;
  userIdFilter.value = userIdFilter.value === actor.userId ? '' : actor.userId;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatShortDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDay = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
};

const formatRelative = (date: string) => {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    LOGIN: '登录',
    LOGOUT: '退出',
    UPDATE_SETTINGS: '更新设置',
    CREATE_USER: '创建用户',
    UPDATE_USER: '更新用户',
    DELETE_USER: '删除用户',
    RESET_PASSWORD: '重置密码',
    REVOKE_SESSIONS: '撤销会话',
    CREATE_ASSET: '创建资产',
    UPDATE_ASSET: '更新资产',
    APPROVE_ASSET: '通过资产',
    REJECT_ASSET: '驳回资产',
    DELETE_ASSET: '删除资产',
    CREATE_COURSE: '创建课程',
    UPDATE_COURSE: '更新课程',
    DELETE_COURSE: '删除课程',
    CREATE_MATERIAL: '创建材质',
    UPDATE_MATERIAL: '更新材质',
    DELETE_MATERIAL: '删除材质',
    APPROVE_MATERIAL: '通过材质',
    REJECT_MATERIAL: '驳回材质',
    APPROVE_SHOWCASE: '通过作品',
    REJECT_SHOWCASE: '驳回作品',
    UPDATE_SHOWCASE: '更新作品',
    DELETE_SHOWCASE: '删除作品',
    APPROVE_PLUGIN: '通过插件',
    REJECT_PLUGIN: '驳回插件',
    UPDATE_PLUGIN: '更新插件',
    DELETE_PLUGIN: '删除插件',
    UPDATE_FEEDBACK: '更新反馈',
    DELETE_FEEDBACK: '删除反馈',
  };
  return labels[action] || action;
};

const getModuleLabel = (module: string) => {
  return modules.find((item) => item.value === module)?.label || module || '未知模块';
};

const getModuleTone = (module: string) => {
  return modules.find((item) => item.value === module)?.tone || 'tone-default';
};

const getSeverity = (action: string): AuditSeverity => {
  if (/DELETE|RESET_PASSWORD|REVOKE|BAN|CLEANUP|REJECT/.test(action)) return 'high';
  if (/UPDATE_SETTINGS|BATCH|APPROVE|CREATE_USER|UPDATE_USER/.test(action)) return 'medium';
  return 'low';
};

const getSeverityLabel = (action: string) => {
  const severity = getSeverity(action);
  if (severity === 'high') return '高';
  if (severity === 'medium') return '中';
  return '低';
};

const getAgentLabel = (userAgent?: string | null) => {
  if (!userAgent) return '未知设备';
  if (/Edg/i.test(userAgent)) return 'Microsoft Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return userAgent.split(' ')[0] || '未知设备';
};

const getActorName = (user?: User | null) => user?.name || user?.email || 'System';

const prettyJson = (value?: string | null) => {
  if (!value) return '无';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

watch([moduleFilter, actionFilter, searchFilter, userIdFilter, dateFrom, dateTo, pageSize], () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage.value = 1;
    fetchLogs();
  }, 260);
});

watch(autoRefresh, syncLiveTimer);

onMounted(() => {
  fetchLogs();
  syncLiveTimer();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (liveTimer) clearInterval(liveTimer);
});
</script>

<template>
  <div class="audit-console">
    <header class="audit-command">
      <div class="title-row">
        <div class="title-copy">
          <span class="panel-icon">
            <Terminal />
          </span>
          <div>
            <div class="title-heading-row">
              <h1>审计日志</h1>
              <div class="header-stats">
                <span class="stat-item"
                  >匹配: <b>{{ total }}</b></span
                >
                <span class="stat-divider">|</span>
                <span class="stat-item"
                  >高风险: <b>{{ highRiskCount }}</b></span
                >
                <span class="stat-divider">|</span>
                <span class="stat-item"
                  >最新事件: <b>{{ latestLogTime }}</b></span
                >
                <span class="stat-divider">|</span>
                <span class="stat-item"
                  >筛选: <b>{{ activeFilters }}</b></span
                >
              </div>
            </div>
            <p>追踪后台关键操作、来源、风险动作与操作者行为。</p>
          </div>
        </div>

        <div class="command-actions">
          <button
            type="button"
            class="ghost-button"
            :class="{ active: showAdvancedFilters }"
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            <SlidersHorizontal />
            高级筛选
          </button>
          <button
            type="button"
            class="ghost-button"
            :class="{ active: autoRefresh }"
            @click="toggleAutoRefresh"
          >
            <Pause v-if="autoRefresh" />
            <Play v-else />
            {{ autoRefresh ? '实时中' : '实时' }}
          </button>
          <button type="button" class="ghost-button" @click="resetFilters">
            <X />
            清空
          </button>
          <button type="button" class="ghost-button" :disabled="isExporting" @click="exportCsv">
            <Download />
            {{ isExporting ? '导出中' : '导出 CSV' }}
          </button>
          <button type="button" class="primary-button" @click="fetchLogs">
            <RefreshCw :class="{ spinning: isLoading }" />
            刷新
          </button>
        </div>
      </div>

      <div class="filter-bar-row">
        <label class="search-box">
          <Search />
          <input
            v-model="searchFilter"
            type="text"
            placeholder="搜索描述、模块、动作、IP、操作者"
          />
        </label>
      </div>

      <div v-show="showAdvancedFilters" class="advanced-filters-grid">
        <label class="filter-field">
          <Filter />
          <select v-model="moduleFilter">
            <option v-for="item in modules" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label class="filter-field">
          <FileSearch />
          <input v-model="actionFilter" type="text" placeholder="动作，例如 LOGIN" />
        </label>
        <label class="date-field">
          <Clock3 />
          <input
            v-model="dateFrom"
            type="date"
            class="cursor-pointer"
            @click="(e) => 'showPicker' in (e.target as any) && (e.target as any).showPicker()"
          />
        </label>
        <span class="text-slate-400">-</span>
        <label class="date-field">
          <Clock3 />
          <input
            v-model="dateTo"
            type="date"
            class="cursor-pointer"
            @click="(e) => 'showPicker' in (e.target as any) && (e.target as any).showPicker()"
          />
        </label>
      </div>

      <div class="quick-strip">
        <button
          v-for="item in summary.modules.slice(0, 9)"
          :key="item.module"
          type="button"
          class="summary-chip"
          :class="[getModuleTone(item.module || ''), { active: moduleFilter === item.module }]"
          @click="selectModule(item.module)"
        >
          {{ getModuleLabel(item.module || '') }}
          <b>{{ item.count }}</b>
        </button>
        <button
          v-for="item in summary.actions.slice(0, 5)"
          :key="item.action"
          type="button"
          class="summary-chip action-chip"
          :class="{ active: actionFilter === item.action }"
          @click="selectAction(item.action)"
        >
          {{ getActionLabel(item.action || '') }}
          <b>{{ item.count }}</b>
        </button>
        <button
          v-if="userIdFilter"
          type="button"
          class="summary-chip active"
          @click="userIdFilter = ''"
        >
          <UserRound />
          已筛操作者
          <X />
        </button>
      </div>
    </header>

    <main class="audit-body">
      <section class="ledger-panel">
        <div class="ledger-toolbar">
          <div>
            <strong>事件流</strong>
            <span>{{ visibleRange }} / {{ total }} 条</span>
          </div>
          <div class="toolbar-controls">
            <label>
              <SlidersHorizontal />
              <select v-model.number="pageSize">
                <option :value="25">25 条</option>
                <option :value="50">50 条</option>
                <option :value="100">100 条</option>
                <option :value="200">200 条</option>
              </select>
            </label>
          </div>
        </div>

        <div class="table-scroll">
          <table class="audit-table">
            <colgroup>
              <col class="col-time" />
              <col class="col-actor" />
              <col class="col-module" />
              <col class="col-action" />
              <col class="col-risk" />
              <col class="col-source" />
              <col />
              <col class="col-detail" />
            </colgroup>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>模块</th>
                <th>动作</th>
                <th>风险</th>
                <th>来源</th>
                <th>描述</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading">
                <td colspan="8" class="empty-cell">
                  <RefreshCw class="spinning" />
                  正在加载审计记录
                </td>
              </tr>
              <tr
                v-for="log in logs"
                v-else
                :key="log.id"
                :class="{ selected: selectedLog?.id === log.id }"
                @click="selectedLog = log"
              >
                <td class="time-cell">
                  <div class="time-container">
                    <strong>{{ formatShortDate(log.createdAt) }}</strong>
                    <span class="relative-time">{{ formatRelative(log.createdAt) }}</span>
                  </div>
                </td>
                <td>
                  <div class="user-cell">
                    <UserAvatar :user="log.user" size="xs" />
                    <div class="user-info">
                      <p :title="log.user?.email || 'SYSTEM'">{{ getActorName(log.user) }}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="status-pill" :class="getModuleTone(log.module)">
                    {{ getModuleLabel(log.module) }}
                  </span>
                </td>
                <td>
                  <div class="action-cell-content">
                    <button
                      type="button"
                      class="text-action"
                      @click.stop="selectAction(log.action)"
                    >
                      {{ getActionLabel(log.action) }}
                    </button>
                    <small class="action-raw-code">{{ log.action }}</small>
                  </div>
                </td>
                <td>
                  <span class="risk-pill" :class="`risk-${getSeverity(log.action)}`">
                    {{ getSeverityLabel(log.action) }}
                  </span>
                </td>
                <td>
                  <div class="source-cell-content">
                    <button
                      type="button"
                      class="source-button"
                      @click.stop="selectSource(log.ipAddress)"
                    >
                      {{ log.ipAddress || '-' }}
                    </button>
                    <small class="agent-label-text">{{ getAgentLabel(log.userAgent) }}</small>
                  </div>
                </td>
                <td>
                  <p class="description-cell" :title="log.description || ''">
                    {{ log.description || '-' }}
                  </p>
                </td>
                <td>
                  <button
                    type="button"
                    class="icon-button"
                    title="查看详情"
                    @click.stop="selectedLog = log"
                  >
                    <Eye />
                  </button>
                </td>
              </tr>
              <tr v-if="!isLoading && logs.length === 0">
                <td colspan="8" class="empty-cell">
                  <ShieldCheck />
                  没有匹配的审计记录
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pagination-bar">
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
          <div>
            <button
              type="button"
              class="icon-button"
              :disabled="currentPage === 1"
              @click="setPage(1)"
            >
              <ChevronsLeft />
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="currentPage === 1"
              @click="setPage(currentPage - 1)"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="currentPage === totalPages"
              @click="setPage(currentPage + 1)"
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="currentPage === totalPages"
              @click="setPage(totalPages)"
            >
              <ChevronsRight />
            </button>
          </div>
        </footer>
      </section>

      <aside class="insights-panel">
        <section class="insight-block">
          <div class="block-title">
            <AlertTriangle />
            <strong>风险分布</strong>
          </div>
          <div class="risk-stack">
            <button
              v-for="item in severityBars"
              :key="item.key"
              type="button"
              class="risk-row"
              :class="item.tone"
            >
              <span>{{ item.label }}</span>
              <b>{{ item.value }}</b>
              <i :style="{ width: `${severityTotal ? (item.value / severityTotal) * 100 : 0}%` }" />
            </button>
          </div>
        </section>

        <section class="insight-block">
          <div class="block-title">
            <BarChart3 />
            <strong>{{
              insights.windowDays ? `${insights.windowDays} 天趋势` : '筛选趋势'
            }}</strong>
          </div>
          <div class="trend-chart">
            <div v-for="item in insights.trend" :key="item.date" class="trend-bar">
              <span :style="{ height: `${Math.max(8, (item.total / maxTrendValue) * 100)}%` }" />
              <small>{{ formatDay(item.date) }}</small>
            </div>
            <p v-if="!insights.trend.length" class="empty-line">暂无趋势数据</p>
          </div>
        </section>

        <section class="insight-block ranking-tabs-block">
          <div class="tabs-header">
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeInsightTab === 'actors' }"
              @click="activeInsightTab = 'actors'"
            >
              <UserRound class="tab-icon" />
              <span>操作者</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeInsightTab === 'modules' }"
              @click="activeInsightTab = 'modules'"
            >
              <Activity class="tab-icon" />
              <span>模块</span>
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeInsightTab === 'sources' }"
              @click="activeInsightTab = 'sources'"
            >
              <Globe2 class="tab-icon" />
              <span>IP 来源</span>
            </button>
          </div>

          <div class="tab-content">
            <!-- Active Actors Tab -->
            <div v-if="activeInsightTab === 'actors'" class="tab-pane">
              <button
                v-for="item in insights.actors.slice(0, 5)"
                :key="item.userId || 'system'"
                type="button"
                class="actor-row"
                :class="{ active: userIdFilter === item.userId }"
                @click="selectActor(item)"
              >
                <UserAvatar :user="item.user" size="xs" />
                <span class="actor-name">{{ getActorName(item.user) }}</span>
                <b class="count-badge">{{ item.count }}</b>
              </button>
              <p v-if="!insights.actors.length" class="empty-line">暂无操作者数据</p>
            </div>

            <!-- Active Modules Tab -->
            <div v-if="activeInsightTab === 'modules'" class="tab-pane">
              <button
                v-for="item in summary.modules.slice(0, 5)"
                :key="item.module"
                type="button"
                class="rank-row"
                :class="{ active: moduleFilter === item.module }"
                @click="selectModule(item.module)"
              >
                <span>{{ getModuleLabel(item.module || '') }}</span>
                <b>{{ item.count }}</b>
                <i :style="{ width: `${(item.count / moduleTotal) * 100}%` }" />
              </button>
              <p v-if="!summary.modules.length" class="empty-line">暂无模块数据</p>
            </div>

            <!-- Source IP Tab -->
            <div v-if="activeInsightTab === 'sources'" class="tab-pane">
              <button
                v-for="item in insights.sources.slice(0, 5)"
                :key="item.ipAddress || 'unknown'"
                type="button"
                class="mini-row"
                @click="selectSource(item.ipAddress)"
              >
                <span>{{ item.ipAddress || '未知来源' }}</span>
                <b>{{ item.count }}</b>
              </button>
              <p v-if="!insights.sources.length" class="empty-line">暂无来源数据</p>
            </div>
          </div>
        </section>
      </aside>
    </main>

    <div v-if="selectedLog" class="drawer-shell" @click="selectedLog = null">
      <aside class="detail-drawer" @click.stop>
        <header>
          <div>
            <span class="status-pill" :class="getModuleTone(selectedLog.module)">
              {{ getModuleLabel(selectedLog.module) }}
            </span>
            <h2>{{ getActionLabel(selectedLog.action) }}</h2>
            <p>{{ selectedLog.id }}</p>
          </div>
          <div class="drawer-actions">
            <button
              type="button"
              class="icon-button"
              title="复制 ID"
              @click="copyValue(selectedLog.id, '日志 ID')"
            >
              <Copy />
            </button>
            <button type="button" class="icon-button" title="关闭" @click="selectedLog = null">
              <X />
            </button>
          </div>
        </header>

        <div class="detail-grid">
          <div>
            <span>时间</span><b>{{ formatDate(selectedLog.createdAt) }}</b>
          </div>
          <div>
            <span>风险等级</span><b>{{ getSeverityLabel(selectedLog.action) }}风险</b>
          </div>
          <div>
            <span>IP</span><b>{{ selectedLog.ipAddress || '-' }}</b>
          </div>
          <div>
            <span>设备</span><b>{{ getAgentLabel(selectedLog.userAgent) }}</b>
          </div>
        </div>

        <section class="detail-section">
          <h3>操作者</h3>
          <div class="drawer-user">
            <UserAvatar :user="selectedLog.user" size="md" />
            <div>
              <strong>{{ getActorName(selectedLog.user) }}</strong>
              <span>{{ selectedLog.user?.email || 'SYSTEM' }}</span>
            </div>
          </div>
        </section>

        <section class="detail-section">
          <h3>描述</h3>
          <p>{{ selectedLog.description || '无' }}</p>
        </section>

        <section class="detail-section">
          <h3>User Agent</h3>
          <p class="break-text">{{ selectedLog.userAgent || '无' }}</p>
        </section>

        <div class="json-grid">
          <section class="detail-section">
            <h3>旧值</h3>
            <pre>{{ prettyJson(selectedLog.oldValue) }}</pre>
          </section>
          <section class="detail-section">
            <h3>新值</h3>
            <pre>{{ prettyJson(selectedLog.newValue) }}</pre>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.audit-console {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

h1,
h2,
h3,
p {
  margin: 0;
}

button,
select,
input {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.audit-command {
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-card);
}

.title-row,
.title-copy,
.command-actions,
.quick-strip,
.ledger-toolbar,
.pagination-bar,
.pagination-bar > div,
.toolbar-controls,
.toolbar-controls label,
.block-title,
.user-cell,
.drawer-user,
.drawer-actions {
  display: flex;
  align-items: center;
}

.title-row {
  justify-content: space-between;
  gap: 16px;
}

.title-copy {
  min-width: 0;
  gap: 10px;
  display: flex;
  align-items: center;
}

.title-heading-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(var(--accent-rgb), 0.05);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px dashed rgba(var(--accent-rgb), 0.15);
  line-height: 1.2;
}

.stat-item {
  white-space: nowrap;
}

.stat-item b {
  color: var(--text-primary);
  font-weight: 700;
}

.stat-divider {
  color: rgba(var(--accent-rgb), 0.25);
  font-weight: bold;
}

.panel-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #111827;
  color: white;
}

.panel-icon svg,
.command-actions svg,
.filter-grid svg,
.quick-strip svg,
.toolbar-controls svg,
.block-title svg,
.icon-button svg,
.primary-button svg,
.ghost-button svg,
.text-action svg {
  width: 14px;
  height: 14px;
}

.title-copy h1 {
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.title-copy p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
}

.command-actions {
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-button,
.ghost-button,
.icon-button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 900;
}

.primary-button {
  padding: 0 10px;
  color: white;
  background: var(--accent);
}

.ghost-button {
  padding: 0 9px;
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  background: var(--bg-app);
}

.ghost-button.active {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.08);
}

.icon-button {
  width: 30px;
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  background: var(--bg-app);
}

.ghost-button:hover,
.icon-button:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
}

.filter-bar-row {
  width: 100%;
}

.advanced-filters-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 130px 140px 125px 125px;
  gap: 6px;
}

.search-box,
.filter-field,
.date-field {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
}

.search-box input,
.filter-field input,
.filter-field select,
.date-field input,
.toolbar-controls select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 11px;
}

.quick-strip {
  gap: 5px;
  overflow-x: auto;
  padding-bottom: 1px;
}

.summary-chip {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 10px;
  font-weight: 900;
}

.summary-chip b {
  color: var(--text-primary);
}

.summary-chip.active {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.08);
}

.audit-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 8px;
  padding: 8px;
}

.ledger-panel,
.insights-panel,
.insight-block {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.ledger-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ledger-toolbar {
  min-height: 38px;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-base);
}

.ledger-toolbar strong {
  display: block;
  font-size: 12px;
  font-weight: 950;
}

.ledger-toolbar span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
}

.toolbar-controls label {
  min-height: 28px;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.audit-table {
  min-width: 1080px;
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.col-time {
  width: 118px;
}

.col-actor {
  width: 150px;
}

.col-module {
  width: 96px;
}

.col-action {
  width: 130px;
}

.col-risk {
  width: 60px;
}

.col-source {
  width: 130px;
}

.col-detail {
  width: 44px;
}

.audit-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 950;
}

.audit-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border-base);
  vertical-align: middle;
  font-size: 11px;
}

.audit-table tbody tr {
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.audit-table tbody tr:hover,
.audit-table tbody tr.selected {
  background: rgba(var(--accent-rgb), 0.05);
}

.time-container {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.time-container strong {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.2;
}

.relative-time {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1;
}

.user-cell {
  min-width: 0;
  gap: 6px;
}

.user-info {
  min-width: 0;
}

.user-info p {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.status-pill,
.risk-pill {
  min-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
}

.action-cell-content,
.source-cell-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.action-raw-code,
.agent-label-text {
  font-size: 9px;
  color: var(--text-muted);
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.tone-settings,
.tone-project {
  color: #0369a1;
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.22);
}

.tone-user,
.tone-plugin {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.1);
  border-color: rgba(124, 58, 237, 0.22);
}

.tone-team,
.tone-auth {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.24);
}

.tone-course,
.tone-task {
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.22);
}

.tone-asset {
  color: #c2410c;
  background: rgba(249, 115, 22, 0.12);
  border-color: rgba(249, 115, 22, 0.24);
}

.tone-material {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.12);
  border-color: rgba(20, 184, 166, 0.24);
}

.tone-showcase,
.tone-feedback {
  color: #be123c;
  background: rgba(244, 63, 94, 0.1);
  border-color: rgba(244, 63, 94, 0.22);
}

.tone-default {
  color: var(--text-secondary);
  background: var(--bg-app);
  border-color: var(--border-base);
}

.text-action,
.source-button {
  max-width: 100%;
  padding: 0;
  color: var(--text-primary);
  background: transparent;
  font-size: 11px;
  font-weight: 950;
  text-align: left;
  line-height: 1.2;
}

.source-button {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.text-action:hover,
.source-button:hover {
  color: var(--accent);
}

.risk-high {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
}

.risk-medium {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.32);
}

.risk-low {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
}

.description-cell {
  display: -webkit-box;
  max-width: 520px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.empty-cell {
  height: 220px;
  color: var(--text-secondary);
  text-align: center;
}

.empty-cell svg {
  width: 24px;
  height: 24px;
  display: block;
  margin: 0 auto 8px;
}

.pagination-bar {
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 900;
}

.pagination-bar > div {
  gap: 6px;
}

.insights-panel {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 8px;
  overflow: auto;
}

.insight-block {
  padding: 8px;
}

.block-title {
  gap: 6px;
  margin-bottom: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 950;
  display: flex;
  align-items: center;
}

.block-title svg {
  color: var(--accent);
  width: 14px;
  height: 14px;
}

.risk-stack,
.trend-chart {
  display: grid;
  gap: 6px;
}

.risk-row,
.rank-row,
.mini-row,
.actor-row {
  position: relative;
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  overflow: hidden;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 900;
}

.risk-row i,
.rank-row i {
  position: absolute;
  inset: auto auto 0 0;
  height: 2px;
  border-radius: 999px;
}

.risk-high i,
.risk-row.risk-high i {
  background: #ef4444;
}

.risk-medium i,
.risk-row.risk-medium i {
  background: #f59e0b;
}

.risk-low i,
.risk-row.risk-low i {
  background: #10b981;
}

.rank-row i {
  background: var(--accent);
}

.rank-row.active,
.actor-row.active {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
}

.trend-chart {
  min-height: 98px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: end;
}

.trend-bar {
  min-width: 0;
  height: 88px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 4px;
  align-items: end;
  justify-items: center;
}

.trend-bar span {
  width: 100%;
  max-width: 12px;
  border-radius: 999px 999px 2px 2px;
  background: linear-gradient(180deg, var(--accent), #14b8a6);
}

.trend-bar small {
  color: var(--text-muted);
  font-size: 9px;
  writing-mode: vertical-rl;
}

.actor-row {
  justify-content: flex-start;
  gap: 6px;
}

.actor-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.actor-row b,
.count-badge {
  margin-left: auto;
  font-size: 10px;
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 4px;
}

.ranking-tabs-block {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-app);
  padding: 2px;
  gap: 2px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(var(--accent-rgb), 0.04);
}

.tab-btn.active {
  color: var(--accent);
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tab-btn .tab-icon {
  width: 12px;
  height: 12px;
}

.tab-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 180px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.empty-line {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
}

.drawer-shell {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
}

.detail-drawer {
  width: min(760px, 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  border-left: 1px solid var(--border-base);
  background: var(--bg-card);
  padding: 16px;
  box-shadow: -18px 0 50px rgba(15, 23, 42, 0.24);
}

.detail-drawer header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}

.detail-drawer h2 {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 950;
}

.detail-drawer header p {
  margin-top: 4px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.drawer-actions {
  gap: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.detail-grid div,
.detail-section {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  padding: 10px;
}

.detail-grid span,
.detail-section h3 {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 950;
}

.detail-grid b,
.detail-section p {
  margin-top: 5px;
  display: block;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.6;
}

.drawer-user {
  gap: 10px;
  margin-top: 8px;
}

.drawer-user strong,
.drawer-user span {
  display: block;
}

.drawer-user strong {
  font-size: 13px;
  font-weight: 950;
}

.drawer-user span {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.break-text {
  word-break: break-word;
}

.json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-section pre {
  max-height: 340px;
  margin: 8px 0 0;
  overflow: auto;
  border-radius: 8px;
  background: #111827;
  padding: 10px;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.6;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .audit-body {
    grid-template-columns: 1fr;
  }

  .insights-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
  }
}

@media (max-width: 980px) {
  .title-row,
  .workbench-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .command-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .filter-grid,
  .detail-grid,
  .json-grid,
  .insights-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .audit-command,
  .audit-body {
    padding: 10px;
  }

  .ledger-toolbar,
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .command-actions {
    gap: 6px;
  }

  .primary-button,
  .ghost-button {
    min-height: 30px;
    padding: 0 9px;
    font-size: 11px;
  }

  .summary-chip {
    min-height: 26px;
    padding: 0 8px;
    font-size: 10px;
  }

  .audit-table {
    min-width: 860px;
  }

  .audit-table th,
  .audit-table td {
    padding: 8px 9px;
    font-size: 11px;
  }
}
</style>
