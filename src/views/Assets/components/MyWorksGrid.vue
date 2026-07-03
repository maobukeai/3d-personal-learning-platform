<script setup lang="ts">
import { type Component } from 'vue';
import { PanelLeftOpen } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import { useLabel } from '@/utils/i18n';
import ResourceGridPanel from './ResourceGridPanel.vue';
import type { UnifiedWork, WorkSortKey, WorkViewMode } from '../myWorksModel';

interface GridTabOption {
  label?: string;
  value: string;
  badge?: number | string;
  icon?: Component;
}

const activeTab = defineModel<'mine' | 'favorites'>('activeTab', { required: true });
const sortBy = defineModel<WorkSortKey>('sortBy', { required: true });
const viewMode = defineModel<WorkViewMode>('viewMode', { required: true });

defineProps<{
  libraryTabOptions: GridTabOption[];
  viewModeOptions: GridTabOption[];
  isFilterCollapsed?: boolean;
  isLoading: boolean;
  filteredWorks: UnifiedWork[];
  activeFilterChips: Array<{ key: string; label: string }>;
  totalCount: number;
}>();

const emit = defineEmits<{
  openWork: [work: UnifiedWork];
  edit: [work: UnifiedWork];
  download: [work: UnifiedWork];
  share: [work: UnifiedWork];
  delete: [work: UnifiedWork];
  publish: [];
  clearFilter: [key: string];
  resetFilters: [];
  toggleFilterCollapse: [];
}>();

const label = useLabel();
</script>

<template>
  <main class="content-panel">
    <section class="toolbar mobile-row">
      <div class="toolbar-left flex items-center">
        <button
          v-if="isFilterCollapsed"
          type="button"
          class="p-2 rounded-xl text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center mr-1 shrink-0"
          title="展开侧边筛选栏"
          @click="emit('toggleFilterCollapse')"
        >
          <PanelLeftOpen class="w-4 h-4 text-indigo-400" />
        </button>
        <Tabs v-model="activeTab" :options="libraryTabOptions" size="sm" />
      </div>

      <div class="toolbar-right">
        <el-select
          v-model="sortBy"
          class="custom-sort-select"
          style="width: 100px"
          aria-label="排序方式"
        >
          <el-option value="newest" label="最新更新" />
          <el-option value="oldest" label="最早发布" />
          <el-option value="name" label="名称排序" />
          <el-option value="status" label="审核状态" />
        </el-select>
        <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
      </div>
    </section>

    <ResourceGridPanel
      kind="work"
      :items="filteredWorks"
      :is-loading="isLoading"
      :view-mode="viewMode"
      :active-tab="activeTab"
      :active-filter-chips="activeFilterChips"
      :total-count="totalCount"
      :empty-title="label('还没有匹配的作品', 'No Matching Works')"
      :empty-body="
        label(
          '换一个筛选条件，或发布新的资源、材料、插件或展示作品。',
          'Adjust filters or publish new assets, materials, plugins, or showcases.',
        )
      "
      :empty-action-text="label('发布作品', 'Publish Work')"
      @click="emit('openWork', $event)"
      @edit="emit('edit', $event)"
      @download="emit('download', $event)"
      @share="emit('share', $event)"
      @delete="emit('delete', $event)"
      @create="emit('publish')"
      @clear-filter="emit('clearFilter', $event)"
      @reset-filters="emit('resetFilters')"
    />
  </main>
</template>

<style scoped>
.icon-sm {
  width: 14px;
  height: 14px;
}

.content-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Toolbar */
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
  border-color: #2563eb;
  outline: 0;
}

/* Works Main Grid & Cards */
.works-main {
  min-width: 0;
  flex: 1;
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.works-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 680px) {
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

  .select-field,
  .primary-button {
    width: 100%;
  }

  .works-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>
