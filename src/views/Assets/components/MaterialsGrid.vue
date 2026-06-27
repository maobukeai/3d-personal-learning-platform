<script setup lang="ts">
import { useLabel } from '@/utils/i18n';
import ResourceGridPanel from './ResourceGridPanel.vue';

type ViewMode = 'grid' | 'list';
type LibraryTab = 'explore' | 'favorites' | 'mine';
type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface MaterialUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface NormalizedMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  preview: string;
  downloads: number;
  fileSize: number;
  resolution: string;
  favorites: number;
  isProcedural?: boolean;
  status?: MaterialStatus;
  rejectReason?: string | null;
  userId?: string;
  isFavorited?: boolean;
  _count?: { favorites?: number };
  user?: MaterialUser | null;
  createdAt?: string;
}

const props = defineProps<{
  isLoading: boolean;
  viewMode: ViewMode;
  materials: NormalizedMaterial[];
  selectedIds: string[];
  activeTab: LibraryTab;
  emptyTitle: string;
  emptyBody: string;
  activeFilterChips: Array<{ key: string; label: string }>;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: 'openDetail', material: NormalizedMaterial): void;
  (e: 'toggleSelect', id: string, event?: Event): void;
  (e: 'toggleFavorite', material: NormalizedMaterial, event?: Event): void;
  (e: 'download', material: NormalizedMaterial, event?: Event): void;
  (e: 'create'): void;
  (e: 'clearFilter', key: string): void;
  (e: 'resetFilters'): void;
}>();

const label = useLabel();
</script>

<template>
  <main class="asset-area">
    <ResourceGridPanel
      kind="material"
      :items="materials"
      :is-loading="isLoading"
      :view-mode="viewMode"
      :active-tab="activeTab"
      :active-filter-chips="activeFilterChips"
      :total-count="totalCount"
      :selected-ids="selectedIds"
      :empty-title="emptyTitle"
      :empty-body="emptyBody"
      :empty-action-text="label('上传材质', 'Upload Material')"
      @click="emit('openDetail', $event)"
      @select="(id, event) => emit('toggleSelect', id, event)"
      @like="(item, event) => emit('toggleFavorite', item, event)"
      @download="(item, event) => emit('download', item, event)"
      @create="emit('create')"
      @clear-filter="emit('clearFilter', $event)"
      @reset-filters="emit('resetFilters')"
    />
  </main>
</template>

<style scoped>
.asset-area {
  min-width: 0;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.material-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 560px) {
  .material-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>
