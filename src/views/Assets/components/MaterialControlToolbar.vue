<script setup lang="ts">
import { type Component } from 'vue';
import { SlidersHorizontal } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Tabs from '@/components/ui/Tabs.vue';

type SortMode = 'latest' | 'popular' | 'favorited' | 'largest' | 'smallest';
type ViewMode = 'grid' | 'list';
type LibraryTab = 'explore' | 'favorites' | 'mine';

defineProps<{
  activeTab: LibraryTab;
  libraryTabOptions: { label: string; value: string; badge?: number | string }[];
  sortBy: SortMode;
  viewMode: ViewMode;
  viewModeOptions: { value: ViewMode; icon: Component }[];
  isFilterOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortBy', value: SortMode): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'toggleFilter'): void;
}>();

const label = useLabel();

const onSortChange = (event: Event) => {
  emit('update:sortBy', (event.target as HTMLSelectElement).value as SortMode);
};
</script>

<template>
  <section class="control-bar mobile-row">
    <div class="toolbar-left">
      <Tabs
        :model-value="activeTab"
        :options="libraryTabOptions"
        size="sm"
        @update:model-value="emit('update:activeTab', $event as LibraryTab)"
      />
    </div>

    <div class="toolbar-right">
      <button type="button" class="icon-button mobile-filter" @click="emit('toggleFilter')">
        <SlidersHorizontal class="icon-sm" />
      </button>
      <el-select :model-value="sortBy" class="!w-28 custom-select" aria-label="排序方式" @change="(v: SortMode) => emit('update:sortBy', v)">
        <el-option value="latest" :label="label('最新', 'Newest')" />
        <el-option value="popular" :label="label('下载', 'Downloads')" />
        <el-option value="favorited" :label="label('收藏', 'Favorites')" />
        <el-option value="largest" :label="label('体积大', 'Largest')" />
        <el-option value="smallest" :label="label('体积小', 'Smallest')" />
      </el-select>
      <Tabs
        :model-value="viewMode"
        :options="viewModeOptions"
        size="sm"
        @update:model-value="emit('update:viewMode', $event as ViewMode)"
      />
    </div>
  </section>
</template>

<style scoped>
.control-bar {
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

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.icon-sm {
  width: 14px;
  height: 14px;
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
  border-color: #d97706;
  outline: 0;
}

.mobile-filter {
  display: none;
}

@media (max-width: 860px) {
  .control-bar {
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

  .mobile-filter {
    display: grid;
    flex: 0 0 32px;
  }
}
</style>
