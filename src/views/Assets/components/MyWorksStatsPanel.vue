<script setup lang="ts">
import { type Component } from 'vue';
import type { WorkStatus } from '../myWorksModel';

interface StatItem {
  label: string;
  value: string | number;
  meta: string;
  icon: Component;
  tone: string;
}

const statusFilter = defineModel<WorkStatus>('statusFilter', { required: true });

defineProps<{
  isStatsExpanded: boolean;
  activeTab: 'mine' | 'favorites';
  statCards: StatItem[];
  workbenchSignals: StatItem[];
  reviewCompletion: number;
}>();
</script>

<template>
  <section v-show="isStatsExpanded && activeTab === 'mine'" class="stats-grid">
    <article v-for="stat in statCards" :key="stat.label" class="stat-card" :data-tone="stat.tone">
      <div class="stat-icon">
        <component :is="stat.icon" class="icon-sm" />
      </div>
      <div>
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <small>{{ stat.meta }}</small>
      </div>
    </article>
  </section>

  <section v-show="isStatsExpanded && activeTab === 'mine'" class="workbench-strip">
    <div class="review-progress">
      <div>
        <span>审核管线</span>
        <strong>{{ reviewCompletion }}%</strong>
      </div>
      <i :style="{ width: reviewCompletion + '%' }"></i>
    </div>

    <div class="signal-grid">
      <article v-for="signal in workbenchSignals" :key="signal.label" :data-tone="signal.tone">
        <component :is="signal.icon" class="icon-sm" />
        <div>
          <span>{{ signal.label }}</span>
          <strong>{{ signal.value }}</strong>
          <small>{{ signal.meta }}</small>
        </div>
      </article>
    </div>

    <div class="pipeline-actions mobile-row">
      <button
        type="button"
        :class="{ active: statusFilter === 'PENDING' }"
        @click="statusFilter = 'PENDING'"
      >
        待审核
      </button>
      <button
        type="button"
        :class="{ active: statusFilter === 'REJECTED' }"
        @click="statusFilter = 'REJECTED'"
      >
        未通过
      </button>
      <button
        type="button"
        :class="{ active: statusFilter === 'APPROVED' }"
        @click="statusFilter = 'APPROVED'"
      >
        已发布
      </button>
      <button
        type="button"
        :class="{ active: statusFilter === 'ALL' }"
        @click="statusFilter = 'ALL'"
      >
        全部
      </button>
    </div>
  </section>
</template>

<style scoped>
.icon-sm {
  width: 14px;
  height: 14px;
}

/* Stats Dashboard Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--card-shadow);
  transition: all 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-1.5px);
  border-color: #2563eb;
  box-shadow: var(--shadow-card-hover);
}

.stat-card .stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  flex: 0 0 auto;
}

.stat-card[data-tone='amber'] .stat-icon {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}

.stat-card[data-tone='rose'] .stat-icon {
  color: #e11d48;
  background: rgba(225, 29, 72, 0.1);
}

.stat-card[data-tone='teal'] .stat-icon {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

.stat-card span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.stat-card strong {
  display: block;
  margin-top: 1px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-card small {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  margin-top: 1px;
}

/* Workbench pipeline strip */
.workbench-strip {
  display: grid;
  grid-template-columns: minmax(10rem, 0.7fr) minmax(0, 2fr) minmax(15rem, 0.8fr);
  gap: 10px;
  align-items: stretch;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px;
}

.review-progress {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 6px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 6px;
  background: rgba(37, 99, 235, 0.04);
  padding: 8px;
}

.review-progress div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.review-progress span,
.signal-grid span,
.signal-grid small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-progress strong,
.signal-grid strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.review-progress i {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: #2563eb;
}

.signal-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.signal-grid article {
  --signal-color: #2563eb;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--signal-color) 15%, var(--border-base));
  border-radius: 6px;
  background: color-mix(in srgb, var(--signal-color) 5%, var(--bg-card));
  padding: 6px;
}

.signal-grid article[data-tone='green'] {
  --signal-color: #059669;
}

.signal-grid article[data-tone='amber'] {
  --signal-color: #d97706;
}

.signal-grid article[data-tone='rose'] {
  --signal-color: #e11d48;
}

.signal-grid article[data-tone='teal'] {
  --signal-color: #0f766e;
}

.signal-grid article > svg {
  flex: 0 0 auto;
  color: var(--signal-color);
  width: 14px;
  height: 14px;
}

.signal-grid article > div {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.signal-grid span,
.signal-grid small,
.signal-grid strong {
  display: block;
}

.pipeline-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.pipeline-actions button {
  min-width: 0;
  height: 100%;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.pipeline-actions button:hover,
.pipeline-actions button.active {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}

@media (max-width: 980px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workbench-strip {
    grid-template-columns: 1fr;
  }

  .signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .stats-grid,
  .signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
