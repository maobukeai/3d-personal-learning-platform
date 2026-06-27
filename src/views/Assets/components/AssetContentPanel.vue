<script setup lang="ts">
import { computed, type Component } from 'vue';
import { SlidersHorizontal } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import ResourceGridPanel from './ResourceGridPanel.vue';
import { useLabel } from '@/utils/i18n';
import type {
  AssetListItem,
  AssetPagination,
  AssetSortKey,
  AssetViewMode,
} from '../assetLibraryModel';

interface TabOption {
  label: string;
  value: string;
  badge?: number;
}

interface FilterChip {
  key: string;
  label: string;
}

interface ViewModeOption {
  value: AssetViewMode;
  label: string;
  icon: Component;
}

type LibraryTab = 'explore' | 'favorites' | 'mine';

const props = defineProps<{
  activeTab: LibraryTab;
  sortKey: AssetSortKey;
  viewMode: AssetViewMode;
  isFilterOpen: boolean;
  isLoading: boolean;
  visibleAssets: AssetListItem[];
  pagination: AssetPagination;
  libraryTabOptions: TabOption[];
  viewModeOptions: ViewModeOption[];
  activeFilterChips: FilterChip[];
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortKey', value: AssetSortKey): void;
  (e: 'update:viewMode', value: AssetViewMode): void;
  (e: 'toggleFilter'): void;
  (e: 'pageChange', value: number): void;
  (e: 'clearFilter', key: string): void;
  (e: 'resetFilters'): void;
  (e: 'goToDetail', asset: AssetListItem): void;
  (e: 'like', asset: AssetListItem, event?: Event): void;
  (e: 'download', asset: AssetListItem, event?: Event): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const localTab = computed({
  get: () => props.activeTab,
  set: (value) => emit('update:activeTab', value as LibraryTab),
});

const localSort = computed({
  get: () => props.sortKey,
  set: (value) => emit('update:sortKey', value as AssetSortKey),
});

const localView = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:viewMode', value as AssetViewMode),
});
</script>

<template>
  <main class="content-panel">
    <section class="toolbar mobile-row">
      <div class="toolbar-left">
        <button type="button" class="icon-button mobile-filter" @click="emit('toggleFilter')">
          <SlidersHorizontal class="icon-sm" />
        </button>
        <Tabs v-model="localTab" :options="libraryTabOptions" size="sm" />
      </div>

      <div class="toolbar-right">
        <select v-model="localSort" class="select-field" aria-label="排序方式">
          <option value="latest">{{ label('最新发布', 'Newest') }}</option>
          <option value="popular">{{ label('下载最多', 'Most Downloaded') }}</option>
          <option value="views">{{ label('浏览最多', 'Most Viewed') }}</option>
          <option value="size">{{ label('体积最大', 'Largest') }}</option>
          <option value="oldest">{{ label('最早发布', 'Oldest') }}</option>
        </select>
        <Tabs v-model="localView" :options="viewModeOptions" size="sm" />
      </div>
    </section>

    <ResourceGridPanel
      kind="asset"
      :items="visibleAssets"
      :is-loading="isLoading"
      :view-mode="viewMode"
      :active-tab="activeTab"
      :active-filter-chips="activeFilterChips"
      :total-count="pagination.total || visibleAssets.length"
      :pagination="pagination"
      :empty-title="label('没有匹配的资源', 'No Matching Assets')"
      :empty-body="label('调整筛选条件，或上传一个新的资源包。', 'Adjust filters or upload a new asset package.')"
      :empty-action-text="label('上传资源', 'Upload Asset')"
      @click="emit('goToDetail', $event)"
      @like="(item, event) => emit('like', item, event)"
      @download="(item, event) => emit('download', item, event)"
      @create="emit('upload')"
      @page-change="emit('pageChange', $event)"
      @clear-filter="emit('clearFilter', $event)"
      @reset-filters="emit('resetFilters')"
    />
  </main>
</template>

<style scoped>
.content-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.toolbar-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.toolbar-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.select-field {
  width: 96px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-field:hover {
  border-color: var(--border-strong);
}

.select-field:focus {
  border-color: var(--accent);
  outline: 0;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.mobile-filter {
  display: none;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

.asset-filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 10px;
}

.asset-filter-strip > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.asset-filter-strip strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.asset-chip-row {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.asset-chip-row button,
.asset-chip-row span {
  height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent);
  padding: 0 8px;
  font-size: 10px;
  font-weight: 500;
}

.asset-chip-row button {
  cursor: pointer;
}

.asset-chip-row .reset-chip {
  border-color: var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.asset-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.asset-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.pagination button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 6px;
  border: 1px solid var(--border-base);
  transition: all 0.15s ease;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.pagination button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 860px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .asset-filter-strip {
    align-items: stretch;
    flex-direction: column;
    height: auto;
    padding: 8px;
    gap: 8px;
  }

  .asset-chip-row {
    justify-content: flex-start;
  }

  .mobile-filter {
    display: grid;
  }
}

@media (max-width: 620px) {
  .primary-button,
  .select-field {
    width: 100%;
  }

  .asset-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>
