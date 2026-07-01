<script setup lang="ts">
import { type Component } from 'vue';
import { Heart, SlidersHorizontal } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Tabs from '@/components/ui/Tabs.vue';

type SortMode = 'latest' | 'popular' | 'name';
type ViewMode = 'grid' | 'list';
type LibraryTab = 'explore' | 'favorites' | 'mine' | 'requests';

defineProps<{
  activeTab: LibraryTab;
  libraryTabOptions: { label: string; value: string }[];
  sortBy: SortMode;
  viewMode: ViewMode;
  viewModeOptions: { value: ViewMode; icon: Component }[];
  showFavoritesOnly: boolean;
  isFilterOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortBy', value: SortMode): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'toggleFavorites'): void;
  (e: 'toggleFilter'): void;
}>();

const label = useLabel();

const onTabChange = (value: string | number | null) => {
  if (value === null) return;
  emit('update:activeTab', value as LibraryTab);
};

const onViewModeChange = (value: string | number | null) => {
  if (value === null) return;
  emit('update:viewMode', value as ViewMode);
};
</script>

<template>
  <section class="toolbar mobile-row">
    <div class="toolbar-left">
      <button type="button" class="icon-button mobile-filter" @click="emit('toggleFilter')">
        <SlidersHorizontal class="icon-sm" />
      </button>
      <Tabs
        :model-value="activeTab"
        :options="libraryTabOptions"
        size="sm"
        @update:model-value="onTabChange"
      />
    </div>

    <div class="toolbar-right">
      <el-select
        :model-value="sortBy"
        class="custom-sort-select"
        style="width: 100px"
        aria-label="排序方式"
        @update:model-value="(val) => emit('update:sortBy', val)"
      >
        <el-option value="latest" :label="label('最新发布', 'Newest')" />
        <el-option value="popular" :label="label('下载最多', 'Most Downloaded')" />
        <el-option value="name" :label="label('名称排序', 'Name')" />
      </el-select>
      <button
        type="button"
        class="ghost-button"
        :class="{ active: showFavoritesOnly }"
        @click="emit('toggleFavorites')"
      >
        <Heart class="icon-sm" />
        {{ label('收藏', 'Saved') }}
      </button>
      <Tabs
        :model-value="viewMode"
        :options="viewModeOptions"
        size="sm"
        @update:model-value="onViewModeChange"
      />
    </div>
  </section>
</template>

<style scoped>
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

.mobile-filter {
  display: none;
}

.select-field {
  min-width: 100px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--bg-card);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-field:hover {
  border-color: var(--border-strong);
}

.select-field:focus {
  border-color: var(--accent);
}

.ghost-button {
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.ghost-button.active {
  border-color: rgba(37, 99, 235, 0.25);
  color: var(--accent);
  background: var(--accent-subtle);
}

.icon-sm {
  width: 14px;
  height: 14px;
}

@media (max-width: 980px) {
  .mobile-filter {
    display: grid;
  }
}

@media (max-width: 760px) {
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

  .primary-button,
  .ghost-button,
  .select-field {
    flex: 1;
  }
}
</style>
