<script setup lang="ts">
import { type Component } from 'vue';
import {
  Heart,
  HeartOff,
  ListChecks,
  PanelLeftOpen,
  SlidersHorizontal,
  Trash2,
  CheckCheck,
} from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Button from '@/components/ui/Button.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import PageToolbar from '@/components/skeleton/PageToolbar.vue';
import type { LibraryTab, SortMode, ViewMode } from '../softwaresSchema';
defineProps<{
  searchQuery: string;
  isLoading: boolean;
  activeTab: LibraryTab;
  libraryTabOptions: { label: string; value: string }[];
  sortBy: SortMode;
  viewMode: ViewMode;
  viewModeOptions: { value: ViewMode; label: string; icon: Component }[];
  showFavoritesOnly: boolean;
  isFilterCollapsed: boolean;
  isFilterOpen: boolean;
  isBatchMode: boolean;
  selectedCount: number;
  visibleCount: number;
}>();
const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortBy', value: SortMode): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'update:isBatchMode', value: boolean): void;
  (e: 'update:isFilterOpen', value: boolean): void;
  (e: 'update:isFilterCollapsed', value: boolean): void;
  (e: 'toggleFavorites'): void;
  (e: 'selectAll'): void;
  (e: 'bulkDelete'): void;
  (e: 'bulkUnfavorite'): void;
}>();
const label = useLabel();
</script>
<template>
  <div>
    <PageToolbar
      :show-search="false"
      :bulk-mode="isBatchMode"
      collapse-on-mobile
      :collapse-label="label('筛选', 'Filters')"
      @update:bulk-mode="emit('update:isBatchMode', $event)"
    >
      <template #filters>
        <Tabs
          :model-value="activeTab"
          :options="libraryTabOptions"
          size="sm"
          @update:model-value="emit('update:activeTab', $event as LibraryTab)"
        />
        <button
          v-if="isFilterCollapsed"
          type="button"
          class="toolbar-icon-btn"
          :title="label('展开侧边筛选栏', 'Expand filter sidebar')"
          @click="emit('update:isFilterCollapsed', false)"
        >
          <PanelLeftOpen class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="toolbar-icon-btn"
          :title="label('筛选', 'Filters')"
          @click="emit('update:isFilterOpen', !isFilterOpen)"
        >
          <SlidersHorizontal class="w-4 h-4" />
        </button>
      </template>
      <template #view-switch>
        <Select
          :model-value="sortBy"
          class="custom-sort-select"
          style="width: 100px"
          :aria-label="label('排序方式', 'Sort by')"
          @update:model-value="emit('update:sortBy', $event as SortMode)"
        >
          <SelectOption value="latest" :label="label('最新发布', 'Newest')" />
          <SelectOption value="popular" :label="label('下载最多', 'Most Downloaded')" />
          <SelectOption value="name" :label="label('名称排序', 'Name')" />
        </Select>
        <button
          type="button"
          class="toolbar-icon-btn"
          :class="{ active: showFavoritesOnly }"
          :title="label('收藏', 'Saved')"
          @click="emit('toggleFavorites')"
        >
          <Heart class="w-4 h-4" />
        </button>
        <Tabs
          :model-value="viewMode"
          :options="viewModeOptions"
          size="sm"
          @update:model-value="emit('update:viewMode', $event as ViewMode)"
        />
      </template>
      <template #actions>
        <template
          v-if="activeTab === 'mine' || activeTab === 'drafts' || activeTab === 'favorites'"
        >
          <Button
            v-if="!isBatchMode"
            variant="outline"
            size="sm"
            @click="emit('update:isBatchMode', true)"
          >
            <ListChecks class="w-3.5 h-3.5" /> <span>{{ label('批量管理', 'Batch Manage') }}</span>
          </Button>
        </template>
      </template>
      <template #bulk-actions>
        <span class="typo-caption batch-count">
          {{ label(`已选 ${selectedCount} 项`, `${selectedCount} selected`) }}
        </span>
        <button
          type="button"
          class="toolbar-icon-btn"
          :title="
            selectedCount === visibleCount && visibleCount > 0
              ? label('取消全选', 'Deselect All')
              : label('全选本页', 'Select All')
          "
          @click="emit('selectAll')"
        >
          <CheckCheck class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="batch-action-btn"
          :class="activeTab === 'favorites' ? 'batch-unfav' : 'batch-del'"
          :disabled="!selectedCount"
          :title="
            activeTab === 'favorites'
              ? label('批量取消收藏', 'Batch Unfavorite')
              : label('批量删除', 'Batch Delete')
          "
          @click="activeTab === 'favorites' ? emit('bulkUnfavorite') : emit('bulkDelete')"
        >
          <component :is="activeTab === 'favorites' ? HeartOff : Trash2" class="w-4 h-4" />
        </button>
      </template>
    </PageToolbar>
  </div>
</template>
<style scoped>
.toolbar-icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--surface-solid-border);
  border-radius: var(--radius-sm);
  background: var(--surface-solid);
  color: var(--text-on-solid-secondary);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.toolbar-icon-btn:hover {
  border-color: var(--card-border-hover);
  background: var(--bg-hover);
  color: var(--text-on-solid-primary);
}
.toolbar-icon-btn.active {
  border-color: var(--card-border-hover);
  color: var(--accent);
  background: var(--accent-subtle);
}
.batch-count {
  color: var(--text-on-solid-secondary);
  font-weight: var(--font-semibold);
  white-space: nowrap;
}
.batch-action-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-on-solid-primary);
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-standard);
}
.batch-action-btn.batch-del {
  background: var(--danger);
}
.batch-action-btn.batch-del:hover {
  opacity: 0.85;
}
.batch-action-btn.batch-unfav {
  background: var(--warning);
}
.batch-action-btn.batch-unfav:hover {
  opacity: 0.85;
}
.batch-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
