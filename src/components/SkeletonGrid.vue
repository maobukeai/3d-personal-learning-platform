<script setup lang="ts">
interface Props {
  count?: number;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  compact?: boolean;
}

withDefaults(defineProps<Props>(), {
  count: 6,
  columns: 3,
  compact: false,
});

const gridClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};
</script>

<template>
  <div class="skeleton-grid grid gap-4 animate-pulse" :class="gridClasses[columns]">
    <div
      v-for="i in count"
      :key="i"
      class="skeleton-card rounded-2xl border bg-card"
      :class="{ 'p-3 space-y-2': compact, 'p-4 space-y-3': !compact }"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        v-if="!compact"
        class="skeleton-thumb rounded-xl bg-slate-100 dark:bg-slate-800/40"
        :class="compact ? 'h-24' : 'h-32'"
      ></div>
      <div class="space-y-2">
        <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      </div>
      <div class="flex items-center justify-between pt-1">
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-8"></div>
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-4"></div>
      </div>
    </div>
  </div>
</template>
