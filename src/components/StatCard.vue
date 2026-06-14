<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import { TrendingUp } from 'lucide-vue-next';
import BaseCard from '@/components/BaseCard.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    trend?: string;
    color?: string;
    icon: Component;
    route?: string;
    compact?: boolean;
    horizontal?: boolean;
  }>(),
  {
    trend: '',
    color: 'text-slate-500',
    route: '',
    compact: false,
    horizontal: false,
  }
);

const router = useRouter();

const hasTrend = computed(() => {
  return props.trend && props.trend !== '0' && props.trend !== '0%';
});

const trendClass = computed(() => {
  if (!props.trend) return '';
  return props.trend.startsWith('-')
    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
    : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400';
});

const isClickable = computed(() => !!props.route);

function handleClick() {
  if (props.route) {
    router.push(props.route);
  }
}
</script>

<template>
  <BaseCard
    :clickable="isClickable"
    :hoverable="isClickable"
    padding="none"
    class="blender-stat-card"
    :class="[
      isClickable ? 'group' : '',
      horizontal
        ? 'p-3 flex items-center gap-3'
        : compact
          ? 'p-3 sm:p-5'
          : 'p-3 md:p-4'
    ]"
    @click="handleClick"
  >
    <!-- Layout Option 1: Horizontal Row Layout -->
    <template v-if="horizontal">
      <div
        class="bg-slate-50 dark:bg-white/5 transition-transform shrink-0"
        :class="[
          color,
          isClickable ? 'group-hover:scale-110' : '',
          'p-2 rounded-lg'
        ]"
      >
        <component
          :is="icon"
          class="w-3.5 h-3.5 sm:w-5 sm:h-5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <p
          class="font-bold uppercase mb-1 truncate text-[10px]"
          style="color: var(--text-muted)"
          :title="label"
        >
          {{ label }}
        </p>
        <div class="flex items-baseline gap-1">
          <h2
            class="font-bold truncate text-lg leading-tight"
            style="color: var(--text-primary)"
          >
            {{ value }}
          </h2>
          <span
            v-if="hasTrend"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            :class="trendClass"
          >
            {{ trend }}
          </span>
        </div>
      </div>
    </template>

    <!-- Layout Option 2: Default Vertical Card Layout -->
    <template v-else>
      <div class="flex items-start justify-between mb-3">
        <div
          class="bg-slate-50 dark:bg-white/5 transition-transform"
          :class="[
            color,
            isClickable ? 'group-hover:scale-110' : '',
            compact ? 'p-2.5 rounded-lg' : 'p-2 rounded-lg'
          ]"
        >
          <component
            :is="icon"
            :class="compact ? 'w-4 h-4 sm:w-6 h-6' : 'w-3.5 h-3.5 sm:w-5 sm:h-5'"
          />
        </div>
        <template v-if="!compact">
          <span
            v-if="hasTrend"
            class="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            :class="trendClass"
          >
            {{ trend }}
          </span>
        </template>
        <template v-else>
          <!-- For admin stats, show trending icon on hover -->
          <component
            :is="TrendingUp"
            v-if="value !== '0' && value !== 0"
            class="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
          />
        </template>
      </div>
      <p
        class="font-bold uppercase mb-1 truncate"
        :class="compact ? 'text-[10px]' : 'text-[10px]'"
        style="color: var(--text-muted)"
        :title="label"
      >
        {{ label }}
      </p>
      <h2
        class="font-bold truncate"
        :class="compact ? 'text-xl sm:text-2xl' : 'text-xl md:text-2xl'"
        style="color: var(--text-primary)"
      >
        {{ value }}
      </h2>
    </template>
  </BaseCard>
</template>
