<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import { type Component } from 'vue';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonGrid from '@/components/SkeletonGrid.vue';
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
  isLoading: boolean;
  filteredWorks: UnifiedWork[];
}>();

const emit = defineEmits<{
  openWork: [work: UnifiedWork];
  edit: [work: UnifiedWork];
  download: [work: UnifiedWork];
  share: [work: UnifiedWork];
  delete: [work: UnifiedWork];
  publish: [];
}>();
</script>

<template>
  <main class="content-panel">
    <section class="toolbar mobile-row">
      <div class="toolbar-left">
        <Tabs v-model="activeTab" :options="libraryTabOptions" size="sm" />
      </div>

      <div class="toolbar-right">
        <el-select v-model="sortBy" class="custom-sort-select" style="width: 100px" aria-label="排序方式">
          <el-option value="newest" label="最新更新" />
          <el-option value="oldest" label="最早发布" />
          <el-option value="name" label="名称排序" />
          <el-option value="status" label="审核状态" />
        </el-select>
        <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
      </div>
    </section>

    <div class="works-main">
      <SkeletonGrid v-if="isLoading" :count="8" :columns="viewMode === 'list' ? 1 : 4" compact />

      <div v-else-if="filteredWorks.length" class="works-grid" :class="viewMode">
        <UnifiedCard
          v-for="work in filteredWorks"
          :key="work.uid"
          :item="work"
          kind="work"
          :view-mode="viewMode"
          :active-tab="activeTab"
          @click="emit('openWork', work)"
          @edit="emit('edit', work)"
          @download="emit('download', work)"
          @share="emit('share', work)"
          @select="emit('delete', work)"
        />
      </div>

      <EmptyState
        v-else
        :icon="Sparkles"
        title="还没有匹配的作品"
        description="换一个筛选条件，或发布新的资源、材料、插件或展示作品。"
        action-text="发布作品"
        @action="emit('publish')"
      />
    </div>
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
  gap: 10px;
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
