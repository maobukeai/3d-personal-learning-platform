<script setup lang="ts">
import { computed } from 'vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import type { Component } from 'vue';

export interface StatCardItem {
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
  cards: StatCardItem[];
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  columns: 4,
  compact: true,
});

const gridClass = computed(() => {
  switch (props.columns) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-1 md:grid-cols-2';
    case 3:
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    case 4:
    default:
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  }
});

type HealthVariant = NonNullable<StatCardItem['health']>['variant'];

const defaultHealthVariant = (label: string): HealthVariant => {
  if (['正常', '稳定', '已同步', '已连接', '健康', '已清空', '无暂停'].includes(label)) {
    return 'success';
  }
  if (['待处理', '有暂停', '关注', '积压中', '警告'].includes(label)) {
    return 'warning';
  }
  if (['异常', '失败', '危险', '封禁', '未配置', '无活跃', '积压高'].includes(label)) {
    return 'danger';
  }
  return 'info';
};
</script>

<template>
  <section class="grid gap-3 mobile-grid" :class="[gridClass, ' ']">
    <Card
      v-for="card in cards"
      :key="card.label"
      hoverable
      glow
      :class="compact ? 'group !p-2 px-2.5' : 'group'"
    >
      <div class="flex items-center justify-between w-full gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            v-if="card.icon"
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-100/10"
            :class="card.color || 'text-slate-600 bg-slate-500/10 border-slate-500/20'"
          >
            <component :is="card.icon" class="h-3.5 w-3.5" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight">
              {{ card.label }}
            </p>
            <p
              v-if="card.hint"
              class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
              :title="card.hint"
            >
              {{ card.hint }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-base font-black text-[var(--text-primary)] leading-none">
            {{ card.value }}
          </span>
          <Badge
            v-if="card.health"
            :variant="card.health.variant || defaultHealthVariant(card.health.label)"
          >
            {{ card.health.label }}
          </Badge>
        </div>
      </div>
    </Card>
  </section>
</template>
