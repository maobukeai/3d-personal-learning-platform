<script setup lang="ts">
import type { Component } from 'vue';
import { SlidersHorizontal, ShieldCheck } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import type { ShowcaseType, ShowcaseSortKey, ShowcaseScope, ShowcaseBucket } from './showcaseTypes';

interface SortOption {
  value: ShowcaseSortKey;
  label: string;
  icon: Component;
}

interface ViewModeOption {
  value: 'grid' | 'list';
  label: string;
  icon: Component;
}

defineProps<{
  activeSort: ShowcaseSortKey;
  activeScope: ShowcaseScope;
  activeType: ShowcaseType | 'all';
  activeBucket: ShowcaseBucket;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  pendingReviewCount: number;
  resultSummary: string;
  sortOptions: SortOption[];
  viewModeOptions: ViewModeOption[];
}>();

const emit = defineEmits<{
  (e: 'update:activeSort', val: ShowcaseSortKey): void;
  (e: 'update:viewMode', val: 'grid' | 'list'): void;
  (e: 'reset-filters'): void;
  (e: 'set-bucket', val: ShowcaseBucket): void;
  (e: 'toggle-filter'): void;
}>();
</script>

<template>
  <section class="showcase-controls mobile-adaptive">
    <div class="controls-row controls-row--secondary justify-between w-full mobile-row">
      <div class="flex items-center gap-2">
        <button type="button" class="icon-button mobile-filter" @click="emit('toggle-filter')">
          <SlidersHorizontal class="w-4 h-4" />
        </button>

        <div class="sort-strip-container flex items-center gap-2">
          <span
            class="control-label hidden md:inline-flex text-xs font-bold text-[var(--text-secondary)]"
          >
            <SlidersHorizontal class="w-3.5 h-3.5" />
            排序
          </span>
          <Tabs
            :model-value="activeSort"
            :options="sortOptions"
            size="sm"
            @update:model-value="(val: any) => emit('update:activeSort', val as ShowcaseSortKey)"
          />
        </div>
      </div>

      <div class="right-actions-group">
        <button
          v-if="pendingReviewCount"
          type="button"
          class="review-pill flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold cursor-pointer shrink-0"
          @click="emit('set-bucket', 'pending')"
        >
          <ShieldCheck class="w-3.5 h-3.5" />
          <span>{{ pendingReviewCount }} 个待审核</span>
        </button>

        <button
          v-if="
            searchQuery ||
            activeType !== 'all' ||
            activeBucket !== 'all' ||
            activeScope !== 'all' ||
            activeSort !== 'trending'
          "
          type="button"
          class="clear-search flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold cursor-pointer hover:text-red-500 transition-colors shrink-0"
          @click="emit('reset-filters')"
        >
          <span>清除筛选</span>
        </button>

        <span
          class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline select-none"
          >{{ resultSummary }}</span
        >

        <Tabs
          :model-value="viewMode"
          :options="viewModeOptions"
          size="sm"
          @update:model-value="(val: any) => emit('update:viewMode', val as 'grid' | 'list')"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.showcase-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
  padding: 6px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-enterprise);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.icon-button,
.publish-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 850;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}

.icon-button {
  width: 36px;
  color: var(--text-secondary);
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}

.icon-button:hover,
.publish-button:hover {
  transform: translateY(-1px);
}

.sort-strip-container {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.right-actions-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.control-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.clear-search {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 850;
}

.review-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, #d97706 25%, var(--border-base));
  border-radius: 6px;
  color: #b45309;
  background: color-mix(in srgb, #d97706 9%, transparent);
  font-size: 11px;
  font-weight: 900;
}

@media (max-width: 900px) {
  .showcase-controls {
    padding: 8px !important;
    gap: 8px !important;
    margin-top: 10px !important;
  }

  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px !important;
  }

  .right-actions-group {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px !important;
  }
}

@media (max-width: 640px) {
  .showcase-controls {
    border-radius: 7px;
  }
}
</style>
