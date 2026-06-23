<script setup lang="ts">
import { Heart, X, Download } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';

type LibraryTab = 'explore' | 'favorites' | 'mine';

interface FilterLabel {
  key: string;
  label: string;
}

defineProps<{
  activeFilterLabels: FilterLabel[];
  selectedCount: number;
  allVisibleSelected: boolean;
  isBulkBusy: boolean;
  activeTab: LibraryTab;
}>();

const emit = defineEmits<{
  (e: 'clearFilter', key: string): void;
  (e: 'resetFilters'): void;
  (e: 'toggleSelectAll'): void;
  (e: 'bulkFavorite', favorite: boolean): void;
  (e: 'downloadSelected'): void;
}>();

const label = useLabel();
</script>

<template>
  <section v-if="activeFilterLabels.length || selectedCount" class="state-bar mobile-row">
    <button
      type="button"
      class="select-all"
      :class="{ active: allVisibleSelected }"
      @click="emit('toggleSelectAll')"
    >
      {{
        allVisibleSelected
          ? label('取消全选', 'Clear Selection')
          : label('选择当前页', 'Select Page')
      }}
    </button>

    <div class="active-filters mobile-row">
      <button
        v-for="filter in activeFilterLabels"
        :key="filter.key"
        type="button"
        @click="emit('clearFilter', filter.key)"
      >
        {{ filter.label }}
        <X class="icon-xs" />
      </button>
      <button
        v-if="activeFilterLabels.length > 1"
        type="button"
        class="clear-filter"
        @click="emit('resetFilters')"
      >
        {{ label('清空', 'Clear') }}
      </button>
    </div>

    <div v-if="selectedCount" class="bulk-actions mobile-row">
      <span>{{ selectedCount }} {{ label('项', 'selected') }}</span>
      <button
        type="button"
        class="ghost-button compact-button"
        :disabled="isBulkBusy"
        @click="emit('bulkFavorite', true)"
      >
        <Heart class="icon-sm" />
        {{ label('收藏', 'Favorite') }}
      </button>
      <button
        v-if="activeTab === 'favorites'"
        type="button"
        class="ghost-button compact-button"
        :disabled="isBulkBusy"
        @click="emit('bulkFavorite', false)"
      >
        <X class="icon-sm" />
        {{ label('移出', 'Remove') }}
      </button>
      <button type="button" class="primary-button compact-button" @click="emit('downloadSelected')">
        <Download class="icon-sm" />
        {{ label('下载', 'Download') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.state-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 10px;
}

.select-all,
.active-filters button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 8px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-all:hover,
.active-filters button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.select-all.active {
  border-color: transparent;
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
  font-weight: 600;
}

.active-filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.active-filters .clear-filter {
  color: #d97706;
  font-weight: 600;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bulk-actions > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.primary-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-text {
  gap: 6px;
}

.primary-button {
  border-color: transparent;
  background: #d97706;
  color: #fff;
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
}

.primary-button:hover {
  background: #c26702;
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.compact-button {
  height: 28px;
  padding: 0 10px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 860px) {
  .state-bar,
  .bulk-actions {
    align-items: stretch;
    flex-direction: column;
    height: auto;
    padding: 8px;
  }
}
</style>
