<script setup lang="ts">
import { type Component } from 'vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';

export interface BugStatCard {
  label: string;
  value: string | number;
  hint?: string;
  icon?: Component;
  color?: string;
  health?: {
    label: string;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'blender';
  };
}

interface Props {
  cards: BugStatCard[];
}

defineProps<Props>();

const getBadgeVariant = (label: string) => {
  if (
    label === '全部' ||
    label === '正常' ||
    label === '稳定' ||
    label === '高效' ||
    label === '无'
  )
    return 'success';
  if (label === '关注' || label === '积压') return 'warning';
  if (label === '紧急') return 'danger';
  return 'primary';
};
</script>

<template>
  <section class="grid grid-cols-2 xl:grid-cols-4 gap-3">
    <Card v-for="card in cards" :key="card.label" hoverable glow class="group !p-2 px-2.5">
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
            {{ card.value }}
          </span>
          <Badge :variant="getBadgeVariant(card.health?.label || '')">
            {{ card.health?.label }}
          </Badge>
        </div>
      </div>
    </Card>
  </section>
</template>
