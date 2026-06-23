<script setup lang="ts">
import type { Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2 } from 'lucide-vue-next';
import type { DiscussionFilter } from '../DiscussionsView.vue';
import { formatCompactNumber as formatNumber } from '@/utils/format';

interface FilterOption {
  value: DiscussionFilter;
  label: string;
  count?: number;
  icon: Component;
}

interface SortOption {
  value: string;
  label: string;
  icon: Component;
}

defineProps<{
  filters: FilterOption[];
  activeFilter: DiscussionFilter;
  sortOptions: SortOption[];
  sortBy: string;
  selectedSortLabel: string;
  selectedTag: string;
  hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeFilter', value: DiscussionFilter): void;
  (e: 'update:sortBy', value: string): void;
  (e: 'clear'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="control-panel mobile-row">
    <div class="filter-tabs">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        :class="{ 'is-active': activeFilter === filter.value }"
        @click="emit('update:activeFilter', filter.value)"
      >
        <component :is="filter.icon" class="h-3.5 w-3.5" />
        <span>{{ filter.label }}</span>
        <b v-if="filter.count !== undefined">{{ formatNumber(filter.count) }}</b>
      </button>
    </div>

    <div class="sort-strip">
      <span>{{ selectedSortLabel }}</span>
      <button
        v-for="option in sortOptions"
        :key="option.value"
        type="button"
        :class="{ 'is-active': sortBy === option.value }"
        :title="option.label"
        @click="emit('update:sortBy', option.value)"
      >
        <component :is="option.icon" class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>

  <div v-if="hasActiveFilters" class="active-filter-line mobile-row">
    <div>
      <CheckCircle2 class="h-3.5 w-3.5" />
      <span v-if="selectedTag">{{
        t('community.discussions.selectedTag', { tag: selectedTag })
      }}</span>
      <span v-else>{{ t('community.discussions.filteredView') }}</span>
    </div>
    <button type="button" @click="emit('clear')">
      {{ t('community.discussions.clearFilters') }}
    </button>
  </div>
</template>

<style scoped>
.control-panel,
.active-filter-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.control-panel {
  padding: 6px;
  background: var(--bg-hover);
}

.filter-tabs,
.sort-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.filter-tabs {
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.filter-tabs button,
.sort-strip button,
.active-filter-line button {
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
}

.filter-tabs button b {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

.filter-tabs button.is-active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.filter-tabs button.is-active b {
  color: var(--accent);
}

.sort-strip {
  flex: 0 0 auto;
}

.sort-strip span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  margin-right: 4px;
}

.sort-strip button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
}

.sort-strip button.is-active {
  background: var(--accent);
  color: #fff;
}

.active-filter-line {
  min-height: 32px;
  padding: 0 10px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.active-filter-line div {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.active-filter-line button {
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}
</style>
