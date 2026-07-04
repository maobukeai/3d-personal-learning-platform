<script setup lang="ts">
import { type Component } from 'vue';
import { SlidersHorizontal, ListChecks, CheckCheck, Trash2, HeartOff, PanelLeftOpen } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Tabs from '@/components/ui/Tabs.vue';

type SortMode = 'latest' | 'popular' | 'favorited' | 'largest' | 'smallest';
type ViewMode = 'grid' | 'list';
type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts' | 'requests';

defineProps<{
  activeTab: LibraryTab;
  libraryTabOptions: { label: string; value: string; badge?: number | string }[];
  sortBy: SortMode;
  viewMode: ViewMode;
  viewModeOptions: { value: ViewMode; icon: Component }[];
  isFilterOpen: boolean;
  isFilterCollapsed?: boolean;
  selectedIds?: string[];
  isBatchMode?: boolean;
  visibleMaterialsCount?: number;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortBy', value: SortMode): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'update:isBatchMode', value: boolean): void;
  (e: 'toggleFilter'): void;
  (e: 'toggleFilterCollapse'): void;
  (e: 'selectAll'): void;
  (e: 'bulkDelete'): void;
  (e: 'bulkUnfavorite'): void;
}>();

const label = useLabel();
</script>

<template>
  <section class="control-bar mobile-row">
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
      <Tabs
        :model-value="activeTab"
        :options="libraryTabOptions"
        size="sm"
        @update:model-value="emit('update:activeTab', $event as LibraryTab)"
      />
    </div>

    <div class="toolbar-right">
      <!-- 当处于 'mine'、'drafts' 或 'favorites' 时提供批量管理功能 -->
      <template v-if="activeTab === 'mine' || activeTab === 'drafts' || activeTab === 'favorites'">
        <div v-if="isBatchMode" class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-muted)] font-mono mr-0.5">
            已选 {{ selectedIds?.length || 0 }} 项
          </span>
          <button
            type="button"
            class="p-1.5 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--text-primary)] transition-colors flex items-center justify-center"
            :title="(selectedIds?.length || 0) === (visibleMaterialsCount || 0) && (visibleMaterialsCount || 0) > 0 ? '取消全选' : '全选本页'"
            @click="emit('selectAll')"
          >
            <CheckCheck class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="p-1.5 text-xs rounded-lg text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            :class="activeTab === 'favorites' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'"
            :disabled="!selectedIds?.length"
            :title="activeTab === 'favorites' ? '批量取消收藏' : '批量删除'"
            @click="activeTab === 'favorites' ? emit('bulkUnfavorite') : emit('bulkDelete')"
          >
            <component :is="activeTab === 'favorites' ? HeartOff : Trash2" class="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="px-2.5 py-1 text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium transition-colors flex items-center gap-1.5"
          title="批量管理"
          @click="emit('update:isBatchMode', true)"
        >
          <ListChecks class="w-3.5 h-3.5" />
          <span>批量管理</span>
        </button>
      </template>

      <button type="button" class="icon-button mobile-filter" @click="emit('toggleFilter')">
        <SlidersHorizontal class="icon-sm" />
      </button>
      <el-select
        :model-value="sortBy"
        class="!w-28 custom-select"
        aria-label="排序方式"
        @change="(v: SortMode) => emit('update:sortBy', v)"
      >
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
