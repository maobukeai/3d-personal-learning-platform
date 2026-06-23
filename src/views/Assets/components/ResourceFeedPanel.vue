<script setup lang="ts">
import { computed, type Component } from 'vue';
import { ArrowRight, Layers, Sparkles } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  formatResourceNumber as formatNumber,
  type KindFilter,
  type ResourceFeedMeta,
  type ResourceItem,
  type SortMode,
  type StatusFilter,
} from '../resourceCenterModel';

const activeKind = defineModel<KindFilter>('activeKind', { required: true });
const activeStatus = defineModel<StatusFilter>('activeStatus', { required: true });
const sortMode = defineModel<SortMode>('sortMode', { required: true });
const viewMode = defineModel<'grid' | 'list'>('viewMode', { required: true });

const props = defineProps<{
  feedItems: ResourceItem[];
  feedMeta: ResourceFeedMeta | null;
  isFeedLoading: boolean;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  resultTotal: number;
  kindTabOptions: { label: string; value: string; icon?: Component }[];
  statusTabOptions: { label: string; value: string }[];
  viewModeOptions: { value: 'grid' | 'list'; icon: Component }[];
}>();

const emit = defineEmits<{
  (e: 'setPage', page: number): void;
  (e: 'openItem', item: ResourceItem): void;
  (e: 'openMaterialLibrary'): void;
  (e: 'openPublishDialog'): void;
}>();

const isMaterialFeed = computed(() => activeKind.value === 'material');
const materialFeedItems = computed(() =>
  props.feedItems.filter((item) => item.kind === 'material'),
);

function setPage(page: number) {
  const nextPage = Math.min(Math.max(page, 1), props.totalPages);
  if (nextPage === props.currentPage) return;
  emit('setPage', nextPage);
}

function getMaterialDownloads(item: ResourceItem) {
  return item.downloads ?? (item.metricLabel === '下载' ? item.metric : 0);
}

function getMaterialFavorites(item: ResourceItem) {
  return item.favorites ?? (item.metricLabel === '收藏' ? item.metric : 0);
}
</script>

<template>
  <main class="feed-panel">
    <div class="feed-toolbar mobile-row">
      <div class="toolbar-left">
        <Tabs v-model="activeKind" :options="kindTabOptions" size="sm" />
        <Tabs v-model="activeStatus" :options="statusTabOptions" size="sm" />
      </div>

      <div class="toolbar-right">
        <select v-model="sortMode" class="sort-select" aria-label="资源排序">
          <option value="updated">按最近更新</option>
          <option value="created">按发布时间</option>
          <option value="metric">按热度指标</option>
          <option value="review">按审核压力</option>
          <option value="title">按名称</option>
        </select>
        <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
        <div class="result-count">
          <span>{{ resultTotal }} 条结果</span>
        </div>
      </div>
    </div>

    <div v-if="isMaterialFeed" class="material-mode-bar mobile-row">
      <div>
        <Layers class="icon-sm" />
        <strong>材质样本</strong>
        <span>{{ formatNumber(resultTotal) }} 个 / PBR / SBSAR / 纹理包</span>
      </div>
      <button type="button" @click="emit('openMaterialLibrary')">
        完整材质库
        <ArrowRight class="icon-xs" />
      </button>
    </div>

    <div v-if="isFeedLoading" class="feed-list" :class="viewMode">
      <div v-for="index in 8" :key="index" class="feed-row skeleton-row"></div>
    </div>

    <div v-else-if="isMaterialFeed && materialFeedItems.length" class="feed-list" :class="viewMode">
      <UnifiedCard
        v-for="item in materialFeedItems"
        :key="`${item.kind}:${item.id}`"
        :item="{
          ...item,
          downloads: getMaterialDownloads(item),
          likes: getMaterialFavorites(item),
        }"
        kind="material"
        :view-mode="viewMode"
        @click="emit('openItem', item)"
      />
    </div>

    <div v-else-if="feedItems.length" class="feed-list" :class="viewMode">
      <UnifiedCard
        v-for="item in feedItems"
        :key="`${item.kind}:${item.id}`"
        :item="item"
        :kind="item.kind"
        :view-mode="viewMode"
        @click="emit('openItem', item)"
      />
    </div>

    <EmptyState
      v-else
      :icon="Sparkles"
      title="没有匹配的资源动态"
      description="换一个筛选条件，或发布新的资源、材质、插件和展示作品。"
      action-text="发布内容"
      @action="emit('openPublishDialog')"
    />

    <footer v-if="resultTotal > pageSize" class="feed-pagination mobile-row">
      <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      <div>
        <button
          type="button"
          :disabled="currentPage === 1 || isFeedLoading"
          @click="setPage(currentPage - 1)"
        >
          上一页
        </button>
        <button
          type="button"
          :disabled="currentPage === totalPages || isFeedLoading"
          @click="setPage(currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.feed-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.feed-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-card);
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.result-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.sort-select {
  height: 32px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 24px 0 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sort-select:hover {
  border-color: var(--border-strong);
}

.sort-select:focus {
  border-color: var(--accent);
  outline: 0;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

/* Material Switch Section */
.material-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  margin-top: 4px;
  border: 1px solid rgba(217, 119, 6, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(217, 119, 6, 0.06), rgba(15, 118, 110, 0.03)), var(--bg-card);
  padding: 6px 12px;
}

.material-mode-bar > div {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.material-mode-bar strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.material-mode-bar span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-mode-bar svg {
  flex: 0 0 auto;
  color: var(--warning);
}

.material-mode-bar button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  height: 26px;
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 6px;
  background: rgba(217, 119, 6, 0.05);
  color: #b45309;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.material-mode-bar button:hover {
  background: rgba(217, 119, 6, 0.1);
  border-color: rgba(217, 119, 6, 0.4);
}

/* Pagination */
.feed-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.feed-pagination > div {
  display: flex;
  gap: 6px;
}

.feed-pagination button {
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.feed-pagination button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.feed-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.skeleton-row {
  min-height: 62px;
  background:
    linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent), var(--bg-card);
  background-size:
    220px 100%,
    auto;
  animation: shimmer 1.2s linear infinite;
}

@keyframes shimmer {
  from {
    background-position:
      -220px 0,
      0 0;
  }
  to {
    background-position:
      calc(100% + 220px) 0,
      0 0;
  }
}

@media (max-width: 760px) {
  .feed-toolbar {
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

  .sort-select {
    width: 100%;
  }

  .result-count {
    justify-content: space-between;
    white-space: normal;
  }

  .material-mode-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .material-mode-bar button {
    justify-content: center;
    width: 100%;
    height: 32px;
  }

  .feed-list.grid {
    grid-template-columns: 1fr;
  }
}
</style>
