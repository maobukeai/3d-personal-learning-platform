<script setup lang="ts">
import { computed } from 'vue';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock3,
  Eye,
  FileStack,
  PackageCheck,
  TrendingUp,
  XCircle,
} from 'lucide-vue-next';
import {
  formatResourceNumber as formatNumber,
  formatResourceStorage as formatStorage,
  getLibraryProgress,
  type ResourceLibrary,
  type ResourceOverview,
} from '../resourceCenterModel';

const props = defineProps<{
  overview: ResourceOverview | null;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'openLibrary', library: ResourceLibrary): void;
  (e: 'reviewCta', path: string): void;
}>();

const summary = computed(() => props.overview?.summary);
const reviewPressure = computed(() => props.overview?.reviewPressure);
const isAdminOverview = computed(() => props.overview?.scope === 'admin');
const hasReviewPressure = computed(() => {
  const pressure = reviewPressure.value;
  return Boolean(pressure && pressure.level !== 'none' && (pressure.pending || pressure.rejected));
});

const summaryCards = computed(() => {
  const pressure = reviewPressure.value;
  return [
    {
      label: isAdminOverview.value ? '全站公开' : '公开内容',
      value: formatNumber(summary.value?.totalPublic || 0),
      meta: `本周 +${formatNumber(summary.value?.weekAdded || 0)}`,
      icon: FileStack,
      tone: 'blue',
    },
    {
      label: isAdminOverview.value ? '运营对象' : '我的提交',
      value: formatNumber(summary.value?.myItems || 0),
      meta: isAdminOverview.value
        ? `${formatNumber(summary.value?.pendingReview || 0)} 待审 / ${formatNumber(summary.value?.rejectedReview || 0)} 已打回`
        : `${formatNumber(summary.value?.pendingReview || 0)} 个待审核`,
      icon: PackageCheck,
      tone: 'green',
    },
    {
      label: isAdminOverview.value ? '审核压力' : '通过率',
      value: isAdminOverview.value
        ? formatNumber(pressure?.pending || summary.value?.pendingReview || 0)
        : `${summary.value?.readyRate ?? 100}%`,
      meta: isAdminOverview.value
        ? `${formatNumber(pressure?.stale || 0)} 个超 ${pressure?.staleThresholdHours || 48} 小时`
        : `${formatNumber(summary.value?.reviewPressure || 0)} 个待处理`,
      icon: Eye,
      tone:
        pressure?.level === 'high' || (summary.value?.reviewPressure || 0) > 0 ? 'amber' : 'green',
    },
    {
      label: '全站互动',
      value: formatNumber(summary.value?.interactions || 0),
      meta: '下载 / 浏览 / 收藏 / 评论',
      icon: TrendingUp,
      tone: 'rose',
    },
    {
      label: isAdminOverview.value ? '占用统计' : '我的存储',
      value: formatStorage(summary.value?.storageMb || 0),
      meta: `${formatNumber(summary.value?.rejectedReview || 0)} 个需处理`,
      icon: BarChart3,
      tone: 'amber',
    },
  ];
});
</script>

