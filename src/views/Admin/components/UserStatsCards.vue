<script setup lang="ts">
import type { Component } from 'vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';

interface CardItem {
  label: string;
  value: number | string;
  hint: string;
  icon: Component;
  color: string;
  progress: number | null;
  health: { label: string; variant: 'success' | 'warning' | 'danger' | 'primary' };
}

const props = defineProps<{
  cards: CardItem[];
}>();
</script>

<template>
  <!-- Top KPI metrics grid (Horizontal compact) -->
  <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mobile-grid">
    <Card v-for="card in props.cards" :key="card.label" hoverable glow class="group !p-2 px-2.5">
      <div class="flex items-center justify-between w-full gap-3">
        <!-- Left: Icon & Info -->
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
            :class="card.color"
          >
            <component :is="card.icon" class="h-3.5 w-3.5" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight">
              {{ card.label }}
            </p>
            <p
              class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
              :title="card.hint"
            >
              {{ card.hint }}
            </p>
          </div>
        </div>

        <!-- Right: Metric & Health Badge -->
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-base font-black text-[var(--text-primary)] leading-none">
            {{ typeof card.value === 'number' ? card.value.toLocaleString() : card.value }}
          </span>
          <Badge :variant="card.health.variant">
            {{ card.health.label }}
          </Badge>
        </div>
      </div>

      <!-- Sleek flat progress bar -->
      <div
        v-if="card.progress !== null"
        class="w-full h-[3px] bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5"
      >
        <div class="h-full rounded-full bg-accent" :style="{ width: `${card.progress}%` }"></div>
      </div>
    </Card>
  </section>
</template>
