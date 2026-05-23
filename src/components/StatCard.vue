<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { TrendingUp } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    trend?: string;
    color?: string;
    icon: any; // Lucide icon component
    route?: string;
    compact?: boolean;
  }>(),
  {
    color: 'text-slate-500',
    compact: false,
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
  <div
    class="glass-card transition-all"
    :class="[
      isClickable ? 'glass-card-hover cursor-pointer group' : 'glass-card-hover',
      compact ? 'p-2 sm:p-6 rounded-xl sm:rounded-3xl border shadow-sm hover:shadow-md' : 'p-2.5 sm:p-3.5 md:p-4 rounded-xl md:rounded-2xl'
    ]"
    @click="handleClick"
  >
    <div class="flex items-start justify-between mb-1.5 sm:mb-3">
      <div
        class="bg-slate-50 dark:bg-white/5 transition-transform"
        :class="[
          color,
          isClickable ? 'group-hover:scale-110' : '',
          compact ? 'p-1.5 sm:p-3 rounded-lg sm:rounded-2xl' : 'p-2 sm:p-2.5 rounded-lg sm:rounded-xl'
        ]"
      >
        <component
          :is="icon"
          :class="compact ? 'w-4 h-4 sm:w-6 h-6' : 'w-4 h-4 sm:w-5.5 sm:h-5.5'"
        />
      </div>
      <template v-if="!compact">
        <span
          v-if="hasTrend"
          class="text-[9px] sm:text-[11px] font-black px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full shrink-0"
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
      class="font-black uppercase tracking-wider mb-0.5 truncate"
      :class="compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'"
      style="color: var(--text-muted)"
      :title="label"
    >
      {{ label }}
    </p>
    <h2
      class="font-black truncate"
      :class="compact ? 'text-base sm:text-2xl' : 'text-lg sm:text-2xl md:text-3xl'"
      style="color: var(--text-primary)"
    >
      {{ value }}
    </h2>
  </div>
</template>
