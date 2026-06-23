<script setup lang="ts">
interface Props {
  viewMode: 'board' | 'list' | 'calendar';
}

defineProps<Props>();
</script>

<template>
  <div class="flex-1 p-1 sm:p-4 space-y-4 overflow-hidden">
    <!-- Board Skeleton -->
    <div v-if="viewMode === 'board'" class="flex gap-4 h-full">
      <div
        v-for="i in 3"
        :key="i"
        class="flex-1 bg-card rounded-2xl border p-4 space-y-3 animate-pulse h-full"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div
          v-for="j in 3"
          :key="j"
          class="h-24 bg-slate-100 dark:bg-slate-800/40 rounded-xl border p-3 space-y-2"
          style="border-color: var(--border-base)"
        >
          <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          <div class="flex justify-between items-center pt-2">
            <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-8"></div>
            <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-4"></div>
          </div>
        </div>
      </div>
    </div>
    <!-- List/Calendar Skeleton -->
    <div v-else class="space-y-3 animate-pulse">
      <div
        v-for="i in 6"
        :key="i"
        class="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl border"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      ></div>
    </div>
  </div>
</template>
