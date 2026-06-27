<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import UnifiedCard from '@/components/UnifiedCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';
import FilterStatusStrip from './FilterStatusStrip.vue';

const props = defineProps<{
  items: any[];
  kind: 'asset' | 'material' | 'plugin' | 'work';
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  activeTab: string;
  activeFilterChips: Array<{ key: string; label: string }>;
  totalCount: number;
  pagination?: { page: number; totalPages: number; total?: number };
  emptyTitle?: string;
  emptyBody?: string;
  emptyActionText?: string;
  selectedIds?: string[];
  favoritedIds?: string[];
  downloadingIds?: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: 'click', item: any): void;
  (e: 'select', id: string, event?: Event): void;
  (e: 'like', item: any, event?: Event): void;
  (e: 'download', item: any, event?: Event): void;
  (e: 'share', item: any): void;
  (e: 'edit', item: any): void;
  (e: 'delete', item: any): void;
  (e: 'create'): void;
  (e: 'page-change', page: number): void;
  (e: 'clear-filter', key: string): void;
  (e: 'reset-filters'): void;
}>();

const label = useLabel();

const selectedIdSet = computed(() => new Set(props.selectedIds || []));

// helper to check if item is favorited
const isItemFavorited = (item: any) => {
  if (props.favoritedIds) {
    return props.favoritedIds.includes(item.id);
  }
  // fallback for asset / material
  return Boolean(item.isFavorited || (item.likes && item.likes > 0));
};

const getUnitLabel = () => {
  if (props.kind === 'asset') return label('个资源', 'assets');
  if (props.kind === 'material') return label('个材料', 'materials');
  if (props.kind === 'plugin') return label('个插件', 'plugins');
  return label('个作品', 'works');
};

const getEmptyChipsLabel = () => {
  if (props.kind === 'asset') return label('当前显示全部公开资源', 'Showing all public assets');
  if (props.kind === 'material') return label('当前显示全部公开材料', 'Showing all public materials');
  if (props.kind === 'plugin') return label('当前显示全部公开插件', 'Showing all public plugins');
  return label('当前显示全部作品', 'Showing all works');
};
</script>

<template>
  <div class="resource-grid-panel">
    <FilterStatusStrip
      :current-count="items.length"
      :total-count="totalCount"
      :unit-label="getUnitLabel()"
      :empty-chips-label="getEmptyChipsLabel()"
      :active-chips="activeFilterChips"
      @clear-chip="emit('clear-filter', $event)"
      @reset="emit('reset-filters')"
    />

    <SkeletonGrid v-if="isLoading" :count="kind === 'material' ? 12 : 8" :columns="viewMode === 'list' ? 1 : 4" compact />

    <div v-else-if="items.length" class="items-grid" :class="viewMode">
      <UnifiedCard
        v-for="item in items"
        :key="item.uid || item.id"
        :item="item"
        :kind="kind"
        :view-mode="viewMode"
        :is-selected="selectedIdSet.has(item.id)"
        :is-favorited="isItemFavorited(item)"
        :downloading="downloadingIds ? !!downloadingIds[item.id] : undefined"
        :active-tab="activeTab"
        @click="emit('click', item)"
        @select="(_item, event) => emit('select', item.id, event)"
        @like="(_item, event) => emit('like', item, event)"
        @download="(_item, event) => emit('download', item, event)"
        @edit="emit('edit', item)"
        @share="emit('share', item)"
      />
    </div>

    <EmptyState
      v-else
      :icon="Sparkles"
      :title="emptyTitle || label('还没有匹配的内容', 'No matching items')"
      :description="emptyBody || label('调整筛选条件或点击下方按钮上传', 'Adjust filters or click below to upload')"
      :action-text="emptyActionText"
      @action="emit('create')"
    />

    <div v-if="pagination && pagination.totalPages > 1" class="pagination-row">
      <button
        type="button"
        class="pagination-btn"
        :disabled="pagination.page === 1"
        @click="emit('page-change', pagination.page - 1)"
      >
        <ChevronLeft class="icon-sm" />
      </button>
      <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
      <button
        type="button"
        class="pagination-btn"
        :disabled="pagination.page === pagination.totalPages"
        @click="emit('page-change', pagination.page + 1)"
      >
        <ChevronRight class="icon-sm" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.resource-grid-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.items-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.pagination-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

@media (max-width: 560px) {
  .items-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>
