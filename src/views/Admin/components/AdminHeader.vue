<script setup lang="ts">
import { computed } from 'vue';
import { Search } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import type { Component } from 'vue';

export interface StatItem {
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
  title: string;
  subtitle?: string;
  cards?: StatItem[];
  placeholder?: string;
  modelValue?: string;
  showSearch?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  cards: () => [],
  placeholder: '搜索...',
  modelValue: '',
  showSearch: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const searchQuery = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const defaultHealthVariant = (
  label: string,
): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'blender' => {
  if (
    ['正常', '稳定', '已同步', '已连接', '健康', '已清空', '无暂停', '常态', '队列健康'].includes(
      label,
    )
  ) {
    return 'success';
  }
  if (['待处理', '有暂停', '关注', '积压中', '警告', '需要关注'].includes(label)) {
    return 'warning';
  }
  if (['异常', '失败', '危险', '封禁', '未配置', '无活跃', '积压高', '积压偏高'].includes(label)) {
    return 'danger';
  }
  return 'info';
};

const getDotBgClass = (card: StatItem) => {
  const label = card.label;
  const val = Number(card.value);
  if (label === '待审核资源' || label === '待处理') {
    return val > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500';
  }
  // Try to determine color by checking label or card.color
  const colorStr = card.color || '';
  if (colorStr.includes('emerald') || colorStr.includes('success')) return 'bg-emerald-500';
  if (colorStr.includes('rose') || colorStr.includes('danger') || colorStr.includes('red'))
    return 'bg-rose-500';
  if (colorStr.includes('amber') || colorStr.includes('warning')) return 'bg-amber-500';
  if (colorStr.includes('purple')) return 'bg-purple-500';
  if (
    colorStr.includes('sky') ||
    colorStr.includes('indigo') ||
    colorStr.includes('blue') ||
    colorStr.includes('primary')
  )
    return 'bg-sky-500';
  return 'bg-slate-400';
};

const isSuccessStatus = (label: string): boolean => {
  return [
    '正常',
    '稳定',
    '已同步',
    '已连接',
    '健康',
    '已清空',
    '无暂停',
    '常态',
    '队列健康',
    '无异常',
    '空闲',
    '运行中',
    '已配置',
  ].includes(label);
};
</script>

<template>
  <!-- Ultra-Compact Single Row Header -->
  <Card padding="none" class="!py-1.5 !px-3 sm:!px-4 border-base bg-card shadow-sm">
    <div
      class="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] items-center gap-2.5 w-full min-w-0"
    >
      <!-- Left: Title & Minimalist Inline Indicators -->
      <div class="flex items-center gap-2.5 min-w-0 w-full justify-start z-10">
        <div class="flex items-center gap-1.5 shrink-0">
          <span v-if="subtitle" class="text-[11px] font-medium text-[var(--text-muted)]">{{
            subtitle
          }}</span>
          <span v-if="subtitle" class="text-[11px] text-[var(--text-muted)] opacity-60">/</span>
          <h1 class="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
            {{ title }}
          </h1>
          <slot name="title-badge" />
        </div>

        <div
          v-if="cards && cards.length > 0"
          class="h-3.5 w-px bg-[var(--border-base)] hidden md:block shrink-0"
        ></div>

        <!-- Minimalist Inline Stats -->
        <div
          v-if="cards && cards.length > 0"
          class="hidden md:flex items-center gap-2.5 text-[11px] overflow-x-auto scrollbar-hide min-w-0"
        >
          <span
            v-for="card in cards"
            :key="card.label"
            class="flex items-center gap-1 shrink-0"
            :title="card.hint || card.label"
          >
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="getDotBgClass(card)"></span>
            <span class="text-[var(--text-muted)] whitespace-nowrap">{{ card.label }}</span>
            <span
              class="font-bold text-[var(--text-primary)]"
              :class="
                (card.label === '待审核资源' || card.label === '待处理') && Number(card.value) > 0
                  ? 'text-rose-500 font-extrabold'
                  : ''
              "
            >
              {{ card.value }}
            </span>
            <Badge
              v-if="card.health && !isSuccessStatus(card.health.label)"
              size="sm"
              :variant="card.health.variant || defaultHealthVariant(card.health.label)"
              class="scale-90 origin-left shrink-0"
            >
              {{ card.health.label }}
            </Badge>
          </span>
        </div>
      </div>

      <!-- Center: Absolutely Centered Search Input Box on Desktop -->
      <div v-if="showSearch" class="w-full lg:w-64 max-w-sm flex items-center justify-center z-10">
        <label class="search-box !min-h-0 !h-7.5 w-full text-xs">
          <Search class="!w-3.5 !h-3.5" />
          <input v-model="searchQuery" type="search" :placeholder="placeholder" class="text-xs" />
        </label>
      </div>
      <div v-else class="hidden lg:block"></div>

      <!-- Right: Compact Action Buttons -->
      <div class="flex items-center gap-1.5 shrink-0 lg:w-full justify-end z-10">
        <slot />
      </div>
    </div>
  </Card>
</template>
