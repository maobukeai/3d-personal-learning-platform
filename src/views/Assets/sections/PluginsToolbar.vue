<script setup lang="ts">
import { computed } from 'vue';
import {
  CheckCheck,
  Heart,
  HeartOff,
  ListChecks,
  PanelLeftOpen,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Tabs from '@/components/ui/Tabs.vue';
import PageToolbar from '@/components/skeleton/PageToolbar.vue';
import { useLabel } from '@/utils/i18n';
import type { LibraryTab, PluginInsights, SortMode, ViewMode } from '../pluginsSchema';
interface Props {
  searchQuery: string;
  activeTab: LibraryTab;
  sortBy: SortMode;
  viewMode: ViewMode;
  viewModeOptions: { value: ViewMode; label: string; icon: typeof Heart }[];
  showFavoritesOnly: boolean;
  isBatchMode: boolean;
  isLoading: boolean;
  isFilterOpen: boolean;
  isFilterCollapsed: boolean;
  selectedCount: number;
  visibleCount: number;
  insights: PluginInsights | null;
  favoritedCount: number;
  helpRequestsCount: number;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:activeTab', value: LibraryTab): void;
  (e: 'update:sortBy', value: SortMode): void;
  (e: 'update:viewMode', value: ViewMode): void;
  (e: 'update:showFavoritesOnly', value: boolean): void;
  (e: 'update:isBatchMode', value: boolean): void;
  (e: 'update:isFilterOpen', value: boolean): void;
  (e: 'update:isFilterCollapsed', value: boolean): void;
  (e: 'refresh'): void;
  (e: 'upload'): void;
  (e: 'ai-search'): void;
  (e: 'select-all'): void;
  (e: 'bulk-delete'): void;
  (e: 'bulk-unfavorite'): void;
}>();
const label = useLabel();
const libraryTabOptions = computed(() => [
  {
    label: `${label('插件广场', 'Explore')} ${props.insights?.summary.total || 0}`,
    value: 'explore',
  },
  {
    label: `${label('我的收藏', 'Favorites')} ${props.insights?.summary.favoriteCount || props.favoritedCount}`,
    value: 'favorites',
  },
  {
    label: `${label('我的插件', 'My Uploads')} ${props.insights?.summary.myUploads || 0}`,
    value: 'mine',
  },
  {
    label: `${label('草稿箱', 'Drafts')} ${props.insights?.summary.myPending || 0}`,
    value: 'drafts',
  },
  { label: `${label('插件求助', 'Help Requests')} ${props.helpRequestsCount}`, value: 'requests' },
]);
const showBatchButton = computed(
  () =>
    props.activeTab === 'mine' || props.activeTab === 'drafts' || props.activeTab === 'favorites',
);
</script>
<template>
  <div class="plugins-region">
    <!-- Header: page title + description + primary actions -->
    <div class="plugins-header">
      <div class="plugins-header__text">
        <h1 class="typo-h1">{{ label('插件库', 'Plugin Library') }}</h1>
        <p class="typo-h3 plugins-header__desc">
          {{
            label(
              '浏览、收藏并分享 3D 软件插件，或在求助论坛向社区提问。',
              'Browse, favorite and share 3D software plugins, or ask the community for help.',
            )
          }}
        </p>
      </div>
      <div class="plugins-header__actions shrink-0">
        <Button variant="secondary" size="sm" @click="emit('ai-search')">
          <Sparkles class="w-3.5 h-3.5" /> <span>{{ label('AI 全网搜', 'AI Search') }}</span>
        </Button>
        <Button variant="secondary" size="sm" :disabled="isLoading" @click="emit('refresh')">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          <span>{{ label('刷新', 'Refresh') }}</span>
        </Button>
        <Button variant="primary" size="sm" :icon="UploadCloud" @click="emit('upload')">
          {{ label('上传插件', 'Upload Plugin') }}
        </Button>
      </div>
    </div>
  </div>
  <div class="plugins-region">
    <PageToolbar
      :search-value="searchQuery"
      :search-placeholder="label('搜索插件、标签、兼容版本', 'Search plugins, tags, or versions')"
      :bulk-mode="isBatchMode"
      collapse-on-mobile
      :collapse-label="label('筛选', 'Filters')"
      @update:search-value="emit('update:searchQuery', $event)"
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
          @click="emit('update:showFavoritesOnly', !showFavoritesOnly)"
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
        <template v-if="showBatchButton">
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
          @click="emit('select-all')"
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
          @click="activeTab === 'favorites' ? emit('bulk-unfavorite') : emit('bulk-delete')"
        >
          <component :is="activeTab === 'favorites' ? HeartOff : Trash2" class="w-4 h-4" />
        </button>
      </template>
    </PageToolbar>
  </div>
</template>
<style scoped>
.plugins-region {
  padding-inline: var(--page-gutter);
}
.plugins-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.plugins-header__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.plugins-header__desc {
  color: var(--text-on-solid-muted);
}
.plugins-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
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
  background: var(--warning, #f59e0b);
}
.batch-action-btn.batch-unfav:hover {
  opacity: 0.85;
}
.batch-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
@media (max-width: 768px) {
  .plugins-region {
    padding-inline: var(--page-gutter-mobile);
  }
  .plugins-header {
    flex-direction: column;
    align-items: stretch;
  }
  .plugins-header__actions {
    justify-content: flex-end;
  }
}
</style>
