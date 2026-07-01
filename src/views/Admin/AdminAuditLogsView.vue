<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Download,
  Eye,
  FileSearch,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { User } from '@/types';
import { useAuditLogHelpers, AUDIT_MODULES } from '@/composables/useAuditLogHelpers';

// UI components
import PageHeader from '@/components/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';
import AuditLogDetailModal, { type AuditLog } from './components/AuditLogDetailModal.vue';

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
const detailModalVisible = computed({
  get: () => !!selectedLog.value,
  set: (val) => {
    if (!val) selectedLog.value = null;
  },
});
const tableRowClassName = ({ row }: { row: AuditLog }) => {
  return selectedLog.value?.id === row.id ? 'selected-row' : '';
};
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

const {
  getActionLabel,
  getModuleLabel,
  getModuleTone,
  getSeverity,
  getSeverityLabel,
  getAgentLabel,
  getActorName,
  formatShortDate,
  formatRelative,
  formatDay,
} = useAuditLogHelpers();

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
  <div class="audit-console flex flex-1 min-h-0 flex-col overflow-hidden mobile-adaptive">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <PageHeader
        title="审计日志"
        subtitle="追踪后台关键操作、来源、风险动作与操作者行为。"
        variant="card"
      >
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info">匹配: {{ total }}</Badge>
            <Badge :variant="highRiskCount > 0 ? 'danger' : 'info'"
              >高风险: {{ highRiskCount }}</Badge
            >
            <Badge variant="info">最新事件: {{ latestLogTime }}</Badge>
            <Badge :variant="activeFilters > 0 ? 'warning' : 'info'"
              >筛选: {{ activeFilters }}</Badge
            >
          </div>
        </template>

        <template #center>
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input v-model="searchFilter" type="text" placeholder="搜索描述、 IP、操作者..." />
          </label>
        </template>

        <Button
          variant="secondary"
          size="sm"
          :class="{ active: showAdvancedFilters }"
          :icon="SlidersHorizontal"
          @click="showAdvancedFilters = !showAdvancedFilters"
        >
          高级筛选
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :class="{ active: autoRefresh }"
          :icon="autoRefresh ? Pause : Play"
          @click="toggleAutoRefresh"
        >
          {{ autoRefresh ? '实时中' : '实时' }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :disabled="isExporting"
          :icon="Download"
          @click="exportCsv"
        >
          {{ isExporting ? '导出中' : '导出 CSV' }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchLogs"
        >
          刷新
        </Button>
      </PageHeader>
      <!-- Sub-header for Search & Quick Strip inside a Card -->
      <Card padding="sm" class="audit-command-card">
        <div v-show="showAdvancedFilters" class="advanced-filters-grid mb-3">
          <label class="filter-field">
            <Filter />
            <select v-model="moduleFilter">
              <option v-for="item in AUDIT_MODULES" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>
          <label class="filter-field">
            <FileSearch />
            <input v-model="actionFilter" type="text" placeholder="动作，例如 LOGIN" />
          </label>
          <div class="date-range-container">
            <Clock3 class="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
            <input
              v-model="dateFrom"
              type="date"
              class="cursor-pointer text-center"
              @click="
                (e) => {
                  const target = e.target as HTMLInputElement & { showPicker?: () => void };
                  target.showPicker?.();
                }
              "
            />
            <span class="text-slate-400 text-xs shrink-0 px-0.5">-</span>
            <input
              v-model="dateTo"
              type="date"
              class="cursor-pointer text-center"
              @click="
                (e) => {
                  const target = e.target as HTMLInputElement & { showPicker?: () => void };
                  target.showPicker?.();
                }
              "
            />
          </div>
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
      </Card>

      <div class="audit-body">
        <!-- Reusable Card for the event ledger table -->
        <Card padding="none" class="ledger-panel">
          <div class="table-wrap flex-1 min-h-0 overflow-auto">
            <el-table
              v-loading="isLoading"
              :data="logs"
              class="user-table w-full mobile-table"
              :row-class-name="tableRowClassName"
              row-key="id"
              @row-click="(row) => (selectedLog = row)"
            >
              <!-- Time Column -->
              <el-table-column label="时间" width="118">
                <template #default="{ row }">
                  <div class="time-container">
                    <strong>{{ formatShortDate(row.createdAt) }}</strong>
                    <span class="relative-time">{{ formatRelative(row.createdAt) }}</span>
                  </div>
                </template>
              </el-table-column>

              <!-- Actor Column -->
              <el-table-column label="操作者" width="150">
                <template #default="{ row }">
                  <div class="user-cell">
                    <UserAvatar :user="row.user" size="xs" />
                    <div class="user-info">
                      <p :title="row.user?.email || 'SYSTEM'">{{ getActorName(row.user) }}</p>
                    </div>
                  </div>
                </template>
              </el-table-column>

              <!-- Module Column -->
              <el-table-column label="模块" width="96">
                <template #default="{ row }">
                  <span class="status-pill" :class="getModuleTone(row.module)">
                    {{ getModuleLabel(row.module) }}
                  </span>
                </template>
              </el-table-column>

              <!-- Action Column -->
              <el-table-column label="动作" width="130">
                <template #default="{ row }">
                  <div class="action-cell-content">
                    <button
                      type="button"
                      class="text-action"
                      @click.stop="selectAction(row.action)"
                    >
                      {{ getActionLabel(row.action) }}
                    </button>
                    <small class="action-raw-code">{{ row.action }}</small>
                  </div>
                </template>
              </el-table-column>

              <!-- Risk Column -->
              <el-table-column label="风险" width="60">
                <template #default="{ row }">
                  <span class="risk-pill" :class="`risk-${getSeverity(row.action)}`">
                    {{ getSeverityLabel(row.action) }}
                  </span>
                </template>
              </el-table-column>

              <!-- Source Column -->
              <el-table-column label="来源" width="130">
                <template #default="{ row }">
                  <div class="source-cell-content">
                    <button
                      type="button"
                      class="source-button"
                      @click.stop="selectSource(row.ipAddress)"
                    >
                      {{ row.ipAddress || '-' }}
                    </button>
                    <small class="agent-label-text">{{ getAgentLabel(row.userAgent) }}</small>
                  </div>
                </template>
              </el-table-column>

              <!-- Description Column -->
              <el-table-column label="描述" min-width="200">
                <template #default="{ row }">
                  <p class="description-cell" :title="row.description || ''">
                    {{ row.description || '-' }}
                  </p>
                </template>
              </el-table-column>

              <!-- Detail Action Column -->
              <el-table-column label="详情" width="55" align="right">
                <template #default="{ row }">
                  <button
                    type="button"
                    class="icon-button"
                    title="查看详情"
                    @click.stop="selectedLog = row"
                  >
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Pagination wrap -->
          <div
            class="pagination-wrap mt-4 flex items-center justify-between p-3 border-t border-slate-100 dark:border-white/5 bg-white/40 dark:bg-transparent mobile-row"
          >
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[25, 50, 100, 200]"
              :total="total"
              layout="total, sizes, prev, pager, next"
              @current-change="fetchLogs"
            />
          </div>
        </Card>

        <!-- Sidebar insights wrapped in Cards -->
        <aside class="insights-panel">
          <!-- Card 1: Risk Distribution -->
          <Card padding="sm">
            <div class="block-title flex items-center gap-1.5 mb-2.5">
              <AlertTriangle class="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <strong class="text-xs font-bold text-[var(--text-primary)]">风险分布</strong>
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
                <i
                  :style="{ width: `${severityTotal ? (item.value / severityTotal) * 100 : 0}%` }"
                />
              </button>
            </div>
          </Card>

          <!-- Card 2: Trend Chart -->
          <Card padding="sm">
            <div class="block-title flex items-center gap-1.5 mb-2.5">
              <BarChart3 class="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <strong class="text-xs font-bold text-[var(--text-primary)]">
                {{ insights.windowDays ? `${insights.windowDays} 天趋势` : '筛选趋势' }}
              </strong>
            </div>
            <div class="trend-chart">
              <div v-for="item in insights.trend" :key="item.date" class="trend-bar">
                <span :style="{ height: `${Math.max(8, (item.total / maxTrendValue) * 100)}%` }" />
                <small>{{ formatDay(item.date) }}</small>
              </div>
              <p v-if="!insights.trend.length" class="empty-line">暂无趋势数据</p>
            </div>
          </Card>

          <!-- Card 3: Association Insights Ranking (Tabbed) -->
          <Card padding="sm" class="ranking-tabs-block flex flex-col min-h-0">
            <div
              class="tabs-header flex items-center justify-between gap-1.5 mb-2 border-none p-0 min-h-0 bg-transparent"
            >
              <strong class="text-xs font-bold text-[var(--text-primary)]">关联分析</strong>
              <Tabs
                v-model="activeInsightTab"
                :options="[
                  { label: '操作者', value: 'actors' },
                  { label: '模块', value: 'modules' },
                  { label: 'IP 来源', value: 'sources' },
                ]"
                size="sm"
                variant="solid"
              />
            </div>

            <div class="tab-content">
              <!-- Active Actors Tab -->
              <div v-show="activeInsightTab === 'actors'" class="tab-pane">
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
              <div v-show="activeInsightTab === 'modules'" class="tab-pane">
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
              <div v-show="activeInsightTab === 'sources'" class="tab-pane">
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
          </Card>
        </aside>
      </div>
    </main>

    <!-- Refactored Log Details Modal using Modal, UserAvatar components with Glassmorphism styles -->
    <AuditLogDetailModal v-model="detailModalVisible" :log="selectedLog" />
  </div>
</template>

<style scoped>
.audit-console {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
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

/* Floating command overrides */

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

.advanced-filters-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) 130px 140px 125px 125px;
  gap: 6px;
}

.filter-field,
.date-field,
.date-range-container {
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

.filter-field input,
.filter-field select,
.date-field input,
.date-range-container input,
.toolbar-controls select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 11px;
}

.date-range-container input {
  flex: 1;
  text-align: center;
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
  gap: 12px;
}

.ledger-panel {
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

.user-table :deep(.el-table__header th) {
  height: 40px;
  background: var(--bg-subtle) !important;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 800;
}

.user-table :deep(.el-table__row) {
  height: 48px;
  cursor: pointer;
}

.user-table :deep(.el-table__cell) {
  padding: 4px 0;
}

.user-table :deep(.selected-row > td.el-table__cell) {
  background-color: rgba(var(--accent-rgb), 0.08) !important;
}

.user-table :deep(.el-table__row:hover > td.el-table__cell) {
  background-color: rgba(var(--accent-rgb), 0.05) !important;
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

.insights-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.spinning {
  /* @keyframes spin provided globally; only duration differs from the 1s default */
  animation-duration: 0.9s;
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
  .advanced-filters-grid,
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
