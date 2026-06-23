<script setup lang="ts">
import type { Component } from 'vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';

type StatCard = {
  label: string;
  value: number;
  hint: string;
  icon: Component;
  color: string;
  health: {
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'primary' | 'info' | 'blender';
  };
};

const props = defineProps<{
  cards: StatCard[];
}>();

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定' || label === '低风险' || label === '丰富')
    return 'success';
  if (label === '关注' || label === '需关注' || label === '存在逾期') return 'warning';
  if (label === '高压' || label === '高风险') return 'danger';
  return 'primary';
};
</script>

<template>
  <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mobile-grid">
    <Card v-for="card in props.cards" :key="card.label" hoverable glow class="group !p-2 px-2.5">
      <div class="flex items-center justify-between w-full gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
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

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-base font-black text-[var(--text-primary)] leading-none">
            {{ card.value.toLocaleString() }}
          </span>
          <Badge :variant="getBadgeVariant(card.health.label)">
            {{ card.health.label }}
          </Badge>
        </div>
      </div>
    </Card>
  </section>
</template>
