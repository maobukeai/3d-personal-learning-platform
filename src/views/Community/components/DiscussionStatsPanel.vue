<script setup lang="ts">
import type { Component } from 'vue';

interface MetricCard {
  label: string;
  value: string;
  icon: Component;
  tone: string;
}

defineProps<{
  metrics: MetricCard[];
}>();
</script>

<template>
  <div class="stats-row">
    <div
      v-for="metric in metrics"
      :key="metric.label"
      class="stat-card-premium"
      :class="`stat-card-premium--${metric.tone}`"
    >
      <div class="stat-icon-wrapper">
        <component :is="metric.icon" class="h-4 w-4" />
      </div>
      <div class="stat-info">
        <span class="stat-label">{{ metric.label }}</span>
        <strong class="stat-value">{{ metric.value }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 375px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}

.stat-card-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.2s ease;
}

.stat-card-premium:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.stat-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-card-premium--blue .stat-icon-wrapper {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.stat-card-premium--blue:hover {
  border-color: rgba(37, 99, 235, 0.3);
}

.stat-card-premium--teal .stat-icon-wrapper {
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
}
.stat-card-premium--teal:hover {
  border-color: rgba(15, 118, 110, 0.3);
}

.stat-card-premium--rose .stat-icon-wrapper {
  background: rgba(225, 29, 72, 0.1);
  color: #e11d48;
}
.stat-card-premium--rose:hover {
  border-color: rgba(225, 29, 72, 0.3);
}

.stat-card-premium--amber .stat-icon-wrapper {
  background: rgba(180, 83, 9, 0.1);
  color: #b45309;
}
.stat-card-premium--amber:hover {
  border-color: rgba(180, 83, 9, 0.3);
}
</style>
