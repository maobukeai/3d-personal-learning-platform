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
    horizontal?: boolean; // New prop for horizontal layout
  }>(),
  {
    color: 'text-slate-500',
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
  <div
    class="glass-card transition-all"
    :class="[
      isClickable ? 'glass-card-hover cursor-pointer group' : 'glass-card-hover',
      horizontal
        ? 'p-2 sm:p-3 rounded-xl border shadow-sm hover:shadow-md flex items-center gap-2 sm:gap-3.5'
        : compact
          ? 'p-2 sm:p-6 rounded-xl sm:rounded-3xl border shadow-sm hover:shadow-md'
          : 'p-1.5 sm:p-2.5 md:p-3 rounded-lg md:rounded-xl'
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
          'p-1 sm:p-2 rounded-md sm:rounded-lg'
        ]"
      >
        <component
          :is="icon"
          class="w-3.5 h-3.5 sm:w-5 sm:h-5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <p
          class="font-black uppercase tracking-wider mb-0.5 truncate text-[7.5px] sm:text-[9.5px]"
          style="color: var(--text-muted)"
          :title="label"
        >
          {{ label }}
        </p>
        <div class="flex items-baseline gap-1">
          <h2
            class="font-black truncate text-xs sm:text-lg leading-tight"
            style="color: var(--text-primary)"
          >
            {{ value }}
          </h2>
          <span
            v-if="hasTrend"
            class="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
            :class="trendClass"
          >
            {{ trend }}
          </span>
        </div>
      </div>
    </template>

    <!-- Layout Option 2: Default Vertical Card Layout -->
    <template v-else>
      <div class="flex items-start justify-between mb-1 sm:mb-1.5">
        <div
          class="bg-slate-50 dark:bg-white/5 transition-transform"
          :class="[
            color,
            isClickable ? 'group-hover:scale-110' : '',
            compact ? 'p-1.5 sm:p-3 rounded-lg sm:rounded-2xl' : 'p-1 sm:p-2 rounded-md sm:rounded-lg'
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
            class="hidden sm:inline-block text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0"
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
        :class="compact ? 'text-[9px] sm:text-[10px]' : 'text-[8px] xs:text-[9px] sm:text-[10px]'"
        style="color: var(--text-muted)"
        :title="label"
      >
        {{ label }}
      </p>
      <h2
        class="font-black truncate"
        :class="compact ? 'text-base sm:text-2xl' : 'text-sm xs:text-base sm:text-lg md:text-2xl'"
        style="color: var(--text-primary)"
      >
        {{ value }}
      </h2>
    </template>
  </div>
</template>

