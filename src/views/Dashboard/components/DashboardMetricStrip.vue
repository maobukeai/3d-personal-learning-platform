<script setup lang="ts">
import { computed } from 'vue';
import { BookOpen, CheckSquare, Box, Star } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import { formatCompactNumber as formatNumber } from '@/utils/format';
import type {
  DashboardEnrollment,
  DashboardStatsResponse,
  WorkbenchData,
  MetricTile,
} from '../types';

const props = defineProps<{
  workbench: WorkbenchData | null;
  stats: DashboardStatsResponse | null;
  activeEnrollment: DashboardEnrollment | null;
  learningProgress: number;
  taskSummary: {
    todo: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
  };
  contentSummary: {
    total: number;
    approvedAssets: number;
    pendingAssets: number;
  };
  isSidebar?: boolean;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();

const metricTiles = computed<MetricTile[]>(() => [
  {
    id: 'learning',
    label: '学习推进',
    value: `${props.learningProgress}%`,
    detail: props.activeEnrollment
      ? props.activeEnrollment.course?.title || ''
      : `${props.workbench?.learning.enrollmentCount ?? 0} 门课程`,
    trend: props.stats?.trends?.learning,
    icon: BookOpen,
    route: props.activeEnrollment
      ? `/academy/player/${props.activeEnrollment.courseId}`
      : '/academy',
    tone: 'metric-blue',
  },
  {
    id: 'tasks',
    label: '任务负载',
    value: props.taskSummary.todo + props.taskSummary.inProgress,
    detail:
      props.taskSummary.overdue > 0
        ? `${props.taskSummary.overdue} 逾期`
        : `${props.taskSummary.completionRate}% 完成率`,
    trend: props.workbench?.command.productivityTrend ?? props.stats?.trends?.tasks,
    icon: CheckSquare,
    route: '/work',
    tone: props.taskSummary.overdue > 0 ? 'metric-red' : 'metric-amber',
  },
  {
    id: 'content',
    label: '内容资产',
    value: props.contentSummary.total,
    detail: `${props.contentSummary.approvedAssets} 通过 / ${props.contentSummary.pendingAssets} 审核`,
    trend: props.stats?.trends?.assets,
    icon: Box,
    route: '/assets',
    tone: 'metric-green',
  },
  {
    id: 'community',
    label: '社区积分',
    value: formatNumber(props.workbench?.profile?.points ?? props.stats?.points ?? 0),
    detail: props.workbench
      ? `${props.workbench.collaboration.unreadMessages} 私信未读`
      : '等待排行',
    trend: props.stats?.trends?.points,
    icon: Star,
    route: '/showcase',
    tone: 'metric-cyan',
  },
]);

function getTrendClass(trend?: string) {
  if (!trend || trend === '0' || trend === '0%') return 'trend-neutral';
  return trend.startsWith('-') ? 'trend-down' : 'trend-up';
}
</script>

<template>
  <section class="metric-strip" :class="{ 'sidebar-layout': isSidebar }" aria-label="核心指标">
    <Card
      v-for="metric in metricTiles"
      :key="metric.id"
      clickable
      hoverable
      glow
      glass
      class="metric-tile flex-row items-center !p-3 sm:!p-4"
      :class="metric.tone"
      padding="none"
      @click="emit('navigate', metric.route)"
    >
      <div class="mobile-row flex items-center justify-between w-full h-full min-w-0 gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <span class="metric-icon flex items-center justify-center rounded-lg w-9 h-9">
            <component :is="metric.icon" class="h-4.5 w-4.5" />
          </span>
          <span class="metric-copy flex flex-col">
            <span class="metric-label text-[10px] font-bold uppercase tracking-wider">
              {{ metric.label }}
            </span>
            <span class="metric-value text-xl font-extrabold leading-none my-0.5">
              {{ metric.value }}
            </span>
            <span class="metric-detail text-[10px] truncate opacity-80">
              {{ metric.detail }}
            </span>
          </span>
        </div>
        <Badge
          v-if="metric.trend"
          :variant="
            getTrendClass(metric.trend) === 'trend-up'
              ? 'success'
              : getTrendClass(metric.trend) === 'trend-down'
                ? 'danger'
                : 'primary'
          "
          outline
          class="shrink-0 scale-90"
        >
          {{ metric.trend }}
        </Badge>
      </div>
    </Card>
  </section>
</template>

<style scoped>
.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-strip.sidebar-layout {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-strip.sidebar-layout .metric-tile {
  min-height: 86px;
}

.metric-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.metric-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.metric-blue .metric-icon {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.metric-amber .metric-icon {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.metric-red .metric-icon {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.metric-green .metric-icon {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}
.metric-cyan .metric-icon {
  background: rgba(8, 145, 178, 0.1);
  color: #0891b2;
}

.metric-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.metric-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.metric-detail {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

@media (max-width: 980px) {
  .metric-strip {
    grid-template-columns: 1fr;
  }

  .metric-strip.sidebar-layout {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-strip.sidebar-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.metric-strip.sidebar-layout {
  grid-template-columns: 1fr !important;
}
</style>