<template>
  <div v-show="isStatsExpanded" class="stats-panel">
    <section class="kpi-strip">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="kpi-card"
        :data-tone="card.tone"
      >
        <component :is="card.icon" class="icon-sm" />
        <div>
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.meta }}</small>
        </div>
      </article>
    </section>

    <section v-if="reviewPressure" class="pressure-banner" :data-level="reviewPressure.level">
      <div>
        <AlertTriangle class="icon-md" />
        <span>{{ isAdminOverview ? '审核压力' : '我的审核状态' }}</span>
        <strong>{{ reviewPressure.message }}</strong>
      </div>
      <button
        v-if="hasReviewPressure"
        type="button"
        class="ghost-button"
        @click="emit('reviewCta', reviewPressure.ctaPath)"
      >
        {{ isAdminOverview ? '进入审核中心' : '查看我的内容' }}
        <ArrowRight class="icon-sm" />
      </button>
    </section>

    <section class="library-grid">
      <button
        v-for="library in overview?.libraries || []"
        :key="library.key"
        type="button"
        class="library-card"
        @click="emit('openLibrary', library)"
      >
        <div class="library-head">
          <span>{{ library.label }}</span>
          <strong>{{ formatNumber(library.total) }}</strong>
        </div>
        <div class="library-metrics">
          <span>我的 {{ formatNumber(library.mine) }}</span>
          <span>本周 +{{ formatNumber(library.weekAdded) }}</span>
          <span>{{ library.metricLabel }} {{ formatNumber(library.metric) }}</span>
        </div>
        <div class="quality-line" :aria-label="`${library.label} 通过占比`">
          <i :style="{ width: `${getLibraryProgress(library)}%` }"></i>
        </div>
        <div class="library-foot">
          <span :class="{ warning: library.pending > 0 }">
            <Clock3 class="icon-xs" />{{ library.pending }} 待审核
          </span>
          <span :class="{ danger: library.rejected > 0 }">
            <XCircle class="icon-xs" />{{ library.rejected }} 需修改
          </span>
        </div>
      </button>
    </section>
  </div>
</template>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
}

.kpi-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.kpi-card > svg {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  padding: 5px;
  background: var(--bg-app);
  color: var(--tone-color);
  flex: 0 0 auto;
}

.kpi-card[data-tone='blue'] {
  --tone-color: #2563eb;
}

.kpi-card[data-tone='green'] {
  --tone-color: #059669;
}

.kpi-card[data-tone='rose'] {
  --tone-color: #e11d48;
}

.kpi-card[data-tone='amber'] {
  --tone-color: #d97706;
}

.kpi-card span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.kpi-card strong {
  display: block;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 1px;
}

.kpi-card small {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  margin-top: 1px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-md {
  width: 18px;
  height: 18px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.library-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 10px;
  text-align: left;
  transition: all 0.18s ease;
  box-shadow: var(--shadow-card);
}

.library-card:nth-child(1) {
  --tone-color: #2563eb;
}
.library-card:nth-child(2) {
  --tone-color: #d97706;
}
.library-card:nth-child(3) {
  --tone-color: #7c3aed;
}
.library-card:nth-child(4) {
  --tone-color: #059669;
}

.library-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.library-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library-head span {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.library-head strong {
  color: var(--tone-color);
  font-size: 15px;
  font-weight: 700;
}

.library-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.library-metrics span {
  border-radius: 4px;
  background: var(--bg-app);
  padding: 2px 6px;
  font-size: 10px;
  color: var(--text-secondary);
}

.quality-line {
  overflow: hidden;
  height: 3px;
  border-radius: 999px;
  background: var(--bg-app);
  margin: 2px 0;
}

.quality-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tone-color);
}

.library-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.library-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}

.library-foot .warning {
  color: var(--warning);
  font-weight: 500;
}

.library-foot .danger {
  color: var(--danger);
  font-weight: 500;
}

.pressure-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid rgba(5, 150, 105, 0.2);
  border-radius: 6px;
  background: rgba(5, 150, 105, 0.04);
}

.pressure-banner[data-level='watch'] {
  border-color: rgba(217, 119, 6, 0.25);
  background: rgba(217, 119, 6, 0.05);
}

.pressure-banner[data-level='high'] {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
}

.pressure-banner > div {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.pressure-banner svg {
  flex: 0 0 auto;
  color: var(--warning);
}

.pressure-banner span {
  flex: 0 0 auto;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.pressure-banner strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.15s ease;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

@media (max-width: 1180px) {
  .library-grid,
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pressure-banner {
    display: grid;
    grid-template-columns: 1fr;
  }

  .pressure-banner strong {
    white-space: normal;
  }

  .ghost-button {
    width: 100%;
    min-width: 0;
    height: 38px;
  }

  .library-grid,
  .kpi-strip {
    grid-template-columns: 1fr;
  }
}
</style>
