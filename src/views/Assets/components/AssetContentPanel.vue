<script setup lang="ts">
import { computed, type Component } from 'vue';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';
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

    <section class="asset-filter-strip mobile-row">
      <div>
        <strong>{{ visibleAssets.length }}</strong>
        <span
          >/ {{ pagination.total || visibleAssets.length }} {{ label('个资源', 'assets') }}</span
        >
      </div>
      <div class="asset-chip-row">
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          type="button"
          @click="emit('clearFilter', chip.key)"
        >
          {{ chip.label }}
          <X class="icon-xs" />
        </button>
        <button
          v-if="activeFilterChips.length"
          type="button"
          class="reset-chip"
          @click="emit('resetFilters')"
        >
          {{ label('清空筛选', 'Clear Filters') }}
        </button>
        <span v-else>{{ label('当前显示全部公开资源', 'Showing all public assets') }}</span>
      </div>
    </section>

    <SkeletonGrid v-if="isLoading" :count="8" :columns="viewMode === 'list' ? 1 : 4" compact />

    <div v-else-if="visibleAssets.length" class="asset-grid" :class="viewMode">
      <UnifiedCard
        v-for="asset in visibleAssets"
        :key="asset.id"
        :item="asset"
        kind="asset"
        :view-mode="viewMode"
        :is-favorited="(asset.likes ?? 0) > 0"
        :active-tab="activeTab"
        @click="emit('goToDetail', asset)"
        @like="(_item, event) => emit('like', asset, event)"
        @download="(_item, event) => emit('download', asset, event)"
      />
    </div>

    <EmptyState
      v-else
      :icon="Sparkles"
      :title="label('没有匹配的资源', 'No Matching Assets')"
      :description="
        label(
          '调整筛选条件，或上传一个新的资源包。',
          'Adjust filters or upload a new asset package.',
        )
      "
      :action-text="label('上传资源', 'Upload Asset')"
      @action="emit('upload')"
    />

    <footer v-if="pagination.totalPages > 1" class="pagination mobile-row">
      <button
        type="button"
        :disabled="pagination.page <= 1"
        @click="emit('pageChange', pagination.page - 1)"
      >
        <ChevronLeft class="icon-sm" />
      </button>
      <span
        >{{ label('第', 'Page') }} {{ pagination.page }} / {{ pagination.totalPages }}
        {{ label('页', '') }}</span
      >
      <button
        type="button"
        :disabled="pagination.page >= pagination.totalPages"
        @click="emit('pageChange', pagination.page + 1)"
      >
        <ChevronRight class="icon-sm" />
      </button>
    </footer>
  </main>
</template>

<style scoped>
.content-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
