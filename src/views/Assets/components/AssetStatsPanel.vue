<script setup lang="ts">
import type { Component } from 'vue';

interface StatCard {
  label: string;
  value: string | number;
  meta: string;
  icon: Component;
  tone: string;
}

defineProps<{
  isExpanded: boolean;
  statCards: StatCard[];
}>();
</script>

<template>
  <section v-show="isExpanded" class="stats-grid">
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
</template>

<style scoped>
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
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.stat-card[data-tone='blue'] {
  --tone-color: #2563eb;
}
.stat-card[data-tone='green'] {
  --tone-color: #059669;
}
.stat-card[data-tone='orange'] {
  --tone-color: #d97706;
}
.stat-card[data-tone='teal'] {
  --tone-color: #0f766e;
}

.stat-card[data-tone='blue'] .stat-icon {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}
.stat-card[data-tone='green'] .stat-icon {
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
}
.stat-card[data-tone='orange'] .stat-icon {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
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

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
